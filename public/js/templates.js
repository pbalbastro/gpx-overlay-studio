// Overlay variations. Every template draws on a transparent canvas using only
// white type and Strava orange (#FC4C02). Layouts scale from a 1080px-wide
// reference (s = W / 1080) so they work at any export or thumbnail size.
window.OV = window.OV || {};

(function (OV) {
  const { ORANGE } = OV;

  function groupSplits(splits, max) {
    if (splits.length <= max) {
      return splits.map((s) => ({ label: s.label, paceSecs: s.paceSecs }));
    }
    const k = Math.ceil(splits.length / max);
    const out = [];
    for (let i = 0; i < splits.length; i += k) {
      const chunk = splits.slice(i, i + k);
      const secs = chunk.reduce((a, c) => a + c.secs, 0);
      const dist = chunk.reduce((a, c) => a + c.dist, 0);
      const label = chunk.length > 1 ? `${chunk[0].label}-${chunk[chunk.length - 1].label}` : chunk[0].label;
      out.push({ label, paceSecs: secs / dist });
    }
    return out;
  }

  const templates = [
    {
      id: 'classic',
      name: 'Classic Stack',
      desc: 'Centered stats, a route squiggle and the wordmark. The original look.',
      draw(ctx, W, H, d) {
        classicLayout(ctx, W, H, d, [d.dist, d.pace, d.time], (x, y, s) => OV.wordmark(ctx, d, x, y, 50 * s));
      },
    },
    {
      id: 'hero',
      name: 'Route Hero',
      desc: 'The route takes center stage with a three-column stat row underneath.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2;
        const top = H * 0.1, rh = H * 0.42;
        OV.drawRoute(ctx, d.route, { x: W * 0.1, y: top, w: W * 0.8, h: rh }, { width: 16 * s * d.rw, markers: true });
        const bottom = OV.row(ctx, [d.dist, d.pace, d.time], 40 * s, W - 80 * s, top + rh + 100 * s, {
          labelSize: 30 * s, valueSize: 58 * s,
        });
        OV.wordmark(ctx, d, cx, bottom + 120 * s, 46 * s);
      },
    },
    {
      id: 'bottombar',
      name: 'Bottom Bar',
      desc: 'A divided stat bar along the bottom edge, keeping the frame clear.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2;
        const wmY = H - 80 * s;
        const rowBottom = d.wordmark ? wmY - 100 * s : H - 110 * s;
        const rowTop = rowBottom - (30 * 0.8 + 64 * 1.05) * s;
        OV.row(ctx, [d.dist, d.pace, d.time], 40 * s, W - 80 * s, rowTop, {
          labelSize: 30 * s, valueSize: 64 * s, dividers: true,
        });
        const rh = H * 0.13;
        OV.drawRoute(ctx, d.route, { x: cx - W * 0.25, y: rowTop - 80 * s - rh, w: W * 0.5, h: rh }, { width: 11 * s * d.rw });
        OV.wordmark(ctx, d, cx, wmY, 40 * s);
      },
    },
    {
      id: 'corner',
      name: 'Corner Stack',
      desc: 'Left-aligned stats tucked into the bottom-left corner.',
      draw(ctx, W, H, d) {
        const s = W / 1080, x = 80 * s;
        const items = [d.dist, d.pace, d.time];
        const o = { labelSize: 30 * s, valueSize: 66 * s, gap: 40 * s, align: 'left', maxWidth: W * 0.6 };
        let bottom = H - 110 * s;
        if (d.wordmark) {
          OV.wordmark(ctx, d, x, bottom, 44 * s, 'left');
          bottom -= 100 * s;
        }
        const top = bottom - OV.stackHeight(items, o);
        OV.stack(ctx, items, x, top, o);
        const rh = Math.min(180 * s, H * 0.12);
        OV.drawRoute(ctx, d.route, { x, y: top - 60 * s - rh, w: 340 * s, h: rh }, { width: 10 * s * d.rw, align: 'left' });
      },
    },
    {
      id: 'bignum',
      name: 'Big Number',
      desc: 'Oversized distance with pace and time on a single line.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2;
        let y = H * 0.09 + 34 * s * 0.8;
        OV.text(ctx, d.dist.label, cx, y, { size: 34 * s, weight: 600 });
        const ns = OV.fitSize(ctx, d.dist.num, W * 0.9, 280 * s, 900);
        y += 40 * s + ns * 0.72;
        OV.text(ctx, d.dist.num, cx, y, { size: ns, weight: 900 });
        y += 90 * s;
        OV.text(ctx, d.dist.long, cx, y, { size: 50 * s, weight: 800, color: ORANGE, spacing: 14 * s });
        y += 100 * s;
        OV.text(ctx, `${d.pace.value}   \u00B7   ${d.time.value}`, cx, y, { size: 44 * s, weight: 700, maxWidth: W * 0.9 });
        const rw = 520 * s, rh = Math.min(220 * s, H * 0.14), ry = y + 90 * s;
        OV.drawRoute(ctx, d.route, { x: cx - rw / 2, y: ry, w: rw, h: rh }, { width: 11 * s * d.rw });
        OV.wordmark(ctx, d, cx, ry + rh + 110 * s, 46 * s);
      },
    },
    {
      id: 'minimal',
      name: 'Minimal Route',
      desc: 'Just the route with start/finish dots and the distance.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2;
        const rw = W * 0.72, rh = H * 0.38, ry = H * 0.42 - rh / 2;
        OV.drawRoute(ctx, d.route, { x: cx - rw / 2, y: ry, w: rw, h: rh }, { width: 14 * s * d.rw, markers: true });
        const y = ry + rh + 120 * s;
        OV.text(ctx, d.dist.value, cx, y, { size: 68 * s, weight: 800 });
        OV.wordmark(ctx, d, cx, y + 90 * s, 36 * s);
      },
    },
    {
      id: 'corners',
      name: 'Four Corners',
      desc: 'Distance, pace, time and elevation pinned to each corner.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2;
        const m = 80 * s, ls = 28 * s, vs = 56 * s;
        const blockH = ls * 0.8 + vs * 1.05;
        const corner = (it, x, y, align) => {
          OV.text(ctx, it.label, x, y + ls * 0.8, { size: ls, weight: 600, align });
          OV.text(ctx, it.value, x, y + blockH, { size: vs, weight: 800, align, maxWidth: W * 0.42 });
        };
        const top = m + H * 0.02;
        corner(d.dist, m, top, 'left');
        corner(d.pace, W - m, top, 'right');
        corner(d.time, m, H - m - blockH, 'left');
        corner(d.elev, W - m, H - m - blockH, 'right');
        const rw = W * 0.6, rh = H * 0.26, ry = H / 2 - rh / 2 - 30 * s;
        OV.drawRoute(ctx, d.route, { x: cx - rw / 2, y: ry, w: rw, h: rh }, { width: 12 * s * d.rw });
        OV.wordmark(ctx, d, cx, ry + rh + 90 * s, 38 * s);
      },
    },
    {
      id: 'accent',
      name: 'Side Accent',
      desc: 'Orange accent bar with uppercase labels and four stats.',
      draw(ctx, W, H, d) {
        const s = W / 1080, x = 110 * s;
        const items = [d.dist, d.pace, d.time, d.elev];
        const o = {
          labelSize: 26 * s, valueSize: 62 * s, gap: 44 * s, align: 'left', labelColor: ORANGE,
          labelWeight: 700, labelSpacing: 5 * s, upper: true, maxWidth: W * 0.5,
        };
        const sh = OV.stackHeight(items, o);
        const top = H / 2 - sh / 2;
        ctx.save();
        ctx.fillStyle = ORANGE;
        OV.roundRect(ctx, x - 44 * s, top, 8 * s, sh, 4 * s);
        ctx.fill();
        ctx.restore();
        OV.stack(ctx, items, x, top, o);
        const rh = Math.min(H * 0.3, sh);
        OV.drawRoute(ctx, d.route, { x: W * 0.6, y: H / 2 - rh / 2, w: W * 0.32, h: rh }, { width: 10 * s * d.rw });
        OV.wordmark(ctx, d, x, top + sh + 110 * s, 42 * s, 'left');
      },
    },
    {
      id: 'card',
      name: 'Activity Card',
      desc: 'Translucent card with title, date, route and stats.',
      draw(ctx, W, H, d) {
        const s = W / 1080;
        const pad = 50 * s, x0 = 60 * s, cw = W - 120 * s, ch = 400 * s;
        const y0 = H - ch - Math.max(80 * s, H * 0.06);
        ctx.save();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = 'rgba(0,0,0,0.42)';
        OV.roundRect(ctx, x0, y0, cw, ch, 36 * s);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(x0 + pad, y0 + 160 * s, cw - pad * 2, Math.max(1, 2 * s));
        ctx.restore();

        const ty = y0 + pad + 36 * s;
        OV.text(ctx, d.name, x0 + pad, ty, { size: 42 * s, weight: 800, align: 'left', maxWidth: cw - pad * 2 - 230 * s });
        if (d.date) OV.text(ctx, d.date, x0 + pad, ty + 48 * s, { size: 26 * s, weight: 500, align: 'left', alpha: 0.75 });
        OV.wordmark(ctx, d, x0 + cw - pad, ty, 34 * s, 'right', ORANGE);

        const by = y0 + 190 * s, bh = ch - 190 * s - pad;
        OV.drawRoute(ctx, d.route, { x: x0 + pad, y: by, w: 200 * s, h: bh }, { width: 8 * s * d.rw });
        const rowH = (26 * 0.8 + 46 * 1.05) * s;
        OV.row(ctx, [d.dist, d.pace, d.time], x0 + pad + 230 * s, cw - pad * 2 - 230 * s, by + (bh - rowH) / 2, {
          labelSize: 26 * s, valueSize: 46 * s, labelAlpha: 0.8,
        });
      },
    },
    {
      id: 'elevation',
      name: 'Elevation Profile',
      desc: 'Stat row on top, route in the middle, orange elevation profile at the bottom.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2;
        const rowBottom = OV.row(ctx, [d.dist, d.pace, d.time], 40 * s, W - 80 * s, H * 0.08, {
          labelSize: 28 * s, valueSize: 56 * s,
        });
        const ph = H * 0.16;
        const py = H - ph - (d.wordmark ? 170 * s : 90 * s);
        OV.text(ctx, d.elev.label.toUpperCase(), 60 * s, py - 84 * s, {
          size: 24 * s, weight: 700, align: 'left', color: ORANGE, spacing: 5 * s,
        });
        OV.text(ctx, d.elev.value, 60 * s, py - 24 * s, { size: 48 * s, weight: 800, align: 'left' });
        OV.drawProfile(ctx, d.profile, { x: 0, y: py, w: W, h: ph }, { width: 5 * s });
        const top = rowBottom + 80 * s, avail = py - 150 * s - top;
        const rh = Math.max(0, Math.min(H * 0.3, avail));
        OV.drawRoute(ctx, d.route, { x: cx - W * 0.3, y: top + (avail - rh) / 2, w: W * 0.6, h: rh }, { width: 11 * s * d.rw });
        OV.wordmark(ctx, d, cx, H - 80 * s, 40 * s);
      },
    },
    {
      id: 'splits',
      name: 'Splits',
      desc: 'Per-kilometer (or mile) pace bars, plus summary stats.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2, x0 = 90 * s;
        let y = H * 0.08 + 30 * s * 0.8;
        OV.text(ctx, d.splitsLabel.toUpperCase(), x0, y, { size: 30 * s, weight: 800, align: 'left', color: ORANGE, spacing: 6 * s });
        OV.wordmark(ctx, d, W - x0, y, 34 * s, 'right');
        y += 50 * s;

        const rows = groupSplits(d.splits, 12);
        const areaH = H * 0.42;
        if (rows.length) {
          const rowH = Math.min(64 * s, areaH / rows.length);
          const barH = rowH * 0.55, fs = Math.min(30 * s, rowH * 0.5);
          const paces = rows.map((r) => r.paceSecs);
          const fast = Math.min(...paces), slow = Math.max(...paces);
          const barX = x0 + 110 * s, barMax = W * 0.52;
          rows.forEach((r, i) => {
            const cy = y + rowH * (i + 0.5);
            const bw = barMax * (0.45 + 0.55 * ((slow - r.paceSecs) / (slow - fast || 1)));
            OV.text(ctx, r.label, x0, cy + fs * 0.36, { size: fs, weight: 700, align: 'left' });
            ctx.save();
            ctx.fillStyle = ORANGE;
            OV.roundRect(ctx, barX, cy - barH / 2, bw, barH, barH / 2);
            ctx.fill();
            ctx.restore();
            OV.text(ctx, OV.fmtPace(r.paceSecs), barX + bw + 24 * s, cy + fs * 0.36, { size: fs, weight: 700, align: 'left' });
          });
          y += rowH * rows.length;
        } else {
          OV.text(ctx, '\u2014', x0, y + 40 * s, { size: 40 * s, align: 'left' });
          y += 60 * s;
        }

        const rowTop = H - 100 * s - (28 * 0.8 + 56 * 1.05) * s;
        OV.row(ctx, [d.dist, d.pace, d.time], 40 * s, W - 80 * s, rowTop, { labelSize: 28 * s, valueSize: 56 * s });
        const top = y + 60 * s, avail = rowTop - 80 * s - top;
        const rh = Math.max(0, Math.min(H * 0.2, avail));
        OV.drawRoute(ctx, d.route, { x: cx - W * 0.25, y: top + (avail - rh) / 2, w: W * 0.5, h: rh }, { width: 10 * s * d.rw });
      },
    },
    {
      id: 'oneline',
      name: 'One Line',
      desc: 'All stats on one line with orange separators, route above.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2;
        const parts = [d.dist.value, d.pace.value, d.time.value];
        const sep = '  \u2022  ';
        const full = parts.join(sep);
        const size = OV.fitSize(ctx, full, W - 120 * s, 58 * s, 800);
        const y = H - (d.wordmark ? 200 * s : 130 * s);
        let x = cx - OV.measure(ctx, full, size, 800) / 2;
        parts.forEach((p, i) => {
          if (i) x += OV.text(ctx, sep, x, y, { size, weight: 800, align: 'left', color: ORANGE });
          x += OV.text(ctx, p, x, y, { size, weight: 800, align: 'left' });
        });
        const rw = W * 0.55, rh = H * 0.15;
        OV.drawRoute(ctx, d.route, { x: cx - rw / 2, y: y - size - 80 * s - rh, w: rw, h: rh }, { width: 11 * s * d.rw });
        OV.wordmark(ctx, d, cx, H - 100 * s, 36 * s);
      },
    },
    {
      id: 'map',
      name: 'Route Map',
      desc: 'Outlined route with start/finish pins and a 2\u00D72 stat grid.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2;
        if (d.wordmark) {
          const wy = H * 0.07 + 40 * s;
          OV.wordmark(ctx, d, cx, wy, 46 * s);
          ctx.save();
          ctx.fillStyle = ORANGE;
          OV.roundRect(ctx, cx - 40 * s, wy + 22 * s, 80 * s, 6 * s, 3 * s);
          ctx.fill();
          ctx.restore();
        }
        OV.drawRoute(ctx, d.route, { x: W * 0.12, y: H * 0.15, w: W * 0.76, h: H * 0.38 }, {
          width: 12 * s * d.rw, outline: 5 * s, markers: true,
        });
        const o = {
          labelSize: 24 * s, valueSize: 58 * s, labelColor: ORANGE, labelWeight: 700,
          labelSpacing: 4 * s, upper: true,
        };
        const cellH = (24 * 0.8 + 58 * 1.05) * s, gap = 60 * s;
        const r2 = H - 100 * s - cellH, r1 = r2 - gap - cellH;
        OV.row(ctx, [d.dist, d.pace], 0, W, r1, o);
        OV.row(ctx, [d.time, d.elev], 0, W, r2, o);
      },
    },
    {
      id: 'finger',
      name: 'Middle Finger',
      desc: 'Bold orange hand outline beside a compact stat column.',
      draw(ctx, W, H, d) { handLayout(ctx, W, H, d, HANDS.middle); },
    },
    {
      id: 'horns',
      name: 'Rock On',
      desc: 'Devil-horns hand outline beside a compact stat column.',
      draw(ctx, W, H, d) { handLayout(ctx, W, H, d, HANDS.horns); },
    },
    {
      id: 'strava-stats',
      name: 'Strava Stats',
      desc: 'Strava app stat screen: two centered columns of label over value, white only.',
      draw(ctx, W, H, d) {
        const s = W / 1080, F = OV.INTER;
        // Calories and power come from the side panel / file; fill gaps with other stats.
        const extras = [
          d.hr && { label: 'Avg Heart Rate', value: `${d.hr.num} bpm` },
          d.cadence && { label: 'Cadence', value: `${d.cadence.num} ${d.cadence.unit}` },
          d.best && { label: d.best.label, value: `${d.best.num} ${d.best.unit}` },
          d.elapsed && { label: 'Elapsed Time', value: d.elapsed.clock },
        ].filter(Boolean);
        const take = (stat) => stat || extras.shift() || { label: '', value: '' };
        const pace = d.useSpeed
          ? { label: 'Avg Speed', value: `${d.speed.num} ${d.speed.unit}` }
          : { label: 'Avg Pace', value: `${d.pace.num} ${d.pace.unit}` };
        const cells = [
          { label: d.dist.label, value: d.dist.value },
          { label: 'Elevation Gain', value: d.elev.value },
          { label: 'Moving Time', value: d.time.clock },
          take(d.power),
          pace,
          take(d.calories),
        ];

        const ls = 40 * s, vs = 68 * s;             // label / value sizes
        const toValue = 74 * s, pitch = 225 * s;     // label->value baseline, row spacing
        const rows = Math.ceil(cells.length / 2);
        const blockH = ls * 0.75 + toValue + (rows - 1) * pitch;
        const top = H / 2 - blockH / 2 + ls * 0.75;  // first label baseline
        const cols = [W * 0.27, W * 0.73];
        cells.forEach((c, i) => {
          const x = cols[i % 2], y = top + Math.floor(i / 2) * pitch;
          OV.text(ctx, c.label, x, y, { size: ls, weight: 400, family: F, maxWidth: W * 0.44 });
          OV.text(ctx, c.value, x, y + toValue, { size: vs, weight: 600, family: F, maxWidth: W * 0.44 });
        });
      },
    },
    {
      id: 'stats-grid',
      name: 'Stats Grid',
      desc: 'Sports-watch style: big distance and a six-stat grid in condensed type.',
      draw(ctx, W, H, d) {
        const s = W / 1080, F = OV.CONDENSED;
        const m = W * 0.11;
        // Value with a small unit after it, and a grey label underneath.
        const stat = (x, y, num, unit, label, size, unitAlpha = 0.7) => {
          const w = OV.text(ctx, num, x, y, { size, weight: 600, align: 'left', family: F });
          if (unit) {
            OV.text(ctx, unit, x + w + size * 0.08, y, { size: size * 0.42, weight: 600, align: 'left', family: F, alpha: unitAlpha });
          }
          OV.text(ctx, label, x, y + size * 0.5, { size: Math.max(size * 0.32, 30 * s), weight: 500, align: 'left', family: F, alpha: 0.75 });
        };

        OV.wordmark(ctx, d, W / 2, H * 0.47, 34 * s);

        const bigY = H * 0.585;
        stat(m, bigY, d.dist.num, d.dist.unit, d.dist.label, 130 * s, 1);

        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        // Proportions follow the watch screen; minimum gaps keep square canvases from colliding.
        const divY = Math.max(H * 0.65, bigY + 110 * s);
        ctx.fillRect(m, divY, W - m - W * 0.04, Math.max(1, 2 * s));
        ctx.restore();

        // Up to six stats, skipping ones the file has no data for.
        const paceNum = d.useSpeed ? d.pace.num : d.pace.num.replace(':', "'");
        const bestNum = d.best && !d.useSpeed ? d.best.num.replace(':', "'") : d.best && d.best.num;
        const cells = [
          { num: d.time.clock, label: 'Activity Time' },
          { num: paceNum, unit: d.pace.unit, label: d.useSpeed ? 'Avg. Speed' : 'Avg. Pace' },
          d.cadence && { num: d.cadence.num, unit: d.cadence.unit, label: d.cadence.label },
          d.hr && { num: d.hr.num, unit: d.hr.unit, label: d.hr.label },
          d.best && { num: bestNum, unit: d.best.unit, label: d.best.label },
          { num: d.elev.num, unit: d.elev.unit, label: d.elev.label },
          d.elapsed && { num: d.elapsed.clock, label: d.elapsed.label },
        ].filter(Boolean).slice(0, 6);
        const cols = [m, W * 0.445, W * 0.73];
        const row1 = Math.max(H * 0.73, divY + 90 * s);
        const rows = [row1, Math.max(H * 0.86, row1 + 130 * s)];
        cells.forEach((c, i) => stat(cols[i % 3], rows[Math.floor(i / 3)], c.num, c.unit, c.label, 74 * s));
      },
    },

    // ---------- TTRC running club ----------
    {
      id: 'ttrc-classic',
      name: 'TTRC Classic',
      desc: 'Centered running stats and route with the STRAVA | TTRC lockup.',
      draw(ctx, W, H, d) {
        classicLayout(ctx, W, H, d, [d.dist, d.pace, d.time],
          (x, y, s) => OV.lockup(ctx, d, x, y, 58 * s, 'center', W * 0.84));
      },
    },
    {
      id: 'kl-classic',
      name: 'KL Bisiklista Classic',
      desc: 'Centered stats and route with the STRAVA | KL BISIKLISTA lockup.',
      draw(ctx, W, H, d) {
        classicLayout(ctx, W, H, d, [d.dist, d.pace, d.time],
          (x, y, s) => OV.lockup(ctx, d, x, y, 60 * s, 'center', W * 0.9, 'kl'));
      },
    },
    {
      id: 'ttrc-side',
      name: 'TTRC Side',
      desc: 'Route on the left, lockup and stat column on the right.',
      draw(ctx, W, H, d) {
        const s = W / 1080;
        const rw = W * 0.38, rh = H * 0.24;
        OV.drawRoute(ctx, d.route, { x: W * 0.07, y: H / 2 - rh / 2, w: rw, h: rh }, { width: 12 * s * d.rw });

        const x = W * 0.52, colW = W * 0.42;
        const o = { labelSize: 26 * s, valueSize: 54 * s, gap: 34 * s, align: 'left', labelWeight: 700, maxWidth: colW };
        const items = [d.dist, d.pace, d.time];
        const logoSize = 52 * s, logoGap = 56 * s;
        let y = H / 2 - (logoSize * 0.72 + logoGap + OV.stackHeight(items, o)) / 2;
        y += logoSize * 0.72;
        OV.lockup(ctx, d, x, y, logoSize, 'left', colW);
        OV.stack(ctx, items, x, y + logoGap, o);
      },
    },
    {
      id: 'ttrc-pace',
      name: 'TTRC Pace',
      desc: 'Huge average pace for running, with distance and time beneath.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2;
        let y = H * 0.1 + 34 * s * 0.8;
        OV.text(ctx, d.pace.label.toUpperCase(), cx, y, { size: 30 * s, weight: 700, color: ORANGE, spacing: 8 * s });
        const ns = OV.fitSize(ctx, d.pace.num, W * 0.85, 250 * s, 900);
        y += 30 * s + ns * 0.72;
        OV.text(ctx, d.pace.num, cx, y, { size: ns, weight: 900 });
        y += 70 * s;
        // Pace units ("/km") read as "PER KM"; speed units ("km/h", "mph") stay as written.
        const unit = d.pace.unit.startsWith('/') ? `PER ${d.pace.unit.slice(1).toUpperCase()}` : d.pace.unit;
        OV.text(ctx, unit, cx, y, { size: 34 * s, weight: 700, spacing: 10 * s, alpha: 0.85 });
        const rowBottom = OV.row(ctx, [d.dist, d.time], W * 0.15, W * 0.7, y + 70 * s, { labelSize: 28 * s, valueSize: 58 * s, dividers: true });
        const rw = W * 0.5, rh = Math.min(220 * s, H * 0.15), ry = rowBottom + 90 * s;
        OV.drawRoute(ctx, d.route, { x: cx - rw / 2, y: ry, w: rw, h: rh }, { width: 11 * s * d.rw });
        OV.lockup(ctx, d, cx, ry + rh + 130 * s, 56 * s, 'center', W * 0.84);
      },
    },
    {
      id: 'ttrc-bar',
      name: 'TTRC Bar',
      desc: 'Lockup up top, route in the middle, divided stat bar at the bottom.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2;
        OV.lockup(ctx, d, cx, H * 0.08 + 44 * s, 60 * s, 'center', W * 0.84);
        const rowTop = H - 110 * s - (30 * 0.8 + 64 * 1.05) * s;
        OV.row(ctx, [d.dist, d.pace, d.time], 40 * s, W - 80 * s, rowTop, { labelSize: 30 * s, valueSize: 64 * s, dividers: true });
        const rw = W * 0.7, rh = H * 0.32;
        OV.drawRoute(ctx, d.route, { x: cx - rw / 2, y: (H * 0.08 + 40 * s + rowTop) / 2 - rh / 2, w: rw, h: rh }, {
          width: 13 * s * d.rw, markers: true,
        });
      },
    },

    // ---------- APIMYCC cycling club ("STRAVA | APIMYCC" lockup) ----------
    {
      id: 'apimycc-classic',
      name: 'APIMYCC Classic',
      desc: 'Centered ride stats and route with the STRAVA | APIMYCC lockup.',
      draw(ctx, W, H, d) {
        classicLayout(ctx, W, H, d, [d.dist, d.speed, d.time],
          (x, y, s) => OV.lockup(ctx, d, x, y, 54 * s, 'center', W * 0.84, 'apimycc'));
      },
    },
    {
      id: 'apimycc-bar',
      name: 'APIMYCC Ride Bar',
      desc: 'Lockup up top, big route, four-stat ride bar along the bottom.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2;
        const lb = H * 0.08 + 44 * s;
        OV.lockup(ctx, d, cx, lb, 58 * s, 'center', W * 0.84, 'apimycc');
        const rowTop = H - 110 * s - (28 * 0.8 + 56 * 1.05) * s;
        OV.row(ctx, [d.dist, d.speed, d.elev, d.time], 30 * s, W - 60 * s, rowTop, {
          labelSize: 28 * s, valueSize: 56 * s, dividers: true,
        });
        const top = lb + 90 * s, avail = rowTop - 90 * s - top;
        const rh = Math.max(0, Math.min(H * 0.4, avail));
        OV.drawRoute(ctx, d.route, { x: W * 0.12, y: top + (avail - rh) / 2, w: W * 0.76, h: rh }, {
          width: 13 * s * d.rw, markers: true,
        });
      },
    },
    {
      id: 'apimycc-side',
      name: 'APIMYCC Side',
      desc: 'Route on the left; lockup and a four-stat column on the right.',
      draw(ctx, W, H, d) {
        const s = W / 1080;
        const rw = W * 0.38, rh = H * 0.26;
        OV.drawRoute(ctx, d.route, { x: W * 0.07, y: H / 2 - rh / 2, w: rw, h: rh }, { width: 12 * s * d.rw });

        const x = W * 0.52, colW = W * 0.43;
        const o = { labelSize: 26 * s, valueSize: 52 * s, gap: 30 * s, align: 'left', labelWeight: 700, maxWidth: colW };
        const items = [d.dist, d.speed, d.elev, d.time];
        const logoSize = 48 * s, logoGap = 56 * s;
        const top = H / 2 - (logoSize * 0.72 + logoGap + OV.stackHeight(items, o)) / 2;
        const lb = top + logoSize * 0.72;
        OV.lockup(ctx, d, x, lb, logoSize, 'left', colW, 'apimycc');
        OV.stack(ctx, items, x, lb + logoGap, o);
      },
    },
    {
      id: 'apimycc-hero',
      name: 'APIMYCC Hero',
      desc: 'Large route, a big lockup and a one-line ride summary.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2;
        const rw = W * 0.76, rh = H * 0.36, ry = H * 0.4 - rh / 2;
        OV.drawRoute(ctx, d.route, { x: cx - rw / 2, y: ry, w: rw, h: rh }, { width: 13 * s * d.rw, markers: true });
        const lb = ry + rh + 140 * s;
        OV.lockup(ctx, d, cx, lb, 70 * s, 'center', W * 0.88, 'apimycc');

        const parts = [d.dist.value, d.speed.value, d.elev.value];
        const sep = '  \u2022  ';
        const full = parts.join(sep);
        const size = OV.fitSize(ctx, full, W - 120 * s, 50 * s, 800);
        const y = lb + 100 * s + size * 0.72;
        let x = cx - OV.measure(ctx, full, size, 800) / 2;
        parts.forEach((p, i) => {
          if (i) x += OV.text(ctx, sep, x, y, { size, weight: 800, align: 'left', color: ORANGE });
          x += OV.text(ctx, p, x, y, { size, weight: 800, align: 'left' });
        });
        OV.text(ctx, `${d.time.label}  ${d.time.value}`, cx, y + 70 * s, { size: 34 * s, weight: 600, alpha: 0.85 });
      },
    },
    {
      id: 'apimycc-climb',
      name: 'APIMYCC Climb',
      desc: 'Lockup and stat row up top, route in the middle, elevation profile at the bottom.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2;
        const lb = H * 0.07 + 40 * s;
        OV.lockup(ctx, d, cx, lb, 54 * s, 'center', W * 0.84, 'apimycc');
        const rowBottom = OV.row(ctx, [d.dist, d.elev, d.time], 40 * s, W - 80 * s, lb + 70 * s, {
          labelSize: 28 * s, valueSize: 56 * s, dividers: true,
        });

        const ph = H * 0.17, py = H - ph - 60 * s;
        OV.drawProfile(ctx, d.profile, { x: 0, y: py, w: W, h: ph }, { width: 5 * s });
        const rtop = rowBottom + 90 * s, avail = py - 90 * s - rtop;
        const rh = Math.max(0, Math.min(H * 0.32, avail));
        OV.drawRoute(ctx, d.route, { x: cx - W * 0.33, y: rtop + (avail - rh) / 2, w: W * 0.66, h: rh }, { width: 12 * s * d.rw });
      },
    },
  ];

  // Hand outlines on a 100 x 130 grid (back of the hand, fingers up). Each shape is
  // a list of paths: the closed outline first, then open strokes for creases/thumb.
  const HANDS = {
    middle: {
      w: 100,
      h: 130,
      paths: [
        [['M', 16, 124], ['L', 10, 88], ['L', 12, 66], ['L', 24, 58], ['L', 38, 58],
          ['L', 39, 9], ['C', 39, -3, 59, -3, 59, 9], ['L', 60, 58],
          ['L', 72, 58], ['L', 77, 64], ['L', 86, 64], ['L', 92, 72],
          ['L', 92, 98], ['L', 82, 118], ['L', 72, 124], ['Z']],
        [['M', 38, 58], ['L', 38, 72]],
        [['M', 60, 58], ['L', 60, 72]],
        [['M', 76, 64], ['L', 76, 76]],
      ],
    },
    // Rock-on / devil horns, palm view: index and pinky up, middle and ring folded
    // under the thumb. Drawn thumb-left (a left hand) and mirrored into a right hand.
    horns: {
      w: 100,
      h: 130,
      mirror: true,
      weight: 0.7,
      paths: [
        // Index finger
        [['M', 12, 72], ['L', 7, 11], ['A', 16, 11, 9, 1, 2], ['L', 31, 50]],
        // Pinky, palm, wrist cuff and the thumb wrapping over the folded fingers
        [['M', 69, 52], ['L', 75.5, 12], ['A', 84, 12, 8.5, 1, 2], ['L', 88, 82],
          ['L', 83, 110], ['L', 81, 115], ['L', 81, 127], ['L', 15, 127], ['L', 15, 115],
          ['L', 9, 108], ['L', 1.5, 80], ['L', 27.3, 59.3],
          ['A', 34, 66, 9.5, -0.75, 0.25], ['L', 21, 92]],
        // Folded middle finger (top-left hidden behind the thumb)
        [['M', 32, 56.7], ['L', 32, 47], ['A', 40.5, 47, 8.5, 1, 2], ['L', 49, 79], ['A', 40.5, 79, 8.5, 0, 0.88]],
        // Folded ring finger
        [['M', 49, 47], ['A', 58.5, 47, 9.5, 1, 2], ['L', 68, 79], ['A', 58.5, 79, 9.5, 0, 1]],
      ],
    },
  };

  function drawHand(ctx, shape, box, width) {
    const sc = Math.min(box.w / shape.w, box.h / shape.h);
    const mx = (x) => (shape.mirror ? shape.w - x : x);
    const P = (x, y) => [box.x + mx(x) * sc, box.y + y * sc];
    ctx.save();
    ctx.strokeStyle = ORANGE;
    ctx.lineWidth = width * (shape.weight || 1);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const path of shape.paths) {
      for (const [cmd, ...a] of path) {
        if (cmd === 'M') ctx.moveTo(...P(a[0], a[1]));
        else if (cmd === 'L') ctx.lineTo(...P(a[0], a[1]));
        else if (cmd === 'C') ctx.bezierCurveTo(...P(a[0], a[1]), ...P(a[2], a[3]), ...P(a[4], a[5]));
        else if (cmd === 'A') {
          // Arc: center, radius, start/end angles in multiples of PI, drawn clockwise.
          // Mirroring flips the angles and the direction.
          const [cx, cy] = P(a[0], a[1]);
          const a0 = a[3] * Math.PI, a1 = a[4] * Math.PI;
          if (shape.mirror) ctx.arc(cx, cy, a[2] * sc, Math.PI - a0, Math.PI - a1, true);
          else ctx.arc(cx, cy, a[2] * sc, a0, a1);
        }
        else ctx.closePath();
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  // Hand on the left, wordmark and Distance / Elev Gain / Time on the right.
  function handLayout(ctx, W, H, d, shape) {
    const s = W / 1080;
    const hw = W * 0.34, hh = (hw * shape.h) / shape.w;
    drawHand(ctx, shape, { x: W * 0.12, y: H / 2 - hh / 2, w: hw, h: hh }, 24 * s * d.rw);

    const x = W * 0.56;
    const o = { labelSize: 26 * s, valueSize: 52 * s, gap: 34 * s, align: 'left', labelWeight: 700, maxWidth: W * 0.38 };
    const items = [d.dist, d.elev, d.time];
    const wmH = d.wordmark ? 64 * s * 0.75 + 34 * s : 0;
    let y = H / 2 - (wmH + OV.stackHeight(items, o)) / 2;
    if (d.wordmark) {
      y += 64 * s * 0.75;
      OV.wordmark(ctx, d, x, y, 64 * s, 'left', undefined, W * 0.38);
      y += 34 * s;
    }
    OV.stack(ctx, items, x, y, o);
  }

  // Centered stat stack, then the route, then a logo line (`footer`). The route gets
  // the whole area between the stats and the logo (70% of the width), so a tall
  // north-south route grows tall instead of shrinking to fit a short, wide strip.
  // On shorter canvases (square/portrait) the stats are a bit tighter and the logo
  // sits near the bottom edge, leaving more room for the route.
  function classicLayout(ctx, W, H, d, items, footer) {
    const s = W / 1080, cx = W / 2;
    const short = H / W < 1.5;
    const k = short ? 0.8 : 1;
    const y = OV.stack(ctx, items, cx, H * 0.09, {
      labelSize: 36 * s * k, valueSize: 84 * s * k, gap: 90 * s * k, maxWidth: W * 0.86,
    });
    const top = y + 90 * s * k;
    const footerY = short ? H - 110 * s : H * 0.76;
    const minH = Math.min(170 * s, H * 0.11);
    const rh = Math.max(minH, footerY - 140 * s * k - top);
    OV.drawRoute(ctx, d.route, { x: cx - W * 0.35, y: top, w: W * 0.7, h: rh }, { width: 11 * s * d.rw });
    footer(cx, top + rh + 140 * s * k, s);
  }

  OV.templates = templates;

  // Variation tabs. A template belongs to the group its id starts with
  // ("ttrc-classic" -> TTRC); everything else is in STRAVA.
  OV.groups = [
    { id: 'strava', name: 'STRAVA' },
    { id: 'ttrc', name: 'TTRC' },
    { id: 'kl', name: 'BISIKLISTA' },
    { id: 'apimycc', name: 'APIMYCC' },
  ];
  for (const t of templates) {
    const g = OV.groups.find((grp) => grp.id !== 'strava' && t.id.startsWith(`${grp.id}-`));
    t.group = g ? g.id : 'strava';
  }
})(window.OV);
