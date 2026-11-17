// Bountyline's formatting helpers: safe HTML, money, dates, countdowns
// and a small Markdown subset for bounty descriptions. No dependencies.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape text for safe insertion into HTML. */
export function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const grouped = new Intl.NumberFormat('en-US');

/** A dollar amount: "$1,325", or "$0.50" when it has cents. */
export function usd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? usdWhole.format(n) : usdCents.format(n);
}

/** An integer with grouping: 13650 -> "13,650". */
export function int(value) {
  const n = Number(value);
  return Number.isFinite(n) ? grouped.format(Math.round(n)) : '—';
}

/** A micro-unit rate (0..1,000,000) as a percent: 887222 -> "88.72%". */
export function microPct(micro) {
  const n = Number(micro);
  return Number.isFinite(n) ? `${(n / 10000).toFixed(2)}%` : '—';
}

/** A byte count as "617 KB" or "2.40 MB". */
export function humanBytes(n) {
  n = Number(n);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}

const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
});

/** An ISO date as "Nov 17, 2026, 12:30 PM UTC". */
export function dateStr(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

/** Time left until a deadline: "3d 2h", "4h 12m", "37m", "9s", "ended". */
export function countdown(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return '—';
  if (ms <= 0) return 'ended';
  const d = Math.floor(ms / 86400000);
  const hh = Math.floor((ms % 86400000) / 3600000);
  const mm = Math.floor((ms % 3600000) / 60000);
  const ss = Math.floor((ms % 60000) / 1000);
  if (d > 0) return `${d}d ${hh}h`;
  if (hh > 0) return `${hh}h ${mm}m`;
  if (mm > 0) return `${mm}m ${ss}s`;
  return `${Math.max(ss, 1)}s`;
}

/** An API image path ("/api/...") as an absolute make.fun URL. */
export function imgSrc(path) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return `https://make.fun${path.startsWith('/') ? '' : '/'}${path}`;
}

/** A one-line excerpt: whitespace folded, capped at n characters. */
export function excerpt(text, n = 180) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** Inline Markdown: **bold**, `code`, [links](https://…). Text is escaped first. */
function inlineMd(line) {
  return h(line)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
}

/**
 * Render a small Markdown subset to HTML: fenced code blocks, headings,
 * unordered and ordered lists, blockquotes and paragraphs. Raw HTML from
 * the API never reaches the page: every line is escaped before markup.
 */
export function mdLite(src) {
  const lines = String(src ?? '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const buf = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i += 1;
      out.push(`<pre><code>${h(buf.join('\n'))}</code></pre>`);
      continue;
    }
    const head = line.match(/^(#{1,3})\s+(.+)$/);
    if (head) {
      out.push(`<h${head[1].length + 2}>${inlineMd(head[2])}</h${head[1].length + 2}>`);
      i += 1;
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      out.push(`<blockquote>${inlineMd(quote[1])}</blockquote>`);
      i += 1;
      continue;
    }
    const ul = line.match(/^[-*]\s+(.+)$/);
    const ol = line.match(/^\d+[.)]\s+(.+)$/);
    if (ul || ol) {
      const tag = ul ? 'ul' : 'ol';
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(tag === 'ul' ? /^[-*]\s+(.+)$/ : /^\d+[.)]\s+(.+)$/);
        if (!m) break;
        items.push(`<li>${inlineMd(m[1])}</li>`);
        i += 1;
      }
      out.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    out.push(`<p>${inlineMd(line)}</p>`);
    i += 1;
  }
  return out.join('');
}
