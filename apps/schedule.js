/* 부서 스케줄러: 일정표 · 주요업무 (보급용 범용 보드). 개인 할 일은 '내 일정'(my-schedule.js, 이 기기 전용)으로 옮김 */
(function () {
  'use strict';

  const COL_EV = 'schedule-events';
  const COL_TASK = 'schedule-tasks';
  // 예전 '개인업무' 컬렉션(schedule-personal)은 지우지 않고 남겨 둠. 내 일정이 한 번 옮겨 가고 여기서는 보여 주지 않음
  const COL_CFG = 'schedule-config';
  const MAJOR = '주요업무';
  const STATUSES = ['예정', '진행', '완료', '보류'];
  const DEFAULT_BOARD = {
    name: '부서 스케줄러',
    categories: [
      { name: MAJOR, color: '#B7791F' }, { name: '회의', color: '#4C63B6' }, { name: '교육', color: '#13897B' },
      { name: '행사', color: '#C0497A' }, { name: '출장', color: '#7C5CC4' }, { name: '방문', color: '#2F86B5' },
      { name: '보고', color: '#8A6A4E' }, { name: '기타', color: '#737985' }
    ]
  };
  const TABS = [['events', '일정표'], ['tasks', '주요업무']];

  function mount(root, ctx) {
    const K = window.SchedKit;
    if (!K) { root.innerHTML = '<div class="page"><div class="empty card">스케줄러 도구(head-schedule.js)를 불러오지 못했습니다.</div></div>'; return; }
    if (ctx.params[0] === 'personal') { setTimeout(() => P.navigate('my-schedule/todos'), 0); return; }
    const bar = K.statusBar();
    const repo = K.makeRepo([COL_EV, COL_TASK, COL_CFG], bar.set);
    const isTab = (t) => TABS.some((x) => x[0] === t);
    const tab0 = isTab(ctx.params[0]) ? ctx.params[0] : isTab(P.settings.get('schedule.tab', 'events')) ? P.settings.get('schedule.tab', 'events') : 'events';
    const st = {
      tab: tab0,
      evView: P.settings.get('schedule.evView', 'list'),
      tView: P.settings.get('schedule.tasksView', 'board') === 'table' ? 'table' : 'board',
      q: '',
      cats: { events: new Set(), tasks: new Set() },
      showPast: false,
      showDone: false,
      cal: K.today(),
      status: 'all',
      owner: '',
      narrow: false
    };
    root.innerHTML = '<div class="page sch-page">' + P.ui.skeleton(4) + '</div>';
    const page = root.firstChild;

    /* ---------- 데이터 도우미 ---------- */
    const board = () => {
      const b = repo.get(COL_CFG, 'board') || {};
      return { name: b.name || DEFAULT_BOARD.name, categories: Array.isArray(b.categories) && b.categories.length ? b.categories : DEFAULT_BOARD.categories };
    };
    const cats = () => board().categories;
    const catIndex = (name) => { const i = cats().findIndex((c) => c.name === name); return i < 0 ? 999 : i; };
    const catColor = (name) => { const c = cats().find((x) => x.name === name); return K.safeColor(c && c.color, K.colorFor(name)); };
    const sortTags = (tags) => (tags || []).slice().sort((a, b) => catIndex(a) - catIndex(b));
    const mainTag = (e) => sortTags(e.tags)[0] || '기타';
    const events = () => repo.all(COL_EV);
    const endOf = (e) => (e.endDate && e.endDate > e.date ? e.endDate : e.date);
    const isMajor = (e) => (e.tags || []).includes(MAJOR);
    const evTime = (e) => (e.allDay || !e.start ? '종일' : e.start + (e.end ? '~' + e.end : ''));
    // 같은 날: 취소는 뒤로, 종일 먼저, 시작 시간 순, 같으면 구분 우선순위
    const dayOrder = (a, b) => (!!a.e.cancelled - !!b.e.cancelled) || (a.e.allDay === b.e.allDay ? 0 : a.e.allDay ? -1 : 1) ||
      String(a.e.start || '').localeCompare(String(b.e.start || '')) || (catIndex(mainTag(a.e)) - catIndex(mainTag(b.e)));
    const owners = () => Array.from(new Set(events().map((e) => e.owner).concat(repo.all(COL_TASK).map((t) => t.owner)).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'));
    const dLabel = (due) => {
      if (!due) return '';
      const n = K.diffDays(K.today(), due);
      return n === 0 ? '오늘' : n > 0 ? 'D-' + n : Math.abs(n) + '일 지남';
    };
    const ts = () => K.terms(st.q);
    const evHay = (e) => [e.title, e.place, e.owner, e.note, (e.tags || []).join(' '), e.date, e.endDate, e.cancelReason, e.cancelled ? '취소' : ''].join(' ');

    function occurrences(list) {
      const map = new Map();
      list.forEach((e) => {
        const total = Math.min(K.diffDays(e.date, endOf(e)) + 1, 366);
        for (let i = 0; i < total; i++) {
          const d = K.addDays(e.date, i);
          if (!map.has(d)) map.set(d, []);
          map.get(d).push({ e, n: i + 1, total });
        }
      });
      map.forEach((arr) => arr.sort(dayOrder));
      return map;
    }
    const filteredEvents = () => {
      const t = ts();
      const cs = st.cats.events;
      return events().filter((e) => (!cs.size || (e.tags || []).some((x) => cs.has(x))) && (!t.length || K.matchAll(evHay(e), t)));
    };

    /* 주요업무: 직접 만든 업무 + '주요업무' 구분 일정에서 자동으로 생기는 연동 카드 */
    function tasks() {
      const t = K.today();
      const linked = events().filter((e) => isMajor(e) && !e.cancelled).map((e) => {
        const end = endOf(e);
        const total = K.diffDays(e.date, end) + 1;
        // 진행 중이면 오늘을 반쯤 지난 것으로 셈 (하루 일정 당일 = 50%)
        const done = t > end ? total : Math.max(0, K.diffDays(e.date, t) + (t >= e.date ? 0.5 : 0));
        return {
          id: 'ev:' + e.id, eventId: e.id, linked: true, title: e.title, owner: e.owner || '', due: end, start: e.date,
          category: MAJOR, detail: [evTime(e), e.place].filter(Boolean).join(' · '),
          status: t < e.date ? '예정' : t > end ? '완료' : '진행', progress: Math.round(done / total * 100)
        };
      });
      return repo.all(COL_TASK).concat(linked);
    }
    const taskHay = (x) => [x.title, x.owner, x.detail, x.category, x.status, x.due].join(' ');

    /* ---------- 틀 ---------- */
    const initial = (name) => P.esc(Array.from(String(name || '').trim())[0] || '?');
    const ownerAv = (name, t) => '<span class="sc-owner-cell"><span class="avatar avatar-sm sch-av" style="--c:' + K.colorFor(name) + '" aria-hidden="true">' + initial(name) + '</span><span>' + K.mark(name, t) + '</span></span>';
    /* 머리 띠는 한 번만 그림(그림 자리가 다시 불러와지며 깜빡이지 않게), 나머지는 .sch-main 에 */
    function frame() {
      let main = page.querySelector(':scope > .sch-main');
      if (!main) {
        page.innerHTML = K.hero({
          slot: 'tab-schedule', cls: 'sc-hero', title: board().name, h1Class: 'sc-board-name',
          kicker: '<span class="sch-hero-no">상황판</span><span class="sc-hero-date num"></span>',
          sub: '부서 일정과 주요업무를 한 판에',
          acts:
            '<button type="button" class="btn" data-act="brief" aria-label="아침 브리핑" title="오늘 일정·내일 건수·기한 임박 업무를 복사">' + K.IC.sun + '<span>아침 브리핑</span></button>' +
            '<button type="button" class="btn btn-ghost p-icon-btn" data-act="more" aria-label="더보기" title="더보기">' + K.IC.more + '</button>' +
            '<button type="button" class="btn btn-primary sch-hide-sm" data-act="new" title="새 항목 (N)">' + P.icons.plus + '<span>새 항목</span></button>'
        }) + '<div class="sch-main"></div>';
        main = page.querySelector(':scope > .sch-main');
      }
      const h1 = page.querySelector('.sc-board-name');
      if (h1.textContent !== board().name) h1.textContent = board().name;
      const td = K.today();
      page.querySelector('.sc-hero-date').textContent = K.md(td) + ' · ' + K.parse(td).getFullYear();
      return main;
    }
    function render() {
      st.narrow = window.matchMedia('(max-width: 760px)').matches;
      const counts = { events: occurrences(events().filter((e) => !e.cancelled)).get(K.today()), tasks: tasks().filter((x) => x.status !== '완료' && x.status !== '보류').length };
      frame().innerHTML =
        '<div class="sc-top">' +
        '<div class="seg sc-tabs" role="tablist" aria-label="보드 탭">' + TABS.map(([id, label], i) => {
          const n = id === 'events' ? (counts.events || []).length : counts[id];
          return '<button type="button" role="tab" id="sc-tab-' + id + '" aria-controls="sc-panel" aria-selected="' + (st.tab === id) + '" data-tab="' + id + '" title="' + label + ' (' + (i + 1) + ')">' + label +
            (n ? '<span class="sc-count num" title="' + (id === 'events' ? '오늘 일정' : '진행 중·예정 업무') + '">' + n + '</span>' : '') + '</button>';
        }).join('') + '</div>' +
        '<div class="sch-bar">' +
        '<label class="p-search sc-search">' + P.icons.search + '<span class="sr-only">검색</span><input type="search" placeholder="검색" title="띄어쓰기로 나눈 단어를 모두 포함 (/)" value="' + P.esc(st.q) + '" data-search></label>' +
        (st.tab === 'events' ? '<div class="seg sc-evseg" role="radiogroup" aria-label="보기">' +
          '<button type="button" role="radio" aria-checked="' + (st.evView === 'list') + '" data-ev-view="list" title="목록">' + K.IC.list + '<span>목록</span></button>' +
          '<button type="button" role="radio" aria-checked="' + (st.evView === 'cal') + '" data-ev-view="cal" title="달력 (C)">' + K.IC.calendar + '<span>달력</span></button></div>'
          : '<div class="seg sc-evseg sc-tvseg" role="radiogroup" aria-label="주요업무 보기">' +
          '<button type="button" role="radio" aria-checked="' + (st.tView === 'board') + '" data-tasks-view="board" title="상황판 (B)">' + K.IC.board + '<span>보드</span></button>' +
          '<button type="button" role="radio" aria-checked="' + (st.tView === 'table') + '" data-tasks-view="table" title="표 (B)">' + K.IC.table + '<span>표</span></button></div>') +
        '</div></div>' +
        '<div class="chips sch-filter" role="group" aria-label="거르기"></div>' +
        '<div class="sch-body" id="sc-panel" role="tabpanel" aria-labelledby="sc-tab-' + st.tab + '"></div>' +
        '<button type="button" class="sch-fab" data-act="new" aria-label="새 항목">' + P.icons.plus + '</button>';
      page.querySelector('.sc-top .sch-bar').appendChild(bar.el);
      renderFilter();
      renderBody();
    }

    function renderFilter() {
      const box = page.querySelector('.sch-filter');
      let html = '';
      if (st.tab === 'tasks') {
        html += ['all'].concat(STATUSES).map((s) => '<button type="button" class="chip" data-status="' + s + '" aria-pressed="' + (st.status === s) + '">' + (s === 'all' ? '전체 상태' : s) + '</button>').join('');
        const os = owners();
        if (os.length) html += '<select class="sc-owner" aria-label="담당자" data-owner><option value="">담당 전체</option>' + os.map((o) => '<option' + (o === st.owner ? ' selected' : '') + '>' + P.esc(o) + '</option>').join('') + '</select>';
        html += '<span class="sc-sep" aria-hidden="true"></span>';
      }
      const set = st.cats[st.tab];
      const used = new Set((st.tab === 'events' ? events().flatMap((e) => e.tags || []) : tasks().map((x) => x.category)).filter(Boolean));
      const names = cats().map((c) => c.name).concat(Array.from(used).filter((n) => catIndex(n) === 999));
      html += names.filter((n) => used.has(n) || set.has(n)).map((n) => '<button type="button" class="chip sch-chip-cat" style="--c:' + catColor(n) + '" data-cat="' + P.esc(n) + '" aria-pressed="' + set.has(n) + '"><i></i>' + P.esc(n) + '</button>').join('');
      if (set.size) html += '<button type="button" class="btn btn-ghost btn-sm" data-act="clear-cats">구분 해제</button>';
      box.innerHTML = html;
    }

    function renderBody() {
      const body = page.querySelector('.sch-body');
      if (!body) return;
      if (st.tab === 'events') body.innerHTML = st.evView === 'cal' && !st.q ? eventsCal() : eventsList();
      else body.innerHTML = tasksView();
    }

    /* ---------- 일정표 ---------- */
    function evItem(o, t) {
      const e = o.e;
      const tags = sortTags(e.tags);
      const major = isMajor(e);
      const timed = !e.allDay && e.start;
      return '<button type="button" class="sc-ev' + (major ? ' major' : '') + (e.cancelled ? ' cancelled' : '') + '" style="--c:' + catColor(mainTag(e)) + '" data-ev="' + P.esc(e.id) + '">' +
        '<span class="sc-ev-time num">' + (timed ? '<b>' + e.start + '</b>' + (e.end ? '<small>' + e.end + '</small>' : '') : '<b>종일</b>') + (o.total > 1 ? '<em>' + o.n + '/' + o.total + '일차</em>' : '') + '</span>' +
        '<span class="sc-ev-main"><span class="sc-ev-title">' + K.mark(e.title, t) + '</span>' +
        '<span class="sc-ev-meta">' + tags.map((x) => '<span class="sc-tag" style="--c:' + catColor(x) + '">' + K.mark(x, t) + '</span>').join('') +
        (e.cancelled ? '<span class="badge badge-danger sc-cancel">취소' + (e.cancelReason ? ' · ' + K.mark(e.cancelReason, t) : '') + '</span>' : '') +
        (e.place ? '<span class="sc-ev-place">' + K.IC.pin + K.mark(e.place, t) + '</span>' : '') +
        (e.owner ? '<span class="sc-ev-owner">' + K.mark(e.owner, t) + '</span>' : '') + '</span>' +
        (e.note ? '<span class="sc-ev-note">' + K.mark(e.note, t) + '</span>' : '') + '</span></button>';
    }
    function dayBlock(d, list, t) {
      const td = K.today();
      const rel = d === td ? '오늘' : d === K.addDays(td, 1) ? '내일' : d === K.addDays(td, -1) ? '어제' : '';
      const live = list.filter((o) => !o.e.cancelled).length;
      const dt = K.parse(d);
      return '<section class="sc-day' + (d === td ? ' today' : '') + (d < td ? ' past' : '') + (K.dow(d) % 6 === 0 ? ' weekend' : '') + '">' +
        '<h3 class="sc-day-head"><span class="sc-dnum num">' + dt.getDate() + '</span><span class="sc-dmeta"><b>' + K.DOW[dt.getDay()] + '요일</b><small>' + (dt.getMonth() + 1) + '월' + (rel ? ' · ' + rel : '') + '</small></span><span class="sc-dcount num">' + live + '건</span></h3>' +
        '<div class="sc-day-list">' + list.map((o) => evItem(o, t)).join('') + '</div></section>';
    }
    function eventsList() {
      const t = ts();
      const list = filteredEvents();
      const occ = occurrences(list);
      const days = Array.from(occ.keys()).sort();
      const td = K.today();
      if (t.length) {
        if (!list.length) return '<div class="empty card"><p>\'' + P.esc(st.q) + '\' 검색 결과가 없습니다.</p></div>';
        return '<p class="sc-result"><b>' + list.length + '건</b> · ' + days.length + '일 <span class="num">' + K.md(days[0]) + ' ~ ' + K.md(days[days.length - 1]) + '</span></p><div class="sc-agenda">' + days.map((d) => dayBlock(d, occ.get(d), t)).join('') + '</div>';
      }
      const past = days.filter((d) => d < td);
      const coming = days.filter((d) => d >= td);
      const pastCount = past.reduce((a, d) => a + occ.get(d).length, 0);
      let html = '';
      if (past.length) {
        html += '<button type="button" class="btn btn-ghost btn-sm sc-past-btn" data-act="past" aria-expanded="' + st.showPast + '">' + P.icons.chevron + (st.showPast ? '지난 일정 접기' : '지난 일정 ' + pastCount + '건') + '</button>';
        if (st.showPast) html += '<div class="sc-agenda sc-past">' + past.map((d) => dayBlock(d, occ.get(d), t)).join('') + '</div>';
      }
      if (!coming.length) html += '<div class="empty card empty-art"><div class="fx-img-slot" data-slot="empty-schedule"></div><div class="empty-txt"><h3>예정된 일정이 없습니다</h3><p>부서 일정을 넣으면 날짜순으로 이곳에 모이고, 홈 화면에도 보입니다.</p><div class="toolbar sc-empty-acts"><button type="button" class="btn btn-primary btn-sm" data-act="new">' + P.icons.plus + '일정 추가</button>' + (events().length ? '' : '<button type="button" class="btn btn-sm" data-act="sample">예시 데이터</button>') + '</div></div></div>';
      return html + (coming.length ? '<div class="sc-agenda">' + coming.map((d) => dayBlock(d, occ.get(d), t)).join('') + '</div>' : '');
    }
    function eventsCal() {
      const occ = occurrences(filteredEvents());
      const cells = K.monthCells(st.cal);
      const m = K.parse(st.cal).getMonth();
      const td = K.today();
      const d0 = K.parse(st.cal);
      const sel = occ.get(st.cal) || [];
      return '<div class="sch-bar sc-calnav"><div class="sch-nav"><button type="button" class="btn btn-ghost p-icon-btn" data-cal="-1" aria-label="이전 달">' + K.IC.left + '</button>' +
        '<button type="button" class="btn btn-sm" data-cal="0">오늘</button>' +
        '<button type="button" class="btn btn-ghost p-icon-btn" data-cal="1" aria-label="다음 달">' + K.IC.right + '</button>' +
        '<strong class="sch-range">' + (d0.getMonth() + 1) + '월 <span>' + d0.getFullYear() + '</span></strong></div></div>' +
        '<div class="hs-month"><div class="sch-cal" role="grid" title="날짜를 한 번 더 누르면 그 날짜로 새 일정">' + [1, 2, 3, 4, 5, 6, 0].map((i) => '<div class="sch-cal-dow">' + K.DOW[i] + '</div>').join('') +
        cells.map((d) => {
          const list = occ.get(d) || [];
          const cls = ['sch-cal-day', K.parse(d).getMonth() !== m ? 'out' : '', d === td ? 'today' : '', d === st.cal ? 'sel' : '', K.dow(d) === 0 ? 'sun' : K.dow(d) === 6 ? 'sat' : ''].join(' ');
          return '<div class="' + cls + '" data-day="' + d + '" role="gridcell"><span class="sch-cal-num num">' + K.parse(d).getDate() + '</span><div class="sch-cal-items">' +
            list.slice(0, 3).map((o) => {
              const timed = o.e.start && !o.e.allDay && o.total === 1;
              return '<button type="button" class="sch-cal-ev' + (timed ? ' timed' : '') + (isMajor(o.e) ? ' major' : '') + (o.e.cancelled ? ' cancelled' : '') + '" style="--c:' + catColor(mainTag(o.e)) + '" data-ev="' + P.esc(o.e.id) + '" title="' + P.esc(evTime(o.e) + ' ' + o.e.title) + '">' + (timed ? '<b class="num">' + o.e.start + '</b>' : '') + '<span>' + P.esc(o.e.title) + '</span></button>';
            }).join('') +
            (list.length > 3 ? '<span class="sch-cal-more">+' + (list.length - 3) + '건</span>' : '') + '</div>' +
            '<span class="sch-cal-dots">' + list.slice(0, 4).map((o) => '<i style="--c:' + catColor(mainTag(o.e)) + '"></i>').join('') + '</span></div>';
        }).join('') + '</div>' +
        '<aside class="hs-month-day sc-cal-sel"><h3>' + K.longDate(st.cal) + '</h3>' + (sel.length ? '<div class="sc-day-list">' + sel.map((o) => evItem(o, [])).join('') + '</div>'
          : '<div class="hs-empty"><span>일정 없음</span><button type="button" class="btn btn-sm" data-new-day="' + st.cal + '">' + P.icons.plus + '추가</button></div>') + '</aside></div>';
    }

    /* ---------- 주요업무 ---------- */
    function dueBadge(x, over) {
      if (!x.due) return '<span class="sc-due muted">미정</span>';
      const closed = x.status === '완료' || x.status === '보류';
      const n = K.diffDays(K.today(), x.due);
      const cls = closed ? '' : over || n === 0 ? ' badge-signal' : n <= 3 ? ' badge-warn' : '';
      return '<span class="sc-due' + (over ? ' over' : '') + '"><span class="num">' + K.md(x.due) + '</span>' + (closed ? '' : '<span class="badge' + cls + '">' + dLabel(x.due) + '</span>') + '</span>';
    }
    const STATUS_BADGE = { 예정: 'badge', 진행: 'badge badge-accent', 완료: 'badge badge-ok', 보류: 'badge badge-warn' };
    function taskCard(x, t) {
      const td = K.today();
      const over = x.due && x.due < td && x.status !== '완료' && x.status !== '보류';
      const prog = Math.max(0, Math.min(100, x.progress || 0));
      return '<article class="sc-task' + (over ? ' over' : '') + (x.linked ? ' linked' : '') + (x.status === '완료' ? ' done' : '') + '" style="--c:' + catColor(x.category || '기타') + '">' +
        '<button type="button" class="sc-task-open" ' + (x.linked ? 'data-ev="' + P.esc(x.eventId) + '"' : 'data-task="' + P.esc(x.id) + '"') + ' aria-label="' + P.esc(x.title) + ' 열기"></button>' +
        '<div class="sc-task-name"><h3>' + K.mark(x.title, t) + '</h3><div class="sc-task-sub">' +
        (x.category ? '<span class="sc-tag" style="--c:' + catColor(x.category) + '">' + K.mark(x.category, t) + '</span>' : '') +
        (x.linked ? '<span class="sc-link" title="주요업무 구분 일정에서 자동 연동">' + K.IC.calendar + '일정 연동</span>' : '') +
        (x.detail ? '<span class="sc-task-detail">' + K.mark(x.detail, t) + '</span>' : '') + '</div></div>' +
        '<div class="sc-task-owner">' + (x.owner ? ownerAv(x.owner, t) : '<span class="muted">미정</span>') + '</div>' +
        '<div class="sc-task-due">' + dueBadge(x, over) + '</div>' +
        '<div class="sc-task-prog"><div class="sc-progress" role="progressbar" aria-valuenow="' + prog + '" aria-valuemin="0" aria-valuemax="100" aria-label="진척률"><span style="width:' + prog + '%"></span></div><span class="num">' + (x.progress || 0) + '%</span></div>' +
        '<div class="sc-task-status"><span class="' + (STATUS_BADGE[x.status] || 'badge') + '">' + P.esc(x.status || '예정') + '</span></div>' +
        '<div class="sc-task-act">' + (x.linked ? '' : '<button type="button" class="btn btn-sm' + (x.status === '완료' ? ' btn-ghost' : '') + '" data-done="' + P.esc(x.id) + '" title="' + (x.status === '완료' ? '진행으로 되돌리기' : '완료로 표시') + '">' + (x.status === '완료' ? '되돌리기' : P.icons.check + '완료') + '</button>') + '</div></article>';
    }
    /* ---------- 주요업무: 자석 상황판 (예정 · 진행 · 완료 · 보류) ----------
       마우스·펜은 끌어서 칸 옮기기, 키보드는 카드에서 Alt+←/→ 또는 ⋯ 메뉴 '상태 옮기기', 터치는 메뉴 */
    const COL_HINT = { 예정: '착수 전', 진행: '처리 중', 완료: '끝난 일', 보류: '멈춘 일' };
    function magnetCard(x, t) {
      const td = K.today();
      const over = x.due && x.due < td && x.status !== '완료' && x.status !== '보류';
      const prog = Math.max(0, Math.min(100, x.progress || 0));
      const done = x.status === '완료';
      const key = x.linked ? 'data-ev="' + P.esc(x.eventId) + '"' : 'data-task="' + P.esc(x.id) + '"';
      return '<article class="sc-task sc-mag' + (over ? ' over' : '') + (x.linked ? ' linked' : '') + (done ? ' done' : '') + '" style="--c:' + catColor(x.category || '기타') + ';--m:' + (x.owner ? K.colorFor(x.owner) : 'var(--muted)') + '" data-card="' + P.esc(x.id) + '" data-st="' + P.esc(x.status || '예정') + '">' +
        '<button type="button" class="sc-task-open" ' + key + ' aria-label="' + P.esc(x.title + ', ' + (x.status || '예정') + (x.owner ? ', 담당 ' + x.owner : '') + (x.due ? ', 기한 ' + K.md(x.due) : '')) + (x.linked ? '' : '. Alt+화살표로 상태 옮기기') + '"' + (x.linked ? '' : ' aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"') + '></button>' +
        '<div class="sc-mag-top"><span class="sc-tag" style="--c:' + catColor(x.category || '기타') + '">' + K.mark(x.category || '기타', t) + '</span>' +
        (x.linked ? '<span class="sc-link" title="주요업무 구분 일정에서 자동 연동. 상태는 날짜로 정해집니다">' + K.IC.calendar + '일정 연동</span>' : '') + '</div>' +
        '<div class="sc-task-name"><h3>' + K.mark(x.title, t) + '</h3>' + (x.detail ? '<p class="sc-task-detail">' + K.mark(x.detail, t) + '</p>' : '') + '</div>' +
        '<div class="sc-mag-meta"><span class="sc-mag-owner">' + (x.owner ? '<b class="sc-magnet" aria-hidden="true"></b>' + K.mark(x.owner, t) : '<span class="muted">담당 미정</span>') + '</span>' + dueBadge(x, over) + '</div>' +
        '<div class="sc-task-prog"><div class="sc-progress" role="progressbar" aria-valuenow="' + prog + '" aria-valuemin="0" aria-valuemax="100" aria-label="진척률"><span style="width:' + prog + '%"></span></div><span class="num">' + (x.progress || 0) + '%</span></div>' +
        '<div class="sc-task-act">' + (x.linked ? '' :
          '<button type="button" class="btn btn-ghost btn-sm p-icon-btn sc-mag-done" data-done="' + P.esc(x.id) + '" title="' + (done ? '진행으로 되돌리기' : '완료로 표시') + '" aria-label="' + (done ? '진행으로 되돌리기' : '완료로 표시') + '">' + (done ? K.IC.left : P.icons.check) + '</button>' +
          '<button type="button" class="btn btn-ghost btn-sm p-icon-btn" data-card-menu="' + P.esc(x.id) + '" aria-haspopup="menu" aria-label="' + P.esc(x.title) + ' 메뉴" title="상태 옮기기 · 열기">' + K.IC.more + '</button>') + '</div></article>';
    }
    function boardView(list, t) {
      const byDue = (a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')) || String(a.title).localeCompare(String(b.title), 'ko');
      const cols = st.status === 'all' ? STATUSES : [st.status];
      return '<div class="sc-kanban" style="--n:' + cols.length + '" aria-label="주요업무 상황판">' + cols.map((s, i) => {
        const items = list.filter((x) => (x.status || '예정') === s).sort(s === '완료' ? (a, b) => String(b.due || '').localeCompare(String(a.due || '')) : byDue);
        const closed = s === '완료' || s === '보류';
        return '<section class="sc-group sc-col' + (closed ? ' closed' : '') + '" data-col="' + s + '" aria-labelledby="sc-col-' + i + '">' +
          '<h3 class="sc-col-head" id="sc-col-' + i + '"><span class="sc-col-no num">' + (STATUSES.indexOf(s) + 1) + '.</span><span class="sc-col-name">' + s + '</span><span class="sc-col-hint">' + COL_HINT[s] + '</span><span class="sc-col-n num">' + items.length + '</span></h3>' +
          '<div class="sc-col-body">' + (items.length ? items.map((x) => magnetCard(x, t)).join('') : '<p class="sc-col-empty">' + (s === '진행' ? '카드를 이곳으로 끌어 오세요' : '비어 있음') + '</p>') + '</div></section>';
      }).join('') + '</div>' + (st.narrow ? '' : '<p class="sc-kb-hint muted">카드를 끌어 다른 칸에 놓으면 상태가 바뀝니다. 키보드: 카드에서 Alt+←/→ · 메뉴 ⋯</p>');
    }

    function tasksView() {
      const t = ts();
      const td = K.today();
      const cs = st.cats.tasks;
      const list = tasks().filter((x) => (st.status === 'all' || x.status === st.status) && (!st.owner || x.owner === st.owner) && (!cs.size || cs.has(x.category)) && (!t.length || K.matchAll(taskHay(x), t)));
      if (!list.length) {
        return '<div class="empty card"><p>' + (tasks().length ? '조건에 맞는 업무가 없습니다.' : '주요업무가 없습니다.') + '</p><div class="toolbar sc-empty-acts"><button type="button" class="btn btn-primary btn-sm" data-act="new">' + P.icons.plus + '업무 추가</button>' + (tasks().length ? '' : '<button type="button" class="btn btn-sm" data-act="sample">예시 데이터</button>') + '</div></div>';
      }
      if (st.tView === 'board') return boardView(list, t);
      const byDue = (a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')) || STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
      const closed = (x) => x.status === '완료' || x.status === '보류';
      const groups = [
        ['기한 지남', list.filter((x) => !closed(x) && x.due && x.due < td).sort(byDue), 'over'],
        ['오늘 기한', list.filter((x) => !closed(x) && x.due === td), 'today'],
        ['다가오는 기한', list.filter((x) => !closed(x) && x.due > td).sort(byDue), ''],
        ['기한 미정', list.filter((x) => !closed(x) && !x.due), ''],
        ['완료·보류', list.filter(closed).sort((a, b) => String(b.due || '').localeCompare(String(a.due || ''))), 'closed']
      ];
      return '<div class="sc-tt"><div class="sc-tt-head" aria-hidden="true"><span>업무</span><span>담당</span><span>기한</span><span>진척</span><span>상태</span><span></span></div>' +
        groups.filter((g) => g[1].length).map(([title, items, kind]) => {
          const fold = kind === 'closed' && !st.showDone && !t.length && st.status === 'all';
          return '<section class="sc-group ' + kind + '"><h3 class="sc-group-head"><span>' + title + '</span><span class="num">' + items.length + '</span>' +
            (kind === 'closed' && !t.length && st.status === 'all' ? '<button type="button" class="btn btn-ghost btn-sm" data-act="done-fold" aria-expanded="' + !fold + '">' + (fold ? '펼치기' : '접기') + '</button>' : '') + '</h3>' +
            (fold ? '' : items.map((x) => taskCard(x, t)).join('')) + '</section>';
        }).join('') + '</div>';
    }

    /* ---------- 입력 창 ---------- */
    function ownerList() {
      return '<datalist id="sc-owners">' + owners().map((o) => '<option value="' + P.esc(o) + '">').join('') + '</datalist>';
    }
    function openEvent(id, preset) {
      const cur = id ? repo.get(COL_EV, id) : null;
      const e = Object.assign({ title: '', date: st.tab === 'events' && st.evView === 'cal' ? st.cal : K.today(), endDate: '', allDay: false, start: '09:00', end: '18:00', place: '', owner: '', tags: [], note: '' }, cur || {}, preset || {});
      const f = document.createElement('form');
      f.className = 'sch-form';
      const tagNames = cats().map((c) => c.name).concat((e.tags || []).filter((x) => catIndex(x) === 999));
      f.innerHTML =
        '<div class="field"><label for="sc-title">제목</label><input id="sc-title" name="title" maxlength="80" required placeholder="예: 분기 업무 점검 회의"></div>' +
        '<div class="field"><label>구분 <small class="muted">여러 개 선택 가능, 첫 구분 색으로 표시</small></label><div class="chips">' +
        tagNames.map((n) => '<label class="sch-check" style="--c:' + catColor(n) + '"><input type="checkbox" name="tags" value="' + P.esc(n) + '"' + ((e.tags || []).includes(n) ? ' checked' : '') + '><span><i></i>' + P.esc(n) + '</span></label>').join('') + '</div>' +
        '<p class="muted sc-major-hint">\'' + MAJOR + '\'를 고르면 주요업무 탭에 연동 카드가 생깁니다.</p></div>' +
        '<div class="sch-form-row"><div class="field"><label for="sc-date">시작일</label><input id="sc-date" name="date" type="date" required></div>' +
        '<div class="field"><label for="sc-end-date">종료일 <small class="muted">비우면 하루</small></label><input id="sc-end-date" name="endDate" type="date"></div></div>' +
        '<label class="sch-toggle"><input type="checkbox" name="allDay"' + (e.allDay ? ' checked' : '') + '> 종일 일정</label>' +
        '<div class="sch-form-row sch-times"><div class="field"><label for="sc-start">시작</label><input id="sc-start" name="start" type="time" step="300"></div>' +
        '<div class="field"><label for="sc-end">종료</label><input id="sc-end" name="end" type="time" step="300"></div></div>' +
        '<div class="sch-form-row"><div class="field"><label for="sc-place">장소</label><input id="sc-place" name="place" maxlength="60"></div>' +
        '<div class="field"><label for="sc-owner">담당</label><input id="sc-owner" name="owner" maxlength="30" list="sc-owners" autocomplete="off"></div></div>' +
        '<div class="field"><label for="sc-note">메모</label><textarea id="sc-note" name="note" rows="3" maxlength="1000"></textarea></div>' +
        (e.cancelled ? '<p class="sc-cancel-box">취소된 일정입니다' + (e.cancelReason ? ' · 사유: ' + P.esc(e.cancelReason) : '') + '</p>' : '') +
        '<p class="p-form-status err" role="alert"></p>' + ownerList();
      ['title', 'date', 'endDate', 'start', 'end', 'place', 'owner', 'note'].forEach((k) => { f[k].value = e[k] || ''; });
      const syncTimes = () => { f.querySelector('.sch-times').hidden = f.allDay.checked; };
      f.allDay.addEventListener('change', syncTimes);
      syncTimes();
      f.addEventListener('submit', (ev) => ev.preventDefault());
      const err = f.querySelector('.p-form-status');
      function read() {
        return Object.assign({}, cur || {}, {
          title: f.title.value.trim(), date: f.date.value, endDate: f.endDate.value === f.date.value ? '' : f.endDate.value,
          allDay: f.allDay.checked, start: f.allDay.checked ? '' : f.start.value, end: f.allDay.checked ? '' : f.end.value,
          place: f.place.value.trim(), owner: f.owner.value.trim(), note: f.note.value.trim(),
          tags: sortTags(Array.from(f.querySelectorAll('[name="tags"]:checked')).map((x) => x.value))
        });
      }
      function check(d) {
        if (!d.title) { err.textContent = '제목을 입력하세요.'; f.title.focus(); return false; }
        if (!K.isDate(d.date)) { err.textContent = '시작일을 입력하세요.'; f.date.focus(); return false; }
        if (d.endDate && d.endDate < d.date) { err.textContent = '종료일이 시작일보다 빠릅니다.'; f.endDate.focus(); return false; }
        if (!d.allDay && !d.endDate && d.start && d.end && d.end < d.start) { err.textContent = '종료 시간이 시작 시간보다 빠릅니다.'; f.end.focus(); return false; }
        return true;
      }
      async function save(data, label, msg) {
        const newId = id || P.store.uid();
        const wasMajor = cur && isMajor(cur);
        try { await repo.put(COL_EV, newId, data, label); } catch (x) { return false; }
        st.cal = data.date;
        P.ui.toast(msg + (isMajor(data) && !wasMajor && !data.cancelled ? ' 주요업무 탭에 연동 카드가 생겼습니다.' : ''), 'ok');
        render();
        return true;
      }
      const onSave = () => { const d = read(); return check(d) ? save(d, id ? '일정 수정' : '일정 추가', id ? '일정을 고쳤습니다.' : '일정을 추가했습니다.') : false; };
      const actions = [];
      if (id) {
        actions.push({ label: '삭제', onClick: async () => {
          if (!(await P.ui.confirm('"' + e.title + '" 일정을 지울까요?\n지우지 않고 남기려면 "일정 취소"를 쓰세요. 지운 뒤에도 Ctrl+Z 로 되돌릴 수 있습니다.', { danger: true, okLabel: '삭제' }))) return false;
          await repo.remove(COL_EV, id, '일정 삭제');
          P.ui.toast('일정을 지웠습니다. (Ctrl+Z 실행 취소)', 'ok');
          render();
        } });
        actions.push(e.cancelled
          ? { label: '취소 해제', onClick: () => { const d = read(); delete d.cancelled; delete d.cancelReason; return save(d, '취소 해제', '일정 취소를 해제했습니다.'); } }
          : { label: '일정 취소', onClick: async () => {
            const d = read();
            if (!check(d)) return false;
            const reason = await P.ui.prompt('취소 사유 (선택, 비워도 됩니다)', '');
            if (reason == null) return false;
            d.cancelled = true;
            d.cancelReason = reason.trim();
            return save(d, '일정 취소', '일정을 취소로 표시했습니다. 목록에 취소선으로 남습니다.');
          } });
        actions.push({ label: '복제', onClick: () => { const d = read(); delete d.cancelled; delete d.cancelReason; setTimeout(() => openEvent(null, Object.assign(d, { title: d.title + ' (복사)' })), 200); } });
      }
      actions.push({ label: '닫기' }, { label: '저장', primary: true, onClick: onSave });
      const close = P.ui.modal({ title: id ? '일정 수정' : '새 일정', body: f, wide: true, actions });
      f.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); Promise.resolve(onSave()).then((ok) => { if (ok) close(); }); } });
    }

    function openTask(id, preset) {
      const cur = id ? repo.get(COL_TASK, id) : null;
      const x = Object.assign({ title: '', category: cats().some((c) => c.name === MAJOR) ? MAJOR : (cats()[0] || {}).name || '', owner: '', due: '', status: '예정', progress: 0, detail: '' }, cur || {}, preset || {});
      const f = document.createElement('form');
      f.className = 'sch-form';
      f.innerHTML =
        '<div class="field"><label for="st-title">업무명</label><input id="st-title" name="title" maxlength="80" required placeholder="예: 연간 업무계획 수립"></div>' +
        '<div class="sch-form-row"><div class="field"><label for="st-cat">분류</label><select id="st-cat" name="category">' + cats().map((c) => '<option' + (c.name === x.category ? ' selected' : '') + '>' + P.esc(c.name) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label for="st-owner">담당</label><input id="st-owner" name="owner" maxlength="30" list="sc-owners" autocomplete="off"></div></div>' +
        '<div class="sch-form-row"><div class="field"><label for="st-due">기한</label><input id="st-due" name="due" type="date"></div>' +
        '<div class="field"><label>상태</label><div class="p-seg sc-status-seg" role="radiogroup" aria-label="상태">' + STATUSES.map((s) => '<button type="button" role="radio" aria-checked="' + (x.status === s) + '" data-s="' + s + '">' + s + '</button>').join('') + '</div></div></div>' +
        '<div class="field"><label for="st-prog">진척률 <output class="sc-prog-out">' + (x.progress || 0) + '%</output></label><input id="st-prog" name="progress" type="range" min="0" max="100" step="5"></div>' +
        '<div class="field"><label for="st-detail">상세</label><textarea id="st-detail" name="detail" rows="4" maxlength="2000"></textarea></div>' +
        '<p class="p-form-status err" role="alert"></p>' + ownerList();
      ['title', 'owner', 'due', 'detail'].forEach((k) => { f[k].value = x[k] || ''; });
      f.progress.value = x.progress || 0;
      let status = x.status || '예정';
      const out = f.querySelector('.sc-prog-out');
      f.progress.addEventListener('input', () => {
        out.textContent = f.progress.value + '%';
        const p = Number(f.progress.value);
        if (p === 100) setStatus('완료'); else if (p > 0 && status === '예정') setStatus('진행');
      });
      function setStatus(s) {
        status = s;
        f.querySelectorAll('[data-s]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.s === s)));
        if (s === '완료' && f.progress.value !== '100') { f.progress.value = 100; out.textContent = '100%'; }
      }
      f.querySelector('.sc-status-seg').addEventListener('click', (ev) => { const b = ev.target.closest('[data-s]'); if (b) setStatus(b.dataset.s); });
      f.addEventListener('submit', (ev) => ev.preventDefault());
      const err = f.querySelector('.p-form-status');
      async function onSave() {
        const d = Object.assign({}, cur || {}, { title: f.title.value.trim(), category: f.category.value, owner: f.owner.value.trim(), due: f.due.value, status, progress: Number(f.progress.value) || 0, detail: f.detail.value.trim() });
        if (!d.title) { err.textContent = '업무명을 입력하세요.'; f.title.focus(); return false; }
        if (d.due && !K.isDate(d.due)) { err.textContent = '기한 날짜가 올바르지 않습니다.'; return false; }
        try { await repo.put(COL_TASK, id || P.store.uid(), d, id ? '업무 수정' : '업무 추가'); } catch (e2) { return false; }
        P.ui.toast(id ? '업무를 고쳤습니다.' : '업무를 추가했습니다.', 'ok');
        render();
        return true;
      }
      const actions = [];
      if (id) {
        actions.push({ label: '삭제', onClick: async () => {
          if (!(await P.ui.confirm('"' + x.title + '" 업무를 지울까요?\nCtrl+Z 로 되돌릴 수 있습니다.', { danger: true, okLabel: '삭제' }))) return false;
          await repo.remove(COL_TASK, id, '업무 삭제');
          P.ui.toast('업무를 지웠습니다. (Ctrl+Z 실행 취소)', 'ok');
          render();
        } });
        actions.push({ label: '복제', onClick: () => { setTimeout(() => openTask(null, Object.assign({}, x, { title: x.title + ' (복사)', status: '예정', progress: 0 })), 200); } });
      }
      actions.push({ label: '닫기' }, { label: '저장', primary: true, onClick: onSave });
      const close = P.ui.modal({ title: id ? '주요업무 수정' : '새 주요업무', body: f, wide: true, actions });
      f.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); onSave().then((ok) => { if (ok) close(); }); } });
    }

    function openNew() {
      if (st.tab === 'tasks') openTask(null);
      else openEvent(null);
    }

    /* ---------- 보드 설정 ---------- */
    function openSettings() {
      const b = board();
      let list = b.categories.map((c) => Object.assign({}, c));
      const box = document.createElement('div');
      box.className = 'hs-people';
      function draw() {
        box.innerHTML = '<div class="field"><label for="sc-bname">보드 이름</label><input id="sc-bname" maxlength="30" value="' + P.esc(box.dataset.name != null ? box.dataset.name : b.name) + '"></div>' +
          '<div class="field"><label>구분 목록 <small class="muted">순서 = 화면 우선순위. \'' + MAJOR + '\'는 주요업무 탭과 연동됩니다</small></label></div>' +
          list.map((c, i) => '<div class="hs-person sc-catrow" data-i="' + i + '"><input type="color" value="' + K.safeColor(c.color) + '" aria-label="색" data-k="color">' +
            '<input type="text" value="' + P.esc(c.name) + '" maxlength="12" aria-label="구분 이름" data-k="name">' +
            '<span class="hs-person-btns"><button type="button" class="btn btn-ghost btn-sm p-icon-btn" data-mv="-1" aria-label="위로"' + (i ? '' : ' disabled') + '><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button>' +
            '<button type="button" class="btn btn-ghost btn-sm p-icon-btn" data-mv="1" aria-label="아래로"' + (i < list.length - 1 ? '' : ' disabled') + '><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-del aria-label="삭제">' + P.icons.trash + '</button></span></div>').join('') +
          '<div class="toolbar"><button type="button" class="btn" data-add>' + P.icons.plus + '구분 추가</button><button type="button" class="btn btn-ghost" data-reset>기본값으로</button></div>' +
          '<p class="muted p-form-help">구분 이름을 바꿔도 이미 저장된 일정의 구분은 그대로입니다. 보드 이름·구분은 같은 저장 위치를 쓰는 모든 사람에게 적용됩니다.</p>';
      }
      box.addEventListener('input', (ev) => {
        if (ev.target.id === 'sc-bname') { box.dataset.name = ev.target.value; return; }
        const row = ev.target.closest('[data-i]');
        if (row && ev.target.dataset.k) list[Number(row.dataset.i)][ev.target.dataset.k] = ev.target.value;
      });
      box.addEventListener('click', (ev) => {
        const btn = ev.target.closest('button');
        if (!btn) return;
        const row = btn.closest('[data-i]');
        const i = row ? Number(row.dataset.i) : -1;
        if (btn.hasAttribute('data-add')) {
          list.push({ name: '', color: K.PALETTE[list.length % K.PALETTE.length] });
          draw();
          const ins = box.querySelectorAll('[data-k="name"]');
          ins[ins.length - 1].focus();
        } else if (btn.hasAttribute('data-reset')) { list = DEFAULT_BOARD.categories.map((c) => Object.assign({}, c)); draw(); }
        else if (btn.dataset.mv) { const j = i + Number(btn.dataset.mv); [list[i], list[j]] = [list[j], list[i]]; draw(); }
        else if (btn.hasAttribute('data-del')) { list.splice(i, 1); draw(); }
      });
      draw();
      P.ui.modal({
        title: '보드 설정', body: box, wide: true,
        actions: [{ label: '취소' }, { label: '저장', primary: true, onClick: async () => {
          const seen = new Set();
          const categories = list.map((c) => ({ name: String(c.name || '').trim().replace(/\s+/g, ''), color: K.safeColor(c.color) })).filter((c) => c.name && !seen.has(c.name) && seen.add(c.name));
          if (!categories.length) { P.ui.toast('구분을 하나 이상 남겨 두세요.', 'warn'); return false; }
          const name = (box.querySelector('#sc-bname').value || '').trim() || DEFAULT_BOARD.name;
          try { await repo.put(COL_CFG, 'board', { name, categories }, '보드 설정'); } catch (e) { return false; }
          P.ui.toast('보드 설정을 저장했습니다.', 'ok');
          render();
        } }]
      });
    }

    /* ---------- 아침 브리핑 ---------- */
    function briefing() {
      const td = K.today();
      const tm = K.addDays(td, 1);
      const occ = occurrences(events());
      const todayList = occ.get(td) || [];
      const live = todayList.filter((o) => !o.e.cancelled);
      const tomorrow = (occ.get(tm) || []).filter((o) => !o.e.cancelled);
      const fmt = (o) => ' · ' + evTime(o.e) + (o.total > 1 ? '(' + o.n + '/' + o.total + '일차)' : '') + ' ' + o.e.title + (o.e.place ? ' (' + o.e.place + ')' : '') + (o.e.owner ? ' - ' + o.e.owner : '');
      const lines = ['■ ' + board().name + ' ' + K.md(td) + ' 아침 브리핑', '', '▶ 오늘 일정 ' + live.length + '건'];
      lines.push(...(live.length ? live.map(fmt) : [' · 없음']));
      todayList.filter((o) => o.e.cancelled).forEach((o) => lines.push(' · [취소] ' + o.e.title + (o.e.cancelReason ? ' - ' + o.e.cancelReason : '')));
      lines.push('', '▶ 내일(' + K.md(tm) + ') 일정 ' + tomorrow.length + '건');
      const open = tasks().filter((x) => x.status !== '완료' && x.status !== '보류' && x.due && !x.linked);
      const over = open.filter((x) => x.due < td);
      const dueToday = open.filter((x) => x.due === td);
      const soon = open.filter((x) => x.due > td && K.diffDays(td, x.due) <= 3);
      lines.push('', '▶ 업무 기한  지남 ' + over.length + '건 · 오늘 ' + dueToday.length + '건 · 3일 이내 ' + soon.length + '건');
      const row = (x, tag) => ' · [' + tag + '] ' + x.title + (x.owner ? ' (' + x.owner + ')' : '') + ' ' + K.md(x.due);
      over.sort((a, b) => a.due.localeCompare(b.due)).forEach((x) => lines.push(row(x, '지남')));
      dueToday.forEach((x) => lines.push(row(x, '오늘')));
      soon.sort((a, b) => a.due.localeCompare(b.due)).forEach((x) => lines.push(row(x, dLabel(x.due))));
      K.shareText('아침 브리핑', lines.join('\n'));
    }

    /* ---------- 내보내기 · 가져오기 ---------- */
    const clean = (o) => { const c = Object.assign({}, o); delete c.updatedAt; return c; };
    function exportJSON() {
      const payload = { format: 'schedule-board', exportedAt: new Date().toISOString(), board: board(), events: events().map(clean), tasks: repo.all(COL_TASK).map(clean) };
      P.ui.download('schedule-board-' + K.stamp() + '.json', JSON.stringify(payload, null, 1), 'application/json');
      P.ui.toast('일정 ' + payload.events.length + '·업무 ' + payload.tasks.length + '건을 내보냈습니다.', 'ok');
    }
    async function importJSON() {
      const data = await K.readJSONFile();
      if (!data) return;
      if (data.format !== 'schedule-board') { P.ui.toast('부서 스케줄러 내보내기 파일이 아닙니다.', 'error'); return; }
      const arr = (a) => (Array.isArray(a) ? a.filter((x) => x && typeof x === 'object' && x.title) : []);
      const evs = arr(data.events).filter((e) => K.isDate(e.date));
      const tks = arr(data.tasks);
      const pss = arr(data.personal).length;
      if (!(await P.ui.confirm('일정 ' + evs.length + '건, 업무 ' + tks.length + '건을 가져옵니다.\n같은 항목은 파일 내용으로 덮어씁니다.' + (data.board ? '\n보드 이름·구분도 파일 설정으로 바뀝니다.' : '') + (pss ? '\n예전 개인업무 ' + pss + '건은 내 일정 → 가져오기에서 같은 파일로 옮길 수 있습니다.' : ''), { okLabel: '가져오기' }))) return;
      const ch = [];
      const add = (col, list) => list.forEach((x) => ch.push({ col, id: String(x.id || P.store.uid()), data: x }));
      add(COL_EV, evs);
      add(COL_TASK, tks);
      if (data.board && Array.isArray(data.board.categories)) ch.push({ col: COL_CFG, id: 'board', data: { name: String(data.board.name || DEFAULT_BOARD.name), categories: data.board.categories } });
      try { await repo.apply('가져오기', ch); } catch (e) { return; }
      P.ui.toast((evs.length + tks.length) + '건을 가져왔습니다.', 'ok');
      render();
    }
    function exportCSV() {
      // 엑셀 수식 주입 방지: =, +, @, - 로 시작하는 글은 앞에 ' 를 붙인다
      const q = (v) => { let t = String(v == null ? '' : v); if (/^[=+@\t\r]|^-\D/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
      const rows = [['시작일', '종료일', '시작', '종료', '제목', '구분', '장소', '담당', '메모', '상태']].concat(
        events().slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.start || '').localeCompare(String(b.start || '')))
          .map((e) => [e.date, endOf(e), e.allDay ? '종일' : e.start, e.allDay ? '' : e.end, e.title, sortTags(e.tags).join(' '), e.place, e.owner, e.note, e.cancelled ? '취소' + (e.cancelReason ? '(' + e.cancelReason + ')' : '') : '']));
      P.ui.download('schedule-events-' + K.stamp() + '.csv', new Blob(['﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
      P.ui.toast('일정 ' + (rows.length - 1) + '건을 CSV(엑셀용)로 내보냈습니다.', 'ok');
    }

    async function addSample() {
      const td = K.today();
      const ev = (o, title, tags, start, end, extra) => ({ col: COL_EV, id: P.store.uid(), data: Object.assign({ title, date: K.addDays(td, o), endDate: '', allDay: !start, start: start || '', end: end || '', tags, place: '', owner: '', note: '' }, extra || {}) });
      const tk = (title, category, owner, due, status, progress, detail) => ({ col: COL_TASK, id: P.store.uid(), data: { title, category, owner, due: due == null ? '' : K.addDays(td, due), status, progress, detail } });
      await repo.apply('예시 데이터', [
        ev(0, '주간 업무 회의', ['회의'], '09:00', '10:00', { place: '2층 회의실', owner: '총괄' }),
        ev(0, '신규 직원 실무 교육', ['교육'], '14:00', '17:00', { place: '교육장', owner: '김민지' }),
        ev(1, '하반기 사업 성과 보고', [MAJOR, '보고'], '10:00', '11:00', { place: '대회의실', owner: '이준호', note: '보고서 최종본 공유' }),
        ev(2, '현장 점검 출장', ['출장'], '', '', { endDate: K.addDays(td, 3), place: '관할 지역', owner: '박서연' }),
        ev(-2, '유관기관 업무 협의', ['방문'], '15:00', '16:00', { place: '협력기관', owner: '최유나' }),
        ev(5, '연말 행사 준비 회의', ['행사', '회의'], '16:00', '17:00', { place: '소회의실', owner: '김민지' }),
        tk('내년도 예산 요구서 작성', MAJOR, '이준호', 4, '진행', 60, '부서별 요구액 취합 후 검토'),
        tk('업무 매뉴얼 개정', '교육', '김민지', -1, '진행', 80, ''),
        tk('민원 처리 현황 정리', '보고', '박서연', 0, '예정', 0, '월간 통계 포함'),
        tk('장비 점검 결과 보고', '기타', '최유나', null, '보류', 30, ''),
        tk('상반기 실적 보고서', MAJOR, '이준호', -10, '완료', 100, '')
      ]);
      P.ui.toast('예시 데이터를 넣었습니다. 실행 취소(Ctrl+Z)로 되돌릴 수 있습니다.', 'ok');
      render();
    }

    /* ---------- 동작 ---------- */
    function setTab(tab) {
      if (st.tab === tab) { if (tab === 'events') setEvView(st.evView === 'cal' ? 'list' : 'cal'); return; }
      st.tab = tab;
      P.settings.set('schedule.tab', tab);
      try { history.replaceState(null, '', '#/schedule/' + tab); } catch (e) { /* 무시 */ }
      render();
    }
    function setTasksView(v) {
      st.tView = v === 'table' ? 'table' : 'board';
      P.settings.set('schedule.tasksView', st.tView);
      render();
    }
    function setEvView(v) {
      st.evView = v;
      P.settings.set('schedule.evView', v);
      if (st.tab !== 'events') { setTab('events'); return; }
      render();
    }
    async function doUndo(redo) {
      const label = await (redo ? repo.redo() : repo.undo());
      if (label) { P.ui.toast((redo ? '다시 실행: ' : '실행 취소: ') + label, 'info'); render(); }
    }
    async function toggleTask(id) {
      const x = repo.get(COL_TASK, id);
      if (!x) return;
      const done = x.status !== '완료';
      await repo.put(COL_TASK, id, Object.assign({}, x, done ? { status: '완료', progress: 100, prevProgress: x.progress } : { status: '진행', progress: x.prevProgress != null && x.prevProgress < 100 ? x.prevProgress : 90 }), done ? '업무 완료' : '완료 되돌리기');
      P.ui.toast(done ? '완료로 표시했습니다.' : '진행으로 되돌렸습니다.', 'ok');
      render();
    }

    /* ---------- 상황판: 상태 옮기기 (끌어 놓기 · 키보드 · 메뉴) ---------- */
    const TO = { 예정: '예정으로', 진행: '진행으로', 완료: '완료로', 보류: '보류로' };
    async function setStatus(id, s, focus) {
      const x = repo.get(COL_TASK, id);
      if (!x || (x.status || '예정') === s || !STATUSES.includes(s)) return false;
      const patch = { status: s };
      if (s === '완료') { patch.progress = 100; patch.prevProgress = x.progress; }
      else if (x.status === '완료') patch.progress = x.prevProgress != null && x.prevProgress < 100 ? x.prevProgress : 90;
      try { await repo.put(COL_TASK, id, Object.assign({}, x, patch), '상태 옮기기'); } catch (e) { return false; }
      P.ui.toast('\'' + x.title + '\' ' + TO[s] + ' 옮겼습니다. (Ctrl+Z 실행 취소)', 'ok');
      render();
      const card = page.querySelector('.sc-mag[data-card="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
      if (card) {
        if (K.motionOK()) { card.classList.add('is-dropped'); setTimeout(() => card.classList.remove('is-dropped'), 700); }
        if (focus) { const b = card.querySelector('.sc-task-open'); if (b) b.focus(); }
        card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      return true;
    }
    function cardMenu(anchor, id) {
      const x = repo.get(COL_TASK, id);
      if (!x) return;
      const cur = x.status || '예정';
      K.popMenu(anchor, STATUSES.filter((s) => s !== cur).map((s) => ({ label: TO[s] + ' 옮기기', desc: '상태 옮기기 · ' + COL_HINT[s], icon: K.IC.move, onClick: () => setStatus(id, s, true) }))
        .concat([{ label: '열기', desc: '업무 내용 고치기', icon: P.icons.edit, onClick: () => openTask(id) }]));
    }
    let drag = null;
    let dropAt = 0;
    function dragEnd(commit) {
      const g = drag;
      drag = null;
      window.removeEventListener('pointermove', dragMove);
      window.removeEventListener('pointerup', dragUp);
      window.removeEventListener('pointercancel', dragCancel);
      document.removeEventListener('keydown', dragKey, true);
      if (!g || !g.on) return;
      dropAt = Date.now();
      document.documentElement.classList.remove('sc-dragging');
      g.ghost.remove();
      g.card.classList.remove('is-lifted');
      page.querySelectorAll('.sc-col.is-over').forEach((c) => c.classList.remove('is-over'));
      if (commit && g.over && g.over !== g.card.dataset.st) setStatus(g.id, g.over, false);
    }
    function dragMove(ev) {
      const g = drag;
      if (!g || ev.pointerId !== g.pid) return;
      const dx = ev.clientX - g.x0;
      const dy = ev.clientY - g.y0;
      if (!g.on) {
        if (Math.hypot(dx, dy) < 6) return;
        g.on = true;
        const r = g.card.getBoundingClientRect();
        g.ox = g.x0 - r.left;
        g.oy = g.y0 - r.top;
        g.ghost = g.card.cloneNode(true);
        g.ghost.classList.add('sc-ghost');
        g.ghost.removeAttribute('data-card');
        g.ghost.setAttribute('aria-hidden', 'true');
        g.ghost.style.width = r.width + 'px';
        document.body.appendChild(g.ghost);
        g.card.classList.add('is-lifted');
        document.documentElement.classList.add('sc-dragging');
      }
      ev.preventDefault();
      g.ghost.style.transform = 'translate3d(' + (ev.clientX - g.ox) + 'px,' + (ev.clientY - g.oy) + 'px,0)';
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const col = under && under.closest('.sc-col');
      const s = col && page.contains(col) ? col.dataset.col : null;
      if (s !== g.over) {
        page.querySelectorAll('.sc-col.is-over').forEach((c) => c.classList.remove('is-over'));
        if (col && s !== g.card.dataset.st) col.classList.add('is-over');
        g.over = s;
      }
    }
    const dragUp = (ev) => { if (drag && ev.pointerId === drag.pid) dragEnd(true); };
    const dragCancel = () => dragEnd(false);
    const dragKey = (ev) => { if (ev.key === 'Escape' && drag && drag.on) { ev.preventDefault(); ev.stopPropagation(); dragEnd(false); } };
    page.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0 || ev.pointerType === 'touch' || drag) return;
      const card = ev.target.closest('.sc-mag');
      if (!card || card.classList.contains('linked') || ev.target.closest('.sc-task-act')) return;
      drag = { card, id: card.dataset.card, pid: ev.pointerId, x0: ev.clientX, y0: ev.clientY, on: false, over: null };
      window.addEventListener('pointermove', dragMove);
      window.addEventListener('pointerup', dragUp);
      window.addEventListener('pointercancel', dragCancel);
      document.addEventListener('keydown', dragKey, true);
    });

    page.addEventListener('click', (ev) => {
      const t = ev.target.closest('button, .sch-cal-day');
      if (!t || !page.contains(t)) return;
      if (Date.now() - dropAt < 350) return; // 끌어 놓은 직후의 클릭은 무시
      const d = t.dataset;
      if (d.act === 'new') openNew();
      else if (d.act === 'brief') briefing();
      else if (d.act === 'undo') doUndo(false);
      else if (d.act === 'redo') doUndo(true);
      else if (d.act === 'past') { st.showPast = !st.showPast; renderBody(); }
      else if (d.act === 'done-fold') { st.showDone = !st.showDone; renderBody(); }
      else if (d.act === 'sample') addSample();
      else if (d.act === 'clear-cats') { st.cats[st.tab].clear(); renderFilter(); renderBody(); }
      else if (d.act === 'more') {
        K.popMenu(t, [
          { label: '보드 설정', desc: '보드 이름 · 구분 목록과 색', icon: P.icons.gear, onClick: openSettings },
          { label: '일정 CSV 내보내기', desc: '엑셀에서 열기', icon: P.icons.download, onClick: exportCSV },
          { label: '보드 내보내기', desc: '일정·업무 JSON 백업', icon: P.icons.download, onClick: exportJSON },
          { label: '보드 가져오기', desc: '내보낸 JSON 파일', icon: P.icons.upload, onClick: importJSON }
        ]);
      } else if (d.tab) setTab(d.tab);
      else if (d.evView) setEvView(d.evView);
      else if (d.tasksView) setTasksView(d.tasksView);
      else if (d.cardMenu) cardMenu(t, d.cardMenu);
      else if (d.cat != null) {
        const set = st.cats[st.tab];
        if (set.has(d.cat)) set.delete(d.cat); else set.add(d.cat);
        renderFilter();
        renderBody();
      } else if (d.status) { st.status = d.status; renderFilter(); renderBody(); }
      else if (d.cal != null) { st.cal = d.cal === '0' ? K.today() : K.addMonths(st.cal, Number(d.cal)); renderBody(); }
      else if (d.newDay) openEvent(null, { date: d.newDay });
      else if (d.ev) openEvent(d.ev);
      else if (d.task) openTask(d.task);
      else if (d.done) toggleTask(d.done);
      else if (t.classList.contains('sch-cal-day')) {
        if (st.cal === d.day && !st.narrow) openEvent(null, { date: d.day });
        else { st.cal = d.day; renderBody(); }
      }
    });
    page.addEventListener('change', async (ev) => {
      const t = ev.target;
      if (t.hasAttribute('data-owner')) { st.owner = t.value; renderBody(); }
    });
    let searchTimer = null;
    page.addEventListener('input', (ev) => {
      if (!ev.target.hasAttribute('data-search')) return;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { st.q = ev.target.value; renderBody(); }, 160);
    });
    page.addEventListener('keydown', (ev) => {
      if (ev.target.hasAttribute('data-search') && ev.key === 'Escape') { ev.target.value = ''; st.q = ''; renderBody(); ev.target.blur(); return; }
      const card = ev.target.closest && ev.target.matches('.sc-task-open[data-task]') ? ev.target.closest('.sc-mag') : null;
      if (card && ev.altKey && !ev.ctrlKey && !ev.metaKey && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
        ev.preventDefault();
        const i = STATUSES.indexOf(card.dataset.st) + (ev.key === 'ArrowRight' ? 1 : -1);
        if (i >= 0 && i < STATUSES.length) setStatus(card.dataset.card, STATUSES[i], true);
      } else if (card && (ev.key === 'ContextMenu' || (ev.shiftKey && ev.key === 'F10'))) {
        ev.preventDefault();
        cardMenu(card.querySelector('[data-card-menu]') || ev.target, card.dataset.card);
      }
    });
    page.addEventListener('submit', (ev) => ev.preventDefault());

    function onKey(ev) {
      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !K.isTyping(ev)) {
        const k = ev.key.toLowerCase();
        if (k === 'z' && !ev.shiftKey) { ev.preventDefault(); doUndo(false); }
        else if (k === 'y' || (k === 'z' && ev.shiftKey)) { ev.preventDefault(); doUndo(true); }
        return;
      }
      if (ev.ctrlKey || ev.metaKey || ev.altKey || K.isTyping(ev)) return;
      const k = ev.key.toLowerCase();
      if (k === 'n') { ev.preventDefault(); openNew(); }
      else if (k === 'c') { ev.preventDefault(); setEvView(st.tab === 'events' && st.evView === 'cal' ? 'list' : 'cal'); }
      else if (ev.key === '/') { ev.preventDefault(); const s = page.querySelector('[data-search]'); if (s) { s.focus(); s.select(); } }
      else if (k === '1' || k === '2') { ev.preventDefault(); setTab(TABS[Number(k) - 1][0]); }
      else if (k === 'b' && st.tab === 'tasks') { ev.preventDefault(); setTasksView(st.tView === 'board' ? 'table' : 'board'); }
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
      const id = ctx.params[1];
      if (id) {
        if (st.tab === 'events' && repo.get(COL_EV, id)) openEvent(id);
        else if (st.tab === 'tasks' && repo.get(COL_TASK, id)) openTask(id);
      }
    }, (e) => {
      page.innerHTML = '<div class="empty card"><h2>보드를 불러오지 못했습니다</h2><p class="muted">' + P.esc(e.message) + '</p><button type="button" class="btn btn-primary" onclick="location.reload()">다시 시도</button></div>';
    });

    return () => {
      dragEnd(false);
      clearTimeout(searchTimer);
      stopRefresh();
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }

  P.registerApp({
    shared: true,
    id: 'schedule',
    title: '부서 스케줄러',
    short: '스케줄러',
    order: 2,
    desc: '부서 일정표 · 주요업무를 한 보드에서, 아침 브리핑 문구까지',
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M7.5 14h3M7.5 17.5h6"/></svg>',
    mount
  });
})();
