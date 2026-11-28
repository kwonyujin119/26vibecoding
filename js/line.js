/* 한 줄 명령: 입력칸 + 실시간 미리보기 + 대상 바꾸기(Tab, 끝에서 →, 처음에서 ←) + Enter 실행 + 되돌리기
   해석은 js/nl.js (P.nl.parse), 여기서는 화면과 저장만.
   P.line.attach(input, previewBox, opts) → 입력칸 하나를 한 줄 명령으로
   P.line.open(text)                     → 어디서든 떠 있는 한 줄 명령 창 (홈에서는 홈 입력칸으로)
   단축키: / (입력 중이 아닐 때). Ctrl+J 등 브라우저 단축키는 쓰지 않음 */
(function () {
  'use strict';
  if (!window.P) return;
  const esc = (s) => P.esc(s);
  const MY_COLS = ['my-schedule-events', 'my-schedule-todos', 'my-schedule-config'];
  const EXAMPLES = [
    '내일 오후 3시 2층 회의실 국장님 업무보고',
    '다음 주 금요일까지 예산안 제출',
    '모레 10시 주간회의',
    '12/3~12/5 세종 출장',
    '보고서 새로',
    '출장비 정산하기'
  ];

  /* ---------- 문맥: 등록된 부서장 · 앱 ---------- */
  let ctxCache = null;
  let ctxAt = 0;
  async function context(force) {
    if (!force && ctxCache && Date.now() - ctxAt < 5000) return ctxCache;
    let people = [];
    try {
      // get 대신 list: 사무실 서버에서 없는 항목을 물으면 404 가 콘솔에 남음
      const rows = P.apps().some((a) => a.id === 'head-schedule') ? await P.store.list('head-schedule-config') : [];
      const cfg = (rows || []).find((r) => r.id === 'people');
      people = cfg && cfg.data && Array.isArray(cfg.data.people) ? cfg.data.people.filter((p) => p && p.id) : [];
    } catch (e) { people = []; }
    ctxCache = { people, apps: P.apps().map((a) => a.id) };
    ctxAt = Date.now();
    return ctxCache;
  }
  window.addEventListener('p:data', (e) => { if (e.detail && /head-schedule-config/.test(e.detail.col || '')) ctxAt = 0; });
  const quickCtx = () => ctxCache || { people: [], apps: P.apps().map((a) => a.id) };

  /* ---------- 알림(단추 있는 토스트) ---------- */
  function actionToast(msg, actions, ms) {
    let box = document.getElementById('p-toasts');
    if (!box) { box = document.createElement('div'); box.id = 'p-toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const node = document.createElement('div');
    node.className = 'p-toast p-toast-ok p-toast-act';
    node.setAttribute('role', 'status');
    node.innerHTML = '<span class="p-toast-ic">' + P.icons.check + '</span><span class="p-toast-msg">' + esc(msg) + '</span>' +
      (actions || []).map((a, i) => '<button type="button" class="p-toast-btn" data-i="' + i + '">' + esc(a.label) + '</button>').join('');
    let timer = 0;
    const close = () => { clearTimeout(timer); if (!node.isConnected) return; node.classList.add('out'); setTimeout(() => node.remove(), 200); };
    node.addEventListener('click', (e) => {
      const b = e.target.closest('.p-toast-btn');
      if (!b) return;
      const a = actions[Number(b.dataset.i)];
      close();
      if (a && typeof a.run === 'function') { try { a.run(); } catch (er) { console.error(er); } }
    });
    // 마우스·초점이 머무는 동안은 닫지 않음
    const arm = () => { clearTimeout(timer); timer = setTimeout(close, ms || 7000); };
    node.addEventListener('pointerenter', () => clearTimeout(timer));
    node.addEventListener('pointerleave', arm);
    node.addEventListener('focusin', () => clearTimeout(timer));
    node.addEventListener('focusout', arm);
    box.appendChild(node);
    arm();
    return close;
  }

  /* ---------- 실행 ---------- */
  const notify = (col) => { try { window.dispatchEvent(new CustomEvent('p:data', { detail: { col } })); } catch (e) { /* 무시 */ } };
  function hrefFor(kind, id) {
    const e = encodeURIComponent(id);
    return {
      head: '#/head-schedule/' + e, dept: '#/schedule/events/' + e, mine: '#/my-schedule/today/' + e,
      task: '#/schedule/tasks/' + e, todo: '#/my-schedule/todos/' + e, doc: '#/docs/' + e, slides: '#/slides/' + e, sheet: '#/sheets/' + e
    }[kind] || '#/home';
  }
  async function exec(kind, fields) {
    const rec = P.nl.record(kind, fields);
    if (!rec) throw new Error('만들 수 없는 종류입니다.');
    if (kind === 'chart') { P.navigate('charts/new'); return { kind, opened: true }; }
    const id = P.store.uid();
    let data = rec.data;
    let S = P.store;
    if (rec.local) {
      S = P.store.local;
      if (S.mark) S.mark(MY_COLS);
    }
    if (kind === 'doc') {
      const K = window.DocsKit;
      if (!K) throw new Error('문서 앱을 불러오지 못했습니다.');
      const tpl = K.templates().find((t) => t.id === rec.template) || K.templates()[0];
      data = K.newDocData(tpl, rec.title || null);
      data.folder = null;
    } else if (kind === 'slides') {
      if (!window.SlidesKit) throw new Error('PT 앱을 불러오지 못했습니다.');
      data = window.SlidesKit.newData(rec.title);
      data.folder = null;
    } else if (kind === 'sheet') {
      if (!window.SheetsKit) throw new Error('엑셀 앱을 불러오지 못했습니다.');
      data = window.SheetsKit.newData(rec.title);
    }
    await S.put(rec.col, id, data);
    notify(rec.col);
    return { kind, col: rec.col, id, local: !!rec.local, title: data.title || '', href: hrefFor(kind, id), undo: () => undoCreate(S, rec.col, id, kind) };
  }
  async function undoCreate(S, col, id, kind) {
    const here = (location.hash || '').indexOf(hrefFor(kind, id).slice(1)) >= 0;
    if (here) { P.navigate('home'); await new Promise((r) => setTimeout(r, 450)); }
    await S.remove(col, id);
    notify(col);
    P.ui.toast('되돌렸습니다.', 'info');
  }
  const DONE_MSG = { head: '부서장 일정에 넣었습니다', dept: '부서 일정에 넣었습니다', mine: '내 일정에 넣었습니다', task: '주요업무에 넣었습니다', todo: '할 일에 넣었습니다', doc: '새 문서를 만들었습니다', slides: '새 PT를 만들었습니다', sheet: '새 통합문서를 만들었습니다' };
  async function run(parsed, kind, opts) {
    const o = opts || {};
    const k = kind || parsed.kind;
    const res = await exec(k, parsed.fields);
    if (res.opened) return res;
    const label = DONE_MSG[k] || '만들었습니다';
    const make = ['doc', 'slides', 'sheet'].includes(k);
    if (make && o.openMade !== false) P.navigate(res.href.slice(2));
    const acts = [];
    if (!make) acts.push({ label: '보기', run: () => P.navigate(res.href.slice(2)) });
    acts.push({ label: '되돌리기', run: () => res.undo() });
    actionToast(label + (res.title && make ? ': ' + res.title : '') + '.', acts);
    return res;
  }

  /* ---------- 입력칸 붙이기 ---------- */
  function attach(input, box, opts) {
    const o = opts || {};
    const live = o.live || null;
    let parsed = null;
    let kind = null;
    let liveT = 0;
    let busy = false;
    function chip(k, on) {
      const lab = k === 'doc' && parsed ? P.nl.labelFor('doc', parsed.fields) : (P.nl.kinds[k] || {}).label || k;
      return '<button type="button" class="ln-kind' + (on ? ' on' : '') + '" data-k="' + k + '" aria-pressed="' + on + '" tabindex="-1">' + esc(lab) + '</button>';
    }
    function render() {
      const txt = input.value;
      if (!txt.trim()) {
        parsed = null; kind = null;
        box.innerHTML = o.empty ? o.empty() : '';
        box.classList.remove('has');
        input.removeAttribute('data-kind');
        if (live) live.textContent = '';
        return;
      }
      parsed = P.nl.parse(txt, new Date(), quickCtx());
      if (!kind || !parsed.alts.includes(kind)) kind = parsed.kind;
      const pv = P.nl.previewFor(kind, parsed.fields, quickCtx()).split(' · ');
      pv.shift();
      const tt = P.nl.titleFor(kind, parsed.fields);
      const low = parsed.confidence < 0.35;
      box.classList.add('has');
      input.setAttribute('data-kind', kind);
      box.innerHTML =
        '<div class="ln-pv' + (low ? ' low' : '') + '">' +
        '<div class="ln-kinds" role="group" aria-label="만들 곳">' + parsed.alts.map((k) => chip(k, k === kind)).join('') + '</div>' +
        '<div class="ln-what">' + (kind === 'doc' ? pv.slice(1) : pv).map((p) => '<span class="ln-part' + (tt && (p === tt || p === '"' + tt + '"') ? ' t' : '') + '">' + esc(p) + '</span>').join('<i aria-hidden="true">·</i>') + '</div>' +
        '<div class="ln-keys" aria-hidden="true"><span><kbd class="kbd">Tab</kbd> 바꾸기</span><span><kbd class="kbd">Enter</kbd> 만들기</span></div>' +
        '</div>';
      clearTimeout(liveT);
      if (live) {
        const say = P.nl.previewFor(kind, parsed.fields, quickCtx()) + (parsed.alts.length > 1 ? '. Tab으로 ' + parsed.alts.length + '곳 중 바꾸기' : '');
        liveT = setTimeout(() => { live.textContent = say; }, 450);
      }
    }
    function cycle(d) {
      if (!parsed || parsed.alts.length < 2) return false;
      const i = parsed.alts.indexOf(kind);
      kind = parsed.alts[(i + d + parsed.alts.length) % parsed.alts.length];
      render();
      if (live) { clearTimeout(liveT); live.textContent = P.nl.previewFor(kind, parsed.fields, quickCtx()); }
      return true;
    }
    async function submit() {
      if (busy) return;
      render();
      if (!parsed) { input.focus(); return; }
      busy = true;
      input.setAttribute('aria-busy', 'true');
      try {
        const p = parsed, k = kind;
        const res = await run(p, k, o);
        input.value = '';
        kind = null;
        render();
        if (typeof o.onDone === 'function') o.onDone(res);
      } catch (e) {
        console.error(e);
        P.ui.toast(e.message || '만들지 못했습니다.', 'error');
      } finally {
        busy = false;
        input.removeAttribute('aria-busy');
      }
    }
    input.addEventListener('input', () => { kind = null; render(); });
    input.addEventListener('focus', () => { context().then(() => { if (input.value.trim()) render(); }); });
    input.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter') { e.preventDefault(); submit(); return; }
      if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey && parsed) { if (cycle(e.shiftKey ? -1 : 1)) e.preventDefault(); return; }
      if (e.key === 'ArrowRight' && !e.shiftKey && parsed && input.selectionStart === input.value.length && input.selectionEnd === input.value.length) { if (cycle(1)) e.preventDefault(); return; }
      if (e.key === 'ArrowLeft' && !e.shiftKey && parsed && input.selectionStart === 0 && input.selectionEnd === 0) { if (cycle(-1)) e.preventDefault(); return; }
      if (e.key === 'Escape') {
        if (input.value) { e.preventDefault(); e.stopPropagation(); input.value = ''; render(); }
        else if (typeof o.onEscape === 'function') { e.preventDefault(); e.stopPropagation(); o.onEscape(); }
      }
    });
    box.addEventListener('mousedown', (e) => { if (e.target.closest('.ln-kind, [data-ex]')) e.preventDefault(); });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('.ln-kind');
      if (b) { kind = b.dataset.k; render(); input.focus(); return; }
      const ex = e.target.closest('[data-ex]');
      if (ex) { input.value = ex.dataset.ex; kind = null; render(); input.focus(); }
    });
    context(true).then(() => { if (input.value.trim()) render(); });
    render();
    return { render, submit, cycle, get: () => ({ parsed, kind }), set: (t) => { input.value = t || ''; kind = null; render(); } };
  }

  /* ---------- 떠 있는 창 ---------- */
  let overlayClose = null;
  function open(text) {
    const homeIn = document.querySelector('.p-app-home .hm-line-in');
    if (homeIn) {
      if (text != null && text !== '') { homeIn.value = text; homeIn.dispatchEvent(new Event('input')); }
      homeIn.focus();
      try { homeIn.scrollIntoView({ block: 'nearest' }); } catch (e) { /* 무시 */ }
      return;
    }
    if (overlayClose) { overlayClose(); return; }
    const last = document.activeElement;
    const back = document.createElement('div');
    back.className = 'p-cmd-back ln-back';
    back.innerHTML = '<div class="p-cmd ln-cmd" role="dialog" aria-modal="true" aria-label="한 줄로 만들기">' +
      '<div class="p-cmd-input ln-input"><span class="ln-glyph" aria-hidden="true">' + P.icons.pen + '</span>' +
      '<input type="text" class="ln-in" autocomplete="off" spellcheck="false" aria-label="한 줄 명령" aria-describedby="ln-ov-pv" placeholder="예: ' + esc(EXAMPLES[0]) + '"><kbd class="kbd">esc</kbd></div>' +
      '<div class="ln-box ln-ov-box" id="ln-ov-pv"></div><span class="sr-only" aria-live="polite" id="ln-ov-live"></span></div>';
    document.body.appendChild(back);
    const input = back.querySelector('input');
    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      overlayClose = null;
      back.classList.add('out');
      setTimeout(() => back.remove(), 220);
      if (last && last.focus && last.isConnected) { try { last.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } }
    }
    overlayClose = close;
    attach(input, back.querySelector('.ln-box'), {
      live: back.querySelector('#ln-ov-live'),
      empty: emptyHelp,
      onDone: close,
      onEscape: close
    });
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    if (text) { input.value = text; input.dispatchEvent(new Event('input')); }
    input.focus();
  }
  function emptyHelp() {
    return '<div class="ln-help"><span class="ln-help-t">이렇게 적어 보세요</span>' +
      EXAMPLES.slice(0, 5).map((x) => '<button type="button" class="ln-ex" data-ex="' + esc(x) + '">' + esc(x) + '</button>').join('') + '</div>';
  }

  /* ---------- 단축키 ---------- */
  const typing = (t) => !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)));
  const blocked = () => !!document.querySelector('.p-modal-back:not(.out), .p-cmd-back:not(.out):not(.ln-back), .slides-pv');
  window.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || e.isComposing) return;
    if (typing(e.target) || blocked()) return;
    e.preventDefault();
    open();
  });

  P.line = { attach, open, run, exec, context, toast: actionToast, examples: EXAMPLES.slice(), emptyHelp };
})();
