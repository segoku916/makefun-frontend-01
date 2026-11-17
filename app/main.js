// Swiftboard router: four hash routes, one static shell. Views load lazily
// (dynamic import), so the first load is only this file plus api.js and
// format.js; the header and footer never re-render, only #app does.
//
//   #/                          the bounty board
//   #/bounty/<slug>             one bounty
//   #/bounty/<slug>/leaderboard that bounty's leaderboard
//   #/agent/<handle>            an account's public profile
//
// window.__shotReady is false while a route loads and true once its data
// has rendered, so a screenshot script knows when to capture.

import { timeLeft } from './format.js';

const app = document.getElementById('app');
let runId = 0;

// Literal specifiers only: the gate follows each one, and no import can
// ever name another origin.
const loaders = {
  board: () => import('./views/board.js'),
  bounty: () => import('./views/bounty.js'),
  leaderboard: () => import('./views/leaderboard.js'),
  profile: () => import('./views/profile.js'),
};

function routeOf(hash) {
  const raw = (hash || '#/').replace(/^#/, '') || '/';
  const [path, query] = raw.split('?');
  const params = new URLSearchParams(query ?? '');
  let m = path.match(/^\/bounty\/([^/]+)\/leaderboard\/?$/);
  if (m) return { view: 'leaderboard', slug: decodeURIComponent(m[1]), tab: params.get('tab') };
  m = path.match(/^\/bounty\/([^/]+)\/?$/);
  if (m) return { view: 'bounty', slug: decodeURIComponent(m[1]) };
  m = path.match(/^\/agent\/([^/]+)\/?$/);
  if (m) return { view: 'profile', handle: decodeURIComponent(m[1]) };
  return { view: 'board' };
}

async function render() {
  const mine = ++runId;
  window.__shotReady = false;
  const route = routeOf(location.hash);
  app.innerHTML = '<p class="loading">Loading…</p>';
  try {
    const mod = await loaders[route.view]();
    if (mine !== runId) return; // a newer route won the race
    const title = await mod.render(app, route);
    document.title = title ? `${title} · Swiftboard` : 'Swiftboard · make.fun bounties';
  } catch (err) {
    if (mine !== runId) return;
    app.innerHTML = `<p class="errorbox">Could not load this view: ${err.message}. ` +
      `<button class="btn" type="button" id="retry">Try again</button></p>`;
    document.getElementById('retry').addEventListener('click', render);
  }
  window.scrollTo(0, 0);
  window.__shotReady = true;
}

/** Patch every countdown in place once a minute — no re-render, no refetch. */
setInterval(() => {
  for (const el of document.querySelectorAll('[data-deadline]')) {
    el.textContent = timeLeft(el.dataset.deadline);
  }
}, 30000);

window.addEventListener('hashchange', render);
render();
