// MindPulse Tracker - Content Script
// Tracks typing behavior on coding platforms

let keystrokeCount = 0;
let backspaceCount = 0;
let lastTimestamp = Date.now();
let sessionStartTime = Date.now();
let istyping = false;
let typingTimeout;
let isSessionPaused = false;
let pausedAt = null;
let totalPausedMs = 0;

function runtimeSendMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, () => {
        if (chrome.runtime.lastError) {
          console.warn('[MindPulse] SESSION_UPDATE send failed:', chrome.runtime.lastError.message);
          resolve(false);
          return;
        }

        resolve(true);
      });
    } catch (error) {
      console.error('[MindPulse] runtime.sendMessage failed:', error);
      resolve(false);
    }
  });
}

// Initialize session data
const initializeSession = () => {
  keystrokeCount = 0;
  backspaceCount = 0;
  sessionStartTime = Date.now();
  lastTimestamp = Date.now();
  istyping = false;
  isSessionPaused = false;
  pausedAt = null;
  totalPausedMs = 0;
};

function getElapsedMilliseconds() {
  const now = Date.now();
  const pausedDuration = totalPausedMs + (isSessionPaused && pausedAt ? now - pausedAt : 0);
  return Math.max(0, now - sessionStartTime - pausedDuration);
}

function isTrackableTarget(target) {
  if (!target || !(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.matches('input, textarea') ||
    target.closest('[contenteditable], .cm-editor, [class*="ace"], [class*="monaco"]')
  );
}

// Listen for all keydown events on the page
document.addEventListener('keydown', (event) => {
  console.log('[MindPulse] keydown event:', event.key);

  if (isSessionPaused) {
    return;
  }

  // Only track when in an input/textarea or code editor
  const target = event.target;
  const isInputElement = isTrackableTarget(target);

  if (!isInputElement) return;

  // Track backspace/delete separately
  if (event.key === 'Backspace' || event.key === 'Delete') {
    backspaceCount++;
  } else if (event.key.length === 1 || event.key === 'Enter') {
    // Count actual character inputs
    keystrokeCount++;
  }

  istyping = true;
  clearTimeout(typingTimeout);

  // Reset typing status after 5 seconds of inactivity
  typingTimeout = setTimeout(() => {
    istyping = false;
  }, 5000);

  const sessionData = captureMetrics();
  chrome.storage.local.set({
    currentSessionData: sessionData,
    lastUpdate: Date.now(),
  });

  // Explicit SESSION_UPDATE dispatch for background service worker.
  void runtimeSendMessage({ type: 'SESSION_UPDATE', data: sessionData });

  console.log('[MindPulse] tracked input key:', {
    key: event.key,
    keystrokeCount,
    backspaceCount,
    platform: sessionData.platform,
  });
}, true); // Use capture phase to catch all events

// Calculate typing speed and other metrics every 30 seconds
setInterval(() => {
  const sessionData = captureMetrics();
  chrome.storage.local.set({
    currentSessionData: sessionData,
    lastUpdate: Date.now(),
  });

  // Explicit SESSION_UPDATE dispatch for background service worker.
  void runtimeSendMessage({ type: 'SESSION_UPDATE', data: sessionData });
}, 30000); // Update every 30 seconds

// Get current platform
function getPlatform() {
  const host = window.location.hostname;
  if (host.includes('leetcode')) return 'LeetCode';
  if (host.includes('hackerrank')) return 'HackerRank';
  if (host.includes('programiz')) return 'Programiz';
  return 'Unknown';
}

// Store current metrics
function captureMetrics() {
  const now = Date.now();
  const elapsedSeconds = getElapsedMilliseconds() / 1000;

  const typingSpeedWPM = elapsedSeconds > 0 
    ? Math.round((keystrokeCount / 5) / (elapsedSeconds / 60))
    : 0;

  const focusScore = keystrokeCount > 0
    ? Math.max(0, Math.min(100, 100 - (backspaceCount / keystrokeCount) * 50))
    : 0;

  const cognitiveLoad = keystrokeCount > 0
    ? Math.max(0, Math.min(100, 
        (backspaceCount * 3) + ((elapsedSeconds / keystrokeCount) * 2) - (typingSpeedWPM / 10)
      ))
    : 0;

  return {
    keystrokeCount,
    backspaceCount,
    typingSpeed: typingSpeedWPM,
    focusScore: Math.round(focusScore),
    cognitiveLoad: Math.round(cognitiveLoad),
    elapsedSeconds: Math.round(elapsedSeconds),
    istyping,
    timestamp: now,
    platform: getPlatform(),
    sessionStartTime
  };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_SESSION_DATA') {
    const metrics = captureMetrics();
    sendResponse({ data: metrics });
  } else if (request.type === 'RESET_SESSION') {
    initializeSession();
    sendResponse({ status: 'reset' });
  } else if (request.type === 'PAUSE_SESSION') {
    if (!isSessionPaused) {
      isSessionPaused = true;
      pausedAt = Date.now();
    }

    const metrics = captureMetrics();
    chrome.storage.local.set({
      currentSessionData: metrics,
      lastUpdate: Date.now(),
    });
    void runtimeSendMessage({ type: 'SESSION_UPDATE', data: metrics });
    sendResponse({ status: 'paused' });
  } else if (request.type === 'RESUME_SESSION') {
    if (isSessionPaused && pausedAt) {
      totalPausedMs += Date.now() - pausedAt;
      pausedAt = null;
      isSessionPaused = false;
    }

    const metrics = captureMetrics();
    chrome.storage.local.set({
      currentSessionData: metrics,
      lastUpdate: Date.now(),
    });
    void runtimeSendMessage({ type: 'SESSION_UPDATE', data: metrics });
    sendResponse({ status: 'resumed' });
  }
});

// Initialize on load
initializeSession();
console.log('MindPulse Tracker initialized on', getPlatform());
