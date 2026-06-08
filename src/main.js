import './styles.css';

// Build marker — bumped manually so we can confirm a fresh deploy reached the
// phone after a push. (The dev loop is: push -> Vercel deploys -> reload phone.)
const BUILD = 'M-1 · hello-PWA · 2026-06-07';

// --- Service worker -------------------------------------------------------
// Registered from the site root so its scope covers the whole app. The M-1
// worker is network-first (always fresh online during active development);
// the real cache-first app-shell worker lands in M5 (TDD §15.6).
let swState = 'unsupported';
if ('serviceWorker' in navigator) {
  swState = 'registering';
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => paint('registered'))
      .catch((err) => {
        console.error('SW registration failed', err);
        paint('failed');
      });
  });
}

const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

function paint(sw = swState) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="eyebrow">Reading Rhythm · Dev Infrastructure</div>
    <h1>Play This <span class="em">Measure</span></h1>
    <p class="lede">
      I can name every note &mdash; but not the chord they make, the count they sit
      on, or which ones I'm still holding. <b>This is the M-1 shell.</b>
    </p>

    <div class="card">
      <div class="status">
        <span class="dot ok"></span>
        App shell loaded
      </div>
      <div class="status">
        <span class="dot ${sw === 'registered' ? 'ok' : sw === 'failed' ? '' : 'hold'}"></span>
        Service worker: ${sw}
      </div>
      <div class="status">
        <span class="dot ${isStandalone ? 'ok' : 'hold'}"></span>
        ${isStandalone ? 'Running installed (standalone) ✓' : 'Open in browser — not yet installed'}
      </div>

      ${
        isStandalone
          ? `<p class="hint"><b>Installed.</b> M-1 is verified on this device.</p>`
          : `<p class="hint">To install: tap <b>Share</b> &rarr; <b>Add to Home Screen</b>,
             then open it from the home screen. It should launch full-screen and this
             line should turn into a check.</p>`
      }
    </div>

    <p class="meta">${BUILD}</p>
  `;
}

paint();
