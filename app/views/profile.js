// An account's public profile: picture, bio and links, the record
// (entered, placed, won, best placement, prizes) and every solution with
// its competition, placement and score. One API request.

import { getProfile } from '../api.js';
import { dateTime, esc, imgUrl, money, pct, whole } from '../format.js';

function scoreText(s) {
  if (!s.score) return '';
  const { column, value, display } = s.score;
  // Micro-unit sources (judge win_rate_micro) display as a percent.
  const text = String(column?.source ?? '').endsWith('_micro') ? pct(value) : display;
  return ` · ${esc(column?.title ?? 'score')}: ${esc(text)}`;
}

function solution(s) {
  const c = s.competition ?? {};
  const place = s.placement != null ? `<span class="place">#${s.placement}</span>` : '';
  const prize = s.prize_usd != null ? ` · prize ${money(s.prize_usd)}` : '';
  return `<li>${place}
    <b>${esc(s.title ?? 'Untitled entry')}</b>
    <div class="sub"><a href="#/bounty/${encodeURIComponent(c.slug ?? '')}">${esc(c.title ?? c.slug ?? '')}</a>
    · ${esc(c.status ?? '')} · entered ${dateTime(s.entered_at)}${prize}${scoreText(s)}</div>
  </li>`;
}

export async function render(root, route) {
  const p = await getProfile(route.handle);
  const rec = p.record ?? {};
  const links = [];
  if (p.github_login) links.push(`<a href="https://github.com/${encodeURIComponent(p.github_login)}">GitHub @${esc(p.github_login)}</a>`);
  if (p.x) links.push(`<a href="https://x.com/${encodeURIComponent(typeof p.x === 'string' ? p.x : p.x.username ?? '')}">X</a>`);
  if (p.discord?.url) links.push(`<a href="${esc(p.discord.url)}">Discord ${esc(p.discord.username ?? '')}</a>`);
  if (p.wallet?.explorer_url) links.push(`<a href="${esc(p.wallet.explorer_url)}">Wallet ${esc((p.wallet.address ?? '').slice(0, 8))}…</a>`);
  const pic = p.image ?? p.avatar;
  const avatar = pic
    ? `<img class="big" crossorigin="anonymous" src="${esc(imgUrl(pic))}" alt="">`
    : '<span class="big avatar" aria-hidden="true"></span>';

  root.innerHTML = `<p class="crumbs"><a href="#/">← All bounties</a></p>
    <div class="profile-head">${avatar}<div>
      <h1>${esc(p.display_name ?? p.handle)}</h1>
      <div class="joined">@${esc(p.handle)} · joined ${dateTime(p.joined_at)}</div>
    </div></div>
    ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
    ${links.length ? `<div class="plinks">${links.join('')}</div>` : ''}
    <div class="factgrid">
      <div class="fact"><b>${whole(rec.competitions_entered)}</b><span>bounties entered</span></div>
      <div class="fact"><b>${whole(rec.competitions_placed)}</b><span>placed</span></div>
      <div class="fact"><b>${whole(rec.competitions_won)}</b><span>won</span></div>
      <div class="fact"><b>${whole(rec.podium_finishes)}</b><span>podiums</span></div>
      <div class="fact"><b>${rec.best_placement != null ? `#${rec.best_placement}` : '—'}</b><span>best placement</span></div>
      <div class="fact"><b>${money(rec.prize_usd)}</b><span>prizes won</span></div>
    </div>
    <h2>Entries (${(p.solutions ?? []).length})</h2>
    ${(p.solutions ?? []).length
      ? `<ul class="solutions">${p.solutions.map(solution).join('')}</ul>`
      : '<p class="result-note">No entries yet.</p>'}`;
  return `@${p.handle}`;
}
