// MindPulse Tracker - Background Service Worker

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SESSION_UPDATE') {
    // Store session data
    chrome.storage.local.set({ 
      currentSessionData: request.data,
      lastUpdate: Date.now()
    });

    // Broadcast to all popup instances
    chrome.runtime.sendMessage({
      type: 'SESSION_UPDATE',
      data: request.data
    }).catch(() => {
      // Popup might not be open, ignore error
    });
  }
});

// Listen for tab changes
chrome.tabs.onActivated.addListener((activeInfo) => {
  // Could use this to reset or manage sessions per tab
  console.log('Tab activated:', activeInfo.tabId);
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  console.log('Tab closed:', tabId);
});
