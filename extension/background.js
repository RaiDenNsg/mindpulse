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

const NOTIFICATION_PREFIX = 'mindpulse-distraction-';
const NOTIFICATION_ICON = createNotificationIconDataUrl();
const MESSAGE_SOURCE_BACKGROUND = 'mindpulse-background';

const notificationTabs = new Set();

function createNotificationIconDataUrl() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="100%" stop-color="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="28" fill="url(#g)" />
      <path d="M39 69c0-13.8 11.2-25 25-25s25 11.2 25 25v17H39V69z" fill="#0f172a" opacity="0.88" />
      <circle cx="64" cy="47" r="16" fill="#e2e8f0" />
      <path d="M49 92h30" stroke="#e2e8f0" stroke-width="8" stroke-linecap="round" />
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

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

function notificationsCreate(notificationId, options) {
  return new Promise((resolve) => {
    try {
      chrome.notifications.create(notificationId, options, (createdNotificationId) => {
        if (chrome.runtime.lastError) {
          console.error('MindPulse notification create failed:', chrome.runtime.lastError.message);
          resolve(false);
          return;
        }

        resolve(Boolean(createdNotificationId));
      });
    } catch (error) {
      console.error('MindPulse notification create threw:', error);
      resolve(false);
    }
  });
}

function notificationsClear(notificationId) {
  return new Promise((resolve) => {
    try {
      chrome.notifications.clear(notificationId, (wasCleared) => {
        if (chrome.runtime.lastError) {
          console.error('MindPulse notification clear failed:', chrome.runtime.lastError.message);
          resolve(false);
          return;
        }

        resolve(Boolean(wasCleared));
      });
    } catch (error) {
      console.error('MindPulse notification clear threw:', error);
      resolve(false);
    }
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
  const mode = Number(value);
  return mode === 1 || mode === 2 || mode === 3 ? mode : DEFAULT_FOCUS_MODE;
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

    const notificationId = `${NOTIFICATION_PREFIX}${tab.id}`;
    const created = await notificationsCreate(notificationId, {
      type: 'basic',
      iconUrl: NOTIFICATION_ICON,
      title: 'Hey, you have work to do! 👀',
      message: 'You switched to a distracting site. Stay focused!',
      buttons: [
        { title: "I'm on a break 😴" },
        { title: 'Back to work 💪' }
      ],
      requireInteraction: true
    });

    if (!created) {
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

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  void (async () => {
    try {
      if (!notificationId.startsWith(NOTIFICATION_PREFIX)) {
        return;
      }

      const tabId = Number(notificationId.slice(NOTIFICATION_PREFIX.length));
      if (Number.isNaN(tabId)) {
        return;
      }

      const state = await storageGet([
        STORAGE_KEYS.activeCodingTabId,
        STORAGE_KEYS.activeCodingUrl,
        STORAGE_KEYS.pendingDistractionTabId,
        STORAGE_KEYS.pendingDistractionSiteName,
      ]);

      const codingTabId = state[STORAGE_KEYS.activeCodingTabId];
      const codingTabUrl = state[STORAGE_KEYS.activeCodingUrl];
      const distractionTabId = state[STORAGE_KEYS.pendingDistractionTabId] || tabId;

      await notificationsClear(notificationId);

      if (buttonIndex === 0) {
        // \"I'm on a break\" - session is already paused, just clear pending distraction
        await storageSet({
          [STORAGE_KEYS.pendingDistractionTabId]: null,
          [STORAGE_KEYS.pendingDistractionSiteName]: null,
        });
        return;
      }

      if (buttonIndex !== 1 || !codingTabId) {
        return;
      }

      if (distractionTabId === codingTabId) {
        if (codingTabUrl) {
          await chrome.tabs.update(codingTabId, { url: codingTabUrl, active: true });
        }
      } else {
        await chrome.tabs.remove(distractionTabId).catch(() => {});
        await chrome.tabs.update(codingTabId, { active: true });
      }

      await sendTabMessage(codingTabId, { type: 'RESUME_SESSION' });

      await storageSet({
        [STORAGE_KEYS.sessionActive]: true,
        [STORAGE_KEYS.sessionPaused]: false,
        [STORAGE_KEYS.pendingDistractionTabId]: null,
        [STORAGE_KEYS.pendingDistractionSiteName]: null,
      });
    } catch (error) {
      console.error('MindPulse notification button handling failed:', error);
    }
  })();
});
