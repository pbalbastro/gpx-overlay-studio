// Street-map backgrounds for the MAP templates. The map is OpenStreetMap data from
// OpenFreeMap (free vector tiles, no API key), drawn by MapLibre GL with colors
// adjusted toward the Strava app's map, then copied onto the overlay canvas.
//
// Templates draw synchronously, but a map takes a moment to render. So drawMap()
// shows a plain land color and queues the render the first time it sees a frame;
// when the render finishes OV.onMapUpdate() is called so the app can repaint, and
// exports wait for OV.mapSettled() first. MapLibre itself is only loaded the first
// time a map is needed.
window.OV = window.OV || {};

(function (OV) {
  const LIB = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.js';
  const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
  const ATTRIBUTION = '© OpenFreeMap © OpenMapTiles © OpenStreetMap';
  const LAND = '#F1F0ED';
  // Device px per map px on a 1080px-wide canvas, like a phone screenshot, so
  // street labels come out a readable size. Maps are always rendered at the
  // 1080px reference size, so thumbnails and exports show the same map.
  const DENSITY = 2.5;

  // ---------- Strava-like colors ----------

  const COLORS = {
    background: LAND,
    residential: '#ECEBE7',
    park: '#C3E2B2',
    wood: '#ADD79B',
    grass: '#CDE7BF',
    water: '#A3D0F2',
    boundary: '#B9AEDB',
    road: '#FFFFFF',
    casing: '#D5D4D0',
    label: '#5D5D66',
  };
  const HIDE = /^(poi_|highway-shield|road_shield|building|road_one_way|landuse_(pitch|track|hospital|school|cemetery)|aeroway)/;

  function stravaStyle(style) {
    style.layers = style.layers.filter((l) => !HIDE.test(l.id));
    for (const l of style.layers) {
      const p = (l.paint = l.paint || {});
      const id = l.id;
      if (l.type === 'background') p['background-color'] = COLORS.background;
      else if (id === 'landuse_residential') p['fill-color'] = COLORS.residential;
      else if (id === 'park') { p['fill-color'] = COLORS.park; p['fill-opacity'] = 1; }
      else if (id === 'park_outline') l.layout = { ...l.layout, visibility: 'none' };
      else if (id === 'landcover_wood') { p['fill-color'] = COLORS.wood; p['fill-opacity'] = 1; }
      else if (id === 'landcover_grass') { p['fill-color'] = COLORS.grass; p['fill-opacity'] = 1; }
      else if (id === 'water') p['fill-color'] = COLORS.water;
      else if (/^waterway/.test(id) && l.type === 'line') p['line-color'] = COLORS.water;
      else if (/^boundary/.test(id)) p['line-color'] = COLORS.boundary;
      else if (/^(road|bridge|tunnel)_/.test(id) && l.type === 'line' && !/rail|path|pedestrian/.test(id)) {
        p['line-color'] = /casing/.test(id) ? COLORS.casing : COLORS.road;
      } else if (l.type === 'symbol') {
        if (p['text-color'] !== undefined || (l.layout && l.layout['text-field'])) {
          p['text-color'] = COLORS.label;
          p['text-halo-color'] = '#FFFFFF';
          p['text-halo-width'] = 1.4;
        }
        if (l.layout && l.layout['icon-image']) l.layout = { ...l.layout, 'icon-image': '' };
      }
    }
    return style;
  }

  // ---------- one hidden MapLibre map, reused for every render ----------

  let mapReady = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = () => reject(new Error(`Could not load ${src}`));
      document.head.appendChild(el);
    });
  }

  function ensureMap() {
    if (mapReady) return mapReady;
    mapReady = (async () => {
      if (!window.maplibregl) await loadScript(LIB);
      const style = stravaStyle(await (await fetch(STYLE)).json());
      const box = document.createElement('div');
      // Off screen but not display:none, so WebGL still renders.
      box.style.cssText = 'position:fixed;left:-20000px;top:0;width:400px;height:400px;pointer-events:none;';
      document.body.appendChild(box);
      const map = new window.maplibregl.Map({
        container: box,
        style,
        interactive: false,
        attributionControl: false,
        fadeDuration: 0,
        preserveDrawingBuffer: true,
        pixelRatio: DENSITY,
      });
      await new Promise((resolve, reject) => {
        map.once('load', resolve);
        map.once('error', (e) => reject(e.error || e));
      });
      return { map, box };
    })();
    // Failures are reported per job; forget them so a later render can retry.
    mapReady.catch(() => { mapReady = null; });
    return mapReady;
  }

  // ---------- render queue ----------

  const jobs = new Map(); // key -> { canvas, ready, failed, promise }, oldest first
  // Each render is up to 1080x1920 px (~8 MB), so keep only the most recent ones.
  const MAX_JOBS = 12;
  let queue = Promise.resolve();

  function mapJob(key, spec) {
    let job = jobs.get(key);
    if (job) {
      jobs.delete(key); // move to the newest end
      jobs.set(key, job);
      return job;
    }
    for (const [k, j] of jobs) {
      if (jobs.size < MAX_JOBS) break;
      if (!j.ready && !j.failed) continue; // still rendering
      if (j.canvas) j.canvas.width = 0; // release the pixels now, not at GC
      jobs.delete(k);
    }
    job = { ready: false, failed: false };
    job.promise = queue = queue.then(() => renderMap(spec)).then(
      (canvas) => { job.canvas = canvas; job.ready = true; },
      (e) => { job.failed = true; console.warn('map render failed', e); },
    ).then(() => { if (OV.onMapUpdate) OV.onMapUpdate(); });
    jobs.set(key, job);
    return job;
  }

  // spec: frame size in 1080-reference px, route scale (px per projected unit) and
  // the frame center in projected coords (x = lon radians, y = -ln tan(pi/4 + lat/2)).
  async function renderMap({ w, h, sc, cx, cy }) {
    const { map, box } = await ensureMap();
    const cssW = Math.max(1, Math.round(w / DENSITY));
    const ratio = w / cssW;
    box.style.width = `${cssW}px`;
    box.style.height = `${Math.max(1, Math.round(h / ratio))}px`;
    map.setPixelRatio(ratio);
    map.resize();
    // MapLibre's world is 512 * 2^zoom css px around; ours is 2*pi*sc device px.
    const zoom = Math.log2((2 * Math.PI * sc) / ratio / 512);
    const lat = (2 * Math.atan(Math.exp(-cy)) - Math.PI / 2) * 180 / Math.PI;
    map.jumpTo({ center: [cx * 180 / Math.PI, lat], zoom });
    await new Promise((resolve) => {
      const done = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => { map.off('idle', done); resolve(); }, 20000);
      map.once('idle', done);
      map.triggerRepaint();
    });
    const src = map.getCanvas();
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    out.getContext('2d').drawImage(src, 0, 0);
    return out;
  }

  const mapPending = () => [...jobs.values()].some((j) => !j.ready && !j.failed);
  const mapSettled = () => Promise.all([...jobs.values()].map((j) => j.promise));

  // ---------- drawing ----------

  const routeIds = new WeakMap();
  let nextRouteId = 1;
  const routeId = (r) => routeIds.get(r) || (routeIds.set(r, nextRouteId), nextRouteId++);

  // Fills `frame` with the street map, fits the route into `o.inner` (default: the
  // frame inset by 12%) and draws it on top, Strava style. `o.radius` rounds the
  // frame's corners; `o.corners` picks which ones ('all' | 'top' | 'bottom').
  function drawMap(ctx, route, frame, o = {}) {
    const s = ctx.canvas.width / 1080;
    const inset = Math.min(frame.w, frame.h) * 0.12;
    const inner = o.inner || { x: frame.x + inset, y: frame.y + inset, w: frame.w - 2 * inset, h: frame.h - 2 * inset };
    const hasRoute = route && route.length > 1;

    ctx.save();
    ctx.shadowColor = 'transparent';
    clipFrame(ctx, frame, o.radius || 0, o.corners || 'all');
    ctx.fillStyle = LAND;
    ctx.fillRect(frame.x, frame.y, frame.w, frame.h);

    if (hasRoute) {
      const view = OV.routeView(route, inner);
      // A thumbnail and the full-size paint of the same template differ only by
      // rounding, so snap the render to a coarse grid (scale to 4 digits, center to
      // half a pixel) and they share one render. The image is placed from its own
      // spec, so it still lines up with the route; 2px of margin covers the snap.
      const sc = +(view.sc / s).toPrecision(4);
      const snap = (v) => Math.round(v * sc * 2) / (sc * 2);
      const spec = {
        w: Math.round(frame.w / s) + 2,
        h: Math.round(frame.h / s) + 2,
        sc,
        cx: snap((frame.x + frame.w / 2 - view.ox) / view.sc),
        cy: snap((frame.y + frame.h / 2 - view.oy) / view.sc),
      };
      const job = mapJob([routeId(route), spec.w, spec.h, spec.sc, spec.cx, spec.cy].join('|'), spec);
      if (job.ready) {
        const f = view.sc / sc; // this canvas's px per map image px
        const w = spec.w * f, h = spec.h * f;
        ctx.drawImage(job.canvas, spec.cx * view.sc + view.ox - w / 2, spec.cy * view.sc + view.oy - h / 2, w, h);
      }

      const lw = (o.width || 9) * s;
      const pts = OV.drawRoute(ctx, route, inner, { width: lw, view, color: OV.ORANGE });
      if (pts.length > 1) markers(ctx, pts[0], pts[pts.length - 1], lw);
    }

    ctx.font = `400 ${Math.max(8, 14 * s)}px "Inter", "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(60,60,70,0.7)';
    ctx.fillText(ATTRIBUTION, frame.x + frame.w - 14 * s - (o.radius || 0) * 0.3, frame.y + frame.h - 12 * s);
    ctx.restore();
  }

  function clipFrame(ctx, f, r, corners) {
    const top = corners !== 'bottom' ? r : 0;
    const bottom = corners !== 'top' ? r : 0;
    ctx.beginPath();
    ctx.moveTo(f.x + top, f.y);
    ctx.arcTo(f.x + f.w, f.y, f.x + f.w, f.y + f.h, top);
    ctx.arcTo(f.x + f.w, f.y + f.h, f.x, f.y + f.h, bottom);
    ctx.arcTo(f.x, f.y + f.h, f.x, f.y, bottom);
    ctx.arcTo(f.x, f.y, f.x + f.w, f.y, top);
    ctx.closePath();
    ctx.clip();
  }

  // Strava's markers: a green start dot and a checkered finish dot, both ringed in white.
  function markers(ctx, a, b, lw) {
    const r = lw * 1.25, ring = Math.max(1, lw * 0.4);
    const dot = (p, fill) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + ring, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      fill();
    };
    dot(b, () => {
      ctx.save();
      ctx.clip();
      const q = r / 2;
      for (let i = -2; i < 2; i++) {
        for (let j = -2; j < 2; j++) {
          ctx.fillStyle = (i + j) % 2 ? '#FFFFFF' : '#242428';
          ctx.fillRect(b.x + i * q, b.y + j * q, q, q);
        }
      }
      ctx.restore();
    });
    dot(a, () => { ctx.fillStyle = '#1FAA59'; ctx.fill(); });
  }

  Object.assign(OV, { drawMap, mapSettled, mapPending, MAP_TEXT: '#242428', MAP_MUTED: '#6D6D78' });
})(window.OV);
