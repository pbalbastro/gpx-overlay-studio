// Canvas drawing primitives shared by every overlay template.
window.OV = window.OV || {};

(function (OV) {
  const WHITE = '#FFFFFF';
  const ORANGE = '#FC4C02';
  const FONT = '"Montserrat", "Helvetica Neue", Arial, sans-serif';
  // Condensed face for the sports-watch style (Stats Grid).
  const CONDENSED = '"Barlow Condensed", "Arial Narrow", sans-serif';
  // Clean grotesque close to the Strava app's stat screen (Strava Stats).
  const INTER = '"Inter", "Helvetica Neue", Arial, sans-serif';

  function font(ctx, size, weight, family = FONT) {
    ctx.font = `${weight} ${Math.max(1, size).toFixed(1)}px ${family}`;
  }

  function spacing(ctx, px) {
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${px || 0}px`;
  }

  function measure(ctx, str, size, weight = 700, sp = 0, family = FONT) {
    ctx.save();
    font(ctx, size, weight, family);
    spacing(ctx, sp);
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  }

  // Shrink a font size until the string fits in maxW.
  function fitSize(ctx, str, maxW, size, weight = 700, sp = 0, family = FONT) {
    const w = measure(ctx, str, size, weight, sp, family);
    return w > maxW ? (size * maxW) / w : size;
  }

  function text(ctx, str, x, y, o = {}) {
    const weight = o.weight || 700;
    const family = o.family || FONT;
    const size = o.maxWidth ? fitSize(ctx, str, o.maxWidth, o.size, weight, o.spacing, family) : o.size;
    ctx.save();
    font(ctx, size, weight, family);
    spacing(ctx, o.spacing);
    ctx.fillStyle = o.color || WHITE;
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = 'alphabetic';
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.fillText(str, x, y);
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  }

  // ---------- stat blocks ----------

  // Vertical label/value pairs. `y` is the top; returns the last value's baseline.
  function stack(ctx, items, x, y, o) {
    const { labelSize: ls, valueSize: vs, gap = 0, align = 'center' } = o;
    items.forEach((it, i) => {
      if (i) y += gap;
      y += ls * 0.8;
      text(ctx, o.upper ? it.label.toUpperCase() : it.label, x, y, {
        size: ls, weight: o.labelWeight || 600, align, color: o.labelColor || WHITE,
        spacing: o.labelSpacing, alpha: o.labelAlpha,
      });
      y += vs * 1.05;
      text(ctx, it.value, x, y, { size: vs, weight: o.valueWeight || 800, align, maxWidth: o.maxWidth });
    });
    return y;
  }

  function stackHeight(items, o) {
    return items.length * (o.labelSize * 0.8 + o.valueSize * 1.05) + (items.length - 1) * (o.gap || 0);
  }

  // Evenly spaced columns of label/value pairs. `y` is the top; returns the bottom.
  function row(ctx, items, x0, w, y, o) {
    const n = items.length;
    const colW = w / n;
    const lb = y + o.labelSize * 0.8;
    const vb = lb + o.valueSize * 1.05;
    items.forEach((it, i) => {
      const x = x0 + colW * (i + 0.5);
      text(ctx, o.upper ? it.label.toUpperCase() : it.label, x, lb, {
        size: o.labelSize, weight: o.labelWeight || 600, color: o.labelColor || WHITE,
        spacing: o.labelSpacing, alpha: o.labelAlpha,
      });
      text(ctx, it.value, x, vb, { size: o.valueSize, weight: 800, maxWidth: colW * 0.9 });
      if (o.dividers && i) {
        ctx.save();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(x0 + colW * i - 1, y + 4, Math.max(1.5, o.labelSize * 0.06), vb - y - 4);
        ctx.restore();
      }
    });
    return vb;
  }

  // The wordmark is the STRAVA logotype drawn as a vector outline (like the TTRC
  // logo), traced from the official logo artwork, so every stroke keeps its exact
  // thickness at any size. Units: the logo is 1276.4 x 267.3; the S/T/R letters
  // span y 14.3-253.1. They are sized to the ink height of bold type at the
  // requested size, so layouts keep their spacing, and the pointed A/V peaks
  // overshoot slightly, as in the original.
  const STRAVA = {
    w: 1276.4,
    h: 267.3,
    x0: -0.6, // leftmost point of the S
    capTop: 14.3,
    capBottom: 253.1,
    path: new Path2D(
      'M1147.89 0L1275.45 251L1275.84 252L1275.31 253L1200 252.75L1148 151.04L1146.54 153L1096 252.71L1021 ' +
      '253.06L1020.09 252L1132.77 29ZM789.61 1L790 0.37L791 0.37L791.4 1L918.11 251L918.54 252L918.12 253L8' +
      '43 253.02L791 151.07L789.52 153L739.48 252L738 253.06L597 253.06L596 252.67L594.73 251L553.25 188L55' +
      '1 185.03L550 184.83L535 184.83L534.29 186L534 252.62L533 253.06L454.94 253L454.5 252L454.5 15L455 14' +
      '.32L574 14.32L586 14.61L598 15.75L614 18.78L629 23.75L644 31.6L651 36.65L657 42.27L662.3 48L668.37 5' +
      '7L672.21 65L675.16 74L677.22 85L677.74 94L677.4 109L676.24 117L673.43 127L670.46 134L666.4 141L661.3' +
      '1 148L654.73 155L649 160.17L642 165.25L632 170.89L631.19 172L672 231.49L673.36 230ZM104.05 10L120 9.' +
      '75L137 10.72L152 12.68L166 15.67L182 20.73L196 26.83L210 34.89L217 39.73L220.47 43L182 95.95L167 86.' +
      '87L156 81.68L148 78.72L132 74.63L118 72.77L106 72.7L101 73.65L98 74.95L95 77.37L93.58 80L93.58 85L94' +
      '.58 87L98 90.13L104 93.07L115 96.29L142 101.65L162 106.74L177 111.75L192 118.83L200 123.79L211.18 13' +
      '4L215.33 139L219.21 145L223.26 154L225.18 161L226.31 168L226.24 186L224.25 197L222.41 203L218.42 212' +
      'L214.13 219L209.48 225L201 233.5L190 241.3L180 246.42L173 249.25L155 254.39L144 256.21L133 257.21L11' +
      '2 257.37L88 255.3L71 252.25L53 247.36L42 243.32L31 238.43L23 234.21L12 227.31L4 221.33L-0.59 217L42 ' +
      '166.66L56 176.25L68 182.43L81 187.38L96 191.37L107 193.24L117 194.15L131 194.19L137 193.22L140 192.1' +
      '8L143 190.35L145.35 187L145.3 181L143 177.92L138 174.74L126 170.79L96 164.36L74 158.42L57 152.28L42 ' +
      '144.39L36 140.3L30 135.1L23.67 128L18 119L15.69 114L13.75 108L12.58 102L11.75 91L12.64 78L13.79 72L1' +
      '5.77 65L19.58 56L23.62 49L29.74 41L36 34.75L45 27.68L52 23.52L62 18.73L70 15.78L82 12.62L94 10.71ZM2' +
      '22.29 15L223 14.32L441 14.32L442.41 15L442.41 81L442 81.56L372.5 82L372.2 252L371.17 253L292.93 253L' +
      '292.46 252L292.26 82L223 81.68L222.29 81ZM840.96 15L842 14.32L917 14.46L969 116.48L970.28 115L1021 1' +
      '4.83L1022 14.32L1096 14.32L1097.11 15L975.24 256L970.16 266L969 267.34ZM534 81.25L533.39 82L533.39 1' +
      '27L534 127.94L568 127.94L577 127.27L584 125.31L588 123.33L592 120.26L595.45 116L597.39 112L598.43 10' +
      '7L598.4 101L597.36 96L594 90.27L590 86.61L587 84.82L581 82.58L575 81.52Z'
    ),
  };
  const usesLogo = (d) => !!d.wordmark;

  function wordmarkMetrics(ctx, d, size, sp = 0) {
    ctx.save();
    font(ctx, size, 800);
    spacing(ctx, sp);
    const m = ctx.measureText(d.wordmark || 'H');
    ctx.restore();
    const ascent = m.actualBoundingBoxAscent || size * 0.72;
    const descent = m.actualBoundingBoxDescent || 0;
    const sc = (ascent + descent) / (STRAVA.capBottom - STRAVA.capTop);
    return { width: STRAVA.w * sc, ascent, descent, sc };
  }

  // Draws the STRAVA logo left-aligned at x, sitting on the baseline; returns its width.
  function drawWordmarkAt(ctx, d, x, baseline, size, color = WHITE) {
    const mt = wordmarkMetrics(ctx, d, size);
    ctx.save();
    ctx.translate(x - STRAVA.x0 * mt.sc, baseline - mt.ascent - STRAVA.capTop * mt.sc);
    ctx.scale(mt.sc, mt.sc);
    ctx.fillStyle = color;
    ctx.fill(STRAVA.path, 'evenodd');
    ctx.restore();
    return mt.width;
  }

  // Logos are thinner and smaller than the stat numbers, so the page-wide soft shadow
  // washes out behind them on light photos. When shadows are on, logos get a tighter,
  // darker shadow, painted twice for density. With shadows off this does nothing extra.
  function withLogoShadow(ctx, inkH, draw) {
    if (ctx.shadowColor === 'rgba(0, 0, 0, 0)') return draw();
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = Math.max(2, inkH * 0.3);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.max(1, inkH * 0.04);
    draw();
    draw();
    ctx.restore();
  }

  function wordmark(ctx, d, x, y, size, align = 'center', color = WHITE, maxWidth = Infinity) {
    if (!usesLogo(d)) return;
    let w = wordmarkMetrics(ctx, d, size).width;
    if (w > maxWidth) {
      size *= maxWidth / w;
      w = maxWidth;
    }
    const sx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const mt = wordmarkMetrics(ctx, d, size);
    withLogoShadow(ctx, mt.ascent + mt.descent, () => drawWordmarkAt(ctx, d, sx, y, size, color));
  }

  // ---------- image logos (js/logos.js) ----------

  const logos = {};

  function loadLogos() {
    const src = OV.LOGO_SRC || {};
    return Promise.all(Object.keys(src).map((name) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { logos[name] = img; resolve(); };
      img.onerror = resolve;
      img.src = src[name];
    })));
  }

  // Draws a logo scaled to fit w x h; returns the drawn box.
  function drawLogo(ctx, name, box, align = 'center') {
    const img = logos[name];
    if (!img) return null;
    const sc = Math.min(box.w / img.width, box.h / img.height);
    const w = img.width * sc, h = img.height * sc;
    const x = align === 'left' ? box.x : align === 'right' ? box.x + box.w - w : box.x + (box.w - w) / 2;
    const y = box.y + (box.h - h) / 2;
    ctx.drawImage(img, x, y, w, h);
    return { x, y, w, h };
  }

  // ---------- TTRC club logo ----------

  // Letter skeletons on a grid 100 units tall. Each stroke is drawn as four
  // parallel stripes, like the club's retro inline lettering.
  const LOGO_STROKE = 22;
  const LOGO_W = 325;

  function logoPath(ctx) {
    const hw = LOGO_STROKE / 2;
    ctx.beginPath();
    for (const ox of [0, 74]) { // T, T
      ctx.moveTo(ox, hw); ctx.lineTo(ox + 64, hw);
      ctx.moveTo(ox + 32, hw); ctx.lineTo(ox + 32, 110);
    }
    const r = 148; // R
    ctx.moveTo(r + hw, 110); ctx.lineTo(r + hw, hw); ctx.lineTo(r + 36, hw);
    ctx.arc(r + 36, hw + 22, 22, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(r + hw, hw + 44);
    ctx.moveTo(r + 30, hw + 44); ctx.lineTo(r + 64, 108);
    const c = 227 + 49; // C, open on the right
    ctx.moveTo(c + 38 * Math.cos(0.21 * Math.PI), 50 + 39 * Math.sin(0.21 * Math.PI));
    ctx.ellipse(c, 50, 38, 39, 0, 0.21 * Math.PI, 1.79 * Math.PI);
  }

  function logoCanvas(h, color) {
    const sc = h / 100;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(LOGO_W * sc) + 2;
    cv.height = Math.ceil(h) + 2;
    const c = cv.getContext('2d');
    c.translate(1, 1);
    c.scale(sc, sc);
    c.beginPath();
    c.rect(-1, 0, LOGO_W + 2, 100);
    c.clip();
    c.lineJoin = 'miter';
    c.lineCap = 'butt';
    c.strokeStyle = color;
    // Alternate painting and erasing ever-narrower strokes: 7 bands -> 4 stripes.
    const u = LOGO_STROKE / 7;
    for (let k = 0; k < 4; k++) {
      c.globalCompositeOperation = k % 2 ? 'destination-out' : 'source-over';
      c.lineWidth = (7 - 2 * k) * u;
      logoPath(c);
      c.stroke();
    }
    return cv;
  }

  function drawClubLogo(ctx, x, top, h, color = WHITE) {
    ctx.drawImage(logoCanvas(h, color), x - 1, top - 1);
    return (LOGO_W * h) / 100;
  }

  // Club marks that sit beside the wordmark. `scale` is relative to the wordmark's
  // ink height: the striped TTRC logo reads lighter than solid type, so it is 20% taller.
  const MARKS = {
    ttrc: { scale: 1.2, aspect: () => LOGO_W / 100, draw: (ctx, x, top, h) => drawClubLogo(ctx, x, top, h) },
    apimycc: {
      scale: 1,
      aspect: () => (logos.apimycc ? logos.apimycc.width / logos.apimycc.height : 0),
      draw: (ctx, x, top, h) => ctx.drawImage(logos.apimycc, x, top, h * MARKS.apimycc.aspect(), h),
    },
    // KL BISIKLISTA: the chain-link K/L is taller than the letters, so the mark is
    // sized and centered by its letter band (BISI / ISTA), which matches the
    // wordmark at 1.15x; the chain extends above and below like in the original.
    kl: {
      get scale() { const k = OV.VECTOR_LOGOS.kl; return (1.15 * k.h) / (k.letterBottom - k.letterTop); },
      get center() { const k = OV.VECTOR_LOGOS.kl; return (k.letterTop + k.letterBottom) / 2 / k.h; },
      aspect: () => OV.VECTOR_LOGOS.kl.w / OV.VECTOR_LOGOS.kl.h,
      draw: (ctx, x, top, h) => drawVectorLogo(ctx, 'kl', x, top, h),
    },
  };

  const vectorPaths = {};
  function drawVectorLogo(ctx, name, x, top, h, color = WHITE) {
    const v = OV.VECTOR_LOGOS[name];
    const path = vectorPaths[name] || (vectorPaths[name] = new Path2D(v.path));
    const sc = h / v.h;
    ctx.save();
    ctx.translate(x, top);
    ctx.scale(sc, sc);
    ctx.fillStyle = color;
    ctx.fill(path, 'evenodd');
    ctx.restore();
  }

  // "STRAVA | <club>" on one line. The club mark is sized to the wordmark's ink
  // height (top of the letters to the bottom of their overshoot) and centered on
  // the same midline, so both share a top and bottom edge; the divider matches.
  function lockup(ctx, d, x, baseline, size, align = 'center', maxWidth = Infinity, markName = 'ttrc') {
    const mark = MARKS[markName];
    const wm = d.wordmark;
    const mt = wordmarkMetrics(ctx, d, size);
    const { ascent, descent } = mt;
    const inkH = ascent + descent;
    const mid = baseline - ascent + inkH / 2;
    const wmW = wm ? mt.width : 0;
    const gap = size * 0.42;
    const divW = Math.max(1, size * 0.05);
    const markH = inkH * mark.scale;
    const markW = markH * mark.aspect();
    const total = wmW + (wm && markW ? gap * 2 + divW : 0) + markW;
    if (total > maxWidth) return lockup(ctx, d, x, baseline, (size * maxWidth) / total, align, Infinity, markName);

    const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    withLogoShadow(ctx, inkH, () => {
      let sx = x0;
      if (wm) {
        drawWordmarkAt(ctx, d, sx, baseline, size);
        sx += wmW;
        if (markW) {
          sx += gap;
          ctx.save();
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          const divH = Math.min(markH, inkH * 1.3);
          ctx.fillRect(sx, mid - divH / 2, divW, divH);
          ctx.restore();
          sx += divW + gap;
        }
      }
      if (markW) mark.draw(ctx, sx, mid - markH * (mark.center ?? 0.5), markH);
    });
    return { width: total, capH: ascent };
  }

  // ---------- route ----------

  const projCache = new WeakMap();

  // Web-Mercator projection, downsampled for very long tracks.
  function projected(points) {
    let p = projCache.get(points);
    if (p) return p;
    const step = Math.max(1, Math.floor(points.length / 2000));
    const proj = (q) => {
      const la = (q.lat * Math.PI) / 180;
      return { x: (q.lon * Math.PI) / 180, y: -Math.log(Math.tan(Math.PI / 4 + la / 2)) };
    };
    p = [];
    for (let i = 0; i < points.length; i += step) p.push(proj(points[i]));
    if ((points.length - 1) % step) p.push(proj(points[points.length - 1]));
    projCache.set(points, p);
    return p;
  }

  function fitRoute(points, box, align = 'center') {
    const pr = projected(points);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const q of pr) {
      if (q.x < minX) minX = q.x;
      if (q.x > maxX) maxX = q.x;
      if (q.y < minY) minY = q.y;
      if (q.y > maxY) maxY = q.y;
    }
    const w = Math.max(maxX - minX, 1e-12);
    const h = Math.max(maxY - minY, 1e-12);
    const sc = Math.min(box.w / w, box.h / h);
    let ox = box.x - minX * sc;
    if (align === 'center') ox += (box.w - w * sc) / 2;
    else if (align === 'right') ox += box.w - w * sc;
    const oy = box.y - minY * sc + (box.h - h * sc) / 2;

    const out = [];
    let last = null;
    for (const q of pr) {
      const x = q.x * sc + ox;
      const y = q.y * sc + oy;
      if (!last || Math.hypot(x - last.x, y - last.y) >= 1.5) {
        last = { x, y };
        out.push(last);
      }
    }
    const end = pr[pr.length - 1];
    out.push({ x: end.x * sc + ox, y: end.y * sc + oy });
    return out;
  }

  function trace(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const e = pts[pts.length - 1];
    ctx.lineTo(e.x, e.y);
  }

  function drawRoute(ctx, points, box, o = {}) {
    if (!points || points.length < 2) return []; // e.g. a manual Strava activity with no GPS
    const pts = fitRoute(points, box, o.align);
    const w = o.width || 10;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (o.outline) {
      trace(ctx, pts);
      ctx.strokeStyle = WHITE;
      ctx.lineWidth = w + o.outline * 2;
      ctx.stroke();
      ctx.shadowColor = 'transparent';
    }
    trace(ctx, pts);
    ctx.strokeStyle = o.color || ORANGE;
    ctx.lineWidth = w;
    ctx.stroke();
    if (o.markers) {
      ctx.shadowColor = 'transparent';
      const a = pts[0];
      const b = pts[pts.length - 1];
      ctx.fillStyle = WHITE;
      ctx.beginPath();
      ctx.arc(a.x, a.y, w * 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x, b.y, w * 1.1, 0, Math.PI * 2);
      ctx.fillStyle = ORANGE;
      ctx.fill();
      ctx.lineWidth = w * 0.45;
      ctx.strokeStyle = WHITE;
      ctx.stroke();
    }
    ctx.restore();
    return pts;
  }

  // ---------- elevation profile ----------

  function drawProfile(ctx, profile, box, o = {}) {
    if (!profile || profile.length < 2) return false;
    const maxD = profile[profile.length - 1].d || 1;
    const N = 180;
    const samples = [];
    let j = 0;
    for (let i = 0; i <= N; i++) {
      const d = (maxD * i) / N;
      while (j < profile.length - 2 && profile[j + 1].d < d) j++;
      const a = profile[j];
      const b = profile[j + 1];
      const f = b.d > a.d ? Math.min(1, Math.max(0, (d - a.d) / (b.d - a.d))) : 0;
      samples.push(a.e + (b.e - a.e) * f);
    }
    let lo = Math.min(...samples);
    let hi = Math.max(...samples);
    if (hi - lo < 10) { const mid = (hi + lo) / 2; lo = mid - 5; hi = mid + 5; }
    const pts = samples.map((e, i) => ({
      x: box.x + (box.w * i) / N,
      y: box.y + box.h - ((e - lo) / (hi - lo)) * box.h * 0.85,
    }));

    ctx.save();
    ctx.shadowColor = 'transparent';
    const g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
    g.addColorStop(0, 'rgba(252,76,2,0.55)');
    g.addColorStop(1, 'rgba(252,76,2,0)');
    trace(ctx, pts);
    ctx.lineTo(box.x + box.w, box.y + box.h);
    ctx.lineTo(box.x, box.y + box.h);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    ctx.save();
    trace(ctx, pts);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = ORANGE;
    ctx.lineWidth = o.width || 5;
    ctx.stroke();
    ctx.restore();
    return true;
  }

  // ---------- misc ----------

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCover(ctx, img, W, H) {
    const sc = Math.max(W / img.width, H / img.height);
    const w = img.width * sc;
    const h = img.height * sc;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  }

  Object.assign(OV, {
    WHITE, ORANGE, CONDENSED, INTER, measure, fitSize, text, stack, stackHeight, row, wordmark, lockup, drawClubLogo, loadLogos, drawLogo,
    drawRoute, drawProfile, roundRect, drawCover,
  });
})(window.OV);
