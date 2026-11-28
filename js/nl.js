/* 한 줄 명령 해석기 (AI 없음, 규칙 기반)
   P.nl.parse(text, now, ctx) → { kind, alts, fields, confidence, preview }
   ctx: { people: [{ id, name, title }], apps: ['head-schedule', ...] } (선택)
   P.nl.record(kind, fields) → { col, local, data }  · 각 앱이 쓰는 자료 모양 그대로
   브라우저에서는 window.P.nl, Node 에서는 module.exports 로 씀(시험용) */
(function (G) {
  'use strict';

  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const WD_IDX = { 월: 0, 화: 1, 수: 2, 목: 3, 금: 4, 토: 5, 일: 6 }; // 월요일 시작
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const lastDay = (y, m) => new Date(y, m + 1, 0).getDate();
  const parseYmd = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const NATIVE = { 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 열한: 11, 열두: 12 };
  const NATIVE_DAYS = { 하루: 1, 이틀: 2, 사흘: 3, 나흘: 4, 닷새: 5, 엿새: 6, 이레: 7, 여드레: 8, 아흐레: 9, 열흘: 10 };
  const num = (s) => (NATIVE[s] != null ? NATIVE[s] : parseInt(s, 10));
  const NOT_HANGUL_AFTER = '(?=$|[\\s,.!?~\\-)(\\]]|에|부터|까지|쯤|경|께|은|는|엔|으로|로|중|안|내|이|가)';

  /* 대상 종류 */
  const KINDS = {
    head: { label: '부서장 일정', app: 'head-schedule' },
    dept: { label: '부서 일정', app: 'schedule' },
    mine: { label: '내 일정', app: 'my-schedule' },
    task: { label: '주요업무', app: 'schedule' },
    todo: { label: '내 할 일', app: 'my-schedule' },
    doc: { label: '새 문서', app: 'docs' },
    slides: { label: '새 PT', app: 'slides' },
    sheet: { label: '새 시트', app: 'sheets' },
    chart: { label: '새 차트', app: 'charts' }
  };
  const TEMPLATES = [
    ['result', /결과\s?보고서?/, '결과보고'],
    ['minutes', /회의록/, '회의록'],
    ['press', /보도\s?자료/, '보도자료'],
    ['gian', /기안문?|품의서?/, '기안문'],
    ['report', /보고서|개조식/, '보고서'],
    ['plan', /계획\s?\(안\)|계획안|계획서|계획/, '계획(안)'],
    ['blank', /빈\s?문서|문서/, '빈 문서']
  ];
  const TPL_WORD = { report: '보고서', gian: '기안문', plan: '계획', minutes: '회의록', press: '보도자료', result: '결과보고', blank: '' };
  const CREATE_VERB = /(새로\s?(?:작성|만들기|만들어\s?줘?|쓰기)?|작성(?:하기)?|쓰기|써\s?줘|만들기|만들어\s?줘?|초안|시작하기)/;
  const NEW_PREFIX = /(?:^|\s)새(?:로)?\s*$/;

  /* 구분 단어 → 앱별 구분 */
  const CATS = [
    ['휴가', /휴가|연가|반차|병가|월차|조퇴/],
    ['출장', /출장/],
    ['교육', /교육(?!장|원)|연수(?!원)|세미나(?!실)|워크숍|워크샵|강의|특강/],
    ['점검', /점검|순찰|현장\s?확인/],
    ['보고', /보고(?!서)|결재/],
    ['회의', /회의(?!실|록|장)|간담회|협의회?|면담|미팅|위원회|티타임/],
    ['행사', /행사|기념식|축제|개막식|발대식|시상식|설명회|토론회|공청회/],
    ['방문', /방문|내방|접견(?!실)/],
    ['개인', /병원|은행|개인\s?약속|약속|치과|이사/]
  ];
  const CAT_HEAD = { 회의: '회의', 보고: '보고', 출장: '출장', 행사: '행사', 교육: '기타', 점검: '외부일정', 방문: '외부일정', 휴가: '기타', 개인: '기타' };
  const CAT_MINE = { 회의: '회의', 보고: '업무', 출장: '업무', 교육: '업무', 점검: '업무', 행사: '업무', 방문: '업무', 휴가: '휴가', 개인: '개인' };
  const CAT_DEPT = { 회의: '회의', 보고: '보고', 출장: '출장', 교육: '교육', 행사: '행사', 방문: '방문', 점검: '기타', 휴가: '기타', 개인: '기타' };
  const ROLE_RE = /(구청장|도지사|부지사|부시장|부군수|본부장|센터장|사무관|청장|시장|군수|국장|실장|과장|팀장|단장|소장|원장|부장|차장|부서장)(님)?/;
  const LOC_STRONG = /(회의실|강당|청사|본관|별관|신관|접견실|상황실|세미나실|교육장|연수원|회의장|대강당|민원실|컨벤션센터)$/;
  const LOC_END = /(회의실|강당|청사|본관|별관|신관|접견실|상황실|세미나실|교육장|교육원|연수원|회의장|센터|도청|시청|군청|구청|의회|사무소|주민센터|사무실|민원실|홀|체육관|광장|공원|역|터미널|공항|대학교?|병원|호텔|컨벤션|행정복지센터|구내식당|식당|카페|라운지)$/;

  function normalize(t) {
    return String(t == null ? '' : t)
      .replace(/[～〜∼]/g, '~').replace(/[–—−]/g, '-').replace(/：/g, ':').replace(/．/g, '.').replace(/／/g, '/')
      .replace(/[ \t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function hourOf(mer, h) {
    if (mer === '오후' || mer === '저녁' || mer === '밤') return h < 12 ? h + 12 : h;
    if (mer === '낮') return h <= 6 ? h + 12 : h;
    if (mer === '점심') return h <= 5 ? h + 12 : h;
    if (mer === '오전' || mer === '아침' || mer === '새벽') return h === 12 ? 0 : h;
    if (h >= 1 && h <= 6) return h + 12; // 근무 시간 기준: 1~6시는 오후
    return h;
  }
  const hm = (h, m) => pad(Math.max(0, Math.min(23, h))) + ':' + pad(Math.max(0, Math.min(59, m)));
  const toMin = (s) => { const m = /^(\d{2}):(\d{2})$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : -1; };
  const fromMin = (n) => (n >= 24 * 60 ? '23:59' : hm(Math.floor(n / 60), n % 60));

  /* ================= 해석 ================= */
  function parse(text, nowIn, ctxIn) {
    const now = nowIn instanceof Date ? nowIn : new Date();
    const ctx = ctxIn || {};
    const today = day0(now);
    const src = normalize(text);
    let w = src;
    const eat = (i, len) => { w = w.slice(0, i) + ' '.repeat(len) + w.slice(i + len); };
    const free = (i, len) => !/\S/.test(w.slice(i, i + len)) ? false : w.slice(i, i + len).indexOf('\u0000') < 0;
    function scan(re, fn) {
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      const ms = [];
      let m;
      while ((m = g.exec(w))) { ms.push(m); if (!m[0]) g.lastIndex++; }
      ms.forEach((x) => {
        if (!free(x.index, x[0].length)) return;
        const r = fn(x);
        if (r !== false) eat(x.index, typeof r === 'number' ? r : x[0].length);
      });
    }
    const PART = '\\s*(에는|에서는|에|은|는|엔|부터|까지|쯤|경|중으로|중에|중|안에|안|내로|내|이내)?';

    /* ---------- 날짜 ---------- */
    const dates = [];
    const addDate = (d, m, extra) => {
      if (!d || isNaN(d)) return false;
      dates.push(Object.assign({ d: day0(d), i: m.index, j: m.index + m[0].length, part: m.partIdx != null ? (m[m.partIdx] || '') : '' }, extra || {}));
      return true;
    };
    const fixYear = (y, mo, da) => {
      let dt = new Date(y, mo, da);
      if (dt.getMonth() !== mo) return null;
      return dt;
    };
    const guessYear = (mo, da) => {
      let dt = fixYear(today.getFullYear(), mo, da);
      if (dt && dt < addDays(today, -31)) dt = fixYear(today.getFullYear() + 1, mo, da);
      return dt;
    };
    const P1 = (re, fn, partIdx) => scan(new RegExp(re.source + PART), (m) => { m.partIdx = partIdx; return fn(m); });
    // 2026.12.3 · 2026-12-03 · 2026/12/3 · 2026년 12월 3일
    P1(/(?<!\d)(20\d{2})\s*(?:[.\-/]|년)\s*(\d{1,2})\s*(?:[.\-/]|월)\s*(\d{1,2})\s*(?:일|\.)?(?!\d)/, (m) => addDate(fixYear(+m[1], +m[2] - 1, +m[3]), m), 4);
    // M월 말(일)
    P1(/(?<!\d)(\d{1,2})\s*월\s*(?:말일|말)(?![가-힣])/, (m) => { const mo = +m[1] - 1; if (mo < 0 || mo > 11) return false; return addDate(guessYear(mo, lastDay(today.getFullYear(), mo)), m); }, 2);
    // M월 N일
    P1(/(?<!\d)(\d{1,2})\s*월\s*(\d{1,2})\s*일(?!\s*(?:뒤|후|간|동안))/, (m) => { const mo = +m[1] - 1; if (mo >= 0 && mo <= 11) addDate(guessYear(mo, +m[2]), m); return true; }, 3);
    // M/N · M.N (괄호 요일 허용)
    P1(/(?<![\d.:/])(\d{1,2})\s*[/.]\s*(\d{1,2})(?![\d:]|\s*[/.]\s*\d)\.?(?:\s*\([월화수목금토일]\))?(?!\s*(?:배|%|시간|점|명|개|억|만|원|퍼센트|kg|km))/, (m) => {
      const mo = +m[1] - 1, da = +m[2];
      if (mo < 0 || mo > 11 || da < 1 || da > 31) return false;
      return addDate(guessYear(mo, da), m);
    }, 3);
    // 이번 달 N일 · 다음 달 N일
    P1(/(이번\s?달|이달|금월|다음\s?달|담달|내달|다다음\s?달)\s*(\d{1,2})\s*일(?!\s*(?:뒤|후|간))/, (m) => {
      const k = /다다음/.test(m[1]) ? 2 : /다음|담|내달/.test(m[1]) ? 1 : 0;
      const base = new Date(today.getFullYear(), today.getMonth() + k, 1);
      const dt = fixYear(base.getFullYear(), base.getMonth(), +m[2]);
      return addDate(dt, m);
    }, 3);
    // 이번 달 말 · 다음 달 말일 · 말일 · 월말
    P1(/(?:(이번\s?달|이달|금월|다음\s?달|담달|내달)\s*)?(말일|월말|말(?=$|\s|까지|에|부터))/, (m) => {
      if (!m[1] && m[2] === '말') return false;
      const k = m[1] && /다음|담|내달/.test(m[1]) ? 1 : 0;
      const y = today.getFullYear(), mo = today.getMonth() + k;
      return addDate(new Date(y, mo, lastDay(y, mo)), m);
    }, 3);
    // 연말
    P1(/(?<![가-힣])(올해\s?)?연말(?![가-힣])/, (m) => addDate(new Date(today.getFullYear(), 11, 31), m), 2);
    // N일/주/개월 뒤
    P1(/(?<![가-힣\d])(\d{1,3}|한|두|세|네)\s*(일|주일?|달|개월)\s*(?:뒤|후|있다가|지나서)/, (m) => {
      const n = num(m[1]);
      if (!(n > 0)) return false;
      const u = m[2];
      if (u === '일') return addDate(addDays(today, n), m);
      if (/주/.test(u)) return addDate(addDays(today, n * 7), m);
      const dt = new Date(today.getFullYear(), today.getMonth() + n, today.getDate());
      return addDate(dt, m);
    }, 3);
    P1(/(?<![가-힣])(하루|이틀|사흘|나흘|닷새|엿새|이레|여드레|아흐레|열흘|일주일)\s*(?:뒤|후|있다가)/, (m) => addDate(addDays(today, m[1] === '일주일' ? 7 : NATIVE_DAYS[m[1]]), m), 2);
    // 오늘 · 내일 · 모레 · 글피
    P1(/(?<![가-힣])(오늘|금일|내일\s?모레|내일|명일|모레|글피|어제|그제|그저께)/, (m) => {
      const k = m[1].replace(/\s/g, '');
      const n = { 오늘: 0, 금일: 0, 내일: 1, 명일: 1, 내일모레: 2, 모레: 2, 글피: 3, 어제: -1, 그제: -2, 그저께: -2 }[k];
      return addDate(addDays(today, n), m);
    }, 2);
    // 이번 주 · 다음 주 + 요일
    const weekOff = (s) => (/다다음/.test(s) ? 14 : /다음|차주|담주/.test(s) ? 7 : /지난|저번/.test(s) ? -7 : 0);
    const monday = addDays(today, -((today.getDay() + 6) % 7));
    P1(new RegExp('(이번\\s?주|금주|다다음\\s?주|다음\\s?주|차주|담주|지난\\s?주|저번\\s?주)\\s*(?:의\\s*)?([월화수목금토일])(?:요일|욜)?' + NOT_HANGUL_AFTER), (m) => {
      return addDate(addDays(monday, weekOff(m[1]) + WD_IDX[m[2]]), m);
    }, 3);
    // 주말
    P1(/(?<![가-힣])(이번\s?주말|다음\s?주말|주말)/, (m) => {
      const off = /다음/.test(m[1]) ? 7 : 0;
      return addDate(addDays(monday, 5 + off), m, { weekend: true });
    }, 2);
    // 이번 주 · 다음 주 (요일 없이)
    P1(/(?<![가-힣])(이번\s?주|금주|다다음\s?주|다음\s?주|차주|담주)(?!말)/, (m) => {
      const off = weekOff(m[1]);
      return addDate(off ? addDays(monday, off) : today, m, { week: true, weekOff: off });
    }, 2);
    // 요일만: 오늘부터 가장 가까운 그 요일
    P1(/(?<![가-힣])([월화수목금토일])(?:요일|욜)/, (m) => {
      const target = (WD_IDX[m[1]] + 1) % 7; // getDay 기준
      return addDate(addDays(today, (target - today.getDay() + 7) % 7), m);
    }, 2);
    // N일 (이번 달, 이미 지났으면 다음 달) · 앞에 날짜가 있으면 그 달
    P1(/(?<![\d./:월])(\d{1,2})\s*일(?![가-힣]|\s*(?:뒤|후|간|동안|째|이내|전))/, (m) => {
      const da = +m[1];
      if (da < 1 || da > 31) return false;
      const prev = dates.filter((x) => x.i < m.index).sort((a, b) => b.i - a.i)[0];
      let dt;
      if (prev) {
        dt = fixYear(prev.d.getFullYear(), prev.d.getMonth(), da);
        if (dt && dt < prev.d) dt = fixYear(prev.d.getFullYear(), prev.d.getMonth() + 1, da);
      } else {
        dt = fixYear(today.getFullYear(), today.getMonth(), da);
        if (dt && dt < today) { const nm = new Date(today.getFullYear(), today.getMonth() + 1, 1); dt = fixYear(nm.getFullYear(), nm.getMonth(), da); }
      }
      return addDate(dt, m, { bareDay: true });
    }, 2);
    dates.sort((a, b) => a.i - b.i);

    // 2박 3일
    let stayNights = 0;
    scan(/(\d)\s*박\s*(\d)\s*일/, (m) => { stayNights = +m[1]; return true; });

    /* ---------- 시각 ---------- */
    const MER = '(오전|오후|아침|점심|저녁|밤|새벽|낮)';
    const HOUR = '(\\d{1,2}|열한|열두|열|한|두|세|네|다섯|여섯|일곱|여덟|아홉)';
    const TPART = '\\s*(부터|까지|에서|에|쯤|경|전)?';
    const times = [];
    let allDay = false;
    // N~M시 (앞 숫자에 '시'가 없는 범위)
    scan(new RegExp('(?:' + MER + '\\s*)?(?<![\\d:])(\\d{1,2})\\s*(?:~|-)\\s*(\\d{1,2})\\s*시(?!간)(?:\\s*(반))?' + TPART), (m) => {
      const a = +m[2], b = +m[3];
      if (a > 24 || b > 24) return false;
      const sh = hourOf(m[1], a);
      times.push({ h: sh, m: 0, i: m.index, j: m.index + m[0].length, part: '', mer: m[1] || '' });
      times.push({ h: b, m: m[4] ? 30 : 0, i: m.index + m[0].length - 1, j: m.index + m[0].length, part: m[5] || '', raw: true, endOf: true });
      return true;
    });
    // HH:MM
    scan(new RegExp('(?:' + MER + '\\s*)?(?<![\\d:./])(\\d{1,2}):(\\d{2})(?!\\d)' + TPART), (m) => {
      const h = +m[2], mi = +m[3];
      if (h > 24 || mi > 59) return false;
      times.push({ h: m[1] ? hourOf(m[1], h) : h, m: mi, i: m.index, j: m.index + m[0].length, part: m[4] || '', mer: m[1] || '', exact: !m[1] });
      return true;
    });
    // (오후) N시 (반 · N분)
    const HOUR_TAIL = '\\s*시(?!간)(?:\\s*(반|\\d{1,2}\\s*분))?' + TPART;
    scan(new RegExp('(?:' + MER + '\\s*)?(?<![\\d가-힣])(?:(\\d{1,2})' + HOUR_TAIL + '|(열한|열두|열|한|두|세|네|다섯|여섯|일곱|여덟|아홉)' + HOUR_TAIL + '(?![가-힣]))'), (m) => {
      if (m[5]) { m[2] = m[5]; m[3] = m[6]; m[4] = m[7]; }
      const h = num(m[2]);
      if (!(h >= 0 && h <= 24)) return false;
      const mi = !m[3] ? 0 : m[3] === '반' ? 30 : parseInt(m[3], 10);
      times.push({ h: hourOf(m[1], h), rawH: h, m: mi, i: m.index, j: m.index + m[0].length, part: m[4] || '', mer: m[1] || '' });
      return true;
    });
    // 정오
    scan(/(?<![가-힣])정오(?:에|부터|까지)?/, (m) => { times.push({ h: 12, m: 0, i: m.index, j: m.index + m[0].length, part: /까지/.test(m[0]) ? '까지' : '', mer: '낮' }); return true; });
    // 종일
    scan(/(?<![가-힣])(하루\s?종일|온종일|종일|하루\s?내내)/, () => { allDay = true; return true; });
    times.sort((a, b) => a.i - b.i);

    let start = '', end = '';
    if (times.length) {
      const t0 = times[0];
      start = hm(t0.h, t0.m);
      let t1 = null;
      if (times.length > 1) {
        const gap = src.slice(t0.j, times[1].i);
        if (times[1].endOf || t0.part === '부터' || t0.part === '에서' || /^\s*(~|-|부터|에서)?\s*$/.test(gap)) t1 = times[1];
      }
      if (t1) {
        let eh = t1.mer ? t1.h : (t1.raw ? t1.h : (t1.rawH != null ? t1.rawH : t1.h));
        const sMin = toMin(start);
        if (!t1.mer) {
          if (eh * 60 + t1.m <= sMin && eh < 12) eh += 12;
          if (eh * 60 + t1.m <= sMin && eh < 12) eh += 12;
        }
        end = fromMin(Math.min(24 * 60, eh * 60 + t1.m));
        if (toMin(end) <= sMin) end = '';
      }
      if (t0.part === '까지' && !t1) { end = ''; }
    }
    // 2시간 · 1시간 반
    let durMin = 0;
    scan(/(?<![가-힣\d])(\d{1,2}|한|두|세|네)\s*시간(?:\s*(반))?(?:\s*(?:동안|가량|정도))?/, (m) => {
      durMin = num(m[1]) * 60 + (m[2] ? 30 : 0);
      return durMin > 0;
    });
    if (start && !end && durMin) end = fromMin(toMin(start) + durMin);
    // 점심 · 아침 · 저녁 (시각 없이)
    if (!start && !allDay) {
      scan(/(?<![가-힣])(점심|아침|저녁)(?:에|때|시간)?(?![가-힣])/, (m) => {
        start = { 점심: '12:00', 아침: '09:00', 저녁: '18:00' }[m[1]];
        return /(에|때|시간)$/.test(m[0]) ? true : false;
      });
    }
    // 남은 오전/오후 단어는 지움
    scan(/(?<![가-힣])(오전|오후)(?:\s*중)?(?=\s|$)/, () => true);

    /* ---------- 날짜 정리 ---------- */
    let date = '', endDate = '';
    let deadline = false;
    const first = dates[0];
    if (first) {
      date = ymd(first.d);
      const second = dates[1];
      if (second) {
        const gap = src.slice(first.j, second.i);
        if (first.part === '부터' || /^\s*(~|-|부터|에서)\s*$/.test(gap)) {
          if (second.d > first.d) endDate = ymd(second.d);
        }
      }
      if (first.weekend && !endDate && !times.length) endDate = ymd(addDays(first.d, 1));
      const last = endDate ? dates[1] : first;
      if (!endDate && dates.some((x) => x.part === '까지')) deadline = true;
      if (last && !endDate && last.part === '까지') deadline = true;
      if (first.week && first.weekOff >= 0 && (deadline || /안|내|이내|중/.test(first.part))) {
        // 이번 주까지 → 그 주 금요일
        date = ymd(addDays(monday, (first.weekOff || 0) + 4));
        deadline = true;
      }
    }
    if (stayNights && date && !endDate) endDate = ymd(addDays(parseYmd(date), stayNights));
    if (times.some((t) => t.part === '까지') && !end && times.length === 1) deadline = true;

    /* ---------- 마감 표시 ---------- */
    scan(/(?<![가-힣])(마감일?|기한|데드라인|마감\s?기한)(?:\s*(?:은|는|이|:))?(?![가-힣])/, () => { deadline = true; return true; });
    scan(/(?<![가-힣])(까지|이내|내로)(?![가-힣])/, () => { deadline = true; return true; });

    /* ---------- 대상 힌트 ---------- */
    let hint = '';
    const hints = [];
    const hintScan = (re, k) => scan(re, () => { hints.push(k); return true; });
    hintScan(/(?<![가-힣])부서장\s?일정(?:에|으로|로)?/, 'head');
    hintScan(/(?<![가-힣])(?:부서\s?일정|부서\s?전체|팀\s?일정|과\s?일정|과\s?전체|우리\s?(?:과|팀|부서)|부서)(?:에|으로|로|에서)?(?![가-힣])/, 'dept');
    if (/(?<![가-힣])전\s?직원(?![가-힣])/.test(w)) hints.push('dept'); // '전 직원 교육'은 제목에 남김
    hintScan(/(?<![가-힣])(?:주요\s?업무|업무\s?등록|과제)(?:로|에|으로)?(?![가-힣])/, 'task');
    hintScan(/(?<![가-힣])(?:내\s?할\s?일|할\s?일|할일|todo|투두|해야\s?할\s?일)(?:로|에|으로)?(?![가-힣])/i, 'todo');
    hintScan(/(?<![가-힣])(?:내\s?일정|개인\s?일정|나만|나혼자|나\s혼자)(?:에|으로|로)?(?![가-힣])/, 'mine');
    hintScan(/(?<![가-힣])(?:나|내|저|제)(?:는|도|의|가)?(?=\s|$)/, 'mine');
    if (hints.length) hint = hints[0];

    /* ---------- 사람 ---------- */
    const people = Array.isArray(ctx.people) ? ctx.people.filter((p) => p && p.id && (p.name || p.title)) : [];
    const heads = [];
    let roleHint = '';
    let toPerson = false;
    const PP = '(님)?\\s*(께서|께|에게|한테|과|와|이|가|은|는|의|도|랑)?(?![가-힣])';
    const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    people.forEach((p) => {
      const name = String(p.name || '').trim();
      const title = String(p.title || '').trim();
      const pats = [];
      if (name && title) pats.push(reEsc(name) + '\\s*' + reEsc(title));
      if (name && title) pats.push(reEsc(name.charAt(0)) + '\\s?' + reEsc(title));
      if (name && name.length >= 2) pats.push(reEsc(name));
      if (title && people.filter((x) => String(x.title || '').trim() === title).length === 1) pats.push(reEsc(title));
      pats.forEach((pt) => {
        scan(new RegExp('(?<![가-힣])' + pt + PP), (m) => {
          if (!heads.includes(p.id)) heads.push(p.id);
          if (/께$|에게|한테/.test(m[2] || '') || /께$/.test(m[1] || '')) toPerson = true;
          return true;
        });
      });
    });
    scan(new RegExp('(?<![가-힣])' + ROLE_RE.source + '(께서|께|에게|한테|과|와|이|가|은|는|의|도|랑)?(?![가-힣])'), (m) => {
      roleHint = roleHint || m[1] + (m[2] ? '님' : '');
      if (/^(께|에게|한테)$/.test(m[3] || '')) toPerson = true;
      return true;
    });

    /* ---------- 만들기 ---------- */
    let create = null;
    let template = '';
    let createWord = '';
    const beforeCreate = w;
    const tryCreate = (re, k, tpl) => {
      if (create) return;
      const long = k === 'doc';
      const g = new RegExp('(?<![가-힣A-Za-z])(새로?\\s*)?(' + (long ? '[^\\s]*?' : '') + ')(' + re.source + ')(?:를|을)?(?=\\s|$)(?:\\s*(' + CREATE_VERB.source + ')(?![가-힣]))?', 'i');
      const m = g.exec(w);
      if (!m) return;
      if (!m[1] && !m[4] && !NEW_PREFIX.test(w.slice(0, m.index))) return;
      create = k;
      template = tpl || '';
      createWord = long && m[2] ? m[2] + m[3] : '';
      eat(m.index, m[0].length);
      const pm = NEW_PREFIX.exec(w.slice(0, m.index));
      if (pm) eat(pm.index, pm[0].length);
    };
    TEMPLATES.forEach(([id, re]) => tryCreate(re, 'doc', id));
    tryCreate(/PT|ppt|피티|발표\s?자료|프레젠테이션|슬라이드/, 'slides');
    tryCreate(/스프레드\s?시트|엑셀|시트|표/, 'sheet');
    tryCreate(/차트|그래프|도표/, 'chart');

    /* ---------- 장소 ---------- */
    let place = '';
    {
      const toks = [];
      const re = /\S+/g;
      let m;
      while ((m = re.exec(w))) toks.push({ t: m[0], i: m.index });
      const isLoc = (t) => {
        const b = t.replace(/(에서는|에서|에는|으로|로|에)$/, '');
        if (/^(지하\s?)?\d+층$/.test(b) || /^\d+호실?$/.test(b) || /^[A-Z]?\d+동$/.test(b)) return 2;
        if (LOC_STRONG.test(b)) return 2;
        if (LOC_END.test(b)) return 1;
        return 0;
      };
      let best = null;
      for (let k = 0; k < toks.length; k++) {
        const t = toks[k].t;
        const ends = /에서(는)?$/.test(t) && t.length > 2;
        if (isLoc(t) === 2 || ends) {
          let a = k, b = k;
          while (a - 1 >= 0 && isLoc(toks[a - 1].t) && !/에서$/.test(toks[a - 1].t)) a--;
          while (!ends && b + 1 < toks.length && (isLoc(toks[b + 1].t) || (/에서(는)?$/.test(toks[b + 1].t) && toks[b + 1].t.length > 2))) { b++; if (/에서(는)?$/.test(toks[b].t)) break; }
          const seg = toks.slice(a, b + 1);
          const words = seg.map((x) => x.t).join(' ').replace(/(에서는|에서|에는|으로|에)$/, '').replace(/(?<=[가-힣\d])로$/, '');
          if (words && (!best || seg.length > best.seg.length)) best = { seg, words };
          k = b;
        }
      }
      if (best) {
        place = best.words;
        best.seg.forEach((x) => eat(x.i, x.t.length));
      }
    }

    /* ---------- 구분 ---------- */
    let category = '';
    for (const [c, re] of CATS) { if (re.test(src.replace(/회의실|회의록|보고서|교육장|접견실|세미나실/g, ' '))) { category = c; break; } }

    /* ---------- 제목 ---------- */
    const NOISE = /(?<![가-힣])(일정\s?(?:추가|등록|잡기|잡아\s?줘|넣기|넣어\s?줘)|추가(?:해\s?줘|하기)?|등록(?:해\s?줘|하기)?|입력|잡아\s?줘|넣어\s?줘|해\s?줘|부탁(?:해요|합니다)?|메모|기록)(?![가-힣])/g;
    const clean = (s) => String(s || '').replace(NOISE, ' ').replace(/\s+/g, ' ').trim()
      .replace(/^(?:에|은|는|에서|부터|까지|으로|로|과|와|및|,|·|-|~)(?=\s|$)\s*/, '').replace(/\s+(?:에|은|는|에서|부터|까지|으로|로|과|와|,|·|-|~)$/, '').replace(/^[\s,·\-~:]+|[\s,·\-~:]+$/g, '').trim();
    let title = clean(create ? beforeCreate : w);
    let docTitle = '';
    if (create) {
      // 만들기 단어를 뺀 나머지(장소·날짜 제외)
      const rest = clean(w);
      if (create === 'doc') docTitle = rest ? rest + ' ' + (createWord || TPL_WORD[template] || '') : createWord;
      else docTitle = rest;
      docTitle = docTitle.trim();
    }
    // 사람을 찾지 못한 직함은 제목에 남김
    if (roleHint && !heads.length) title = (roleHint + ' ' + title).trim();

    /* ---------- 종류 고르기 ---------- */
    const hasWhen = !!(date || start || allDay);
    const apps = Array.isArray(ctx.apps) ? new Set(ctx.apps) : null;
    const ok = (k) => !apps || apps.has(KINDS[k].app);
    let order;
    const personal = hints.includes('mine') && !hints.includes('dept');
    if (create && !hasWhen && !deadline) order = [create, 'todo'];
    else if (create && deadline) order = ['task', 'todo', create];
    else if (create) order = ['todo', create, 'mine'];
    else if (hint === 'todo') order = ['todo', 'task', 'mine'];
    else if (hint === 'task') order = ['task', 'todo'];
    else if (deadline) order = personal ? ['todo', 'task'] : ['task', 'todo', 'mine'];
    else if (hint === 'head' || ((heads.length || roleHint) && !personal && !toPerson)) order = ['head', 'mine', 'dept', 'todo'];
    else if ((heads.length || roleHint) && toPerson) order = ['mine', 'head', 'dept', 'todo'];
    else if (hint === 'dept') order = ['dept', 'mine', 'head', 'todo'];
    else if (hasWhen || personal || category) order = ['mine', 'dept', 'head', 'todo'];
    else order = ['todo', 'mine', 'task'];
    order = order.filter((k, i) => order.indexOf(k) === i && ok(k));
    if (!order.length) order = ['todo'];
    const kind = order[0];

    let conf = 0.25;
    if (date) conf += 0.2;
    if (start || allDay) conf += 0.2;
    if (heads.length) conf += 0.25; else if (roleHint) conf += 0.1;
    if (hint || deadline || create) conf += 0.2;
    if (place) conf += 0.05;
    if (!hasWhen && !hint && !deadline && !create && !heads.length && !roleHint) conf = title ? 0.2 : 0;
    conf = Math.round(Math.min(1, conf) * 100) / 100;

    if (start && !end && !allDay) {
      const s = toMin(start);
      if (s >= 0) end = fromMin(Math.min(23 * 60 + 59, s + 60));
    }
    if (allDay) { start = ''; end = ''; }

    const fields = {
      title, docTitle, template, date, endDate, start, end, allDay: allDay || (!start && !!date) || (!start && !date),
      timed: !!start && !allDay, place, heads, roleHint, category, deadline, hasDate: !!date,
      today: ymd(today)
    };
    const res = { text: src, kind, alts: order, fields, confidence: src ? conf : 0, empty: !src };
    res.preview = src ? previewFor(kind, fields, ctx) : '';
    return res;
  }

  /* ================= 미리보기 · 기록 ================= */
  function mdLabel(s) {
    const d = parseYmd(s);
    return d ? (d.getMonth() + 1) + '/' + d.getDate() + '(' + WD[d.getDay()] + ')' : '';
  }
  function peopleLabel(f, ctx) {
    const ps = (ctx && Array.isArray(ctx.people) ? ctx.people : []);
    const names = (f.heads || []).map((id) => ps.find((p) => p && p.id === id)).filter(Boolean)
      .map((p) => (p.name || '') + (p.title ? ' ' + p.title : ''));
    return names.length ? names.join(', ') : (f.roleHint ? f.roleHint.replace(/님$/, '') + '(미등록)' : '공통');
  }
  function when(kind, f) {
    if (kind === 'task' || kind === 'todo') {
      const due = f.date || f.today;
      return (f.deadline || kind === 'task' ? '기한 ' : '') + mdLabel(due);
    }
    const d = f.date || f.today;
    let s = mdLabel(d);
    if (f.endDate) s += '–' + mdLabel(f.endDate);
    if (f.timed) s += ' ' + f.start + (f.end ? '–' + f.end : '');
    else s += ' 종일';
    return s;
  }
  const TPL_NAME = { report: '보고서', gian: '기안문', plan: '계획(안)', minutes: '회의록', press: '보도자료', result: '결과보고', blank: '빈 문서' };
  function titleFor(kind, f) {
    if (kind === 'doc' || kind === 'slides' || kind === 'sheet' || kind === 'chart') return f.docTitle || '';
    if (f.title) return f.title;
    if (kind === 'task') return '업무';
    if (kind === 'todo') return '할 일';
    return f.category || '일정';
  }
  function previewFor(kind, f, ctx) {
    const parts = [labelFor(kind, f)];
    if (kind === 'head') parts.push(peopleLabel(f, ctx));
    const t = titleFor(kind, f);
    if (kind === 'doc' || kind === 'slides' || kind === 'sheet' || kind === 'chart') {
      parts.push(t ? '"' + t + '"' : '제목 자동');
      return parts.join(' · ');
    }
    parts.push(t);
    parts.push(when(kind, f));
    if (f.place && kind !== 'task' && kind !== 'todo') parts.push(f.place);
    return parts.join(' · ');
  }
  function labelFor(kind, f) {
    if (kind === 'doc') return '새 문서 · ' + (TPL_NAME[f && f.template] || '빈 문서');
    return (KINDS[kind] || {}).label || kind;
  }

  /* 각 앱의 자료 모양 (apps/*.js 의 저장 형식과 같게) */
  function record(kind, f) {
    const date = f.date || f.today;
    const timed = !!f.timed;
    const ev = { date, endDate: f.endDate && f.endDate > date ? f.endDate : '', allDay: !timed, start: timed ? f.start : '', end: timed ? (f.end || '') : '', place: f.place || '' };
    const title = titleFor(kind, f).slice(0, 80);
    if (kind === 'head') return { col: 'head-schedule', local: false, data: Object.assign({ title }, ev, { memo: '', kind: CAT_HEAD[f.category] || (f.category ? '기타' : '회의'), heads: (f.heads || []).slice() }) };
    if (kind === 'dept') return { col: 'schedule-events', local: false, data: Object.assign({ title }, ev, { owner: '', note: '', tags: [CAT_DEPT[f.category] || '기타'] }) };
    if (kind === 'mine') return { col: 'my-schedule-events', local: true, data: Object.assign({ title, kind: CAT_MINE[f.category] || '업무' }, ev, { note: '' }) };
    if (kind === 'task') return { col: 'schedule-tasks', local: false, data: { title: title.slice(0, 120), category: '주요업무', owner: '', due: date, status: '예정', progress: 0, detail: f.place ? '장소: ' + f.place : '' } };
    if (kind === 'todo') return { col: 'my-schedule-todos', local: true, data: { title: titleFor('todo', f).slice(0, 200), due: date, done: false, doneAt: '', note: '' } };
    if (kind === 'doc') return { col: 'docs', local: false, template: f.template || 'blank', title: f.docTitle || '' };
    if (kind === 'slides') return { col: 'slides', local: false, title: f.docTitle || '' };
    if (kind === 'sheet') return { col: 'sheets', local: false, title: f.docTitle || '' };
    if (kind === 'chart') return { col: 'charts', local: false, title: f.docTitle || '' };
    return null;
  }

  const api = { parse, record, previewFor, labelFor, titleFor, kinds: KINDS, normalize, mdLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (G && G.P) G.P.nl = Object.assign(G.P.nl || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
