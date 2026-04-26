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
      top: 16px;
      left: 50%;
      transform: translate(-50%, -18px);
      opacity: 0;
      z-index: 999999;
      width: min(680px, calc(100vw - 24px));
      background: #111111;
      border: 1px solid #2a2a2a;
      border-radius: 12px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transition: transform 220ms ease, opacity 220ms ease;
    }

    #${OVERLAY_ID}.mindpulse-visible {
      transform: translate(-50%, 0);
      opacity: 1;
    }

    #${OVERLAY_ID} .mindpulse-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 14px;
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
      gap: 2px;
      min-width: 0;
    }

    #${OVERLAY_ID} .mindpulse-title {
      color: #dcdcdc;
      font-size: 12px;
      line-height: 1.2;
      letter-spacing: 0.01em;
    }

    #${OVERLAY_ID} .mindpulse-message {
      color: #ffffff;
      font-size: 14px;
      line-height: 1.35;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #${OVERLAY_ID} .mindpulse-actions {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    #${OVERLAY_ID} button {
      appearance: none;
      border: 1px solid #303030;
      background: #171717;
      color: #f2f2f2;
      border-radius: 8px;
      font-size: 12px;
      line-height: 1;
      padding: 8px 11px;
      cursor: pointer;
      transition: background-color 160ms ease, border-color 160ms ease;
    }

    #${OVERLAY_ID} button:hover {
      background: #202020;
      border-color: #3a3a3a;
    }

    #${OVERLAY_ID} button[data-action='back'] {
      background: #efefef;
      color: #121212;
      border-color: #efefef;
      font-weight: 500;
    }

    #${OVERLAY_ID} button[data-action='back']:hover {
      background: #ffffff;
      border-color: #ffffff;
    }

    @media (max-width: 640px) {
      #${OVERLAY_ID} .mindpulse-inner {
        flex-direction: column;
        align-items: stretch;
      }

      #${OVERLAY_ID} .mindpulse-message {
        white-space: normal;
      }

      #${OVERLAY_ID} .mindpulse-actions {
        justify-content: flex-end;
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
    <div class="mindpulse-inner">
      <div class="mindpulse-brand">
        <div class="mindpulse-logo">MP</div>
        <div class="mindpulse-brand-text">
          <div class="mindpulse-title">MindPulse</div>
          <div class="mindpulse-message">You left your session</div>
        </div>
      </div>
      <div class="mindpulse-actions">
        <button type="button" data-action="break">Taking a break</button>
        <button type="button" data-action="back">Back to work</button>
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
