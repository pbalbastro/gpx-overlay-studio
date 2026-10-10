// GPX parsing, activity stats and display formatting.
window.OV = window.OV || {};

(function (OV) {
  const toRad = (d) => (d * Math.PI) / 180;

  function haversine(a, b) {
    const R = 6371008.8;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function childText(el, tag) {
    const c = el && el.getElementsByTagName(tag)[0];
    return c ? c.textContent.trim() : '';
  }

  function parseGPX(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      throw new Error('This file is not valid GPX/XML.');
    }
    let nodes = doc.getElementsByTagName('trkpt');
    if (!nodes.length) nodes = doc.getElementsByTagName('rtept');

    const points = [];
    for (const n of nodes) {
      const lat = parseFloat(n.getAttribute('lat'));
      const lon = parseFloat(n.getAttribute('lon'));
      if (!isFinite(lat) || !isFinite(lon)) continue;
      const e = parseFloat(childText(n, 'ele'));
      const t = Date.parse(childText(n, 'time'));
      // Heart rate / cadence / power from track point extensions (<gpxtpx:hr>,
      // <gpxtpx:cad>, <power>). Zero power is kept: coasting counts toward the average.
      const ext = (tag, allowZero = false) => {
        const el = n.getElementsByTagNameNS('*', tag)[0];
        const v = el ? parseFloat(el.textContent) : NaN;
        return isFinite(v) && (v > 0 || (allowZero && v === 0)) ? v : null;
      };
      points.push({
        lat, lon, ele: isFinite(e) ? e : null, time: isFinite(t) ? t : null,
        hr: ext('hr'), cad: ext('cad'), power: ext('power', true),
      });
    }
    if (points.length < 2) throw new Error('No track points found in this GPX file.');

    const trk = doc.getElementsByTagName('trk')[0];
    const meta = doc.getElementsByTagName('metadata')[0];
    return {
      name: childText(trk, 'name') || childText(meta, 'name'),
      type: childText(trk, 'type'),
      points,
    };
  }

  function computeStats(points) {
    const cum = [0];
    const mcum = [0];
    let dist = 0;
    let moving = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const d = haversine(a, b);
      dist += d;
      if (a.time != null && b.time != null) {
        const dt = (b.time - a.time) / 1000;
        // Count only segments where the athlete was actually moving (>= 0.5 m/s).
        if (dt > 0 && d / dt >= 0.5) moving += dt;
      }
      cum.push(dist);
      mcum.push(moving);
    }

    const first = points[0];
    const last = points[points.length - 1];
    const hasTime = first.time != null && last.time != null && last.time > first.time;
    const elapsed = hasTime ? (last.time - first.time) / 1000 : null;
    if (hasTime && moving === 0) {
      // No usable moving segments: fall back to elapsed time.
      for (let i = 0; i < points.length; i++) {
        mcum[i] = points[i].time != null ? (points[i].time - first.time) / 1000 : 0;
      }
      moving = elapsed;
    }

    // Elevation: smooth, then accumulate climbs with a small hysteresis.
    const eles = points.map((p) => p.ele);
    const profile = [];
    points.forEach((p, i) => { if (p.ele != null) profile.push({ d: cum[i], e: p.ele }); });
    let elevGain = null;
    if (profile.length > 1) {
      const raw = profile.map((p) => p.e);
      const sm = raw.map((_, i) => {
        let s = 0, c = 0;
        for (let j = Math.max(0, i - 2); j <= Math.min(raw.length - 1, i + 2); j++) { s += raw[j]; c++; }
        return s / c;
      });
      elevGain = 0;
      let ref = sm[0];
      for (const v of sm) {
        if (v - ref >= 3) { elevGain += v - ref; ref = v; }
        else if (v < ref) ref = v;
      }
    }

    const mean = (vals) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
    const avgHr = mean(points.map((p) => p.hr).filter((v) => v != null));
    const avgCad = mean(points.map((p) => p.cad).filter((v) => v != null));
    const avgPower = mean(points.map((p) => p.power).filter((v) => v != null));

    return {
      points,
      avgHr,
      avgCad,
      avgPower,
      distance: dist,
      movingTime: hasTime ? moving : null,
      elapsed,
      hasTime,
      start: first.time,
      elevGain,
      hasEle: eles.some((e) => e != null),
      profile,
      cum,
      mcum,
    };
  }

  function computeSplits(st, unit) {
    if (!st.hasTime) return [];
    const { cum, mcum } = st;
    const out = [];
    let k = 1;
    let prevT = 0;
    for (let i = 1; i < cum.length; i++) {
      while (cum[i] >= k * unit) {
        const span = cum[i] - cum[i - 1] || 1;
        const f = (k * unit - cum[i - 1]) / span;
        const t = mcum[i - 1] + f * (mcum[i] - mcum[i - 1]);
        out.push({ dist: 1, secs: t - prevT });
        prevT = t;
        k++;
      }
    }
    const rem = (st.distance - (k - 1) * unit) / unit;
    if (rem >= 0.05) out.push({ dist: rem, secs: mcum[mcum.length - 1] - prevT });
    return out.filter((s) => s.secs > 0);
  }

  // ---------- formatting ----------

  const LABELS = {
    distance: 'Distance', pace: 'Pace', speed: 'Speed', time: 'Time', elev: 'Elev Gain',
    splits: 'Splits', h: 'h', m: 'm', s: 's', km: 'KILOMETERS', mi: 'MILES',
    parts: ['Night', 'Morning', 'Afternoon', 'Evening'], run: 'Run', ride: 'Ride',
    locale: 'en-US',
  };

  const pad2 = (n) => String(n).padStart(2, '0');

  function fmtPace(secs) {
    if (!isFinite(secs) || secs <= 0) return '\u2014';
    let m = Math.floor(secs / 60);
    let s = Math.round(secs - m * 60);
    if (s === 60) { m += 1; s = 0; }
    return `${m}:${pad2(s)}`;
  }

  function fmtDuration(secs, L) {
    if (secs == null || !isFinite(secs)) return '\u2014';
    const t = Math.round(secs);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    return h ? `${h}${L.h} ${pad2(m)}${L.m}` : `${m}${L.m} ${s}${L.s}`;
  }

  // "2:24:25" (or "35:22" under an hour), as sports watches show it.
  function fmtClock(secs) {
    if (secs == null || !isFinite(secs)) return '\u2014';
    const t = Math.round(secs);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
  }

  function autoName(start, isRide, L) {
    const kind = isRide ? L.ride : L.run;
    if (start == null) return kind;
    const h = new Date(start).getHours();
    const part = h < 5 ? L.parts[0] : h < 12 ? L.parts[1] : h < 17 ? L.parts[2] : h < 21 ? L.parts[3] : L.parts[0];
    return `${part} ${kind}`;
  }

  function buildData(st, meta, opts) {
    const L = LABELS;
    const mi = opts.units === 'mi';
    const unitM = mi ? 1609.344 : 1000;
    const uName = mi ? 'mi' : 'km';
    const num = (v, dp) => v.toFixed(dp);

    const distU = st.distance / unitM;
    const dist = { label: L.distance, num: num(distU, 2), unit: uName, long: mi ? L.mi : L.km };
    dist.value = `${dist.num} ${uName}`;

    const isRide = /bik|cycl|ride/i.test(meta.type || '');
    const useSpeed = opts.metric === 'speed' || (opts.metric === 'auto' && isRide);
    const mt = st.movingTime;
    const speedUnit = mi ? 'mph' : 'km/h';
    const speedNum = mt ? num(distU / (mt / 3600), 1) : '\u2014';
    const speed = { label: L.speed, num: speedNum, unit: speedUnit, value: mt ? `${speedNum} ${speedUnit}` : '\u2014' };
    const paceNum = mt ? fmtPace(mt / distU) : '\u2014';
    const runPace = { label: L.pace, num: paceNum, unit: `/${uName}`, value: mt ? `${paceNum}/${uName}` : '\u2014' };
    // `pace` follows the Pace/Speed setting; `speed` is always speed (for ride layouts).
    const pace = useSpeed ? speed : runPace;

    const time = { label: L.time, value: fmtDuration(mt, L), clock: fmtClock(mt) };
    const elapsed = st.elapsed ? { label: 'Elapsed Time', clock: fmtClock(st.elapsed) } : null;
    const g = st.elevGain;
    const elev = {
      label: L.elev,
      value: g == null ? '\u2014' : mi ? `${Math.round(g * 3.28084)} ft` : `${Math.round(g)} m`,
      num: g == null ? '\u2014' : String(Math.round(mi ? g * 3.28084 : g)),
      unit: g == null ? '' : mi ? 'ft' : 'm',
    };

    const splits = computeSplits(st, unitM).map((s, i) => ({
      label: String(i + 1), secs: s.secs, dist: s.dist, paceSecs: s.secs / s.dist,
    }));

    // Fastest full split (as pace, or as speed when showing speed).
    const full = splits.filter((sp) => sp.dist === 1);
    const fastest = full.length ? Math.min(...full.map((sp) => sp.paceSecs)) : null;
    const best = fastest == null ? null : {
      label: `Best ${mi ? 'Mile' : 'Km'}`,
      num: useSpeed ? num(3600 / fastest, 1) : fmtPace(fastest),
      unit: useSpeed ? speedUnit : `/${uName}`,
    };

    // Watches record running cadence per foot (~85); show steps per minute (~170).
    const hr = st.avgHr ? { label: 'Avg HR', num: String(Math.round(st.avgHr)), unit: 'bpm' } : null;
    const cadence = st.avgCad ? {
      label: 'Cadence',
      num: String(Math.round(!isRide && st.avgCad < 120 ? st.avgCad * 2 : st.avgCad)),
      unit: isRide ? 'rpm' : 'spm',
    } : null;

    // Power comes from the file (or the panel override); calories only from the panel,
    // since GPX files don't carry them.
    const watts = opts.power || st.avgPower;
    const power = watts ? { label: 'Avg Power', value: `${Math.round(watts)} W` } : null;
    const calories = opts.calories ? { label: 'Calories', value: `${Math.round(opts.calories)} Cal` } : null;

    const date = st.start != null
      ? new Date(st.start).toLocaleDateString(L.locale, { day: 'numeric', month: 'long', year: 'numeric' })
      : '';

    return {
      dist, pace, speed, time, elapsed, elev, splits, best, hr, cadence, power, calories, useSpeed,
      splitsLabel: L.splits,
      route: st.points,
      profile: st.profile,
      name: opts.title || meta.name || autoName(st.start, isRide, L),
      date,
      wordmark: 'STRAVA', // always drawn as the STRAVA logo
      rw: opts.routeWidth || 1,
    };
  }

  // Demo route shape: a loop around Andorra (Encamp, Andorra la Vella, Sant Julia,
  // the western valleys, La Massana and back), traced as map-pixel x,y pairs
  // (x east, y south). The demo squeezes it into a ~7 km run.
  const DEMO_ROUTE = [
    481,90, 472,91, 466,95, 460,99, 452,104, 447,108, 442,113, 440,118, 439,122, 436,126, 433,130, 430,133,
    420,135, 410,139, 400,141, 392,143, 386,148, 380,155, 375,158, 368,161, 363,164, 360,168, 358,175, 355,180, 353,184, 352,190, 353,195, 348,197, 342,197, 338,195, 332,194, 325,193, 320,191,
    315,192, 311,190, 309,188, 305,186, 302,184, 299,181, 297,176, 295,172, 292,168, 290,164, 288,160, 287,155, 287,150, 287,145, 286,140, 285,136, 282,133, 277,132, 272,131, 269,134, 268,139, 268,145, 265,146, 260,145, 257,142, 253,141, 248,142, 243,143, 237,141, 230,141, 220,141, 213,142, 207,145, 205,148, 200,150, 192,150, 188,151, 185,153, 181,155, 178,157, 175,160, 173,163, 171,165, 170,170, 168,175, 167,180, 165,184, 163,186,
    160,187, 155,186, 150,186, 148,183, 145,181, 138,181, 132,177, 125,176, 120,177, 115,179, 112,181, 110,186, 108,184, 104,179, 100,175, 95,175, 90,176, 87,174, 83,175, 80,173, 80,169, 79,165, 77,162, 78,158, 81,155, 85,152, 86,151, 83,155, 79,156, 78,152, 76,155, 70,155, 64,154, 60,153, 55,152, 51,155, 48,156, 50,152, 53,147, 48,143, 40,141, 33,139, 28,136, 22,133, 17,129, 14,124, 12,118, 12,113, 14,110, 18,107, 22,104, 26,102, 35,100, 45,100, 50,101, 58,101, 52,102, 47,104, 42,106, 38,109, 38,112, 45,113, 55,114, 65,115, 75,115, 82,114, 88,112, 95,110, 99,108, 102,104, 106,100, 107,96, 103,96, 99,99, 93,99, 85,99, 75,99, 68,97, 72,96, 77,94, 82,91, 85,87, 90,83, 95,82, 98,78, 100,75, 102,72, 104,68, 107,63, 109,60, 111,57, 113,55, 118,55, 120,57, 123,56, 128,55, 133,53, 137,50, 140,48, 142,45, 141,40, 142,36, 144,33, 146,32, 150,33, 152,35, 152,40, 153,45, 155,47, 158,47, 161,45, 162,38, 163,30, 164,24,
    166,18, 170,13, 175,11, 180,9, 184,9, 190,12, 197,13, 203,14, 207,16, 213,15, 220,15, 226,17, 229,22, 230,30, 231,35, 233,40, 236,44, 239,48, 240,39, 246,36, 248,40, 249,46, 251,52, 253,61, 256,58, 261,53, 262,48, 268,46, 272,43, 275,39, 282,37, 291,36, 293,43, 294,48, 301,49, 302,54, 301,60, 303,66, 308,72, 310,79, 314,80, 318,80, 319,84, 322,86,
    328,83, 331,78, 334,76, 338,79, 343,80, 338,79, 334,76, 330,73, 327,70, 327,67, 330,65, 334,65, 338,66, 342,65, 346,61, 349,57, 350,52, 352,47, 356,42, 360,36, 365,33, 370,34, 374,38, 377,46, 380,53, 384,59, 389,65, 394,71, 396,80, 396,90, 397,100, 399,108, 401,113, 404,118, 410,122, 418,127, 425,131, 430,133,
    433,130, 436,126, 439,122, 440,118, 442,113, 447,108, 452,104, 460,99, 466,95, 472,91, 481,90,
  ];

  // A synthetic ~7 km morning run so the app has something to show before upload.
  function demoGPX() {
    const pts = [];
    const lat0 = -6.2297, lon0 = 106.8022;
    let t = Date.parse('2026-10-09T06:12:00+07:00');
    const step = 5; // meters
    const dt = step / (1000 / 299); // seconds per step at 4:59 /km
    const total = 7095;
    const n = Math.round(total / step);

    // Cumulative pixel length along the traced shape, then meters per pixel.
    const xy = [];
    for (let i = 0; i < DEMO_ROUTE.length; i += 2) xy.push([DEMO_ROUTE[i], DEMO_ROUTE[i + 1]]);
    const cum = [0];
    for (let i = 1; i < xy.length; i++) cum.push(cum[i - 1] + Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]));
    const mpp = total / cum[cum.length - 1];

    // Sample a point every `step` meters along the shape (local meters, y north).
    const local = [];
    let seg = 1;
    for (let i = 0; i <= n; i++) {
      const along = Math.min(i * step / mpp, cum[cum.length - 1]);
      while (seg < cum.length - 1 && cum[seg] < along) seg++;
      const f = (along - cum[seg - 1]) / (cum[seg] - cum[seg - 1] || 1);
      local.push([
        (xy[seg - 1][0] + (xy[seg][0] - xy[seg - 1][0]) * f) * mpp,
        -(xy[seg - 1][1] + (xy[seg][1] - xy[seg - 1][1]) * f) * mpp,
      ]);
    }
    // Straight hops between samples cut the sharp corners; scale back up to `total`.
    let chords = 0;
    for (let i = 1; i < local.length; i++) chords += Math.hypot(local[i][0] - local[i - 1][0], local[i][1] - local[i - 1][1]);
    const k = total / chords;
    const mPerDeg = (6371008.8 * Math.PI) / 180; // same Earth radius as haversine()

    for (let i = 0; i <= n; i++) {
      const lat = lat0 + (local[i][1] * k) / mPerDeg;
      const lon = lon0 + (local[i][0] * k) / (mPerDeg * Math.cos(toRad(lat0)));
      const ele = 22 + 9 * Math.sin(i / 160) + 4 * Math.sin(i / 47);
      const hr = Math.round(158 + 10 * Math.sin(i / 200) + i / 120);
      const cad = Math.round(87 + 2 * Math.sin(i / 60));
      pts.push(`<trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"><ele>${ele.toFixed(1)}</ele><time>${new Date(t).toISOString()}</time>` +
        `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${hr}</gpxtpx:hr><gpxtpx:cad>${cad}</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions></trkpt>`);
      t += dt * 1000 * (1 + 0.05 * Math.sin(i / 230));
    }
    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="demo" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
<trk><name>Morning Run</name><type>running</type><trkseg>${pts.join('')}</trkseg></trk></gpx>`;
  }

  Object.assign(OV, { parseGPX, computeStats, buildData, fmtPace, demoGPX });
})(window.OV);
