// MindPulse Tracker - Background Service Worker

const CODING_SITES = [
  { domain: 'leetcode.com', name: 'LeetCode' },
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
};

const NOTIFICATION_PREFIX = 'mindpulse-distraction-';
const NOTIFICATION_ICON = createNotificationIconDataUrl();

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
    chrome.notifications.create(notificationId, options, resolve);
  });
}

function notificationsClear(notificationId) {
  return new Promise((resolve) => {
    chrome.notifications.clear(notificationId, () => resolve());
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

function matchesDomain(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
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

async function updateSessionStateFromTab(tab) {
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
}

async function handleCodingTab(tab, codingSiteName) {
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

  if (state[STORAGE_KEYS.sessionPaused]) {
    await sendTabMessage(tab.id, { type: 'RESUME_SESSION' });
    nextState[STORAGE_KEYS.sessionPaused] = false;
  }

  await storageSet(nextState);
  console.log('MindPulse active coding tab:', codingSiteName, tab.id);
}

async function handleDistractionTab(tab, distractionSiteName) {
  if (notificationTabs.has(tab.id)) {
    return;
  }

  const state = await storageGet([
    STORAGE_KEYS.sessionActive,
    STORAGE_KEYS.sessionPaused,
    STORAGE_KEYS.activeCodingTabId,
    STORAGE_KEYS.activeCodingUrl,
    STORAGE_KEYS.pendingDistractionTabId,
  ]);

  if (!state[STORAGE_KEYS.sessionActive] || state[STORAGE_KEYS.sessionPaused]) {
    return;
  }

  const activeCodingTabId = state[STORAGE_KEYS.activeCodingTabId];
  if (!activeCodingTabId) {
    return;
  }

  if (state[STORAGE_KEYS.pendingDistractionTabId] === tab.id) {
    return;
  }

  notificationTabs.add(tab.id);

  try {
    const notificationId = `${NOTIFICATION_PREFIX}${tab.id}`;
    await notificationsCreate(notificationId, {
      type: 'basic',
      title: 'Hey, you have work to do! 👀',
      message: `You switched to ${distractionSiteName}. Are you taking a break or distracted?`,
      priority: 2,
      buttons: [
        { title: "I'm on a break 😴" },
        { title: 'Back to work 💪' },
      ],
    });

    await storageSet({
      [STORAGE_KEYS.pendingDistractionTabId]: tab.id,
      [STORAGE_KEYS.pendingDistractionSiteName]: distractionSiteName,
    });
  } finally {
    notificationTabs.delete(tab.id);
  }
}

async function initializeSessionState() {
  const tabs = await new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, resolve);
  });

  const activeTab = tabs[0];
  if (activeTab?.url) {
    await updateSessionStateFromTab(activeTab);
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
    chrome.storage.local.set({
      currentSessionData: request.data,
      lastUpdate: Date.now(),
    });

    chrome.runtime.sendMessage({
      type: 'SESSION_UPDATE',
      data: request.data,
    }).catch(() => {
      // Popup might not be open, ignore error
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
    const tab = await getTab(activeInfo.tabId);
    await updateSessionStateFromTab(tab);
  })();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab?.active || (!changeInfo.url && changeInfo.status !== 'complete')) {
    return;
  }

  void updateSessionStateFromTab(tab || { id: tabId, url: changeInfo.url });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
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
  })();
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  void (async () => {
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
      if (codingTabId) {
        await sendTabMessage(codingTabId, { type: 'PAUSE_SESSION' });
      }

      await storageSet({
        [STORAGE_KEYS.sessionActive]: false,
        [STORAGE_KEYS.sessionPaused]: true,
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
  })();
});
