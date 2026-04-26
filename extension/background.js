// MindPulse Tracker - Background Service Worker

const CODING_SITES = [
  { domain: 'leetcode.com', name: 'LeetCode' },
  { domain: 'hackerrank.com', name: 'HackerRank' },
  { domain: 'programiz.com', name: 'Programiz' },
];

const DISTRACTION_SITES = [
  { domain: 'youtube.com', name: 'YouTube' },
  { domain: 'netflix.com', name: 'Netflix' },
  { domain: 'twitter.com', name: 'Twitter' },
  { domain: 'reddit.com', name: 'Reddit' },
  { domain: 'instagram.com', name: 'Instagram' },
  { domain: 'tiktok.com', name: 'TikTok' },
  { domain: 'facebook.com', name: 'Facebook' },
];

const STORAGE_KEYS = {
  sessionActive: 'sessionActive',
  sessionPaused: 'sessionPaused',
  activeCodingTabId: 'activeCodingTabId',
  activeCodingUrl: 'activeCodingUrl',
  pendingDistractionTabId: 'pendingDistractionTabId',
  pendingDistractionSiteName: 'pendingDistractionSiteName',
  focusMode: 'focusMode',
};

const DEFAULT_FOCUS_MODE = 2;
const MESSAGE_SOURCE_BACKGROUND = 'mindpulse-background';
const STUCK_CHECK_INTERVAL_MS = 30000;
const STUCK_IDLE_THRESHOLD_MS = 120000;
const STUCK_ALERT_COOLDOWN_MS = 5 * 60 * 1000;
const STUCK_BACKSPACE_DELTA_THRESHOLD = 15;

let lastBackspaceSnapshot = null;

const notificationTabs = new Set();

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function storageSet(values) {
  return new Promise((resolve) => {
    chrome.storage.local.set(values, resolve);
  });
}

function storageRemove(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, resolve);
  });
}

function runtimeSendMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, () => {
        if (chrome.runtime.lastError) {
          resolve(false);
          return;
        }

        resolve(true);
      });
    } catch (error) {
      console.error('MindPulse runtime.sendMessage threw:', error);
      resolve(false);
    }
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, () => {
      resolve(!chrome.runtime.lastError);
    });
  });
}

function getTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        resolve(null);
        return;
      }

      resolve(tab);
    });
  });
}

function getHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function normalizeHostname(hostname) {
  if (!hostname) {
    return '';
  }

  return hostname.replace(/^www\./, '').replace(/^m\./, '');
}

function matchesDomain(hostname, domain) {
  const normalizedHostname = normalizeHostname(hostname);
  const normalizedDomain = normalizeHostname(domain);
  return (
    normalizedHostname === normalizedDomain ||
    normalizedHostname.endsWith(`.${normalizedDomain}`)
  );
}

function getSiteName(url, sites) {
  const hostname = getHostname(url);
  const site = sites.find((entry) => matchesDomain(hostname, entry.domain));
  return site?.name || null;
}

function getCodingSiteName(url) {
  return getSiteName(url, CODING_SITES);
}

function getDistractionSiteName(url) {
  return getSiteName(url, DISTRACTION_SITES);
}

function normalizeFocusMode(value) {
  const mode = Number.parseInt(value, 10);
  return mode === 1 || mode === 2 || mode === 3 ? mode : DEFAULT_FOCUS_MODE;
}

async function checkStuckDetection() {
  try {
    const now = Date.now();
    const state = await storageGet([
      STORAGE_KEYS.focusMode,
      STORAGE_KEYS.activeCodingTabId,
      'sessionData',
      'lastKeystrokeTime',
      'lastStuckAlert',
    ]);

    const focusMode = normalizeFocusMode(state[STORAGE_KEYS.focusMode]);
    if (focusMode !== 2 && focusMode !== 3) {
      return;
    }

    const sessionData = state.sessionData || {};
    const totalKeystrokes = Number(sessionData.keystrokes || 0);
    if (totalKeystrokes <= 10) {
      return;
    }

    const totalBackspaces = Number(sessionData.backspaces || 0);
    const backspacesInWindow =
      lastBackspaceSnapshot == null ? 0 : Math.max(0, totalBackspaces - lastBackspaceSnapshot);
    lastBackspaceSnapshot = totalBackspaces;

    const lastKeystrokeTime = Number(state.lastKeystrokeTime || 0);
    const idleMs = lastKeystrokeTime > 0 ? Math.max(0, now - lastKeystrokeTime) : 0;
    const isIdleStuck =
      lastKeystrokeTime > 0 && idleMs > STUCK_IDLE_THRESHOLD_MS;
    const isBackspaceStuck = backspacesInWindow > STUCK_BACKSPACE_DELTA_THRESHOLD;

    const lastStuckAlert = Number(state.lastStuckAlert || 0);
    const cooldownActive =
      lastStuckAlert > 0 && now - lastStuckAlert < STUCK_ALERT_COOLDOWN_MS;

    console.log('[MindPulse] stuck-check:', {
      idleMs,
      backspaceDelta: backspacesInWindow,
      cooldownActive,
      isIdleStuck,
      isBackspaceStuck,
      keystrokes: totalKeystrokes,
      focusMode,
    });

    if (!isIdleStuck && !isBackspaceStuck) {
      return;
    }

    if (cooldownActive) {
      return;
    }

    const activeCodingTabId = state[STORAGE_KEYS.activeCodingTabId];
    if (!activeCodingTabId) {
      return;
    }

    const codingTab = await getTab(activeCodingTabId);
    if (!codingTab) {
      return;
    }

    await storageSet({ lastStuckAlert: now });
    await sendTabMessage(activeCodingTabId, { type: 'SHOW_STUCK_OVERLAY' });
  } catch (error) {
    console.error('[MindPulse] stuck detection failed:', error);
  }
}

async function updateSessionStateFromTab(tab) {
  try {
    if (!tab?.url) {
      return;
    }

    const codingSiteName = getCodingSiteName(tab.url);
    if (codingSiteName) {
      await handleCodingTab(tab, codingSiteName);
      return;
    }

    const distractionSiteName = getDistractionSiteName(tab.url);
    if (distractionSiteName) {
      await handleDistractionTab(tab, distractionSiteName);
    }
  } catch (error) {
    console.error('[MindPulse] updateSessionStateFromTab error:', error);
  }
}

async function handleCodingTab(tab, codingSiteName) {
  try {
    const state = await storageGet([
      STORAGE_KEYS.sessionPaused,
      STORAGE_KEYS.pendingDistractionTabId,
      STORAGE_KEYS.pendingDistractionSiteName,
    ]);

    const nextState = {
      [STORAGE_KEYS.sessionActive]: true,
      [STORAGE_KEYS.activeCodingTabId]: tab.id,
      [STORAGE_KEYS.activeCodingUrl]: tab.url,
      [STORAGE_KEYS.pendingDistractionTabId]: null,
      [STORAGE_KEYS.pendingDistractionSiteName]: null,
    };

    // Resume tracking if it was paused
    if (state[STORAGE_KEYS.sessionPaused]) {
      await sendTabMessage(tab.id, { type: 'RESUME_SESSION' });
      nextState[STORAGE_KEYS.sessionPaused] = false;
    }

    await storageSet(nextState);
    console.log('MindPulse active coding tab:', codingSiteName, tab.id);
  } catch (error) {
    console.error('[MindPulse] handleCodingTab error:', error);
  }
}

async function handleDistractionTab(tab, distractionSiteName) {
  try {
    const state = await storageGet([
      STORAGE_KEYS.sessionActive,
      STORAGE_KEYS.sessionPaused,
      STORAGE_KEYS.activeCodingTabId,
      STORAGE_KEYS.activeCodingUrl,
      STORAGE_KEYS.focusMode,
    ]);

    if (!state[STORAGE_KEYS.sessionActive]) {
      return;
    }

    const activeCodingTabId = state[STORAGE_KEYS.activeCodingTabId];
    const focusMode = normalizeFocusMode(state[STORAGE_KEYS.focusMode]);

    console.log('MindPulse tab switch detected:', tab.url, 'mode:', focusMode);

    if (focusMode === 1) {
      return;
    }

    if (state[STORAGE_KEYS.sessionPaused] && focusMode !== 3) {
      return;
    }

    if (focusMode === 3) {
      const codingTab = activeCodingTabId ? await getTab(activeCodingTabId) : null;

      if (codingTab) {
        await chrome.tabs.update(activeCodingTabId, { active: true });
        await sendTabMessage(activeCodingTabId, { type: 'RESUME_SESSION' });
      }

      await chrome.tabs.remove(tab.id).catch(() => {});

      await storageSet({
        [STORAGE_KEYS.sessionActive]: true,
        [STORAGE_KEYS.sessionPaused]: false,
        [STORAGE_KEYS.pendingDistractionTabId]: null,
        [STORAGE_KEYS.pendingDistractionSiteName]: null,
      });
      return;
    }

    if (!activeCodingTabId) {
      return;
    }

    // Prevent duplicate notifications for the same tab
    if (notificationTabs.has(tab.id)) {
      return;
    }

    notificationTabs.add(tab.id);

    // Pause tracking on the coding tab
    await sendTabMessage(activeCodingTabId, { type: 'PAUSE_SESSION' });

    console.log('[MindPulse] Study mode notification branch reached:', {
      tabId: tab.id,
      distractionSiteName,
      focusMode,
    });

    console.log('MindPulse showing distraction overlay...');

    const created = await sendTabMessage(tab.id, {
      type: 'SHOW_DISTRACTION_OVERLAY',
      siteName: distractionSiteName,
    });

    if (!created) {
      console.warn('[MindPulse] Failed to show distraction overlay on tab:', tab.id);
      return;
    }

    await storageSet({
      [STORAGE_KEYS.sessionActive]: true,
      [STORAGE_KEYS.sessionPaused]: true,
      [STORAGE_KEYS.pendingDistractionTabId]: tab.id,
      [STORAGE_KEYS.pendingDistractionSiteName]: distractionSiteName,
    });
  } catch (error) {
    console.error('MindPulse distraction handling failed:', error);
  } finally {
    notificationTabs.delete(tab.id);
  }
}

async function initializeSessionState() {
  try {
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, resolve);
    });

    const activeTab = tabs[0];
    if (activeTab?.url) {
      await updateSessionStateFromTab(activeTab);
    }
  } catch (error) {
    console.error('[MindPulse] initializeSessionState error:', error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void initializeSessionState();
});

chrome.runtime.onStartup.addListener(() => {
  void initializeSessionState();
});

setInterval(() => {
  void checkStuckDetection();
}, STUCK_CHECK_INTERVAL_MS);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SESSION_UPDATE') {
    if (request.source === MESSAGE_SOURCE_BACKGROUND) {
      return;
    }

    const detectedPlatform = getCodingSiteName(sender?.tab?.url) || getCodingSiteName(sender?.url);
    const mergedData = {
      ...request.data,
      platform:
        request?.data?.platform && request.data.platform !== 'Unknown'
          ? request.data.platform
          : detectedPlatform || request?.data?.platform || 'Unknown',
    };

    console.log('[MindPulse] SESSION_UPDATE received:', {
      tabId: sender?.tab?.id ?? null,
      platform: mergedData.platform,
      keystrokeCount: mergedData.keystrokeCount,
    });

    chrome.storage.local.set(
      {
        currentSessionData: mergedData,
        lastUpdate: Date.now(),
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error('[MindPulse] Failed to store SESSION_UPDATE:', chrome.runtime.lastError.message);
          return;
        }

        console.log('[MindPulse] SESSION_UPDATE stored in chrome.storage.local');
      }
    );

    void runtimeSendMessage({
      type: 'SESSION_UPDATE',
      data: mergedData,
      source: MESSAGE_SOURCE_BACKGROUND,
    });
  }

  if (request.type === 'RESET_SESSION') {
    chrome.storage.local.set({
      [STORAGE_KEYS.sessionActive]: true,
      [STORAGE_KEYS.sessionPaused]: false,
    });
  }

  if (request.type === 'TAKING_BREAK') {
    void (async () => {
      try {
        const state = await storageGet([STORAGE_KEYS.activeCodingTabId]);
        const codingTabId = state[STORAGE_KEYS.activeCodingTabId];

        if (codingTabId) {
          await sendTabMessage(codingTabId, { type: 'PAUSE_SESSION' });
        }

        await storageSet({
          [STORAGE_KEYS.sessionActive]: true,
          [STORAGE_KEYS.sessionPaused]: true,
          [STORAGE_KEYS.pendingDistractionTabId]: null,
          [STORAGE_KEYS.pendingDistractionSiteName]: null,
        });
      } catch (error) {
        console.error('[MindPulse] TAKING_BREAK handling failed:', error);
      }
    })();
  }

  if (request.type === 'BACK_TO_WORK') {
    void (async () => {
      try {
        const state = await storageGet([
          STORAGE_KEYS.activeCodingTabId,
          STORAGE_KEYS.activeCodingUrl,
          STORAGE_KEYS.pendingDistractionTabId,
        ]);

        const codingTabId = state[STORAGE_KEYS.activeCodingTabId];
        const codingTabUrl = state[STORAGE_KEYS.activeCodingUrl];
        const distractionTabId =
          state[STORAGE_KEYS.pendingDistractionTabId] || sender?.tab?.id || null;

        if (!codingTabId) {
          return;
        }

        if (distractionTabId && distractionTabId !== codingTabId) {
          await chrome.tabs.remove(distractionTabId).catch(() => {});
        } else if (distractionTabId === codingTabId && codingTabUrl) {
          await chrome.tabs.update(codingTabId, { url: codingTabUrl, active: true });
        }

        await chrome.tabs.update(codingTabId, { active: true });
        await sendTabMessage(codingTabId, { type: 'RESUME_SESSION' });

        await storageSet({
          [STORAGE_KEYS.sessionActive]: true,
          [STORAGE_KEYS.sessionPaused]: false,
          [STORAGE_KEYS.pendingDistractionTabId]: null,
          [STORAGE_KEYS.pendingDistractionSiteName]: null,
        });
      } catch (error) {
        console.error('[MindPulse] BACK_TO_WORK handling failed:', error);
      }
    })();
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  void (async () => {
    try {
      const tab = await getTab(activeInfo.tabId);
      await updateSessionStateFromTab(tab);
    } catch (error) {
      console.error('[MindPulse] Tab activated error:', error);
    }
  })();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    if (!tab?.active || (!changeInfo.url && changeInfo.status !== 'complete')) {
      return;
    }

    void (async () => {
      try {
        await updateSessionStateFromTab(tab || { id: tabId, url: changeInfo.url });
      } catch (error) {
        console.error('[MindPulse] Tab update state error:', error);
      }
    })();
  } catch (error) {
    console.error('[MindPulse] Tab updated error:', error);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
    try {
      const state = await storageGet([
        STORAGE_KEYS.activeCodingTabId,
        STORAGE_KEYS.pendingDistractionTabId,
      ]);

      const updates = {};
      let shouldUpdate = false;

      if (state[STORAGE_KEYS.activeCodingTabId] === tabId) {
        updates[STORAGE_KEYS.sessionActive] = false;
        updates[STORAGE_KEYS.sessionPaused] = false;
        updates[STORAGE_KEYS.activeCodingTabId] = null;
        updates[STORAGE_KEYS.activeCodingUrl] = null;
        shouldUpdate = true;
      }

      if (state[STORAGE_KEYS.pendingDistractionTabId] === tabId) {
        updates[STORAGE_KEYS.pendingDistractionTabId] = null;
        updates[STORAGE_KEYS.pendingDistractionSiteName] = null;
        shouldUpdate = true;
      }

      if (shouldUpdate) {
        await storageSet(updates);
      }
    } catch (error) {
      console.error('[MindPulse] Tab removed error:', error);
    }
  })();
});

