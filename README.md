# MindPulse

MindPulse is a cognitive load tracker for coders. It combines a Firebase-backed web app with a Chrome extension so you can monitor focus, typing behavior, and distraction patterns while solving problems in the browser or in the editor.

## What It Does

- Tracks keystrokes, typing speed, focus score, and cognitive load in real time
- Shows distraction alerts and stuck-state overlays in the browser
- Syncs sessions through Firebase authentication and Firestore
- Provides a web dashboard for session history and reporting
- Works as a Chrome extension on supported coding platforms

## Quick Start

### Web App

1. Open the deployed app: https://mindpulse-amber.vercel.app
2. Sign in with Google
3. Start a coding session and review your tracked metrics in the app

### Chrome Extension

1. Download the latest release from https://github.com/RaiDenNsg/mindpulse/releases/latest
2. Unzip the archive
3. Open `chrome://extensions`
4. Enable Developer mode
5. Click Load unpacked and select the `extension` folder
6. Pin the MindPulse icon in your toolbar
7. Use it on supported coding sites such as LeetCode, HackerRank, Programiz, Replit, CodeSandbox, CodePen, W3Schools, Khan Academy, and YouTube

> Developer mode is required because the extension is not published in the Chrome Web Store yet.

## Local Development

```bash
bun install
bun run dev
```

Available scripts:

- `bun run dev` - start the Vite development server
- `bun run build` - build the production app
- `bun run build:dev` - build using the development mode
- `bun run preview` - preview the production build locally
- `bun run lint` - run ESLint across the repo

## Project Structure

- `src/` - React app, routes, components, hooks, and styling
- `firebase/` - authentication and Firestore integration
- `extension/` - Chrome extension service worker, content script, overlay, and popup UI
- `public/` - static assets

## Tech Stack

- React 19
- Vite
- TanStack Router
- Firebase and Firestore
- Chrome Extensions API
- Tailwind CSS v4

## Notes

- The extension is designed for local unpacked installation during development.
- Supported site matching is defined in `extension/manifest.json`.
- If you are changing extension behavior, the extension README in `extension/README.md` has deeper implementation notes.