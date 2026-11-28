/* 홈: 오늘 업무 대시보드 (날짜 · 부서장 일정 · 기한 임박 업무 · 최근 작업 · 빠른 만들기) */
(function () {
  'use strict';
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>';
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  const RECENT = [['docs', '문서', 'DOC'], ['sheets', '시트', 'XLS'], ['slides', 'PT', 'PPT']];
  const CLOSED = ['완료', '보류'];
  const esc = (s) => P.esc(s);
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseYmd = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const dayDiff = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
  const hm = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());
  const isHM = (s) => /^\d{2}:\d{2}$/.test(String(s || ''));
  const safeColor = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '');
  const obj = (x) => (x && typeof x === 'object' ? x : {});

  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 86400000 + 1) / 7);
  }
  function relTime(iso) {
    const t = Date.parse(iso);
    if (!t) return '';
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return '방금 전';
    if (s < 3600) return Math.floor(s / 60) + '분 전';
    if (s < 86400) return Math.floor(s / 3600) + '시간 전';
    if (s < 86400 * 7) return Math.floor(s / 86400) + '일 전';
    const d = new Date(t);
    return (d.getMonth() + 1) + '. ' + d.getDate() + '.';
  }
  async function list(col) {
    try { const rows = await P.store.list(col); return Array.isArray(rows) ? rows : []; } catch (e) { return []; }
  }
  const panelHead = (title, linkHref, linkLabel) => '<div class="section-title"><h2>' + esc(title) + '</h2>' + (linkHref ? '<a href="' + linkHref + '">' + esc(linkLabel) + '</a>' : '') + '</div>';
  const emptyLine = (text, action) => '<p class="home-panel-empty">' + esc(text) + (action || '') + '</p>';

  /* ---------- 날짜 ---------- */
  function dateHTML(now, b) {
    return '<section class="home-panel home-date home-hero" aria-label="오늘 날짜">' +
      '<div class="home-hero-txt">' +
      '<div class="home-date-top"><span>' + now.getFullYear() + '. ' + pad(now.getMonth() + 1) + '.</span><span>' + isoWeek(now) + '주차</span></div>' +
      '<div class="home-date-main"><time class="home-day" datetime="' + ymd(now) + '">' + now.getDate() + '</time>' +
      '<div class="home-dow"><b>' + WEEK[now.getDay()] + '요일</b><span>오늘</span></div></div>' +
      (b.subtitle ? '<p class="home-sub">' + esc(b.subtitle) + '</p>' : '') +
      '<div class="home-store" data-p-storage-state data-state="' + esc(P.storage.state ? P.storage.state() : 'ok') + '"><i aria-hidden="true"></i><span>저장 위치 <b class="home-store-kind"></b></span>' +
      '<button type="button" class="btn-link" data-act="storage">바꾸기</button></div>' +
      '</div>' +
      '<div class="home-hero-scene fx-scene" aria-hidden="true"><div class="fx-img-slot" data-slot="home-hero"></div></div>' +
      '</section>';
  }

  /* ---------- 오늘 부서장 일정 ---------- */
  async function loadHeads(box, has) {
    const body = box.querySelector('.home-panel-body');
    if (!has) { body.innerHTML = emptyLine('부서장 일정 앱이 없습니다.'); return () => {}; }
    const [rows, cfgRows] = await Promise.all([list('head-schedule'), list('head-schedule-config')]);
    const cfg = cfgRows.find((r) => r.id === 'people');
    const people = Array.isArray(obj(cfg && cfg.data).people) ? cfg.data.people : [];
    const person = (id) => people.find((p) => p && p.id === id);
    const td = ymd(new Date());
    const evs = rows.map((r) => Object.assign({}, obj(r.data), { id: r.id }))
      .filter((e) => typeof e.date === 'string' && !e.cancelled && e.date <= td && td <= (e.endDate && e.endDate > e.date ? e.endDate : e.date));
    const who = (e) => {
      const ps = (Array.isArray(e.heads) ? e.heads : []).map(person).filter(Boolean);
      if (!ps.length) return '<span class="home-who">공통</span>';
      return ps.map((p) => '<span class="home-who" style="--c:' + (safeColor(p.color) || 'var(--muted)') + '">' + esc(p.name || '') + (p.title ? ' ' + esc(p.title) : '') + '</span>').join(' ');
    };
    const color = (e) => { const p = person((e.heads || [])[0]); return (p && safeColor(p.color)) || 'var(--accent)'; };
    const link = (e) => '#/head-schedule/' + encodeURIComponent(e.id);
    const timed = evs.filter((e) => !e.allDay && isHM(e.start) && e.date === td).sort((a, b) => a.start.localeCompare(b.start));
    const allDay = evs.filter((e) => !timed.includes(e));

    function draw() {
      if (!box.isConnected) return;
      if (!evs.length) {
        body.innerHTML = emptyLine('오늘 등록된 부서장 일정이 없습니다.', '<button type="button" class="btn-link" data-intent="head-schedule">일정 추가</button>');
        return;
      }
      const now = hm(new Date());
      let html = '';
      if (allDay.length) {
        html += '<div class="home-tl-allday">' + allDay.map((e) => {
          const span = e.endDate && e.endDate > e.date ? (dayDiff(e.date, td) + 1) + '/' + (dayDiff(e.date, e.endDate) + 1) + '일' : '종일';
          return '<a href="' + link(e) + '" style="--c:' + color(e) + '"><em>' + esc(span) + '</em><span>' + esc(e.title || '제목 없음') + '</span></a>';
        }).join('') + '</div>';
      }
      if (timed.length) {
        let nowPlaced = false;
        const nowRow = '<li class="home-tl-now" aria-label="지금 ' + now + '"><span>' + now + '</span><i aria-hidden="true"></i><hr></li>';
        html += '<ol class="home-tl">';
        timed.forEach((e) => {
          const end = isHM(e.end) ? e.end : '';
          if (!nowPlaced && e.start > now) { html += nowRow; nowPlaced = true; }
          const state = (end ? end <= now : e.start < now) ? 'past' : e.start <= now ? 'now' : '';
          html += '<li class="home-tl-row ' + state + '" style="--c:' + color(e) + '">' +
            '<span class="home-tl-time">' + esc(e.start) + (end ? '<small>' + esc(end) + '</small>' : '') + '</span>' +
            '<span class="home-tl-rail"><i></i></span>' +
            '<a class="home-tl-body" href="' + link(e) + '"><b>' + esc(e.title || '제목 없음') + '</b><small>' + who(e) + (e.place ? ' · ' + esc(e.place) : '') + '</small></a></li>';
        });
        if (!nowPlaced) html += nowRow;
        html += '</ol>';
      }
      body.innerHTML = html;
    }
    draw();
    const t = setInterval(draw, 60000);
    return () => clearInterval(t);
  }

  /* ---------- 기한 임박 업무 ---------- */
  async function loadTasks(box, has) {
    const body = box.querySelector('.home-panel-body');
    if (!has) { body.innerHTML = emptyLine('부서 스케줄러 앱이 없습니다.'); return; }
    const rows = await list('schedule-tasks');
    if (!box.isConnected) return;
    const td = ymd(new Date());
    const open = rows.map((r) => Object.assign({}, obj(r.data), { id: r.id }))
      .filter((x) => !CLOSED.includes(x.status) && parseYmd(x.due));
    const byDue = (a, b) => String(a.due).localeCompare(String(b.due));
    const groups = [
      ['기한 지남', 'over', open.filter((x) => x.due < td).sort(byDue)],
      ['오늘', 'today', open.filter((x) => x.due === td)],
      ['7일 이내', 'week', open.filter((x) => x.due > td && dayDiff(td, x.due) <= 7).sort(byDue)]
    ].filter((g) => g[2].length);
    if (!groups.length) {
      body.innerHTML = emptyLine(open.length ? '7일 안에 기한이 닥친 업무가 없습니다.' : '기한이 정해진 진행 중 업무가 없습니다.', '<button type="button" class="btn-link" data-intent="task">업무 추가</button>');
      return;
    }
    const badge = (x, kind) => {
      if (kind === 'over') return '<span class="badge badge-overdue">' + dayDiff(x.due, td) + '일 지남</span>';
      if (kind === 'today') return '<span class="badge badge-today">오늘</span>';
      return '<span class="badge">D-' + dayDiff(td, x.due) + '</span>';
    };
    body.innerHTML = groups.map(([label, kind, xs]) =>
      '<div class="home-task-group ' + kind + '"><h4>' + esc(label) + ' <span class="num">' + xs.length + '</span></h4>' +
      xs.slice(0, 4).map((x) => {
        const pct = Math.max(0, Math.min(100, Number(x.progress) || 0));
        return '<a class="home-task" href="#/schedule/tasks/' + encodeURIComponent(x.id) + '">' + badge(x, kind) +
          '<span class="home-task-t">' + esc(x.title || '제목 없음') + '</span>' +
          '<span class="home-task-m">' + (x.owner ? '<span>' + esc(x.owner) + '</span>' : '') +
          '<span class="home-meter" title="진척률 ' + pct + '%"><span style="width:' + pct + '%"></span></span><span>' + pct + '%</span></span></a>';
      }).join('') + (xs.length > 4 ? '<a class="home-task" href="#/schedule/tasks"><span></span><span class="home-task-t muted">외 ' + (xs.length - 4) + '건 더 보기</span></a>' : '') + '</div>'
    ).join('');
  }

  /* ---------- 최근 작업 ---------- */
  async function loadRecent(box, appIds) {
    const body = box.querySelector('.home-panel-body');
    const cols = RECENT.filter(([c]) => appIds.has(c));
    const lists = await Promise.all(cols.map(([c]) => list(c).then((rows) => rows.map((r) => Object.assign({ col: c }, r)))));
    if (!box.isConnected) return;
    const rows = lists.flat().filter((r) => r && r.id != null).sort((a, b) => (String(a.updatedAt) < String(b.updatedAt) ? 1 : -1)).slice(0, 6);
    if (!rows.length) {
      body.innerHTML = emptyLine('아직 만든 문서·시트·PT가 없습니다.', appIds.has('docs') ? '<button type="button" class="btn-link" data-intent="doc">새 문서</button>' : '');
      return;
    }
    const meta = new Map(RECENT.map(([c, name, g]) => [c, { name, g }]));
    body.innerHTML = '<div class="home-recent-list">' + rows.map((r) => {
      const d = obj(r.data);
      const m = meta.get(r.col);
      return '<a class="home-recent-item" href="#/' + esc(r.col) + '/' + encodeURIComponent(r.id) + '">' +
        '<span class="home-glyph" data-t="' + esc(r.col) + '" title="' + esc(m.name) + '" aria-label="' + esc(m.name) + '">' + m.g + '</span>' +
        '<span class="home-recent-t">' + esc(d.title || d.name || '제목 없음') + '</span>' +
        '<time class="home-recent-time" datetime="' + esc(r.updatedAt || '') + '">' + esc(relTime(r.updatedAt)) + '</time></a>';
    }).join('') + '</div>';
  }

  function mount(el) {
    const b = P.brand();
    const appIds = new Set(P.apps().map((a) => a.id));
    const now = new Date();
    const qa = (P.quickActions ? P.quickActions() : []);
    const QA_KEYS = ['doc', 'slide', 'sheet', 'chart', 'event'];
    const quick = QA_KEYS.map((k) => qa.find((q) => q.key === k)).filter(Boolean);

    el.innerHTML =
      '<div class="page home"><h1 class="sr-only">' + esc(b.title) + ' 홈</h1><div class="home-bento">' +
      dateHTML(now, b) +
      '<section class="home-panel home-heads" aria-labelledby="home-h-heads">' + panelHead('오늘 부서장 일정', appIds.has('head-schedule') ? '#/head-schedule' : '', '전체 일정').replace('<h2>', '<h2 id="home-h-heads">') +
      '<div class="home-panel-body" aria-busy="true"><div class="p-skel-row"><span class="p-skel"></span><span class="p-skel-lines"><span class="p-skel" style="width:50%"></span><span class="p-skel" style="width:30%"></span></span></div></div></section>' +
      (quick.length ? '<section class="home-panel home-quick" aria-labelledby="home-h-quick">' + panelHead('빠른 만들기').replace('<h2>', '<h2 id="home-h-quick">') +
        '<div class="home-quick-list">' + quick.map((q, i) => '<button type="button" data-q="' + i + '">' + q.icon + '<span>' + esc(q.label) + '</span></button>').join('') + '</div></section>' : '') +
      '<section class="home-panel home-tasks" aria-labelledby="home-h-tasks">' + panelHead('기한 임박 업무', appIds.has('schedule') ? '#/schedule/tasks' : '', '주요업무').replace('<h2>', '<h2 id="home-h-tasks">') +
      '<div class="home-panel-body" aria-busy="true"><div class="p-skel-row"><span class="p-skel"></span><span class="p-skel-lines"><span class="p-skel" style="width:60%"></span></span></div></div></section>' +
      '<section class="home-panel home-recent" aria-labelledby="home-h-recent">' + panelHead('최근 작업').replace('<h2>', '<h2 id="home-h-recent">') +
      '<div class="home-panel-body" aria-busy="true"><div class="p-skel-row"><span class="p-skel"></span><span class="p-skel-lines"><span class="p-skel" style="width:55%"></span></span></div></div></section>' +
      '</div></div>';

    const kind = P.storage.kinds[P.store.backend()] || { label: '' };
    const kindEl = el.querySelector('.home-store-kind');
    if (kindEl) kindEl.textContent = kind.label;

    const intentKeys = { 'head-schedule': 'head', task: 'task', doc: 'doc' };
    el.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.act === 'storage') { e.stopPropagation(); P.storage.openMenu(); }
      else if (t.dataset.q != null) { const q = quick[Number(t.dataset.q)]; if (q) q.run(); }
      else if (t.dataset.intent) { const q = qa.find((x) => x.key === intentKeys[t.dataset.intent]); if (q) q.run(); }
    });

    const done = (sel) => () => { const n = el.querySelector(sel + ' .home-panel-body'); if (n) n.removeAttribute('aria-busy'); };
    const fail = (sel) => (err) => {
      console.error(err);
      const n = el.querySelector(sel + ' .home-panel-body');
      if (n) { n.removeAttribute('aria-busy'); n.innerHTML = emptyLine('불러오지 못했습니다.'); }
    };
    let stopHeads = null;
    loadHeads(el.querySelector('.home-heads'), appIds.has('head-schedule')).then((stop) => { stopHeads = stop; done('.home-heads')(); }, fail('.home-heads'));
    loadTasks(el.querySelector('.home-tasks'), appIds.has('schedule')).then(done('.home-tasks'), fail('.home-tasks'));
    loadRecent(el.querySelector('.home-recent'), appIds).then(done('.home-recent'), fail('.home-recent'));
    return () => { if (typeof stopHeads === 'function') stopHeads(); };
  }

  P.registerApp({ id: 'home', title: '홈', short: '홈', icon: ICON, order: 0, group: 'home', desc: '오늘 일정과 기한, 최근 작업', mount });
})();
