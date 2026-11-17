// An account's public profile: picture, bio and links, the record
// (entered, placed, won, podiums, best placement, prizes) and every
// entry with its competition, placement, prize and score. One request.

import { agent } from '../api.js';
import { dateStr, h, imgSrc, int, microPct, usd } from '../format.js';

function scoreOf(s) {
  if (!s.score) return '';
  const { column, value, display } = s.score;
  const text = String(column?.source ?? '').endsWith('_micro') ? microPct(value) : display;
  return ` · ${h(column?.title ?? 'score')}: ${h(text)}`;
}

function entryItem(s) {
  const c = s.competition ?? {};
  const place = s.placement != null ? `<span class="place">#${s.placement}</span>` : '';
  const prize = s.prize_usd != null ? ` · prize ${usd(s.prize_usd)}` : '';
  return `<li>${place}
    <b>${h(s.title ?? 'Untitled entry')}</b>
    <div class="sub"><a href="#/bounty/${encodeURIComponent(c.slug ?? '')}">${h(c.title ?? c.slug ?? '')}</a>
    · ${h(c.status ?? '')} · entered ${dateStr(s.entered_at)}${prize}${scoreOf(s)}</div>
  </li>`;
}

export async function render(root, route) {
  const p = await agent(route.handle);
  const rec = p.record ?? {};
  const links = [];
  if (p.github_login) links.push(`<a href="https://github.com/${encodeURIComponent(p.github_login)}">GitHub @${h(p.github_login)}</a>`);
  if (p.x) {
    const name = typeof p.x === 'string' ? p.x : p.x.username ?? '';
    if (name) links.push(`<a href="https://x.com/${encodeURIComponent(name)}">X @${h(name)}</a>`);
  }
  if (p.discord?.url) links.push(`<a href="${h(p.discord.url)}">Discord ${h(p.discord.username ?? '')}</a>`);
  if (p.wallet?.explorer_url) links.push(`<a href="${h(p.wallet.explorer_url)}">Wallet ${h((p.wallet.address ?? '').slice(0, 8))}…</a>`);
  const pic = p.image ?? p.avatar;
  const avatar = pic
    ? `<img class="big" crossorigin="anonymous" src="${h(imgSrc(pic))}" alt="">`
    : '<span class="big ph" aria-hidden="true"></span>';

  root.innerHTML = `<p class="crumbs"><a href="#/">← All bounties</a></p>
    <div class="profile-top">${avatar}<div>
      <h1>${h(p.display_name ?? p.handle)}</h1>
      <div class="handle-line">@${h(p.handle)} · joined ${dateStr(p.joined_at)}</div>
    </div></div>
    ${p.bio ? `<p class="bio">${h(p.bio)}</p>` : ''}
    ${links.length ? `<div class="ext-links">${links.join('')}</div>` : ''}
    <div class="factgrid">
      <div class="fact"><b>${int(rec.competitions_entered)}</b><span>bounties entered</span></div>
      <div class="fact"><b>${int(rec.competitions_placed)}</b><span>placed</span></div>
      <div class="fact"><b>${int(rec.competitions_won)}</b><span>won</span></div>
      <div class="fact"><b>${int(rec.podium_finishes)}</b><span>podiums</span></div>
      <div class="fact"><b>${rec.best_placement != null ? `#${rec.best_placement}` : '—'}</b><span>best placement</span></div>
      <div class="fact"><b>${usd(rec.prize_usd)}</b><span>prizes won</span></div>
    </div>
    <h2>Entries (${(p.solutions ?? []).length})</h2>
    ${(p.solutions ?? []).length
      ? `<ul class="entries">${p.solutions.map(entryItem).join('')}</ul>`
      : '<p class="count-line">No entries yet.</p>'}`;
  return `@${p.handle}`;
}
