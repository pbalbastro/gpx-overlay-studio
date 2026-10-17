// FIT (Garmin/Wahoo/Coros... binary activity file) reader. Produces the same track
// points as parseGPX, plus the device's own session totals and its name.
window.OV = window.OV || {};

(function (OV) {
  const FIT_EPOCH = 631065600000; // 1989-12-31T00:00:00Z, in ms
  const SEMI = 180 / 2 ** 31; // semicircles -> degrees

  // Base types by their low 5 bits: [byte size, DataView getter, invalid value].
  const TYPES = {
    0x00: [1, 'getUint8', 0xff], 0x01: [1, 'getInt8', 0x7f], 0x02: [1, 'getUint8', 0xff],
    0x03: [2, 'getInt16', 0x7fff], 0x04: [2, 'getUint16', 0xffff], 0x05: [4, 'getInt32', 0x7fffffff],
    0x06: [4, 'getUint32', 0xffffffff], 0x07: [1, null, null], 0x08: [4, 'getFloat32', null],
    0x09: [8, 'getFloat64', null], 0x0a: [1, 'getUint8', 0], 0x0b: [2, 'getUint16', 0],
    0x0c: [4, 'getUint32', 0], 0x0d: [1, 'getUint8', 0xff],
  };

  // Messages and fields we read (global message number -> field number -> name).
  const FIELDS = {
    0: { 1: 'manufacturer', 8: 'productName' }, // file_id
    23: { 2: 'manufacturer', 27: 'productName' }, // device_info
    18: { // session
      2: 'start', 5: 'sport', 7: 'elapsed', 8: 'timer', 9: 'distance', 11: 'calories',
      16: 'avgHr', 18: 'avgCad', 20: 'avgPower', 22: 'ascent',
    },
    20: { // record
      253: 'time', 0: 'lat', 1: 'lon', 2: 'alt', 78: 'ealt', 3: 'hr', 4: 'cad', 7: 'power', 5: 'distance',
    },
  };

  const SPORTS = { 1: 'running', 2: 'cycling', 5: 'swimming', 11: 'walking', 17: 'hiking', 21: 'e_biking' };
  const MAKERS = {
    1: 'Garmin', 23: 'Suunto', 32: 'Wahoo', 89: 'Tacx', 123: 'Polar', 260: 'Zwift',
    265: 'Strava', 267: 'Bryton', 289: 'Hammerhead', 294: 'Coros',
  };

  const isFit = (bytes) => bytes.length >= 12 && String.fromCharCode(...bytes.subarray(8, 12)) === '.FIT';

  // Walks every message, calling onMessage(globalNum, {name: value}) for the ones in FIELDS.
  function walk(bytes, onMessage) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const headerSize = dv.getUint8(0);
    const end = Math.min(bytes.length, headerSize + dv.getUint32(4, true));
    const defs = [];
    let pos = headerSize;
    let lastTime = null; // raw FIT seconds, for compressed timestamps

    while (pos < end) {
      const h = dv.getUint8(pos++);
      let local, compressedOffset = null;
      if (h & 0x80) { // compressed timestamp header: always a data message
        local = (h >> 5) & 0x03;
        compressedOffset = h & 0x1f;
      } else if (h & 0x40) { // definition message
        local = h & 0x0f;
        const little = dv.getUint8(pos + 1) === 0;
        const num = dv.getUint16(pos + 2, little);
        const n = dv.getUint8(pos + 4);
        pos += 5;
        const fields = [];
        for (let i = 0; i < n; i++, pos += 3) {
          fields.push({ num: dv.getUint8(pos), size: dv.getUint8(pos + 1), type: dv.getUint8(pos + 2) & 0x1f });
        }
        let devSize = 0;
        if (h & 0x20) { // developer fields: only their sizes matter here
          const nd = dv.getUint8(pos++);
          for (let i = 0; i < nd; i++, pos += 3) devSize += dv.getUint8(pos + 1);
        }
        defs[local] = { num, little, fields, devSize };
        continue;
      } else {
        local = h & 0x0f;
      }

      const def = defs[local];
      if (!def) throw new Error('This FIT file looks damaged.');
      const wanted = FIELDS[def.num];
      const msg = wanted ? {} : null;
      for (const f of def.fields) {
        if (msg && wanted[f.num]) {
          const v = readField(dv, bytes, pos, f, def.little);
          if (v != null) msg[wanted[f.num]] = v;
        }
        if (f.num === 253 && def.num !== 0) {
          const t = dv.getUint32(pos, def.little);
          if (t !== 0xffffffff) lastTime = t;
        }
        pos += f.size;
      }
      pos += def.devSize;
      if (compressedOffset != null && lastTime != null) {
        // The 5-bit offset rolls over every 32 s relative to the last full timestamp.
        lastTime += (compressedOffset - (lastTime & 0x1f)) & 0x1f;
        if (msg && wanted[253]) msg[wanted[253]] = lastTime;
      }
      if (msg) onMessage(def.num, msg);
    }
  }

  function readField(dv, bytes, pos, f, little) {
    const t = TYPES[f.type];
    if (!t) return null;
    if (f.type === 0x07) { // string: NUL-terminated UTF-8
      let n = 0;
      while (n < f.size && bytes[pos + n]) n++;
      return n ? new TextDecoder().decode(bytes.subarray(pos, pos + n)).trim() || null : null;
    }
    const [size, getter, invalid] = t;
    if (f.size < size) return null;
    const v = dv[getter](pos, little); // arrays: the first element is enough here
    return v === invalid || (typeof v === 'number' && !isFinite(v)) ? null : v;
  }

  function parseFIT(buffer) {
    const bytes = new Uint8Array(buffer);
    if (!isFit(bytes)) throw new Error('This is not a FIT file.');
    const points = [];
    const sessions = [];
    let maker = null, product = null;

    walk(bytes, (num, m) => {
      if (num === 20) {
        if (m.lat == null || m.lon == null) return; // indoor / no GPS fix yet
        const alt = m.ealt != null ? m.ealt : m.alt;
        points.push({
          lat: m.lat * SEMI,
          lon: m.lon * SEMI,
          ele: alt != null ? alt / 5 - 500 : null,
          time: m.time != null ? FIT_EPOCH + m.time * 1000 : null,
          hr: m.hr || null,
          cad: m.cad || null,
          power: m.power != null ? m.power : null, // zero power counts (coasting)
          dist: m.distance != null ? m.distance / 100 : null,
        });
      } else if (num === 18) {
        sessions.push(m);
      } else {
        if (maker == null && m.manufacturer != null) maker = m.manufacturer;
        if (product == null && m.productName) product = m.productName;
      }
    });

    // Multisport files have several sessions: add up the totals, keep the first sport.
    const first = sessions[0] || {};
    const sum = (k, scale) => (sessions.some((s) => s[k] != null)
      ? sessions.reduce((a, s) => a + (s[k] || 0), 0) / scale : null);
    const one = sessions.length === 1 ? first : {};
    const makerName = MAKERS[maker] || null;
    return {
      name: '',
      type: SPORTS[first.sport] || '',
      points,
      device: [makerName, product].filter(Boolean).join(' ').replace(/^(\w+) \1\b/, '$1') || null,
      totals: {
        distance: sum('distance', 100),
        elapsed: sum('elapsed', 1000),
        timer: sum('timer', 1000),
        elevGain: sum('ascent', 1),
        calories: sum('calories', 1),
        start: first.start != null ? FIT_EPOCH + first.start * 1000 : null,
        avgHr: one.avgHr || null,
        avgCad: one.avgCad || null,
        avgPower: one.avgPower != null ? one.avgPower : null,
      },
    };
  }

  // FIT -> { meta, stats, calories }, like strava.js: track points go through the
  // normal stats, then the device's session totals replace the GPS-derived ones.
  function fitActivity(buffer) {
    const fit = parseFIT(buffer);
    const { points, totals: t } = fit;
    let st;
    if (points.length >= 2) {
      st = OV.computeStats(points);
      // The device's own cumulative distance, so splits match the watch.
      if (points.every((p) => p.dist != null)) st.cum = points.map((p) => p.dist);
    } else {
      // Indoor (trainer, treadmill, Zwift): no GPS, so stats only.
      st = { points: [], profile: [], cum: [], mcum: [], hasEle: false, avgHr: null, avgCad: null, avgPower: null };
    }
    if (!points.length && t.distance == null && t.timer == null) {
      throw new Error('No activity data found in this FIT file.');
    }
    Object.assign(st, {
      distance: t.distance != null ? t.distance : st.distance,
      // Moving time stays GPS-derived (pauses excluded, like Strava); without GPS
      // the device's timer time is the best stand-in.
      movingTime: st.movingTime || t.timer || null,
      elapsed: t.elapsed || st.elapsed || null,
      hasTime: !!(st.hasTime || t.timer),
      start: t.start != null ? t.start : st.start,
      elevGain: t.elevGain != null ? t.elevGain : st.elevGain,
      avgHr: t.avgHr || st.avgHr,
      avgCad: t.avgCad || st.avgCad,
      avgPower: t.avgPower != null ? t.avgPower : st.avgPower,
    });
    return {
      meta: { name: fit.name, type: fit.type, points },
      stats: st,
      calories: t.calories || null,
      device: fit.device,
    };
  }

  Object.assign(OV, { isFit, parseFIT, fitActivity });
})(window.OV);
