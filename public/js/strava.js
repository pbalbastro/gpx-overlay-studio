// "Connect with Strava": talks to the Worker's /api/strava/* routes and turns a
// Strava activity into the same { meta, stats } a GPX upload produces, using
// Strava's own totals so overlays match the Strava app.
window.OV = window.OV || {};

(function (OV) {
  const $ = (id) => document.getElementById(id);
  const PER_PAGE = 30;

  // Off for now: Strava deactivates API apps whose owner has no Strava subscription
  // (Developer Program Standard Tier). Set to true after subscribing and reactivating
  // the app at strava.com/settings/api, then redeploy. GPX upload works either way.
  const STRAVA_ENABLED = false;

  async function api(path, opts) {
    const res = await fetch(`/api/strava${path}`, { credentials: 'same-origin', ...opts });
    let body = null;
    try { body = await res.json(); } catch (e) { /* not JSON: no Worker behind this host */ }
    if (!res.ok || !body) {
      const err = new Error((body && body.error) || 'Could not reach Strava.');
      err.status = res.status;
      throw err;
    }
    return body;
  }

  // Streams -> track points (same shape as parseGPX), then Strava's summary totals
  // replace the GPS-derived ones.
  function toActivity({ summary: s, streams }) {
    const t0 = Date.parse(s.start);
    const data = (k) => (streams && streams[k] && streams[k].data) || null;
    const ll = data('latlng') || [];
    const at = (k, i) => { const d = data(k); return d && d[i] != null ? d[i] : null; };
    const points = ll.map(([lat, lon], i) => ({
      lat,
      lon,
      ele: at('altitude', i),
      time: data('time') ? t0 + at('time', i) * 1000 : null,
      hr: at('heartrate', i),
      cad: at('cadence', i),
      power: at('watts', i),
    }));

    let st;
    if (points.length >= 2) {
      st = OV.computeStats(points);
      // Strava's own cumulative distance, so splits line up with the app.
      const dist = data('distance');
      if (dist && dist.length === points.length) st.cum = dist.slice();
    } else {
      // Manual or indoor activity: no GPS, so stats only (templates skip the route).
      st = { points: [], profile: [], cum: [], mcum: [], hasEle: false, avgHr: null, avgCad: null, avgPower: null };
    }
    Object.assign(st, {
      distance: s.distance,
      movingTime: s.movingTime || st.movingTime || null,
      elapsed: s.elapsedTime || st.elapsed || null,
      hasTime: !!s.movingTime || !!st.hasTime,
      start: isFinite(t0) ? t0 : st.start,
      elevGain: s.elevGain != null ? s.elevGain : st.elevGain,
      avgHr: s.avgHr || st.avgHr,
      avgCad: s.avgCadence || st.avgCad,
      avgPower: s.avgWatts || st.avgPower,
    });
    return {
      meta: { name: s.name, type: s.type, points },
      stats: st,
      calories: s.calories || null,
    };
  }

  // ---------- panel UI ----------

  function initStrava(hooks) {
    const box = $('stravaBox');
    if (!STRAVA_ENABLED) return; // panel stays hidden; GPX upload only
    let page = 1;

    const showConnect = () => {
      $('stravaConnect').hidden = false;
      $('stravaConnected').hidden = true;
    };

    const formatItem = (a) => {
      const mi = $('units').value === 'mi';
      const dist = mi ? `${(a.distance / 1609.344).toFixed(2)} mi` : `${(a.distance / 1000).toFixed(2)} km`;
      const date = new Date(a.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `<strong>${escapeHtml(a.name)}</strong><span>${escapeHtml(a.type)} · ${date} · ${dist}</span>`;
    };

    async function loadPage() {
      const more = $('stravaMore');
      more.disabled = true;
      more.textContent = 'Loading…';
      try {
        const list = await api(`/activities?page=${page}`);
        const ul = $('stravaList');
        if (page === 1) ul.innerHTML = list.length ? '' : '<li class="strava-empty">No activities yet.</li>';
        for (const a of list) {
          const li = document.createElement('li');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'strava-item';
          btn.innerHTML = formatItem(a);
          btn.addEventListener('click', () => pick(a.id, btn));
          li.appendChild(btn);
          ul.appendChild(li);
        }
        more.hidden = list.length < PER_PAGE;
      } catch (e) {
        if (e.status === 401) showConnect();
        hooks.onError(e.message);
      } finally {
        more.disabled = false;
        more.textContent = 'Load more';
      }
    }

    async function pick(id, btn) {
      document.querySelectorAll('.strava-item').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active', 'loading');
      try {
        hooks.onActivity(toActivity(await api(`/activity/${id}`)));
      } catch (e) {
        btn.classList.remove('active');
        if (e.status === 401) showConnect();
        hooks.onError(e.message);
      } finally {
        btn.classList.remove('loading');
      }
    }

    $('stravaMore').addEventListener('click', () => { page += 1; loadPage(); });
    $('stravaLogout').addEventListener('click', async () => {
      try { await api('/logout', { method: 'POST' }); } catch (e) { /* cookie is cleared either way */ }
      $('stravaList').innerHTML = '';
      showConnect();
    });

    // Result of the OAuth round trip, passed back by the Worker as ?strava=...
    const params = new URLSearchParams(location.search);
    const result = params.get('strava');
    if (result) {
      if (result === 'denied') hooks.onError('Strava access was not granted, so activities can\'t be loaded.');
      if (result === 'error') {
        hooks.onError('Couldn\'t connect to Strava. While the app is limited to one athlete, only its owner can connect. Others can still upload a GPX file.');
      }
      params.delete('strava');
      history.replaceState(null, '', location.pathname + (params.toString() ? `?${params}` : ''));
    }

    // Only show the Strava panel when the Worker is there (not on file:// or a plain static host).
    api('/me').then((me) => {
      box.hidden = false;
      if (!me.connected) return showConnect();
      $('stravaConnect').hidden = true;
      $('stravaConnected').hidden = false;
      $('stravaName').textContent = (me.athlete && me.athlete.firstname) || 'connected';
      loadPage();
    }).catch(() => { box.hidden = true; });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  OV.initStrava = initStrava;
  OV.stravaToActivity = toActivity;
})(window.OV);
