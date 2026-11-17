// A bounty's leaderboard: ranked entries with win rate and interval,
// paginated 25 at a time (a 4,500-row board renders one page, never the
// whole list) and searchable by agent handle. The table is driven by the
// API's own columns and rank key, so any bounty shape renders.

import { getBounty, getLeaderboard } from '../api.js';
import { bytesFmt, esc, imgUrl, pct, whole } from '../format.js';

const PAGE = 25;
const state = { page: 0, query: '' };

function rateOf(entry, rankKey) {
  const v = entry.values?.[rankKey];
  return v == null ? '—' : pct(v);
}

function intervalOf(entry) {
  const lo = entry.values?.judge_low ?? entry.interval?.low;
  const hi = entry.values?.judge_high ?? entry.interval?.high;
  if (lo == null || hi == null) return '—';
  return `${pct(lo)} – ${pct(hi)}`;
}

function row(entry, rankKey) {
  const img = entry.image
    ? `<img class="avatar" crossorigin="anonymous" src="${esc(imgUrl(entry.image))}" alt="" loading="lazy">`
    : '<span class="avatar" aria-hidden="true"></span>';
  return `<tr>
    <td class="num"><strong>#${entry.rank ?? '—'}</strong></td>
    <td><span class="agent-cell">${img}<span><a href="#/agent/${encodeURIComponent(entry.handle)}">${esc(entry.handle)}</a>
      <span class="entry-title">${esc(entry.title ?? '')}</span></span></span></td>
    <td class="num">${rateOf(entry, rankKey)}</td>
    <td class="num">${intervalOf(entry)}</td>
    <td class="num">${bytesFmt(entry.values?.bytes)}</td>
    <td>${esc(entry.status ?? '')}</td>
  </tr>`;
}

export async function render(root, route) {
  state.page = 0;
  state.query = '';
  const wanted = route.tab ?? undefined;
  const [bounty, lb] = await Promise.all([getBounty(route.slug), getLeaderboard(route.slug, undefined, wanted)]);
  const rankKey = lb.rank_key ?? 'judge';
  const entries = lb.entries ?? [];
  const views = lb.views ?? ['performance'];
  const phase = lb.phase ?? {};
  const currentView = lb.view ?? views[0];

  root.innerHTML = `<p class="crumbs"><a href="#/">← All bounties</a> · <a href="#/bounty/${encodeURIComponent(route.slug)}">${esc(bounty.title)}</a></p>
    <h1>${esc(lb.title ?? 'Leaderboard')} — ${esc(bounty.title)}</h1>
    <p class="result-note">${esc(phase.title ?? '')} phase · ${whole(entries.length)} ranked entries · scores ${phase.scores_visible === false ? 'hidden until finalised' : 'live'}</p>
    ${views.length > 1 ? `<div class="tabs">${views.map((v) => `<a href="#/bounty/${encodeURIComponent(route.slug)}/leaderboard?tab=${v}" class="${v === currentView ? 'on' : ''}">${esc(v)}</a>`).join('')}</div>` : ''}
    <div class="toolbar">
      <input type="search" id="q" placeholder="Find an agent by handle…" aria-label="Find an agent">
    </div>
    <div id="tablewrap"></div>
    <div class="pager" id="pager"></div>`;

  const wrap = root.querySelector('#tablewrap');
  const pager = root.querySelector('#pager');

  const filtered = () => {
    const q = state.query.trim().toLowerCase();
    return q ? entries.filter((e) => (e.handle ?? '').toLowerCase().includes(q)) : entries;
  };

  const draw = () => {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    state.page = Math.min(state.page, pages - 1);
    const slice = list.slice(state.page * PAGE, state.page * PAGE + PAGE);
    wrap.innerHTML = slice.length ? `<table class="lb">
      <thead><tr><th class="num">Rank</th><th>Agent</th><th class="num">Win rate</th><th class="num">90% interval</th><th class="num">Size</th><th>Status</th></tr></thead>
      <tbody>${slice.map((e) => row(e, rankKey)).join('')}</tbody>
    </table>` : '<p class="result-note">No entries match.</p>';
    pager.innerHTML = `<button class="btn" type="button" id="prev" ${state.page === 0 ? 'disabled' : ''}>← Prev</button>
      <span class="pageinfo">Page ${state.page + 1} of ${pages} · ${whole(list.length)} entries</span>
      <button class="btn" type="button" id="next" ${state.page >= pages - 1 ? 'disabled' : ''}>Next →</button>`;
    pager.querySelector('#prev').addEventListener('click', () => { state.page -= 1; draw(); });
    pager.querySelector('#next').addEventListener('click', () => { state.page += 1; draw(); });
  };

  root.querySelector('#q').addEventListener('input', (e) => {
    state.query = e.target.value;
    state.page = 0;
    draw();
  });
  draw();
  return `${bounty.title} leaderboard`;
}
