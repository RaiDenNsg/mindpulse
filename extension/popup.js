// MindPulse Tracker - Popup Script

let currentMetrics = null;

const FIREBASE_API_KEY = 'AIzaSyBeXhjubogCTS4cmEu66F6cmLh9Fn9e9xs';
const FIREBASE_PROJECT_ID = 'mindpulse-a017a';
const FIRESTORE_SESSIONS_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/sessions?key=${FIREBASE_API_KEY}`;

// Get the current active tab
async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
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
  document.getElementById('syncBtn').disabled = false;

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
  const firestorePayload = toFirestoreDocument(metrics);

  const response = await fetch(FIRESTORE_SESSIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(firestorePayload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to save session to Firestore');
  }

  return response.json();
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

document.getElementById('syncBtn').addEventListener('click', async () => {
  const syncBtn = document.getElementById('syncBtn');

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
fetchSessionData();

// Refresh data every 5 seconds
setInterval(fetchSessionData, 5000);
