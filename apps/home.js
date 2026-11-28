/* 홈: 오늘의 결재판
   한 줄 명령(js/line.js · js/nl.js) + A4 한 장짜리 '오늘의 업무' 문서 + 도장으로 처리 + 시간대(아침 브리핑 · 근무 중 · 업무 마감 보고) + 이어하기(js/resume.js)
   도장: 업무는 상태 '완료', 할 일은 완료, 일정은 확인 표시(이 기기 전용 home-stamps) */
(function () {
  'use strict';
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>';
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  const MK = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];
  const CLOSED = ['완료', '보류'];
  const STAMPS = 'home-stamps';
  const MINE_EV = 'my-schedule-events';
  const MINE_TODO = 'my-schedule-todos';
  const RECENT = [['docs', '문서', 'DOC'], ['slides', 'PT', 'PPT'], ['sheets', '시트', 'XLS'], ['charts', '차트', 'CHT']];
  const DEF_SIGN = ['담당', '팀장', '과장'];
  const PHASES = [['am', '아침'], ['work', '근무'], ['pm', '마감']];
  if (P.store.local && P.store.local.mark) P.store.local.mark([STAMPS]);

  const esc = (s) => P.esc(s);
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseYmd = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const isDate = (s) => !!parseYmd(s);
  const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
  const dayDiff = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
  const isHM = (s) => /^\d{2}:\d{2}$/.test(String(s || ''));
  const toMin = (s) => (isHM(s) ? +s.slice(0, 2) * 60 + +s.slice(3) : -1);
  const obj = (x) => (x && typeof x === 'object' ? x : {});
  const localDay = (iso) => { const t = Date.parse(iso); return t ? ymd(new Date(t)) : ''; };
  const md = (s) => { const d = parseYmd(s); return d ? (d.getMonth() + 1) + '/' + d.getDate() + '(' + WEEK[d.getDay()] + ')' : ''; };
  const longDate = (s) => { const d = parseYmd(s); return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.(' + WEEK[d.getDay()] + ')'; };
  const safeColor = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '');
  const colName = (c) => { let s = ''; c += 1; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
  const fmtDur = (m) => (m < 60 ? m + '분' : Math.floor(m / 60) + '시간' + (m % 60 ? ' ' + (m % 60) + '분' : ''));
  const hash = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; };
  const rot = (key) => (hash(key) % 19) - 11; // 도장 기울기 -11 ~ +7도
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

  /* ---------- 설정 ---------- */
  function signLabels() {
    const v = P.settings.get('home.sign', null);
    return Array.isArray(v) && v.length >= 2 ? v.slice(0, 5).map((x) => String(x).slice(0, 4)) : DEF_SIGN;
  }
  function hours() {
    const a = P.settings.get('home.in', '09:00');
    const b = P.settings.get('home.out', '18:00');
    const inM = toMin(a) >= 0 ? toMin(a) : 540;
    const outM = toMin(b) > inM ? toMin(b) : 1080;
    return { inM, outM, in: isHM(a) ? a : '09:00', out: isHM(b) ? b : '18:00' };
  }
  function autoPhase(now) {
    const h = hours();
    const m = now.getHours() * 60 + now.getMinutes();
    if (m < h.inM + 60) return 'am';
    if (m >= h.outM - 30) return 'pm';
    return 'work';
  }
  let viewPhase = null; // 사용자가 고른 보기(이 화면을 다시 열면 자동으로)

  /* ---------- 자료 ---------- */
  async function loadRaw(has) {
    const L = P.store.local || P.store;
    const safe = (p) => Promise.resolve(p).then((r) => (Array.isArray(r) ? r : []), () => []);
    const [head, cfg, dev, tasks, myev, todos, stamps, ...rec] = await Promise.all([
      has('head-schedule') ? safe(P.store.list('head-schedule')) : [],
      has('head-schedule') ? safe(P.store.list('head-schedule-config')).then((rows) => { const r = rows.find((x) => x.id === 'people'); return r ? r.data : null; }) : null,
      has('schedule') ? safe(P.store.list('schedule-events')) : [],
      has('schedule') ? safe(P.store.list('schedule-tasks')) : [],
      has('my-schedule') ? safe(L.list(MINE_EV)) : [],
      has('my-schedule') ? safe(L.list(MINE_TODO)) : [],
      safe(L.list(STAMPS))
    ].concat(RECENT.map(([c]) => (has(c) ? safe(P.store.list(c)) : []))));
    return { head, people: cfg && Array.isArray(cfg.people) ? cfg.people.filter((p) => p && p.id) : [], dev, tasks, myev, todos, stamps, rec };
  }

  function buildModel(raw, now) {
    const td = ymd(now);
    const nowM = now.getHours() * 60 + now.getMinutes();
    const stampSet = new Map(raw.stamps.map((r) => [r.id, r]));
    const endOf = (e) => (e.endDate && e.endDate > e.date ? e.endDate : e.date);
    const inDay = (e, d) => isDate(e.date) && e.date <= d && d <= endOf(e);
    const person = (id) => raw.people.find((p) => p.id === id);
    const byKey = new Map();

    function eventsOn(d) {
      const out = [];
      const push = (src, tag, r, href, who, color) => {
        const e = Object.assign({}, obj(r.data), { id: r.id });
        if (e.cancelled || !inDay(e, d)) return;
        const timed = !e.allDay && isHM(e.start) && e.date === d;
        const key = d + '|' + src + '|' + e.id;
        const it = {
          type: 'event', key, src, tag, id: e.id, raw: e, title: e.title || '제목 없음', timed, start: timed ? e.start : '', end: timed && isHM(e.end) ? e.end : '',
          span: endOf(e) !== e.date ? (dayDiff(e.date, d) + 1) + '/' + (dayDiff(e.date, endOf(e)) + 1) + '일' : '종일',
          place: e.place || '', who: who(e), color: color(e), href, stamped: stampSet.has(key)
        };
        out.push(it);
      };
      raw.head.forEach((r) => push('head', '부서장', r, '#/head-schedule/' + encodeURIComponent(r.id), (e) => {
        const ps = (Array.isArray(e.heads) ? e.heads : []).map(person).filter(Boolean);
        return ps.length ? ps.map((p) => (p.name || '') + (p.title ? ' ' + p.title : '')).join(', ') : '공통';
      }, (e) => { const p = person((e.heads || [])[0]); return (p && safeColor(p.color)) || ''; }));
      raw.dev.forEach((r) => push('dept', '부서', r, '#/schedule/events/' + encodeURIComponent(r.id), (e) => e.owner || '', () => ''));
      raw.myev.forEach((r) => push('mine', '내 일정', r, '#/my-schedule/today/' + encodeURIComponent(r.id), () => '', () => ''));
      out.sort((a, b) => (a.timed - b.timed) || a.start.localeCompare(b.start) || a.title.localeCompare(b.title, 'ko'));
      return out;
    }
    const events = eventsOn(td);
    events.forEach((it) => {
      if (!it.timed) { it.state = 'day'; return; }
      const s = toMin(it.start);
      const e = it.end ? toMin(it.end) : s + 60;
      it.state = e <= nowM ? 'past' : s <= nowM ? 'now' : 'next';
      it.endM = e;
      it.startM = s;
    });

    const dow = parseYmd(td).getDay();
    const weekEnd = addDays(td, (7 - dow) % 7);
    const tasks = raw.tasks.map((r) => Object.assign({}, obj(r.data), { id: r.id, updatedAt: r.updatedAt }))
      .filter((x) => isDate(x.due) && x.due <= weekEnd && (!CLOSED.includes(x.status) || (x.status === '완료' && (x.stampedAt === td || localDay(x.updatedAt) === td))))
      .map((x) => ({
        type: 'task', key: 'task|' + x.id, id: x.id, raw: x, title: x.title || '제목 없음', due: x.due, owner: x.owner || '',
        progress: Math.max(0, Math.min(100, Number(x.progress) || 0)), stamped: x.status === '완료',
        group: x.due < td ? 'over' : x.due === td ? 'today' : 'week', href: '#/schedule/tasks/' + encodeURIComponent(x.id)
      }))
      .sort((a, b) => (a.stamped - b.stamped) || a.due.localeCompare(b.due) || a.title.localeCompare(b.title, 'ko'));
    const todos = raw.todos.map((r) => Object.assign({}, obj(r.data), { id: r.id }))
      .filter((x) => (!x.done && isDate(x.due) && x.due <= td) || (x.done && localDay(x.doneAt) === td))
      .map((x) => ({ type: 'todo', key: 'todo|' + x.id, id: x.id, raw: x, title: x.title || '제목 없음', due: x.due || td, stamped: !!x.done, href: '#/my-schedule/todos/' + encodeURIComponent(x.id) }))
      .sort((a, b) => (a.stamped - b.stamped) || a.due.localeCompare(b.due) || a.title.localeCompare(b.title, 'ko'));

    [events, tasks, todos].forEach((l) => l.forEach((it) => byKey.set(it.key, it)));
    const counted = events.concat(tasks.filter((t) => t.group !== 'week' || t.stamped), todos);
    const done = counted.filter((x) => x.stamped);

    // 넘겨받기: 지난 근무일 ~ 어제
    let prev = addDays(td, -1);
    while ([0, 6].includes(parseYmd(prev).getDay()) && dayDiff(prev, td) < 3) prev = addDays(prev, -1);
    const carry = [];
    raw.todos.forEach((r) => { const x = obj(r.data); if (!x.done && isDate(x.due) && x.due >= prev && x.due < td) carry.push({ type: 'todo', id: r.id, raw: x, title: x.title || '제목 없음', when: md(x.due), movable: true }); });
    raw.myev.forEach((r) => {
      const e = obj(r.data);
      if (!isDate(e.date) || e.date < prev || e.date >= td || (e.endDate && e.endDate >= td)) return;
      if (stampSet.has(e.date + '|mine|' + r.id)) return;
      carry.push({ type: 'mine', id: r.id, raw: e, title: e.title || '제목 없음', when: md(e.date) + (e.allDay || !e.start ? '' : ' ' + e.start), movable: true });
    });
    raw.tasks.forEach((r) => { const x = obj(r.data); if (!CLOSED.includes(x.status) && isDate(x.due) && x.due >= prev && x.due < td) carry.push({ type: 'task', id: r.id, raw: x, title: x.title || '제목 없음', when: '기한 ' + md(x.due), movable: false, href: '#/schedule/tasks/' + encodeURIComponent(r.id) }); });

    // 최근 작업
    const recent = [];
    RECENT.forEach(([c, name, g], i) => (raw.rec[i] || []).forEach((r) => {
      if (!r || r.id == null) return;
      const d = obj(r.data);
      recent.push({ col: c, name, g, id: String(r.id), title: d.title || d.name || '제목 없음', updatedAt: r.updatedAt || '', pages: d.pages, slides: d.slideCount });
    }));
    recent.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const last = P.resume ? P.resume.last() : null;
    let lastItem = null;
    if (last) {
      lastItem = recent.find((r) => r.col === last.app && r.id === last.id) || null;
      if (lastItem) { recent.splice(recent.indexOf(lastItem), 1); recent.unshift(lastItem); lastItem.state = last.state; lastItem.at = last.at; }
    }

    const tomorrow = eventsOn(addDays(td, 1));
    return { td, nowM, events, tasks, todos, byKey, counted, done, carry, prev, recent: recent.slice(0, 5), lastItem, tomorrow, weekEnd };
  }

  /* ---------- 글 ---------- */
  const lineOf = (it) => (it.type === 'event' ? (it.timed ? it.start + ' ' : '') + it.title + (it.src !== 'mine' ? ' (' + it.tag + ')' : '') : it.type === 'task' ? it.title + ' (업무, 기한 ' + md(it.due) + ')' : it.title + ' (할 일)');
  function briefText(M) {
    const L = ['[아침 브리핑] ' + longDate(M.td)];
    L.push('1. 오늘 일정 ' + M.events.length + '건');
    M.events.forEach((e) => L.push('  - ' + (e.timed ? e.start + (e.end ? '~' + e.end : '') : e.span) + ' ' + e.title + (e.place ? ' / ' + e.place : '') + (e.src === 'head' ? ' (' + e.who + ')' : '')));
    const due = M.tasks.filter((t) => !t.stamped);
    L.push('2. 마감 업무 ' + due.length + '건');
    due.forEach((t) => L.push('  - ' + t.title + ' (' + (t.group === 'over' ? dayDiff(t.due, M.td) + '일 지남' : t.group === 'today' ? '오늘' : md(t.due)) + ')'));
    const td = M.todos.filter((t) => !t.stamped);
    L.push('3. 할 일 ' + td.length + '건');
    td.forEach((t) => L.push('  - ' + t.title));
    return L.join('\n');
  }
  function closeText(M) {
    const ok = M.done, left = M.counted.filter((x) => !x.stamped);
    const L = ['[업무 마감 보고] ' + longDate(M.td), '처리 ' + ok.length + ' / ' + M.counted.length + '건'];
    L.push('■ 완료 ' + ok.length + '건');
    ok.forEach((x) => L.push(' - ' + lineOf(x)));
    L.push('■ 미완료 ' + left.length + '건');
    left.forEach((x) => L.push(' - ' + lineOf(x)));
    if (M.tomorrow.length) {
      L.push('■ 내일 일정 ' + M.tomorrow.length + '건');
      M.tomorrow.forEach((e) => L.push(' - ' + (e.timed ? e.start + ' ' : '') + e.title));
    }
    return L.join('\n');
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* 아래 방식 */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;opacity:0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch (e) { return false; }
  }

  /* ---------- 그리기 조각 ---------- */
  function stampBtn(it, anim) {
    const verb = it.type === 'event' ? '확인' : '완료';
    const d = parseYmd(it.type === 'event' ? it.key.slice(0, 10) : ymd(new Date()));
    return '<button type="button" class="hm-stamp' + (anim ? ' is-anim' : '') + '" data-stamp="' + esc(it.key) + '" aria-pressed="' + it.stamped + '" aria-label="' + esc(it.title) + ' ' + verb + ' 도장" title="' + (it.stamped ? '도장 거두기' : verb + ' 도장 찍기') + '">' +
      '<span class="hm-stamp-h" aria-hidden="true">' + verb + '</span><span class="hm-seal" style="--r:' + rot(it.key) + 'deg" aria-hidden="true"><b>' + verb + '</b><small>' + (d.getMonth() + 1) + '.' + d.getDate() + '</small></span></button>';
  }
  function evRow(it, i, anim) {
    const when = it.timed ? '<span class="hm-when num">' + esc(it.start) + (it.end ? '<small>' + esc(it.end) + '</small>' : '') + '</span>' : '<span class="hm-when hm-when-day">' + esc(it.span) + '</span>';
    const meta = [it.who, it.place].filter(Boolean).join(' · ');
    return '<li class="hm-row is-' + it.state + (it.stamped ? ' is-stamped' : '') + (anim ? ' is-thud' : '') + '" data-key="' + esc(it.key) + '"' + (it.color ? ' style="--c:' + it.color + '"' : '') + '>' +
      '<span class="hm-mk" aria-hidden="true">' + MK[i % MK.length] + '.</span>' + when +
      '<a class="hm-body" href="' + it.href + '"><span class="hm-line1"><span class="hm-tag is-' + it.src + '">' + esc(it.tag) + '</span><b class="hm-t">' + esc(it.title) + '</b>' + (it.state === 'now' ? '<span class="hm-live">진행 중</span>' : '') + '</span>' +
      (meta ? '<small class="hm-m">' + esc(meta) + '</small>' : '') + '</a>' + stampBtn(it, anim) + '</li>';
  }
  function taskRow(it, i, M, anim) {
    const b = it.stamped ? '<span class="hm-when hm-when-day">처리</span>' : it.group === 'over' ? '<span class="hm-when hm-over">' + dayDiff(it.due, M.td) + '일 지남</span>' : it.group === 'today' ? '<span class="hm-when hm-today">오늘</span>' : '<span class="hm-when hm-when-day num">D-' + dayDiff(M.td, it.due) + '</span>';
    const meta = [it.owner, '기한 ' + md(it.due), it.progress ? '진척 ' + it.progress + '%' : ''].filter(Boolean).join(' · ');
    return '<li class="hm-row' + (it.stamped ? ' is-stamped' : '') + (anim ? ' is-thud' : '') + '" data-key="' + esc(it.key) + '">' +
      '<span class="hm-mk" aria-hidden="true">' + MK[i % MK.length] + '.</span>' + b +
      '<a class="hm-body" href="' + it.href + '"><span class="hm-line1"><b class="hm-t">' + esc(it.title) + '</b></span><small class="hm-m">' + esc(meta) + '</small></a>' + stampBtn(it, anim) + '</li>';
  }
  function todoRow(it, i, M, anim) {
    const over = !it.stamped && it.due < M.td;
    const b = it.stamped ? '<span class="hm-when hm-when-day">처리</span>' : over ? '<span class="hm-when hm-over">' + dayDiff(it.due, M.td) + '일 지남</span>' : '<span class="hm-when hm-today">오늘</span>';
    return '<li class="hm-row' + (it.stamped ? ' is-stamped' : '') + (anim ? ' is-thud' : '') + '" data-key="' + esc(it.key) + '">' +
      '<span class="hm-mk" aria-hidden="true">' + MK[i % MK.length] + '.</span>' + b +
      '<a class="hm-body" href="' + it.href + '"><span class="hm-line1"><b class="hm-t">' + esc(it.title) + '</b></span><small class="hm-m">이 기기에만 저장</small></a>' + stampBtn(it, anim) + '</li>';
  }
  function resumeInfo(r) {
    const s = r && r.state ? r.state : null;
    if (!s) return '';
    if (r.col === 'slides' && s.slide != null) return '슬라이드 ' + (s.slide + 1) + (s.of ? ' / ' + s.of : '');
    if (r.col === 'sheets' && s.r != null) return (s.sheet ? (s.sheet + 1) + '번째 시트 · ' : '') + colName(s.c || 0) + ((s.r || 0) + 1) + ' 셀';
    if (r.col === 'docs' && (s.scroll > 40 || s.caret > 0)) return '쓰던 자리';
    return '';
  }
  function docRow(r, i, M) {
    const isLast = M.lastItem === r;
    const info = isLast ? resumeInfo(r) : '';
    const meta = [r.name, relTime(r.updatedAt), info].filter(Boolean).join(' · ');
    return '<li class="hm-row hm-doc' + (isLast ? ' is-last' : '') + '">' +
      '<span class="hm-mk" aria-hidden="true">' + MK[i % MK.length] + '.</span>' +
      '<span class="hm-glyph" data-t="' + esc(r.col) + '" aria-hidden="true">' + r.g + '</span>' +
      '<a class="hm-body" href="#/' + esc(r.col) + '/' + encodeURIComponent(r.id) + '"><span class="hm-line1">' + (isLast ? '<span class="hm-tag is-last">마지막 작업</span>' : '') + '<b class="hm-t">' + esc(r.title) + '</b></span><small class="hm-m">' + esc(meta) + '</small></a>' +
      '<button type="button" class="btn btn-sm hm-resume-btn" data-resume="' + esc(r.col) + '|' + esc(r.id) + '" aria-label="' + esc(r.title) + ' 이어하기">이어하기</button></li>';
  }
  const emptyRow = (text, act) => '<li class="hm-empty">' + esc(text) + (act || '') + '</li>';

  function signHTML(M, labels, newly) {
    const total = M.counted.length;
    const n = labels.length;
    const pct = total ? M.done.length / total : 0;
    const cells = labels.map((lab, i) => {
      const th = (i + 1) / n;
      const filled = total > 0 && pct >= th - 1e-9;
      const part = !filled && pct > i / n ? (pct - i / n) * n : 0;
      const inner = filled ? '<span class="hm-sign-seal' + (newly.has(i) ? ' is-anim' : '') + '" style="--r:' + (rot(lab + i) / 1.5).toFixed(1) + 'deg"><b>' + esc(lab) + '</b></span>'
        : part ? '<span class="hm-sign-part" title="이 칸까지 ' + Math.max(1, Math.ceil(th * total - M.done.length)) + '건 남음">-' + Math.max(1, Math.ceil(th * total - M.done.length)) + '</span>' : '';
      return '<td>' + inner + '</td>';
    }).join('');
    const label = total ? '결재란: 오늘 ' + total + '건 중 ' + M.done.length + '건 결재, ' + Math.round(pct * 100) + '퍼센트' : '결재란: 오늘 결재할 일이 없습니다';
    return '<table class="hm-sign" role="img" aria-label="' + esc(label) + '"><tbody>' +
      '<tr><th class="hm-sign-k" rowspan="2" scope="row"><span>결</span><span>재</span></th>' + labels.map((l) => '<th scope="col">' + esc(l) + '</th>').join('') + '</tr>' +
      '<tr>' + cells + '</tr></tbody></table>';
  }

  /* ---------- 등록 ---------- */
  function mount(el) {
    const b = P.brand();
    const appIds = new Set(P.apps().map((a) => a.id));
    const has = (id) => appIds.has(id);
    let raw = null;
    let M = null;
    let anim = null;
    let prevFilled = -1;
    let loading = 0;
    let alive = true;
    const L = P.store.local || P.store;
    const MOD = /Mac|iPhone|iPad/i.test(navigator.platform || '') ? '⌘' : 'Ctrl';

    const now0 = new Date();
    el.innerHTML =
      '<div class="page hm"><h1 class="sr-only">' + esc(b.title) + ' 홈, 오늘의 결재판</h1>' +
      '<header class="hm-top">' +
      '<div class="hm-date"><time class="hm-day num" datetime="' + ymd(now0) + '">' + now0.getDate() + '</time>' +
      '<div class="hm-date-t"><b class="hm-date-md">' + (now0.getMonth() + 1) + '월 · ' + WEEK[now0.getDay()] + '요일</b><span class="hm-status"></span></div></div>' +
      '<div class="hm-view"><span class="hm-view-l" id="hm-view-l">보기</span><div class="seg hm-phase" role="radiogroup" aria-labelledby="hm-view-l">' +
      PHASES.map(([v, l]) => '<button type="button" role="radio" data-phase="' + v + '" aria-checked="false">' + l + '</button>').join('') + '</div></div>' +
      '</header>' +
      '<div class="hm-line" role="search">' +
      '<label class="hm-line-field"><span class="hm-line-ic" aria-hidden="true">' + P.icons.pen + '</span><span class="sr-only">한 줄 명령</span>' +
      '<input type="text" class="hm-line-in" autocomplete="off" spellcheck="false" enterkeyhint="done" aria-describedby="hm-line-pv hm-line-hint" placeholder="한 줄로 적으면 알아서 넣습니다. 예: 내일 3시 2층 회의실 국장님 업무보고">' +
      '<span class="hm-line-kbd" aria-hidden="true"><kbd class="kbd">/</kbd></span></label>' +
      '<div class="hm-line-pv ln-box" id="hm-line-pv"></div><span class="sr-only" aria-live="polite" id="hm-line-live"></span>' +
      '<p class="sr-only" id="hm-line-hint">Tab으로 넣을 곳을 바꾸고 Enter로 만듭니다. 어디서든 슬래시 또는 ' + MOD + '+J 로 엽니다.</p></div>' +
      '<div class="hm-grid"><aside class="hm-rail" aria-label="시간대 안내"></aside><div class="hm-main">' +
      '<article class="hm-paper" aria-labelledby="hm-doc-t" aria-busy="true">' + P.ui.skeleton(5) + '</article></div></div>' +
      '</div>';

    const input = el.querySelector('.hm-line-in');
    P.line.attach(input, el.querySelector('.hm-line-pv'), { live: el.querySelector('#hm-line-live'), empty: P.line.emptyHelp });
    const dayEl = el.querySelector('.hm-day');
    if (P.fx && P.fx.scrambleDaily) P.fx.scrambleDaily(dayEl, 'home-day', ymd(now0));

    const phaseNow = () => viewPhase || autoPhase(new Date());

    function statusHTML(now) {
      const ph = phaseNow();
      const kick = { am: '아침 브리핑', work: '근무 중', pm: '업무 마감' }[ph];
      if (!M) return '<em>' + kick + '</em>';
      let t = '';
      if (ph === 'am') t = '일정 ' + M.events.length + ' · 마감 ' + M.tasks.filter((x) => !x.stamped && x.group !== 'week').length + ' · 할 일 ' + M.todos.filter((x) => !x.stamped).length;
      else if (ph === 'pm') t = M.counted.length ? M.counted.length + '건 중 ' + M.done.length + '건 결재' : '오늘 결재할 일 없음';
      else {
        const nm = now.getHours() * 60 + now.getMinutes();
        const cur = M.events.find((e) => e.timed && e.startM <= nm && nm < e.endM);
        const next = M.events.find((e) => e.timed && e.startM > nm);
        if (cur) t = '지금 ' + cur.title + ' · ' + fmtDur(cur.endM - nm) + ' 남음';
        else if (next) t = '다음 ' + next.start + ' ' + next.title + ' · ' + fmtDur(next.startM - nm) + ' 뒤';
        else t = '남은 일정 없음';
      }
      return '<em>' + kick + '</em><span>' + esc(t) + '</span>';
    }

    function railHTML(now) {
      const ph = phaseNow();
      let h = '';
      if (ph === 'am') {
        const due = M.tasks.filter((x) => !x.stamped && x.group !== 'week').length;
        const left = M.todos.filter((x) => !x.stamped).length;
        const first = M.events.find((e) => e.timed && e.state !== 'past') || M.events[0];
        h += '<section class="hm-card hm-brief" aria-labelledby="hm-c1"><h2 class="hm-card-k" id="hm-c1">아침 브리핑</h2>' +
          '<p class="hm-brief-sum"><span><b class="num">' + M.events.length + '</b>일정</span><span><b class="num">' + due + '</b>마감</span><span><b class="num">' + left + '</b>할 일</span></p>' +
          (first ? '<p class="hm-brief-first">첫 일정 <b>' + esc(first.timed ? first.start : first.span) + '</b> ' + esc(first.title) + '</p>' : '<p class="hm-brief-first">오늘 잡힌 일정이 없습니다.</p>');
        const mov = M.carry.filter((c) => c.movable);
        h += '<div class="hm-carry"><h3>넘겨받기 <small>' + esc(md(M.prev)) + (M.prev !== addDays(M.td, -1) ? '부터' : '') + ' 남은 일</small></h3>';
        if (M.carry.length) {
          h += '<ul>' + M.carry.map((c, i) => '<li><span class="hm-carry-t"><b>' + esc(c.title) + '</b><small>' + esc((c.type === 'todo' ? '할 일 · ' : c.type === 'mine' ? '내 일정 · ' : '업무 · ') + c.when) + '</small></span>' +
            (c.movable ? '<button type="button" class="btn btn-sm" data-carry="' + i + '">오늘로</button>' : '<a class="hm-flag" href="' + c.href + '">기한 지남</a>') + '</li>').join('') + '</ul>' +
            (mov.length > 1 ? '<button type="button" class="btn btn-sm btn-primary hm-carry-all" data-act="carry-all">' + mov.length + '건 모두 오늘로 가져오기</button>' : '');
        } else h += '<p class="hm-card-empty">어제 남긴 일이 없습니다.</p>';
        h += '</div><div class="hm-card-acts"><button type="button" class="btn btn-sm" data-act="brief-copy">브리핑 복사</button></div></section>';
      } else if (ph === 'pm') {
        const left = M.counted.filter((x) => !x.stamped);
        const pct = M.counted.length ? Math.round(M.done.length / M.counted.length * 100) : 0;
        const movable = left.filter((x) => x.type === 'todo' || (x.type === 'event' && x.src === 'mine' && x.raw.date === M.td && !(x.raw.endDate > x.raw.date)));
        const li = (x) => '<li class="' + (x.stamped ? 'ok' : '') + '"><span>' + esc(x.title) + '</span><small>' + esc(x.type === 'event' ? x.tag : x.type === 'task' ? '업무' : '할 일') + '</small></li>';
        h += '<section class="hm-card hm-close" aria-labelledby="hm-c3"><h2 class="hm-card-k" id="hm-c3">업무 마감 보고</h2>' +
          '<p class="hm-close-sum"><b class="num">' + M.done.length + '</b> / ' + M.counted.length + '건 결재 <span class="num">' + pct + '%</span></p>' +
          '<div class="hm-close-cols"><div><h3>완료 <span class="num">' + M.done.length + '</span></h3>' + (M.done.length ? '<ul>' + M.done.map(li).join('') + '</ul>' : '<p class="hm-card-empty">아직 없습니다.</p>') + '</div>' +
          '<div><h3>미완료 <span class="num">' + left.length + '</span></h3>' + (left.length ? '<ul>' + left.map(li).join('') + '</ul>' : '<p class="hm-card-empty">모두 처리했습니다.</p>') + '</div></div>' +
          '<div class="hm-card-acts">' +
          (movable.length ? '<button type="button" class="btn btn-sm" data-act="carry-tomorrow">미완료 ' + movable.length + '건 내일로</button>' : '') +
          '<button type="button" class="btn btn-sm" data-act="close-copy">메신저용 복사</button>' +
          (has('docs') ? '<button type="button" class="btn btn-sm btn-primary" data-act="close-doc">보고서로 저장</button>' : '') + '</div>' +
          (left.length && left.length > movable.length ? '<p class="hm-card-note">업무·부서 일정은 옮기지 않고 그대로 둡니다.</p>' : '') + '</section>';
      } else {
        const nm = now.getHours() * 60 + now.getMinutes();
        const cur = M.events.find((e) => e.timed && e.startM <= nm && nm < e.endM);
        const next = M.events.find((e) => e.timed && e.startM > nm);
        h += '<section class="hm-card hm-nowcard" aria-labelledby="hm-c2"><h2 class="hm-card-k" id="hm-c2">근무 중</h2>' +
          (cur ? '<a class="hm-nowrow is-now" href="' + cur.href + '"><em>지금</em><b>' + esc(cur.title) + '</b><small class="num">' + esc(cur.start + '–' + (cur.end || '')) + ' · ' + fmtDur(cur.endM - nm) + ' 남음</small></a>' : '') +
          (next ? '<a class="hm-nowrow" href="' + next.href + '"><em>다음</em><b>' + esc(next.title) + '</b><small class="num">' + esc(next.start) + ' · ' + fmtDur(next.startM - nm) + ' 뒤</small></a>' : '') +
          (!cur && !next ? '<p class="hm-card-empty">오늘 남은 일정이 없습니다. 미뤄 둔 일을 이어서 해 보세요.</p>' : '') + '</section>';
      }
      // 이어하기 (기억한 자리가 없으면 가장 최근 작업)
      const r = M.lastItem || M.recent[0];
      h += '<section class="hm-card hm-resume' + (ph === 'work' ? ' is-big' : '') + '" aria-labelledby="hm-c4"><h2 class="hm-card-k" id="hm-c4">이어서 하기</h2>' +
        (r ? '<button type="button" class="hm-resume-main" data-resume="' + esc(r.col) + '|' + esc(r.id) + '"><span class="hm-glyph" data-t="' + esc(r.col) + '" aria-hidden="true">' + r.g + '</span>' +
          '<span class="hm-resume-t"><b>' + esc(r.title) + '</b><small>' + esc([r.name, resumeInfo(r), relTime(r.at || r.updatedAt)].filter(Boolean).join(' · ')) + '</small></span>' +
          '<span class="hm-resume-go" aria-hidden="true">' + P.icons.arrow + '</span></button><p class="hm-card-note"><kbd class="kbd">' + MOD + '</kbd><kbd class="kbd">K</kbd> 에서 \'이어하기\'로 어디서든 열기</p>'
          : '<p class="hm-card-empty">문서·PT·엑셀·차트를 열면 마지막 자리를 기억해 두었다가 여기서 그대로 엽니다.</p>') + '</section>';
      return h;
    }

    function paperHTML() {
      const labels = signLabels();
      const total = M.counted.length;
      const pct = total ? M.done.length / total : 0;
      const filled = total ? labels.filter((_, i) => pct >= (i + 1) / labels.length - 1e-9).length : 0;
      const newly = new Set();
      if (prevFilled >= 0 && filled > prevFilled) for (let i = prevFilled; i < filled; i++) newly.add(i);
      prevFilled = filled;
      let h = '<header class="hm-doc-hd"><div class="hm-doc-hd-l"><p class="hm-doc-org">' + esc(b.title) + ' · 업무 처리부</p>' +
        '<h2 class="hm-doc-t" id="hm-doc-t">오늘의 업무<span class="hm-doc-date"> · ' + esc(longDate(M.td)) + '</span></h2></div>' + signHTML(M, labels, newly) + '</header>' +
        '<dl class="hm-doc-meta"><div><dt>시행</dt><dd class="num">' + esc(longDate(M.td)) + '</dd></div><div><dt>처리</dt><dd class="num">' + M.done.length + ' / ' + total + '건</dd></div>' +
        '<div><dt>근무</dt><dd class="num">' + esc(hours().in + '–' + hours().out) + '</dd></div></dl>';
      // 1. 오늘 일정
      const sec = (n, id, title, count, body, link) => '<section class="hm-sec" aria-labelledby="' + id + '"><h3 class="hm-sec-t" id="' + id + '"><span class="hm-sec-n">' + n + '.</span>' + esc(title) + (count != null ? '<span class="hm-sec-c num">' + count + '</span>' : '') + (link || '') + '</h3><ol class="hm-list">' + body + '</ol></section>';
      let ev = '';
      if (M.events.length) {
        let placed = false;
        const nowL = '<li class="hm-nowline" aria-label="지금 ' + pad(Math.floor(M.nowM / 60)) + ':' + pad(M.nowM % 60) + '"><span class="num">지금 ' + pad(Math.floor(M.nowM / 60)) + ':' + pad(M.nowM % 60) + '</span></li>';
        const anyTimed = M.events.some((e) => e.timed);
        M.events.forEach((e, i) => {
          if (anyTimed && !placed && e.timed && e.startM > M.nowM) { ev += nowL; placed = true; }
          ev += evRow(e, i, anim === e.key);
        });
        if (anyTimed && !placed) ev += nowL;
      } else ev = emptyRow('오늘 잡힌 일정이 없습니다. 위 칸에 "내일 3시 회의"처럼 적으면 바로 넣습니다.');
      h += sec(1, 'hm-s1', '오늘 일정', M.events.length, ev, has('my-schedule') ? '<a class="hm-sec-link" href="#/my-schedule/today">내 일정</a>' : '');
      // 2. 마감 업무
      let tk = '';
      if (M.tasks.length) M.tasks.forEach((t, i) => { tk += taskRow(t, i, M, anim === t.key); });
      else tk = emptyRow(has('schedule') ? '이번 주 기한인 업무가 없습니다.' : '부서 스케줄러 앱이 없습니다.');
      h += sec(2, 'hm-s2', '마감 업무', M.tasks.filter((t) => !t.stamped).length, tk, has('schedule') ? '<a class="hm-sec-link" href="#/schedule/tasks">주요업무</a>' : '');
      // 3. 이어서 할 문서
      let dc = '';
      if (M.recent.length) M.recent.forEach((r, i) => { dc += docRow(r, i, M); });
      else dc = emptyRow('아직 만든 문서·PT·시트가 없습니다. 위 칸에 "보고서 새로"라고 적어 보세요.');
      h += sec(3, 'hm-s3', '이어서 할 문서', null, dc);
      // 4. 내 할 일
      let tdh = '';
      if (M.todos.length) M.todos.forEach((t, i) => { tdh += todoRow(t, i, M, anim === t.key); });
      else tdh = emptyRow(has('my-schedule') ? '오늘까지 할 일이 없습니다.' : '내 일정 앱이 없습니다.');
      h += sec(4, 'hm-s4', '내 할 일', M.todos.filter((t) => !t.stamped).length, tdh, has('my-schedule') ? '<a class="hm-sec-link" href="#/my-schedule/todos">할 일 전체</a>' : '');
      h += '<p class="hm-end">끝.</p>';
      return h;
    }

    function paint(opts) {
      if (!alive || !M) return;
      const now = new Date();
      const ph = phaseNow();
      const auto = autoPhase(now);
      const page = el.querySelector('.hm');
      page.dataset.phase = ph;
      el.querySelectorAll('.hm-phase [data-phase]').forEach((x) => {
        x.setAttribute('aria-checked', String(x.dataset.phase === ph));
        x.classList.toggle('is-auto', x.dataset.phase === auto);
        x.title = x.dataset.phase === auto ? '지금 시간 기준' : '';
      });
      el.querySelector('.hm-status').innerHTML = statusHTML(now);
      if (opts && opts.statusOnly) return;
      const focusKey = document.activeElement && document.activeElement.dataset ? (document.activeElement.dataset.stamp || '') : '';
      const paper = el.querySelector('.hm-paper');
      paper.removeAttribute('aria-busy');
      paper.innerHTML = paperHTML();
      el.querySelector('.hm-rail').innerHTML = railHTML(now);
      if (focusKey) { const f = el.querySelector('[data-stamp="' + CSS.escape(focusKey) + '"]'); if (f) f.focus({ preventScroll: true }); }
      if (anim) { anim = null; animUntil = Date.now() + 950; }
      lastSig = sigOf();
    }
    // 도장 찍는 움직임이 끝날 때까지는 다시 그리지 않음(새로 그리면 움직임이 끊김)
    let animUntil = 0;
    let lastSig = '';
    const sigOf = () => (M ? M.events.map((x) => x.state).join(',') + '|' + phaseNow() : '');
    function paintSoon() {
      const wait = animUntil - Date.now();
      if (wait > 0) { clearTimeout(paintSoon.t); paintSoon.t = setTimeout(paintSoon, wait + 20); return; }
      paint();
    }

    async function reload() {
      const my = ++loading;
      try { raw = await loadRaw(has); } catch (e) { console.error(e); return; }
      if (!alive || my !== loading) return;
      M = buildModel(raw, new Date());
      paintSoon();
    }

    /* ---------- 도장 ---------- */
    async function toggle(key, fromUndo) {
      const it = M && M.byKey.get(key);
      if (!it) return;
      const was = it.stamped;
      const iso = new Date().toISOString();
      it.stamped = !was;
      // 화면 먼저 바꾸고(낙관적), 저장 뒤 다시 읽음
      M.done = M.counted.filter((x) => x.stamped);
      anim = was ? null : key;
      paint();
      try {
        if (it.type === 'event') {
          if (was) await L.remove(STAMPS, key);
          else await L.put(STAMPS, key, { date: key.slice(0, 10), src: it.src, ref: it.id, title: it.title, at: iso });
        } else if (it.type === 'task') {
          const d = Object.assign({}, it.raw);
          delete d.id; delete d.updatedAt;
          let next;
          if (was) {
            next = Object.assign({}, d, { status: d.prevStatus && d.prevStatus !== '완료' ? d.prevStatus : '진행', progress: d.prevProgress != null && d.prevProgress < 100 ? d.prevProgress : 90 });
            delete next.prevStatus; delete next.prevProgress; delete next.stampedAt;
          } else next = Object.assign({}, d, { status: '완료', progress: 100, prevStatus: d.status || '예정', prevProgress: d.progress || 0, stampedAt: M.td });
          await P.store.put('schedule-tasks', it.id, next);
        } else {
          const d = Object.assign({}, it.raw);
          delete d.id;
          await L.put(MINE_TODO, it.id, Object.assign(d, was ? { done: false, doneAt: '' } : { done: true, doneAt: iso }));
        }
      } catch (e) {
        it.stamped = was;
        M.done = M.counted.filter((x) => x.stamped);
        paint();
        return;
      }
      if (!fromUndo) P.line.toast(was ? '도장을 거뒀습니다: ' + it.title : (it.type === 'event' ? '확인했습니다: ' : '완료했습니다: ') + it.title, [{ label: '되돌리기', run: () => toggle(key, true) }], 5000);
      reload();
    }

    /* ---------- 옮기기 (넘겨받기 · 내일로) ---------- */
    async function moveItems(list, toDay, label) {
      const undo = [];
      try {
        for (const c of list) {
          if (c.type === 'todo') {
            const d = Object.assign({}, c.raw); delete d.id;
            undo.push([MINE_TODO, c.id, Object.assign({}, d)]);
            await L.put(MINE_TODO, c.id, Object.assign(d, { due: toDay }));
          } else if (c.type === 'mine') {
            const e = Object.assign({}, c.raw); delete e.id;
            undo.push([MINE_EV, c.id, Object.assign({}, e)]);
            const delta = dayDiff(e.date, toDay);
            e.date = toDay;
            if (e.endDate) e.endDate = addDays(e.endDate, delta);
            await L.put(MINE_EV, c.id, e);
          }
        }
      } catch (e) { reload(); return; }
      P.line.toast(label + ' ' + undo.length + '건 옮겼습니다.', [{ label: '되돌리기', run: async () => { for (const [col, id, d] of undo) { try { await L.put(col, id, d); } catch (e) { /* core가 알림 */ } } reload(); P.ui.toast('되돌렸습니다.', 'info'); } }], 6000);
      reload();
    }
    const asMove = (x) => ({ type: x.type === 'event' ? 'mine' : x.type, id: x.id, raw: x.raw });

    /* ---------- 업무 마감 보고 → 문서 ---------- */
    async function closeDoc(btn) {
      const K = window.DocsKit;
      if (!K) { P.ui.toast('문서 앱을 불러오지 못했습니다.', 'error'); return; }
      const H = K.html;
      const e = (s) => esc(s);
      const left = M.counted.filter((x) => !x.stamped);
      const pct = M.counted.length ? Math.round(M.done.length / M.counted.length * 100) : 0;
      const d = parseYmd(M.td);
      const dateTxt = K.fmtDate(d, true);
      const lines = (xs, tail) => (xs.length ? xs.map((x) => H.ul(2, e(lineOf(x)) + (tail ? tail(x) : ''))).join('') : H.ul(2, '없음'));
      let html = H.tbl([100], [[{ t: '<span style="font-size:20pt">업무 마감 보고</span>', al: 'center', b: true, bg: '#dbe5f1' }]]) +
        H.rgt('<span style="font-size:12pt">' + e(dateTxt) + '&nbsp;&nbsp;' + e(b.title) + '</span>') +
        H.ul(1, '<b>개요</b>') + H.ul(2, '(일자) ' + e(dateTxt)) + H.ul(2, '(처리) 전체 ' + M.counted.length + '건 중 ' + M.done.length + '건 완료(' + pct + '%)') + H.BR +
        H.ul(1, '<b>완료 업무</b>') + lines(M.done) + H.BR +
        H.ul(1, '<b>미완료 업무</b>') + lines(left, (x) => (x.type === 'todo' || (x.type === 'event' && x.src === 'mine') ? ' → 내일 이어서' : '')) + H.BR;
      if (M.tomorrow.length) html += H.ul(1, '<b>내일 일정</b>') + M.tomorrow.map((x) => H.ul(2, e((x.timed ? x.start + ' ' : '') + x.title + (x.place ? ' / ' + x.place : '')))).join('') + H.BR;
      html += H.rgt('끝.');
      const title = '업무 마감 보고 (' + K.fmtDate(d) + ')';
      const data = K.newDocData({ id: 'report', kind: 'report', html, page: { font: 'hmj', size: 15, lh: 160 } }, title);
      data.folder = null;
      const id = P.store.uid();
      await P.store.put('docs', id, data);
      P.line.toast('보고서로 저장했습니다: ' + title, [{ label: '되돌리기', run: async () => { if ((location.hash || '').indexOf(id) >= 0) { P.navigate('home'); await new Promise((r) => setTimeout(r, 450)); } await P.store.remove('docs', id); P.ui.toast('보고서를 지웠습니다.', 'info'); } }], 7000);
      P.navigate('docs/' + encodeURIComponent(id));
      void btn;
    }

    /* ---------- 눌림 ---------- */
    el.addEventListener('click', async (e) => {
      const t = e.target.closest('button, [data-phase]');
      if (!t || !el.contains(t)) return;
      if (t.dataset.phase) {
        const a = autoPhase(new Date());
        viewPhase = t.dataset.phase === a ? null : t.dataset.phase;
        paint();
        return;
      }
      if (t.dataset.stamp) { toggle(t.dataset.stamp); return; }
      if (t.dataset.resume) {
        const [app, id] = t.dataset.resume.split('|');
        if (P.resume) P.resume.open({ app, id }); else P.navigate(app + '/' + encodeURIComponent(id));
        return;
      }
      if (t.dataset.carry != null) { const c = M.carry[Number(t.dataset.carry)]; if (c && c.movable) P.ui.busy(t, () => moveItems([c], M.td, '오늘로')); return; }
      const act = t.dataset.act;
      if (act === 'carry-all') P.ui.busy(t, () => moveItems(M.carry.filter((c) => c.movable), M.td, '오늘로'));
      else if (act === 'carry-tomorrow') {
        const list = M.counted.filter((x) => !x.stamped && (x.type === 'todo' || (x.type === 'event' && x.src === 'mine' && x.raw.date === M.td && !(x.raw.endDate > x.raw.date)))).map(asMove);
        P.ui.busy(t, () => moveItems(list, addDays(M.td, 1), '내일로'));
      } else if (act === 'brief-copy' || act === 'close-copy') {
        const ok = await copyText(act === 'brief-copy' ? briefText(M) : closeText(M));
        P.ui.toast(ok ? '복사했습니다. 메신저에 붙여넣으세요.' : '복사가 막혀 있습니다.', ok ? 'ok' : 'warn');
      } else if (act === 'close-doc') P.ui.busy(t, () => closeDoc(t)).catch((er) => { console.error(er); });
    });

    /* ---------- 새로 고침 ---------- */
    const onData = () => { if (alive) reload(); };
    window.addEventListener('p:data', onData);
    const onVis = () => { if (document.visibilityState === 'visible' && alive) reload(); };
    document.addEventListener('visibilitychange', onVis);
    let lastDay = ymd(new Date());
    let lastPhase = autoPhase(new Date());
    const tick = setInterval(() => {
      if (!alive || !M) return;
      const n = new Date();
      if (ymd(n) !== lastDay) {
        lastDay = ymd(n);
        dayEl.textContent = String(n.getDate());
        dayEl.setAttribute('datetime', lastDay);
        el.querySelector('.hm-date-md').textContent = (n.getMonth() + 1) + '월 · ' + WEEK[n.getDay()] + '요일';
        if (P.fx && P.fx.scrambleDaily) P.fx.scrambleDaily(dayEl, 'home-day', lastDay);
        reload();
        return;
      }
      const ph = autoPhase(n);
      const busyHere = el.querySelector('.hm-grid').contains(document.activeElement);
      M = buildModel(raw, n);
      if (ph !== lastPhase) { lastPhase = ph; paintSoon(); return; }
      if (!busyHere && sigOf() !== lastSig) { paintSoon(); return; }
      paint({ statusOnly: true });
      const nl = el.querySelector('.hm-nowline span');
      if (nl) nl.textContent = '지금 ' + pad(n.getHours()) + ':' + pad(n.getMinutes());
    }, 30000);

    reload();
    return () => {
      alive = false;
      clearInterval(tick);
      clearTimeout(paintSoon.t);
      window.removeEventListener('p:data', onData);
      document.removeEventListener('visibilitychange', onVis);
    };
  }

  P.registerApp({ id: 'home', title: '홈', short: '홈', icon: ICON, order: 0, group: 'home', desc: '오늘의 결재판: 한 줄 명령, 오늘 일정·마감·할 일을 도장으로 처리, 이어하기', mount });
})();
