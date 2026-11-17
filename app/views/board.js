// The bounty board: every open bounty as a card — live pot, entry fee,
// time left, entries. One API request; search, sort and filter run on
// the cached answer and re-render only the list, never the page.

import { board } from '../api.js';
import { countdown, dateStr, excerpt, h, int, usd } from '../format.js';

const prefs = { q: '', sort: 'deadline', filter: 'all' };
const DAY = 86400000;

/** A bounty still takes entries when its deadline is ahead, whatever its status says. */
function stillOpen(b) {
  return new Date(b.deadline).getTime() > Date.now();
}

function pot(b) {
  return Number(b.potUsd ?? b.rewardAmount ?? 0);
}

function visible(items) {
  const q = prefs.q.trim().toLowerCase();
  const list = items.filter((b) => {
    if (prefs.filter === 'free' && Number(b.entryFeeUsd) > 0) return false;
    if (prefs.filter === 'soon' && new Date(b.deadline).getTime() - Date.now() > DAY) return false;
    if (!q) return true;
    const hay = `${b.title} ${b.slug} ${b.category ?? ''} ${(b.skills ?? []).join(' ')}`.toLowerCase();
    return hay.includes(q);
  });
  const orders = {
    deadline: (a, b2) => (stillOpen(b2) - stillOpen(a)) || (new Date(a.deadline) - new Date(b2.deadline)),
    pot: (a, b2) => pot(b2) - pot(a),
    entries: (a, b2) => (b2.submissionCount ?? 0) - (a.submissionCount ?? 0),
    newest: (a, b2) => new Date(b2.publishedAt) - new Date(a.publishedAt),
  };
  return list.sort(orders[prefs.sort] ?? orders.deadline);
}

function card(b) {
  const fee = Number(b.entryFeeUsd) > 0
    ? `<span class="tag fee">${usd(b.entryFeeUsd)} entry fee</span>`
    : '<span class="tag free">Free to enter</span>';
  const closingSoon = stillOpen(b) && new Date(b.deadline).getTime() - Date.now() < DAY;
  const badge = !stillOpen(b)
    ? '<span class="tag soon">Entries closed</span>'
    : closingSoon ? '<span class="tag soon">Closing soon</span>' : '';
  return `<li class="bounty-card">
    <h3><a href="#/bounty/${encodeURIComponent(b.slug)}">${h(b.title)}</a></h3>
    <p class="card-summary">${h(excerpt(b.summary ?? b.description, 190))}</p>
    <div class="tags"><span class="tag">${h(b.category ?? 'Bounty')}</span>${fee}${badge}</div>
    <div class="pot-line">${usd(pot(b))} <small>live pot</small></div>
    <div class="card-facts">
      <span>⏳ <b data-countdown="${h(b.deadline)}">${countdown(b.deadline)}</b></span>
      <span>📝 <b>${int(b.submissionCount)}</b> entries</span>
      <span>🗓 ${dateStr(b.deadline)}</span>
    </div>
    <div class="card-links">
      <a href="#/bounty/${encodeURIComponent(b.slug)}">Details →</a>
      <a href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard →</a>
    </div>
  </li>`;
}

export async function render(root) {
  const data = await board();
  const items = (data.items ?? []).filter((b) => !b.demo);
  const totalPot = items.reduce((sum, b) => sum + pot(b), 0);
  const totalEntries = items.reduce((sum, b) => sum + (b.submissionCount ?? 0), 0);
  const freeCount = items.filter((b) => Number(b.entryFeeUsd) <= 0).length;

  root.innerHTML = `<h1>Live bounties</h1>
    <div class="kpis" role="status">
      <div class="kpi"><b>${items.length}</b><span>open bounties</span></div>
      <div class="kpi"><b>${usd(totalPot)}</b><span>total live pot</span></div>
      <div class="kpi"><b>${int(totalEntries)}</b><span>entries so far</span></div>
      <div class="kpi"><b>${freeCount}</b><span>free to enter</span></div>
    </div>
    <div class="toolbar">
      <input type="search" id="q" placeholder="Search bounties, skills, categories…" aria-label="Search bounties" value="${h(prefs.q)}">
      <select id="sort" aria-label="Sort bounties">
        <option value="deadline"${prefs.sort === 'deadline' ? ' selected' : ''}>Closing soonest</option>
        <option value="pot"${prefs.sort === 'pot' ? ' selected' : ''}>Biggest pot</option>
        <option value="entries"${prefs.sort === 'entries' ? ' selected' : ''}>Most entries</option>
        <option value="newest"${prefs.sort === 'newest' ? ' selected' : ''}>Newest first</option>
      </select>
      <button type="button" class="chip${prefs.filter === 'all' ? ' on' : ''}" data-filter="all">All</button>
      <button type="button" class="chip${prefs.filter === 'free' ? ' on' : ''}" data-filter="free">No entry fee</button>
      <button type="button" class="chip${prefs.filter === 'soon' ? ' on' : ''}" data-filter="soon">Closing &lt; 24h</button>
    </div>
    <p class="count-line" id="count"></p>
    <div id="list"></div>`;

  const listEl = root.querySelector('#list');
  const countEl = root.querySelector('#count');
  const refresh = () => {
    const shown = visible(items);
    listEl.innerHTML = shown.length
      ? `<ul class="cards">${shown.map(card).join('')}</ul>`
      : '<p class="count-line">No bounties match. Try another search or filter.</p>';
    countEl.textContent = `Showing ${shown.length} of ${items.length} open bounties.`;
  };
  root.querySelector('#q').addEventListener('input', (e) => { prefs.q = e.target.value; refresh(); });
  root.querySelector('#sort').addEventListener('change', (e) => { prefs.sort = e.target.value; refresh(); });
  for (const chip of root.querySelectorAll('[data-filter]')) {
    chip.addEventListener('click', () => {
      prefs.filter = chip.dataset.filter;
      for (const c of root.querySelectorAll('[data-filter]')) c.classList.toggle('on', c === chip);
      refresh();
    });
  }
  refresh();
  return 'Live bounties';
}
