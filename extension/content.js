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
let lastTypedText = '';
let lastKeystrokeTime = 0;
let youtubeStudyState = {
  channelName: '',
  isStudyChannel: false,
};

const YOUTUBE_CHANNEL_STORAGE_KEY = 'youtubeChannel';

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
  lastTypedText = '';
};

function updateLastTypedText(key) {
  if (key === 'Backspace' || key === 'Delete') {
    lastTypedText = lastTypedText.slice(0, -1);
    return;
  }

  if (key === 'Enter') {
    lastTypedText += ' ';
  } else if (key.length === 1) {
    lastTypedText += key;
  }

  if (lastTypedText.length > 50) {
    lastTypedText = lastTypedText.slice(-50);
  }
}

function normalizeYouTubeChannelName(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase();
}

function isYouTubeHost() {
  return window.location.hostname.includes('youtube.com');
}

function getYouTubeChannelNameFromDom() {
  const channelLink =
    document.querySelector('#channel-name a') ||
    document.querySelector('ytd-channel-name a');

  if (!channelLink) {
    return '';
  }

  const text = channelLink.textContent || channelLink.getAttribute('href') || '';
  return String(text).trim();
}

function getYouTubeChannelNameFromTitle(title) {
  const normalizedTitle = String(title || '').trim();
  if (!normalizedTitle) {
    return '';
  }

  const parts = normalizedTitle.split(' - ').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2 && parts[parts.length - 1].toLowerCase() === 'youtube') {
    return parts[parts.length - 2] || '';
  }

  return '';
}

function getYouTubeChannelNameFromUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.replace(/\/+$/, '');
    const pathParts = pathname.split('/').filter(Boolean);

    if (pathParts[0] && pathParts[0].startsWith('@')) {
      return decodeURIComponent(pathParts[0]);
    }

    if (pathParts[0] === 'c' || pathParts[0] === 'channel' || pathParts[0] === 'user') {
      return decodeURIComponent(pathParts[1] || '');
    }
  } catch {
    // Fall through to title parsing.
  }

  return getYouTubeChannelNameFromTitle(document.title);
}

function getYouTubeChannelName() {
  if (!isYouTubeHost()) {
    return '';
  }

  return (
    getYouTubeChannelNameFromDom() ||
    getYouTubeChannelNameFromUrl(window.location.href)
  );
}

function isTrackableYouTubeChannel(channelName, studyChannels) {
  const normalizedChannelName = normalizeYouTubeChannelName(channelName);
  if (!normalizedChannelName) {
    return false;
  }

  return (studyChannels || []).some(
    (entry) => normalizeYouTubeChannelName(entry) === normalizedChannelName
  );
}

async function refreshYouTubeStudyState() {
  if (!isYouTubeHost()) {
    youtubeStudyState = {
      channelName: '',
      isStudyChannel: false,
    };

    await chrome.storage.local.set({
      [YOUTUBE_CHANNEL_STORAGE_KEY]: null,
      currentYouTubeChannelName: null,
    });
    return;
  }

  const stored = await chrome.storage.local.get(['studyChannels']);
  const channelName = getYouTubeChannelName();
  const studyChannels = Array.isArray(stored.studyChannels) ? stored.studyChannels : [];

  youtubeStudyState = {
    channelName,
    isStudyChannel: isTrackableYouTubeChannel(channelName, studyChannels),
  };

  await chrome.storage.local.set({
    [YOUTUBE_CHANNEL_STORAGE_KEY]: channelName || null,
    currentYouTubeChannelName: channelName || null,
  });
}

function getElapsedMilliseconds() {
  const now = Date.now();
  const pausedDuration = totalPausedMs + (isSessionPaused && pausedAt ? now - pausedAt : 0);
  return Math.max(0, now - sessionStartTime - pausedDuration);
}

function isTrackableTarget(target) {
  if (!target || !(target instanceof Element)) {
    return false;
  }

  if (isYouTubeHost() && !youtubeStudyState.isStudyChannel) {
    return false;
  }

  return Boolean(
    target.matches('input, textarea') ||
    target.closest('[contenteditable], .cm-editor, [class*="ace"], [class*="monaco"]')
  );
}

function buildStorageSessionData(metrics) {
  return {
    keystrokes: metrics.keystrokeCount,
    typingSpeed: metrics.typingSpeed,
    focusScore: metrics.focusScore,
    cognitiveLoad: metrics.cognitiveLoad,
    sessionDuration: metrics.elapsedSeconds,
    backspaces: metrics.backspaceCount,
    platform: metrics.platform,
    timestamp: metrics.timestamp,
  };
}

function persistSessionData(metrics) {
  chrome.storage.local.set({
    sessionData: buildStorageSessionData(metrics),
    currentSessionData: metrics,
    lastTypedText: lastTypedText,
    lastUpdate: Date.now(),
  });
}

// Listen for all keydown events on the page
document.addEventListener('keydown', (event) => {
  if (isSessionPaused) {
    return;
  }

  // Only track when in an input/textarea or code editor
  const target = event.target;
  const isInputElement = isTrackableTarget(target);

  if (!isInputElement) return;

  lastKeystrokeTime = Date.now();
  chrome.storage.local.set({ lastKeystrokeTime });

  // Track backspace/delete separately
  if (event.key === 'Backspace' || event.key === 'Delete') {
    backspaceCount++;
  } else if (event.key.length === 1 || event.key === 'Enter') {
    // Count actual character inputs
    keystrokeCount++;
  }

  updateLastTypedText(event.key);

  istyping = true;
  clearTimeout(typingTimeout);

  // Reset typing status after 5 seconds of inactivity
  typingTimeout = setTimeout(() => {
    istyping = false;
  }, 5000);

  const sessionData = captureMetrics();
  persistSessionData(sessionData);
}, true); // Use capture phase to catch all events

// Calculate typing speed and other metrics every 30 seconds
setInterval(() => {
  void (async () => {
    await refreshYouTubeStudyState();
    const sessionData = captureMetrics();
    persistSessionData(sessionData);
  })();
}, 30000); // Update every 30 seconds

// Get current platform
function getPlatform() {
  const host = window.location.hostname;
  if (host.includes('leetcode')) return 'LeetCode';
  if (host.includes('hackerrank')) return 'HackerRank';
  if (host.includes('youtube')) return youtubeStudyState.isStudyChannel ? 'YouTube' : 'Unknown';
  if (host.includes('codepen')) return 'CodePen';
  if (host.includes('w3schools')) return 'W3Schools';
  if (host.includes('khanacademy')) return 'Khan Academy';
  if (host.includes('replit')) return 'Replit';
  if (host.includes('codesandbox')) return 'CodeSandbox';
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
    lastTypedText = '';
    lastKeystrokeTime = 0;
    sendResponse({ status: 'reset' });
  } else if (request.type === 'PAUSE_SESSION') {
    if (!isSessionPaused) {
      isSessionPaused = true;
      pausedAt = Date.now();
    }

    const metrics = captureMetrics();
    persistSessionData(metrics);
    sendResponse({ status: 'paused' });
  } else if (request.type === 'RESUME_SESSION') {
    if (isSessionPaused && pausedAt) {
      totalPausedMs += Date.now() - pausedAt;
      pausedAt = null;
      isSessionPaused = false;
    }

    const metrics = captureMetrics();
    persistSessionData(metrics);
    sendResponse({ status: 'resumed' });
  }
});

// Initialize on load
initializeSession();
void refreshYouTubeStudyState();
console.log('MindPulse Tracker initialized on', getPlatform());

let youtubeRefreshTimer = null;
const youtubeDomObserver = new MutationObserver(() => {
  if (!isYouTubeHost()) {
    return;
  }

  if (youtubeRefreshTimer) {
    clearTimeout(youtubeRefreshTimer);
  }

  youtubeRefreshTimer = setTimeout(() => {
    void refreshYouTubeStudyState();
  }, 250);
});

if (isYouTubeHost()) {
  youtubeDomObserver.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
  });
}

// Poll for URL changes every 2 seconds (YouTube is a SPA)
let lastUrl = location.href;
setInterval(() => {
  try {
    if (!isYouTubeHost()) return;
    if (location.href !== lastUrl) {
      lastUrl = location.href;

      // Wait 2 seconds for YouTube to update DOM with channel info
      setTimeout(() => {
        const channelEl = document.querySelector('ytd-channel-name a, #channel-name a, #owner a');
        const channelName = channelEl ? String(channelEl.textContent || '').trim() : null;

        if (channelName) {
          chrome.storage.local.set({ youtubeChannel: channelName });
          chrome.runtime.sendMessage({
            type: 'YOUTUBE_CHANNEL_CHANGED',
            channel: channelName,
            url: location.href,
          });
        }
      }, 2000);
    }
  } catch (e) {
    // ignore
  }
}, 2000);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') {
    return;
  }

  if (changes.studyChannels || changes.currentYouTubeChannelName || changes.youtubeChannel) {
    void refreshYouTubeStudyState();
  }
});
