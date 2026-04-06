// MindPulse Tracker - Popup Script

let currentMetrics = null;
let currentUser = null;

const AUTH_STORAGE_KEY = 'mindpulseAuthUser';

const FIREBASE_API_KEY = 'AIzaSyBeXhjubogCTS4cmEu66F6cmLh9Fn9e9xs';
const FIREBASE_PROJECT_ID = 'mindpulse-a017a';
const FIRESTORE_TOP_LEVEL_SESSIONS_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/sessions?key=${FIREBASE_API_KEY}`;
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

function getFirestoreUserSessionsUrl(userId) {
  return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(userId)}/sessions?key=${FIREBASE_API_KEY}`;
}

// Get the current active tab
async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function getAuthToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!token) {
        reject(new Error('No OAuth token received'));
        return;
      }

      resolve(token);
    });
  });
}

function removeCachedToken(token) {
  return new Promise((resolve) => {
    if (!token) {
      resolve();
      return;
    }

    chrome.identity.removeCachedAuthToken({ token }, () => {
      resolve();
    });
  });
}

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function storageSet(value) {
  return new Promise((resolve) => {
    chrome.storage.local.set(value, resolve);
  });
}

function storageRemove(key) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(key, resolve);
  });
}

function setAuthUI(user) {
  const signInBtn = document.getElementById('signInBtn');
  const userInfo = document.getElementById('userInfo');
  const userName = document.getElementById('userName');
  const userEmail = document.getElementById('userEmail');
  const syncBtn = document.getElementById('syncBtn');

  if (user && user.userId) {
    signInBtn.classList.add('hidden');
    userInfo.classList.remove('hidden');
    userName.textContent = user.name || 'MindPulse User';
    userEmail.textContent = user.email || 'Signed in';
    syncBtn.disabled = currentMetrics ? false : true;
  } else {
    signInBtn.classList.remove('hidden');
    userInfo.classList.add('hidden');
    syncBtn.disabled = true;
  }
}

async function fetchGoogleProfile(token) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Google profile');
  }

  return response.json();
}

async function signInWithGoogle() {
  const signInBtn = document.getElementById('signInBtn');
  const originalText = signInBtn.textContent;

  try {
    signInBtn.disabled = true;
    signInBtn.textContent = 'Signing in...';

    const token = await getAuthToken(true);
    const profile = await fetchGoogleProfile(token);

    const authUser = {
      userId: profile.sub,
      email: profile.email || '',
      name: profile.name || ''
    };

    await storageSet({ [AUTH_STORAGE_KEY]: authUser });
    currentUser = authUser;
    setAuthUI(currentUser);
  } catch (error) {
    console.error('Google sign-in failed:', error);
    signInBtn.textContent = 'Sign-in Failed';
    setTimeout(() => {
      signInBtn.textContent = originalText;
    }, 1500);
  } finally {
    signInBtn.disabled = false;
    if (!currentUser) {
      signInBtn.textContent = originalText;
    }
  }
}

async function signOutGoogle() {
  try {
    const token = await getAuthToken(false).catch(() => null);
    await removeCachedToken(token);
    await storageRemove(AUTH_STORAGE_KEY);
    currentUser = null;
    setAuthUI(currentUser);
  } catch (error) {
    console.error('Sign-out failed:', error);
  }
}

async function initializeAuthState() {
  const stored = await storageGet([AUTH_STORAGE_KEY]);
  currentUser = stored[AUTH_STORAGE_KEY] || null;
  setAuthUI(currentUser);
}

// Request session data from content script
async function fetchSessionData() {
  try {
    const tab = await getCurrentTab();
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SESSION_DATA' });
    updateUI(response.data);
    currentMetrics = response.data;
  } catch (error) {
    console.error('Error fetching session data:', error);
    // Fallback to storage
    chrome.storage.local.get('currentSessionData', (result) => {
      if (result.currentSessionData) {
        updateUI(result.currentSessionData);
        currentMetrics = result.currentSessionData;
      }
    });
  }
}

// Format elapsed time to MM:SS
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format timestamp
function formatTimestamp(timestamp) {
  const now = Date.now();
  const diff = Math.floor((now - timestamp) / 1000);

  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

// Update UI with metrics
function updateUI(metrics) {
  document.getElementById('keystrokeCount').textContent = metrics.keystrokeCount;
  document.getElementById('typingSpeed').textContent = metrics.typingSpeed;
  document.getElementById('focusScore').textContent = metrics.focusScore;
  document.getElementById('cognitiveLoad').textContent = metrics.cognitiveLoad;
  document.getElementById('backspaceCount').textContent = metrics.backspaceCount;
  document.getElementById('sessionTime').textContent = formatTime(metrics.elapsedSeconds);
  document.getElementById('platformBadge').textContent = metrics.platform;
  document.getElementById('timestamp').textContent = `Last updated: ${formatTimestamp(metrics.timestamp)}`;
  document.getElementById('syncBtn').disabled = !currentUser;

  // Color code focus score
  const focusEl = document.getElementById('focusScore');
  if (metrics.focusScore >= 80) {
    focusEl.style.color = '#10b981'; // green
  } else if (metrics.focusScore >= 60) {
    focusEl.style.color = '#f59e0b'; // amber
  } else {
    focusEl.style.color = '#ef4444'; // red
  }

  // Color code cognitive load
  const loadEl = document.getElementById('cognitiveLoad');
  if (metrics.cognitiveLoad <= 40) {
    loadEl.style.color = '#10b981'; // green
  } else if (metrics.cognitiveLoad <= 70) {
    loadEl.style.color = '#f59e0b'; // amber
  } else {
    loadEl.style.color = '#ef4444'; // red
  }
}

function toFirestoreDocument(metrics) {
  const sessionDate = new Date().toISOString().slice(0, 10);
  const platformValue = (metrics.platform || 'programiz').toLowerCase();

  return {
    fields: {
      userId: { stringValue: currentUser?.userId || '' },
      date: { stringValue: sessionDate },
      keystrokes: { integerValue: String(metrics.keystrokeCount || 0) },
      typingSpeed: { integerValue: String(metrics.typingSpeed || 0) },
      focusScore: { integerValue: String(metrics.focusScore || 0) },
      cognitiveLoad: { integerValue: String(metrics.cognitiveLoad || 0) },
      sessionDuration: { integerValue: String(metrics.elapsedSeconds || 0) },
      backspaces: { integerValue: String(metrics.backspaceCount || 0) },
      source: { stringValue: 'extension' },
      platform: { stringValue: platformValue }
    }
  };
}

async function syncSessionToFirebase(metrics) {
  const userId = currentUser?.userId;
  if (!userId) {
    throw new Error('Cannot sync without userId');
  }

  const firestorePayload = toFirestoreDocument(metrics);
  const userSessionsUrl = getFirestoreUserSessionsUrl(userId);

  console.log('[MindPulse Sync] Starting sync');
  console.log('[MindPulse Sync] userId:', userId);
  console.log('[MindPulse Sync] Path:', `users/${userId}/sessions`);
  console.log('[MindPulse Sync] Payload:', {
    date: new Date().toISOString().slice(0, 10),
    keystrokes: metrics.keystrokeCount || 0,
    typingSpeed: metrics.typingSpeed || 0,
    focusScore: metrics.focusScore || 0,
    cognitiveLoad: metrics.cognitiveLoad || 0,
    sessionDuration: metrics.elapsedSeconds || 0,
    backspaces: metrics.backspaceCount || 0,
    source: 'extension',
    platform: (metrics.platform || 'programiz').toLowerCase(),
  });

  // Primary write: users/{userId}/sessions
  const response = await fetch(userSessionsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(firestorePayload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[MindPulse Sync] Nested write failed:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
    });
    throw new Error(errorText || 'Failed to save session to Firestore');
  }

  const nestedResult = await response.json();
  console.log('[MindPulse Sync] Nested write success:', nestedResult?.name || nestedResult);

  // Compatibility write for current web History query path (top-level sessions).
  const mirrorResponse = await fetch(FIRESTORE_TOP_LEVEL_SESSIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(firestorePayload)
  });

  if (!mirrorResponse.ok) {
    const mirrorErrorText = await mirrorResponse.text();
    console.error('[MindPulse Sync] Top-level mirror failed:', {
      status: mirrorResponse.status,
      statusText: mirrorResponse.statusText,
      error: mirrorErrorText,
    });
    throw new Error(mirrorErrorText || 'Nested sync succeeded but mirror sync failed');
  }

  const mirrorResult = await mirrorResponse.json();
  console.log('[MindPulse Sync] Top-level mirror success:', mirrorResult?.name || mirrorResult);

  return { nestedResult, mirrorResult };
}

// Reset session
async function resetSession() {
  try {
    const tab = await getCurrentTab();
    await chrome.tabs.sendMessage(tab.id, { type: 'RESET_SESSION' });
    chrome.storage.local.remove('currentSessionData');
    
    // Reset UI
    document.getElementById('keystrokeCount').textContent = '0';
    document.getElementById('typingSpeed').textContent = '0';
    document.getElementById('focusScore').textContent = '0';
    document.getElementById('cognitiveLoad').textContent = '0';
    document.getElementById('backspaceCount').textContent = '0';
    document.getElementById('sessionTime').textContent = '0:00';
    
    console.log('Session reset');
  } catch (error) {
    console.error('Error resetting session:', error);
  }
}

// Event listeners
document.getElementById('resetBtn').addEventListener('click', resetSession);
document.getElementById('signInBtn').addEventListener('click', signInWithGoogle);
document.getElementById('signOutBtn').addEventListener('click', signOutGoogle);

document.getElementById('syncBtn').addEventListener('click', async () => {
  const syncBtn = document.getElementById('syncBtn');

  if (!currentUser?.userId) {
    syncBtn.textContent = 'Sign in first';
    setTimeout(() => {
      syncBtn.textContent = 'Sync to Firebase';
    }, 1200);
    return;
  }

  if (!currentMetrics) {
    syncBtn.textContent = 'No Data';
    setTimeout(() => {
      syncBtn.textContent = 'Sync to Firebase';
    }, 1200);
    return;
  }

  const originalText = syncBtn.textContent;
  syncBtn.disabled = true;
  syncBtn.textContent = 'Syncing...';

  try {
    await syncSessionToFirebase(currentMetrics);
    syncBtn.textContent = 'Synced!';
    setTimeout(() => {
      syncBtn.textContent = 'Sync to Firebase';
      syncBtn.disabled = false;
    }, 1800);
  } catch (error) {
    console.error('Firebase sync failed:', error);
    syncBtn.textContent = 'Sync Failed';
    setTimeout(() => {
      syncBtn.textContent = originalText;
      syncBtn.disabled = false;
    }, 1800);
  }
});

// Listen for background messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SESSION_UPDATE') {
    updateUI(request.data);
    currentMetrics = request.data;
  }
});

// Initial load
initializeAuthState().then(fetchSessionData);

// Refresh data every 5 seconds
setInterval(fetchSessionData, 5000);
