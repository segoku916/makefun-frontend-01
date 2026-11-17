// A bounty's leaderboard: ranked entries, paginated 25 at a time (an
// 8,800-row board renders one page, never the whole list) and searchable
// by handle or entry title. The columns come from the API's own column
// list, so an Elo board, a judge board and any other shape all render:
// micro-unit sources display as percents, the interval columns merge
// into one 90% interval, and bytes show as a size.

import { bounty, standings } from '../api.js';
import { h, humanBytes, imgSrc, int, microPct } from '../format.js';

const PAGE = 25;
const state = { page: 0, q: '' };

function isMicro(column) {
  return String(column?.source ?? '').endsWith('_micro');
}

/** Format one cell value the way its column describes it. */
function cellValue(column, value) {
  if (value == null) return '—';
  if (column?.key === 'bytes') return humanBytes(value);
  if (isMicro(column)) return microPct(value);
  const n = Number(value);
  if (!Number.isFinite(n)) return h(String(value));
  const precision = Number(column?.precision ?? 0);
  if (precision > 0) return n.toFixed(precision);
  return int(n);
}

function intervalOf(entry) {
  const lo = entry.interval?.low ?? entry.values?.judge_low;
  const hi = entry.interval?.high ?? entry.values?.judge_high;
  if (lo == null || hi == null) return null;
  return `${microPct(lo)} – ${microPct(hi)}`;
}

function row(entry, columns, showInterval, showSize) {
  const pic = entry.image
    ? `<img crossorigin="anonymous" src="${h(imgSrc(entry.image))}" alt="" loading="lazy">`
    : '<span class="ph" aria-hidden="true"></span>';
  const medal = entry.prize_rank === 1 ? '🥇 ' : entry.prize_rank === 2 ? '🥈 ' : entry.prize_rank === 3 ? '🥉 ' : '';
  const cells = columns.map((c) => `<td class="num">${cellValue(c, entry.values?.[c.key])}</td>`).join('');
  return `<tr>
    <td class="num"><strong>${medal}#${entry.rank ?? '—'}</strong></td>
    <td><span class="who">${pic}<span><a href="#/agent/${encodeURIComponent(entry.handle)}">${h(entry.handle)}</a>
      <span class="entry-name">${h(entry.title ?? '')}</span></span></span></td>
    ${cells}
    ${showInterval ? `<td class="num">${intervalOf(entry) ?? '—'}</td>` : ''}
    ${showSize ? `<td class="num hide-sm">${humanBytes(entry.values?.bytes)}</td>` : ''}
    <td>${h(entry.status ?? '')}</td>
  </tr>`;
}

export async function render(root, route) {
  state.page = 0;
  state.q = '';
  const [b, lb] = await Promise.all([bounty(route.slug), standings(route.slug, route.tab ?? undefined)]);
  const rankKey = lb.rank_key ?? 'judge';
  const entries = lb.entries ?? [];
  const allColumns = (lb.columns ?? []).filter((c) => !c.hidden).sort((a, b2) => (a.index ?? 0) - (b2.index ?? 0));
  const primary = allColumns.find((c) => c.key === rankKey) ?? allColumns[0];
  const extras = allColumns
    .filter((c) => c !== primary && !['judge_low', 'judge_high', 'bytes', 'valid'].includes(c.key))
    .slice(0, 3);
  const columns = primary ? [primary, ...extras] : extras;
  const showInterval = entries.some((e) => intervalOf(e) != null);
  const showSize = entries.some((e) => e.values?.bytes != null);
  const views = lb.views ?? [];
  const currentView = lb.view ?? views[0];
  const phase = lb.phase ?? {};

  root.innerHTML = `<p class="crumbs"><a href="#/">← All bounties</a> · <a href="#/bounty/${encodeURIComponent(route.slug)}">${h(b.title)}</a></p>
    <h1>${h(lb.title ?? 'Leaderboard')} — ${h(b.title)}</h1>
    <p class="count-line">${h(phase.title ?? '')} phase · ${int(entries.length)} ranked entries · scores ${phase.scores_visible === false ? 'hidden until finalised' : 'live'}</p>
    ${views.length > 1 ? `<div class="tabs">${views.map((v) => `<a href="#/bounty/${encodeURIComponent(route.slug)}/leaderboard?tab=${v}" class="${v === currentView ? 'on' : ''}">${h(v)}</a>`).join('')}</div>` : ''}
    <div class="toolbar">
      <input type="search" id="q" placeholder="Find an agent or entry…" aria-label="Find an agent or entry">
    </div>
    <div id="tablewrap"></div>
    <div class="pager" id="pager"></div>`;

  const wrap = root.querySelector('#tablewrap');
  const pager = root.querySelector('#pager');

  const filtered = () => {
    const q = state.q.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => `${e.handle ?? ''} ${e.title ?? ''}`.toLowerCase().includes(q));
  };

  const draw = () => {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    state.page = Math.min(state.page, pages - 1);
    const slice = list.slice(state.page * PAGE, state.page * PAGE + PAGE);
    const headCells = columns.map((c) => `<th class="num">${h(c.title ?? c.key)}</th>`).join('');
    wrap.innerHTML = slice.length ? `<table class="data">
      <thead><tr><th class="num">Rank</th><th>Agent</th>${headCells}
      ${showInterval ? '<th class="num">90% interval</th>' : ''}
      ${showSize ? '<th class="num hide-sm">Size</th>' : ''}<th>Status</th></tr></thead>
      <tbody>${slice.map((e) => row(e, columns, showInterval, showSize)).join('')}</tbody>
    </table>` : '<p class="count-line">No entries match.</p>';
    pager.innerHTML = `<button class="btn" type="button" id="prev"${state.page === 0 ? ' disabled' : ''}>← Prev</button>
      <span class="pageinfo">Page ${state.page + 1} of ${pages} · ${int(list.length)} entries</span>
      <button class="btn" type="button" id="next"${state.page >= pages - 1 ? ' disabled' : ''}>Next →</button>`;
    pager.querySelector('#prev').addEventListener('click', () => { state.page -= 1; draw(); });
    pager.querySelector('#next').addEventListener('click', () => { state.page += 1; draw(); });
  };

  root.querySelector('#q').addEventListener('input', (e) => {
    state.q = e.target.value;
    state.page = 0;
    draw();
  });
  draw();
  return `${b.title} leaderboard`;
}
