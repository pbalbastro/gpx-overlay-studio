// UI wiring: file input, options, preview, thumbnails and PNG export.
(function (OV) {
  const $ = (id) => document.getElementById(id);
  const SIZES = { story: [1080, 1920], portrait: [1080, 1350], square: [1080, 1080] };
  const THUMB_W = 320;
  const PHONE_THUMB_W = 540; // phone carousel cards are shown large

  const state = {
    meta: null,
    stats: null,
    isDemo: true,
    selected: OV.templates[0].id,
    group: 'strava',
    bg: null,
    thumbs: new Map(),
    files: new Map(), // template id -> ready-to-share PNG File
  };

  function readOpts() {
    return {
      size: $('size').value,
      units: $('units').value,
      title: $('title').value.trim(),
      calories: state.calories, // only Strava activities carry calories
      location: state.location, // looked up from the start point (lookupLocation)
      shadow: $('shadow').checked,
      routeWidth: parseFloat($('routeWidth').value),
      includeBg: $('includeBg').checked,
    };
  }

  function paint(canvas, tpl, W, H, d, opts, bg) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    if (bg) OV.drawCover(ctx, bg, W, H);
    ctx.save();
    if (opts.shadow) {
      const s = W / 1080;
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 14 * s;
      ctx.shadowOffsetY = 2 * s;
    }
    tpl.draw(ctx, W, H, d);
    ctx.restore();
  }

  const tplById = (id) => OV.templates.find((t) => t.id === id) || OV.templates[0];
  const groupTemplates = () => OV.templates.filter((t) => t.group === state.group);

  // ---------- group tabs ----------

  function buildTabs() {
    const tabs = $('tabs');
    for (const g of OV.groups) {
      const count = OV.templates.filter((t) => t.group === g.id).length;
      if (!count) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab';
      btn.setAttribute('role', 'tab');
      btn.dataset.group = g.id;
      btn.innerHTML = `${g.name}<span class="tab-count">${count}</span>`;
      btn.addEventListener('click', () => setGroup(g.id));
      tabs.appendChild(btn);
    }
    try {
      const saved = localStorage.getItem('ov-group');
      if (OV.groups.some((g) => g.id === saved)) state.group = saved;
    } catch (e) { /* storage unavailable: keep default tab */ }
    applyGroup();
  }

  // Shows only the active group's thumbnails; keeps the selection inside the group.
  function applyGroup() {
    for (const el of $('tabs').children) {
      const on = el.dataset.group === state.group;
      el.classList.toggle('active', on);
      el.setAttribute('aria-selected', String(on));
    }
    for (const [id, el] of state.thumbs) el.hidden = tplById(id).group !== state.group;
    if (tplById(state.selected).group !== state.group) state.selected = groupTemplates()[0].id;
    for (const [tid, el] of state.thumbs) el.classList.toggle('active', tid === state.selected);
  }

  function setGroup(id) {
    state.group = id;
    try { localStorage.setItem('ov-group', id); } catch (e) { /* not persisted */ }
    applyGroup();
    renderAll();
    centerSelected(false);
  }

  // On phones the grid is a swipe carousel under the preview (see style.css): the
  // card that settles in the middle is the selected template.
  function buildGrid() {
    const grid = $('grid');
    for (const t of OV.templates) {
      const wrap = document.createElement('div');
      wrap.className = 'thumb-wrap';
      wrap.dataset.id = t.id;
      wrap.innerHTML = `
        <button type="button" class="thumb">
          <div class="thumb-canvas checker"><canvas></canvas></div><span>${t.name}</span>
        </button>`;
      // On phones, tapping a card slides it to the middle, which selects it.
      wrap.querySelector('.thumb').addEventListener('click', () =>
        (isPhoneLayout() ? centerCard(wrap, true) : select(t.id)));
      grid.appendChild(wrap);
      state.thumbs.set(t.id, wrap);
    }
  }

  const isPhoneLayout = () => window.matchMedia('(max-width: 760px)').matches;

  // ---------- phone carousel ----------

  // Scrolls a horizontal strip (carousel or tabs) so `el` sits in its middle. Only the
  // strip scrolls, never the page.
  function centerIn(strip, el, smooth) {
    strip.scrollTo({ left: el.offsetLeft + el.offsetWidth / 2 - strip.clientWidth / 2, behavior: smooth ? 'smooth' : 'auto' });
  }

  const centerCard = (el, smooth) => centerIn($('grid'), el, smooth);

  // Brings the selected card and the active tab into view.
  const centerSelected = (smooth) => {
    if (!isPhoneLayout()) return;
    centerCard(state.thumbs.get(state.selected), smooth);
    const tab = $('tabs').querySelector('.tab.active');
    if (tab) centerIn($('tabs'), tab, smooth);
    shapeCarousel();
  };

  // Cover-flow sizing: a card is full size in the middle and shrinks and fades as it
  // moves a card-width away, following the finger while swiping. Off on desktop.
  function shapeCarousel() {
    const phone = isPhoneLayout();
    const grid = $('grid');
    const mid = grid.scrollLeft + grid.clientWidth / 2;
    for (const el of state.thumbs.values()) {
      if (!phone || el.hidden) {
        el.style.transform = el.style.opacity = el.style.zIndex = '';
        continue;
      }
      const f = Math.min(1, Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid) / el.offsetWidth);
      el.style.transform = `scale(${1 - 0.28 * f})`;
      el.style.opacity = String(1 - 0.5 * f);
      el.style.zIndex = String(100 - Math.round(100 * f)); // the middle card sits on top
    }
  }

  // Once a swipe settles, select the card nearest the middle.
  function wireCarousel() {
    const grid = $('grid');
    let timer = 0, frame = 0;
    grid.addEventListener('scroll', () => {
      if (!isPhoneLayout()) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(shapeCarousel);
      clearTimeout(timer);
      timer = setTimeout(() => {
        const mid = grid.scrollLeft + grid.clientWidth / 2;
        let best = null, dist = Infinity;
        for (const [id, el] of state.thumbs) {
          if (el.hidden) continue;
          const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
          if (d < dist) { dist = d; best = id; }
        }
        if (best && best !== state.selected) select(best);
      }, 120);
    }, { passive: true });

    window.matchMedia('(max-width: 760px)').addEventListener('change', () => {
      renderAll();
      centerSelected(false);
      shapeCarousel();
    });
  }

  function select(id) {
    state.selected = id;
    for (const [tid, el] of state.thumbs) el.classList.toggle('active', tid === id);
    renderPreview();
  }

  let pending = 0;
  function scheduleRender() {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(renderAll);
  }

  function currentData(opts) {
    return OV.buildData(state.stats, state.meta, opts);
  }

  function renderPreview() {
    const opts = readOpts();
    const [W, H] = SIZES[opts.size];
    const tpl = tplById(state.selected);
    // Phones have no large preview: the carousel's middle card is the preview.
    if (!isPhoneLayout()) paint($('preview'), tpl, W, H, currentData(opts), opts, state.bg);
    $('tplName').textContent = tpl.name;
    $('previewBox').style.aspectRatio = `${W} / ${H}`;
    invalidateFiles();
  }

  function renderAll() {
    if (!state.stats) return;
    const opts = readOpts();
    const [W, H] = SIZES[opts.size];
    const d = currentData(opts);
    const tw = isPhoneLayout() ? PHONE_THUMB_W : THUMB_W;
    $('grid').style.setProperty('--ar', String(W / H)); // phone card size (style.css)
    for (const t of groupTemplates()) {
      const el = state.thumbs.get(t.id);
      el.querySelector('.thumb-canvas').style.aspectRatio = `${W} / ${H}`;
      paint(el.querySelector('canvas'), t, tw, Math.round((tw * H) / W), d, opts, state.bg);
    }
    renderPreview();
    renderInfo(d);
  }

  function renderInfo(d) {
    const pts = state.stats.points.length.toLocaleString();
    $('info').innerHTML = `
      ${state.isDemo ? '<span class="badge">Demo activity</span>' : ''}
      <strong>${escapeHtml(d.name)}</strong>
      <span>${escapeHtml(d.date || 'No date in file')}</span>
      <dl>
        <div><dt>${d.dist.label}</dt><dd>${d.dist.value}</dd></div>
        <div><dt>${d.pace.label}</dt><dd>${d.pace.value}</dd></div>
        <div><dt>${d.time.label}</dt><dd>${d.time.value}</dd></div>
        <div><dt>${d.elev.label}</dt><dd>${d.elev.value}</dd></div>
      </dl>
      <small>${state.source !== 'strava' ? `${pts} track points`
        : state.stats.points.length ? `From Strava · ${pts} GPS points` : 'From Strava · no GPS route (indoor/manual)'}</small>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function loadGPXText(text, isDemo) {
    const meta = OV.parseGPX(text);
    setActivity(meta, OV.computeStats(meta.points), isDemo ? 'demo' : 'gpx');
  }

  // Shared by GPX uploads, the demo and Strava. `source` is 'demo' | 'gpx' | 'strava'.
  function setActivity(meta, stats, source, extras = {}) {
    state.meta = meta;
    state.stats = stats;
    state.isDemo = source === 'demo';
    state.source = source;
    $('error').textContent = '';
    $('title').value = '';
    $('title').placeholder = meta.name || 'Auto (e.g. Morning Run)';
    state.calories = extras.calories || null;
    state.location = null;
    renderAll();
    lookupLocation(stats.points);
  }

  // City-level place name for the activity's start ("Kuala Lumpur, Malaysia"), from
  // OpenStreetMap's Nominatim. GPX files only hold coordinates. City level on purpose:
  // the start is often someone's home. One request per activity, cached; repaints when
  // it arrives, and templates simply leave the location out until then or if it fails.
  const placeCache = new Map();
  async function lookupLocation(points) {
    const p = points && points.find((q) => q.lat != null);
    if (!p) return;
    const key = `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`; // ~1 km grid, also limits precision sent
    try {
      let place = placeCache.get(key);
      if (place === undefined) {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=en&lat=${key.split(',')[0]}&lon=${key.split(',')[1]}`;
        const res = await fetch(url);
        const a = res.ok ? (await res.json()).address || {} : {};
        const town = a.city || a.town || a.village || a.municipality || a.county || a.state;
        place = [town, a.country].filter(Boolean).join(', ') || null;
        placeCache.set(key, place);
      }
      if (state.stats && state.stats.points === points && place) {
        state.location = place;
        scheduleRender();
      }
    } catch (e) { /* offline: no location */ }
  }

  function handleFile(file) {
    if (!file) return;
    const err = $('error');
    err.textContent = '';
    const reader = new FileReader();
    reader.onload = () => {
      // The picker accepts any file (see index.html), so check it really is GPX.
      if (!/<gpx[\s>]/i.test(reader.result.slice(0, 4096))) {
        err.textContent = `"${file.name}" isn't a GPX file. Please choose a .gpx file.`;
        return;
      }
      try {
        loadGPXText(reader.result, false);
        showStage();
      } catch (e) {
        err.textContent = e.message;
      }
    };
    reader.onerror = () => { err.textContent = 'Could not read that file.'; };
    reader.readAsText(file);
  }

  function handleBg(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      state.bg = img;
      $('clearBg').hidden = false;
      renderAll();
    };
    img.src = url;
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'activity';
  }

  // Renders the export-size PNG (transparent unless the photo is included).
  async function renderFile(tpl) {
    const opts = readOpts();
    const [W, H] = SIZES[opts.size];
    const canvas = document.createElement('canvas');
    const d = currentData(opts);
    const bg = opts.includeBg ? state.bg : null;
    paint(canvas, tpl, W, H, d, opts, bg);
    // Map templates fetch tiles on first paint; wait for them, then paint again.
    for (let i = 0; i < 3 && OV.mapPending(); i++) {
      await OV.mapSettled();
      paint(canvas, tpl, W, H, d, opts, bg);
    }
    const name = `${slug(d.name)}-${tpl.id}-${opts.size}.png`;
    return new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(new File([blob], name, { type: 'image/png' })), 'image/png'));
  }

  async function exportPNG(tpl) {
    const file = await renderFile(tpl);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // iOS only opens the share sheet during a tap, and rendering a PNG takes too long to
  // do after the tap, so the selected overlay is rendered ahead of time whenever the
  // preview changes.
  let prepToken = 0;
  function invalidateFiles() {
    prepToken++;
    state.files = new Map();
    clearTimeout(state.prepTimer);
    if (shareMode) state.prepTimer = setTimeout(prepareFiles, 300);
  }

  async function prepareFiles() {
    const token = ++prepToken;
    const t = tplById(state.selected);
    const f = await renderFile(t);
    if (token === prepToken) state.files.set(t.id, f);
  }

  const canShareFiles = () => {
    try {
      const probe = new File([new Blob()], 'x.png', { type: 'image/png' });
      return !!(navigator.canShare && navigator.canShare({ files: [probe] }));
    } catch (e) {
      return false;
    }
  };
  const shareMode = window.matchMedia('(pointer: coarse)').matches && canShareFiles();

  // Opens the share sheet with the PNGs attached; "Save Image" puts them in Photos
  // with transparency intact.
  async function saveToPhotos(tpls, btnId) {
    const ready = tpls.map((t) => state.files.get(t.id));
    const files = ready.every(Boolean) ? ready : await Promise.all(tpls.map(renderFile));
    try {
      await navigator.share({ files });
    } catch (e) {
      if (e.name === 'AbortError') return;
      // The tap expired while the PNGs were still rendering; they're ready now.
      flash(btnId, 'Ready, tap again');
    }
  }

  // Puts the selected overlay on the clipboard as a transparent PNG (paste it into an
  // Instagram story as a sticker). The ClipboardItem must be created during the tap,
  // so it gets the PNG as a promise: the ready-made one if there is one.
  async function copyPNG() {
    const tpl = tplById(state.selected);
    const png = state.files.get(tpl.id) || renderFile(tpl);
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': Promise.resolve(png) })]);
      flash('copyPng', 'Copied!');
    } catch (e) {
      flash('copyPng', 'Copy failed');
    }
  }

  function flash(id, msg) {
    const btn = $(id);
    const label = btn.dataset.label || (btn.dataset.label = btn.textContent);
    btn.textContent = msg;
    setTimeout(() => { btn.textContent = label; }, 1600);
  }

  function wire() {
    const drop = $('drop');
    $('gpxInput').addEventListener('change', (e) => {
      handleFile(e.target.files[0]);
      e.target.value = ''; // let the same file be picked again
    });
    ['dragenter', 'dragover'].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => {
      const f = [...e.dataTransfer.files].find((x) => /\.gpx$/i.test(x.name)) || e.dataTransfer.files[0];
      handleFile(f);
    });
    // Stop the browser from opening files dropped outside the drop zone.
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());

    $('demo').addEventListener('click', () => {
      loadGPXText(OV.demoGPX(), true);
      showStage();
    });
    $('bgInput').addEventListener('change', (e) => handleBg(e.target.files[0]));
    $('clearBg').addEventListener('click', () => {
      state.bg = null;
      $('bgInput').value = '';
      $('clearBg').hidden = true;
      renderAll();
    });

    document.querySelectorAll('.controls input, .controls select').forEach((el) => {
      if (el.type === 'file') return;
      el.addEventListener('input', scheduleRender);
      el.addEventListener('change', scheduleRender);
    });

    if (shareMode) {
      $('download').textContent = 'Save to Photos';
      $('download').addEventListener('click', () => saveToPhotos([tplById(state.selected)], 'download'));
    } else {
      $('download').addEventListener('click', () => exportPNG(tplById(state.selected)));
    }
    // Copy to clipboard (phones only, see style.css), where the browser can copy images.
    if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
      $('copyPng').hidden = false;
      $('copyPng').addEventListener('click', copyPNG);
    }
    // The note under the save buttons always shows; with the share sheet it explains
    // the Photos step, otherwise the plain download.
    if (shareMode) {
      $('saveHint').innerHTML = 'Tap <b>Save to Photos</b>, then <b>Save Image</b>. The PNG stays transparent. ' +
        'The Photos app shows clear areas as white or black, but the overlay will sit over your photo in Instagram Stories.';
    }
  }

  async function loadFonts() {
    if (!document.fonts) return;
    const loads = [500, 600, 700, 800, 900].map((w) => document.fonts.load(`${w} 40px "Montserrat"`))
      .concat([500, 600].map((w) => document.fonts.load(`${w} 40px "Barlow Condensed"`)))
      .concat([500, 600].map((w) => document.fonts.load(`${w} 40px "Barlow"`)))
      .concat([300, 400, 600].map((w) => document.fonts.load(`${w} 40px "Inter"`)))
      .concat([400, 700].map((w) => document.fonts.load(`${w} 40px "Gaegu"`)));
    await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 3000))]).catch(() => {});
  }

  // Phones: compact settings above the editor (style.css). Size and units are one-tap
  // toggles that drive the (hidden) selects; the rest folds under "More options".
  function setMore(open) {
    $('moreBody').classList.toggle('open', open);
    $('moreToggle').setAttribute('aria-expanded', String(open));
  }

  // The editor takes the rest of the screen under the header and the compact settings
  // (with "More options" closed), so the page fits one screen without scrolling.
  function fitStage() {
    const stage = document.querySelector('.stage');
    const more = $('moreBody').classList.contains('open') ? $('moreBody').offsetHeight + 12 : 0;
    const above = isPhoneLayout() ? stage.getBoundingClientRect().top + window.scrollY - more : 0;
    document.documentElement.style.setProperty('--above', `${Math.round(above)}px`);
  }

  function wireCompact() {
    document.querySelectorAll('.seg').forEach((seg) => {
      const select = $(seg.dataset.for);
      const sync = () => seg.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('on', b.dataset.value === select.value);
        b.setAttribute('aria-pressed', String(b.dataset.value === select.value));
      });
      seg.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || select.value === b.dataset.value) return;
        select.value = b.dataset.value;
        select.dispatchEvent(new Event('change')); // re-renders, like picking from the select
      });
      select.addEventListener('change', sync);
      sync();
    });
    $('moreToggle').addEventListener('click', () => setMore(!$('moreBody').classList.contains('open')));
    window.addEventListener('resize', fitStage);
    fitStage();
  }

  // After an activity loads on a phone, fold the extra settings and show the editor.
  function showStage() {
    if (!isPhoneLayout()) return;
    setMore(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function init() {
    OV.onMapUpdate = scheduleRender; // repaint as map tiles arrive
    buildGrid();
    buildTabs();
    wire();
    wireCarousel();
    wireCompact();
    await Promise.all([loadFonts(), OV.loadLogos()]);
    fitStage(); // fonts can change the header height
    loadGPXText(OV.demoGPX(), true);
    select(state.selected);
    centerSelected(false);
    OV.initStrava({
      onActivity: ({ meta, stats, calories }) => {
        setActivity(meta, stats, 'strava', { calories });
        showStage();
      },
      onError: (msg) => { $('error').textContent = msg; },
    });
  }

  init();
})(window.OV);
