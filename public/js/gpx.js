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
    const useSpeed = isRide; // rides show speed, everything else pace
    const mt = st.movingTime;
    const speedUnit = mi ? 'mph' : 'km/h';
    const speedNum = mt ? num(distU / (mt / 3600), 1) : '\u2014';
    const speed = { label: L.speed, num: speedNum, unit: speedUnit, value: mt ? `${speedNum} ${speedUnit}` : '\u2014' };
    const paceNum = mt ? fmtPace(mt / distU) : '\u2014';
    const runPace = { label: L.pace, num: paceNum, unit: `/${uName}`, value: mt ? `${paceNum}/${uName}` : '\u2014' };
    // `pace` is speed for rides and pace otherwise; `speed` is always speed (ride layouts).
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

    // Power comes from the file (or Strava); calories only from Strava, since GPX files
    // don't carry them.
    const watts = st.avgPower;
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

  // The demo activity (js/demo.js) rebuilt as GPX text, so it goes through the
  // same parser as an uploaded file.
  function demoGPX() {
    const D = OV.DEMO;
    const list = (s, delta) => {
      let acc = 0;
      return s.split(',').map((v) => (v === '' ? null : delta ? (acc += +v) : +v));
    };
    const lat = list(D.lat, true), lon = list(D.lon, true), ele = list(D.ele, true), t = list(D.t, true);
    const hr = list(D.hr), cad = list(D.cad), power = list(D.power);
    const t0 = Date.parse(D.start);
    const pts = lat.map((_, i) =>
      `<trkpt lat="${(lat[i] / 1e7).toFixed(7)}" lon="${(lon[i] / 1e7).toFixed(7)}"><ele>${(ele[i] / 10).toFixed(1)}</ele>` +
      `<time>${new Date(t0 + t[i] * 1000).toISOString()}</time><extensions>${power[i] == null ? '' : `<power>${power[i]}</power>`}` +
      `<gpxtpx:TrackPointExtension>${hr[i] == null ? '' : `<gpxtpx:hr>${hr[i]}</gpxtpx:hr>`}` +
      `${cad[i] == null ? '' : `<gpxtpx:cad>${cad[i]}</gpxtpx:cad>`}</gpxtpx:TrackPointExtension></extensions></trkpt>`);
    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="demo" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
<trk><name>${D.name}</name><type>${D.type}</type><trkseg>${pts.join('')}</trkseg></trk></gpx>`;
  }

  Object.assign(OV, { parseGPX, computeStats, buildData, fmtPace, demoGPX });
})(window.OV);
