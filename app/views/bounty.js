// One bounty's page: summary, live pot and fee, dates and status, the
// rewards table with the live pot split, description and rules — plus a
// rail of the other open bounties, read from the board cache so it costs
// no extra request when the board was already visited.

import { getBoard, getBounty } from '../api.js';
import { dateTime, esc, md, money, timeLeft, whole } from '../format.js';

function rewardsTable(rows, limit) {
  const shown = rows.slice(0, limit);
  const body = shown.map((r) => `<tr class="${r.place <= 3 ? 'top' : ''}">
    <td>#${r.place}</td>
    <td class="num">${money(r.baseUsd)}</td>
    <td class="num">${money(r.feeShareUsd)}</td>
    <td class="num"><strong>${money(r.amountUsd)}</strong></td>
  </tr>`).join('');
  return `<table class="rewards">
    <thead><tr><th>Place</th><th class="num">Base reward</th><th class="num">Fee share</th><th class="num">Total now</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

export async function render(root, route) {
  const b = await getBounty(route.slug);
  const open = new Date(b.deadline).getTime() > Date.now() && b.acceptingSubmissions !== false;
  const pot = Number(b.potUsd ?? b.rewardAmount ?? 0);
  const fee = Number(b.entryFeeUsd ?? 0);
  const payers = Number(b.entryFeePayers ?? 0);
  const rewards = Array.isArray(b.rewardsNow) && b.rewardsNow.length
    ? b.rewardsNow
    : Object.entries(b.rewards ?? {}).map(([place, usd]) => ({ place: Number(place), baseUsd: usd, feeShareUsd: 0, amountUsd: usd }));

  root.innerHTML = `<p class="crumbs"><a href="#/">← All bounties</a></p>
  <div class="layout"><div>
    <h1>${esc(b.title)} <span class="badge ${open ? 'open' : 'closed'}">${open ? 'OPEN' : 'CLOSED'}</span></h1>
    <p>${esc(b.summary ?? '')}</p>
    <div class="factgrid">
      <div class="fact"><b>${money(pot)}</b><span>live pot</span></div>
      <div class="fact"><b>${money(b.rewardAmount)}</b><span>base reward</span></div>
      <div class="fact"><b>${fee > 0 ? money(fee) : 'Free'}</b><span>entry fee${payers ? ` · ${whole(payers)} paid` : ''}</span></div>
      <div class="fact"><b data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</b><span>closes ${dateTime(b.deadline)}</span></div>
      <div class="fact"><b>${whole(b.submissionCount)}</b><span>entries</span></div>
      <div class="fact"><b>${esc(b.category ?? '—')}</b><span>category</span></div>
    </div>
    <p><a class="btn primary" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">View leaderboard →</a>
    <a class="btn" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}">Open on make.fun ↗</a></p>
    <h2>Rewards <small>(${rewards.length} paid places, live pot split)</small></h2>
    <div id="rewards">${rewardsTable(rewards, 10)}</div>
    ${rewards.length > 10 ? `<p><button class="btn" type="button" id="allrewards">Show all ${rewards.length} places</button></p>` : ''}
    <h2>About this bounty</h2>
    <div class="prose">${md(b.description ?? '')}</div>
    ${b.rules ? `<details class="rules"><summary>Full rules</summary><div class="prose">${md(b.rules)}</div></details>` : ''}
  </div>
  <aside class="rail" aria-label="Other open bounties"><h2>Other open bounties</h2><ul id="rail"><li>Loading…</li></ul></aside>
  </div>`;

  const showAll = root.querySelector('#allrewards');
  if (showAll) {
    showAll.addEventListener('click', () => {
      root.querySelector('#rewards').innerHTML = rewardsTable(rewards, rewards.length);
      showAll.remove();
    });
  }

  // The rail reuses the board answer (cached): no second request on the
  // common path, one if this page was opened directly.
  try {
    const board = await getBoard();
    const others = (board.items ?? []).filter((x) => x.slug !== b.slug && !x.demo).slice(0, 6);
    root.querySelector('#rail').innerHTML = others.map((x) => `<li>
      <b><a href="#/bounty/${encodeURIComponent(x.slug)}">${esc(x.title)}</a></b>
      <span>${money(Number(x.potUsd ?? x.rewardAmount ?? 0))} · <span data-deadline="${esc(x.deadline)}">${timeLeft(x.deadline)}</span> · ${whole(x.submissionCount)} entries</span>
    </li>`).join('') || '<li>No other open bounties.</li>';
  } catch {
    root.querySelector('#rail').innerHTML = '<li>Could not load the board.</li>';
  }
  return b.title;
}
