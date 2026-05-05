const OVERLAY_ID = 'mindpulse-distraction-overlay';
const BACKDROP_ID = 'mindpulse-distraction-backdrop';
const STYLE_ID = 'mindpulse-distraction-overlay-style';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${BACKDROP_ID} {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.75);
      opacity: 0;
      z-index: 999998;
      transition: opacity 220ms ease;
    }

    #${BACKDROP_ID}.mindpulse-visible {
      opacity: 1;
    }

    #${OVERLAY_ID} {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, calc(-50% + 16px));
      opacity: 0;
      z-index: 999999;
      width: min(480px, calc(100vw - 32px));
      background: #111111;
      border: 1px solid #2a2a2a;
      border-left: 2px solid #d9d9d9;
      border-radius: 12px;
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
      padding: 32px;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transition: transform 240ms ease, opacity 240ms ease;
    }

    #${OVERLAY_ID}.mindpulse-visible {
      transform: translate(-50%, -50%);
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

    #${OVERLAY_ID} button[data-action='back'],
    #${OVERLAY_ID} button[data-action='find-help'] {
      background: #ffffff;
      color: #000000;
      border-color: #ffffff;
      font-weight: 700;
    }

    #${OVERLAY_ID} button[data-action='back']:hover,
    #${OVERLAY_ID} button[data-action='find-help']:hover {
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
  const existingCard = document.getElementById(OVERLAY_ID);
  const existingBackdrop = document.getElementById(BACKDROP_ID);
  if (!existingCard && !existingBackdrop) {
    return;
  }

  if (existingCard) {
    existingCard.classList.remove('mindpulse-visible');
  }

  if (existingBackdrop) {
    existingBackdrop.classList.remove('mindpulse-visible');
  }

  setTimeout(() => {
    if (existingCard?.parentElement) {
      existingCard.parentElement.removeChild(existingCard);
    }

    if (existingBackdrop?.parentElement) {
      existingBackdrop.parentElement.removeChild(existingBackdrop);
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

function storageGetLocal(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function storageRemoveLocal(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, resolve);
  });
}

function buildSmartSearchUrl(lastTypedText) {
  const cleaned = String(lastTypedText || '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);

  const query = `${cleaned || 'programming issue'} programming help`;
  return 'https://www.google.com/search?q=' + encodeURIComponent(query);
}

function showOverlay(options = {}) {
  ensureStyles();

  if (!document.body) {
    return;
  }

  const {
    mode = 'distraction',
    message = 'You left your session',
    submessage = 'Your session is still running.',
    showFindHelp = false,
    searchText = '',
  } = options;

  const existingCard = document.getElementById(OVERLAY_ID);
  const existingBackdrop = document.getElementById(BACKDROP_ID);
  if (existingCard && existingBackdrop) {
    existingBackdrop.classList.add('mindpulse-visible');
    existingCard.classList.add('mindpulse-visible');
    return;
  }

  const backdrop = document.createElement('div');
  backdrop.id = BACKDROP_ID;

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.dataset.mode = mode;

  // Build overlay content using DOM creation instead of innerHTML
  const inner = document.createElement('div');
  inner.className = 'mindpulse-inner';

  const brand = document.createElement('div');
  brand.className = 'mindpulse-brand';

  const logo = document.createElement('div');
  logo.className = 'mindpulse-logo';
  logo.textContent = 'MP';

  const brandText = document.createElement('div');
  brandText.className = 'mindpulse-brand-text';

  const titleEl = document.createElement('div');
  titleEl.className = 'mindpulse-title';
  titleEl.textContent = 'MindPulse';

  const messageEl = document.createElement('div');
  messageEl.className = 'mindpulse-message';
  messageEl.textContent = message;

  brandText.appendChild(titleEl);
  brandText.appendChild(messageEl);

  if (submessage) {
    const submessageEl = document.createElement('div');
    submessageEl.className = 'mindpulse-submessage';
    submessageEl.textContent = submessage;
    brandText.appendChild(submessageEl);
  }

  brand.appendChild(logo);
  brand.appendChild(brandText);

  const actions = document.createElement('div');
  actions.className = 'mindpulse-actions';

  if (showFindHelp) {
    const findHelpBtn = document.createElement('button');
    findHelpBtn.type = 'button';
    findHelpBtn.setAttribute('data-action', 'find-help');
    findHelpBtn.textContent = 'Find help';

    const takeBreakBtn = document.createElement('button');
    takeBreakBtn.type = 'button';
    takeBreakBtn.setAttribute('data-action', 'take-break');
    takeBreakBtn.textContent = 'Take a break';

    actions.appendChild(findHelpBtn);
    actions.appendChild(takeBreakBtn);
  } else {
    const breakBtn = document.createElement('button');
    breakBtn.type = 'button';
    breakBtn.setAttribute('data-action', 'break');
    breakBtn.textContent = 'Taking a break';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.setAttribute('data-action', 'back');
    backBtn.textContent = 'Back to work';

    actions.appendChild(breakBtn);
    actions.appendChild(backBtn);
  }

  inner.appendChild(brand);
  inner.appendChild(actions);
  overlay.appendChild(inner);

  overlay.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }

    const action = button.getAttribute('data-action');

    if (action === 'find-help') {
      const url = buildSmartSearchUrl(searchText || 'programming issue');
      window.open(url, '_blank', 'noopener');
      await storageRemoveLocal('lastTypedText');
    } else if (action === 'take-break') {
      await storageRemoveLocal('lastTypedText');
    } else if (action === 'back') {
      sendBackgroundMessage('BACK_TO_WORK');
    } else {
      sendBackgroundMessage('TAKING_BREAK');
    }

    removeOverlay();
  });

  document.body.appendChild(backdrop);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    backdrop.classList.add('mindpulse-visible');
    overlay.classList.add('mindpulse-visible');
  });
}

async function showStuckOverlay() {
  const state = await storageGetLocal(['lastTypedText']);
  const rawText = String(state.lastTypedText || '').trim();
  const preview = rawText ? rawText.slice(0, 30) : '';
  const stuckSubtext = preview ? `Stuck on: ${preview}...` : '';

  showOverlay({
    mode: 'stuck',
    message: 'Looks like you\'re stuck',
    submessage: stuckSubtext,
    showFindHelp: true,
    searchText: rawText || 'programming issue',
  });

  await storageRemoveLocal('lastTypedText');
}

chrome.runtime.onMessage.addListener((request) => {
  if (request?.type === 'SHOW_DISTRACTION_OVERLAY') {
    showOverlay({
      mode: 'distraction',
      message: 'You left your session',
      submessage: 'Your session is still running.',
      showFindHelp: false,
    });
  }

  if (request?.type === 'SHOW_STUCK_OVERLAY') {
    void showStuckOverlay();
  }
});
