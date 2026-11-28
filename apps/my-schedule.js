/* 내 일정: 개인 일정(일·주·월) + 할 일. 이 기기에만 저장(P.store.local), 부서장·부서 일정은 회색으로 겹쳐 보기만 */
(function () {
  'use strict';

  const COL_EV = 'my-schedule-events';
  const COL_TODO = 'my-schedule-todos';
  const COL_CFG = 'my-schedule-config';
  const COLS = [COL_EV, COL_TODO, COL_CFG];
  const OLD = 'schedule-personal'; // 예전 부서 스케줄러 '개인업무'
  // 저장 위치를 클라우드·사무실 서버로 바꿔도 이 세 컬렉션은 이 브라우저에만 둠
  if (P.store.local && P.store.local.mark) P.store.local.mark(COLS);

  const KINDS = [['업무', '#4C63B6'], ['회의', '#13897B'], ['개인', '#7C5CC4'], ['휴가', '#B7791F'], ['기타', '#737985']];
  const VIEWS = [['today', '일', 'T'], ['week', '주', 'W'], ['month', '월', 'M'], ['todos', '할 일', 'L']];
  const TVIEWS = [['today', '오늘'], ['week', '이번 주'], ['all', '전체'], ['done', '완료']];
  const SRC = { head: '부서장', dept: '부서' };
  const svg = (d) => '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const IC_LAYERS = svg('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>');
  const IC_DEVICE = svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>');

  function mount(root, ctx) {
    const K = window.SchedKit;
    if (!K) { root.innerHTML = '<div class="page"><div class="empty card">스케줄러 도구(head-schedule.js)를 불러오지 못했습니다.</div></div>'; return; }
    const LS = P.store.local || P.store;
    const bar = K.statusBar();
    const repo = K.makeRepo(COLS, bar.set, LS);
    const isView = (v) => VIEWS.some((x) => x[0] === v);
    const saved = P.settings.get('my-schedule.view', 'today');
    const hasHead = P.apps().some((a) => a.id === 'head-schedule');
    const hasDept = P.apps().some((a) => a.id === 'schedule');
    const st = {
      view: isView(ctx.params[0]) ? ctx.params[0] : isView(saved) ? saved : 'today',
      date: K.today(),
      overlay: (hasHead || hasDept) && !!P.settings.get('my-schedule.overlay', false),
      tView: P.settings.get('my-schedule.tView', 'today'),
      ov: { head: [], dept: [], people: [], loaded: false },
      migrate: null,
      narrow: false
    };
    if (!TVIEWS.some((x) => x[0] === st.tView)) st.tView = 'today';
    const wantNew = ctx.intent === 'new';
    if (wantNew) ctx.intentHandled();
    root.innerHTML = '<div class="page sch-page my-page">' + P.ui.skeleton(4) + '</div>';
    const page = root.firstChild;
    let clock = null;

    /* ---------- 자료 ---------- */
    const kindColor = (k) => { const x = KINDS.find((y) => y[0] === k); return x ? x[1] : K.NEUTRAL; };
    const endOf = (e) => (e.endDate && e.endDate > e.date ? e.endDate : e.date);
    const onDay = (e, d) => e.date <= d && d <= endOf(e);
    const isTimed = (e) => !e.allDay && !!e.start && endOf(e) === e.date;
    const byTime = (a, b) => (a.allDay === b.allDay ? 0 : a.allDay ? -1 : 1) || String(a.start || '').localeCompare(String(b.start || '')) || (!!a.src - !!b.src) || String(a.title).localeCompare(String(b.title), 'ko');
    const mineAll = () => repo.all(COL_EV).filter((e) => K.isDate(e.date));
    const mine = (d) => mineAll().filter((e) => onDay(e, d)).sort(byTime);
    const ovAll = () => (st.overlay ? st.ov.head.concat(st.ov.dept) : []);
    const dayAll = (d) => mineAll().concat(ovAll()).filter((e) => onDay(e, d)).sort(byTime);
    const todos = () => repo.all(COL_TODO);
    const colorOf = (e) => (e.src ? K.NEUTRAL : kindColor(e.kind));
    const keyOf = (e) => (e.src ? 'data-ov="' + e.src + ':' + P.esc(e.id) + '"' : 'data-id="' + P.esc(e.id) + '"');
    const srcTag = (e) => (e.src ? '<span class="my-src">' + SRC[e.src] + '</span>' : '');
    const ovCls = (e) => (e.src ? ' ov' : '');
    const timeText = (e, d) => {
      if (e.allDay || !e.start) return endOf(e) !== e.date ? '종일 ' + (K.diffDays(e.date, d) + 1) + '/' + (K.diffDays(e.date, endOf(e)) + 1) + '일차' : '종일';
      return e.start + (e.end ? '~' + e.end : '');
    };
    const whoText = (e) => {
      if (e.src === 'head') {
        const n = (e.heads || []).map((id) => { const p = st.ov.people.find((x) => x && x.id === id); return p ? p.name + (p.title ? ' ' + p.title : '') : ''; }).filter(Boolean).join(', ');
        return n || '공통';
      }
      return e.owner || '';
    };
    function phase(e, d) {
      const t = K.today();
      if (d < t) return 'past';
      if (d > t) return 'future';
      if (e.allDay || !e.start) return 'now-day';
      const n = K.nowHM();
      if (n < e.start) return 'future';
      const end = e.end && e.end > e.start ? e.end : K.pad(Math.min(23, Number(e.start.slice(0, 2)) + 1)) + e.start.slice(2);
      return n < end ? 'now' : 'past';
    }
    const dLabel = (due) => { const n = K.diffDays(K.today(), due); return n === 0 ? '오늘' : n > 0 ? 'D-' + n : Math.abs(n) + '일 지남'; };

    /* 겹쳐 보기: 부서장 일정·부서 일정을 현재 저장 위치에서 읽기만 함 (쓰지 않음) */
    async function loadOverlay() {
      const safe = (c) => P.store.list(c).catch(() => []);
      const [h, hc, d] = await Promise.all([hasHead ? safe('head-schedule') : [], hasHead ? safe('head-schedule-config') : [], hasDept ? safe('schedule-events') : []]);
      const row = (src) => (r) => Object.assign({}, r && r.data && typeof r.data === 'object' ? r.data : {}, { id: String(r.id), src });
      const ok = (e) => typeof e.title === 'string' && K.isDate(e.date) && !e.cancelled;
      const cfg = hc.find((r) => r.id === 'people');
      st.ov.people = cfg && cfg.data && Array.isArray(cfg.data.people) ? cfg.data.people : [];
      st.ov.head = h.map(row('head')).filter(ok);
      st.ov.dept = d.map(row('dept')).filter(ok);
      st.ov.loaded = true;
    }

    /* ---------- 예전 개인업무 옮기기 (한 번, 같은 id 로 다시 해도 겹치지 않음) ---------- */
    function migRecord() { const r = Object.assign({}, repo.get(COL_CFG, 'migration') || {}); delete r.id; delete r.updatedAt; return r; }
    async function checkMigration() {
      const kind = P.store.backend();
      if (migRecord()[kind]) return false;
      let rows;
      try { rows = await P.store.list(OLD); } catch (e) { return false; }
      const items = rows.map((r) => Object.assign({}, r.data && typeof r.data === 'object' ? r.data : {}, { id: String(r.id) })).filter((x) => typeof x.title === 'string' && x.title);
      if (!items.length) return false;
      const names = Array.from(new Set(items.map((x) => String(x.name || '')))).sort((a, b) => a.localeCompare(b, 'ko'));
      const me = String(P.settings.get('schedule.me', '') || '');
      const name = names.includes(me) ? me : names.length === 1 ? names[0] : null;
      if (name === null) { st.migrate = { names, items, kind }; return false; }
      await doMigrate(items.filter((x) => String(x.name || '') === name), name, kind);
      return true;
    }
    async function doMigrate(list, name, kind) {
      const now = new Date().toISOString();
      let n = 0;
      for (const x of list || []) {
        const id = 'm-' + x.id;
        if (repo.get(COL_TODO, id)) continue; // 이미 옮긴 항목(그 뒤 고친 내용)은 덮어쓰지 않음
        await LS.put(COL_TODO, id, { title: String(x.title).slice(0, 200), due: K.isDate(x.due) ? x.due : '', done: !!x.done, doneAt: x.doneAt || '', note: String(x.note || ''), from: OLD });
        n++;
      }
      const rec = migRecord();
      rec[kind] = { at: now, name: name || '', count: n, skipped: list === null };
      await LS.put(COL_CFG, 'migration', rec);
      st.migrate = null;
      await repo.load();
      if (n) P.ui.toast('예전 개인업무 ' + n + '건을 내 일정 할 일로 옮겼습니다. 원래 자료는 그대로 둡니다.', 'ok');
    }

    /* ---------- 시간 격자 (부서장 일정과 같은 모양) ---------- */
    const HH = 48;
    const toMin = (v) => { const a = String(v || '').split(':'); return Number(a[0]) * 60 + (Number(a[1]) || 0); };
    const hm = (m) => K.pad(Math.floor(m / 60) % 24) + ':' + K.pad(m % 60);
    const span = (e) => { const s = toMin(e.start); const x = e.end ? toMin(e.end) : NaN; return { s, en: x > s ? x : Math.min(s + 60, 1440) }; };
    function lanes(d) {
      const list = dayAll(d).filter(isTimed).map((e) => Object.assign({ e }, span(e))).sort((a, b) => a.s - b.s || b.en - a.en);
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
        const who = whoText(e);
        return '<div class="hs-card hs-blk ' + ph + size + ovCls(e) + '" role="button" tabindex="0" ' + keyOf(e) + ' aria-label="' + P.esc((e.src ? SRC[e.src] + ' ' : '') + time + ' ' + e.title) + '"' +
          ' title="' + P.esc((e.src ? '[' + SRC[e.src] + '] ' : '') + time + ' ' + e.title + (e.place ? ' · ' + e.place : '') + (who ? ' · ' + who : '')) + '"' +
          ' style="--c:' + colorOf(e) + ';top:' + (y(x.s) + 1) + 'px;height:' + h + 'px;left:calc(' + x.c + ' * 100% / ' + x.n + ');width:calc(100% / ' + x.n + ' - 3px)">' +
          '<b>' + srcTag(e) + P.esc(e.title) + '</b>' +
          '<span class="hs-blk-m">' + (ph === 'now' && !e.src ? '<i class="hs-live" aria-hidden="true"></i>' : '') + '<span class="num">' + time + '</span>' + (e.place && wide ? '<span class="hs-blk-p">' + P.esc(e.place) + '</span>' : '') + '</span>' +
          (wide && !size && who ? '<span class="hs-blk-who">' + P.esc(who) + '</span>' : '') + '</div>';
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
      const canOv = hasHead || hasDept;
      page.innerHTML =
        '<div class="page-head sch-head"><div><h1>내 일정</h1></div>' +
        '<div class="toolbar sch-actions">' +
        '<button type="button" class="btn" data-act="brief" aria-label="아침 브리핑" title="오늘 내 일정과 할 일을 복사">' + K.IC.sun + '<span>아침 브리핑</span></button>' +
        '<button type="button" class="btn btn-ghost p-icon-btn" data-act="more" aria-label="더보기" title="더보기">' + K.IC.more + '</button>' +
        '<button type="button" class="btn btn-primary sch-hide-sm" data-act="new" title="새 일정 (N)">' + P.icons.plus + '<span>새 일정</span></button>' +
        '</div></div>' +
        '<div class="my-local" role="note"><span class="my-local-ic">' + IC_DEVICE + '</span>' +
        '<p><b>이 기기에만 저장됩니다.</b> <span>저장 위치를 바꿔도 다른 사람에게 보이지 않습니다.</span></p>' +
        '<span class="my-local-btns"><button type="button" class="btn btn-ghost btn-sm" data-act="export" title="내 일정·할 일을 JSON 파일로">' + P.icons.download + '내보내기</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-act="import" title="다른 기기에서 내보낸 파일">' + P.icons.upload + '가져오기</button></span></div>' +
        '<div class="my-mig"></div>' +
        '<div class="sch-bar my-bar">' +
        '<div class="sch-nav"><button type="button" class="btn btn-ghost p-icon-btn" data-nav="-1" aria-label="이전" title="이전 (←)">' + K.IC.left + '</button>' +
        '<button type="button" class="btn btn-sm" data-nav="0">오늘</button>' +
        '<button type="button" class="btn btn-ghost p-icon-btn" data-nav="1" aria-label="다음" title="다음 (→)">' + K.IC.right + '</button>' +
        '<strong class="sch-range" aria-live="polite"></strong></div>' +
        '<div class="seg sch-views my-views" role="radiogroup" aria-label="보기">' +
        VIEWS.map(([v, l, k]) => '<button type="button" role="radio" aria-checked="' + (st.view === v) + '" data-view="' + v + '" title="' + l + ' 보기 (' + k + ')">' + l + '</button>').join('') + '</div>' +
        (canOv ? '<button type="button" class="chip my-ov-toggle" data-act="overlay" aria-pressed="' + st.overlay + '" title="' + [hasHead ? '부서장 일정' : '', hasDept ? '부서 일정' : ''].filter(Boolean).join('·') + '을 회색으로 함께 보기 (O)">' + IC_LAYERS + '겹쳐 보기</button>' : '') +
        '</div>' +
        '<div class="my-layout"><div class="sch-body"></div><aside class="my-side" aria-label="할 일"></aside></div>' +
        '<button type="button" class="sch-fab" data-act="new" aria-label="새 일정">' + P.icons.plus + '</button>';
      page.querySelector('.my-bar').appendChild(bar.el);
      renderMig();
      renderBody();
      clock = setInterval(() => { if (!document.hidden && (st.view === 'today' || st.view === 'week')) renderBody(); }, 60000);
    }

    function renderMig() {
      const box = page.querySelector('.my-mig');
      if (!box) return;
      const m = st.migrate;
      if (!m) { box.innerHTML = ''; return; }
      box.innerHTML = '<div class="sch-onboard my-mig-box"><p>예전 부서 스케줄러 개인업무가 있습니다. 내 이름을 고르면 할 일로 옮깁니다.</p><div class="toolbar">' +
        m.names.map((n) => '<button type="button" class="btn btn-sm" data-mig="' + P.esc(n) + '">' + P.esc(n || '이름 없음') + ' <span class="num muted">' + m.items.filter((x) => String(x.name || '') === n).length + '</span></button>').join('') +
        '<button type="button" class="btn btn-sm btn-ghost" data-act="mig-skip">옮기지 않기</button></div></div>';
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
      if (!body) return;
      const todo = st.view === 'todos';
      page.querySelector('.my-bar .sch-nav').hidden = todo;
      page.querySelector('.sch-range').innerHTML = todo ? '' : rangeText();
      page.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.view === st.view)));
      const ovb = page.querySelector('[data-act="overlay"]');
      if (ovb) { ovb.setAttribute('aria-pressed', String(st.overlay)); ovb.hidden = todo; }
      const side = page.querySelector('.my-side');
      const showSide = st.view === 'today';
      page.querySelector('.my-layout').classList.toggle('has-side', showSide);
      side.hidden = !showSide;
      side.innerHTML = showSide ? sideHTML(st.date) : '';
      if (todo) body.innerHTML = todosView();
      else if (st.view === 'today') body.innerHTML = dayView(st.date);
      else if (st.view === 'week') { const s = K.weekStart(st.date); body.innerHTML = st.narrow ? weekList(s) : weekGrid(s); }
      else body.innerHTML = monthView(st.date);
    }

    const pill = (e, d) => '<button type="button" class="hs-card hs-pill ' + phase(e, d) + ovCls(e) + '" ' + keyOf(e) + ' style="--c:' + colorOf(e) + '">' +
      '<b>' + srcTag(e) + P.esc(e.title) + '</b><span>' + P.esc(timeText(e, d)) + (whoText(e) ? ' · ' + P.esc(whoText(e)) : '') + (e.place ? ' · ' + P.esc(e.place) : '') + '</span></button>';

    function dayView(d) {
      const list = dayAll(d);
      const own = list.filter((e) => !e.src).length;
      const allDay = list.filter((e) => !isTimed(e));
      return '<div class="hs-panel hs-dayview">' +
        (own ? '' : '<div class="hs-empty"><span>' + (d === K.today() ? '오늘' : K.md(d)) + ' 내 일정이 없습니다.</span><button type="button" class="btn btn-sm" data-new="' + d + '">' + P.icons.plus + '일정 추가</button></div>') +
        (allDay.length ? '<div class="hs-allday"><span class="hs-allday-l">종일</span><div class="hs-allday-items">' + allDay.map((e) => pill(e, d)).join('') + '</div></div>' : '') +
        '<div class="hs-tg-wrap">' + timeGrid([d]) + '</div></div>';
    }

    const lanePill = (e, d, first) => '<button type="button" class="hs-item allday' + ovCls(e) + (e.date < d ? ' cont-l' + (first ? '' : ' silent') : '') + (endOf(e) > d ? ' cont-r' : '') + '" ' + keyOf(e) + ' style="--c:' + colorOf(e) + '" title="' + P.esc((e.src ? '[' + SRC[e.src] + '] ' : '') + timeText(e, d) + ' ' + e.title + (e.place ? ' · ' + e.place : '')) + '">' + P.esc(e.title) + '</button>';
    function weekGrid(s) {
      const days = Array.from({ length: 7 }, (_, i) => K.addDays(s, i));
      const t = K.today();
      const dcls = (d) => (d === t ? 'today' : '') + (K.dow(d) % 6 === 0 ? ' weekend' : '');
      return '<div class="hs-panel hs-weekgrid my-weekgrid"><table class="hs-week"><colgroup><col class="hs-gcol">' + days.map(() => '<col>').join('') + '</colgroup>' +
        '<thead><tr><th class="hs-who-col" scope="col"><span class="hs-corner"></span></th>' +
        days.map((d) => '<th scope="col" class="' + dcls(d) + '"><span class="hs-dow">' + K.DOW[K.dow(d)] + '</span><span class="hs-dnum num">' + K.parse(d).getDate() + '</span></th>').join('') + '</tr></thead><tbody>' +
        '<tr><th scope="row" class="hs-who-col my-allday-h">종일</th>' +
        days.map((d) => '<td class="' + dcls(d) + '" data-day="' + d + '">' + dayAll(d).filter((e) => !isTimed(e)).map((e) => lanePill(e, d, d === days[0])).join('') + '</td>').join('') +
        '</tr></tbody></table><div class="hs-tg-wrap">' + timeGrid(days) + '</div></div>';
    }

    const agendaRow = (e, d) => '<button type="button" class="hs-item hs-arow ' + phase(e, d) + ovCls(e) + '" style="--c:' + colorOf(e) + '" ' + keyOf(e) + '>' +
      '<span class="hs-arow-t num">' + (isTimed(e) ? e.start + (e.end ? '<small>' + e.end + '</small>' : '') : P.esc(timeText(e, d))) + '</span>' +
      '<span class="hs-arow-m"><b>' + srcTag(e) + P.esc(e.title) + '</b><small>' + P.esc([e.src ? whoText(e) : e.kind, e.place].filter(Boolean).join(' · ')) + '</small></span></button>';

    function weekList(s) {
      const t = K.today();
      return '<div class="hs-panel hs-weeklist">' + Array.from({ length: 7 }, (_, i) => K.addDays(s, i)).map((d) => {
        const list = dayAll(d);
        return '<section class="hs-wday' + (d === t ? ' today' : '') + (K.dow(d) % 6 === 0 ? ' weekend' : '') + '"><h3><span class="hs-dnum num">' + K.parse(d).getDate() + '</span><span class="hs-dow">' + K.DOW[K.dow(d)] + '</span>' + (d === t ? '<span class="hs-today-tag">오늘</span>' : '') + '</h3>' +
          '<div class="hs-wday-list">' + (list.length ? list.map((e) => agendaRow(e, d)).join('') : '<p class="hs-none">일정 없음</p>') + '</div></section>';
      }).join('') + '</div>';
    }

    function monthView(base) {
      const cells = K.monthCells(base);
      const m = K.parse(base).getMonth();
      const t = K.today();
      const sel = dayAll(st.date);
      const due = new Map();
      todos().forEach((x) => { if (!x.done && K.isDate(x.due)) due.set(x.due, (due.get(x.due) || 0) + 1); });
      return '<div class="hs-month"><div class="sch-cal" role="grid" title="날짜를 한 번 더 누르면 그 날짜로 새 일정">' + K.DOW.map((_, i) => '<div class="sch-cal-dow">' + K.DOW[(i + 1) % 7] + '</div>').join('') +
        cells.map((d) => {
          const list = dayAll(d);
          const cls = ['sch-cal-day', K.parse(d).getMonth() !== m ? 'out' : '', d === t ? 'today' : '', d === st.date ? 'sel' : '', K.dow(d) === 0 ? 'sun' : K.dow(d) === 6 ? 'sat' : ''].join(' ');
          const nd = due.get(d) || 0;
          return '<div class="' + cls + '" data-day="' + d + '" role="gridcell" tabindex="-1"><span class="sch-cal-num num">' + K.parse(d).getDate() + '</span>' +
            (nd ? '<span class="my-cal-due" title="기한인 할 일 ' + nd + '건">할 일 ' + nd + '</span>' : '') +
            '<div class="sch-cal-items">' + list.slice(0, 3).map((e) => '<button type="button" class="sch-cal-ev' + (isTimed(e) ? ' timed' : '') + ovCls(e) + '" style="--c:' + colorOf(e) + '" ' + keyOf(e) + ' title="' + P.esc((e.src ? '[' + SRC[e.src] + '] ' : '') + timeText(e, d) + ' ' + e.title) + '">' + (isTimed(e) ? '<b class="num">' + e.start + '</b>' : '') + '<span>' + P.esc(e.title) + '</span></button>').join('') +
            (list.length > 3 ? '<span class="sch-cal-more">+' + (list.length - 3) + '건</span>' : '') + '</div>' +
            '<span class="sch-cal-dots">' + list.slice(0, 4).map((e) => '<i style="--c:' + colorOf(e) + '"></i>').join('') + '</span></div>';
        }).join('') + '</div>' +
        '<aside class="hs-month-day"><h3>' + K.longDate(st.date) + '</h3>' +
        (sel.length ? '<div class="hs-alist">' + sel.map((e) => agendaRow(e, st.date)).join('') + '</div>'
          : '<div class="hs-empty"><span>일정 없음</span><button type="button" class="btn btn-sm" data-new="' + st.date + '">' + P.icons.plus + '추가</button></div>') +
        '</aside></div>';
    }

    /* ---------- 할 일 ---------- */
    const dueText = (x) => {
      if (!x.due) return '';
      if (x.done) return '<span class="sc-pdue num">' + K.md(x.due) + '</span>';
      const n = K.diffDays(K.today(), x.due);
      return '<span class="sc-pdue' + (n < 0 ? ' over' : n === 0 ? ' today' : '') + '"><span class="num">' + (n === 0 ? '오늘' : n === 1 ? '내일' : K.md(x.due)) + '</span>' + (n < 0 ? '<small>' + dLabel(x.due) + '</small>' : '') + '</span>';
    };
    const todoLi = (x) => '<li class="sc-todo' + (x.done ? ' done' : '') + '"><label class="sc-check"><input type="checkbox" data-toggle="' + P.esc(x.id) + '"' + (x.done ? ' checked' : '') + '><span class="sr-only">완료</span></label>' +
      '<button type="button" class="sc-todo-main" data-todo="' + P.esc(x.id) + '"><span class="sc-todo-title">' + P.esc(x.title) + '</span>' +
      (x.note ? '<span class="sc-todo-note">' + P.esc(x.note) + '</span>' : '') + '</button>' + dueText(x) + '</li>';
    const dueSort = (a, b) => (a.done - b.done) || String(a.due || '9999').localeCompare(String(b.due || '9999')) || String(a.title).localeCompare(String(b.title), 'ko');
    function todosView() {
      const td = K.today();
      const we = K.addDays(K.weekStart(td), 6);
      const all = todos();
      let list;
      if (st.tView === 'today') list = all.filter((x) => (!x.done && x.due && x.due <= td) || (x.done && String(x.doneAt || '').slice(0, 10) === td));
      else if (st.tView === 'week') list = all.filter((x) => !x.done && (!x.due || x.due <= we));
      else if (st.tView === 'done') list = all.filter((x) => x.done);
      else list = all.filter((x) => !x.done);
      list.sort(st.tView === 'done' ? (a, b) => String(b.doneAt || '').localeCompare(String(a.doneAt || '')) : dueSort);
      const left = all.filter((x) => !x.done);
      const over = left.filter((x) => x.due && x.due < td).length;
      return '<div class="my-todos">' +
        '<div class="my-todos-head"><div class="seg sc-pviews" role="group" aria-label="할 일 보기">' + TVIEWS.map(([v, l]) => '<button type="button" data-tview="' + v + '" aria-pressed="' + (st.tView === v) + '">' + l + '</button>').join('') + '</div>' +
        '<p class="num">남은 일 ' + left.length + (over ? ' · <b class="sc-over-text">지남 ' + over + '</b>' : '') + '</p></div>' +
        '<div class="sc-todo-box">' +
        '<form class="sc-quick" data-form="quick"><span class="sc-quick-ic" aria-hidden="true">' + P.icons.plus + '</span><input name="title" maxlength="100" placeholder="할 일 추가" aria-label="새 할 일" autocomplete="off">' +
        '<input name="due" type="date" aria-label="기한" value="' + (st.tView === 'today' ? td : '') + '"><button type="submit" class="btn btn-sm btn-primary">추가</button></form>' +
        (list.length ? '<ul class="sc-todos">' + list.map(todoLi).join('') + '</ul>'
          : '<p class="sc-todo-empty">' + (st.tView === 'today' ? '오늘 할 일이 없습니다.' : st.tView === 'done' ? '완료한 일이 없습니다.' : '할 일이 없습니다.') + '</p>') +
        '</div></div>';
    }
    function sideHTML(d) {
      const list = todos().filter((x) => !x.done && x.due && x.due <= d).sort(dueSort);
      return '<div class="sch-glance-head"><h2>할 일</h2><span class="num">' + (d === K.today() ? '오늘까지' : K.md(d) + '까지') + ' · ' + list.length + '건</span></div>' +
        (list.length ? '<ul class="sc-todos my-side-list">' + list.slice(0, 8).map(todoLi).join('') + '</ul>' : '<p class="hs-none">기한이 닥친 할 일이 없습니다.</p>') +
        '<form class="sc-quick my-side-quick" data-form="quick" data-due="' + d + '"><span class="sc-quick-ic" aria-hidden="true">' + P.icons.plus + '</span><input name="title" maxlength="100" placeholder="이날까지 할 일" aria-label="새 할 일" autocomplete="off"></form>' +
        '<button type="button" class="btn-link my-side-all" data-view="todos">할 일 전체 (' + todos().filter((x) => !x.done).length + ')</button>';
    }

    /* ---------- 입력 창 ---------- */
    function openEvent(id, preset) {
      const cur = id ? repo.get(COL_EV, id) : null;
      const e = Object.assign({ title: '', kind: '업무', date: st.date, endDate: '', allDay: false, start: '09:00', end: '10:00', place: '', note: '' }, cur || {}, preset || {});
      const f = document.createElement('form');
      f.className = 'sch-form';
      f.innerHTML =
        '<div class="field"><label for="my-title">제목</label><input id="my-title" name="title" maxlength="80" required placeholder="예: 병원 예약, 보고서 초안 작성"></div>' +
        '<div class="field"><label>구분</label><div class="chips">' + KINDS.map(([k, c]) => '<label class="sch-check" style="--c:' + c + '"><input type="radio" name="kind" value="' + k + '"' + (e.kind === k ? ' checked' : '') + '><span><i></i>' + k + '</span></label>').join('') + '</div></div>' +
        '<div class="sch-form-row"><div class="field"><label for="my-date">날짜</label><input id="my-date" name="date" type="date" required></div>' +
        '<div class="field"><label for="my-end-date">종료일 <small class="muted">여러 날이면</small></label><input id="my-end-date" name="endDate" type="date"></div></div>' +
        '<label class="sch-toggle"><input type="checkbox" name="allDay"' + (e.allDay ? ' checked' : '') + '> 종일 일정</label>' +
        '<div class="sch-form-row sch-times"><div class="field"><label for="my-start">시작</label><input id="my-start" name="start" type="time" step="300"></div>' +
        '<div class="field"><label for="my-end">종료</label><input id="my-end" name="end" type="time" step="300"></div></div>' +
        '<div class="field"><label for="my-place">장소</label><input id="my-place" name="place" maxlength="60"></div>' +
        '<div class="field"><label for="my-note">메모 <small class="muted">이 기기에만 저장</small></label><textarea id="my-note" name="note" rows="3" maxlength="1000"></textarea></div>' +
        '<p class="p-form-status err" role="alert"></p>';
      ['title', 'date', 'endDate', 'start', 'end', 'place', 'note'].forEach((k) => { f[k].value = e[k] || ''; });
      const syncTimes = () => { f.querySelector('.sch-times').hidden = f.allDay.checked; };
      f.allDay.addEventListener('change', syncTimes);
      syncTimes();
      f.addEventListener('submit', (ev) => ev.preventDefault());
      const err = f.querySelector('.p-form-status');
      async function save() {
        const data = {
          title: f.title.value.trim(), kind: (f.querySelector('[name="kind"]:checked') || {}).value || '기타', date: f.date.value, endDate: f.endDate.value, allDay: f.allDay.checked,
          start: f.allDay.checked ? '' : f.start.value, end: f.allDay.checked ? '' : f.end.value, place: f.place.value.trim(), note: f.note.value.trim()
        };
        if (!data.title) { err.textContent = '제목을 입력하세요.'; f.title.focus(); return false; }
        if (!K.isDate(data.date)) { err.textContent = '날짜를 입력하세요.'; f.date.focus(); return false; }
        if (data.endDate && data.endDate < data.date) { err.textContent = '종료일이 시작일보다 빠릅니다.'; f.endDate.focus(); return false; }
        if (data.endDate === data.date) data.endDate = '';
        if (!data.allDay && !data.endDate && data.start && data.end && data.end < data.start) { err.textContent = '종료 시간이 시작 시간보다 빠릅니다.'; f.end.focus(); return false; }
        try { await repo.put(COL_EV, id || P.store.uid(), data, id ? '일정 수정' : '일정 추가'); } catch (x) { return false; }
        st.date = data.date;
        P.ui.toast(id ? '일정을 고쳤습니다.' : '일정을 추가했습니다.', 'ok');
        renderBody();
        return true;
      }
      const actions = [];
      if (id) {
        actions.push({ label: '삭제', onClick: async () => {
          if (!(await P.ui.confirm('"' + e.title + '" 일정을 지울까요?\nCtrl+Z 로 되돌릴 수 있습니다.', { danger: true, okLabel: '삭제' }))) return false;
          await repo.remove(COL_EV, id, '일정 삭제');
          P.ui.toast('일정을 지웠습니다. (Ctrl+Z 실행 취소)', 'ok');
          renderBody();
        } });
        actions.push({ label: '복제', onClick: () => { const c = Object.assign({}, e, { title: e.title + ' (복사)' }); delete c.id; delete c.updatedAt; setTimeout(() => openEvent(null, c), 200); } });
      }
      actions.push({ label: '닫기' }, { label: '저장', primary: true, onClick: save });
      const close = P.ui.modal({ title: id ? '내 일정 수정' : '새 내 일정', body: f, wide: true, actions });
      f.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); save().then((ok) => { if (ok) close(); }); } });
    }

    /* 겹쳐 보기 항목: 읽기 전용. 원래 화면으로 가거나 내 일정으로 복사만 */
    function openOverlay(key) {
      const i = key.indexOf(':');
      const src = key.slice(0, i);
      const id = key.slice(i + 1);
      const e = (src === 'head' ? st.ov.head : st.ov.dept).find((x) => x.id === id);
      if (!e) return;
      const d = onDay(e, st.date) ? st.date : e.date;
      const box = document.createElement('div');
      box.className = 'my-ov-info';
      const rows = [['날짜', K.md(e.date) + (endOf(e) !== e.date ? ' ~ ' + K.md(endOf(e)) : '')], ['시간', timeText(e, d)], ['장소', e.place], [src === 'head' ? '부서장' : '담당', whoText(e)], ['메모', e.memo || e.note]].filter((r) => r[1]);
      box.innerHTML = '<p class="my-ov-src"><span class="my-src">' + SRC[src] + '</span>' + (src === 'head' ? '부서장 일정' : '부서 스케줄러') + '에서 가져와 보여 주는 일정입니다. 여기서는 고칠 수 없습니다.</p>' +
        '<h3>' + P.esc(e.title) + '</h3><dl>' + rows.map((r) => '<dt>' + r[0] + '</dt><dd>' + P.esc(r[1]) + '</dd>').join('') + '</dl>';
      P.ui.modal({
        title: '함께 보는 일정', body: box,
        actions: [
          { label: '내 일정으로 복사', onClick: () => { setTimeout(() => openEvent(null, { title: e.title, date: e.date, endDate: e.endDate || '', allDay: !!e.allDay || !e.start, start: e.start || '', end: e.end || '', place: e.place || '', kind: '업무', note: '' }), 200); } },
          { label: '닫기' },
          { label: src === 'head' ? '부서장 일정 열기' : '부서 스케줄러 열기', primary: true, onClick: () => { P.navigate(src === 'head' ? 'head-schedule/' + encodeURIComponent(e.id) : 'schedule/events/' + encodeURIComponent(e.id)); } }
        ]
      });
    }

    function openTodo(id) {
      const cur = repo.get(COL_TODO, id);
      if (!cur) return;
      const f = document.createElement('form');
      f.className = 'sch-form';
      f.innerHTML = '<div class="field"><label for="mt-title">할 일</label><input id="mt-title" name="title" maxlength="100" required></div>' +
        '<div class="field"><label for="mt-due">기한</label><input id="mt-due" name="due" type="date"></div>' +
        '<div class="field"><label for="mt-note">메모</label><textarea id="mt-note" name="note" rows="3" maxlength="1000"></textarea></div>' +
        '<label class="sch-toggle"><input type="checkbox" name="done"' + (cur.done ? ' checked' : '') + '> 완료</label><p class="p-form-status err" role="alert"></p>';
      ['title', 'due', 'note'].forEach((k) => { f[k].value = cur[k] || ''; });
      f.addEventListener('submit', (ev) => ev.preventDefault());
      async function save() {
        const d = Object.assign({}, cur, { title: f.title.value.trim(), due: f.due.value, note: f.note.value.trim(), done: f.done.checked });
        if (!d.title) { f.querySelector('.p-form-status').textContent = '할 일을 입력하세요.'; return false; }
        if (d.done && !cur.done) d.doneAt = new Date().toISOString();
        if (!d.done) d.doneAt = '';
        try { await repo.put(COL_TODO, id, d, '할 일 수정'); } catch (e) { return false; }
        renderBody();
        return true;
      }
      const close = P.ui.modal({
        title: '할 일 수정', body: f,
        actions: [
          { label: '삭제', onClick: async () => { await repo.remove(COL_TODO, id, '할 일 삭제'); P.ui.toast('할 일을 지웠습니다. (Ctrl+Z 실행 취소)', 'ok'); renderBody(); } },
          { label: '닫기' }, { label: '저장', primary: true, onClick: save }
        ]
      });
      f.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); save().then((ok) => { if (ok) close(); }); } });
    }

    function openNew() {
      if (st.view === 'todos') {
        const input = page.querySelector('.sc-quick [name="title"]');
        if (input) input.focus();
      } else openEvent(null, { date: st.date });
    }

    /* ---------- 아침 브리핑 (부서 스케줄러와 같은 꼴) ---------- */
    function briefing() {
      const td = K.today();
      const tm = K.addDays(td, 1);
      const fmt = (e, d) => ' · ' + timeText(e, d) + ' ' + e.title + (e.place ? ' (' + e.place + ')' : '');
      const today = mine(td);
      const tomorrow = mine(tm);
      const lines = ['■ 내 일정 ' + K.md(td) + ' 아침 브리핑', '', '▶ 오늘 일정 ' + today.length + '건'];
      lines.push(...(today.length ? today.map((e) => fmt(e, td)) : [' · 없음']));
      if (st.overlay) {
        const ov = ovAll().filter((e) => onDay(e, td)).sort(byTime);
        if (ov.length) {
          lines.push('', '▶ 함께 볼 일정 ' + ov.length + '건');
          ov.forEach((e) => { const w = whoText(e); lines.push(' · [' + SRC[e.src] + '] ' + timeText(e, td) + ' ' + e.title + (e.place ? ' (' + e.place + ')' : '') + (w ? ' - ' + w : '')); });
        }
      }
      lines.push('', '▶ 내일(' + K.md(tm) + ') 일정 ' + tomorrow.length + '건');
      tomorrow.forEach((e) => lines.push(fmt(e, tm)));
      const open = todos().filter((x) => !x.done && K.isDate(x.due));
      const over = open.filter((x) => x.due < td).sort((a, b) => a.due.localeCompare(b.due));
      const dueToday = open.filter((x) => x.due === td);
      lines.push('', '▶ 할 일  지남 ' + over.length + '건 · 오늘 ' + dueToday.length + '건');
      over.forEach((x) => lines.push(' · [지남] ' + x.title + ' ' + K.md(x.due)));
      dueToday.forEach((x) => lines.push(' · [오늘] ' + x.title));
      K.shareText('아침 브리핑', lines.join('\n'));
    }

    /* ---------- 내보내기 · 가져오기 (이 기기 → 다른 기기 옮기기용) ---------- */
    const clean = (o) => { const c = Object.assign({}, o); delete c.updatedAt; return c; };
    function exportJSON() {
      const payload = { format: 'my-schedule', version: 1, exportedAt: new Date().toISOString(), events: mineAll().map(clean), todos: todos().map(clean) };
      P.ui.download('my-schedule-' + K.stamp() + '.json', JSON.stringify(payload, null, 1), 'application/json');
      P.ui.toast('내 일정 ' + payload.events.length + '건 · 할 일 ' + payload.todos.length + '건을 내보냈습니다. 파일은 다른 사람과 나누지 마세요.', 'ok');
    }
    async function importJSON() {
      const data = await K.readJSONFile();
      if (!data) return;
      const arr = (a) => (Array.isArray(a) ? a.filter((x) => x && typeof x === 'object' && typeof x.title === 'string' && x.title) : []);
      let evs = [];
      let tds = [];
      if (data.format === 'my-schedule') {
        evs = arr(data.events).filter((e) => K.isDate(e.date));
        tds = arr(data.todos);
      } else if (data.format === 'schedule-board' && Array.isArray(data.personal)) {
        // 예전 부서 스케줄러 내보내기 파일의 개인업무
        const me = String(P.settings.get('schedule.me', '') || '');
        const ps = arr(data.personal);
        tds = (ps.some((x) => x.name === me) ? ps.filter((x) => x.name === me) : ps).map((x) => ({ id: 'm-' + x.id, title: x.title, due: K.isDate(x.due) ? x.due : '', done: !!x.done, doneAt: x.doneAt || '', note: x.note || '', from: OLD }));
      } else { P.ui.toast('내 일정 내보내기 파일이 아닙니다.', 'error'); return; }
      if (!evs.length && !tds.length) { P.ui.toast('가져올 항목이 없습니다.', 'warn'); return; }
      if (!(await P.ui.confirm('일정 ' + evs.length + '건, 할 일 ' + tds.length + '건을 이 기기에 가져옵니다.\n같은 항목은 파일 내용으로 덮어씁니다.', { okLabel: '가져오기' }))) return;
      const ch = [];
      const strip = (x) => { const c = clean(x); delete c.id; delete c.name; return c; };
      evs.forEach((x) => ch.push({ col: COL_EV, id: String(x.id || P.store.uid()), data: strip(x) }));
      tds.forEach((x) => ch.push({ col: COL_TODO, id: String(x.id || P.store.uid()), data: strip(x) }));
      try { await repo.apply('가져오기', ch); } catch (e) { return; }
      P.ui.toast((evs.length + tds.length) + '건을 가져왔습니다.', 'ok');
      renderBody();
    }

    /* ---------- 동작 ---------- */
    function move(n) {
      if (st.view === 'todos') return;
      if (n === 0) st.date = K.today();
      else if (st.view === 'today') st.date = K.addDays(st.date, n);
      else if (st.view === 'week') st.date = K.addDays(st.date, 7 * n);
      else st.date = K.addMonths(st.date, n);
      renderBody();
    }
    function setView(v) {
      st.view = v;
      P.settings.set('my-schedule.view', v);
      try { history.replaceState(null, '', '#/my-schedule/' + v); } catch (e) { /* 무시 */ }
      renderBody();
    }
    async function toggleOverlay() {
      st.overlay = !st.overlay;
      P.settings.set('my-schedule.overlay', st.overlay);
      if (st.overlay && !st.ov.loaded) { renderBody(); await loadOverlay(); }
      if (root.isConnected) renderBody();
    }
    async function doUndo(redo) {
      const label = await (redo ? repo.redo() : repo.undo());
      if (label) { P.ui.toast((redo ? '다시 실행: ' : '실행 취소: ') + label, 'info'); renderBody(); }
    }

    page.addEventListener('click', (ev) => {
      const t = ev.target.closest('button, [data-id], [data-ov], td[data-day], .sch-cal-day, .hs-col');
      if (!t || !page.contains(t)) return;
      const d = t.dataset;
      if (d.act === 'new') openNew();
      else if (d.act === 'brief') briefing();
      else if (d.act === 'overlay') toggleOverlay();
      else if (d.act === 'export') exportJSON();
      else if (d.act === 'import') importJSON();
      else if (d.act === 'undo') doUndo(false);
      else if (d.act === 'redo') doUndo(true);
      else if (d.act === 'mig-skip') { const m = st.migrate; if (m) doMigrate(null, '', m.kind).then(() => { renderMig(); renderBody(); }); }
      else if (d.act === 'more') {
        K.popMenu(t, [
          { label: '내 일정 내보내기', desc: '다른 기기로 옮길 JSON 파일', icon: P.icons.download, onClick: exportJSON },
          { label: '내 일정 가져오기', desc: '내보낸 파일 또는 예전 부서 스케줄러 파일', icon: P.icons.upload, onClick: importJSON }
        ]);
      } else if (d.mig != null) {
        const m = st.migrate;
        if (m) doMigrate(m.items.filter((x) => String(x.name || '') === d.mig), d.mig, m.kind).then(() => { renderMig(); renderBody(); });
      } else if (d.view) setView(d.view);
      else if (d.tview) { st.tView = d.tview; P.settings.set('my-schedule.tView', d.tview); renderBody(); }
      else if (d.nav != null) move(Number(d.nav));
      else if (d.new) openEvent(null, { date: d.new });
      else if (d.todo) openTodo(d.todo);
      else if (d.ov) openOverlay(d.ov);
      else if (d.id) openEvent(d.id);
      else if (t.matches('td[data-day]')) openEvent(null, { date: d.day, allDay: true });
      else if (t.classList.contains('hs-col')) {
        const r = t.getBoundingClientRect();
        const m = Number(t.dataset.h0) * 60 + Math.max(0, Math.floor((ev.clientY - r.top) / HH * 2)) * 30;
        openEvent(null, { date: d.colDay, allDay: false, start: hm(m), end: hm(Math.min(m + 60, 1439)) });
      } else if (t.classList.contains('sch-cal-day')) {
        if (st.date === d.day && !st.narrow) openEvent(null, { date: d.day });
        else { st.date = d.day; renderBody(); }
      }
    });
    page.addEventListener('keydown', (ev) => {
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('.hs-card[data-id], .hs-card[data-ov]')) {
        ev.preventDefault();
        if (ev.target.dataset.ov) openOverlay(ev.target.dataset.ov); else openEvent(ev.target.dataset.id);
      }
    });
    page.addEventListener('change', async (ev) => {
      const t = ev.target;
      if (!t.dataset.toggle) return;
      const x = repo.get(COL_TODO, t.dataset.toggle);
      if (!x) return;
      try { await repo.put(COL_TODO, x.id, Object.assign({}, x, { done: t.checked, doneAt: t.checked ? new Date().toISOString() : '' }), t.checked ? '할 일 완료' : '완료 취소'); } catch (e) { t.checked = !t.checked; return; }
      setTimeout(renderBody, t.checked ? 350 : 0);
    });
    page.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      if (f.dataset.form !== 'quick') return;
      const title = f.title.value.trim();
      if (!title) { f.title.focus(); return; }
      const due = f.due ? f.due.value : (f.dataset.due || '');
      try { await repo.put(COL_TODO, P.store.uid(), { title, due, done: false, doneAt: '', note: '' }, '할 일 추가'); } catch (e) { return; }
      const side = !!f.dataset.due;
      renderBody();
      const nf = page.querySelector(side ? '.my-side-quick' : '.my-todos .sc-quick');
      if (nf) { if (nf.due) nf.due.value = due; nf.title.focus(); }
      if (!side && st.tView === 'today' && (!due || due > K.today())) P.ui.toast('추가했습니다. \'이번 주·전체\' 보기에서 볼 수 있습니다.', 'info');
    });

    function onKey(ev) {
      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !K.isTyping(ev)) {
        const k = ev.key.toLowerCase();
        if (k === 'z' && !ev.shiftKey) { ev.preventDefault(); doUndo(false); }
        else if (k === 'y' || (k === 'z' && ev.shiftKey)) { ev.preventDefault(); doUndo(true); }
        return;
      }
      if (ev.ctrlKey || ev.metaKey || ev.altKey || K.isTyping(ev)) return;
      const map = {
        n: openNew, t: () => setView('today'), w: () => setView('week'), m: () => setView('month'), l: () => setView('todos'),
        o: () => { if (hasHead || hasDept) toggleOverlay(); }, ArrowLeft: () => move(-1), ArrowRight: () => move(1)
      };
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

    repo.load().then(async () => {
      if (!root.isConnected) return;
      try { await checkMigration(); } catch (e) { console.error(e); }
      if (st.overlay) { try { await loadOverlay(); } catch (e) { /* 겹쳐 보기 없이 */ } }
      if (!root.isConnected) return;
      render();
      const id = ctx.params[1];
      if (id && repo.get(COL_EV, id)) { const e = repo.get(COL_EV, id); st.date = e.date; renderBody(); openEvent(id); }
      else if (id && repo.get(COL_TODO, id)) openTodo(id);
      else if (wantNew) openNew();
    }, (e) => {
      page.innerHTML = '<div class="empty card"><h2>내 일정을 불러오지 못했습니다</h2><p class="muted">' + P.esc(e.message) + '</p><button type="button" class="btn btn-primary" onclick="location.reload()">다시 시도</button></div>';
    });

    return () => {
      clearInterval(clock);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }

  P.registerApp({
    id: 'my-schedule',
    group: 'plan',
    title: '내 일정',
    short: '내 일정',
    order: 2.5,
    desc: '나만 보는 일정과 할 일. 이 기기에만 저장하고 부서 일정은 겹쳐 보기',
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="12" cy="15" r="2"/></svg>',
    mount
  });
})();
