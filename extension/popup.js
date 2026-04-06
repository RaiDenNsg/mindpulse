// MindPulse Tracker - Popup Script

let currentMetrics = null;

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

document.getElementById('syncBtn').addEventListener('click', () => {
  if (currentMetrics) {
    console.log('Sync data to Firebase:', currentMetrics);
    alert('Firebase sync coming soon!');
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
