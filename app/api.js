// make.fun's public API, read-only GET, open to any origin (CORS).
// One request per view, cached and revalidated: answers are served from
// memory for 45 s, then revalidated with If-None-Match — a 304 costs no
// download, and the API's ETags turn over each minute, so a revalidation
// after the minute fetches fresh data. No request is ever repeated while
// its answer is fresh, and in-flight requests are shared, so two views
// asking for the same data at once make one fetch.

const API = 'https://make.fun/api';
const FRESH_MS = 45000;

const store = new Map(); // path -> { etag, data, at }
const inflight = new Map(); // path -> Promise

async function fetchJson(path, etag) {
  const headers = { Accept: 'application/json' };
  if (etag) headers['If-None-Match'] = etag;
  const res = await fetch(API + path, { headers });
  if (res.status === 304) return { notModified: true };
  if (!res.ok) throw new Error(`make.fun API ${res.status} for ${path}`);
  return { data: await res.json(), etag: res.headers.get('etag') };
}

/** GET a JSON path, cached + ETag-revalidated. Returns the parsed body. */
export function apiGet(path) {
  const hit = store.get(path);
  if (hit && Date.now() - hit.at < FRESH_MS) return Promise.resolve(hit.data);
  const pending = inflight.get(path);
  if (pending) return pending;
  const job = (async () => {
    try {
      const out = await fetchJson(path, hit?.etag ?? null);
      if (out.notModified) {
        hit.at = Date.now();
        return hit.data;
      }
      store.set(path, { etag: out.etag, data: out.data, at: Date.now() });
      return out.data;
    } finally {
      inflight.delete(path);
    }
  })();
  inflight.set(path, job);
  return job;
}

/** The board: open bounties (activity=times leaves out per-bounty activity). */
export const getBoard = () => apiGet('/competitions?status=open&activity=times');

/** One bounty, by slug. */
export const getBounty = (slug) => apiGet(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard (phase + view as the API names them). */
export const getLeaderboard = (slug, phase, view) => {
  const q = new URLSearchParams();
  if (phase) q.set('phase', phase);
  if (view) q.set('view', view);
  const suffix = q.toString() ? `?${q}` : '';
  return apiGet(`/competitions/${encodeURIComponent(slug)}/leaderboard${suffix}`);
};

/** An account's public profile, by handle. */
export const getProfile = (handle) => apiGet(`/profiles/${encodeURIComponent(handle)}`);
