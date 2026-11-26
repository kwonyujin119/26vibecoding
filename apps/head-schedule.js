/* 부서장 일정 — 전 직원이 함께 보는 부서장 일정표 (+ 두 스케줄러가 같이 쓰는 SchedKit) */
(function () {
  'use strict';

  /* ================= SchedKit: 날짜·저장·공유 도구 (schedule.js 도 사용) ================= */
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(parse(s));
  const today = () => ymd(new Date());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const addMonths = (s, n) => { const d = parse(s); return ymd(new Date(d.getFullYear(), d.getMonth() + n, 1)); };
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const dow = (s) => parse(s).getDay();
  const md = (s) => { const d = parse(s); return (d.getMonth() + 1) + '.' + d.getDate() + '.(' + DOW[d.getDay()] + ')'; };
  const longDate = (s) => { const d = parse(s); return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + DOW[d.getDay()] + ')'; };
  const weekStart = (s) => addDays(s, -((dow(s) + 6) % 7));
  const monthCells = (s) => {
    const d = parse(s);
    const start = weekStart(ymd(new Date(d.getFullYear(), d.getMonth(), 1)));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  };
  const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const stamp = () => today().replace(/-/g, '');

  /* 사람·구분 색: 밝은 화면·어두운 화면 모두에서 읽히는 중간 밝기. 인주색(--signal)과 겹치는 주홍은 뺌 */
  const PALETTE = ['#4C63B6', '#13897B', '#B7791F', '#7C5CC4', '#C0497A', '#2F86B5', '#5E8F32', '#8A6A4E', '#5B6B7F', '#3F7F9F'];
  function colorFor(name) {
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }
  const NEUTRAL = '#737985';
  const safeColor = (c, fallback) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : fallback || NEUTRAL);

  /* 검색: 띄어쓰기로 나눈 단어가 모두 들어간 항목만 (AND) */
  const terms = (q) => String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  const matchAll = (hay, ts) => { const h = hay.toLowerCase(); return ts.every((t) => h.includes(t)); };
  function mark(text, ts) {
    let out = P.esc(text);
    if (!ts || !ts.length) return out;
    const re = new RegExp('(' + ts.map((t) => P.esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
    return out.replace(/(<[^>]*>)|([^<]+)/g, (m, tag, txt) => tag || txt.replace(re, '<mark>$1</mark>'));
  }

  function isTyping(e) {
    const t = e.target;
    if (document.querySelector('.p-modal-back, .p-pop')) return true;
    return !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)));
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* 아래 방식으로 */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }
  /* 공유 문구 창: 자동 복사 시도 + 직접 고칠 수 있는 글상자 */
  function shareText(title, text) {
    const ta = document.createElement('textarea');
    ta.className = 'sch-share-text';
    ta.value = text;
    ta.rows = Math.min(18, text.split('\n').length + 1);
    const close = P.ui.modal({
      title,
      body: ta,
      wide: true,
      actions: [{ label: '닫기' }, { label: '복사', primary: true, onClick: async () => {
        const ok = await copyText(ta.value);
        P.ui.toast(ok ? '복사했습니다. 메신저에 붙여넣으세요.' : '복사가 막혀 있습니다. 글상자를 선택해 직접 복사하세요.', ok ? 'ok' : 'warn');
        return ok;
      } }]
    });
    copyText(text).then((ok) => { if (ok) P.ui.toast('클립보드에 복사했습니다.', 'ok'); });
    return close;
  }

  /* 화면과 분리된 인쇄(숨은 iframe) — 다른 앱의 인쇄 설정에 영향 없음 */
  function printHTML(title, html, landscape) {
    const f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(f);
    const d = f.contentDocument;
    d.open();
    d.write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>' + P.esc(title) + '</title><style>' +
      '@page{size:A4 ' + (landscape ? 'landscape' : 'portrait') + ';margin:9mm}' +
      'body{font-family:"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif;color:#111;margin:0;font-size:10.5pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      'h1{font-size:16pt;margin:0 0 2mm}.sub{color:#555;margin:0 0 4mm;font-size:9.5pt}' +
      'table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #999;padding:4px 5px;vertical-align:top;word-break:keep-all;overflow-wrap:anywhere}' +
      'th{background:#eef1f7;font-size:10pt}td.who{font-weight:700;background:#f7f8fb}.today{background:#fffbe6}' +
      '.it{margin:0 0 4px;line-height:1.35}.t{font-weight:700;margin-right:3px}.pl{color:#555;font-size:9pt}.k{font-size:8.5pt;color:#333;border:1px solid #bbb;border-radius:3px;padding:0 2px;margin-right:2px}' +
      '.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px}' +
      '</style></head><body>' + html + '</body></html>');
    d.close();
    const done = () => setTimeout(() => f.remove(), 500);
    setTimeout(() => {
      try {
        f.contentWindow.addEventListener('afterprint', done);
        f.contentWindow.focus();
        f.contentWindow.print();
      } catch (e) { P.ui.toast('인쇄 창을 열지 못했습니다.', 'error'); }
      setTimeout(() => { if (f.isConnected) f.remove(); }, 120000);
    }, 150);
  }

  /* 캐시 + 저장 + 실행 취소 기록을 함께 다루는 저장소 */
  function makeRepo(cols, onStatus) {
    const cache = {};
    cols.forEach((c) => { cache[c] = new Map(); });
    const undoStack = [];
    const redoStack = [];
    let pending = 0;
    const status = (s) => { if (onStatus) onStatus(s, undoStack.length, redoStack.length); };
    const strip = (d) => { if (!d) return d; const o = Object.assign({}, d); delete o.id; delete o.updatedAt; return o; };

    async function load() {
      await Promise.all(cols.map(async (c) => {
        const rows = await P.store.list(c);
        cache[c] = new Map(rows.map((r) => [r.id, Object.assign({}, r.data, { id: r.id, updatedAt: r.updatedAt })]));
      }));
    }
    function signature() {
      return cols.map((c) => { let m = ''; cache[c].forEach((v) => { if (v.updatedAt > m) m = v.updatedAt; }); return c + cache[c].size + m; }).join('|');
    }
    async function write(col, id, data) {
      if (data) cache[col].set(id, Object.assign({}, strip(data), { id, updatedAt: new Date().toISOString() }));
      else cache[col].delete(id);
      pending++;
      status('saving');
      try {
        if (data) await P.store.put(col, id, strip(data));
        else await P.store.remove(col, id);
        pending--;
        status(pending ? 'saving' : 'saved');
      } catch (e) {
        pending--;
        status('error');
        throw e;
      }
    }
    /* changes: [{col, id, data|null}] — 하나의 실행 취소 단위 */
    async function apply(label, changes) {
      const rec = changes.map((c) => ({ col: c.col, id: c.id, before: cache[c.col].get(c.id) || null, after: c.data || null }));
      undoStack.push({ label, rec });
      if (undoStack.length > 60) undoStack.shift();
      redoStack.length = 0;
      await Promise.all(rec.map((r) => write(r.col, r.id, r.after)));
    }
    async function undo() {
      const op = undoStack.pop();
      if (!op) { status('idle'); return null; }
      redoStack.push(op);
      await Promise.all(op.rec.map((r) => write(r.col, r.id, r.before)));
      return op.label;
    }
    async function redo() {
      const op = redoStack.pop();
      if (!op) { status('idle'); return null; }
      undoStack.push(op);
      await Promise.all(op.rec.map((r) => write(r.col, r.id, r.after)));
      return op.label;
    }
    return {
      load, signature, apply, undo, redo,
      all: (c) => Array.from(cache[c].values()),
      get: (c, id) => cache[c].get(id) || null,
      put: (c, id, data, label) => apply(label || '저장', [{ col: c, id, data }]),
      remove: (c, id, label) => apply(label || '삭제', [{ col: c, id, data: null }])
    };
  }

  /* 저장 상태 표시 + 실행 취소/다시 실행 단추 */
  function statusBar() {
    const box = document.createElement('div');
    box.className = 'sch-status';
    box.innerHTML =
      '<button type="button" class="btn btn-ghost btn-sm p-icon-btn" data-act="undo" title="실행 취소 (Ctrl+Z)" aria-label="실행 취소" disabled>' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg></button>' +
      '<button type="button" class="btn btn-ghost btn-sm p-icon-btn" data-act="redo" title="다시 실행 (Ctrl+Y)" aria-label="다시 실행" disabled>' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/></svg></button>' +
      '<span class="sch-save" role="status" aria-live="polite" data-state="idle"></span>';
    const label = box.querySelector('.sch-save');
    function set(state, nUndo, nRedo) {
      if (state !== 'idle') {
        label.dataset.state = state;
        label.textContent = state === 'saving' ? '저장 중…' : state === 'error' ? '저장 실패' : '저장됨 ' + nowHM();
      }
      if (nUndo != null) {
        box.querySelector('[data-act="undo"]').disabled = !nUndo;
        box.querySelector('[data-act="redo"]').disabled = !nRedo;
      }
    }
    return { el: box, set };
  }

  /* 공유 저장소(클라우드·서버)일 때 1분마다 다른 사람이 바꾼 내용을 받아 옴 */
  function autoRefresh(repo, render) {
    const tick = async () => {
      if (P.store.backend() === 'local' || document.hidden || document.querySelector('.p-modal-back')) return;
      const before = repo.signature();
      try { await repo.load(); } catch (e) { return; }
      if (repo.signature() !== before) render();
    };
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }

  function readJSONFile() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('change', async () => {
        const f = input.files && input.files[0];
        if (!f) return resolve(null);
        try { resolve(JSON.parse(await f.text())); } catch (e) { P.ui.toast('JSON 파일을 읽지 못했습니다.', 'error'); resolve(null); }
      });
      input.click();
    });
  }

  const svgIcon = (d) => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const IC = {
    left: svgIcon('<path d="M15 6l-6 6 6 6"/>'),
    right: svgIcon('<path d="M9 6l6 6-6 6"/>'),
    copy: svgIcon('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>'),
    print: svgIcon('<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><rect x="7" y="14" width="10" height="7"/>'),
    image: svgIcon('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>'),
    users: svgIcon('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>'),
    more: svgIcon('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'),
    pin: svgIcon('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
    clock: svgIcon('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    calendar: svgIcon('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    list: svgIcon('<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>'),
    sun: svgIcon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>')
  };

  /* 작은 팝오버 메뉴 (⋯ 단추용) */
  function popMenu(anchor, items) {
    const pop = document.createElement('div');
    pop.className = 'p-pop sch-menu';
    pop.setAttribute('role', 'menu');
    pop.innerHTML = items.map((it, i) => '<button type="button" role="menuitem" class="p-pop-item" data-i="' + i + '"><span class="p-pop-ic">' + (it.icon || '') + '</span><span class="p-pop-txt"><b>' + P.esc(it.label) + '</b>' + (it.desc ? '<small>' + P.esc(it.desc) + '</small>' : '') + '</span></button>').join('');
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    const w = Math.min(280, window.innerWidth - 16);
    pop.style.width = w + 'px';
    const h = pop.offsetHeight;
    pop.style.top = (r.bottom + 6 + h > window.innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
    pop.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
    const onDoc = (e) => { if (!pop.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); anchor.focus(); } };
    function close() {
      pop.remove();
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey, true);
    }
    setTimeout(() => { document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey, true); });
    pop.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      close();
      items[Number(b.dataset.i)].onClick();
    });
    const first = pop.querySelector('button');
    if (first) first.focus();
    return close;
  }

  window.SchedKit = {
    DOW, pad, parse, isDate, today, addDays, addMonths, diffDays, dow, md, longDate, weekStart, monthCells, nowHM, stamp,
    PALETTE, NEUTRAL, colorFor, safeColor, terms, matchAll, mark, isTyping, shareText, printHTML, makeRepo, statusBar, autoRefresh, readJSONFile, popMenu, IC
  };

  /* ================= 부서장 일정 앱 ================= */
  const K = window.SchedKit;
  const COL = 'head-schedule';
  const CFG = 'head-schedule-config';
  const KINDS = ['회의', '행사', '출장', '보고', '외부일정', '기타'];
  const ALL = '_all';
  const NONE = '_none';

  function mount(root, ctx) {
    const bar = K.statusBar();
    const repo = K.makeRepo([COL, CFG], bar.set);
    const st = {
      view: ['today', 'week', 'month'].includes(ctx.params[0]) ? ctx.params[0] : P.settings.get('head-schedule.view', 'today'),
      date: K.today(),
      who: P.settings.get('head-schedule.who', ALL),
      narrow: false
    };
    root.innerHTML = '<div class="page sch-page">' + P.ui.skeleton(4) + '</div>';
    const page = root.firstChild;
    let clock = null;

    const people = () => ((repo.get(CFG, 'people') || {}).people || []);
    const personById = (id) => people().find((p) => p.id === id);
    const personLabel = (p) => p.name + (p.title ? ' ' + p.title : '');
    const events = () => repo.all(COL);
    const endOf = (e) => (e.endDate && e.endDate > e.date ? e.endDate : e.date);
    const onDay = (e, d) => e.date <= d && d <= endOf(e);
    const byTime = (a, b) => (a.allDay === b.allDay ? 0 : a.allDay ? -1 : 1) || String(a.start || '').localeCompare(String(b.start || '')) || String(a.title).localeCompare(String(b.title), 'ko');
    const visible = (e) => st.who === ALL || (st.who === NONE ? !(e.heads || []).length : (e.heads || []).includes(st.who));
    const dayEvents = (d, all) => events().filter((e) => onDay(e, d) && (all || visible(e))).sort(byTime);
    const timeText = (e, d) => {
      if (e.allDay || !e.start) return endOf(e) !== e.date ? '종일 ' + (K.diffDays(e.date, d) + 1) + '/' + (K.diffDays(e.date, endOf(e)) + 1) + '일차' : '종일';
      return e.start + (e.end ? '~' + e.end : '');
    };
    function phase(e, d) {
      const t = K.today();
      if (d < t) return 'past';
      if (d > t) return 'future';
      if (e.allDay || !e.start) return 'now-day';
      const n = K.nowHM();
      if (n < e.start) return 'future';
      // 종료 시간이 없으면 1시간짜리로 봄
      const end = e.end && e.end > e.start ? e.end : K.pad(Math.min(23, Number(e.start.slice(0, 2)) + 1)) + e.start.slice(2);
      return n < end ? 'now' : 'past';
    }
    const COMMON = K.NEUTRAL;
    const headChips = (e) => (e.heads || []).map((id) => {
      const p = personById(id);
      return p ? '<span class="sch-who" style="--c:' + K.safeColor(p.color) + '"><i></i>' + P.esc(personLabel(p)) + '</span>' : '';
    }).join('');
    const colorOf = (e) => { const p = personById((e.heads || [])[0]); return K.safeColor(p && p.color, COMMON); };
    const headNames = (e) => (e.heads || []).map((id) => { const x = personById(id); return x ? x.name : ''; }).filter(Boolean).join(', ') || '공통';
    const initial = (name) => P.esc(Array.from(String(name || '').trim())[0] || '?');
    const av = (p, sm) => '<span class="avatar sch-av' + (sm ? ' avatar-sm' : '') + '" style="--c:' + K.safeColor(p.color, COMMON) + '" aria-hidden="true">' + initial(p.name) + '</span>';

    /* ---------- 시간 격자 도구 ---------- */
    const HH = 48; // 한 시간 높이(px)
    const toMin = (v) => { const a = String(v || '').split(':'); return Number(a[0]) * 60 + (Number(a[1]) || 0); };
    const hm = (m) => K.pad(Math.floor(m / 60) % 24) + ':' + K.pad(m % 60);
    const isTimed = (e) => !e.allDay && !!e.start && endOf(e) === e.date;
    const span = (e) => { const s = toMin(e.start); const x = e.end ? toMin(e.end) : NaN; return { s, en: x > s ? x : Math.min(s + 60, 1440) }; };
    /* 겹치는 일정은 옆으로 나란히 */
    function lanes(d) {
      const list = dayEvents(d).filter(isTimed).map((e) => Object.assign({ e }, span(e))).sort((a, b) => a.s - b.s || b.en - a.en);
      let cols = [];
      let group = [];
      let gEnd = -1;
      const flush = () => { group.forEach((x) => { x.n = cols.length; }); group = []; cols = []; };
      list.forEach((x) => {
        if (group.length && x.s >= gEnd) { flush(); gEnd = -1; }
        let c = cols.findIndex((end) => end <= x.s);
        if (c < 0) { c = cols.length; cols.push(x.en); } else cols[c] = x.en;
        x.c = c;
        group.push(x);
        gEnd = Math.max(gEnd, x.en);
      });
      flush();
      return list;
    }
    function timeGrid(days) {
      const t = K.today();
      const per = days.map(lanes);
      const n = toMin(K.nowHM());
      const hasToday = days.includes(t);
      let h0 = 8;
      let h1 = 19;
      per.forEach((l) => l.forEach((x) => { h0 = Math.min(h0, Math.floor(x.s / 60)); h1 = Math.max(h1, Math.ceil(x.en / 60)); }));
      if (hasToday) { h0 = Math.min(h0, Math.floor(n / 60)); h1 = Math.max(h1, Math.min(24, Math.floor(n / 60) + 1)); }
      const y = (m) => (m - h0 * 60) / 60 * HH;
      const showNow = hasToday && n >= h0 * 60 && n <= h1 * 60;
      let gut = '';
      for (let h = h0; h < h1; h++) {
        if (showNow && Math.abs(y(h * 60) - y(n)) < 12) continue;
        gut += '<span style="top:' + y(h * 60) + 'px">' + K.pad(h) + ':00</span>';
      }
      if (showNow) gut += '<span class="hs-now-t" style="top:' + y(n) + 'px">' + K.nowHM() + '</span>';
      const wide = days.length === 1;
      const block = (x, d) => {
        const e = x.e;
        const ph = phase(e, d);
        const h = Math.max(22, (x.en - x.s) / 60 * HH - 2);
        const time = e.start + (e.end ? '–' + e.end : '');
        const size = h < 34 ? ' xs' : h < 58 ? ' sm' : '';
        return '<div class="hs-card hs-blk ' + ph + size + '" role="button" tabindex="0" data-id="' + P.esc(e.id) + '" aria-label="' + P.esc(time + ' ' + e.title) + '"' +
          ' title="' + P.esc(time + ' ' + e.title + (e.place ? ' · ' + e.place : '') + ' · ' + headNames(e)) + '"' +
          ' style="--c:' + colorOf(e) + ';top:' + (y(x.s) + 1) + 'px;height:' + h + 'px;left:calc(' + x.c + ' * 100% / ' + x.n + ');width:calc(100% / ' + x.n + ' - 3px)">' +
          '<b>' + P.esc(e.title) + '</b>' +
          '<span class="hs-blk-m">' + (ph === 'now' ? '<i class="hs-live" aria-hidden="true"></i>' : '') + '<span class="num">' + time + '</span>' + (e.place && wide ? '<span class="hs-blk-p">' + P.esc(e.place) + '</span>' : '') + '</span>' +
          (wide && !size ? '<span class="hs-blk-who">' + headChips(e) + '</span>' : '') + '</div>';
      };
      const cols = days.map((d, i) => '<div class="hs-col' + (d === t ? ' today' : '') + (K.dow(d) % 6 === 0 ? ' weekend' : '') + '" data-col-day="' + d + '" data-h0="' + h0 + '" title="빈 시간을 누르면 새 일정">' +
        per[i].map((x) => block(x, d)).join('') +
        (d === t && showNow ? '<div class="hs-now" style="top:' + y(n) + 'px" aria-hidden="true"></div><i class="hs-now-dot" style="top:' + y(n) + 'px" aria-hidden="true"></i>' : '') + '</div>').join('');
      return '<div class="hs-tg" style="--cols:' + days.length + ';height:' + ((h1 - h0) * HH) + 'px"><div class="hs-tg-gut" aria-hidden="true">' + gut + '</div>' + cols + '</div>';
    }

    /* ---------- 그리기 ---------- */
    function render() {
      clearInterval(clock);
      st.narrow = window.matchMedia('(max-width: 760px)').matches;
      const ps = people();
      page.innerHTML =
        '<div class="page-head sch-head"><div><h1>부서장 일정</h1></div>' +
        '<div class="toolbar sch-actions">' +
        '<button type="button" class="btn" data-act="copy" aria-label="텍스트 복사" title="메신저용 글로 복사">' + K.IC.copy + '<span>텍스트 복사</span></button>' +
        '<button type="button" class="btn sch-hide-sm" data-act="print" title="주간표 인쇄 (A4 가로)">' + K.IC.print + '<span>인쇄</span></button>' +
        '<button type="button" class="btn btn-ghost p-icon-btn" data-act="more" aria-label="더보기" title="더보기">' + K.IC.more + '</button>' +
        '<button type="button" class="btn btn-primary" data-act="new" aria-label="일정 추가" title="새 일정 (N)">' + P.icons.plus + '<span>일정 추가</span></button>' +
        '</div></div>' +
        (ps.length ? '' : '<div class="sch-onboard"><p>등록된 부서장이 없습니다.</p><div class="toolbar"><button type="button" class="btn btn-sm btn-primary" data-act="people">' + K.IC.users + '부서장 등록</button><button type="button" class="btn btn-sm" data-act="sample">예시 데이터</button></div></div>') +
        '<div class="sch-bar">' +
        '<div class="sch-nav"><button type="button" class="btn btn-ghost p-icon-btn" data-nav="-1" aria-label="이전" title="이전 (←)">' + K.IC.left + '</button>' +
        '<button type="button" class="btn btn-sm" data-nav="0">오늘</button>' +
        '<button type="button" class="btn btn-ghost p-icon-btn" data-nav="1" aria-label="다음" title="다음 (→)">' + K.IC.right + '</button>' +
        '<strong class="sch-range" aria-live="polite"></strong></div>' +
        '<div class="seg sch-views" role="radiogroup" aria-label="보기">' +
        [['today', '일', 'T'], ['week', '주', 'W'], ['month', '월', 'M']].map(([v, l, k]) => '<button type="button" role="radio" aria-checked="' + (st.view === v) + '" data-view="' + v + '" title="' + l + ' 보기 (' + k + ')">' + l + '</button>').join('') +
        '</div>' +
        '</div>' +
        '<div class="chips sch-filter" role="group" aria-label="부서장 거르기"></div>' +
        '<div class="hs-layout"><div class="sch-body"></div><section class="sch-glance" aria-label="오늘 한눈에"></section></div>';
      page.querySelector('.sch-bar').insertBefore(bar.el, page.querySelector('.sch-views'));
      renderGlance();
      renderFilter();
      renderBody();
      clock = setInterval(() => { if (!document.hidden) { renderGlance(); if (st.view === 'today') renderBody(); } }, 60000);
    }

    function renderGlance() {
      const box = page.querySelector('.sch-glance');
      const ps = people();
      if (!box) return;
      const t = K.today();
      const all = dayEvents(t, true);
      const rows = ps.map((p) => ({ p, list: all.filter((e) => (e.heads || []).includes(p.id)) }));
      const common = all.filter((e) => !(e.heads || []).length);
      if (common.length) rows.push({ p: { id: NONE, name: '공통', title: '', color: COMMON }, list: common });
      if (!rows.length) { box.innerHTML = ''; return; }
      box.innerHTML =
        '<div class="sch-glance-head"><h2>오늘 한눈에</h2><span class="num">' + K.md(t) + ' · ' + all.length + '건</span></div>' +
        '<div class="sch-glance-grid">' + rows.map(({ p, list }) => {
          const now = list.find((e) => phase(e, t) === 'now');
          const next = list.find((e) => phase(e, t) === 'future');
          const allDay = list.find((e) => phase(e, t) === 'now-day');
          let line;
          if (now) line = '<span class="sch-dot-live" aria-hidden="true"></span><b>진행 중</b> ' + P.esc(now.title) + (now.end ? ' <span class="num">~' + now.end + '</span>' : '');
          else if (next) line = '<b class="num">' + next.start + '</b> ' + P.esc(next.title);
          else if (allDay) line = '<b>종일</b> ' + P.esc(allDay.title);
          else line = list.length ? '오늘 일정 끝' : '일정 없음';
          return '<button type="button" class="sch-glance-card' + (now ? ' live' : '') + (list.length ? '' : ' idle') + '" data-who="' + P.esc(p.id) + '" aria-pressed="' + (st.who === p.id) + '" style="--c:' + K.safeColor(p.color, COMMON) + '">' +
            av(p) + '<span class="sch-glance-txt"><span class="sch-glance-name">' + P.esc(p.name) + (p.title ? '<small>' + P.esc(p.title) + '</small>' : '') + '</span>' +
            '<span class="sch-glance-line">' + line + '</span></span><em class="num" title="오늘 ' + list.length + '건">' + list.length + '</em></button>';
        }).join('') + '</div>';
    }

    function renderFilter() {
      const box = page.querySelector('.sch-filter');
      const ps = people();
      if (!ps.length) { box.innerHTML = ''; return; }
      const hasCommon = events().some((e) => !(e.heads || []).length);
      if (st.who !== ALL && st.who !== NONE && !personById(st.who)) st.who = ALL;
      box.innerHTML = '<button type="button" class="chip" data-who="' + ALL + '" aria-pressed="' + (st.who === ALL) + '">전체</button>' +
        ps.map((p) => '<button type="button" class="chip sch-chip-who" style="--c:' + K.safeColor(p.color) + '" data-who="' + P.esc(p.id) + '" aria-pressed="' + (st.who === p.id) + '">' + av(p, true) + P.esc(personLabel(p)) + '</button>').join('') +
        (hasCommon ? '<button type="button" class="chip sch-chip-who" style="--c:' + COMMON + '" data-who="' + NONE + '" aria-pressed="' + (st.who === NONE) + '"><span class="avatar avatar-sm sch-av" aria-hidden="true">공</span>공통</button>' : '');
    }

    function rangeText() {
      if (st.view === 'today') { const d = K.parse(st.date); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 <span>' + K.DOW[d.getDay()] + '요일 · ' + d.getFullYear() + '</span>'; }
      if (st.view === 'week') {
        const s = K.parse(K.weekStart(st.date));
        const e = K.parse(K.addDays(K.weekStart(st.date), 6));
        return (s.getMonth() + 1) + '월 ' + s.getDate() + '일 – ' + (e.getMonth() !== s.getMonth() ? (e.getMonth() + 1) + '월 ' : '') + e.getDate() + '일 <span>' + e.getFullYear() + '</span>';
      }
      const d = K.parse(st.date);
      return (d.getMonth() + 1) + '월 <span>' + d.getFullYear() + '</span>';
    }

    function renderBody() {
      const body = page.querySelector('.sch-body');
      const range = page.querySelector('.sch-range');
      if (!body) return;
      range.innerHTML = rangeText();
      page.querySelector('.hs-layout').classList.toggle('is-today', st.view === 'today');
      if (st.view === 'today') body.innerHTML = dayView(st.date);
      else if (st.view === 'week') {
        const s = K.weekStart(st.date);
        body.innerHTML = st.narrow ? weekList(s) : weekGrid(s);
      } else body.innerHTML = monthView(st.date);
    }

    const pill = (e, d) => '<button type="button" class="hs-card hs-pill ' + phase(e, d) + '" data-id="' + P.esc(e.id) + '" style="--c:' + colorOf(e) + '">' +
      '<b>' + P.esc(e.title) + '</b><span>' + P.esc(timeText(e, d)) + ' · ' + P.esc(headNames(e)) + (e.place ? ' · ' + P.esc(e.place) : '') + '</span></button>';

    function dayView(d) {
      const list = dayEvents(d);
      const allDay = list.filter((e) => !isTimed(e));
      return '<div class="hs-panel hs-dayview">' +
        (list.length ? '' : '<div class="hs-empty"><span>' + (d === K.today() ? '오늘' : K.md(d)) + ' 일정이 없습니다.</span><button type="button" class="btn btn-sm" data-new="' + d + '">' + P.icons.plus + '일정 추가</button></div>') +
        (allDay.length ? '<div class="hs-allday"><span class="hs-allday-l">종일</span><div class="hs-allday-items">' + allDay.map((e) => pill(e, d)).join('') + '</div></div>' : '') +
        '<div class="hs-tg-wrap">' + timeGrid([d]) + '</div></div>';
    }

    function weekRows() {
      const ps = people().filter((p) => st.who === ALL || st.who === p.id);
      const rows = ps.map((p) => ({ p, has: (e) => (e.heads || []).includes(p.id) }));
      if ((st.who === ALL || st.who === NONE) && (st.who === NONE || !people().length || events().some((e) => !(e.heads || []).length))) {
        rows.push({ p: { id: '', name: '공통', title: '', color: COMMON }, has: (e) => !(e.heads || []).length });
      }
      return rows;
    }
    const lanePill = (e, d, first) => '<button type="button" class="hs-item allday' + (e.date < d ? ' cont-l' + (first ? '' : ' silent') : '') + (endOf(e) > d ? ' cont-r' : '') + '" data-id="' + P.esc(e.id) + '" title="' + P.esc(timeText(e, d) + ' ' + e.title + (e.place ? ' · ' + e.place : '')) + '">' + P.esc(e.title) + '</button>';

    function weekGrid(s) {
      const days = Array.from({ length: 7 }, (_, i) => K.addDays(s, i));
      const t = K.today();
      const rows = weekRows();
      const dcls = (d) => (d === t ? 'today' : '') + (K.dow(d) % 6 === 0 ? ' weekend' : '');
      return '<div class="hs-panel hs-weekgrid"><table class="hs-week"><colgroup><col class="hs-gcol">' + days.map(() => '<col>').join('') + '</colgroup>' +
        '<thead><tr><th class="hs-who-col" scope="col"><span class="hs-corner">종일</span></th>' +
        days.map((d) => '<th scope="col" class="' + dcls(d) + '"><span class="hs-dow">' + K.DOW[K.dow(d)] + '</span><span class="hs-dnum num">' + K.parse(d).getDate() + '</span></th>').join('') + '</tr></thead><tbody>' +
        (rows.length ? rows.map(({ p, has }) => '<tr style="--c:' + K.safeColor(p.color, COMMON) + '"><th scope="row" class="hs-who-col" title="' + P.esc(personLabel(p)) + '">' + av(p, true) + '<span class="hs-who-name">' + P.esc(p.name) + '</span></th>' +
          days.map((d) => '<td class="' + dcls(d) + '" data-day="' + d + '" data-head="' + P.esc(p.id) + '">' +
            events().filter((e) => onDay(e, d) && has(e) && !isTimed(e)).sort(byTime).map((e) => lanePill(e, d, d === days[0])).join('') + '</td>').join('') + '</tr>').join('')
          : '<tr><th class="hs-who-col"></th><td colspan="7" class="muted">등록된 부서장이 없습니다.</td></tr>') +
        '</tbody></table><div class="hs-tg-wrap">' + timeGrid(days) + '</div></div>';
    }

    const agendaRow = (e, d) => '<button type="button" class="hs-item hs-arow ' + phase(e, d) + '" style="--c:' + colorOf(e) + '" data-id="' + P.esc(e.id) + '">' +
      '<span class="hs-arow-t num">' + (isTimed(e) ? e.start + (e.end ? '<small>' + e.end + '</small>' : '') : P.esc(timeText(e, d))) + '</span>' +
      '<span class="hs-arow-m"><b>' + P.esc(e.title) + '</b><small>' + P.esc(headNames(e)) + (e.place ? ' · ' + P.esc(e.place) : '') + '</small></span></button>';

    function weekList(s) {
      const t = K.today();
      return '<div class="hs-panel hs-weeklist">' + Array.from({ length: 7 }, (_, i) => K.addDays(s, i)).map((d) => {
        const list = dayEvents(d);
        return '<section class="hs-wday' + (d === t ? ' today' : '') + (K.dow(d) % 6 === 0 ? ' weekend' : '') + '"><h3><span class="hs-dnum num">' + K.parse(d).getDate() + '</span><span class="hs-dow">' + K.DOW[K.dow(d)] + '</span>' + (d === t ? '<span class="hs-today-tag">오늘</span>' : '') + '</h3>' +
          '<div class="hs-wday-list">' + (list.length ? list.map((e) => agendaRow(e, d)).join('') : '<p class="hs-none">일정 없음</p>') + '</div></section>';
      }).join('') + '</div>';
    }

    function monthView(base) {
      const cells = K.monthCells(base);
      const m = K.parse(base).getMonth();
      const t = K.today();
      const sel = dayEvents(st.date);
      return '<div class="hs-month"><div class="sch-cal" role="grid">' + K.DOW.map((_, i) => '<div class="sch-cal-dow">' + K.DOW[(i + 1) % 7] + '</div>').join('') +
        cells.map((d) => {
          const list = dayEvents(d);
          const cls = ['sch-cal-day', K.parse(d).getMonth() !== m ? 'out' : '', d === t ? 'today' : '', d === st.date ? 'sel' : '', K.dow(d) === 0 ? 'sun' : K.dow(d) === 6 ? 'sat' : ''].join(' ');
          return '<div class="' + cls + '" data-day="' + d + '" role="gridcell" tabindex="-1"><span class="sch-cal-num num">' + K.parse(d).getDate() + '</span>' +
            '<div class="sch-cal-items">' + list.slice(0, 3).map((e) => '<button type="button" class="sch-cal-ev' + (isTimed(e) ? ' timed' : '') + '" style="--c:' + colorOf(e) + '" data-id="' + P.esc(e.id) + '" title="' + P.esc(timeText(e, d) + ' ' + e.title) + '">' + (isTimed(e) ? '<b class="num">' + e.start + '</b>' : '') + '<span>' + P.esc(e.title) + '</span></button>').join('') +
            (list.length > 3 ? '<span class="sch-cal-more">+' + (list.length - 3) + '건</span>' : '') + '</div>' +
            '<span class="sch-cal-dots">' + list.slice(0, 4).map((e) => '<i style="--c:' + colorOf(e) + '"></i>').join('') + '</span></div>';
        }).join('') + '</div>' +
        '<aside class="hs-month-day"><h3>' + K.longDate(st.date) + '</h3>' +
        (sel.length ? '<div class="hs-alist">' + sel.map((e) => agendaRow(e, st.date)).join('') + '</div>'
          : '<div class="hs-empty"><span>일정 없음</span><button type="button" class="btn btn-sm" data-new="' + st.date + '">' + P.icons.plus + '추가</button></div>') +
        '</aside></div>';
    }

    /* ---------- 일정 입력 ---------- */
    function openEvent(id, preset) {
      const cur = id ? repo.get(COL, id) : null;
      const ps = people();
      const e = Object.assign({ title: '', date: st.date, endDate: '', start: '09:00', end: '10:00', allDay: false, place: '', heads: st.who !== ALL && st.who !== NONE ? [st.who] : [], kind: '회의', memo: '' }, cur || {}, preset || {});
      const f = document.createElement('form');
      f.className = 'sch-form';
      f.innerHTML =
        '<div class="field"><label for="hs-title">제목</label><input id="hs-title" name="title" maxlength="80" required placeholder="예: 주간 간부회의"></div>' +
        '<div class="field"><label>대상 부서장 <small class="muted">여러 명 선택 가능, 비우면 공통</small></label><div class="chips">' +
        (ps.length ? ps.map((p) => '<label class="sch-check" style="--c:' + K.safeColor(p.color) + '"><input type="checkbox" name="heads" value="' + P.esc(p.id) + '"' + ((e.heads || []).includes(p.id) ? ' checked' : '') + '><span><i></i>' + P.esc(personLabel(p)) + '</span></label>').join('') : '<span class="muted">먼저 부서장을 등록하세요(더보기 → 부서장 관리).</span>') + '</div></div>' +
        '<div class="field"><label>구분</label><div class="chips">' + KINDS.map((k) => '<label class="sch-check"><input type="radio" name="kind" value="' + k + '"' + (e.kind === k ? ' checked' : '') + '><span>' + k + '</span></label>').join('') + '</div></div>' +
        '<div class="sch-form-row"><div class="field"><label for="hs-date">날짜</label><input id="hs-date" name="date" type="date" required></div>' +
        '<div class="field"><label for="hs-end-date">종료일 <small class="muted">여러 날이면</small></label><input id="hs-end-date" name="endDate" type="date"></div></div>' +
        '<label class="sch-toggle"><input type="checkbox" name="allDay"' + (e.allDay ? ' checked' : '') + '> 종일 일정</label>' +
        '<div class="sch-form-row sch-times"><div class="field"><label for="hs-start">시작</label><input id="hs-start" name="start" type="time" step="300"></div>' +
        '<div class="field"><label for="hs-end">종료</label><input id="hs-end" name="end" type="time" step="300"></div></div>' +
        '<div class="field"><label for="hs-place">장소</label><input id="hs-place" name="place" maxlength="60" placeholder="예: 본관 3층 회의실"></div>' +
        '<div class="field"><label for="hs-memo">공개 메모 <small class="muted">전 직원에게 보입니다</small></label><textarea id="hs-memo" name="memo" rows="3" maxlength="500" placeholder="예: 보고자료 10부 준비"></textarea></div>' +
        '<p class="p-form-status err" role="alert"></p>';
      ['title', 'date', 'endDate', 'start', 'end', 'place', 'memo'].forEach((k) => { f[k].value = e[k] || ''; });
      const syncTimes = () => { f.querySelector('.sch-times').hidden = f.allDay.checked; };
      f.allDay.addEventListener('change', syncTimes);
      syncTimes();
      f.addEventListener('submit', (ev) => ev.preventDefault());
      const err = f.querySelector('.p-form-status');
      async function save(close) {
        const data = {
          title: f.title.value.trim(), date: f.date.value, endDate: f.endDate.value, allDay: f.allDay.checked,
          start: f.allDay.checked ? '' : f.start.value, end: f.allDay.checked ? '' : f.end.value,
          place: f.place.value.trim(), memo: f.memo.value.trim(), kind: (f.querySelector('[name="kind"]:checked') || {}).value || '기타',
          heads: Array.from(f.querySelectorAll('[name="heads"]:checked')).map((x) => x.value)
        };
        if (!data.title) { err.textContent = '제목을 입력하세요.'; f.title.focus(); return false; }
        if (!K.isDate(data.date)) { err.textContent = '날짜를 입력하세요.'; f.date.focus(); return false; }
        if (data.endDate && data.endDate < data.date) { err.textContent = '종료일이 시작일보다 빠릅니다.'; return false; }
        if (data.endDate === data.date) data.endDate = '';
        if (!data.allDay && data.start && data.end && data.end < data.start && !data.endDate) { err.textContent = '종료 시간이 시작 시간보다 빠릅니다.'; return false; }
        const newId = id || P.store.uid();
        try { await repo.put(COL, newId, data, id ? '일정 수정' : '일정 추가'); } catch (e2) { return false; }
        st.date = data.date;
        P.ui.toast(id ? '일정을 고쳤습니다.' : '일정을 추가했습니다.', 'ok');
        render();
        return true;
      }
      const actions = [];
      if (id) {
        actions.push({ label: '삭제', onClick: async () => {
          if (!(await P.ui.confirm('"' + e.title + '" 일정을 지울까요?\n지운 뒤 Ctrl+Z 로 되돌릴 수 있습니다.', { danger: true, okLabel: '삭제' }))) return false;
          await repo.remove(COL, id, '일정 삭제');
          P.ui.toast('일정을 지웠습니다. (Ctrl+Z 실행 취소)', 'ok');
          render();
        } });
        actions.push({ label: '복제', onClick: () => { setTimeout(() => openEvent(null, Object.assign({}, e, { id: undefined, title: e.title + ' (복사)' })), 200); } });
      }
      actions.push({ label: '취소' }, { label: '저장', primary: true, onClick: save });
      const close = P.ui.modal({ title: id ? '부서장 일정 수정' : '부서장 일정 추가', body: f, wide: true, actions });
      f.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); save().then((ok) => { if (ok) close(); }); } });
    }

    /* ---------- 부서장 관리 ---------- */
    function openPeople() {
      let list = people().map((p) => Object.assign({}, p));
      const box = document.createElement('div');
      box.className = 'hs-people';
      function draw() {
        box.innerHTML = '<p class="muted p-form-help">일정표에 나오는 순서대로 적으세요. 색은 일정 막대·달력 표시 색입니다.</p>' +
          (list.length ? list.map((p, i) => '<div class="hs-person" data-i="' + i + '">' +
            '<input type="color" value="' + K.safeColor(p.color) + '" aria-label="색" data-k="color">' +
            '<input type="text" value="' + P.esc(p.name) + '" placeholder="이름" maxlength="20" aria-label="이름" data-k="name">' +
            '<input type="text" value="' + P.esc(p.title || '') + '" placeholder="직위 (예: 과장)" maxlength="20" aria-label="직위" data-k="title">' +
            '<span class="hs-person-btns"><button type="button" class="btn btn-ghost btn-sm" data-mv="-1" aria-label="위로"' + (i ? '' : ' disabled') + '>▲</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-mv="1" aria-label="아래로"' + (i < list.length - 1 ? '' : ' disabled') + '>▼</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-del aria-label="삭제">' + P.icons.trash + '</button></span></div>').join('') : '<p class="empty">아직 등록된 부서장이 없습니다.</p>') +
          '<button type="button" class="btn" data-add>' + P.icons.plus + '부서장 추가</button>';
      }
      box.addEventListener('input', (ev) => {
        const row = ev.target.closest('[data-i]');
        if (row && ev.target.dataset.k) list[Number(row.dataset.i)][ev.target.dataset.k] = ev.target.value;
      });
      box.addEventListener('click', (ev) => {
        const b = ev.target.closest('button');
        if (!b) return;
        const row = b.closest('[data-i]');
        const i = row ? Number(row.dataset.i) : -1;
        if (b.hasAttribute('data-add')) {
          list.push({ id: P.store.uid(), name: '', title: '', color: K.PALETTE[list.length % K.PALETTE.length] });
          draw();
          const inputs = box.querySelectorAll('[data-k="name"]');
          inputs[inputs.length - 1].focus();
        } else if (b.dataset.mv) {
          const j = i + Number(b.dataset.mv);
          [list[i], list[j]] = [list[j], list[i]];
          draw();
        } else if (b.hasAttribute('data-del')) {
          list.splice(i, 1);
          draw();
        }
      });
      draw();
      P.ui.modal({
        title: '부서장 관리', body: box, wide: true,
        actions: [{ label: '취소' }, { label: '저장', primary: true, onClick: async () => {
          list = list.filter((p) => p.name.trim()).map((p) => ({ id: p.id, name: p.name.trim(), title: (p.title || '').trim(), color: K.safeColor(p.color) }));
          try { await repo.put(CFG, 'people', { people: list }, '부서장 목록 변경'); } catch (e) { return false; }
          P.ui.toast('부서장 목록을 저장했습니다.', 'ok');
          render();
        } }]
      });
    }

    /* ---------- 예시 데이터 ---------- */
    async function addSample() {
      const ps = [
        { id: P.store.uid(), name: '김한결', title: '국장', color: '#4C63B6' },
        { id: P.store.uid(), name: '이도윤', title: '과장', color: '#13897B' },
        { id: P.store.uid(), name: '박서진', title: '팀장', color: '#B7791F' }
      ];
      const s = K.weekStart(K.today());
      const ev = (o, title, start, end, kind, place, heads, extra) => ({ col: COL, id: P.store.uid(), data: Object.assign({ title, date: K.addDays(s, o), endDate: '', allDay: !start, start: start || '', end: end || '', kind, place, heads, memo: '' }, extra || {}) });
      const t = K.diffDays(s, K.today());
      const changes = [
        { col: CFG, id: 'people', data: { people: ps } },
        ev(0, '주간 간부회의', '09:00', '10:00', '회의', '본관 3층 회의실', [ps[0].id, ps[1].id]),
        ev(t, '업무 보고', '10:30', '11:30', '보고', '국장실', [ps[0].id], { memo: '보고자료 5부 준비' }),
        ev(t, '유관기관 간담회', '14:00', '16:00', '외부일정', '시청 소회의실', [ps[0].id, ps[2].id]),
        ev(t, '부서 현안 점검', '16:30', '17:30', '회의', '2층 회의실', [ps[1].id]),
        ev(Math.min(t + 1, 5), '업무 협의 출장', '', '', '출장', '광역 청사', [ps[1].id], { endDate: K.addDays(s, Math.min(t + 2, 6)) }),
        ev(Math.min(t + 2, 6), '정책 설명회 참석', '13:00', '15:00', '행사', '대강당', [ps[2].id]),
        ev(4, '주간 업무 마감 보고', '16:00', '17:00', '보고', '국장실', [ps[0].id, ps[1].id, ps[2].id])
      ];
      await repo.apply('예시 데이터', changes);
      P.ui.toast('예시 데이터를 넣었습니다. 실행 취소(Ctrl+Z)로 되돌릴 수 있습니다.', 'ok');
      render();
    }

    /* ---------- 공유: 텍스트 · 인쇄 · 이미지 ---------- */
    function dayText(d, withHeader) {
      const ps = people().filter((p) => st.who === ALL || st.who === p.id);
      const lines = withHeader ? ['■ ' + K.md(d) + ' 부서장 일정'] : [];
      const all = dayEvents(d, true);
      const fmt = (e) => ' · ' + timeText(e, d) + ' ' + e.title + (e.place ? ' (' + e.place + ')' : '');
      ps.forEach((p) => {
        const list = all.filter((e) => (e.heads || []).includes(p.id));
        lines.push('◎ ' + personLabel(p));
        lines.push(...(list.length ? list.map(fmt) : [' · 일정 없음']));
      });
      const common = all.filter((e) => !(e.heads || []).length);
      if (common.length && (st.who === ALL || st.who === NONE)) { lines.push('◎ 공통'); lines.push(...common.map(fmt)); }
      if (!ps.length && !common.length) lines.push(' · 일정 없음');
      return lines.join('\n');
    }
    function copyShare() {
      if (st.view === 'today') return K.shareText('메신저 공유용 텍스트', dayText(st.date, true));
      const s = K.weekStart(st.date);
      const out = ['■ ' + K.md(s) + ' ~ ' + K.md(K.addDays(s, 6)) + ' 부서장 주간 일정'];
      for (let i = 0; i < 7; i++) {
        const d = K.addDays(s, i);
        const has = dayEvents(d, true).length;
        if (!has && K.dow(d) % 6 === 0) continue;
        out.push('', '▶ ' + K.md(d), dayText(d, false));
      }
      K.shareText('메신저 공유용 텍스트 (주간)', out.join('\n'));
    }

    function weekModel() {
      const s = K.weekStart(st.date);
      const days = Array.from({ length: 7 }, (_, i) => K.addDays(s, i)).filter((d) => K.dow(d) % 6 !== 0 || events().some((e) => onDay(e, d) && visible(e)));
      const rows = weekRows().map(({ p, has }) => ({ p, cells: days.map((d) => events().filter((e) => onDay(e, d) && has(e)).sort(byTime)) }));
      return { s, days, rows };
    }
    function printWeek() {
      const { s, days, rows } = weekModel();
      const t = K.today();
      const html = '<h1>' + P.esc(P.brand().title) + ' 부서장 주간 일정</h1><p class="sub">' + K.md(s) + ' ~ ' + K.md(K.addDays(s, 6)) + ' · 출력 ' + K.md(t) + ' ' + K.nowHM() + '</p>' +
        '<table><colgroup><col style="width:12%">' + days.map(() => '<col>').join('') + '</colgroup><thead><tr><th>부서장</th>' + days.map((d) => '<th class="' + (d === t ? 'today' : '') + '">' + K.md(d) + '</th>').join('') + '</tr></thead><tbody>' +
        rows.map(({ p, cells }) => '<tr><td class="who"><span class="dot" style="background:' + K.safeColor(p.color) + '"></span>' + P.esc(personLabel(p)) + '</td>' +
          cells.map((list, i) => '<td class="' + (days[i] === t ? 'today' : '') + '">' + list.map((e) => '<div class="it"><span class="t">' + P.esc(timeText(e, days[i])) + '</span>' + (e.kind ? '<span class="k">' + P.esc(e.kind) + '</span>' : '') + P.esc(e.title) + (e.place ? '<div class="pl">' + P.esc(e.place) + '</div>' : '') + '</div>').join('') + '</td>').join('') + '</tr>').join('') +
        '</tbody></table>';
      K.printHTML('부서장 주간 일정', html, true);
    }
    function saveWeekImage() {
      const { s, days, rows } = weekModel();
      const W = 1600;
      const left = 170;
      const colW = (W - 20 - left) / days.length;
      const font = getComputedStyle(document.body).fontFamily;
      const cv = document.createElement('canvas');
      const g = cv.getContext('2d');
      const wrap = (text, width, f) => {
        g.font = f;
        // 띄어쓰기 단위로 줄바꿈, 한 단어가 너무 길면 글자 단위
        const out = [];
        let line = '';
        const push = (piece) => {
          if (g.measureText(line + piece).width <= width || !line) { line += piece; return; }
          out.push(line.trimEnd());
          line = piece.trimStart();
        };
        (String(text).match(/\S+\s*|\s+/g) || []).forEach((word) => {
          if (g.measureText(word).width <= width) push(word);
          else Array.from(word).forEach(push);
        });
        if (line) out.push(line);
        return out;
      };
      const layout = rows.map(({ p, cells }) => {
        const blocks = cells.map((list, i) => list.map((e) => ({
          head: wrap(timeText(e, days[i]) + '  ' + e.title, colW - 24, '600 17px ' + font),
          place: e.place ? wrap(e.place, colW - 24, '15px ' + font) : []
        })));
        const h = Math.max(70, ...blocks.map((b) => b.reduce((a, x) => a + x.head.length * 23 + x.place.length * 20 + 10, 16)));
        return { p, blocks, h };
      });
      const H = 130 + 50 + layout.reduce((a, r) => a + r.h, 0) + 40;
      cv.width = W;
      cv.height = H;
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#111827';
      g.font = '800 34px ' + font;
      g.fillText(P.brand().title + ' 부서장 주간 일정', 20, 56);
      g.font = '18px ' + font;
      g.fillStyle = '#4b5563';
      g.fillText(K.md(s) + ' ~ ' + K.md(K.addDays(s, 6)), 20, 92);
      let y = 120;
      g.fillStyle = '#eef1f7';
      g.fillRect(20, y, W - 40, 50);
      g.fillStyle = '#111827';
      g.font = '700 18px ' + font;
      g.fillText('부서장', 34, y + 32);
      days.forEach((d, i) => g.fillText(K.md(d), 20 + left - 20 + i * colW + 12, y + 32));
      y += 50;
      g.strokeStyle = '#c4cad6';
      g.lineWidth = 1;
      layout.forEach(({ p, blocks, h }) => {
        g.fillStyle = '#f7f8fb';
        g.fillRect(20, y, left - 20, h);
        g.fillStyle = K.safeColor(p.color);
        g.fillRect(20, y, 6, h);
        g.fillStyle = '#111827';
        g.font = '700 19px ' + font;
        g.fillText(p.name, 38, y + 32);
        if (p.title) { g.font = '15px ' + font; g.fillStyle = '#4b5563'; g.fillText(p.title, 38, y + 56); }
        blocks.forEach((items, i) => {
          let yy = y + 30;
          const x = 20 + left - 20 + i * colW + 12;
          items.forEach((it) => {
            g.fillStyle = '#111827';
            g.font = '600 17px ' + font;
            it.head.forEach((ln) => { g.fillText(ln, x, yy); yy += 23; });
            g.fillStyle = '#4b5563';
            g.font = '15px ' + font;
            it.place.forEach((ln) => { g.fillText(ln, x, yy); yy += 20; });
            yy += 10;
          });
        });
        g.strokeRect(20, y, W - 40, h);
        y += h;
      });
      for (let i = 0; i <= days.length; i++) {
        const x = 20 + left - 20 + i * colW;
        g.beginPath(); g.moveTo(x, 120); g.lineTo(x, y); g.stroke();
      }
      g.strokeRect(20, 120, W - 40, y - 120);
      cv.toBlob((b) => {
        if (!b) { P.ui.toast('이미지를 만들지 못했습니다.', 'error'); return; }
        P.ui.download('head-schedule-' + s.replace(/-/g, '') + '.png', b);
        P.ui.toast('주간표 이미지를 저장했습니다.', 'ok');
      }, 'image/png');
    }

    async function exportJSON() {
      const payload = { format: 'head-schedule', exportedAt: new Date().toISOString(), people: people(), events: events().map((e) => { const o = Object.assign({}, e); delete o.updatedAt; return o; }) };
      P.ui.download('head-schedule-' + K.stamp() + '.json', JSON.stringify(payload, null, 1), 'application/json');
      P.ui.toast('일정 ' + payload.events.length + '건을 내보냈습니다.', 'ok');
    }
    async function importJSON() {
      const data = await K.readJSONFile();
      if (!data) return;
      if (data.format !== 'head-schedule' || !Array.isArray(data.events)) { P.ui.toast('부서장 일정 내보내기 파일이 아닙니다.', 'error'); return; }
      const evs = data.events.filter((e) => e && e.title && K.isDate(e.date));
      if (!(await P.ui.confirm('일정 ' + evs.length + '건' + (Array.isArray(data.people) ? '과 부서장 ' + data.people.length + '명' : '') + '을 가져옵니다.\n같은 항목은 파일 내용으로 덮어씁니다.', { okLabel: '가져오기' }))) return;
      const changes = evs.map((e) => ({ col: COL, id: String(e.id || P.store.uid()), data: e }));
      if (Array.isArray(data.people)) {
        const merged = people().slice();
        data.people.forEach((p) => { if (p && p.id && p.name && !merged.some((x) => x.id === p.id)) merged.push(p); });
        changes.push({ col: CFG, id: 'people', data: { people: merged } });
      }
      try { await repo.apply('가져오기', changes); } catch (e) { return; }
      P.ui.toast(evs.length + '건을 가져왔습니다.', 'ok');
      render();
    }

    /* ---------- 이벤트 ---------- */
    function move(n) {
      if (n === 0) st.date = K.today();
      else if (st.view === 'today') st.date = K.addDays(st.date, n);
      else if (st.view === 'week') st.date = K.addDays(st.date, 7 * n);
      else st.date = K.addMonths(st.date, n);
      renderBody();
    }
    function setView(v) {
      st.view = v;
      P.settings.set('head-schedule.view', v);
      page.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.view === v)));
      renderBody();
    }
    async function doUndo(redo) {
      const label = await (redo ? repo.redo() : repo.undo());
      if (label) { P.ui.toast((redo ? '다시 실행: ' : '실행 취소: ') + label, 'info'); render(); }
    }

    page.addEventListener('click', (ev) => {
      const t = ev.target.closest('button, [data-id], td[data-day], .sch-cal-day, .hs-col');
      if (!t || !page.contains(t)) return;
      const d = t.dataset;
      if (d.act === 'new') openEvent(null, { date: st.date });
      else if (d.act === 'copy') copyShare();
      else if (d.act === 'print') printWeek();
      else if (d.act === 'people') openPeople();
      else if (d.act === 'sample') addSample();
      else if (d.act === 'undo') doUndo(false);
      else if (d.act === 'redo') doUndo(true);
      else if (d.act === 'more') {
        K.popMenu(t, [
          { label: '부서장 관리', desc: '이름·직위·색·순서', icon: K.IC.users, onClick: openPeople },
          { label: '주간표 인쇄 (A4 가로)', icon: K.IC.print, onClick: printWeek },
          { label: '주간표 이미지 저장', desc: 'PNG 파일', icon: K.IC.image, onClick: saveWeekImage },
          { label: '일정 내보내기', desc: 'JSON 백업 파일', icon: P.icons.download, onClick: exportJSON },
          { label: '일정 가져오기', desc: '내보낸 JSON 파일', icon: P.icons.upload, onClick: importJSON }
        ]);
      } else if (d.view) setView(d.view);
      else if (d.nav != null) move(Number(d.nav));
      else if (d.who != null) {
        st.who = st.who === d.who && d.who !== ALL ? ALL : d.who;
        P.settings.set('head-schedule.who', st.who);
        renderFilter();
        renderGlance();
        renderBody();
      } else if (d.new) openEvent(null, { date: d.new });
      else if (d.id) openEvent(d.id);
      else if (t.matches('td[data-day]')) openEvent(null, { date: d.day, heads: d.head ? [d.head] : [], allDay: true });
      else if (t.classList.contains('hs-col')) {
        const r = t.getBoundingClientRect();
        const m = Number(t.dataset.h0) * 60 + Math.max(0, Math.floor((ev.clientY - r.top) / HH * 2)) * 30;
        openEvent(null, { date: d.colDay, allDay: false, start: hm(m), end: hm(Math.min(m + 60, 1439)) });
      }
      else if (t.classList.contains('sch-cal-day')) {
        if (st.date === d.day && !st.narrow) openEvent(null, { date: d.day });
        else { st.date = d.day; renderBody(); }
      }
    });
    page.addEventListener('keydown', (ev) => {
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('.hs-card[data-id]')) { ev.preventDefault(); openEvent(ev.target.dataset.id); }
    });
    function onKey(ev) {
      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !K.isTyping(ev)) {
        const k = ev.key.toLowerCase();
        if (k === 'z' && !ev.shiftKey) { ev.preventDefault(); doUndo(false); }
        else if (k === 'y' || (k === 'z' && ev.shiftKey)) { ev.preventDefault(); doUndo(true); }
        return;
      }
      if (ev.ctrlKey || ev.metaKey || ev.altKey || K.isTyping(ev)) return;
      const map = { n: () => openEvent(null, { date: st.date }), t: () => setView('today'), w: () => setView('week'), m: () => setView('month'), ArrowLeft: () => move(-1), ArrowRight: () => move(1) };
      const fn = map[ev.key.length === 1 ? ev.key.toLowerCase() : ev.key];
      if (fn) { ev.preventDefault(); fn(); }
    }
    document.addEventListener('keydown', onKey);
    let rt = null;
    const onResize = () => {
      clearTimeout(rt);
      rt = setTimeout(() => { const n = window.matchMedia('(max-width: 760px)').matches; if (n !== st.narrow) { st.narrow = n; renderBody(); } }, 150);
    };
    window.addEventListener('resize', onResize);
    const stopRefresh = K.autoRefresh(repo, render);

    repo.load().then(() => {
      if (!root.isConnected) return;
      render();
      if (ctx.params[0] && !['today', 'week', 'month'].includes(ctx.params[0]) && repo.get(COL, ctx.params[0])) openEvent(ctx.params[0]);
    }, (e) => {
      page.innerHTML = '<div class="empty card"><h2>일정을 불러오지 못했습니다</h2><p class="muted">' + P.esc(e.message) + '</p><button type="button" class="btn btn-primary" onclick="location.reload()">다시 시도</button></div>';
    });

    return () => {
      clearInterval(clock);
      stopRefresh();
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }

  P.registerApp({
    shared: true,
    id: 'head-schedule',
    title: '부서장 일정',
    short: '부서장',
    order: 1,
    desc: '전 직원이 알아야 할 부서장 일정을 오늘·주간·월간으로 보고 메신저로 공유',
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="7.5" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 10-5.5"/><circle cx="17.5" cy="16.5" r="4.5"/><path d="M17.5 14.5v2l1.5 1"/></svg>',
    mount
  });
})();
