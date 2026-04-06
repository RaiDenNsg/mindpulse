# Firebase Integration Guide

This document outlines how to add Firebase synchronization to the MindPulse Tracker extension.

## Current State

The extension currently:
- ✅ Tracks typing metrics locally
- ✅ Stores data in Chrome's local storage
- ✅ Shows real-time metrics in popup
- ⏳ **Firebase sync disabled** (placeholder button exists)

## Firebase Setup Steps

### 1. Install Firebase SDK

In your main MindPulse project (not the extension), ensure Firebase is already set up in `src/firebase/config.js`.

### 2. Create Extension Firebase Module

Create a new file: `extension/firebase-config.js`

```javascript
// Initialize Firebase for use in extension
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

### 3. Update Service Worker

Modify `background.js` to handle Firebase operations:

```javascript
// Add to background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SYNC_TO_FIREBASE') {
    syncSessionToFirebase(request.data)
      .then(() => sendResponse({ status: 'synced' }))
      .catch(err => sendResponse({ status: 'error', msg: err.message }));
    return true; // Keep channel open for async response
  }
});

async function syncSessionToFirebase(sessionData) {
  // Get current user from Chrome storage
  chrome.storage.sync.get('userId', async (result) => {
    if (!result.userId) {
      throw new Error('User not authenticated');
    }

    const userId = result.userId;
    const date = new Date().toISOString().split('T')[0];
    const docId = `${userId}_${date}`;

    // Format for Firestore
    const firestoreData = {
      userId,
      date,
      platform: sessionData.platform,
      keystrokeCount: sessionData.keystrokeCount,
      backspaceCount: sessionData.backspaceCount,
      typingSpeed: sessionData.typingSpeed,
      focusScore: sessionData.focusScore,
      cognitiveLoad: sessionData.cognitiveLoad,
      sessionDuration: sessionData.elapsedSeconds,
      timestamp: new Date(),
      source: 'chrome-extension'
    };

    // Save to Firestore
    const docRef = doc(db, 'sessions', docId);
    await setDoc(docRef, firestoreData, { merge: true });
    
    return firestoreData;
  });
}
```

### 4. Update Popup to Include Firebase Sync

Modify `popup.js` sync button:

```javascript
document.getElementById('syncBtn').addEventListener('click', async () => {
  if (currentMetrics) {
    const tab = await getCurrentTab();
    
    chrome.runtime.sendMessage(
      { type: 'SYNC_TO_FIREBASE', data: currentMetrics },
      (response) => {
        if (response.status === 'synced') {
          alert('✅ Session synced to Firebase!');
          // Update UI to show sync status
          document.getElementById('syncBtn').textContent = '✓ Synced';
          document.getElementById('syncBtn').disabled = true;
        } else {
          alert('❌ Sync failed. Please authenticate first.');
        }
      }
    );
  }
});
```

### 5. Authentication Flow

Users need to authenticate. Two approaches:

**Option A: Use Main Site Auth**
- User logs in on main MindPulse website
- Auth token stored in Chrome sync storage
- Extension reads and uses token for Firebase

**Option B: Extension Auth UI**
- Add auth popup within extension
- User logs in directly in extension
- Store credentials in Chrome storage

### 6. Update Manifest for Firebase

Modify `manifest.json` to allow Firebase:

```json
{
  "permissions": [
    "activeTab",
    "storage",
    "identity",
    "scripting"
  ],
  "host_permissions": [
    "https://leetcode.com/*",
    "https://www.leetcode.com/*",
    "https://hackerrank.com/*",
    "https://www.hackerrank.com/*",
    "https://programiz.com/*",
    "https://www.programiz.com/*",
    "https://*.firebase.com/*",
    "https://*.firebaseio.com/*"
  ]
}
```

### 7. Firestore Rules

Update your Firestore security rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sessions/{document=**} {
      allow read, write: if request.auth != null;
      allow create: if request.auth.uid == resource.data.userId 
        || request.auth.uid == request.resource.data.userId;
    }
    
    // Allow extension to write with auth header
    match /extensionSessions/{userId}/{document=**} {
      allow write: if request.auth.uid == userId;
      allow read: if request.auth.uid == userId;
    }
  }
}
```

## Implementation Steps

1. ✅ Extension tracking works locally
2. ⏳ **Next: Add Firebase config**
3. ⏳ **Then: Implement auth flow**
4. ⏳ **Then: Add sync function**
5. ⏳ **Then: Update Firestore rules**
6. ⏳ **Finally: Test end-to-end**

## Data Schema

Extension will send to Firestore:

```typescript
{
  userId: string,           // From authenticated user
  date: string,            // YYYY-MM-DD
  platform: string,        // LeetCode, HackerRank, Programiz
  keystrokeCount: number,
  backspaceCount: number,
  typingSpeed: number,     // WPM
  focusScore: number,      // 0-100
  cognitiveLoad: number,   // 0-100
  sessionDuration: number, // seconds
  timestamp: Date,
  source: 'chrome-extension'
}
```

## Testing Firebase Sync

1. Create test user in Firebase Auth
2. Load extension in Chrome
3. Start coding on a platform
4. Click "Sync to Firebase"
5. Check Firestore console to verify data appears

## Debugging

Check Chrome Extension Service Worker console:
1. Go to `chrome://extensions/`
2. Find MindPulse Tracker
3. Click "Service Worker" link
4. Check logs and errors

## Common Issues

**Firebase module not found**
- Use web-compatible Firebase import paths
- May need webpack bundling for Firebase

**CORS errors**
- Add Firebase domain to manifest host_permissions
- Check firebaseio.com domain is allowed

**Auth errors**
- Verify user is authenticated
- Check Chrome storage has userId/token

## Next Phase

Once Firebase sync is working:
- [ ] Batch sync multiple sessions
- [ ] Offline queue for when offline
- [ ] Sync frequency optimization
- [ ] Cloud functions for analytics preprocessing
- [ ] Real-time sync vs periodic sync option
