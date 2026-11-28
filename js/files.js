/* 공통 파일 도구 (문서·PT·엑셀·차트가 함께 씀) — css/files.css 와 짝
   P.files.ioButtons({ kind, importers, exporters, ... })  가져오기·내보내기 단추 두 개 + 내보내기 메뉴 + Ctrl/⌘+O · Ctrl/⌘+Shift+E
   P.files.browser(el, { col, kind, title, templates, newItem, open, thumb, meta, io, ... })  폴더가 있는 목록 화면
   P.files.backHref(kind, folderId)  편집기 '‹ 목록' 주소 (#/docs 또는 #/docs/f/<폴더>)
   폴더는 '<col>-folders' 컬렉션({ name, parent }), 항목은 data.folder(폴더 id 또는 null) */
(function () {
  'use strict';
  const P = window.P;
  if (!P) return;
  const esc = P.esc;
  const sv = (d, w) => '<svg viewBox="0 0 24 24" width="' + (w || 18) + '" height="' + (w || 18) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const FOLDER_D = '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6l2 2.2h7.4A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>';
  const IC = {
    import: sv('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
    export: sv('<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>'),
    folder: sv(FOLDER_D),
    folderBig: sv(FOLDER_D, 44),
    folderPlus: sv(FOLDER_D + '<path d="M12 11v5M9.5 13.5h5"/>'),
    move: sv(FOLDER_D + '<path d="M9 13.5h6M13 11.5l2 2-2 2"/>'),
    copy: sv('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
    edit: sv('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>'),
    trash: sv('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    more: sv('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
    rows: sv('<path d="M4 6h16M4 12h16M4 18h16"/>'),
    tiles: sv('<rect x="4" y="4" width="7" height="7" rx="1.2"/><rect x="13" y="4" width="7" height="7" rx="1.2"/><rect x="4" y="13" width="7" height="7" rx="1.2"/><rect x="13" y="13" width="7" height="7" rx="1.2"/>'),
    search: sv('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    doc: sv('<path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
    print: sv('<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7"/>'),
    image: sv('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'),
    zip: sv('<path d="M6 3h9l4 4v14H6z"/><path d="M11 3v2h2v2h-2v2h2v2h-2v2"/><rect x="10" y="14" width="4" height="4" rx="1"/>'),
    sheet: sv('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>'),
    slide: sv('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>'),
    text: sv('<path d="M5 6h14M5 10h14M5 14h9M5 18h6"/>'),
    code: sv('<path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/>'),
    chart: sv('<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>'),
    check: sv('<path d="M5 12l5 5L20 7"/>')
  };
  const isMac = /Mac|iPhone|iPad/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');
  const MOD = isMac ? '⌘' : 'Ctrl';
  const kbd = (keys) => keys.map((k) => '<kbd class="kbd">' + esc(k) + '</kbd>').join('');

  function relTime(iso) {
    const t = Date.parse(iso);
    if (!t) return '';
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return '방금 전';
    if (s < 3600) return Math.floor(s / 60) + '분 전';
    if (s < 86400) return Math.floor(s / 3600) + '시간 전';
    if (s < 86400 * 7) return Math.floor(s / 86400) + '일 전';
    const d = new Date(t);
    return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';
  }
  /* 입력 창: Enter로 닫힐 때 포커스가 돌아간 단추에 Enter가 한 번 더 들어가지 않도록 먼저 포커스를 놓음 */
  function ask(msg, def) {
    const a = document.activeElement;
    if (a && a !== document.body && a.blur) a.blur();
    return P.ui.prompt(msg, def).then((v) => new Promise((r) => setTimeout(() => r(v), 30)));
  }
  const typing = (t) => !!(t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'));
  const modalOpen = () => !!document.querySelector('.p-modal-back:not(.out), .p-cmd-back:not(.out)');
  function setAttrs(node, attrs) {
    if (!attrs) return;
    Object.keys(attrs).forEach((k) => { if (attrs[k] != null && attrs[k] !== false) node.setAttribute(k, attrs[k] === true ? '' : String(attrs[k])); });
  }
  function attrStr(attrs) {
    if (!attrs) return '';
    return Object.keys(attrs).filter((k) => attrs[k] != null && attrs[k] !== false).map((k) => ' ' + k + '="' + esc(attrs[k] === true ? '' : attrs[k]) + '"').join('');
  }

  /* ---------- 파일 형식 맞추기 ---------- */
  const tokens = (accept) => String(accept || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  function fileMatches(imp, file) {
    if (typeof imp.match === 'function') return !!imp.match(file);
    const name = String(file.name || '').toLowerCase();
    const type = String(file.type || '').toLowerCase();
    return tokens(imp.accept).some((t) => {
      if (t[0] === '.') return name.endsWith(t);
      if (t.endsWith('/*')) return type.startsWith(t.slice(0, -1));
      return type === t;
    });
  }
  function formatsText(importers) {
    return importers.map((i) => i.ext || i.label).filter(Boolean).join(' · ');
  }

  /* =========================================================
     가져오기 · 내보내기 단추
     ========================================================= */
  const registry = [];
  let openMenu = null; // { close, inst }

  function ioButtons(opts) {
    const o = Object.assign({ importers: [], exporters: [] }, opts || {});
    const wrap = document.createElement('span');
    wrap.className = 'p-io' + (o.compact ? ' p-io-compact' : '') + (o.className ? ' ' + o.className : '');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', '가져오기와 내보내기');
    const sz = o.size === 'sm' ? ' btn-sm' : '';
    const imp = document.createElement('button');
    imp.type = 'button';
    imp.className = 'btn' + sz + ' p-io-btn p-io-import';
    imp.dataset.io = 'import';
    imp.title = '가져오기 (' + MOD + '+O)';
    imp.setAttribute('aria-label', '가져오기');
    imp.setAttribute('aria-keyshortcuts', 'Control+O Meta+O');
    imp.innerHTML = IC.import + '<span class="p-io-lbl">가져오기</span>';
    const exp = document.createElement('button');
    exp.type = 'button';
    exp.className = 'btn' + sz + ' p-io-btn p-io-export';
    exp.dataset.io = 'export';
    exp.title = '내보내기 (' + MOD + '+Shift+E)';
    exp.setAttribute('aria-label', '내보내기');
    exp.setAttribute('aria-haspopup', 'menu');
    exp.setAttribute('aria-expanded', 'false');
    exp.setAttribute('aria-keyshortcuts', 'Control+Shift+E Meta+Shift+E');
    exp.innerHTML = IC.export + '<span class="p-io-lbl">내보내기</span>';
    setAttrs(imp, o.attrs && o.attrs.import);
    setAttrs(exp, o.attrs && o.attrs.export);
    wrap.appendChild(imp);
    wrap.appendChild(exp);

    const importers = () => (typeof o.importers === 'function' ? o.importers() : o.importers) || [];
    const exporters = () => (typeof o.exporters === 'function' ? o.exporters() : o.exporters) || [];
    if (!importers().length) imp.hidden = true;
    if (!exporters().length && typeof o.exporters !== 'function') exp.hidden = true;
    if (importers().length) imp.title = '가져오기: ' + formatsText(importers()) + ' (' + MOD + '+O)';

    const inst = { el: wrap, importBtn: imp, exportBtn: exp, o };

    async function runImport(list) {
      const imps = importers();
      const groups = new Map();
      const bad = [];
      list.forEach((f) => {
        const im = imps.find((x) => (x.accept || x.match) && fileMatches(x, f));
        if (!im) { bad.push(f.name); return; }
        if (!groups.has(im)) groups.set(im, []);
        groups.get(im).push(f);
      });
      if (bad.length) P.ui.toast('가져올 수 없는 형식입니다: ' + bad.slice(0, 3).join(', ') + (bad.length > 3 ? ' 외 ' + (bad.length - 3) + '개' : '') + '. 가능한 형식: ' + formatsText(imps), 'warn');
      if (!groups.size) return;
      const ctx = typeof o.context === 'function' ? o.context() : (o.context || {});
      await P.ui.busy(imp, async () => {
        for (const [im, files] of groups) {
          try {
            if (im.multiple) await im.run(files, ctx);
            else for (const f of files) await im.run(f, ctx);
          } catch (e) {
            console.error(e);
            P.ui.toast((files.length === 1 ? '"' + files[0].name + '": ' : '') + (e && e.message ? e.message : '가져오지 못했습니다.'), 'error');
          }
        }
      });
    }
    inst.importFiles = (files) => runImport(Array.from(files || []));
    inst.importText = async (text) => {
      const im = importers().find((x) => x.paste);
      if (!im || !String(text || '').trim()) return false;
      const ctx = typeof o.context === 'function' ? o.context() : (o.context || {});
      try { await P.ui.busy(imp, () => im.run(String(text), ctx)); } catch (e) { console.error(e); P.ui.toast(e.message || '가져오지 못했습니다.', 'error'); }
      return true;
    };
    inst.canPaste = () => importers().some((x) => x.paste);
    inst.openImport = () => {
      const imps = importers().filter((x) => x.accept);
      if (!imps.length) return;
      closeMenu();
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = Array.from(new Set(imps.flatMap((x) => tokens(x.accept)))).join(',');
      inp.multiple = imps.some((x) => x.multiple) || o.multiple !== false;
      inp.style.display = 'none';
      inp.addEventListener('change', () => { const fs = Array.from(inp.files || []); inp.remove(); if (fs.length) runImport(fs); });
      inp.addEventListener('cancel', () => inp.remove());
      document.body.appendChild(inp);
      inp.click();
    };
    inst.openExport = () => {
      if (openMenu && openMenu.inst === inst && openMenu.pop.isConnected) { closeMenu(); return; }
      closeMenu();
      exportMenu(inst, exporters(), typeof o.note === 'function' ? o.note() : o.note);
    };
    inst.closeMenu = () => { if (openMenu && openMenu.inst === inst) closeMenu(); };
    imp.addEventListener('click', () => inst.openImport());
    exp.addEventListener('click', () => inst.openExport());
    // 편집기 글 선택이 풀리지 않게
    [imp, exp].forEach((b) => b.addEventListener('mousedown', (e) => { if (o.keepFocus) e.preventDefault(); }));
    registry.push(inst);
    return inst;
  }

  function closeMenu() {
    if (!openMenu) return;
    const m = openMenu;
    openMenu = null;
    m.close();
  }
  function exportMenu(inst, list, note) {
    const btn = inst.exportBtn;
    const o = inst.o;
    const pop = document.createElement('div');
    pop.className = 'p-pop p-io-menu' + (o.menuClass ? ' ' + o.menuClass : '');
    pop.setAttribute('role', 'menu');
    pop.setAttribute('aria-label', '내보내기');
    let html = '<div class="p-pop-title p-io-title"><span>내보내기</span>' + (o.exportTitle ? '<small>' + esc(o.exportTitle) + '</small>' : '') + '</div>';
    if (note) html += '<p class="p-io-note">' + esc(note) + '</p>';
    list.forEach((x, i) => {
      if (x === '-' || x.sep) { html += '<div class="p-io-sep" role="separator"></div>'; return; }
      html += '<button type="button" role="menuitem" class="p-pop-item p-io-item' + (o.itemClass ? ' ' + o.itemClass : '') + '" data-v="' + esc(x.id || x.ext || i) + '" data-i="' + i + '"' + (x.disabled ? ' disabled' : '') + '>' +
        '<span class="p-pop-ic p-io-ic">' + (x.icon || IC.doc) + '</span>' +
        '<span class="p-pop-txt"><b>' + esc(x.label) + '</b>' + (x.desc ? '<small>' + esc(x.desc) + '</small>' : '') + '</span>' +
        (x.ext ? '<span class="badge p-io-ext">' + esc(x.ext) + '</span>' : '') + '</button>';
    });
    html += '<div class="p-io-foot" aria-hidden="true"><span>' + kbd([MOD, 'Shift', 'E']) + ' 이 메뉴</span><span>' + kbd([MOD, 'O']) + ' 가져오기</span></div>';
    pop.innerHTML = html;
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = Math.min(r.right - pw, vw - pw - 8);
    left = Math.max(8, left);
    let top = r.bottom + 6;
    if (top + ph > vh - 8) top = Math.max(8, r.top - ph - 6);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    btn.setAttribute('aria-expanded', 'true');
    const items = () => Array.from(pop.querySelectorAll('.p-io-item:not(:disabled)'));
    const onDown = (e) => { if (!pop.contains(e.target) && !btn.contains(e.target)) closeMenu(); };
    const onKey = (e) => {
      const its = items();
      const i = its.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); btn.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); (its[i + 1] || its[0] || btn).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (its[i - 1] || its[its.length - 1] || btn).focus(); }
      else if (e.key === 'Home') { e.preventDefault(); if (its[0]) its[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); if (its.length) its[its.length - 1].focus(); }
      else if (e.key === 'Tab') closeMenu();
    };
    const onScroll = (e) => { if (!pop.contains(e.target)) closeMenu(); };
    setTimeout(() => document.addEventListener('pointerdown', onDown, true), 0);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', closeMenu);
    document.addEventListener('scroll', onScroll, true);
    pop.addEventListener('mousedown', (e) => e.preventDefault());
    pop.addEventListener('click', (e) => {
      const b = e.target.closest('.p-io-item');
      if (!b || b.disabled) return;
      const x = list[Number(b.dataset.i)];
      closeMenu();
      if (!x || typeof x.run !== 'function') return;
      P.ui.busy(btn, () => x.run()).catch((err) => { console.error(err); P.ui.toast('내보내지 못했습니다: ' + (err && err.message ? err.message : err), 'error'); });
    });
    openMenu = {
      inst,
      pop,
      close() {
        document.removeEventListener('pointerdown', onDown, true);
        document.removeEventListener('keydown', onKey, true);
        window.removeEventListener('resize', closeMenu);
        document.removeEventListener('scroll', onScroll, true);
        btn.setAttribute('aria-expanded', 'false');
        pop.classList.add('out');
        setTimeout(() => pop.remove(), 180);
      }
    };
    const first = items()[0];
    if (first) setTimeout(() => { try { first.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } }, 0);
  }

  /* 지금 화면의 단추: 연결되어 있고 #view 안에 보이는 마지막 것 */
  function activeInst() {
    for (let i = registry.length - 1; i >= 0; i--) if (!registry[i].el.isConnected) registry.splice(i, 1);
    const view = document.getElementById('view');
    const live = registry.filter((x) => view && view.contains(x.el) && x.el.offsetParent !== null);
    return live[live.length - 1] || null;
  }
  /* 단축키: Ctrl/⌘+O 가져오기, Ctrl/⌘+Shift+E 내보내기. 편집기가 먼저 처리한 키(문서 본문의 가운데 정렬 등)는 건드리지 않음 */
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.isComposing || e.altKey || !(e.ctrlKey || e.metaKey)) return;
    const isO = e.code === 'KeyO' && !e.shiftKey;
    const isE = e.code === 'KeyE' && e.shiftKey;
    if (!isO && !isE) return;
    if (modalOpen()) return;
    const inst = activeInst();
    if (!inst) return;
    if (typeof inst.o.when === 'function' && !inst.o.when()) return;
    const btn = isO ? inst.importBtn : inst.exportBtn;
    if (btn.hidden || btn.disabled) return;
    e.preventDefault();
    if (isO) inst.openImport(); else inst.openExport();
  });

  /* =========================================================
     폴더 목록 화면
     ========================================================= */
  function backHref(kind, folderId) {
    return '#/' + kind + (folderId ? '/f/' + encodeURIComponent(folderId) : '');
  }
  async function listFolders(col) {
    try { return (await P.store.list(col + '-folders')).filter((r) => r && r.data); } catch (e) { return []; }
  }

  function browser(el, opts) {
    const o = Object.assign({
      title: '목록', itemName: '항목', newLabel: '새로 만들기', mineLabel: '내 항목', searchHint: '이름 검색',
      titleOf: (it) => String((it.data && (it.data.title || it.data.name)) || '제목 없음'),
      textOf: null, createdOf: (it) => (it.data && it.data.createdAt) || it.updatedAt || '',
      href: (it) => '#/' + opts.kind + '/' + encodeURIComponent(it.id)
    }, opts || {});
    const kind = o.kind;
    const col = o.col;
    const fcol = col + '-folders';
    const S = (k, d) => P.settings.get(kind + '.' + k, d);
    let view = S('view', o.defaultView || 'list') === 'grid' ? 'grid' : 'list';
    let sort = S('sort', 'recent');
    if (!['recent', 'name', 'created'].includes(sort)) sort = 'recent';
    let q = '';
    let everywhere = false;
    let folderId = o.folder || null;
    let items = [];
    let folders = [];
    let loaded = false;
    const sel = new Set();
    const offs = [];
    const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); offs.push(() => t.removeEventListener(ev, fn, opt)); };
    const titleOf = o.titleOf;
    const textOf = o.textOf || ((it) => titleOf(it) + ' ' + String((it.data && it.data.preview) || ''));
    const fName = (f) => String((f && f.data && f.data.name) || '이름 없는 폴더');
    const fById = (id) => folders.find((f) => f.id === id) || null;
    const parentOf = (f) => (f && f.data && f.data.parent) || null;
    const itemFolder = (it) => (it.data && it.data.folder) || null;
    function pathOf(id) {
      const out = [];
      const seen = new Set();
      let f = fById(id);
      while (f && !seen.has(f.id)) { seen.add(f.id); out.unshift(f); f = fById(parentOf(f)); }
      return out;
    }
    function isInside(id, ancestor) {
      const seen = new Set();
      let cur = id;
      while (cur && !seen.has(cur)) { if (cur === ancestor) return true; seen.add(cur); cur = parentOf(fById(cur)); }
      return false;
    }

    const newBtn = '<button type="button" class="btn btn-primary p-fb-new"' + attrStr(o.newAttrs) + '>' + P.icons.plus + '<span>' + esc(o.newLabel) + '</span></button>';
    el.innerHTML =
      '<div class="page p-fb' + (o.pageClass ? ' ' + o.pageClass : '') + '" data-kind="' + esc(kind) + '">' +
        '<div class="page-head p-fb-head"><div class="p-fb-headl"><h1 class="p-fb-crumb"></h1></div>' +
          '<div class="toolbar p-fb-acts">' + (o.extraActs || '') +
            '<button type="button" class="btn p-fb-newfolder" data-fb="newfolder" title="새 폴더" aria-label="새 폴더">' + IC.folderPlus + '<span>새 폴더</span></button>' +
            newBtn + '</div></div>' +
        (o.templates ? '<section class="p-fb-tpls' + (o.templates.cls ? ' ' + o.templates.cls : '') + '" aria-label="새로 만들기"><div class="section-title"><h2>' + esc(o.templates.title || '새로 만들기') + '</h2>' + (o.templates.aside || '') + '</div>' + o.templates.html + '</section>' : '') +
        '<section class="p-fb-main" aria-label="' + esc(o.mineLabel) + '">' +
          '<div class="p-fb-tools">' +
            '<h2 class="p-fb-h2"><span class="p-fb-h2t"></span> <span class="p-fb-count tnum"></span></h2>' +
            '<label class="p-search p-fb-search">' + IC.search + '<input type="search" placeholder="' + esc(o.searchHint) + '" aria-label="' + esc(o.title) + ' 검색"></label>' +
            '<label class="p-fb-all" title="모든 폴더에서 찾기"><input type="checkbox"> 모든 폴더</label>' +
            '<select class="p-fb-sort" aria-label="정렬"><option value="recent">최근 수정</option><option value="name">이름</option><option value="created">만든 날짜</option></select>' +
            '<div class="seg p-fb-view" role="group" aria-label="보기"><button type="button" data-view="list" aria-label="목록으로 보기" title="목록">' + IC.rows + '</button><button type="button" data-view="grid" aria-label="격자로 보기" title="격자">' + IC.tiles + '</button></div>' +
          '</div>' +
          '<div class="p-fb-selbar" role="toolbar" aria-label="고른 항목" hidden>' +
            '<label class="p-fb-chk p-fb-chk-all"><input type="checkbox" aria-label="모두 고르기"></label><b class="p-fb-seln tnum"></b>' +
            '<button type="button" class="btn btn-sm" data-bulk="move">' + IC.move + '<span>이동</span></button>' +
            '<button type="button" class="btn btn-sm" data-bulk="dup">' + IC.copy + '<span>복제</span></button>' +
            '<button type="button" class="btn btn-sm p-fb-danger" data-bulk="del">' + IC.trash + '<span>삭제</span></button>' +
            '<span class="p-fb-sp"></span><button type="button" class="btn btn-sm btn-ghost" data-bulk="clear">선택 해제</button>' +
          '</div>' +
          '<div class="p-fb-items' + (o.itemsClass ? ' ' + o.itemsClass : '') + '" data-mode="' + view + '">' + P.ui.skeleton(3) + '</div>' +
        '</section>' +
        '<div class="p-fb-drop" hidden aria-hidden="true"><div class="p-fb-drop-in">' + IC.import + '<b>여기에 놓으면 가져옵니다</b><span class="p-fb-drop-f"></span></div></div>' +
      '</div>';
    const page = el.querySelector('.p-fb');
    const box = el.querySelector('.p-fb-items');
    const crumb = el.querySelector('.p-fb-crumb');
    const search = el.querySelector('.p-fb-search input');
    const allChk = el.querySelector('.p-fb-all input');
    const sortSel = el.querySelector('.p-fb-sort');
    const selbar = el.querySelector('.p-fb-selbar');
    const drop = el.querySelector('.p-fb-drop');
    sortSel.value = sort;

    /* 가져오기·내보내기: 목록에서는 고른 항목을 내보냄 */
    const io = o.io || {};
    const selRows = () => items.filter((it) => sel.has(it.id));
    let ioInst = null;
    if (io.importers || io.exporters) {
      ioInst = ioButtons({
        kind,
        importers: io.importers || [],
        attrs: io.attrs,
        menuClass: io.menuClass,
        itemClass: io.itemClass,
        context: () => ({ folder: folderId, browser: api }),
        note: () => {
          const n = selRows().length;
          return n ? '고른 ' + n + '개 항목' + (n > 1 ? '을 한 ZIP 파일로 묶어' : '을') + ' 내보냅니다.' : '목록에서 내보낼 항목을 체크해 고르세요.';
        },
        exporters: () => {
          const rows = selRows();
          return (io.exporters || []).map((x) => Object.assign({}, x, {
            disabled: !rows.length || (x.single && rows.length > 1),
            desc: x.single && rows.length > 1 ? '한 번에 하나만 됩니다' : x.desc,
            run: () => runListExport(x, selRows())
          }));
        }
      });
      el.querySelector('.p-fb-acts').insertBefore(ioInst.el, el.querySelector('.p-fb-acts').firstChild);
      const fmts = formatsText(io.importers || []);
      el.querySelector('.p-fb-drop-f').textContent = fmts;
    }
    async function runListExport(x, rows) {
      if (!rows.length) return;
      if (x.run) return x.run(rows);
      if (rows.length === 1) {
        const f = await x.file(rows[0]);
        if (f) P.ui.download(f.name, f.blob || f.data, f.mime);
        return;
      }
      await P.loadScript('vendor/jszip/jszip.min.js');
      const zip = new window.JSZip();
      const used = new Set();
      for (const r of rows) {
        const f = await x.file(r);
        if (!f) continue;
        let name = f.name;
        let n = 2;
        while (used.has(name)) name = f.name.replace(/(\.[^.]+)?$/, ' (' + (n++) + ')$1');
        used.add(name);
        zip.file(name, f.blob || f.data);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      P.ui.download(String(o.title || kind) + ' ' + rows.length + '개 (' + (x.ext || x.label) + ').zip', blob);
      P.ui.toast(rows.length + '개 항목을 ZIP으로 내보냈습니다.', 'ok');
    }

    /* ---------- 그리기 ---------- */
    function paintView() {
      box.dataset.mode = view;
      el.querySelectorAll('button[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    }
    function paintCrumb() {
      const path = pathOf(folderId);
      const rootLink = '<a href="' + backHref(kind) + '" class="p-fb-cr" data-drop=""' + (path.length ? '' : ' aria-current="page"') + '>' + esc(o.title) + '</a>';
      crumb.innerHTML = path.length
        ? '<nav aria-label="폴더 위치">' + rootLink + path.map((f, i) => '<span class="p-fb-sep" aria-hidden="true">›</span>' +
          (i === path.length - 1 ? '<span class="p-fb-cr p-fb-cr-cur" data-drop="' + esc(f.id) + '" aria-current="page">' + esc(fName(f)) + '</span>'
            : '<a href="' + backHref(kind, f.id) + '" class="p-fb-cr" data-drop="' + esc(f.id) + '">' + esc(fName(f)) + '</a>')).join('') + '</nav>'
        : esc(o.title);
      el.querySelector('.p-fb-h2t').textContent = path.length ? fName(path[path.length - 1]) : o.mineLabel;
    }
    function sorted(list) {
      if (sort === 'name') return list.slice().sort((a, b) => titleOf(a).localeCompare(titleOf(b), 'ko'));
      if (sort === 'created') return list.slice().sort((a, b) => String(o.createdOf(b)).localeCompare(String(o.createdOf(a))));
      return list.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    }
    function countIn(fid) {
      return items.filter((it) => itemFolder(it) === fid).length + folders.filter((f) => parentOf(f) === fid).length;
    }
    function itemActs(it) {
      const t = esc(titleOf(it));
      return '<span class="p-fb-acts-i">' +
        '<button type="button" class="btn btn-ghost btn-sm p-icon-btn p-fb-wide" data-act="rename" title="이름 바꾸기" aria-label="' + t + ' 이름 바꾸기">' + IC.edit + '</button>' +
        '<button type="button" class="btn btn-ghost btn-sm p-icon-btn p-fb-wide" data-act="dup" title="복제" aria-label="' + t + ' 복제">' + IC.copy + '</button>' +
        '<button type="button" class="btn btn-ghost btn-sm p-icon-btn p-fb-wide" data-act="move" title="폴더로 이동" aria-label="' + t + ' 폴더로 이동">' + IC.move + '</button>' +
        '<button type="button" class="btn btn-ghost btn-sm p-icon-btn p-fb-wide p-fb-danger" data-act="del" title="삭제" aria-label="' + t + ' 삭제">' + IC.trash + '</button>' +
        '<button type="button" class="btn btn-ghost btn-sm p-icon-btn p-fb-narrow" data-act="more" title="더 보기" aria-label="' + t + ' 더 보기" aria-haspopup="menu">' + IC.more + '</button></span>';
    }
    function folderActs(f) {
      const t = esc(fName(f));
      return '<span class="p-fb-acts-i">' +
        '<button type="button" class="btn btn-ghost btn-sm p-icon-btn p-fb-wide" data-fact="rename" title="폴더 이름 바꾸기" aria-label="' + t + ' 폴더 이름 바꾸기">' + IC.edit + '</button>' +
        '<button type="button" class="btn btn-ghost btn-sm p-icon-btn p-fb-wide" data-fact="move" title="폴더로 이동" aria-label="' + t + ' 폴더 옮기기">' + IC.move + '</button>' +
        '<button type="button" class="btn btn-ghost btn-sm p-icon-btn p-fb-wide p-fb-danger" data-fact="del" title="폴더 삭제" aria-label="' + t + ' 폴더 삭제">' + IC.trash + '</button>' +
        '<button type="button" class="btn btn-ghost btn-sm p-icon-btn p-fb-narrow" data-fact="more" title="더 보기" aria-label="' + t + ' 폴더 더 보기" aria-haspopup="menu">' + IC.more + '</button></span>';
    }
    const chk = (it) => '<label class="p-fb-chk"><input type="checkbox" data-sel="' + esc(it.id) + '"' + (sel.has(it.id) ? ' checked' : '') + ' aria-label="' + esc(titleOf(it)) + ' 고르기"></label>';
    function itemMeta(it) {
      const parts = [];
      if (everywhere && q) { const p = pathOf(itemFolder(it)); parts.push(p.length ? p.map(fName).join(' › ') : o.title); }
      const m = o.meta ? o.meta(it) : '';
      if (m) parts.push(m);
      return parts.join(' · ');
    }
    function rowHTML(it) {
      const cls = 'p-fb-item' + (o.itemClass ? ' ' + o.itemClass : '') + (sel.has(it.id) ? ' is-sel' : '');
      const open = 'p-fb-open' + (o.openClass ? ' ' + o.openClass : '');
      const badge = o.badge ? o.badge(it) : '';
      if (view === 'grid') {
        return '<article class="p-fb-tile ' + cls + '" data-id="' + esc(it.id) + '" draggable="true">' +
          '<a class="' + open + '" href="' + esc(o.href(it)) + '" draggable="false"><span class="p-fb-thumb">' + (o.thumb ? o.thumb(it) : '') + '</span>' +
          '<span class="p-fb-txt"><b>' + esc(titleOf(it)) + '</b><small>' + esc([relTime(it.updatedAt), itemMeta(it)].filter(Boolean).join(' · ')) + '</small></span></a>' +
          chk(it) + itemActs(it) + '</article>';
      }
      return '<article class="p-fb-row ' + cls + '" data-id="' + esc(it.id) + '" draggable="true">' + chk(it) +
        '<a class="' + open + '" href="' + esc(o.href(it)) + '" draggable="false"><span class="p-fb-ic">' + (o.icon ? o.icon(it) : IC.doc) + '</span>' +
        '<span class="p-fb-txt"><b>' + esc(titleOf(it)) + '</b><small>' + (esc(itemMeta(it)) || '&nbsp;') + '</small></span></a>' +
        '<span class="p-fb-c p-fb-c-kind">' + badge + '</span>' +
        '<span class="p-fb-c p-fb-c-time"><time datetime="' + esc(it.updatedAt || '') + '">' + esc(relTime(it.updatedAt)) + '</time></span>' +
        itemActs(it) + '</article>';
    }
    function folderHTML(f) {
      const n = countIn(f.id);
      const meta = n ? n + '개 항목' : '비어 있음';
      if (view === 'grid') {
        return '<article class="p-fb-tile p-fb-folder" data-folder="' + esc(f.id) + '" draggable="true">' +
          '<a class="p-fb-open" href="' + backHref(kind, f.id) + '" draggable="false"><span class="p-fb-thumb p-fb-thumb-folder">' + IC.folderBig + '</span>' +
          '<span class="p-fb-txt"><b>' + esc(fName(f)) + '</b><small>' + meta + '</small></span></a>' + folderActs(f) + '</article>';
      }
      return '<article class="p-fb-row p-fb-folder" data-folder="' + esc(f.id) + '" draggable="true"><span class="p-fb-chk" aria-hidden="true"></span>' +
        '<a class="p-fb-open" href="' + backHref(kind, f.id) + '" draggable="false"><span class="p-fb-ic p-fb-ic-folder">' + IC.folder + '</span>' +
        '<span class="p-fb-txt"><b>' + esc(fName(f)) + '</b><small>' + meta + '</small></span></a>' +
        '<span class="p-fb-c p-fb-c-kind"><span class="badge">폴더</span></span>' +
        '<span class="p-fb-c p-fb-c-time"><time datetime="' + esc(f.updatedAt || '') + '">' + esc(relTime(f.updatedAt)) + '</time></span>' + folderActs(f) + '</article>';
    }
    function emptyHTML(inFolder) {
      const e = o.empty || {};
      const title = inFolder ? '이 폴더는 비어 있습니다' : (e.title || '아직 ' + o.itemName + '이(가) 없습니다');
      const desc = inFolder ? '새로 만들거나, 파일을 여기로 끌어다 놓아 가져오세요. 다른 항목을 이 폴더로 끌어 옮길 수도 있습니다.' : (e.desc || '');
      return '<div class="empty empty-art p-fb-empty">' + (e.slot ? '<div class="fx-img-slot" data-slot="' + esc(e.slot) + '"></div>' : '') +
        '<div class="empty-txt"><h3>' + esc(title) + '</h3>' + (desc ? '<p>' + esc(desc) + '</p>' : '') +
        '<button type="button" class="btn btn-primary" data-fb="new"' + attrStr(o.emptyNewAttrs) + '>' + P.icons.plus + esc(o.newLabel) + '</button></div></div>';
    }
    function render() {
      if (!loaded) return;
      paintCrumb();
      paintView();
      const qq = q.trim().toLowerCase();
      const scopeAll = everywhere && !!qq;
      let fs = folders.filter((f) => (scopeAll ? true : parentOf(f) === folderId));
      let its = items.filter((it) => (scopeAll ? true : itemFolder(it) === folderId));
      if (qq) {
        fs = fs.filter((f) => fName(f).toLowerCase().includes(qq));
        its = its.filter((it) => textOf(it).toLowerCase().includes(qq));
      }
      fs = fs.slice().sort((a, b) => fName(a).localeCompare(fName(b), 'ko'));
      its = sorted(its);
      // 보이지 않는 항목은 선택에서 뺌
      const visible = new Set(its.map((x) => x.id));
      Array.from(sel).forEach((id) => { if (!visible.has(id)) sel.delete(id); });
      el.querySelector('.p-fb-count').textContent = (fs.length + its.length) ? String(its.length + fs.length) : '';
      if (!fs.length && !its.length) {
        box.innerHTML = qq ? '<div class="empty p-fb-noresult"><p>"' + esc(q) + '" 검색 결과 없음' + (everywhere ? '' : ' · 모든 폴더에서 찾으려면 "모든 폴더"를 켜세요') + '</p></div>' : emptyHTML(!!folderId);
        paintSel();
        return;
      }
      const head = view === 'list' ? '<div class="p-fb-rows-head" aria-hidden="true"><span></span><span>이름</span><span>종류</span><span>수정</span><span></span></div>' : '';
      box.innerHTML = head + fs.map(folderHTML).join('') + its.map(rowHTML).join('');
      paintSel();
      if (typeof o.afterRender === 'function') { try { o.afterRender(box, view); } catch (e) { console.error(e); } }
    }
    function paintSel() {
      const n = sel.size;
      selbar.hidden = !n;
      el.querySelector('.p-fb-seln').textContent = n ? n + '개 고름' : '';
      const visibleItems = box.querySelectorAll('input[data-sel]');
      const all = selbar.querySelector('.p-fb-chk-all input');
      all.checked = n > 0 && n === visibleItems.length;
      all.indeterminate = n > 0 && n < visibleItems.length;
      page.classList.toggle('has-sel', n > 0);
    }
    async function load() {
      let rows = [];
      try { rows = await P.store.list(col); } catch (e) { rows = []; }
      const fl = await listFolders(col);
      if (!el.isConnected) return;
      items = rows.filter((r) => r && r.data && (typeof o.filter !== 'function' || o.filter(r)));
      folders = fl;
      loaded = true;
      if (folderId && !fById(folderId)) {
        P.ui.toast('폴더를 찾을 수 없어 ' + o.title + ' 맨 위로 왔습니다.', 'warn');
        folderId = null;
        try { history.replaceState(null, '', backHref(kind)); } catch (e) { /* 무시 */ }
      }
      render();
    }

    /* ---------- 고치기 ---------- */
    async function putItem(it) { await P.store.put(col, it.id, it.data); }
    async function moveTo(itemIds, folderIds, target) {
      const t = target || null;
      let n = 0, skipped = 0;
      for (const id of itemIds) {
        const it = items.find((x) => x.id === id);
        if (!it || itemFolder(it) === t) continue;
        it.data.folder = t;
        await putItem(it);
        n++;
      }
      for (const id of folderIds) {
        const f = fById(id);
        if (!f || parentOf(f) === t) continue;
        if (t && isInside(t, id)) { skipped++; continue; }
        f.data.parent = t;
        await P.store.put(fcol, f.id, f.data);
        n++;
      }
      if (skipped) P.ui.toast('폴더를 자기 안으로 옮길 수는 없습니다.', 'warn');
      if (n) P.ui.toast(n + '개를 "' + (t ? fName(fById(t)) : o.title) + '"(으)로 옮겼습니다.', 'ok');
      sel.clear();
      await load();
    }
    function folderTreeHTML(exclude) {
      const rows = [];
      const walk = (parent, depth) => {
        folders.filter((f) => parentOf(f) === parent).sort((a, b) => fName(a).localeCompare(fName(b), 'ko')).forEach((f) => {
          const bad = exclude && exclude.some((x) => isInside(f.id, x));
          rows.push('<button type="button" class="list-row p-fb-pick" data-to="' + esc(f.id) + '" style="--d:' + depth + '"' + (bad ? ' disabled' : '') + '><span class="p-fb-ic p-fb-ic-folder">' + IC.folder + '</span><span class="list-row-main"><b>' + esc(fName(f)) + '</b></span>' + (f.id === folderId ? '<span class="list-row-end">지금 폴더</span>' : '') + '</button>');
          walk(f.id, depth + 1);
        });
      };
      walk(null, 1);
      return '<div class="list p-fb-tree" role="listbox" aria-label="옮길 폴더">' +
        '<button type="button" class="list-row p-fb-pick" data-to="" style="--d:0"><span class="p-fb-ic p-fb-ic-folder">' + IC.folder + '</span><span class="list-row-main"><b>' + esc(o.title) + ' (맨 위)</b></span>' + (!folderId ? '<span class="list-row-end">지금 폴더</span>' : '') + '</button>' +
        rows.join('') + '</div>';
    }
    function moveDialog(itemIds, folderIds) {
      const n = itemIds.length + folderIds.length;
      if (!n) return;
      const body = document.createElement('div');
      body.innerHTML = '<p class="p-modal-msg p-fb-move-msg">' + n + '개를 옮길 폴더를 고르세요.</p>' + folderTreeHTML(folderIds) +
        '<button type="button" class="btn btn-sm btn-ghost p-fb-move-new">' + IC.folderPlus + '새 폴더 만들어 옮기기</button>';
      let target = folderId || '';
      const mark = () => body.querySelectorAll('.p-fb-pick').forEach((b) => { const onn = b.dataset.to === target; b.classList.toggle('is-on', onn); b.setAttribute('aria-selected', String(onn)); });
      mark();
      body.addEventListener('click', async (e) => {
        const b = e.target.closest('.p-fb-pick');
        if (b && !b.disabled) { target = b.dataset.to; mark(); return; }
        if (e.target.closest('.p-fb-move-new')) {
          const name = await ask('새 폴더 이름 (' + (target ? fName(fById(target)) : o.title) + ' 안에 만듭니다)', '새 폴더');
          if (name == null || !name.trim()) return;
          const id = P.store.uid();
          await P.store.put(fcol, id, { name: name.trim().slice(0, 80), parent: target || null, createdAt: new Date().toISOString() });
          close();
          await load();
          await moveTo(itemIds, folderIds, id);
        }
      });
      body.addEventListener('dblclick', (e) => { const b = e.target.closest('.p-fb-pick'); if (b && !b.disabled) { target = b.dataset.to; close(); moveTo(itemIds, folderIds, target || null); } });
      const close = P.ui.modal({
        title: '폴더로 이동', body,
        actions: [{ label: '취소' }, { label: '여기로 이동', primary: true, onClick: () => moveTo(itemIds, folderIds, target || null) }]
      });
    }
    async function newFolder() {
      const name = await ask('새 폴더 이름', '새 폴더');
      if (name == null || !name.trim()) return;
      try {
        await P.store.put(fcol, P.store.uid(), { name: name.trim().slice(0, 80), parent: folderId, createdAt: new Date().toISOString() });
        P.ui.toast('"' + name.trim() + '" 폴더를 만들었습니다.', 'ok');
        await load();
      } catch (e) { /* core가 알림 */ }
    }
    async function renameFolder(f) {
      const name = await ask('폴더 이름', fName(f));
      if (name == null || !name.trim()) return;
      f.data.name = name.trim().slice(0, 80);
      await P.store.put(fcol, f.id, f.data);
      P.ui.toast('폴더 이름을 바꿨습니다.', 'ok');
      await load();
    }
    async function deleteFolder(f) {
      const kidsI = items.filter((it) => itemFolder(it) === f.id);
      const kidsF = folders.filter((x) => parentOf(x) === f.id);
      const up = parentOf(f);
      const upName = up ? fName(fById(up)) : o.title;
      const n = kidsI.length + kidsF.length;
      const msg = '"' + fName(f) + '" 폴더를 삭제할까요?' + (n ? '\n안에 있는 ' + n + '개(' + o.itemName + ' ' + kidsI.length + '개, 폴더 ' + kidsF.length + '개)는 지우지 않고 "' + upName + '"(으)로 옮깁니다.' : '\n빈 폴더입니다.');
      const ok = await P.ui.confirm(msg, { danger: true, okLabel: n ? '옮기고 삭제' : '삭제' });
      if (!ok) return;
      for (const it of kidsI) { it.data.folder = up; await putItem(it); }
      for (const x of kidsF) { x.data.parent = up; await P.store.put(fcol, x.id, x.data); }
      await P.store.remove(fcol, f.id);
      P.ui.toast('폴더를 삭제했습니다.' + (n ? ' 안의 ' + n + '개는 "' + upName + '"에 있습니다.' : ''), 'ok');
      await load();
    }
    function dupData(it) {
      if (typeof o.dup === 'function') return o.dup(it);
      const copy = JSON.parse(JSON.stringify(it.data));
      copy.title = (copy.title || o.itemName) + ' (사본)';
      copy.createdAt = new Date().toISOString();
      return copy;
    }
    async function renameItem(it) {
      const name = await ask('새 이름', titleOf(it));
      if (name == null || !name.trim()) return;
      if (typeof o.rename === 'function') await o.rename(it, name.trim());
      else { it.data.title = name.trim().slice(0, 120); await putItem(it); }
      P.ui.toast('이름을 바꿨습니다.', 'ok');
      await load();
    }
    async function dupItems(list) {
      for (const it of list) await P.store.put(col, P.store.uid(), dupData(it));
      P.ui.toast(list.length > 1 ? list.length + '개를 복제했습니다.' : '복제했습니다.', 'ok');
      sel.clear();
      await load();
    }
    async function delItems(list) {
      if (!list.length) return;
      const msg = list.length === 1 ? '"' + titleOf(list[0]) + '"을(를) 삭제할까요?\n삭제하면 되돌릴 수 없습니다.' : list.length + '개 ' + o.itemName + '을(를) 삭제할까요?\n삭제하면 되돌릴 수 없습니다.';
      const ok = await P.ui.confirm(msg, { danger: true, okLabel: '삭제' });
      if (!ok) return;
      for (const it of list) await P.store.remove(col, it.id);
      list.forEach((it) => sel.delete(it.id));
      P.ui.toast(list.length > 1 ? list.length + '개를 삭제했습니다.' : '삭제했습니다.', 'ok');
      await load();
    }
    function smallMenu(anchor, entries) {
      // 좁은 화면용 동작 메뉴: 내보내기 메뉴와 같은 모양
      const fake = { exportBtn: anchor, o: { menuClass: 'p-fb-menu' } };
      closeMenu();
      const list = entries.map((x) => ({ id: x.id, label: x.label, icon: x.icon, run: x.run }));
      exportMenu(fake, list, '');
      const pop = document.querySelector('.p-fb-menu');
      if (pop) {
        const t = pop.querySelector('.p-io-title span'); if (t) t.textContent = '동작';
        const ft = pop.querySelector('.p-io-foot'); if (ft) ft.remove();
      }
    }

    /* ---------- 이벤트 ---------- */
    on(el, 'click', async (e) => {
      const t = e.target;
      const v = t.closest('button[data-view]');
      if (v) { view = v.dataset.view; P.settings.set(kind + '.view', view); render(); return; }
      if (t.closest('[data-fb="newfolder"]')) { newFolder(); return; }
      if (t.closest('.p-fb-new, [data-fb="new"]')) {
        e.preventDefault();
        try { await o.newItem(folderId); } catch (err) { /* core가 알림 */ }
        return;
      }
      const tpl = t.closest('[data-tpl]');
      if (tpl && o.onTemplate) { try { await o.onTemplate(tpl.dataset.tpl, folderId, tpl); } catch (err) { /* core가 알림 */ } return; }
      const bulk = t.closest('[data-bulk]');
      if (bulk) {
        const rows = selRows();
        const b = bulk.dataset.bulk;
        if (b === 'clear') { sel.clear(); render(); }
        else if (b === 'move') moveDialog(rows.map((x) => x.id), []);
        else if (b === 'dup') P.ui.busy(bulk, () => dupItems(rows));
        else if (b === 'del') delItems(rows);
        return;
      }
      const ia = t.closest('[data-act]');
      const row = t.closest('[data-id]');
      if (ia && row && box.contains(row)) {
        const it = items.find((x) => x.id === row.dataset.id);
        if (!it) return;
        const a = ia.dataset.act;
        try {
          if (a === 'rename') await renameItem(it);
          else if (a === 'dup') await dupItems([it]);
          else if (a === 'move') moveDialog([it.id], []);
          else if (a === 'del') await delItems([it]);
          else if (a === 'more') smallMenu(ia, [
            { id: 'open', label: '열기', icon: P.icons.arrow, run: () => { location.hash = o.href(it); } },
            { id: 'rename', label: '이름 바꾸기', icon: IC.edit, run: () => renameItem(it) },
            { id: 'dup', label: '복제', icon: IC.copy, run: () => dupItems([it]) },
            { id: 'move', label: '폴더로 이동', icon: IC.move, run: () => moveDialog([it.id], []) },
            { id: 'del', label: '삭제', icon: IC.trash, run: () => delItems([it]) }
          ]);
        } catch (err) { /* core가 알림 */ }
        return;
      }
      const fa = t.closest('[data-fact]');
      const frow = t.closest('[data-folder]');
      if (fa && frow) {
        const f = fById(frow.dataset.folder);
        if (!f) return;
        const a = fa.dataset.fact;
        try {
          if (a === 'rename') await renameFolder(f);
          else if (a === 'move') moveDialog([], [f.id]);
          else if (a === 'del') await deleteFolder(f);
          else if (a === 'more') smallMenu(fa, [
            { id: 'open', label: '열기', icon: P.icons.arrow, run: () => { location.hash = backHref(kind, f.id); } },
            { id: 'rename', label: '이름 바꾸기', icon: IC.edit, run: () => renameFolder(f) },
            { id: 'move', label: '폴더로 이동', icon: IC.move, run: () => moveDialog([], [f.id]) },
            { id: 'del', label: '폴더 삭제', icon: IC.trash, run: () => deleteFolder(f) }
          ]);
        } catch (err) { /* core가 알림 */ }
        return;
      }
      if (typeof o.onAction === 'function') {
        const x = t.closest('[data-fb-act]');
        if (x) o.onAction(x.dataset.fbAct, x, folderId);
      }
    });
    on(el, 'change', (e) => {
      const c = e.target;
      if (c.matches('input[data-sel]')) {
        if (c.checked) sel.add(c.dataset.sel); else sel.delete(c.dataset.sel);
        const r = c.closest('.p-fb-item');
        if (r) r.classList.toggle('is-sel', c.checked);
        paintSel();
      } else if (c.closest('.p-fb-chk-all')) {
        const on_ = c.checked;
        box.querySelectorAll('input[data-sel]').forEach((x) => { x.checked = on_; if (on_) sel.add(x.dataset.sel); else sel.delete(x.dataset.sel); const r = x.closest('.p-fb-item'); if (r) r.classList.toggle('is-sel', on_); });
        paintSel();
      } else if (c === allChk) { everywhere = c.checked; render(); }
      else if (c === sortSel) { sort = sortSel.value; P.settings.set(kind + '.sort', sort); render(); }
    });
    on(search, 'input', () => { q = search.value; render(); });
    on(search, 'keydown', (e) => { if (e.key === 'Escape' && search.value) { e.stopPropagation(); search.value = ''; q = ''; render(); } });

    /* 끌어서 옮기기 (항목·폴더 → 폴더 줄·칸, 위치 표시줄) · 파일 끌어다 놓기 = 가져오기 */
    const MIME = 'application/x-p-files';
    let dragging = null;
    on(el, 'dragstart', (e) => {
      const r = e.target.closest && e.target.closest('[data-id], [data-folder]');
      if (!r || !box.contains(r)) return;
      let ids = [], fids = [];
      if (r.dataset.id) ids = sel.has(r.dataset.id) ? Array.from(sel) : [r.dataset.id];
      else fids = [r.dataset.folder];
      dragging = { ids, fids };
      try {
        e.dataTransfer.setData(MIME, JSON.stringify(dragging));
        e.dataTransfer.setData('text/plain', (ids.length + fids.length) + '개');
        e.dataTransfer.effectAllowed = 'move';
      } catch (err) { /* 무시 */ }
      requestAnimationFrame(() => {
        box.querySelectorAll('.p-fb-item, .p-fb-folder').forEach((n) => { if (ids.includes(n.dataset.id) || fids.includes(n.dataset.folder)) n.classList.add('is-drag'); });
        page.classList.add('is-dragging');
      });
    });
    const endDrag = () => {
      dragging = null;
      page.classList.remove('is-dragging');
      el.querySelectorAll('.is-drag, .is-drop').forEach((n) => n.classList.remove('is-drag', 'is-drop'));
    };
    on(el, 'dragend', endDrag);
    const isFileDrag = (e) => { const t = e.dataTransfer && e.dataTransfer.types; return !!t && Array.from(t).includes('Files'); };
    const isOurDrag = (e) => { const t = e.dataTransfer && e.dataTransfer.types; return !!dragging || (!!t && Array.from(t).includes(MIME)); };
    const dropTarget = (e) => {
      const t = e.target.closest && e.target.closest('.p-fb-folder, .p-fb-cr[data-drop]');
      if (!t || !el.contains(t)) return null;
      const id = t.classList.contains('p-fb-folder') ? t.dataset.folder : t.dataset.drop;
      return { node: t, id: id || null };
    };
    let dropDepth = 0;
    on(el, 'dragenter', (e) => {
      if (isFileDrag(e) && !isOurDrag(e) && ioInst) { dropDepth++; drop.hidden = false; page.classList.add('is-filedrop'); }
    });
    on(el, 'dragleave', (e) => {
      if (isFileDrag(e) && !isOurDrag(e)) { dropDepth = Math.max(0, dropDepth - 1); if (!dropDepth) { drop.hidden = true; page.classList.remove('is-filedrop'); } }
      const t = dropTarget(e);
      if (t && !t.node.contains(e.relatedTarget)) t.node.classList.remove('is-drop');
    });
    on(el, 'dragover', (e) => {
      const t = dropTarget(e);
      if (isOurDrag(e)) {
        if (!t) return;
        const d = dragging;
        if (d && t.id && d.fids.some((f) => isInside(t.id, f))) return; // 자기 안으로는 안 됨
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.querySelectorAll('.is-drop').forEach((n) => { if (n !== t.node) n.classList.remove('is-drop'); });
        t.node.classList.add('is-drop');
        return;
      }
      if (isFileDrag(e) && ioInst) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        el.querySelectorAll('.is-drop').forEach((n) => { if (!t || n !== t.node) n.classList.remove('is-drop'); });
        if (t && t.node.classList.contains('p-fb-folder')) t.node.classList.add('is-drop');
      }
    });
    on(el, 'drop', async (e) => {
      const t = dropTarget(e);
      if (isOurDrag(e)) {
        e.preventDefault();
        let d = dragging;
        if (!d) { try { d = JSON.parse(e.dataTransfer.getData(MIME) || 'null'); } catch (err) { d = null; } }
        endDrag();
        if (!d || !t) return;
        await moveTo(d.ids || [], (d.fids || []).filter((f) => f !== t.id), t.id);
        return;
      }
      if (isFileDrag(e) && ioInst) {
        e.preventDefault();
        dropDepth = 0;
        drop.hidden = true;
        page.classList.remove('is-filedrop');
        el.querySelectorAll('.is-drop').forEach((n) => n.classList.remove('is-drop'));
        const files = Array.from(e.dataTransfer.files || []);
        if (!files.length) return;
        const prev = folderId;
        if (t && t.node.classList.contains('p-fb-folder')) folderId = t.id;
        try { await ioInst.importFiles(files); } finally { folderId = prev; }
        if (el.isConnected) load();
      } else if (ioInst && ioInst.canPaste() && e.dataTransfer && e.dataTransfer.getData('text/plain')) {
        e.preventDefault();
        ioInst.importText(e.dataTransfer.getData('text/plain'));
      }
    });
    /* 붙여넣기로 가져오기 (차트처럼 글 가져오기를 받는 앱) */
    on(document, 'paste', (e) => {
      if (!ioInst || !ioInst.canPaste() || !el.isConnected || typing(e.target) || modalOpen()) return;
      const text = e.clipboardData && e.clipboardData.getData('text/plain');
      if (!text || !text.trim()) return;
      e.preventDefault();
      ioInst.importText(text);
    });
    on(document, 'keydown', (e) => {
      if (e.key === 'Escape' && sel.size && !modalOpen() && !typing(e.target) && el.isConnected && !openMenu) { sel.clear(); render(); }
    });

    const api = {
      reload: load,
      folder: () => folderId,
      selection: () => selRows(),
      io: ioInst,
      destroy() { offs.forEach((f) => f()); closeMenu(); }
    };
    paintCrumb();
    paintView();
    load();
    return api;
  }

  P.files = { ioButtons, browser, backHref, icons: IC, relTime, closeMenu };
})();
