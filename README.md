# MindPulse

MindPulse is a cognitive load tracker for coders. It helps developers understand focus, typing behavior, and mental workload while solving problems in the browser and coding in the app.

## Features

- Real-time tracking of keystrokes, WPM, focus score, and cognitive load
- Chrome extension support for LeetCode and Programiz
- Distraction detection with alerts
- Firebase sync with user accounts
- History page with session timeline

## How to Use

### Web App
Visit: https://mindpulse-amber.vercel.app  
Sign in with Google and start coding in the editor.

### Chrome Extension
1. Go to the releases page and download `mindpulse-extension.zip`  
   Link: https://github.com/RaiDenNsg/mindpulse/releases/latest
2. Unzip the downloaded file
3. Open Chrome and go to: `chrome://extensions`
4. Toggle on "Developer Mode" (top right corner)
5. Click "Load unpacked" and select the unzipped folder
6. The MindPulse icon will appear in your Chrome toolbar
7. Pin it and start coding on LeetCode or Programiz

> **Note:** Developer mode is required because the extension is not yet on the Chrome Web Store. It is safe to use.

## Tech Stack

- React
- Firebase
- Firestore
- Chrome Extensions API
- Vite
- Vercel