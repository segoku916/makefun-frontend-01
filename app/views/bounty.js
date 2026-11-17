// One bounty's page: live pot and fee, dates and status, the rewards
// table with the live pot split, the description and the rules — plus a
// rail of the other open bounties, read from the board cache so it costs
// no extra request when the board was already visited. The rules (often
// tens of kilobytes) render only when their details element first opens.

import { board, bounty } from '../api.js';
import { countdown, dateStr, h, int, mdLite, usd } from '../format.js';

function rewardsRows(rows, limit) {
  return rows.slice(0, limit).map((r) => `<tr class="${r.place <= 3 ? 'lead' : ''}">
    <td>#${r.place}</td>
    <td class="num">${usd(r.baseUsd)}</td>
    <td class="num">${usd(r.feeShareUsd)}</td>
    <td class="num"><strong>${usd(r.amountUsd)}</strong></td>
  </tr>`).join('');
}

function rewardsTable(rows, limit) {
  return `<table class="data">
    <thead><tr><th>Place</th><th class="num">Base reward</th><th class="num">Fee share</th><th class="num">Total now</th></tr></thead>
    <tbody>${rewardsRows(rows, limit)}</tbody>
  </table>`;
}

export async function render(root, route) {
  const b = await bounty(route.slug);
  const open = new Date(b.deadline).getTime() > Date.now() && b.acceptingSubmissions !== false;
  const pot = Number(b.potUsd ?? b.rewardAmount ?? 0);
  const fee = Number(b.entryFeeUsd ?? 0);
  const payers = Number(b.entryFeePayers ?? 0);
  const rewards = Array.isArray(b.rewardsNow) && b.rewardsNow.length
    ? b.rewardsNow
    : Object.entries(b.rewards ?? {}).map(([place, amount]) => ({ place: Number(place), baseUsd: amount, feeShareUsd: 0, amountUsd: amount }));

  root.innerHTML = `<p class="crumbs"><a href="#/">← All bounties</a></p>
  <div class="two-col"><div>
    <h1>${h(b.title)} <span class="status ${open ? 'open' : 'closed'}">${open ? 'OPEN' : 'CLOSED'}</span></h1>
    <p>${h(b.summary ?? '')}</p>
    <div class="factgrid">
      <div class="fact"><b>${usd(pot)}</b><span>live pot</span></div>
      <div class="fact"><b>${usd(b.rewardAmount)}</b><span>base reward</span></div>
      <div class="fact"><b>${fee > 0 ? usd(fee) : 'Free'}</b><span>entry fee${payers ? ` · ${int(payers)} paid` : ''}</span></div>
      <div class="fact"><b data-countdown="${h(b.deadline)}">${countdown(b.deadline)}</b><span>closes ${dateStr(b.deadline)}</span></div>
      <div class="fact"><b>${int(b.submissionCount)}</b><span>entries</span></div>
      <div class="fact"><b>${h(b.category ?? '—')}</b><span>category</span></div>
    </div>
    <div class="actions">
      <a class="btn primary" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">View leaderboard →</a>
      <a class="btn" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}">Open on make.fun ↗</a>
    </div>
    <h2>Rewards <small>· ${rewards.length} paid places, live pot split</small></h2>
    <div id="rewards">${rewardsTable(rewards, 10)}</div>
    ${rewards.length > 10 ? `<p><button class="btn" type="button" id="all-places">Show all ${rewards.length} places</button></p>` : ''}
    <h2>About this bounty</h2>
    <div class="prose">${mdLite(b.description ?? '')}</div>
    ${b.rules ? `<details class="rules" id="rules-box"><summary>Full rules</summary><div class="prose" id="rules-body"><p class="count-line">Loading rules…</p></div></details>` : ''}
    <h2>Dates</h2>
    <div class="factgrid">
      <div class="fact"><b>${dateStr(b.publishedAt)}</b><span>published</span></div>
      <div class="fact"><b>${dateStr(b.opensAt ?? b.publishedAt)}</b><span>opened</span></div>
      <div class="fact"><b>${dateStr(b.deadline)}</b><span>entries close</span></div>
      <div class="fact"><b>${b.resolvedAt ? dateStr(b.resolvedAt) : 'Not yet'}</b><span>results</span></div>
    </div>
  </div>
  <aside class="rail" aria-label="Other open bounties"><h2>Other open bounties</h2><ul id="rail"><li>Loading…</li></ul></aside>
  </div>`;

  const showAll = root.querySelector('#all-places');
  if (showAll) {
    showAll.addEventListener('click', () => {
      root.querySelector('#rewards').innerHTML = rewardsTable(rewards, rewards.length);
      showAll.remove();
    });
  }

  const rulesBox = root.querySelector('#rules-box');
  if (rulesBox) {
    rulesBox.addEventListener('toggle', () => {
      if (rulesBox.open && !rulesBox.dataset.done) {
        rulesBox.dataset.done = '1';
        root.querySelector('#rules-body').innerHTML = mdLite(b.rules);
      }
    }, { once: false });
  }

  try {
    const data = await board();
    const others = (data.items ?? [])
      .filter((x) => x.slug !== b.slug && !x.demo)
      .sort((a, b2) => Number(b2.potUsd ?? 0) - Number(a.potUsd ?? 0))
      .slice(0, 6);
    root.querySelector('#rail').innerHTML = others.map((x) => `<li>
      <b><a href="#/bounty/${encodeURIComponent(x.slug)}">${h(x.title)}</a></b>
      <span>${usd(Number(x.potUsd ?? x.rewardAmount ?? 0))} · <span data-countdown="${h(x.deadline)}">${countdown(x.deadline)}</span> · ${int(x.submissionCount)} entries</span>
    </li>`).join('') || '<li>No other open bounties.</li>';
  } catch {
    root.querySelector('#rail').innerHTML = '<li>Could not load the board.</li>';
  }
  return b.title;
}
