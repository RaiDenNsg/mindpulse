// MindPulse Tracker - Popup Script

let currentMetrics = null;
let currentUser = null;

const AUTH_STORAGE_KEY = 'mindpulseAuthUser';
const FOCUS_MODE_STORAGE_KEY = 'focusMode';
const DEFAULT_FOCUS_MODE = 2;

const FIREBASE_API_KEY = 'AIzaSyBeXhjubogCTS4cmEu66F6cmLh9Fn9e9xs';
const FIREBASE_PROJECT_ID = 'mindpulse-a017a';
const FIREBASE_SIGN_IN_WITH_IDP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`;
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

let currentFocusMode = DEFAULT_FOCUS_MODE;

function normalizeFocusMode(value) {
  const mode = Number(value);
  return mode === 1 || mode === 2 || mode === 3 ? mode : DEFAULT_FOCUS_MODE;
}

function updateFocusModeButtons(mode) {
  currentFocusMode = normalizeFocusMode(mode);

  document.querySelectorAll('[data-focus-mode]').forEach((button) => {
    const buttonMode = normalizeFocusMode(button.dataset.focusMode);
    const isActive = buttonMode === currentFocusMode;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

async function initializeFocusMode() {
  const stored = await storageGet([FOCUS_MODE_STORAGE_KEY]);
  const storedMode = stored[FOCUS_MODE_STORAGE_KEY];
  const nextMode = normalizeFocusMode(storedMode);

  if (storedMode == null) {
    await storageSet({ [FOCUS_MODE_STORAGE_KEY]: DEFAULT_FOCUS_MODE });
  }

  updateFocusModeButtons(nextMode);
}

async function setFocusMode(mode) {
  const nextMode = normalizeFocusMode(mode);
  updateFocusModeButtons(nextMode);
  await storageSet({ [FOCUS_MODE_STORAGE_KEY]: nextMode });
}

function createEmptyMetrics() {
  return {
    keystrokeCount: 0,
    backspaceCount: 0,
    typingSpeed: 0,
    focusScore: 0,
    cognitiveLoad: 0,
    elapsedSeconds: 0,
    istyping: false,
    timestamp: Date.now(),
    platform: 'Unknown',
    sessionStartTime: Date.now(),
  };
}

function normalizeStoredMetrics(sessionData) {
  if (!sessionData) {
    return createEmptyMetrics();
  }

  return {
    keystrokeCount: Number(sessionData.keystrokes ?? 0),
    backspaceCount: Number(sessionData.backspaces ?? 0),
    typingSpeed: Number(sessionData.typingSpeed ?? 0),
    focusScore: Number(sessionData.focusScore ?? 0),
    cognitiveLoad: Number(sessionData.cognitiveLoad ?? 0),
    elapsedSeconds: Number(sessionData.sessionDuration ?? 0),
    istyping: false,
    timestamp: Number(sessionData.timestamp ?? Date.now()),
    platform: sessionData.platform || 'Unknown',
    sessionStartTime: Date.now(),
  };
}

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
  const headerUserMeta = document.getElementById('headerUserMeta');
  const headerUserName = document.getElementById('headerUserName');
  const syncBtn = document.getElementById('syncBtn');

  if (user && user.userId) {
    if (signInBtn) {
      signInBtn.classList.add('hidden');
    }

    if (userInfo) {
      userInfo.classList.remove('hidden');
    }

    const hasName = Boolean(user.name && user.name.trim());
    const normalizedName = hasName ? user.name.trim() : '';

    if (userName) {
      userName.textContent = normalizedName;
    }

    if (userEmail) {
      userEmail.textContent = user.email || 'Signed in';
    }

    if (headerUserMeta && headerUserName) {
      headerUserName.textContent = normalizedName;
      headerUserMeta.classList.toggle('hidden', !hasName);
    }

    if (syncBtn) {
      syncBtn.disabled = currentMetrics ? false : true;
    }
  } else {
    if (signInBtn) {
      signInBtn.classList.remove('hidden');
    }

    if (userInfo) {
      userInfo.classList.add('hidden');
    }

    if (headerUserMeta && headerUserName) {
      headerUserName.textContent = '';
      headerUserMeta.classList.add('hidden');
    }

    if (syncBtn) {
      syncBtn.disabled = true;
    }
  }
}

async function signInFirebaseWithGoogleToken(token) {
  // chrome.identity.getAuthToken returns a Google access token.
  // Equivalent to signInWithCredential(GoogleAuthProvider.credential(null, token)).
  const postBody = `access_token=${encodeURIComponent(token)}&providerId=google.com`;

  const response = await fetch(FIREBASE_SIGN_IN_WITH_IDP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      postBody,
      requestUri: `https://${chrome.runtime.id}.chromiumapp.org/`,
      returnSecureToken: true,
      returnIdpCredential: true,
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Failed to sign in with Firebase Auth');
  }

  return data;
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

async function signInWithGoogle(interactive = true) {
  const signInBtn = document.getElementById('signInBtn');
  const originalText = signInBtn?.textContent || 'Sign in with Google';

  try {
    if (interactive) {
      if (signInBtn) {
        signInBtn.disabled = true;
        signInBtn.textContent = 'Signing in...';
      }
    }

    const token = await getAuthToken(interactive);
    const [firebaseAuthResult, profile] = await Promise.all([
      signInFirebaseWithGoogleToken(token),
      fetchGoogleProfile(token).catch(() => null),
    ]);

    // Firebase UID (localId) matches the web app's auth.uid.
    const firebaseUid = firebaseAuthResult.localId;
    if (!firebaseUid) {
      throw new Error('Firebase auth uid was not returned');
    }

    const authUser = {
      userId: firebaseUid,
      email: profile?.email || firebaseAuthResult.email || '',
      name: profile?.name || firebaseAuthResult.displayName || ''
    };

    console.log('[MindPulse Auth] Successfully signed in');

    await storageSet({ [AUTH_STORAGE_KEY]: authUser });
    currentUser = authUser;
    setAuthUI(currentUser);
  } catch (error) {
    if (interactive) {
      console.error('Google sign-in failed:', error);
      if (signInBtn) {
        signInBtn.textContent = 'Sign-in Failed';
      }
      setTimeout(() => {
        if (signInBtn) {
          signInBtn.textContent = originalText;
        }
      }, 1500);
    } else {
      console.log('[MindPulse Auth] Silent sign-in unavailable:', error?.message || error);
    }
  } finally {
    if (interactive) {
      if (signInBtn) {
        signInBtn.disabled = false;
      }

      if (!currentUser && signInBtn) {
        signInBtn.textContent = originalText;
      }
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

  // Auto sign-in on popup open using cached token when available.
  if (!currentUser?.userId) {
    await signInWithGoogle(false);
  }
}

// Read session data directly from storage
async function fetchSessionData() {
  try {
    const result = await storageGet(['sessionData', 'lastUpdate']);
    const metrics = normalizeStoredMetrics(result.sessionData);
    updateUI(metrics);
    currentMetrics = metrics;
  } catch (error) {
    console.error('Error fetching session data:', error);
    const fallbackMetrics = createEmptyMetrics();
    updateUI(fallbackMetrics);
    currentMetrics = fallbackMetrics;
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

function getTrackingLabel(platform) {
  const normalized = String(platform || '').trim().toLowerCase();

  if (normalized === 'leetcode') {
    return 'LeetCode';
  }

  if (normalized === 'hackerrank') {
    return 'HackerRank';
  }

  if (normalized === 'programiz') {
    return 'Programiz';
  }

  return null;
}

// Update UI with metrics
function updateUI(metrics) {
  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = String(value);
    }
  };

  setText('keystrokeCount', metrics.keystrokeCount);
  setText('typingSpeed', metrics.typingSpeed);
  setText('focusScore', metrics.focusScore);
  setText('cognitiveLoad', metrics.cognitiveLoad);
  setText('backspaceCount', metrics.backspaceCount);
  setText('sessionTime', formatTime(metrics.elapsedSeconds));
  const trackingPlatform = getTrackingLabel(metrics.platform);
  setText(
    'timestamp',
    trackingPlatform ? `Tracking: ${trackingPlatform}` : 'Not tracking'
  );

  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn) {
    syncBtn.disabled = !currentUser;
  }

  // Color code focus score
  const focusEl = document.getElementById('focusScore');
  if (focusEl) {
    focusEl.style.color = '#ffffff';
  }

  // Color code cognitive load
  const loadEl = document.getElementById('cognitiveLoad');
  if (loadEl) {
    loadEl.style.color = '#ffffff';
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

  return { nestedResult };
}

// Reset session
async function resetSession() {
  try {
    const resetMetrics = createEmptyMetrics();
    await storageSet({
      sessionData: {
        keystrokes: 0,
        typingSpeed: 0,
        focusScore: 0,
        cognitiveLoad: 0,
        sessionDuration: 0,
        backspaces: 0,
        platform: 'Unknown',
        timestamp: Date.now(),
      },
      currentSessionData: resetMetrics,
      lastTypedText: '',
      lastKeystrokeTime: Date.now(),
      lastUpdate: Date.now(),
    });

    updateUI(resetMetrics);
    currentMetrics = resetMetrics;

    console.log('Session reset');
  } catch (error) {
    console.error('Error resetting session:', error);
  }
}

// Event listeners
document.getElementById('resetBtn').addEventListener('click', resetSession);
const signInBtn = document.getElementById('signInBtn');
if (signInBtn) {
  signInBtn.addEventListener('click', () => {
    void signInWithGoogle(true);
  });
}

const headerSignOut = document.getElementById('headerSignOut');
if (headerSignOut) {
  headerSignOut.addEventListener('click', signOutGoogle);
}

document.querySelectorAll('[data-focus-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    void setFocusMode(button.dataset.focusMode);
  });
});

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
initializeFocusMode().catch((error) => {
  console.error('Failed to initialize focus mode:', error);
});
initializeAuthState().then(fetchSessionData);

// Refresh data every 5 seconds
setInterval(fetchSessionData, 5000);
