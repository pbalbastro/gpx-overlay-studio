// Cloudflare Worker: serves the static site (public/) and a small Strava API proxy.
//
// The OAuth token exchange needs the client secret, so it can't run in the browser.
// Tokens live in an encrypted, HttpOnly cookie (AES-GCM with COOKIE_KEY), so no
// database is needed and the browser never sees them.
//
// Routes:
//   GET  /api/strava/login          -> redirect to Strava's authorize page
//   GET  /api/strava/callback       -> exchange code, set session cookie, back to /
//   GET  /api/strava/me             -> { connected, athlete }
//   GET  /api/strava/activities     -> recent activities (?page=1)
//   GET  /api/strava/activity/:id   -> { summary, streams }
//   POST /api/strava/logout         -> revoke access and clear the cookie

const STRAVA = 'https://www.strava.com';
const SESSION = 'strava_session';
const STATE = 'strava_state';
const SESSION_DAYS = 180;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/strava/')) return env.ASSETS.fetch(request);
    if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET || !env.COOKIE_KEY) {
      return json({ error: 'Strava is not configured on this server.' }, 503);
    }
    try {
      return await route(request, env, url);
    } catch (e) {
      console.log('worker error', e && e.stack);
      return json({ error: 'Something went wrong talking to Strava.' }, 502);
    }
  },
};

async function route(request, env, url) {
  const path = url.pathname.slice('/api/strava'.length);
  const method = request.method;

  if (path === '/login' && method === 'GET') return login(url, env);
  if (path === '/callback' && method === 'GET') return callback(request, url, env);
  if (path === '/logout' && method === 'POST') return logout(request, env);

  const session = await readSession(request, env);
  if (path === '/me' && method === 'GET') {
    return json({ connected: !!session, athlete: session ? session.athlete : null });
  }
  if (!session) return json({ error: 'Not connected to Strava.' }, 401);

  if (path === '/activities' && method === 'GET') {
    const page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1);
    return withStrava(request, env, session, async (api) => {
      const list = await api(`/athlete/activities?per_page=30&page=${page}`);
      return list.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.sport_type || a.type,
        start: a.start_date,
        distance: a.distance,
        movingTime: a.moving_time,
        hasMap: !!(a.map && a.map.summary_polyline),
      }));
    });
  }

  const m = path.match(/^\/activity\/(\d+)$/);
  if (m && method === 'GET') {
    return withStrava(request, env, session, async (api) => {
      const [a, streams] = await Promise.all([
        api(`/activities/${m[1]}`),
        api(`/activities/${m[1]}/streams?keys=latlng,time,altitude,distance,heartrate,cadence,watts&key_by_type=true`)
          .catch(() => ({})), // manual activities have no streams
      ]);
      return {
        summary: {
          id: a.id,
          name: a.name,
          type: a.sport_type || a.type,
          start: a.start_date,
          distance: a.distance,
          movingTime: a.moving_time,
          elapsedTime: a.elapsed_time,
          elevGain: a.total_elevation_gain,
          avgWatts: a.average_watts ?? null,
          calories: a.calories ?? null,
          avgHr: a.has_heartrate ? a.average_heartrate : null,
          avgCadence: a.average_cadence ?? null,
        },
        streams,
      };
    });
  }

  return json({ error: 'Not found.' }, 404);
}

// ---------- OAuth ----------

function login(url, env) {
  const state = randomId();
  const auth = new URL(`${STRAVA}/oauth/authorize`);
  auth.searchParams.set('client_id', env.STRAVA_CLIENT_ID);
  auth.searchParams.set('redirect_uri', `${url.origin}/api/strava/callback`);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('approval_prompt', 'auto');
  auth.searchParams.set('scope', 'read,activity:read_all');
  auth.searchParams.set('state', state);
  return redirect(auth.toString(), [cookie(STATE, state, 600)]);
}

async function callback(request, url, env) {
  const clearState = cookie(STATE, '', 0);
  const state = url.searchParams.get('state');
  if (!state || state !== getCookie(request, STATE)) return redirect('/?strava=error', [clearState]);
  if (url.searchParams.get('error')) return redirect('/?strava=denied', [clearState]);
  const scope = url.searchParams.get('scope') || '';
  if (!/activity:read/.test(scope)) return redirect('/?strava=denied', [clearState]);

  const res = await stravaFetch(`${STRAVA}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      code: url.searchParams.get('code'),
      grant_type: 'authorization_code',
    }),
  });
  // Apps limited to one athlete reject everyone else here.
  if (!res.ok) return redirect('/?strava=error', [clearState]);
  const t = await res.json();
  const session = {
    access: t.access_token,
    refresh: t.refresh_token,
    expiresAt: t.expires_at,
    athlete: t.athlete ? { id: t.athlete.id, firstname: t.athlete.firstname } : null,
  };
  return redirect('/?strava=connected', [clearState, await sessionCookie(session, env)]);
}

async function logout(request, env) {
  const session = await readSession(request, env);
  if (session) {
    // Best effort: also revoke the app's access on Strava's side.
    await stravaFetch(`${STRAVA}/oauth/deauthorize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access}` },
    }).catch(() => {});
  }
  return json({ connected: false }, 200, [cookie(SESSION, '', 0)]);
}

// Runs `fn` with an authenticated API helper, refreshing the token if it has
// expired and re-setting the cookie when it changes.
async function withStrava(request, env, session, fn) {
  let fresh = null;
  if (session.expiresAt - 60 < Date.now() / 1000) {
    const res = await stravaFetch(`${STRAVA}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.STRAVA_CLIENT_ID,
        client_secret: env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: session.refresh,
      }),
    });
    if (!res.ok) return json({ error: 'Strava session expired. Please connect again.' }, 401, [cookie(SESSION, '', 0)]);
    const t = await res.json();
    fresh = { ...session, access: t.access_token, refresh: t.refresh_token, expiresAt: t.expires_at };
    session = fresh;
  }

  const api = async (p) => {
    const res = await stravaFetch(`${STRAVA}/api/v3${p}`, {
      headers: { Authorization: `Bearer ${session.access}` },
    });
    if (res.ok) return res.json();
    // Keep Strava's own reason: it shows in the panel and in `npx wrangler tail`.
    const body = (await res.text().catch(() => '')).slice(0, 300);
    console.log('strava api', res.status, p.split('?')[0], body);
    const reason = stravaReason(body);
    if (res.status === 401) throw new HttpError(401, 'Strava access was revoked. Please connect again.');
    if (res.status === 429) throw new HttpError(429, 'Strava rate limit reached. Try again in a few minutes.');
    if (res.status === 404) throw new HttpError(404, 'Activity not found.');
    // Strava deactivates apps whose owner has no Strava subscription (Developer
    // Program Standard Tier): {"resource":"Application","field":"Status","code":"Inactive"}.
    if (res.status === 403 && /"Application"/.test(body) && /Inactive/i.test(body)) {
      throw new HttpError(403, 'This site\'s Strava connection is paused: Strava requires the app owner to have an ' +
        'active Strava subscription. Upload a GPX file instead for now.');
    }
    if (res.status === 403) {
      throw new HttpError(403, `Strava refused the request (403${reason ? `: ${reason}` : ''}). ` +
        'Try Disconnect, then Connect again and keep "View data about your activities" checked.');
    }
    throw new HttpError(502, `Strava returned an error (${res.status}${reason ? `: ${reason}` : ''}).`);
  };

  const cookies = fresh ? [await sessionCookie(fresh, env)] : [];
  try {
    return json(await fn(api), 200, cookies);
  } catch (e) {
    if (!(e instanceof HttpError)) throw e;
    if (e.status === 401) cookies.push(cookie(SESSION, '', 0));
    return json({ error: e.message }, e.status, cookies);
  }
}

// All calls to Strava identify the app; some API edges reject clients with no User-Agent.
function stravaFetch(url, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('User-Agent', 'GPX-Overlay-Studio/1.0 (+https://twilight-wind-1210.patrick-d-balbastro.workers.dev)');
  headers.set('Accept', 'application/json');
  return fetch(url, { ...init, headers });
}

// e.g. "Authorization Error (activity:read_permission missing)" from Strava's error JSON.
function stravaReason(body) {
  try {
    const j = JSON.parse(body);
    const e = j.errors && j.errors[0];
    const detail = e ? [e.field, e.code].filter(Boolean).join(' ') : '';
    return [j.message, detail && `(${detail})`].filter(Boolean).join(' ');
  } catch (err) {
    return body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------- encrypted session cookie ----------

async function sessionCookie(session, env) {
  return cookie(SESSION, await seal(session, env.COOKIE_KEY), SESSION_DAYS * 86400);
}

async function readSession(request, env) {
  const raw = getCookie(request, SESSION);
  if (!raw) return null;
  try {
    return await unseal(raw, env.COOKIE_KEY);
  } catch (e) {
    return null; // tampered, or the key changed
  }
}

async function aesKey(secret) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function seal(obj, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(secret), data));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return b64url(out);
}

async function unseal(str, secret) {
  const buf = fromB64url(str);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, await aesKey(secret), buf.slice(12));
  return JSON.parse(new TextDecoder().decode(pt));
}

// ---------- small helpers ----------

function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

function json(body, status = 200, cookies = []) {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(JSON.stringify(body), { status, headers });
}

function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers });
}

function randomId() {
  return b64url(crypto.getRandomValues(new Uint8Array(16)));
}

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
