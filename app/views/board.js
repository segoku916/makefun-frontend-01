// The bounty board: every open bounty as a card, with a live pot, entry
// fee, time left and entry count. One API request; search, sort and filter
// run on the cached answer, re-rendering only the list, never the page.

import { getBoard } from '../api.js';
import { dateTime, esc, money, oneLine, timeLeft, whole } from '../format.js';

const state = { query: '', sort: 'deadline', filter: 'all' };

function isOpen(b) {
  return new Date(b.deadline).getTime() > Date.now();
}

function potOf(b) {
  return Number(b.potUsd ?? b.rewardAmount ?? 0);
}

function applyFilters(items) {
  const q = state.query.trim().toLowerCase();
  let list = items.filter((b) => {
    if (state.filter === 'free' && Number(b.entryFeeUsd) > 0) return false;
    if (state.filter === 'soon' && new Date(b.deadline).getTime() - Date.now() > 86400000) return false;
    if (!q) return true;
    const hay = `${b.title} ${b.slug} ${b.category ?? ''} ${(b.skills ?? []).join(' ')}`.toLowerCase();
    return hay.includes(q);
  });
  const by = {
    // Still-open bounties first, soonest deadline first; ended ones last.
    deadline: (a, b2) => (isOpen(b2) - isOpen(a)) || (new Date(a.deadline) - new Date(b2.deadline)),
    pot: (a, b2) => potOf(b2) - potOf(a),
    entries: (a, b2) => (b2.submissionCount ?? 0) - (a.submissionCount ?? 0),
    newest: (a, b2) => new Date(b2.publishedAt) - new Date(a.publishedAt),
  };
  return list.sort(by[state.sort] ?? by.deadline);
}

function card(b) {
  const soon = new Date(b.deadline).getTime() - Date.now() < 86400000;
  const fee = Number(b.entryFeeUsd) > 0
    ? `<span class="pill fee">${money(b.entryFeeUsd)} entry fee</span>`
    : '<span class="pill free">Free to enter</span>';
  return `<li class="card">
    <h3><a href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a></h3>
    <p class="summary">${esc(oneLine(b.summary ?? b.description, 200))}</p>
    <div class="meta">
      <span class="pill">${esc(b.category ?? 'Bounty')}</span>${fee}
      ${isOpen(b) ? (soon ? '<span class="pill soon">Closing soon</span>' : '') : '<span class="pill soon">Entries closed</span>'}
    </div>
    <div class="pot">${money(potOf(b))} <small>live pot</small></div>
    <div class="facts">
      <span>⏳ <b data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</b></span>
      <span>📝 <b>${whole(b.submissionCount)}</b> entries</span>
      <span>🗓 ${dateTime(b.deadline)}</span>
    </div>
    <div class="links">
      <a href="#/bounty/${encodeURIComponent(b.slug)}">Details →</a>
      <a href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard →</a>
    </div>
  </li>`;
}

function listHtml(items) {
  if (!items.length) return '<p class="result-note">No bounties match. Try another search or filter.</p>';
  return `<ul class="grid">${items.map(card).join('')}</ul>`;
}

export async function render(root) {
  const data = await getBoard();
  const items = (data.items ?? []).filter((b) => !b.demo);
  const totalPot = items.reduce((sum, b) => sum + potOf(b), 0);
  const totalEntries = items.reduce((sum, b) => sum + (b.submissionCount ?? 0), 0);

  root.innerHTML = `<h1>Live bounties</h1>
    <div class="stats" role="status">
      <div class="stat"><b>${items.length}</b><span>open bounties</span></div>
      <div class="stat"><b>${money(totalPot)}</b><span>total live pot</span></div>
      <div class="stat"><b>${whole(totalEntries)}</b><span>entries so far</span></div>
    </div>
    <div class="toolbar">
      <input type="search" id="q" placeholder="Search bounties, skills, categories…" aria-label="Search bounties" value="${esc(state.query)}">
      <select id="sort" aria-label="Sort bounties">
        <option value="deadline" ${state.sort === 'deadline' ? 'selected' : ''}>Closing soonest</option>
        <option value="pot" ${state.sort === 'pot' ? 'selected' : ''}>Biggest pot</option>
        <option value="entries" ${state.sort === 'entries' ? 'selected' : ''}>Most entries</option>
        <option value="newest" ${state.sort === 'newest' ? 'selected' : ''}>Newest first</option>
      </select>
      <button type="button" class="chip ${state.filter === 'all' ? 'on' : ''}" data-filter="all">All</button>
      <button type="button" class="chip ${state.filter === 'free' ? 'on' : ''}" data-filter="free">No entry fee</button>
      <button type="button" class="chip ${state.filter === 'soon' ? 'on' : ''}" data-filter="soon">Closing &lt; 24h</button>
    </div>
    <p class="result-note" id="note"></p>
    <div id="list"></div>`;

  const listEl = root.querySelector('#list');
  const noteEl = root.querySelector('#note');
  const refresh = () => {
    const shown = applyFilters(items);
    listEl.innerHTML = listHtml(shown);
    noteEl.textContent = `Showing ${shown.length} of ${items.length} open bounties.`;
  };
  root.querySelector('#q').addEventListener('input', (e) => { state.query = e.target.value; refresh(); });
  root.querySelector('#sort').addEventListener('change', (e) => { state.sort = e.target.value; refresh(); });
  for (const chip of root.querySelectorAll('[data-filter]')) {
    chip.addEventListener('click', () => {
      state.filter = chip.dataset.filter;
      for (const c of root.querySelectorAll('[data-filter]')) c.classList.toggle('on', c === chip);
      refresh();
    });
  }
  refresh();
  return 'Live bounties';
}
