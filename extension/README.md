# MindPulse Tracker Chrome Extension

A Chrome extension that tracks typing behavior and cognitive load on popular coding platforms.

## Features

- 📊 Real-time typing metrics tracking
  - Keystrokes count
  - Typing speed (WPM)
  - Focus score
  - Cognitive load calculation
  - Backspace tracking
  - Session time

- 🎯 Works on:
  - LeetCode
  - HackerRank
  - Programiz

- 💾 Local storage of session data
- 🔄 Session reset capability
- 🎨 Dark themed UI matching MindPulse

## Installation & Setup

### Load as Chrome Developer Extension

1. **Navigate to Chrome Extensions**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

2. **Load Unpacked Extension**
   - Click "Load unpacked"
   - Navigate to the `extension` folder and select it
   - The extension will appear in your extensions list

3. **Start Using**
   - Go to any supported coding platform (LeetCode, HackerRank, Programiz)
   - Click the MindPulse Tracker icon in your Chrome toolbar
   - Start coding to see metrics update in real-time

## Files Structure

```
extension/
├── manifest.json      # Extension configuration (Manifest V3)
├── content.js         # Page content tracking script
├── popup.html         # Popup UI
├── popup.js           # Popup logic & UI updates
├── popup.css          # Popup styling
└── background.js      # Background service worker
```

## How It Works

### Content Script (content.js)
- Runs on supported coding platforms
- Tracks `keydown` events on input fields, textareas, and code editors
- Separates regular keystrokes from backspaces
- Calculates metrics every 30 seconds:
  - **Typing Speed**: Words per minute (keystrokes ÷ 5) / elapsed time
  - **Focus Score**: Quality of typing (100 - (backspaces / keystrokes) × 50)
  - **Cognitive Load**: Effort indicator based on backspaces and typing pattern
  - **Session Time**: Total elapsed time

### Popup UI (popup.html/js/css)
- Shows real-time metrics from current session
- Displays platform name
- Shows connection status
- Allows session reset
- Updates every 5 seconds via polling
- Color-coded metrics (green/amber/red based on values)

### Background Worker (background.js)
- Manages message routing between content and popup
- Stores session data in Chrome storage
- Handles tab lifecycle events

## Metrics Explained

- **Keystrokes**: Total characters typed (excluding modifiers)
- **Typing Speed**: Words per minute (based on 5 chars = 1 word)
- **Focus Score**: Quality indicator
  - 🟢 80%+: Excellent focus
  - 🟡 60-80%: Good focus
  - 🔴 <60%: Struggling with focus
- **Cognitive Load**: Mental effort
  - 🟢 ≤40%: Low effort
  - 🟡 40-70%: Moderate effort
  - 🔴 >70%: High effort
- **Backspaces**: Number of times user used backspace/delete

## Future Enhancements

- [ ] Firebase synchronization to store sessions permanently
- [ ] Historical session tracking and analytics
- [ ] Per-session analysis and recommendations
- [ ] Integration with main MindPulse web app
- [ ] Custom metrics for different languages
- [ ] Animated graph visualization

## Development Notes

- Uses Manifest V3 (Chrome's latest extension format)
- No external dependencies - pure vanilla JS
- Works with modern code editors (CodeMirror, Monaco, Ace)
- LocalStorage data persists within session
- Messages use Chrome extension message passing API

## Troubleshooting

**Metrics not showing?**
- Make sure you're on a supported platform
- Check console for errors (F12 → Console)
- Reload the extension from `chrome://extensions/`

**Not tracking keystrokes?**
- The extension only tracks in code editors and input fields
- Some platforms may use special editors - report issues

**Reset button not working?**
- Refresh the page and try again
- Check that you're on a supported platform

## License

Part of the MindPulse project - tracking cognitive load for better coding performance.
