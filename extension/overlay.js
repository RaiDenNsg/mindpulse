const OVERLAY_ID = 'mindpulse-distraction-overlay';
const STYLE_ID = 'mindpulse-distraction-overlay-style';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${OVERLAY_ID} {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.6);
      opacity: 0;
      z-index: 999998;
      transition: opacity 220ms ease;
    }

    #${OVERLAY_ID} .mindpulse-card {
      width: min(480px, calc(100vw - 32px));
      background: #111111;
      border: 1px solid #2a2a2a;
      border-left: 2px solid #d9d9d9;
      border-radius: 12px;
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
      padding: 32px;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transform: translateY(16px);
      opacity: 0;
      z-index: 999999;
      transition: transform 240ms ease, opacity 240ms ease;
    }

    #${OVERLAY_ID}.mindpulse-visible {
      opacity: 1;
    }

    #${OVERLAY_ID}.mindpulse-visible .mindpulse-card {
      transform: translateY(0);
      opacity: 1;
    }

    #${OVERLAY_ID} .mindpulse-inner {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
    }

    #${OVERLAY_ID} .mindpulse-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    #${OVERLAY_ID} .mindpulse-logo {
      width: 24px;
      height: 24px;
      border-radius: 7px;
      border: 1px solid #2f2f2f;
      background: #1a1a1a;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #d0d0d0;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
      flex-shrink: 0;
    }

    #${OVERLAY_ID} .mindpulse-brand-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    #${OVERLAY_ID} .mindpulse-title {
      color: #dcdcdc;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.2;
      letter-spacing: 0.01em;
    }

    #${OVERLAY_ID} .mindpulse-message {
      color: #ffffff;
      font-size: 14px;
      line-height: 1.35;
      white-space: normal;
    }

    #${OVERLAY_ID} .mindpulse-submessage {
      color: #666666;
      font-size: 12px;
      line-height: 1.35;
      white-space: normal;
    }

    #${OVERLAY_ID} .mindpulse-actions {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      margin-left: auto;
    }

    #${OVERLAY_ID} button {
      appearance: none;
      border: 1px solid #303030;
      background: #171717;
      color: #f2f2f2;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1;
      padding: 10px 14px;
      cursor: pointer;
      transition: background-color 160ms ease, border-color 160ms ease;
    }

    #${OVERLAY_ID} button:hover {
      background: #202020;
      border-color: #3a3a3a;
    }

    #${OVERLAY_ID} button[data-action='back'] {
      background: #ffffff;
      color: #000000;
      border-color: #ffffff;
      font-weight: 700;
    }

    #${OVERLAY_ID} button[data-action='back']:hover {
      background: #f2f2f2;
      border-color: #f2f2f2;
    }

    @media (max-width: 640px) {
      #${OVERLAY_ID} .mindpulse-actions {
        justify-content: flex-end;
        width: 100%;
      }
    }
  `;

  document.documentElement.appendChild(style);
}

function removeOverlay() {
  const existing = document.getElementById(OVERLAY_ID);
  if (!existing) {
    return;
  }

  existing.classList.remove('mindpulse-visible');
  setTimeout(() => {
    if (existing.parentElement) {
      existing.parentElement.removeChild(existing);
    }
  }, 220);
}

function sendBackgroundMessage(type) {
  try {
    chrome.runtime.sendMessage({ type }, () => {
      void chrome.runtime.lastError;
    });
  } catch {
    // no-op
  }
}

function showOverlay() {
  ensureStyles();

  const existing = document.getElementById(OVERLAY_ID);
  if (existing) {
    existing.classList.add('mindpulse-visible');
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;

  overlay.innerHTML = `
    <div class="mindpulse-card">
      <div class="mindpulse-inner">
        <div class="mindpulse-brand">
          <div class="mindpulse-logo">MP</div>
          <div class="mindpulse-brand-text">
            <div class="mindpulse-title">MindPulse</div>
            <div class="mindpulse-message">You left your session</div>
            <div class="mindpulse-submessage">Your session is still running.</div>
          </div>
        </div>
        <div class="mindpulse-actions">
          <button type="button" data-action="break">Taking a break</button>
          <button type="button" data-action="back">Back to work</button>
        </div>
      </div>
    </div>
  `;

  overlay.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }

    const action = button.getAttribute('data-action');
    if (action === 'back') {
      sendBackgroundMessage('BACK_TO_WORK');
    } else {
      sendBackgroundMessage('TAKING_BREAK');
    }

    removeOverlay();
  });

  document.documentElement.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.classList.add('mindpulse-visible');
  });
}

chrome.runtime.onMessage.addListener((request) => {
  if (request?.type === 'SHOW_DISTRACTION_OVERLAY') {
    showOverlay();
  }
});
