// MindPulse Tracker - Content Script
// Tracks typing behavior on coding platforms

let keystrokeCount = 0;
let backspaceCount = 0;
let lastTimestamp = Date.now();
let sessionStartTime = Date.now();
let istyping = false;
let typingTimeout;

// Initialize session data
const initializeSession = () => {
  keystrokeCount = 0;
  backspaceCount = 0;
  sessionStartTime = Date.now();
  lastTimestamp = Date.now();
  istyping = false;
};

// Listen for all keydown events on the page
document.addEventListener('keydown', (event) => {
  // Only track when in an input/textarea or code editor
  const target = event.target;
  const isInputElement = target.matches('input, textarea') || 
                         target.closest('[contenteditable], .cm-editor, [class*="ace"], [class*="monaco"]');

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
}, true); // Use capture phase to catch all events

// Calculate typing speed and other metrics every 30 seconds
setInterval(() => {
  const now = Date.now();
  const elapsedSeconds = (now - sessionStartTime) / 1000;

  if (keystrokeCount === 0) return; // Skip if no activity

  const typingSpeedWPM = elapsedSeconds > 0 
    ? Math.round((keystrokeCount / 5) / (elapsedSeconds / 60))
    : 0;

  const focusScore = Math.max(0, Math.min(100, 100 - (backspaceCount / keystrokeCount) * 50));

  const cognitiveLoad = Math.max(0, Math.min(100, 
    (backspaceCount * 3) + ((elapsedSeconds / keystrokeCount) * 2) - (typingSpeedWPM / 10)
  ));

  const sessionData = {
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

  // Send to popup and background
  chrome.storage.local.set({ currentSessionData: sessionData });
  chrome.runtime.sendMessage({ type: 'SESSION_UPDATE', data: sessionData }).catch(() => {
    // Popup might not be open, ignore error
  });
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
  const elapsedSeconds = (now - sessionStartTime) / 1000;

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
  }
});

// Initialize on load
initializeSession();
console.log('MindPulse Tracker initialized on', getPlatform());
