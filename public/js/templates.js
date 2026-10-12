// Overlay templates. Every template draws on a transparent canvas using only
// white type and Strava orange (#FC4C02). Layouts scale from a 1080px-wide
// reference (s = W / 1080) so they work at any export or thumbnail size.
window.OV = window.OV || {};

(function (OV) {
  const { ORANGE, WHITE } = OV;

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
      id: 'contents',
      name: 'Contents',
      desc: 'Table-of-contents list of every stat in the file, with dot leaders beside an orange accent bar.',
      draw(ctx, W, H, d) {
        const s = W / 1080, short = H / W < 1.5;
        const rows = allStats(d);
        const x = 110 * s, x1 = W - 80 * s;
        const head = 150 * s;
        const rowH = Math.min((short ? 64 : 84) * s, (H * (short ? 0.72 : 0.7) - head) / rows.length);
        const fs = Math.min(34 * s, rowH * 0.48);
        const blockH = head + rows.length * rowH;
        const top = (H - blockH) / 2 - (short ? 20 : 40) * s;

        ctx.save();
        ctx.fillStyle = ORANGE;
        OV.roundRect(ctx, x - 44 * s, top, 8 * s, blockH, 4 * s);
        ctx.fill();
        ctx.restore();
        OV.text(ctx, 'CONTENTS', x, top + 30 * s, { size: 26 * s, weight: 700, color: ORANGE, align: 'left', spacing: 5 * s });
        OV.text(ctx, d.name, x, top + 96 * s, { size: 52 * s, weight: 800, align: 'left', maxWidth: x1 - x });

        rows.forEach(([label, value], i) => {
          const y = top + head + i * rowH + rowH * 0.62;
          const lw = OV.text(ctx, label.toUpperCase(), x, y, { size: fs * 0.8, weight: 700, align: 'left', spacing: 3 * s, alpha: 0.85 });
          const vw = OV.text(ctx, value, x1, y, { size: fs, weight: 800, align: 'right' });
          // Dot leaders between label and value.
          const dx0 = x + lw + 18 * s, dx1 = x1 - vw - 18 * s;
          ctx.save();
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          for (let dx = dx0; dx < dx1; dx += 14 * s) {
            ctx.beginPath();
            ctx.arc(dx, y - 3 * s, 2.2 * s, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        });
        OV.wordmark(ctx, d, x, Math.min(H - 40 * s, top + blockH + 90 * s), 36 * s, 'left');
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

        // Compact list: short rows and thin bars.
        const rows = groupSplits(d.splits, 12);
        const areaH = H * 0.3;
        if (rows.length) {
          const rowH = Math.min(40 * s, areaH / rows.length);
          const barH = rowH * 0.42, fs = Math.min(24 * s, rowH * 0.6);
          const paces = rows.map((r) => r.paceSecs);
          const fast = Math.min(...paces), slow = Math.max(...paces);
          const barX = x0 + 80 * s, barMax = W * 0.42;
          rows.forEach((r, i) => {
            const cy = y + rowH * (i + 0.5);
            const bw = barMax * (0.45 + 0.55 * ((slow - r.paceSecs) / (slow - fast || 1)));
            OV.text(ctx, r.label, x0, cy + fs * 0.36, { size: fs, weight: 700, align: 'left' });
            ctx.save();
            ctx.fillStyle = ORANGE;
            OV.roundRect(ctx, barX, cy - barH / 2, bw, barH, barH / 2);
            ctx.fill();
            ctx.restore();
            OV.text(ctx, OV.fmtPace(r.paceSecs), barX + bw + 16 * s, cy + fs * 0.36, { size: fs, weight: 700, align: 'left' });
          });
          y += rowH * rows.length;
        } else {
          OV.text(ctx, '\u2014', x0, y + 40 * s, { size: 40 * s, align: 'left' });
          y += 60 * s;
        }

        const rowTop = H - 100 * s - (28 * 0.8 + 56 * 1.05) * s;
        OV.row(ctx, [d.dist, d.pace, d.time], 40 * s, W - 80 * s, rowTop, { labelSize: 28 * s, valueSize: 56 * s });
        const top = y + 60 * s, avail = rowTop - 80 * s - top;
        const rh = Math.max(0, Math.min(H * 0.3, avail));
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
        const c = stravaCells(d);
        const cells = [c.dist, c.elev, c.time, c.power, c.pace, c.calories];

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

    {
      id: 'stacked',
      name: 'Stacked Route',
      desc: 'The route repeated in fading layers like an extruded ribbon, with a big italic distance.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2;
        const short = H / W < 1.5;
        const layers = 20, step = (short ? 11 : 15) * s;
        // Always the thinnest route (the Route thickness slider's minimum, 0.5x), not
        // the slider value: thin layers keep the ribbon's grooves crisp.
        stackedRoute(ctx, d.route, { x: W * 0.14, y: H * 0.07, w: W * 0.72, h: H * (short ? 0.5 : 0.52) },
          layers, step, 32 * s * 0.5, 4 * s);

        // Big italic distance, then elevation / time / pace in a row spanning its width.
        const up = (str) => str.replace(/\s+/g, '').toUpperCase();
        const big = up(`${d.dist.num}${d.dist.unit}`);
        const size = Math.min(210 * s, (210 * s * W * 0.86) / measureItalic(ctx, big, 210 * s));
        const y = H * (short ? 0.68 : 0.64);
        const bw = italicText(ctx, big, cx, y, size, 'center');
        const rowY = y + 80 * s, rs = 44 * s;
        italicText(ctx, up(d.elev.value), cx - bw / 2 + 10 * s, rowY, rs, 'left');
        italicText(ctx, d.time.clock, cx, rowY, rs, 'center');
        italicText(ctx, up(`${d.pace.num}${d.pace.unit}`), cx + bw / 2 - 10 * s, rowY, rs, 'right');
        OV.wordmark(ctx, d, cx, H - 90 * s, 34 * s);
      },
    },
    {
      id: 'course-data',
      name: 'Course Data',
      desc: 'A spec-sheet table of four stats over a lime elevation profile with start and high-point markers.',
      draw(ctx, W, H, d) {
        courseLayout(ctx, W, H, d, false);
      },
    },
    {
      id: 'course-route',
      name: 'Course Route',
      desc: 'Course Data with the route drawn in the middle as a thin lime line, like the elevation profile.',
      draw(ctx, W, H, d) {
        courseLayout(ctx, W, H, d, true);
      },
    },
    {
      id: 'course-line',
      name: 'Race Line',
      desc: 'Minimal ink-line look: a heart-rate line (elevation without heart rate) from an open start dot to a solid finish dot, the title, a rule and three stats.',
      draw(ctx, W, H, d) {
        const s = W / 1080, F = OV.DIN;
        const x0 = W * 0.1, x1 = W * 0.9;
        const titleSize = 66 * s, statSize = 54 * s, lw = 4 * s;
        // Laid out bottom-up so the block sits in the lower part of the frame.
        const statsY = H - H * 0.09;
        const ruleY = statsY - statSize - 34 * s;
        const titleY = ruleY - 34 * s;
        const ph = W * 0.22;
        const profBox = { x: x0 + 14 * s, y: titleY - titleSize - 56 * s - ph, w: x1 - x0 - 28 * s, h: ph };

        // Heart rate across the activity; elevation when the file has no heart rate.
        const hr = binSeries(d.route, (p) => p.hr, 120);
        const series = hr ? hr.map((e, i) => ({ d: i, e })) : d.profile;
        const prof = OV.drawProfile(ctx, series, profBox, { width: lw, rgb: '255,255,255', fill: false, minRange: 20 });
        if (prof) {
          const a = prof.pts[0], b = prof.pts[prof.pts.length - 1], r = 12 * s;
          ctx.save();
          ctx.shadowColor = 'transparent';
          ctx.lineWidth = lw;
          ctx.strokeStyle = ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
          ctx.stroke(); // start: open circle
          ctx.beginPath();
          ctx.arc(b.x, b.y, r * 1.15, 0, Math.PI * 2);
          ctx.fill(); // finish: solid dot
          ctx.restore();
        }

        OV.text(ctx, d.name.toUpperCase(), x0, titleY, {
          size: titleSize, weight: 500, family: F, align: 'left', spacing: 6 * s, maxWidth: x1 - x0,
        });
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.fillRect(x0, ruleY, x1 - x0, Math.max(1, 3 * s));
        ctx.restore();
        const o = { size: statSize, weight: 500, family: F, spacing: 1 * s };
        OV.text(ctx, d.dist.value, x0, statsY, { ...o, align: 'left' });
        OV.text(ctx, d.pace.value, (x0 + x1) / 2, statsY, { ...o, align: 'center' });
        OV.text(ctx, d.time.clock, x1, statsY, { ...o, align: 'right' });
      },
    },
    {
      id: 'course-contents',
      name: 'Contents',
      desc: 'A table-of-contents list: monospace title, bold labels, dot leaders and monospace figures, with the location beneath.',
      draw(ctx, W, H, d) {
        const s = W / 1080;
        const x0 = W * 0.08, x1 = W * 0.92;
        const labelSize = 54 * s, valSize = 50 * s, rowH = 72 * s;
        const titleSize = 48 * s, titleGap = 110 * s, locGap = 96 * s;
        const mono = { size: valSize, weight: 500, family: OV.MONO, align: 'left' };
        const fig = (v) => String(v).toUpperCase().replace(/\s+/g, ''); // "5.08 km" -> "5.08KM"
        const rows = [
          ['Distance', d.dist.value],
          [d.useSpeed ? 'Speed' : 'Pace', d.pace.value],
          ['Time', d.time.clock],
          ['Elevation', d.elev.value],
          d.hr && ['Heart rate', `${d.hr.num}bpm`],
          d.cadence && ['Cadence', `${d.cadence.num}${d.cadence.unit}`],
          d.power && ['Power', d.power.value],
          d.calories && ['Calories', d.calories.value],
        ].filter(Boolean).map(([l, v]) => [l.toUpperCase(), fig(v)]);

        // Figures share a left edge, as far right as the widest one allows.
        const valX = x1 - Math.max(...rows.map(([, v]) => OV.measure(ctx, v, valSize, 500, 0, OV.MONO)));
        const dotW = OV.measure(ctx, '.', valSize, 500, 0, OV.MONO);
        // Laid out bottom-up so the block sits in the lower part of the frame:
        // title, the list, then the location (when known) centred under it.
        const loc = d.location ? d.location.toUpperCase() : '';
        let y = H - H * 0.1 - (loc ? locGap : 0) - rowH * (rows.length - 1);
        OV.text(ctx, d.name.toUpperCase(), (x0 + x1) / 2, y - titleGap, {
          size: titleSize, weight: 500, family: OV.MONO, align: 'center', spacing: 6 * s, maxWidth: x1 - x0,
        });
        if (loc) {
          OV.text(ctx, loc, (x0 + x1) / 2, y + rowH * (rows.length - 1) + locGap, {
            size: labelSize, weight: 800, family: OV.INTER, align: 'center', maxWidth: x1 - x0,
          });
        }
        for (const [label, value] of rows) {
          const lw = OV.text(ctx, label, x0, y, {
            size: labelSize, weight: 800, family: OV.INTER, align: 'left', maxWidth: (valX - x0) * 0.75,
          });
          // Dot leaders from just after the label up to the figures.
          const n = Math.floor((valX - (x0 + lw + 10 * s)) / dotW);
          if (n > 0) OV.text(ctx, '.'.repeat(n), valX, y, { ...mono, align: 'right' });
          OV.text(ctx, value, valX, y, mono);
          y += rowH;
        }
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

    // ---------- KL Bisiklista cycling club ----------
    {
      id: 'kl-classic',
      name: 'KL Bisiklista Classic',
      desc: 'Centered stats and route with the STRAVA | KL BISIKLISTA lockup.',
      draw(ctx, W, H, d) {
        classicLayout(ctx, W, H, d, [d.dist, d.pace, d.time],
          (x, y, s) => OV.lockup(ctx, d, x, y, 60 * s, 'center', W * 0.9, 'kl'));
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

    // ---------- White: minimalist, white only, light type and hairlines ----------
    {
      id: 'white-hairline',
      name: 'Hairline',
      desc: 'Thin white route, a hairline rule and three light stats.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2;
        const rw = W * 0.56, rh = H * 0.3, ry = H * 0.36 - rh / 2;
        OV.drawRoute(ctx, d.route, { x: cx - rw / 2, y: ry, w: rw, h: rh }, { width: 5 * s * d.rw, color: WHITE });
        const ly = H * 0.68;
        hairline(ctx, cx - W * 0.38, ly - 80 * s, W * 0.76, s);
        const colW = (W - 160 * s) / 3;
        [d.dist, d.pace, d.time].forEach((it, i) => {
          const x = 80 * s + colW * (i + 0.5);
          capsLabel(ctx, it.label, x, ly, 22 * s);
          OV.text(ctx, it.value, x, ly + 74 * s, { size: 54 * s, weight: 300, family: OV.INTER, maxWidth: colW * 0.9 });
        });
        OV.wordmark(ctx, d, cx, ly + 230 * s, 28 * s);
      },
    },
    {
      id: 'white-caption',
      name: 'Caption',
      desc: 'Editorial caption in the bottom-left corner, small route top-right.',
      draw(ctx, W, H, d) {
        const s = W / 1080, x = 90 * s, F = OV.INTER;
        const rw = W * 0.3, rh = Math.min(H * 0.16, 260 * s);
        OV.drawRoute(ctx, d.route, { x: W - x - rw, y: 110 * s, w: rw, h: rh }, { width: 5 * s * d.rw, color: WHITE, align: 'right' });

        let y = H - 120 * s;
        if (d.wordmark) {
          OV.wordmark(ctx, d, x, y, 28 * s, 'left');
          y -= 100 * s;
        }
        // Stats on one line, separated by faint slashes.
        const parts = [d.dist.value, d.pace.value, d.time.value];
        const sep = '   /   ';
        const size = OV.fitSize(ctx, parts.join(sep), W - 2 * x, 46 * s, 300, 0, F);
        let sx = x;
        parts.forEach((p, i) => {
          if (i) sx += OV.text(ctx, sep, sx, y, { size, weight: 300, family: F, align: 'left', alpha: 0.5 });
          sx += OV.text(ctx, p, sx, y, { size, weight: 300, family: F, align: 'left' });
        });
        y -= size + 44 * s;
        hairline(ctx, x, y, 120 * s, s);
        y -= 44 * s;
        OV.text(ctx, d.name, x, y, { size: 64 * s, weight: 600, family: F, align: 'left', maxWidth: W - 2 * x });
        if (d.date) capsLabel(ctx, d.date, x, y - 84 * s, 22 * s, 'left');
      },
    },
    {
      id: 'white-number',
      name: 'Quiet Number',
      desc: 'One large, light distance figure with pace and time beneath.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2, F = OV.INTER;
        const short = H / W < 1.5;
        const ns = OV.fitSize(ctx, d.dist.num, W * 0.8, (short ? 240 : 300) * s, 300, 0, F);
        const y = H * 0.45;
        const rh = Math.min(H * 0.14, 150 * s), rw = W * 0.4;
        OV.drawRoute(ctx, d.route, { x: cx - rw / 2, y: y - ns * 0.72 - 80 * s - rh, w: rw, h: rh }, { width: 5 * s * d.rw, color: WHITE });
        OV.text(ctx, d.dist.num, cx, y, { size: ns, weight: 300, family: F });
        capsLabel(ctx, d.dist.long, cx, y + 80 * s, 24 * s);
        const colW = W * 0.3, ry = y + 190 * s;
        [d.pace, d.time].forEach((it, i) => {
          const x = cx + (i ? 1 : -1) * colW / 2;
          capsLabel(ctx, it.label, x, ry, 20 * s);
          OV.text(ctx, it.value, x, ry + 62 * s, { size: 44 * s, weight: 400, family: F, maxWidth: colW * 0.9 });
        });
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(cx - Math.max(1, s), ry - 22 * s, Math.max(1, 2 * s), 90 * s);
        ctx.restore();
        OV.wordmark(ctx, d, cx, H - 100 * s, 28 * s);
      },
    },
    {
      id: 'white-frame',
      name: 'Frame',
      desc: 'Thin white border with a stat in each corner and the route in the middle.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2, F = OV.INTER;
        const m = 60 * s, p = m + 50 * s;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = Math.max(1, 2 * s);
        ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
        ctx.restore();

        const ls = 20 * s, vs = 48 * s, maxW = W * 0.36;
        const corner = (it, x, top, align) => {
          capsLabel(ctx, it.label, x, top + ls * 0.8, ls, align);
          OV.text(ctx, it.value, x, top + ls * 0.8 + vs * 1.2, { size: vs, weight: 300, family: F, align, maxWidth: maxW });
        };
        const blockH = ls * 0.8 + vs * 1.2;
        corner(d.dist, p, p, 'left');
        corner(d.pace, W - p, p, 'right');
        corner(d.time, p, H - p - blockH, 'left');
        corner(d.elev, W - p, H - p - blockH, 'right');

        const rw = W * 0.6, rh = H * 0.34;
        OV.drawRoute(ctx, d.route, { x: cx - rw / 2, y: H / 2 - rh / 2, w: rw, h: rh }, { width: 5 * s * d.rw, color: WHITE });
        OV.wordmark(ctx, d, cx, H - p, 26 * s);
      },
    },

    {
      id: 'white-echo',
      name: 'Echo',
      desc: 'Big italic distance echoed downward in fading outlines, with the stats on top.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2;
        const up = (str) => str.replace(/\s+/g, '').toUpperCase();
        const big = up(`${d.dist.num}${d.dist.unit}`);
        const size = Math.min(230 * s, (230 * s * W * 0.84) / measureItalic(ctx, big, 230 * s));
        const bw = measureItalic(ctx, big, size);
        // Elevation / time / pace across the distance's width, above it.
        const rowY = H * 0.07 + 34 * s, rs = 46 * s;
        italicText(ctx, up(d.elev.value), cx - bw / 2 + 10 * s, rowY, rs, 'left');
        italicText(ctx, d.time.clock, cx, rowY, rs, 'center');
        italicText(ctx, up(`${d.pace.num}${d.pace.unit}`), cx + bw / 2 - 10 * s, rowY, rs, 'right');
        echoText(ctx, big, cx, rowY + 30 * s + size * 0.74, size, 3, size * 0.5, 5 * s, 3.5 * s);
      },
    },

    {
      id: 'white-sketch',
      name: 'Sketch',
      desc: 'The route as a hand-drawn white line, with the stats in handwriting below.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2;
        const short = H / W < 1.5;
        const rw = W * 0.68, top = H * (short ? 0.08 : 0.1), rh = H * (short ? 0.6 : 0.56);
        sketchRoute(ctx, d.route, { x: cx - rw / 2, y: top, w: rw, h: rh }, 7 * s * d.rw, s);
        const y = H * (short ? 0.88 : 0.87);
        const cells = [
          `${d.dist.num}${d.dist.unit}`,
          d.elev.value.replace(/\s+/g, ''),
          d.time.clock,
        ];
        cells.forEach((c, i) => OV.text(ctx, c, cx + (i - 1) * W * 0.27, y, {
          size: 58 * s, weight: 700, family: OV.HAND, spacing: 4 * s, alpha: 0.92, maxWidth: W * 0.25,
        }));
      },
    },

    // ---------- Map: a real street map under the route (js/map.js), Strava app style ----------
    {
      id: 'map-activity',
      name: 'Activity Page',
      desc: 'Like the Strava activity screen: map on top, white sheet with title and stats.',
      draw(ctx, W, H, d) { activityPage(ctx, W, H, d, false); },
    },
    {
      id: 'map-activity-3d',
      name: 'Activity Page 3D',
      desc: 'Activity Page with a tilted 3D satellite map: real terrain, with the route draped over it.',
      draw(ctx, W, H, d) { activityPage(ctx, W, H, d, true); },
    },
    {
      id: 'map-card',
      name: 'Feed Card',
      desc: 'A Strava feed post: white card with title, stats and the route on a map.',
      draw(ctx, W, H, d) { feedCard(ctx, W, H, d, [[d.dist, d.pace, d.time]]); },
    },
    {
      id: 'map-card-stats',
      name: 'Feed Card Stats',
      desc: 'Feed Card with six stats like the Strava stat screen: power from the file, calories from Strava.',
      draw(ctx, W, H, d) {
        const c = stravaCells(d);
        feedCard(ctx, W, H, d, [[c.dist, c.pace, c.time], [c.elev, c.power, c.calories]]);
      },
    },
    {
      id: 'map-tile',
      name: 'Map Tile',
      desc: 'Rounded map square with the route, stats and wordmark in white below.',
      draw(ctx, W, H, d) {
        const s = W / 1080, cx = W / 2;
        const short = H / W < 1.5;
        const size = Math.min(W * 0.84, H * (short ? 0.58 : 0.5));
        const y0 = short ? 70 * s : H * 0.12;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 40 * s;
        ctx.shadowOffsetY = 8 * s;
        ctx.fillStyle = '#FFFFFF';
        OV.roundRect(ctx, cx - size / 2, y0, size, size, 36 * s);
        ctx.fill();
        ctx.restore();
        OV.drawMap(ctx, d.route, { x: cx - size / 2, y: y0, w: size, h: size }, { radius: 36 * s, width: 9 * d.rw });
        const bottom = OV.row(ctx, [d.dist, d.pace, d.time], 40 * s, W - 80 * s, y0 + size + 70 * s, {
          labelSize: 28 * s, valueSize: 58 * s,
        });
        OV.wordmark(ctx, d, cx, bottom + (short ? 90 : 130) * s, 40 * s);
      },
    },
    {
      id: 'map-full',
      name: 'Full Map',
      desc: 'Edge-to-edge map with the stats in a floating white bar at the bottom.',
      draw(ctx, W, H, d) {
        const s = W / 1080;
        const bh = 210 * s, bx = 50 * s, by = H - bh - 70 * s;
        OV.drawMap(ctx, d.route, { x: 0, y: 0, w: W, h: H }, {
          inner: { x: W * 0.1, y: H * 0.1, w: W * 0.8, h: by - H * 0.1 - 70 * s },
          width: 9 * d.rw,
        });
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.22)';
        ctx.shadowBlur = 30 * s;
        ctx.shadowOffsetY = 6 * s;
        ctx.fillStyle = '#FFFFFF';
        OV.roundRect(ctx, bx, by, W - 2 * bx, bh, 28 * s);
        ctx.fill();
        ctx.restore();
        noShadow(ctx, () => {
          mapStats(ctx, [d.dist, d.pace, d.time], bx, W - 2 * bx, by + 50 * s, 24 * s, 50 * s, 'center');
          OV.wordmark(ctx, d, W / 2, by + bh - 34 * s, 20 * s, 'center', ORANGE);
        });
      },
    },

    // ---------- Apple Fitness inspired ----------
    {
      id: 'apple-rings',
      name: 'Activity Rings',
      desc: 'Apple Fitness inspired: three rings fill toward distance, time and climbing goals.',
      draw(ctx, W, H, d) {
        const s = W / 1080, short = H / W < 1.5, F = OV.INTER;
        const g = ringGoals(d);
        const rings = [
          { label: 'Distance', color: APPLE.red, ...g.dist },
          { label: 'Time', color: APPLE.green, ...g.time },
          { label: 'Climb', color: APPLE.cyan, ...g.elev },
        ];
        const R = W * (short ? 0.22 : 0.3);
        const cx = short ? W * 0.3 : W / 2, cy = short ? H / 2 : H * 0.33;
        drawRings(ctx, cx, cy, R, R * 0.2, rings);
        const x = short ? W * 0.58 : W * 0.14;
        let y = short ? H / 2 - 210 * s : cy + R + 140 * s;
        for (const r of rings) {
          OV.text(ctx, r.label, x, y, { size: 34 * s, weight: 600, family: F, color: r.color, align: 'left' });
          OV.text(ctx, r.text, x, y + 70 * s, { size: 64 * s, weight: 600, family: F, color: r.color, align: 'left', maxWidth: W - x - 50 * s });
          y += 165 * s;
        }
      },
    },
    {
      id: 'apple-summary',
      name: 'Workout Summary',
      desc: 'Apple Fitness inspired: the workout summary, coloured metrics in a dark card.',
      draw(ctx, W, H, d) {
        const s = W / 1080, short = H / W < 1.5, F = OV.INTER;
        const cells = appleCells(d);
        const x = 50 * s, w = W - 100 * s, pad = 50 * s;
        const rowH = (short ? 150 : 190) * s, head = 170 * s;
        const h = pad + head + 3 * rowH + pad * 0.5;
        const y = short ? (H - h) / 2 - 30 * s : H - h - 160 * s;
        darkCard(ctx, x, y, w, h, 48 * s, s);
        noShadow(ctx, () => {
          sportIcon(ctx, x + pad + 52 * s, y + pad + 52 * s, 52 * s, d.useSpeed, APPLE.green);
          const tx = x + pad + 130 * s;
          OV.text(ctx, d.useSpeed ? 'Outdoor Cycle' : 'Outdoor Run', tx, y + pad + 46 * s, {
            size: 44 * s, weight: 600, family: F, align: 'left', maxWidth: w - pad * 2 - 130 * s,
          });
          if (d.date) OV.text(ctx, d.date, tx, y + pad + 92 * s, { size: 28 * s, weight: 400, family: F, align: 'left', color: APPLE.muted });
          const colW = (w - 2 * pad) / 2;
          cells.forEach((c, i) => {
            const cx = x + pad + (i % 2) * colW, ry = y + pad + head + Math.floor(i / 2) * rowH;
            if (i % 2 === 0) rule(ctx, x + pad, ry, w - 2 * pad, s, 0.14);
            OV.text(ctx, c.label, cx, ry + 46 * s, { size: 28 * s, weight: 400, family: F, align: 'left' });
            unitValue(ctx, c.num, c.unit, cx, ry + (short ? 116 : 136) * s, (short ? 60 : 74) * s, c.color, F, 'left', colW - 20 * s);
          });
        });
      },
    },
    {
      id: 'apple-pacemap',
      name: 'Pace Map',
      desc: 'Apple Fitness inspired: the route coloured by pace, from slowest (red) to fastest (green).',
      draw(ctx, W, H, d) {
        const s = W / 1080, short = H / W < 1.5, F = OV.INTER, cx = W / 2;
        const box = { x: W * 0.08, y: H * (short ? 0.06 : 0.1), w: W * 0.84, h: H * (short ? 0.5 : 0.5) };
        paceRoute(ctx, d.route, box, 14 * s * d.rw, s);
        let y = box.y + box.h + (short ? 60 : 110) * s;
        // Legend: slowest to fastest.
        const lw = W * 0.5, lx = cx - lw / 2;
        noShadow(ctx, () => {
          const g = ctx.createLinearGradient(lx, 0, lx + lw, 0);
          g.addColorStop(0, paceHue(0));
          g.addColorStop(0.5, paceHue(0.5));
          g.addColorStop(1, paceHue(1));
          ctx.fillStyle = g;
          OV.roundRect(ctx, lx, y, lw, 14 * s, 7 * s);
          ctx.fill();
        });
        OV.text(ctx, 'Slowest', lx, y + 50 * s, { size: 24 * s, weight: 400, family: F, align: 'left', alpha: 0.8 });
        OV.text(ctx, 'Fastest', lx + lw, y + 50 * s, { size: 24 * s, weight: 400, family: F, align: 'right', alpha: 0.8 });
        y += (short ? 110 : 150) * s;
        const cols = [
          ['Distance', d.dist.num, d.dist.unit.toUpperCase()],
          [d.useSpeed ? 'Avg. Speed' : 'Avg. Pace', d.pace.num, d.pace.unit.toUpperCase()],
          ['Time', d.time.clock, ''],
        ];
        const colW = (W - 120 * s) / 3;
        cols.forEach(([label, num, unit], i) => {
          const x = 60 * s + colW * (i + 0.5);
          OV.text(ctx, label, x, y, { size: 26 * s, weight: 400, family: F, alpha: 0.8 });
          unitValue(ctx, num, unit, x, y + 72 * s, 56 * s, '#FFFFFF', F, 'center', colW - 16 * s);
        });
      },
    },
    {
      id: 'apple-splits',
      name: 'Split Times',
      desc: 'Apple Fitness inspired: a splits table with time and pace per km (or mile), fastest in green.',
      draw(ctx, W, H, d) {
        const s = W / 1080, short = H / W < 1.5, F = OV.INTER;
        const x = 50 * s, w = W - 100 * s, pad = 50 * s;
        const rowH = (short ? 58 : 76) * s, head = 190 * s;
        // As many rows as fit (merging splits beyond that), card sized to the rows.
        const room = H - (short ? 60 : H * 0.1 / s) * s - (short ? 130 : 260) * s;
        const rows = splitRows(d.splits, Math.max(1, Math.floor((room - head - pad) / rowH)));
        const h = head + rows.length * rowH + pad;
        const top = short ? (H - h) / 2 - 30 * s : H - h - 260 * s;
        darkCard(ctx, x, top, w, h, 48 * s, s);
        const fastest = Math.min(...rows.map((r) => r.paceSecs));
        noShadow(ctx, () => {
          OV.text(ctx, d.splitsLabel, x + pad, top + pad + 40 * s, { size: 48 * s, weight: 600, family: F, align: 'left' });
          OV.text(ctx, `${d.dist.value} · ${d.pace.value}`, x + pad, top + pad + 88 * s, { size: 28 * s, weight: 400, family: F, align: 'left', color: APPLE.muted });
          const cols = [x + pad, x + w * 0.42, x + w - pad];
          const hy = top + head - 20 * s;
          [['#', 'left'], ['Time', 'left'], [d.useSpeed ? 'Speed' : 'Pace', 'right']].forEach(([t, a], i) => {
            OV.text(ctx, t, cols[i], hy, { size: 24 * s, weight: 600, family: F, align: a, color: APPLE.muted });
          });
          rows.forEach((r, i) => {
            const ry = top + head + i * rowH;
            rule(ctx, x + pad, ry, w - 2 * pad, s, 0.12);
            const by = ry + rowH * 0.66, fs = (short ? 30 : 36) * s;
            const pace = d.useSpeed ? `${(3600 / r.paceSecs).toFixed(1)}` : OV.fmtPace(r.paceSecs);
            OV.text(ctx, r.label, cols[0], by, { size: fs, weight: 600, family: F, align: 'left' });
            OV.text(ctx, OV.fmtPace(r.secs), cols[1], by, { size: fs, weight: 600, family: F, align: 'left', color: APPLE.yellow });
            OV.text(ctx, pace, cols[2], by, { size: fs, weight: 600, family: F, align: 'right', color: r.paceSecs === fastest ? APPLE.green : APPLE.cyan });
          });
        });
      },
    },
    {
      id: 'apple-heart',
      name: 'Heart Rate',
      desc: 'Apple Fitness inspired: heart-rate graph across the workout, with average and range (elevation if no heart rate).',
      draw(ctx, W, H, d) {
        const s = W / 1080, short = H / W < 1.5, F = OV.INTER;
        const hr = binSeries(d.route, (p) => p.hr, 120);
        const ft = d.elev.unit === 'ft';
        const elev = hr ? null : binSeries(d.route, (p) => (p.ele == null ? null : ft ? p.ele * 3.28084 : p.ele), 120);
        const vals = hr || elev;
        const color = hr ? APPLE.red : APPLE.green;
        const x = 50 * s, w = W - 100 * s, pad = 50 * s;
        const h = (short ? 0.78 : 0.56) * H;
        const y = short ? (H - h) / 2 - 20 * s : H - h - 200 * s;
        darkCard(ctx, x, y, w, h, 48 * s, s);
        noShadow(ctx, () => {
          if (hr) heartIcon(ctx, x + pad + 18 * s, y + pad + 22 * s, 22 * s, color);
          OV.text(ctx, hr ? 'Heart Rate' : 'Elevation', x + pad + (hr ? 50 : 0) * s, y + pad + 34 * s, { size: 38 * s, weight: 600, family: F, align: 'left', color });
          const big = hr ? d.hr.num : d.elev.num;
          const bw = OV.text(ctx, big, x + pad, y + pad + 180 * s, { size: 140 * s, weight: 600, family: F, align: 'left' });
          OV.text(ctx, hr ? 'BPM AVG' : `${d.elev.unit.toUpperCase()} GAIN`, x + pad + bw + 20 * s, y + pad + 180 * s, { size: 34 * s, weight: 600, family: F, align: 'left', color: APPLE.muted });
          if (vals) {
            const lo = Math.min(...vals), hi = Math.max(...vals);
            const range = `${Math.round(lo)}\u2013${Math.round(hi)} ${hr ? 'BPM' : d.elev.unit.toUpperCase()}`;
            OV.text(ctx, range, x + pad, y + pad + 236 * s, { size: 30 * s, weight: 400, family: F, align: 'left', color: APPLE.muted });
            const chart = { x: x + pad, y: y + pad + 300 * s, w: w - 2 * pad, h: h - pad * 2 - 360 * s };
            lineChart(ctx, vals, chart, color, s);
            OV.text(ctx, '0:00', chart.x, chart.y + chart.h + 44 * s, { size: 24 * s, weight: 400, family: F, align: 'left', color: APPLE.muted });
            OV.text(ctx, d.time.clock, chart.x + chart.w, chart.y + chart.h + 44 * s, { size: 24 * s, weight: 400, family: F, align: 'right', color: APPLE.muted });
          }
        });
      },
    },

    // ---------- Garmin inspired ----------
    {
      id: 'garmin-zones',
      name: 'HR Zones',
      desc: 'Garmin inspired: time in each heart-rate zone as coloured bars (splits if no heart rate).',
      draw(ctx, W, H, d) {
        const s = W / 1080, short = H / W < 1.5, F = OV.INTER;
        const zones = hrZones(d.route);
        const x = 50 * s, w = W - 100 * s, pad = 50 * s;
        const rowH = (short ? 104 : 140) * s, head = 210 * s;
        const rows = zones ? zones.rows : splitRows(d.splits, 5).map((r) => ({
          label: `${d.splitsLabel.replace(/s$/, '')} ${r.label}`, sub: d.useSpeed ? `${(3600 / r.paceSecs).toFixed(1)} ${d.pace.unit}` : `${OV.fmtPace(r.paceSecs)} ${d.pace.unit}`,
          secs: r.secs, color: GARMIN.blue,
        }));
        const h = pad + head + rows.length * rowH + pad * 0.6;
        const y = short ? (H - h) / 2 - 20 * s : H - h - 220 * s;
        darkCard(ctx, x, y, w, h, 28 * s, s);
        const total = rows.reduce((a, r) => a + r.secs, 0) || 1;
        const most = Math.max(...rows.map((r) => r.secs), 1);
        noShadow(ctx, () => {
          OV.text(ctx, zones ? 'Heart Rate Zones' : d.splitsLabel, x + pad, y + pad + 42 * s, { size: 46 * s, weight: 600, family: F, align: 'left' });
          const sub = zones ? `Avg ${d.hr.num} bpm · Max ${zones.max} bpm` : `${d.dist.value} · ${d.time.clock}`;
          OV.text(ctx, sub, x + pad, y + pad + 96 * s, { size: 28 * s, weight: 400, family: F, align: 'left', color: GARMIN.muted });
          const bx = x + pad, bw = w - 2 * pad;
          rows.forEach((r, i) => {
            const ry = y + pad + head + i * rowH;
            OV.text(ctx, r.label, bx, ry, { size: 30 * s, weight: 600, family: F, align: 'left' });
            OV.text(ctx, r.sub, bx + 150 * s, ry, { size: 24 * s, weight: 400, family: F, align: 'left', color: GARMIN.muted });
            OV.text(ctx, `${OV.fmtPace(r.secs)}  ·  ${Math.round((100 * r.secs) / total)}%`, bx + bw, ry, { size: 28 * s, weight: 600, family: F, align: 'right' });
            const barY = ry + 18 * s, barH = (short ? 22 : 28) * s;
            ctx.save();
            ctx.fillStyle = '#2C2C2E';
            OV.roundRect(ctx, bx, barY, bw, barH, barH / 2);
            ctx.fill();
            ctx.fillStyle = r.color;
            OV.roundRect(ctx, bx, barY, Math.max(barH, (bw * r.secs) / most), barH, barH / 2);
            ctx.fill();
            ctx.restore();
          });
        });
      },
    },
    {
      id: 'garmin-summary',
      name: 'Connect Summary',
      desc: 'Garmin inspired: a Garmin Connect style activity card with the route and six stats.',
      draw(ctx, W, H, d) {
        const s = W / 1080, short = H / W < 1.5, F = OV.INTER, C = OV.CONDENSED;
        const x = 50 * s, w = W - 100 * s, pad = 46 * s;
        const statsH = (short ? 250 : 330) * s, head = 150 * s;
        const mapH = short ? H * 0.3 : H * 0.36;
        const h = pad + head + mapH + statsH + pad * 0.4;
        const y = short ? (H - h) / 2 - 20 * s : H - h - 170 * s;
        darkCard(ctx, x, y, w, h, 28 * s, s);
        noShadow(ctx, () => {
          ctx.save();
          ctx.fillStyle = GARMIN.blue;
          OV.roundRect(ctx, x, y, w, 10 * s, 5 * s);
          ctx.fill();
          ctx.restore();
          sportIcon(ctx, x + pad + 44 * s, y + pad + 50 * s, 44 * s, d.useSpeed, GARMIN.blue);
          const tx = x + pad + 112 * s;
          OV.text(ctx, d.name, tx, y + pad + 44 * s, { size: 42 * s, weight: 600, family: F, align: 'left', maxWidth: w - pad * 2 - 112 * s });
          if (d.date) OV.text(ctx, d.date, tx, y + pad + 88 * s, { size: 26 * s, weight: 400, family: F, align: 'left', color: GARMIN.muted });
          const map = { x: x + pad, y: y + pad + head, w: w - 2 * pad, h: mapH - 30 * s };
          const pts = OV.drawRoute(ctx, d.route, map, { width: 8 * s * d.rw, color: GARMIN.blue });
          if (pts.length > 1) {
            dot(ctx, pts[0], 12 * s, '#3FBF5F');
            dot(ctx, pts[pts.length - 1], 12 * s, '#E5484D');
          }
          const cells = [
            ['Distance', d.dist.num, d.dist.unit],
            ['Time', d.time.clock, ''],
            [d.useSpeed ? 'Avg Speed' : 'Avg Pace', d.pace.num, d.pace.unit],
            ['Elev Gain', d.elev.num, d.elev.unit],
            d.hr ? ['Avg HR', d.hr.num, 'bpm'] : ['Elapsed', d.elapsed ? d.elapsed.clock : '—', ''],
            d.calories ? ['Calories', String(parseInt(d.calories.value, 10)), ''] : d.cadence ? ['Avg Cadence', d.cadence.num, d.cadence.unit] : ['Best ' + (d.dist.unit === 'mi' ? 'Mile' : 'Km'), d.best ? d.best.num : '—', ''],
          ];
          const colW = (w - 2 * pad) / 3, sy = y + pad + head + mapH;
          rule(ctx, x + pad, sy - 10 * s, w - 2 * pad, s, 0.14);
          cells.forEach(([label, num, unit], i) => {
            const cx = x + pad + colW * (i % 3);
            const ry = sy + Math.floor(i / 3) * (statsH / 2);
            unitValue(ctx, num, unit, cx, ry + (short ? 70 : 92) * s, (short ? 60 : 74) * s, '#FFFFFF', C, 'left', colW - 14 * s);
            OV.text(ctx, label, cx, ry + (short ? 104 : 132) * s, { size: 24 * s, weight: 400, family: F, align: 'left', color: GARMIN.muted });
          });
        });
      },
    },
    {
      id: 'garmin-elevation',
      name: 'Elevation Chart',
      desc: 'Garmin inspired: an elevation chart with gridlines and axis labels, plus ascent and height range.',
      draw(ctx, W, H, d) {
        const s = W / 1080, short = H / W < 1.5, F = OV.INTER, C = OV.CONDENSED;
        const x = 50 * s, w = W - 100 * s, pad = 46 * s;
        const h = H * (short ? 0.8 : 0.5);
        const y = short ? (H - h) / 2 - 20 * s : H - h - 220 * s;
        darkCard(ctx, x, y, w, h, 28 * s, s);
        const ft = d.elev.unit === 'ft';
        const conv = (m) => (ft ? m * 3.28084 : m);
        const prof = (d.profile || []).map((p) => ({ d: p.d, e: conv(p.e) }));
        noShadow(ctx, () => {
          OV.text(ctx, 'Elevation', x + pad, y + pad + 40 * s, { size: 44 * s, weight: 600, family: F, align: 'left' });
          if (prof.length < 2) {
            OV.text(ctx, 'No elevation in this file', x + pad, y + pad + 100 * s, { size: 28 * s, weight: 400, family: F, align: 'left', color: GARMIN.muted });
            return;
          }
          const es = prof.map((p) => p.e);
          const lo = Math.min(...es), hi = Math.max(...es);
          const stats = [['Total Ascent', d.elev.num], ['Max Elev', String(Math.round(hi))], ['Min Elev', String(Math.round(lo))]];
          const colW = (w - 2 * pad) / 3;
          stats.forEach(([label, v], i) => {
            unitValue(ctx, v, d.elev.unit, x + pad + colW * i, y + pad + 140 * s, 64 * s, '#FFFFFF', C, 'left', colW - 10 * s);
            OV.text(ctx, label, x + pad + colW * i, y + pad + 176 * s, { size: 24 * s, weight: 400, family: F, align: 'left', color: GARMIN.muted });
          });
          const chart = { x: x + pad + 70 * s, y: y + pad + 240 * s, w: w - 2 * pad - 70 * s, h: h - pad * 2 - 300 * s };
          elevationChart(ctx, prof, chart, lo, hi, s, d.dist.unit, F);
        });
      },
    },
  ];

  // ---------- Apple / Garmin inspired helpers ----------

  const APPLE = {
    red: '#FA114F', green: '#A6FF00', cyan: '#00E5FF', yellow: '#FFD60A', pink: '#FF375F',
    muted: 'rgba(235,235,245,0.6)',
  };
  // Garmin Connect blue and its heart-rate zone colours (zone 1 to 5).
  const GARMIN = { blue: '#11A9ED', muted: '#9A9A9F', z: ['#9E9E9E', '#1E88E5', '#43A047', '#FB8C00', '#E53935'] };

  const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const shade = (hex, k) => `rgb(${rgbOf(hex).map((v) => Math.round(v * k)).join(',')})`;
  const withAlpha = (hex, a) => `rgba(${rgbOf(hex).join(',')},${a})`;
  const clockSecs = (c) => {
    const p = String(c).split(':').map(Number);
    return p.some((v) => !isFinite(v)) ? 0 : p.reduce((a, v) => a * 60 + v, 0);
  };

  // Ring goals: how far distance, moving time and climbing are toward round targets
  // (bigger for rides). `f` is the fraction (above 1 = past the goal).
  function ringGoals(d) {
    const ride = d.useSpeed, mi = d.dist.unit === 'mi', ft = d.elev.unit === 'ft';
    const dist = parseFloat(d.dist.num) || 0;
    const mins = clockSecs(d.time.clock) / 60;
    const elev = parseFloat(d.elev.num) || 0;
    const dGoal = ride ? (mi ? 30 : 50) : (mi ? 6 : 10);
    const tGoal = ride ? 120 : 60;
    const eGoal = ft ? (ride ? 1500 : 300) : (ride ? 500 : 100);
    return {
      dist: { f: dist / dGoal, goal: dGoal, text: `${d.dist.num}/${dGoal}${d.dist.unit.toUpperCase()}` },
      time: { f: mins / tGoal, goal: tGoal, text: `${Math.round(mins)}/${tGoal}MIN` },
      elev: { f: elev / eGoal, goal: eGoal, text: `${Math.round(elev)}/${eGoal}${(d.elev.unit || 'm').toUpperCase()}` },
    };
  }

  // Apple-style activity rings, outermost first: a faint full track, then the progress
  // arc shading from dark to bright; a second lap goes on top with a shadow at its end.
  function drawRings(ctx, cx, cy, R, lw, rings) {
    const start = -Math.PI / 2;
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.lineCap = 'round';
    ctx.lineWidth = lw;
    rings.forEach((r, i) => {
      const rad = R - lw / 2 - i * lw * 1.12;
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = r.color;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const f = Math.max(0.005, Math.min(r.f, 2));
      let paint = r.color;
      if (ctx.createConicGradient) {
        paint = ctx.createConicGradient(start, cx, cy);
        paint.addColorStop(0, shade(r.color, 0.6));
        paint.addColorStop(Math.min(1, f), r.color);
        if (f < 1) paint.addColorStop(1, r.color);
      }
      ctx.strokeStyle = paint;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, start, start + Math.PI * 2 * Math.min(f, 1));
      ctx.stroke();
      if (f > 1) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = lw * 0.4;
        ctx.strokeStyle = r.color;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, start, start + Math.PI * 2 * (f - 1));
        ctx.stroke();
        ctx.restore();
      }
    });
    ctx.restore();
  }

  // Six workout metrics, Apple Watch summary colours: the four basics, then whatever
  // the file has (heart rate, calories, power, cadence, best split, elapsed time).
  function appleCells(d) {
    const u = (v) => String(v || '').toUpperCase();
    const extras = [
      d.hr && { label: 'Avg. Heart Rate', num: d.hr.num, unit: 'BPM', color: APPLE.red },
      d.calories && { label: 'Active Kilocalories', num: String(parseInt(d.calories.value, 10)), unit: 'CAL', color: APPLE.pink },
      d.power && { label: 'Avg. Power', num: String(parseInt(d.power.value, 10)), unit: 'W', color: APPLE.green },
      d.cadence && { label: 'Avg. Cadence', num: d.cadence.num, unit: u(d.cadence.unit), color: APPLE.cyan },
      d.best && { label: d.best.label, num: d.best.num, unit: u(d.best.unit), color: APPLE.cyan },
      d.elapsed && { label: 'Elapsed Time', num: d.elapsed.clock, unit: '', color: APPLE.yellow },
    ].filter(Boolean);
    const blank = { label: '', num: '', unit: '', color: '#FFFFFF' };
    return [
      { label: 'Workout Time', num: d.time.clock, unit: '', color: APPLE.yellow },
      { label: 'Distance', num: d.dist.num, unit: u(d.dist.unit), color: APPLE.cyan },
      { label: d.useSpeed ? 'Avg. Speed' : 'Avg. Pace', num: d.pace.num, unit: u(d.pace.unit), color: APPLE.cyan },
      { label: 'Elevation Gain', num: d.elev.num, unit: u(d.elev.unit), color: APPLE.green },
      extras[0] || blank,
      extras[1] || blank,
    ];
  }

  function darkCard(ctx, x, y, w, h, r, s) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 30 * s;
    ctx.shadowOffsetY = 8 * s;
    ctx.fillStyle = 'rgba(18,18,20,0.9)';
    OV.roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.restore();
  }

  function rule(ctx, x, y, w, s, alpha) {
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(x, y, w, Math.max(1, 2 * s));
    ctx.restore();
  }

  // A number with a smaller unit after it ("5.08KM"), shrunk to fit `maxW`.
  function unitValue(ctx, num, unit, x, y, size, color, family, align = 'left', maxW = Infinity) {
    num = String(num);
    const us = size * 0.5, gap = unit ? size * 0.08 : 0;
    const nw = OV.measure(ctx, num, size, 600, 0, family);
    const uw = unit ? OV.measure(ctx, unit, us, 600, 0, family) : 0;
    const k = Math.min(1, maxW / (nw + gap + uw || 1));
    const total = (nw + gap + uw) * k;
    const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    OV.text(ctx, num, x0, y, { size: size * k, weight: 600, family, align: 'left', color });
    if (unit) OV.text(ctx, unit, x0 + (nw + gap) * k, y, { size: us * k, weight: 600, family, align: 'left', color });
  }

  // Round workout icon: a runner, or a bike for rides, in white on a coloured disc.
  function sportIcon(ctx, cx, cy, r, ride, bg) {
    const k = (r * 1.25) / 100, X = (v) => cx + (v - 50) * k, Y = (v) => cy + (v - 50) * k;
    const lines = ride
      ? [[[26, 68], [44, 44], [66, 44], [74, 68]], [[44, 44], [52, 68], [26, 68]], [[40, 39], [50, 39]], [[66, 44], [63, 33], [72, 33]], [[54, 26], [47, 41]], [[52, 30], [64, 34]]]
      : [[[55, 32], [45, 60]], [[53, 38], [68, 48], [76, 40]], [[53, 38], [38, 44], [30, 56]], [[45, 60], [60, 72], [56, 90]], [[45, 60], [33, 76], [18, 78]]];
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ctx.fillStyle = bg === APPLE.green ? '#000000' : '#FFFFFF'; // dark glyph on Apple green
    ctx.lineWidth = 7 * k;
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const l of lines) {
      ctx.beginPath();
      l.forEach(([a, b], i) => (i ? ctx.lineTo(X(a), Y(b)) : ctx.moveTo(X(a), Y(b))));
      ctx.stroke();
    }
    if (ride) {
      for (const wx of [26, 74]) {
        ctx.beginPath();
        ctx.arc(X(wx), Y(68), 16 * k, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.arc(X(ride ? 54 : 60), Y(ride ? 18 : 20), (ride ? 7 : 9) * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function heartIcon(ctx, cx, cy, sz, color) {
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy + sz * 0.9);
    ctx.bezierCurveTo(cx - sz * 1.9, cy - sz * 0.3, cx - sz * 0.9, cy - sz * 1.6, cx, cy - sz * 0.6);
    ctx.bezierCurveTo(cx + sz * 0.9, cy - sz * 1.6, cx + sz * 1.9, cy - sz * 0.3, cx, cy + sz * 0.9);
    ctx.fill();
    ctx.restore();
  }

  // Map dot with a contrasting ring.
  function dot(ctx, p, r, color) {
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = color === '#FFFFFF' ? 'rgba(0,0,0,0.6)' : '#FFFFFF';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const meters = (a, b) => Math.hypot(
    (b.lon - a.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180), (b.lat - a.lat) * 111320);
  // Pace colour: 0 = slowest (red) to 1 = fastest (green).
  const paceHue = (t) => `hsl(${Math.round(Math.max(0, Math.min(1, t)) * 120)}, 95%, 52%)`;

  // The route coloured by local speed, like Apple Fitness's route map. Speeds are
  // spread over the 5th-95th percentile so a stop or a sprint doesn't flatten the rest.
  function paceRoute(ctx, route, box, lw, s) {
    if (!route || route.length < 2) return;
    const view = OV.routeView(route, box);
    const P = (p) => {
      const la = (p.lat * Math.PI) / 180;
      return { x: ((p.lon * Math.PI) / 180) * view.sc + view.ox, y: -Math.log(Math.tan(Math.PI / 4 + la / 2)) * view.sc + view.oy };
    };
    const step = Math.max(1, Math.floor(route.length / 900));
    const pts = route.filter((_, i) => i % step === 0);
    if (pts[pts.length - 1] !== route[route.length - 1]) pts.push(route[route.length - 1]);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + meters(pts[i - 1], pts[i]));
    const spd = pts.map((p, i) => {
      const a = Math.max(0, i - 4), b = Math.min(pts.length - 1, i + 4);
      const dt = pts[a].time != null && pts[b].time != null ? (pts[b].time - pts[a].time) / 1000 : 0;
      return dt > 0 ? (cum[b] - cum[a]) / dt : null;
    });
    const ok = spd.filter((v) => v != null).sort((a, b) => a - b);
    const lo = ok.length ? ok[Math.floor(ok.length * 0.05)] : 0;
    const hi = ok.length ? ok[Math.floor(ok.length * 0.95)] : 0;
    const xy = pts.map(P);
    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    xy.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; // dark casing so the colours read on photos
    ctx.lineWidth = lw + 6 * s;
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = lw;
    for (let i = 0; i < xy.length - 1; i++) {
      const v = spd[i] != null ? spd[i] : spd[i + 1];
      ctx.strokeStyle = v == null || hi <= lo ? paceHue(0.5) : paceHue((v - lo) / (hi - lo));
      ctx.beginPath();
      ctx.moveTo(xy[i].x, xy[i].y);
      ctx.lineTo(xy[i + 1].x, xy[i + 1].y);
      ctx.stroke();
    }
    ctx.restore();
    dot(ctx, xy[0], lw * 0.8, '#FFFFFF');
  }

  // Splits as table rows ({ label, secs, dist, paceSecs }), merged into at most `max`
  // rows; a short last split is labelled by its distance.
  function splitRows(splits, max) {
    const rows = (splits || []).map((sp) => ({ label: sp.dist < 0.995 ? sp.dist.toFixed(2) : sp.label, secs: sp.secs, dist: sp.dist }));
    const k = Math.max(1, Math.ceil(rows.length / max));
    const out = [];
    for (let i = 0; i < rows.length; i += k) {
      const c = rows.slice(i, i + k);
      const secs = c.reduce((a, r) => a + r.secs, 0), dist = c.reduce((a, r) => a + r.dist, 0);
      out.push({ label: c.length > 1 ? `${c[0].label}-${c[c.length - 1].label}` : c[0].label, secs, dist, paceSecs: secs / dist });
    }
    return out;
  }

  // `n` averaged values across the activity (by point order); null when the file has
  // the value on fewer than half of them.
  function binSeries(route, get, n) {
    const pts = route || [];
    if (pts.length < 2) return null;
    const out = [];
    for (let b = 0; b < n; b++) {
      let sum = 0, c = 0;
      for (let i = Math.floor((b * pts.length) / n); i < Math.floor(((b + 1) * pts.length) / n); i++) {
        const v = get(pts[i]);
        if (v != null && isFinite(v)) { sum += v; c++; }
      }
      out.push(c ? sum / c : null);
    }
    const good = out.filter((v) => v != null);
    if (good.length < n / 2) return null;
    let last = good[0];
    return out.map((v) => (v == null ? last : (last = v)));
  }

  // Filled line chart with faint gridlines.
  function lineChart(ctx, vals, box, color, s) {
    const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
    const pts = vals.map((v, i) => ({
      x: box.x + (box.w * i) / (vals.length - 1),
      y: box.y + box.h * 0.95 - ((v - lo) / span) * box.h * 0.9,
    }));
    const path = () => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    };
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    for (let i = 0; i <= 3; i++) ctx.fillRect(box.x, box.y + (box.h * i) / 3, box.w, Math.max(1, 1.5 * s));
    path();
    ctx.lineTo(box.x + box.w, box.y + box.h);
    ctx.lineTo(box.x, box.y + box.h);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
    g.addColorStop(0, withAlpha(color, 0.45));
    g.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = g;
    ctx.fill();
    path();
    ctx.strokeStyle = color;
    ctx.lineWidth = 5 * s;
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  // Time in the five heart-rate zones (% of max HR: 50/60/70/80/90). Max HR is the
  // higher of the activity's peak and 190, since the file has no age or profile.
  function hrZones(route) {
    const pts = (route || []).filter((p) => p.hr != null && p.time != null);
    if (pts.length < 10) return null;
    const maxObs = Math.max(...pts.map((p) => p.hr));
    const hrMax = Math.max(maxObs, 190);
    const bounds = [0.5, 0.6, 0.7, 0.8, 0.9];
    const secs = [0, 0, 0, 0, 0];
    for (let i = 1; i < pts.length; i++) {
      const dt = Math.min(10, Math.max(0, (pts[i].time - pts[i - 1].time) / 1000));
      const f = pts[i].hr / hrMax;
      let z = 0;
      for (let k = 0; k < 5; k++) if (f >= bounds[k]) z = k;
      secs[z] += dt;
    }
    const rows = [4, 3, 2, 1, 0].map((z) => ({
      label: `Zone ${z + 1}`,
      sub: z === 4 ? `> ${Math.round(hrMax * 0.9)} bpm` : `${Math.round(hrMax * bounds[z])}–${Math.round(hrMax * bounds[z + 1])} bpm`,
      secs: secs[z],
      color: GARMIN.z[z],
    }));
    return { rows, max: Math.round(maxObs) };
  }

  const niceStep = (x) => {
    const p = 10 ** Math.floor(Math.log10(x)), n = x / p;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
  };

  // Garmin Connect style elevation chart: dashed gridlines with height labels, a
  // green filled profile and distance labels underneath. `prof` is [{ d: metres, e }].
  function elevationChart(ctx, prof, box, lo, hi, s, distUnit, F) {
    const step = niceStep(Math.max(10, hi - lo) / 3);
    const y0 = Math.floor(lo / step) * step, y1 = Math.max(y0 + step, Math.ceil(hi / step) * step);
    const maxD = prof[prof.length - 1].d || 1;
    const X = (m) => box.x + (m / maxD) * box.w;
    const Y = (e) => box.y + box.h - ((e - y0) / (y1 - y0)) * box.h;
    const green = '#4CAF50';
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.setLineDash([6 * s, 6 * s]);
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    for (let v = y0; v <= y1 + 1e-6; v += step) {
      ctx.beginPath();
      ctx.moveTo(box.x, Y(v));
      ctx.lineTo(box.x + box.w, Y(v));
      ctx.stroke();
      OV.text(ctx, String(Math.round(v)), box.x - 14 * s, Y(v) + 8 * s, { size: 22 * s, weight: 400, family: F, align: 'right', color: GARMIN.muted });
    }
    ctx.setLineDash([]);
    const st = Math.max(1, Math.floor(prof.length / 400));
    const pts = prof.filter((_, i) => i % st === 0).map((p) => ({ x: X(p.d), y: Y(p.e) }));
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.lineTo(pts[pts.length - 1].x, box.y + box.h);
    ctx.lineTo(pts[0].x, box.y + box.h);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
    g.addColorStop(0, withAlpha(green, 0.6));
    g.addColorStop(1, withAlpha(green, 0.12));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.strokeStyle = green;
    ctx.lineWidth = 4 * s;
    ctx.lineJoin = 'round';
    ctx.stroke();
    const unitM = distUnit === 'mi' ? 1609.344 : 1000;
    [[0, 'left'], [0.5, 'center'], [1, 'right']].forEach(([f, align]) => {
      OV.text(ctx, `${((maxD * f) / unitM).toFixed(f ? 1 : 0)} ${distUnit}`, X(maxD * f), box.y + box.h + 38 * s, {
        size: 22 * s, weight: 400, family: F, align, color: GARMIN.muted,
      });
    });
    ctx.restore();
  }

  // Every stat the GPX file gives, as [label, value] rows; rows without data drop out.
  function allStats(d) {
    const pts = d.route || [];
    const vals = (get) => pts.map(get).filter((v) => v != null && isFinite(v));
    const ft = d.elev.unit === 'ft';
    const ele = vals((p) => p.ele).map((e) => (ft ? e * 3.28084 : e));
    const hrs = vals((p) => p.hr);
    const first = pts.find((p) => p.time != null);
    const start = first ? new Date(first.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;
    const elevUnit = ` ${d.elev.unit}`;
    return [
      d.date && ['Date', d.date],
      start && ['Start time', start],
      d.location && ['Location', d.location],
      ['Distance', d.dist.value],
      ['Moving time', d.time.clock],
      d.elapsed && ['Elapsed time', d.elapsed.clock],
      ['Avg pace', `${d.useSpeed ? OV.fmtPace(3600 / parseFloat(d.speed.num)) : d.pace.num} /${d.dist.unit}`],
      ['Avg speed', d.speed.value],
      d.best && [d.best.label, `${d.best.num} ${d.best.unit}`],
      ['Elevation gain', d.elev.value],
      ele.length && ['Max elevation', `${Math.round(Math.max(...ele))}${elevUnit}`],
      ele.length && ['Min elevation', `${Math.round(Math.min(...ele))}${elevUnit}`],
      d.hr && ['Avg heart rate', `${d.hr.num} bpm`],
      hrs.length && ['Max heart rate', `${Math.round(Math.max(...hrs))} bpm`],
      d.cadence && ['Avg cadence', `${d.cadence.num} ${d.cadence.unit}`],
      d.power && ['Avg power', d.power.value],
      d.splits && d.splits.length && [d.splitsLabel, String(d.splits.length)],
      ['Track points', pts.length.toLocaleString('en-US')],
    ].filter(Boolean);
  }

  // Runs `fn` with the page-wide text shadow turned off (dark text on white cards).
  function noShadow(ctx, fn) {
    ctx.save();
    ctx.shadowColor = 'transparent';
    fn();
    ctx.restore();
  }

  // Strava activity screen: the map on top (flat, or tilted 3D with terrain), then a
  // white sheet with the wordmark, title, date and three stats.
  function activityPage(ctx, W, H, d, three) {
    const s = W / 1080;
    const sheetY = H * (H / W < 1.5 ? 0.56 : 0.66);
    const r = 40 * s;
    OV.drawMap(ctx, d.route, { x: 0, y: 0, w: W, h: sheetY + r }, {
      inner: { x: W * 0.1, y: Math.max(H * 0.06, 90 * s), w: W * 0.8, h: sheetY - Math.max(H * 0.06, 90 * s) - 80 * s },
      width: 9 * d.rw,
      three,
    });
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 30 * s;
    ctx.fillStyle = '#FFFFFF';
    OV.roundRect(ctx, 0, sheetY, W, H - sheetY + r, r);
    ctx.fill();
    ctx.restore();

    noShadow(ctx, () => {
      const x = 70 * s;
      let y = sheetY + 110 * s;
      OV.wordmark(ctx, d, x, y - 4 * s, 26 * s, 'left', ORANGE);
      y += 90 * s;
      OV.text(ctx, d.name, x, y, { size: 56 * s, weight: 600, family: OV.INTER, color: OV.MAP_TEXT, align: 'left', maxWidth: W - 2 * x });
      if (d.date) OV.text(ctx, d.date, x, y + 50 * s, { size: 28 * s, weight: 400, family: OV.INTER, color: OV.MAP_MUTED, align: 'left' });
      mapStats(ctx, [d.dist, d.pace, d.time], x, W - 2 * x, y + 140 * s, 26 * s, 54 * s, 'left');
    });
  }

  // The six stats on Strava's stat screen, as { label, value }. Power comes from the
  // file and calories from Strava; when either is missing, another stat the
  // file does have (heart rate, cadence, best split, elapsed time) takes its place.
  function stravaCells(d) {
    const extras = [
      d.hr && { label: 'Avg Heart Rate', value: `${d.hr.num} bpm` },
      d.cadence && { label: 'Cadence', value: `${d.cadence.num} ${d.cadence.unit}` },
      d.best && { label: d.best.label, value: `${d.best.num} ${d.best.unit}` },
      d.elapsed && { label: 'Elapsed Time', value: d.elapsed.clock },
    ].filter(Boolean);
    const take = (stat) => stat || extras.shift() || { label: '', value: '' };
    return {
      dist: { label: d.dist.label, value: d.dist.value },
      elev: { label: 'Elevation Gain', value: d.elev.value },
      time: { label: 'Moving Time', value: d.time.clock },
      pace: d.useSpeed
        ? { label: 'Avg Speed', value: `${d.speed.num} ${d.speed.unit}` }
        : { label: 'Avg Pace', value: `${d.pace.num} ${d.pace.unit}` },
      power: take(d.power),
      calories: take(d.calories),
    };
  }

  // White Strava feed card at the bottom: title, date and wordmark, one or more rows
  // of three stats, then the route on a map.
  function feedCard(ctx, W, H, d, rows) {
    const s = W / 1080;
    const x0 = 60 * s, cw = W - 120 * s, pad = 50 * s, r = 32 * s;
    const pitch = 120 * s; // between stat rows
    const head = 330 * s + (rows.length - 1) * pitch;
    const mapH = Math.min(cw * 0.62, H - head - 2 * Math.max(80 * s, H * 0.06));
    const ch = head + mapH;
    const y0 = H - ch - Math.max(80 * s, H * 0.06);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 40 * s;
    ctx.shadowOffsetY = 8 * s;
    ctx.fillStyle = '#FFFFFF';
    OV.roundRect(ctx, x0, y0, cw, ch, r);
    ctx.fill();
    ctx.restore();

    noShadow(ctx, () => {
      const y = y0 + pad + 40 * s;
      OV.text(ctx, d.name, x0 + pad, y, { size: 44 * s, weight: 600, family: OV.INTER, color: OV.MAP_TEXT, align: 'left', maxWidth: cw - 2 * pad - 200 * s });
      OV.wordmark(ctx, d, x0 + cw - pad, y - 6 * s, 24 * s, 'right', ORANGE);
      if (d.date) OV.text(ctx, d.date, x0 + pad, y + 44 * s, { size: 26 * s, weight: 400, family: OV.INTER, color: OV.MAP_MUTED, align: 'left' });
      rows.forEach((items, i) => mapStats(ctx, items, x0 + pad, cw - 2 * pad, y + 110 * s + i * pitch, 24 * s, 46 * s, 'left'));
    });
    OV.drawMap(ctx, d.route, { x: x0, y: y0 + head, w: cw, h: mapH }, { radius: r, corners: 'bottom', width: 8 * d.rw });
  }

  // Strava app stat columns: grey label over a dark value, in Inter.
  function mapStats(ctx, items, x0, w, y, ls, vs, align) {
    const colW = w / items.length;
    items.forEach((it, i) => {
      const x = align === 'center' ? x0 + colW * (i + 0.5) : x0 + colW * i;
      OV.text(ctx, it.label, x, y + ls * 0.8, { size: ls, weight: 400, family: OV.INTER, color: OV.MAP_MUTED, align });
      OV.text(ctx, it.value, x, y + ls * 0.8 + vs * 1.15, {
        size: vs, weight: 600, family: OV.INTER, color: OV.MAP_TEXT, align, maxWidth: colW * 0.92,
      });
    });
  }

  // Small uppercase, letter-spaced, slightly faded label in Inter. Canvas adds the
  // spacing after the last letter too, so shift by it to keep the text centered.
  function capsLabel(ctx, str, x, y, size, align = 'center') {
    const sp = size * 0.25;
    const dx = align === 'center' ? sp / 2 : align === 'right' ? sp : 0;
    OV.text(ctx, String(str).toUpperCase(), x + dx, y, { size, weight: 600, family: OV.INTER, spacing: sp, align, alpha: 0.7 });
  }

  function hairline(ctx, x, y, w, s) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(x, y, w, Math.max(1, 2 * s));
    ctx.restore();
  }

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

  // A ▼ marker just above point `p` on an elevation profile, with a title and the
  // elevation beside it (to the left near the right edge).
  function profileMarker(ctx, p, title, sub, s, rgb, W) {
    const ty = p.y - 30 * s, tw = 11 * s;
    const px = Math.min(W - 40 * s, Math.max(40 * s, p.x)); // keep it on the canvas
    ctx.save();
    ctx.fillStyle = `rgb(${rgb})`;
    ctx.beginPath();
    ctx.moveTo(px - tw, ty - 18 * s);
    ctx.lineTo(px + tw, ty - 18 * s);
    ctx.lineTo(px, ty);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const left = px > W * 0.7;
    const x = left ? px - 24 * s : px + 24 * s;
    const align = left ? 'right' : 'left';
    OV.text(ctx, title.toUpperCase(), x, ty - 2 * s, { size: 26 * s, weight: 600, family: OV.DIN, align, spacing: 2 * s });
    OV.text(ctx, sub.toUpperCase(), x, ty + 28 * s, { size: 22 * s, weight: 500, family: OV.DIN, align, spacing: 1.5 * s, alpha: 0.75 });
  }

  // Course Data / Course Route: a spec-sheet table of four stats over a lime elevation
  // profile. With `withRoute`, the route fills the gap between them in the same lime.
  function courseLayout(ctx, W, H, d, withRoute) {
    const s = W / 1080, F = OV.DIN, LIME = '205,234,45';
    const short = H / W < 1.5;
    const up = (v) => String(v).toUpperCase();
    // Runs: distance, pace, time, climbing. Rides: distance, climbing, time, speed.
    const elev = d.elev.num === '—' ? d.elev.value : `${Number(d.elev.num).toLocaleString('en-US')} ${d.elev.unit}`;
    const rows = d.useSpeed
      ? [['Total distance', d.dist.value], ['Elevation gain', elev], ['Moving time', d.time.clock], ['Avg speed', d.pace.value]]
      : [['Total distance', d.dist.value], ['Avg pace', d.pace.value], ['Moving time', d.time.clock], ['Elevation gain', elev]];

    // Header and table, rules above each row.
    const x0 = W * 0.1, x1 = W * 0.9;
    const fs = 33 * s, sp = 2.5 * s, rowH = (short ? 66 : 82) * s;
    const cell = (str, x, y, align, color, alpha) => OV.text(ctx, up(str), align === 'right' ? x + sp : x, y, {
      size: fs, weight: 500, family: F, align, spacing: sp, color, alpha, maxWidth: (x1 - x0) * 0.6,
    });
    let y = H * (short ? 0.06 : 0.05) + fs;
    cell(d.useSpeed ? 'Ride' : 'Run', x0, y, 'left');
    cell(d.name, x1, y, 'right', `rgb(${LIME})`);
    y += fs * 1.25;
    cell('Data', x0, y, 'left');
    if (d.date) cell(d.date, x1, y, 'right', null, 0.6);
    y += rowH * 0.45;
    for (const [label, value] of rows) {
      hairline(ctx, x0, y, x1 - x0, s);
      y += rowH * 0.5 + fs * 0.36;
      cell(label, x0, y, 'left');
      cell(value, x1, y, 'right');
      y += rowH * 0.5 - fs * 0.36;
    }

    const ph = H * (short ? 0.26 : 0.22);

    // Route between the table and the profile (leaving room for the profile's markers),
    // as a thin lime line like the profile's.
    if (withRoute) {
      const top = y + 50 * s, bottom = H - ph - 70 * s;
      if (bottom - top > 80 * s) {
        const box = { x: x0, y: top, w: x1 - x0, h: bottom - top };
        const pts = OV.drawRoute(ctx, d.route, box, { width: 5 * s * d.rw, color: `rgb(${LIME})` });
        if (pts.length) {
          // Start: solid lime dot. Finish: lime ring (skipped on a loop, where they meet).
          const r = 9 * s;
          ctx.save();
          ctx.shadowColor = 'transparent';
          ctx.fillStyle = `rgb(${LIME})`;
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, r, 0, Math.PI * 2);
          ctx.fill();
          if (!isLoop(d.route)) {
            const e = pts[pts.length - 1];
            ctx.strokeStyle = `rgb(${LIME})`;
            ctx.lineWidth = 4 * s;
            ctx.beginPath();
            ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }

    // Elevation profile along the bottom, with the start and the high point marked.
    const prof = OV.drawProfile(ctx, d.profile, { x: 0, y: H - ph, w: W, h: ph }, { width: 4 * s, rgb: LIME, minRange: 30 });
    if (!prof) return;
    const toUnit = (m) => `${Math.round(d.elev.unit === 'ft' ? m * 3.28084 : m).toLocaleString('en-US')} ${d.elev.unit}`;
    const top = prof.samples.indexOf(Math.max(...prof.samples));
    const peak = prof.pts[top];
    profileMarker(ctx, peak, 'High point', toUnit(prof.samples[top]), s, LIME, W);
    if (peak.x - prof.pts[0].x > W * 0.3) {
      profileMarker(ctx, prof.pts[0], isLoop(d.route) ? 'Start / Finish' : 'Start', toUnit(prof.samples[0]), s, LIME, W);
    }
  }

  // True when the route ends within ~250 m of where it started.
  function isLoop(route) {
    if (!route || route.length < 2) return false;
    const a = route[0], b = route[route.length - 1];
    const dy = (b.lat - a.lat) * 111320;
    const dx = (b.lon - a.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180);
    return Math.hypot(dx, dy) < 250;
  }

  // The route drawn `n` times, each copy `step` lower and fainter, top copy in front,
  // like an extruded ribbon. A thin ring is erased around each copy before it is
  // drawn, so the grooves between layers are transparent and show the photo.
  function stackedRoute(ctx, route, box, n, step, width, gap) {
    if (!route || route.length < 2) return;
    const off = document.createElement('canvas');
    off.width = ctx.canvas.width;
    off.height = ctx.canvas.height;
    const o = off.getContext('2d');
    const view = OV.routeView(route, box);
    for (let i = n - 1; i >= 0; i--) {
      const f = i / (n - 1); // 0 = front (top), 1 = back (bottom)
      const v = { ...view, oy: view.oy + i * step };
      o.globalCompositeOperation = 'destination-out';
      o.globalAlpha = 1;
      OV.drawRoute(o, route, box, { view: v, width: width + 2 * gap, color: '#000' });
      o.globalCompositeOperation = 'source-over';
      o.globalAlpha = 1 - 0.92 * Math.pow(f, 1.3);
      // Deeper layers also darken a little, toward burnt orange.
      const k = f * 0.45;
      OV.drawRoute(o, route, box, { view: v, width, color: `rgb(${Math.round(252 - 130 * k)},${Math.round(76 - 46 * k)},2)` });
    }
    ctx.drawImage(off, 0, 0);
  }

  // The route as a white pen line: a gentle wobble along its length, plus a fainter
  // second pass slightly off the first, like ink that went over the line twice.
  function sketchRoute(ctx, route, box, width, s) {
    if (!route || route.length < 2) return;
    const pts = OV.fitRoute(route, box);
    const pass = (amp, phase, w, alpha) => {
      let len = 0;
      ctx.beginPath();
      pts.forEach((p, i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const dx = b.x - a.x, dy = b.y - a.y, n = Math.hypot(dx, dy) || 1;
        if (i) len += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
        // Smooth wobble: two slow waves along the line, in reference px.
        const t = len / s;
        const off = amp * s * (Math.sin(t / 37 + phase) + 0.6 * Math.sin(t / 13 + phase * 2.3));
        const x = p.x - (dy / n) * off, y = p.y + (dx / n) * off;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = WHITE;
      ctx.lineWidth = w;
      ctx.globalAlpha = alpha;
      ctx.stroke();
      ctx.restore();
    };
    pass(1.6, 0, width, 1);
    pass(2.4, 1.7, width * 0.45, 0.45);
  }

  // `str` in heavy italic with `n` echoes below it, each `step` lower: white outlines
  // with a fading fill, fainter with depth, front copy solid white. As in
  // stackedRoute, a ring is erased around each copy so the echoes read as layers.
  function echoText(ctx, str, x, y, size, n, step, gap, outline) {
    const off = document.createElement('canvas');
    off.width = ctx.canvas.width;
    off.height = ctx.canvas.height;
    const o = off.getContext('2d');
    o.font = ITALIC(size);
    o.textAlign = 'center';
    o.lineJoin = 'round';
    for (let i = n; i >= 0; i--) {
      const yy = y + i * step, a = 1 - i / (n + 1);
      o.globalCompositeOperation = 'destination-out';
      o.globalAlpha = 1;
      o.fillStyle = o.strokeStyle = '#000';
      o.lineWidth = 2 * (gap + outline);
      o.strokeText(str, x, yy);
      o.fillText(str, x, yy);
      o.globalCompositeOperation = 'source-over';
      if (!i) {
        o.fillStyle = WHITE;
        o.fillText(str, x, yy);
        continue;
      }
      // Outline: stroke at double width, then cut the letter shapes out, leaving only
      // the outer half. (Stroking alone also traces the glyphs' overlapping inner
      // contours.)
      o.globalAlpha = a;
      o.strokeStyle = WHITE;
      o.lineWidth = 2 * outline;
      o.strokeText(str, x, yy);
      o.globalCompositeOperation = 'destination-out';
      o.globalAlpha = 1;
      o.fillStyle = '#000';
      o.fillText(str, x, yy);
      o.globalCompositeOperation = 'source-over';
      const g = o.createLinearGradient(0, yy - size * 0.72, 0, yy);
      g.addColorStop(0, `rgba(255,255,255,${0.5 * a})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      o.fillStyle = g;
      o.fillText(str, x, yy);
    }
    ctx.drawImage(off, 0, 0);
  }

  const ITALIC = (size) => `italic 900 ${size.toFixed(1)}px "Montserrat", "Helvetica Neue", Arial, sans-serif`;

  function measureItalic(ctx, str, size) {
    ctx.save();
    ctx.font = ITALIC(size);
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  }

  // Heavy italic white text (the browser slants Montserrat Black); returns its width.
  function italicText(ctx, str, x, y, size, align) {
    ctx.save();
    ctx.font = ITALIC(size);
    ctx.fillStyle = WHITE;
    ctx.textAlign = align;
    ctx.fillText(str, x, y);
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w;
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

  // Template tabs, picked by the start of the template id (see PREFIX_GROUP);
  // everything else is in STRAVA.
  OV.groups = [
    { id: 'strava', name: 'STRAVA' },
    { id: 'clubs', name: 'CLUBS' },
    { id: 'white', name: 'WHITE' },
    { id: 'map', name: 'MAP' },
    { id: 'apple', name: 'APPLE' },
    { id: 'garmin', name: 'GARMIN' },
    { id: 'other', name: 'OTHERS' },
  ];
  // Template id prefix -> tab. The club layouts (TTRC, KL Bisiklista, APIMYCC) share CLUBS.
  const PREFIX_GROUP = { ttrc: 'clubs', kl: 'clubs', apimycc: 'clubs', white: 'white', map: 'map', apple: 'apple', garmin: 'garmin', course: 'other' };
  for (const t of templates) {
    const prefix = (t.id.match(/^([a-z]+)-/) || [])[1]; // "ttrc-side" -> ttrc; "map" has none
    t.group = PREFIX_GROUP[prefix] || 'strava';
  }
})(window.OV);
