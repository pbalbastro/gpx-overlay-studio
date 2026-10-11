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
  // Subresource Integrity (cdnjs's published hash): the browser refuses to run the
  // script if the CDN ever serves anything else. Update it together with LIB.
  const LIB_SRI = 'sha512-x8Bt/82VRs91xVTqHDpQ1t8c4qit3QCRbo9BVqnUsyw5yKqzvL4BAgcz7R34BDCiCwx9ypXPTnxPaNnazQz1ag==';
  const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
  const ATTRIBUTION = '\u00A9 OpenFreeMap \u00A9 OpenMapTiles \u00A9 OpenStreetMap';
  // Elevation for the 3D maps: open Terrarium tiles (Mapzen terrain on AWS Open Data).
  const TERRAIN = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
  // Satellite imagery for the 3D maps: Esri World Imagery (no key; attribution required).
  const SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const ATTRIBUTION_3D = 'Imagery \u00A9 Esri, Maxar, Earthstar Geographics \u00B7 \u00A9 OpenStreetMap \u00B7 Terrain: Mapzen, AWS';
  const PITCH = 60, BEARING = -20; // tilted, turned slightly so it reads as 3D
  const EXAGGERATION = 1.8; // hills read better a little taller than life
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

  // Terrain source, a satellite layer (hidden until a 3D render) and a hazy sky for
  // tilted views. Terrain and satellite tiles only load while a 3D render is on.
  function with3d(style) {
    style.sources.terrain = { type: 'raster-dem', tiles: [TERRAIN], encoding: 'terrarium', tileSize: 256, maxzoom: 15 };
    style.sources.satellite = { type: 'raster', tiles: [SATELLITE], tileSize: 256, maxzoom: 19 };
    style.layers.splice(1, 0, { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } });
    style.sky = {
      'sky-color': '#BFD8EE',
      'horizon-color': '#E4ECF2',
      'fog-color': '#C9D5DF',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.9,
    };
    return style;
  }

  // ---------- one hidden MapLibre map, reused for every render ----------

  let mapReady = null;

  function loadScript(src, integrity) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.integrity = integrity;
      el.crossOrigin = 'anonymous';
      el.onload = resolve;
      el.onerror = () => reject(new Error(`Could not load ${src}`));
      document.head.appendChild(el);
    });
  }

  function ensureMap() {
    if (mapReady) return mapReady;
    mapReady = (async () => {
      if (!window.maplibregl) await loadScript(LIB, LIB_SRI);
      const style = with3d(stravaStyle(await (await fetch(STYLE)).json()));
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
  function renderMap(spec) {
    return spec.three ? render3d(spec) : renderFlat(spec);
  }

  // Sizes the hidden map to w x h device px (1080-reference) at about DENSITY;
  // returns the exact device px per css px used.
  function sizeMap(map, box, w, h) {
    const cssW = Math.max(1, Math.round(w / DENSITY));
    const ratio = w / cssW;
    box.style.width = `${cssW}px`;
    box.style.height = `${Math.max(1, Math.round(h / ratio))}px`;
    map.setPixelRatio(ratio);
    map.resize();
    return ratio;
  }

  function idle(map) {
    return new Promise((resolve) => {
      const done = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => { map.off('idle', done); resolve(); }, 20000);
      map.once('idle', done);
      map.triggerRepaint();
    });
  }

  function snapshot(map) {
    const src = map.getCanvas();
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    out.getContext('2d').drawImage(src, 0, 0);
    return out;
  }

  // 3D satellite mode, like Strava's satellite view: terrain on, imagery instead of
  // the drawn map (roads, land, water hidden), labels in white with a dark halo.
  // The flat style is restored for flat renders.
  let satOn = false;
  let flatLayers = null; // [id, type, paint values to restore] for layers shown on the flat map
  function set3d(map, on) {
    map.setTerrain(on ? { source: 'terrain', exaggeration: EXAGGERATION } : null);
    if (on === satOn) return;
    satOn = on;
    if (!flatLayers) {
      flatLayers = map.getStyle().layers
        .filter((l) => l.id !== 'satellite' && l.type !== 'background' && (l.layout || {}).visibility !== 'none')
        .map((l) => [l.id, l.type, l.type === 'symbol'
          ? { 'text-color': map.getPaintProperty(l.id, 'text-color'), 'text-halo-color': map.getPaintProperty(l.id, 'text-halo-color') }
          : null]);
    }
    map.setLayoutProperty('satellite', 'visibility', on ? 'visible' : 'none');
    for (const [id, type, paint] of flatLayers) {
      if (type !== 'symbol') {
        map.setLayoutProperty(id, 'visibility', on ? 'none' : 'visible');
        continue;
      }
      map.setPaintProperty(id, 'text-color', on ? '#FFFFFF' : paint['text-color']);
      map.setPaintProperty(id, 'text-halo-color', on ? 'rgba(0,0,0,0.7)' : paint['text-halo-color']);
    }
  }

  async function renderFlat({ w, h, sc, cx, cy }) {
    const { map, box } = await ensureMap();
    const ratio = sizeMap(map, box, w, h);
    set3d(map, false);
    // MapLibre's world is 512 * 2^zoom css px around; ours is 2*pi*sc device px.
    const zoom = Math.log2((2 * Math.PI * sc) / ratio / 512);
    const lat = (2 * Math.atan(Math.exp(-cy)) - Math.PI / 2) * 180 / Math.PI;
    map.jumpTo({ center: [cx * 180 / Math.PI, lat], zoom, pitch: 0, bearing: 0 });
    await idle(map);
    return snapshot(map);
  }

  // Tilted map with terrain. A tilted camera has no closed-form fit, so it is nudged
  // until the projected route fills `inner` (frame px): measure where the route lands,
  // rescale and recenter, repeat; again once the terrain has loaded, since elevation
  // moves the route on screen. Returns the image with the route projected onto it
  // (device px, terrain included) as `routePts`, for the overlay to draw.
  async function render3d({ w, h, inner, route }) {
    const { map, box } = await ensureMap();
    const ratio = sizeMap(map, box, w, h);
    set3d(map, true);
    const step = Math.max(1, Math.floor(route.length / 600));
    const ll = route.filter((_, i) => i % step === 0).map((p) => [p.lon, p.lat]);
    const ib = { x: inner.x / ratio, y: inner.y / ratio, w: inner.w / ratio, h: inner.h / ratio };
    const lons = ll.map((p) => p[0]), lats = ll.map((p) => p[1]);
    const cam = map.cameraForBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]]) || {};
    map.jumpTo({ center: cam.center || ll[0], zoom: cam.zoom || 12, pitch: PITCH, bearing: BEARING });

    const fit = () => {
      const { clientWidth: cw, clientHeight: ch } = map.getContainer();
      for (let i = 0; i < 6; i++) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of ll) {
          const q = map.project(p);
          if (q.x < x0) x0 = q.x;
          if (q.x > x1) x1 = q.x;
          if (q.y < y0) y0 = q.y;
          if (q.y > y1) y1 = q.y;
        }
        const k = Math.min(ib.w / Math.max(1, x1 - x0), ib.h / Math.max(1, y1 - y0));
        const dx = (x0 + x1) / 2 - (ib.x + ib.w / 2), dy = (y0 + y1) / 2 - (ib.y + ib.h / 2);
        const center = map.unproject([cw / 2 + dx, ch / 2 + dy]);
        map.jumpTo({ center, zoom: Math.min(18, map.getZoom() + Math.log2(k)) });
      }
    };
    fit();
    await idle(map);
    fit();
    await idle(map);

    const out = snapshot(map);
    const all = route.length > 2000 ? route.filter((_, i) => i % Math.ceil(route.length / 2000) === 0) : route;
    out.routePts = all.concat([route[route.length - 1]]).map((p) => {
      const q = map.project([p.lon, p.lat]);
      return { x: q.x * ratio, y: q.y * ratio };
    });
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
  // `o.three` draws a tilted 3D satellite map with terrain instead of the flat one.
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

    if (hasRoute && o.three) {
      // Snap to 4 reference px so a thumbnail and the full-size paint share a render.
      const q = (v) => Math.round(v / s / 4) * 4;
      const spec = {
        three: true,
        route,
        w: q(frame.w),
        h: q(frame.h),
        inner: { x: q(inner.x - frame.x), y: q(inner.y - frame.y), w: q(inner.w), h: q(inner.h) },
      };
      const { inner: ii } = spec;
      const job = mapJob(['3d', routeId(route), spec.w, spec.h, ii.x, ii.y, ii.w, ii.h].join('|'), spec);
      if (job.ready) {
        const img = job.canvas, fx = frame.w / img.width, fy = frame.h / img.height;
        ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h);
        const pts = img.routePts.map((p) => ({ x: frame.x + p.x * fx, y: frame.y + p.y * fy }));
        const lw = (o.width || 9) * s;
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = OV.ORANGE;
        ctx.lineWidth = lw;
        ctx.stroke();
        markers(ctx, pts[0], pts[pts.length - 1], lw);
      }
    } else if (hasRoute) {
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
    ctx.fillStyle = o.three ? 'rgba(255,255,255,0.8)' : 'rgba(60,60,70,0.7)';
    ctx.fillText(o.three ? ATTRIBUTION_3D : ATTRIBUTION, frame.x + frame.w - 14 * s - (o.radius || 0) * 0.3, frame.y + frame.h - 12 * s);
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
