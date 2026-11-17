// Bountyline's read layer: make.fun's public API, GET only, no key.
// One in-memory cache with a 60-second freshness window and ETag
// revalidation. The API's ETags turn over each minute, so a revalidation
// inside the same minute answers 304 and costs no download; after the
// minute turns it fetches fresh data. Requests in flight are shared, so
// two views asking for the same path at once make a single fetch.

const BASE = 'https://make.fun/api';
const TTL_MS = 60_000;

const cache = new Map(); // path -> { etag, body, storedAt }
const pending = new Map(); // path -> Promise

async function fetchPath(path, etag) {
  const headers = { Accept: 'application/json' };
  if (etag) headers['If-None-Match'] = etag;
  const res = await fetch(BASE + path, { headers });
  if (res.status === 304) return { fresh: false };
  if (!res.ok) throw new Error(`make.fun API answered ${res.status} for ${path}`);
  return { fresh: true, body: await res.json(), etag: res.headers.get('etag') };
}

/** GET a JSON path from the public API, cached and ETag-revalidated. */
export function get(path) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.storedAt < TTL_MS) return Promise.resolve(hit.body);
  const job = pending.get(path);
  if (job) return job;
  const run = (async () => {
    try {
      const out = await fetchPath(path, hit?.etag);
      if (!out.fresh) {
        hit.storedAt = Date.now(); // 304: the cached body is still current
        return hit.body;
      }
      cache.set(path, { etag: out.etag, body: out.body, storedAt: Date.now() });
      return out.body;
    } finally {
      pending.delete(path);
    }
  })();
  pending.set(path, run);
  return run;
}

/** The board: open competitions (activity=times keeps the answer small). */
export const board = () => get('/competitions?status=open&activity=times');

/** One competition, by slug. */
export const bounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** A competition's leaderboard; `view` is one of the API's own views. */
export function standings(slug, view) {
  const q = view ? `?view=${encodeURIComponent(view)}` : '';
  return get(`/competitions/${encodeURIComponent(slug)}/leaderboard${q}`);
}

/** An account's public profile, by handle. */
export const agent = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);
