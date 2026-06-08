// src/main.js — app shell + hash router (TDD §8). M2 routes: Home, Capture,
// Confirm, Lesson. (Home/Song with persistence + circle-of-fifths grow in M3.)
import './styles.css';
import './ui/ui.css';
import './engine/lab.css'; // staff/stem/beam strokes + lab layout (the Confirm & Lesson notation)
import { mountHome } from './ui/home.js';
import { mountCapture } from './ui/capture.js';
import { mountConfirm } from './ui/confirm.js';
import { mountLesson } from './ui/lesson.js';

const app = document.getElementById('app');

// Service worker: the M-1 network-first dev worker (cache-first app shell is M5).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.error('SW registration failed', err));
  });
}

const routes = [
  { re: /^#\/lesson\/(.+)$/, mount: (el, m) => mountLesson(el, { id: decodeURIComponent(m[1]) }) },
  { re: /^#\/capture\/?$/, mount: (el) => mountCapture(el) },
  { re: /^#\/confirm\/?$/, mount: (el) => mountConfirm(el) },
  { re: /^#\/?$/, mount: (el) => mountHome(el) },
];

let cleanup = null;
async function route() {
  const hash = location.hash || '#/';
  for (const r of routes) {
    const m = hash.match(r.re);
    if (!m) continue;
    if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
    window.scrollTo(0, 0);
    cleanup = (await r.mount(app, m)) || null;
    return;
  }
  location.hash = '#/'; // unknown route -> home
}

window.addEventListener('hashchange', route);
route();
