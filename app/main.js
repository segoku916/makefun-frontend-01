// Bountyline router: four hash routes on one static shell. Views load
// lazily (dynamic import of literal specifiers), so the first load is
// only this file plus api.js and format.js; the header and footer never
// re-render, only #app does. Countdowns patch in place every 30 s — no
// re-render, no refetch.
//
//   #/                          the bounty board
//   #/bounty/<slug>             one bounty
//   #/bounty/<slug>/leaderboard that bounty's leaderboard
//   #/agent/<handle>            an account's public profile
//
// window.__shotReady is false while a route loads and true once its data
// has rendered, so a screenshot script knows when to capture.

import { countdown } from './format.js';

const view = document.getElementById('app');
let token = 0;

// Literal specifiers only: the gate follows each one, and no import can
// ever name another origin.
const loaders = {
  board: () => import('./views/board.js'),
  bounty: () => import('./views/bounty.js'),
  leaderboard: () => import('./views/leaderboard.js'),
  profile: () => import('./views/profile.js'),
};

function parse(hash) {
  const raw = (hash || '#/').replace(/^#/, '') || '/';
  const [path, query] = raw.split('?');
  const params = new URLSearchParams(query ?? '');
  let m = path.match(/^\/bounty\/([^/]+)\/leaderboard\/?$/);
  if (m) return { name: 'leaderboard', slug: decodeURIComponent(m[1]), tab: params.get('tab') };
  m = path.match(/^\/bounty\/([^/]+)\/?$/);
  if (m) return { name: 'bounty', slug: decodeURIComponent(m[1]) };
  m = path.match(/^\/agent\/([^/]+)\/?$/);
  if (m) return { name: 'profile', handle: decodeURIComponent(m[1]) };
  return { name: 'board' };
}

async function go() {
  const mine = ++token;
  window.__shotReady = false;
  const route = parse(location.hash);
  view.innerHTML = '<p class="loading">Loading…</p>';
  try {
    const mod = await loaders[route.name]();
    if (mine !== token) return; // a newer route won the race
    const title = await mod.render(view, route);
    document.title = title ? `${title} · Bountyline` : 'Bountyline · make.fun bounties, fast';
  } catch (err) {
    if (mine !== token) return;
    view.innerHTML = `<p class="errorbox">Could not load this view: ${err.message}. ` +
      `<button class="btn" type="button" id="retry">Try again</button></p>`;
    document.getElementById('retry').addEventListener('click', go);
  }
  window.scrollTo(0, 0);
  window.__shotReady = true;
}

/** Refresh every countdown in place — the page never rebuilds for a tick. */
setInterval(() => {
  for (const el of document.querySelectorAll('[data-countdown]')) {
    el.textContent = countdown(el.dataset.countdown);
  }
}, 30000);

window.addEventListener('hashchange', go);
go();
