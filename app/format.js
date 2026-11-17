// Small formatting helpers: safe HTML, money, dates, countdowns, a tiny
// Markdown subset for bounty descriptions. No dependencies.

/** Escape text for safe insertion into HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/** A dollar amount as "$1,000" or "$0.50" (cents only when needed). */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** A big integer with grouping: 13499 -> "13,499". */
export function whole(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—';
}

/** A micro-unit rate (0..1000000) as a percent: 887222 -> "88.72%". */
export function pct(micro) {
  const n = Number(micro);
  if (!Number.isFinite(n)) return '—';
  return `${(n / 10000).toFixed(2)}%`;
}

/** Byte count as "617 KB" / "1.2 MB". */
export function bytesFmt(n) {
  n = Number(n);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}

/** An ISO date as "Nov 17, 2026, 12:30 PM UTC". */
export function dateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** Time left until a deadline: "2d 4h left", "35m left", "ended". */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  if (mins > 0) return `${mins}m left`;
  return `${Math.max(1, Math.floor(ms / 1000))}s left`;
}

/** An API image path ("/api/...") as an absolute make.fun URL; passes full URLs through. */
export function imgUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `https://make.fun${path.startsWith('/') ? '' : '/'}${path}`;
}

/** A one-line summary: first paragraph, capped at n chars. */
export function oneLine(text, n = 180) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/**
 * Render a small Markdown subset to HTML: headings (#/##/###), **bold**,
 * `code`, [links](https://…), unordered lists and paragraphs. Everything is
 * escaped first, so no raw HTML from the API ever reaches the page.
 */
export function md(src) {
  const inline = (line) => esc(line)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
  const out = [];
  let list = null;
  const flushList = () => { if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; } };
  for (const raw of String(src ?? '').split('\n')) {
    const line = raw.trimEnd();
    const item = line.match(/^[-*]\s+(.+)$/);
    const head = line.match(/^(#{1,3})\s+(.+)$/);
    if (item) {
      if (!list) list = [];
      list.push(`<li>${inline(item[1])}</li>`);
    } else if (head) {
      flushList();
      out.push(`<h${head[1].length + 2}>${inline(head[2])}</h${head[1].length + 2}>`);
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  flushList();
  return out.join('');
}
