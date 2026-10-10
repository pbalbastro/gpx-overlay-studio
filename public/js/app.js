// UI wiring: file input, options, preview, thumbnails and PNG export.
(function (OV) {
  const $ = (id) => document.getElementById(id);
  const SIZES = { story: [1080, 1920], portrait: [1080, 1350], square: [1080, 1080] };
  const THUMB_W = 320;

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
      metric: $('metric').value,
      title: $('title').value.trim(),
      power: parseFloat($('power').value) || null,
      calories: parseFloat($('calories').value) || null,
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
  }

  // Each thumbnail is a wrapper holding the select button and, on phones, a save
  // button that appears under the selected thumbnail (the large preview is hidden there).
  function buildGrid() {
    const grid = $('grid');
    for (const t of OV.templates) {
      const wrap = document.createElement('div');
      wrap.className = 'thumb-wrap';
      wrap.dataset.id = t.id;
      wrap.innerHTML = `
        <button type="button" class="thumb">
          <div class="thumb-canvas checker"><canvas></canvas></div><span>${t.name}</span>
        </button>
        <button type="button" class="thumb-save primary" id="save-${t.id}">
          ${shareMode ? 'Save to Photos' : 'Download PNG'}
        </button>`;
      wrap.querySelector('.thumb').addEventListener('click', () => select(t.id));
      wrap.querySelector('.thumb-save').addEventListener('click', () =>
        shareMode ? saveToPhotos([t], `save-${t.id}`) : exportPNG(t));
      grid.appendChild(wrap);
      state.thumbs.set(t.id, wrap);
    }
  }

  const isPhoneLayout = () => window.matchMedia('(max-width: 760px)').matches;

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
    // The large preview is hidden on phones, so skip the full-size render there.
    if (!isPhoneLayout()) paint($('preview'), tpl, W, H, currentData(opts), opts, state.bg);
    $('tplName').textContent = tpl.name;
    $('tplDesc').textContent = tpl.desc;
    $('previewBox').style.aspectRatio = `${W} / ${H}`;
    invalidateFiles();
  }

  function renderAll() {
    if (!state.stats) return;
    const opts = readOpts();
    const [W, H] = SIZES[opts.size];
    const d = currentData(opts);
    for (const t of groupTemplates()) {
      const el = state.thumbs.get(t.id);
      el.querySelector('.thumb-canvas').style.aspectRatio = `${W} / ${H}`;
      paint(el.querySelector('canvas'), t, THUMB_W, Math.round((THUMB_W * H) / W), d, opts, state.bg);
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
    // Power and calories hints come from the activity; manual values are per activity.
    const from = source === 'strava' ? 'Strava' : 'file';
    $('power').value = '';
    $('calories').value = extras.calories ? String(Math.round(extras.calories)) : '';
    $('power').placeholder = stats.avgPower ? `${Math.round(stats.avgPower)} (${from})` : `Not in ${from}`;
    if (source !== 'demo' && /bik|cycl|ride/i.test(meta.type)) $('metric').value = 'auto';
    renderAll();
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
  // do after the tap, so overlays are rendered ahead of time whenever the preview changes.
  let prepToken = 0;
  function invalidateFiles() {
    prepToken++;
    state.files = new Map();
    clearTimeout(state.prepTimer);
    if (shareMode) state.prepTimer = setTimeout(prepareFiles, 300);
  }

  async function prepareFiles() {
    const token = ++prepToken;
    const selected = tplById(state.selected);
    for (const t of [selected, ...groupTemplates().filter((t) => t !== selected)]) {
      const f = await renderFile(t);
      if (token !== prepToken) return;
      state.files.set(t.id, f);
      await new Promise((r) => setTimeout(r, 0));
    }
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

  function flash(id, msg) {
    const btn = $(id);
    const label = btn.dataset.label || (btn.dataset.label = btn.textContent);
    btn.textContent = msg;
    setTimeout(() => { btn.textContent = label; }, 1600);
  }

  async function exportAll() {
    const btn = $('downloadAll');
    btn.disabled = true;
    for (const t of groupTemplates()) {
      await exportPNG(t);
      await new Promise((r) => setTimeout(r, 300));
    }
    btn.disabled = false;
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

    $('demo').addEventListener('click', () => loadGPXText(OV.demoGPX(), true));
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
      $('downloadAll').textContent = 'Save all to Photos';
      $('download').addEventListener('click', () => saveToPhotos([tplById(state.selected)], 'download'));
      $('downloadAll').addEventListener('click', () => saveToPhotos(groupTemplates(), 'downloadAll'));
    } else {
      $('download').addEventListener('click', () => exportPNG(tplById(state.selected)));
      $('downloadAll').addEventListener('click', exportAll);
    }
    if (shareMode) $('iosHint').hidden = false;
  }

  async function loadFonts() {
    if (!document.fonts) return;
    const loads = [500, 600, 700, 800, 900].map((w) => document.fonts.load(`${w} 40px "Montserrat"`))
      .concat([500, 600].map((w) => document.fonts.load(`${w} 40px "Barlow Condensed"`)))
      .concat([300, 400, 600].map((w) => document.fonts.load(`${w} 40px "Inter"`)));
    await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 3000))]).catch(() => {});
  }

  async function init() {
    OV.onMapUpdate = scheduleRender; // repaint as map tiles arrive
    buildGrid();
    buildTabs();
    wire();
    await Promise.all([loadFonts(), OV.loadLogos()]);
    loadGPXText(OV.demoGPX(), true);
    select(state.selected);
    OV.initStrava({
      onActivity: ({ meta, stats, calories }) => {
        setActivity(meta, stats, 'strava', { calories });
        // On phones the templates are below the panel; bring them into view.
        if (isPhoneLayout()) document.querySelector('.templates').scrollIntoView({ behavior: 'smooth' });
      },
      onError: (msg) => { $('error').textContent = msg; },
    });
  }

  init();
})(window.OV);
