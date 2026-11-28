/* 차트: 자료를 넣으면 어울리는 도표를 한 화면에 여러 개 보여 주고, 골라서 꾸미고 저장 */
(function () {
  'use strict';
  const P = window.P;
  if (!P) return;

  const COL = 'charts';
  const LIB = { chart: 'vendor/chartjs/chart.umd.min.js', xlsx: 'vendor/xlsx/xlsx.full.min.js' };
  const esc = P.esc;

  /* ================= 팔레트 (색각 이상 검증된 범주 팔레트) ================= */
  const PALETTES = {
    // 기본: 남색 먹 + 인주색으로 시작, 나머지는 명도 차가 있는 범주색
    base: { label: '기본', light: ['#1E2B5C', '#C43F15', '#2A8C82', '#C8901E', '#7A5BB8', '#5E8C3A', '#B8527A', '#8A8F99'], dark: ['#9FB0F5', '#F0743E', '#4FC1B4', '#E8B54F', '#C39BEB', '#8FCB6B', '#E58AAE', '#AEB3BD'] },
    cvd: { label: '색각 친화', light: ['#0072b2', '#e69f00', '#009e73', '#cc79a7', '#56b4e9', '#d55e00', '#7a6a00', '#555555'], dark: ['#3a9ad9', '#e69f00', '#14b88a', '#d98cb8', '#7cc6ef', '#ef7a2c', '#cfc05a', '#bbbbbb'] },
    calm: { label: '차분한 보고서', light: ['#2e4a7d', '#7a9cc6', '#c9873a', '#5b8c6b', '#a05c7b', '#8a8f99', '#4f7f8f', '#b9a26b'], dark: ['#7d9fd6', '#a9c3e3', '#e0a35c', '#7fb38f', '#c98aa6', '#aab0ba', '#7fb0c0', '#d6c08a'] }
  };
  const SEQ = { light: ['#EEF0F5', '#1E2B5C'], dark: ['#202329', '#9FB0F5'] };

  /* ================= 숫자 서식 (천 단위 콤마, 만/억) ================= */
  const UNITS = { auto: '자동(만·억)', none: '그대로', k: '천 단위', man: '만 단위', eok: '억 단위' };
  function trimNum(v, d) { return Number(v.toFixed(d)).toLocaleString('ko-KR', { maximumFractionDigits: d }); }
  function fmtNum(v, unit, maxAbs, suffix) {
    if (v == null || !isFinite(v)) return '';
    const sfx = suffix || '';
    const a = Math.abs(maxAbs != null ? maxAbs : v);
    let u = unit;
    if (u === 'auto') u = a >= 1e8 ? 'eok' : a >= 1e5 ? 'man' : 'none';
    if (u === 'eok') return trimNum(v / 1e8, Math.abs(v) >= 1e9 ? 1 : 2) + '억' + sfx;
    if (u === 'man') return trimNum(v / 1e4, Math.abs(v) >= 1e6 ? 0 : 1) + '만' + sfx;
    if (u === 'k') return trimNum(v / 1e3, 1) + '천' + sfx;
    return trimNum(v, Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 1 ? 2 : 4) + sfx;
  }
  const fullNum = (v, sfx) => (v == null ? '' : Number(v).toLocaleString('ko-KR', { maximumFractionDigits: 4 }) + (sfx || ''));

  /* ================= 자료 해석 ================= */
  function parseDelimited(text) {
    const first = text.split('\n', 5).join('\n');
    const d = first.includes('\t') ? '\t' : first.includes(',') ? ',' : first.includes(';') ? ';' : '\t';
    const rows = [];
    let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
      } else if (ch === '"' && cur === '') q = true;
      else if (ch === d) { row.push(cur.trim()); cur = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur.trim()); rows.push(row); row = []; cur = '';
      } else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur.trim()); rows.push(row); }
    return rows.filter((r) => r.some((x) => x !== ''));
  }
  const NUM_RE = /^([-+△▲]?)\s*(\d+(?:\.\d+)?)\s*(%|원|천원|만원|백만원|억원|건|명|개|회|점|시간|일|대|곳|kg|km|t|㎡)?$/;
  function parseNum(v) {
    if (typeof v === 'number') return isFinite(v) ? { n: v, sfx: '' } : null;
    if (v == null) return null;
    const s = String(v).trim().replace(/,/g, '').replace(/\s+/g, ' ');
    if (!s) return null;
    const m = NUM_RE.exec(s);
    if (!m) return null;
    let n = Number(m[2]);
    if (m[1] === '-' || m[1] === '△' || m[1] === '▲') n = -n;
    return { n, sfx: m[3] || '' };
  }
  const DATE_RE = /^(\d{4})\s*[-./년]\s*(\d{1,2})\s*(?:[-./월]\s*(\d{1,2})\s*일?)?\.?\s*월?$/;
  const PERIOD_RE = /^(\d{1,2}월|\d{4}년|\d{1,2}분기|\d분기|[1-4]Q|Q[1-4]|\d{4}\s*[-.]?\s*[1-4]Q|(\d{2,4}년\s*)?\d{1,2}월|(\d{2,4}년\s*)?[1-4]분기|상반기|하반기)$/i;
  function isDateLike(v) { const s = String(v == null ? '' : v).trim(); return DATE_RE.test(s) || PERIOD_RE.test(s); }
  const SKIP_HEAD = /^(연번|번호|순번|일련번호|no\.?|id|순위|비고)$/i;

  function analyze(columns, rows) {
    const nc = columns.length;
    const cols = columns.map((name, c) => {
      const vals = rows.map((r) => r[c]).filter((v) => v != null && String(v).trim() !== '');
      let num = 0, date = 0;
      const sfx = {};
      vals.forEach((v) => {
        const p = parseNum(v);
        if (p && !(typeof v === 'string' && DATE_RE.test(v.trim()))) { num++; if (p.sfx) sfx[p.sfx] = (sfx[p.sfx] || 0) + 1; }
        else if (isDateLike(v)) date++;
      });
      const n = vals.length || 1;
      let type = num / n >= 0.8 ? 'num' : date / n >= 0.8 ? 'date' : 'cat';
      if (SKIP_HEAD.test(String(name).trim())) type = 'skip';
      const unit = Object.keys(sfx).sort((a, b) => sfx[b] - sfx[a])[0] || '';
      return { name: String(name || '열' + (c + 1)), type, unit };
    });
    // 연번처럼 1,2,3… 증가하는 첫 숫자 열은 제외
    if (nc > 1 && cols[0].type === 'num' && rows.length > 2 && rows.every((r, i) => { const p = parseNum(r[0]); return p && p.n === i + 1; })) cols[0].type = 'skip';
    return cols;
  }
  function parseText(text) {
    const grid = parseDelimited(String(text || '').replace(/\r\n?/g, '\n'));
    if (!grid.length) return null;
    const w = Math.max(...grid.map((r) => r.length));
    grid.forEach((r) => { while (r.length < w) r.push(''); });
    const first = grid[0];
    const second = grid[1];
    const headerish = grid.length > 1 && first.some((v) => v !== '' && !parseNum(v)) &&
      (second ? second.some((v) => parseNum(v)) || first.every((v) => v === '' || !parseNum(v)) : true);
    const columns = headerish ? first.map((v, i) => v || (i === 0 ? '항목' : '열' + (i + 1))) : first.map((_, i) => '열' + (i + 1));
    const rows = headerish ? grid.slice(1) : grid;
    return { columns, rows };
  }
  function buildModel(data) {
    const types = data.types || analyze(data.columns, data.rows).map((c) => c.type);
    const auto = analyze(data.columns, data.rows);
    const cols = data.columns.map((name, i) => ({ name: String(name), type: types[i] || auto[i].type, unit: auto[i].unit }));
    const labelIdx = cols.findIndex((c) => c.type === 'cat' || c.type === 'date');
    const numIdx = cols.map((c, i) => (c.type === 'num' ? i : -1)).filter((i) => i >= 0);
    const rows = data.rows.slice(0, 2000);
    const labels = rows.map((r, i) => (labelIdx >= 0 ? String(r[labelIdx] == null ? '' : r[labelIdx]) : (i + 1) + '행'));
    const series = numIdx.map((c) => ({
      name: cols[c].name, unit: cols[c].unit,
      values: rows.map((r) => { const p = parseNum(r[c]); return p ? p.n : null; })
    }));
    const all = series.flatMap((s) => s.values).filter((v) => v != null);
    return {
      cols, labels, series, rows, labelIdx,
      labelName: labelIdx >= 0 ? cols[labelIdx].name : '행',
      timeLike: labelIdx >= 0 && cols[labelIdx].type === 'date',
      maxAbs: all.length ? Math.max(...all.map(Math.abs)) : 0,
      nonNeg: all.every((v) => v >= 0),
      minV: all.length ? Math.min(...all) : 0,
      tight: all.length > 1 && Math.min(...all) > 0 && (Math.max(...all) - Math.min(...all)) < 0.5 * Math.max(...all),
      ratio: series.some((s) => s.unit === '%' || /평균|율|률|점수|만족|지수|비율/.test(s.name)) || (all.length && Math.max(...all.map(Math.abs)) <= 10 && all.some((v) => !Number.isInteger(v))),
      n: rows.length
    };
  }

  /* ================= 예시 자료 ================= */
  const SAMPLES = [
    { id: 'monthly', title: '월별 민원 처리 건수', text: '월\t접수\t처리\n1월\t1240\t1180\n2월\t1105\t1090\n3월\t1388\t1302\n4월\t1290\t1275\n5월\t1452\t1398\n6월\t1510\t1466\n7월\t1620\t1540\n8월\t1580\t1561\n9월\t1404\t1390\n10월\t1366\t1352\n11월\t1298\t1270\n12월\t1189\t1175' },
    { id: 'budget', title: '부서별 예산 집행', text: '부서\t예산액\t집행액\n기획\t320000000\t251000000\n운영\t540000000\t498000000\n교육\t280000000\t143000000\n시설\t910000000\t612000000\n홍보\t120000000\t97000000\n정보화\t450000000\t401000000' },
    { id: 'survey', title: '교육 만족도(항목별)', text: '항목\t1기\t2기\t3기\n내용 구성\t4.2\t4.4\t4.6\n강사 전문성\t4.5\t4.6\t4.7\n교육 환경\t3.8\t4.0\t4.3\n시간 배분\t3.6\t3.9\t4.1\n실무 활용도\t4.0\t4.3\t4.5' },
    { id: 'share', title: '유형별 출동 비율', text: '유형\t건수\n화재\t182\n구조\t436\n구급\t1520\n생활안전\t611\n기타\t96' }
  ];

  /* ================= 차트 종류 ================= */
  const KINDS = {
    bar: { name: '세로 막대', why: '항목끼리 크기 비교' },
    hbar: { name: '가로 막대(순위)', why: '큰 순서로 정렬해 순위 보기' },
    stack: { name: '누적 막대', why: '전체와 구성 함께 보기' },
    stack100: { name: '100% 누적 막대', why: '항목별 구성 비율 비교' },
    line: { name: '꺾은선', why: '흐름과 추세 보기' },
    area: { name: '영역', why: '흐름과 양을 함께' },
    doughnut: { name: '도넛', why: '전체 중 비율' },
    pie: { name: '원', why: '전체 중 비율(항목 적을 때)' },
    combo: { name: '막대+꺾은선', why: '두 지표를 한 축에서 비교' },
    scatter: { name: '산점도', why: '두 숫자 사이의 관계' },
    radar: { name: '레이더', why: '여러 항목 점수 균형' },
    heat: { name: '표 히트맵', why: '값의 높낮이를 색으로' },
    kpi: { name: '지표 카드', why: '합계·평균·최대·최소 한눈에' },
    hist: { name: '분포(구간)', why: '값이 어느 구간에 몰렸는지' }
  };
  function recommend(m) {
    const S = m.series.length;
    const out = [];
    if (!S) return out;
    const many = m.n > 30;
    // 평균·점수·비율처럼 더할 수 없는 값이면 누적·원형을 빼고 추천
    const ratio = m.series.some((s) => s.unit === '%' || /평균|율|률|점수|만족|지수|비율/.test(s.name));
    const decimalSmall = m.maxAbs <= 10 && m.series.some((s) => s.values.some((v) => v != null && !Number.isInteger(v)));
    const additive = m.nonNeg && !ratio && !decimalSmall;
    out.push('bar');
    if (m.timeLike || m.n >= 8) out.push('line');
    if (!m.timeLike && m.n >= 3) out.push('hbar');
    if (S >= 2 && additive) out.push('stack', 'stack100');
    if (S >= 2) out.push('combo');
    if (additive && !m.timeLike && m.n >= 2 && m.n <= 12) out.push('doughnut');
    out.push('kpi');
    if (m.timeLike && additive) out.push('area');
    if (!m.timeLike && m.n >= 3 && m.n <= 12 && (S >= 2 || ratio || decimalSmall)) out.push('radar');
    if ((S >= 2 && m.n <= 60) || (S === 1 && m.n <= 40)) out.push('heat');
    if (S >= 2 && m.n >= 5) out.push('scatter');
    if (m.n >= 12 || m.labelIdx < 0) out.push('hist');
    if (additive && !m.timeLike && m.n <= 6) out.push('pie');
    if (m.n >= 5 && !out.includes('line')) out.push('line');
    if (S === 1 && m.n >= 3 && !out.includes('radar') && !m.timeLike && m.n <= 12) out.push('radar');
    const uniq = Array.from(new Set(out));
    if (many) return uniq.filter((k) => !['pie', 'radar', 'doughnut'].includes(k)).slice(0, 12);
    return uniq.slice(0, 12);
  }

  /* ================= 그리기 ================= */
  function isDark() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function themeColors(forExport) {
    if (forExport) return { text: '#1A1D26', muted: '#676B75', grid: '#ECE9E2', bg: '#ffffff', soft: '#F7F5F0', dark: false };
    const cs = getComputedStyle(document.documentElement);
    const g = (n, d) => (cs.getPropertyValue(n) || '').trim() || d;
    const dark = isDark();
    return { text: g('--text', '#1A1D26'), muted: g('--muted', '#676B75'), grid: dark ? g('--line', '#2B2E33') : '#ECE9E2', bg: g('--surface', '#ffffff'), soft: g('--surface-2', '#FAF9F6'), dark };
  }
  // Chart.js 기본값을 토큰에 맞춤 (테마가 바뀌면 다시 부름)
  function themeDefaults() {
    const C = window.Chart;
    if (!C || !C.defaults) return;
    const th = themeColors(false);
    C.defaults.font.family = getComputedStyle(document.body).fontFamily || 'sans-serif';
    C.defaults.font.size = 11.5;
    C.defaults.color = th.muted;
    C.defaults.borderColor = th.grid;
    const tt = C.defaults.plugins.tooltip;
    Object.assign(tt, {
      backgroundColor: th.dark ? '#ECE9E2' : '#1A1D26', titleColor: th.dark ? '#111214' : '#ffffff', bodyColor: th.dark ? '#111214' : '#ffffff',
      padding: 8, cornerRadius: 4, boxPadding: 4, displayColors: true, usePointStyle: true,
      titleFont: { weight: '650', size: 12 }, bodyFont: { size: 12 }
    });
  }
  function paletteOf(opts, th) { const p = PALETTES[opts.palette] || PALETTES.base; return th.dark ? p.dark : p.light; }
  function alpha(hex, a) {
    const h = hex.replace('#', '');
    return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
  }
  function topN(m, k) {
    // 원/도넛: 큰 순서 7개 + 기타
    const vals = m.series[0].values.map((v, i) => ({ v: v || 0, l: m.labels[i] }));
    if (vals.length <= k) return vals;
    const s = vals.slice().sort((a, b) => b.v - a.v);
    const head = s.slice(0, k - 1);
    head.push({ l: '기타', v: s.slice(k - 1).reduce((a, b) => a + b.v, 0) });
    return head;
  }

  // 값 표시 플러그인 (선택적 직접 레이블)
  const valueLabels = {
    id: 'pValues',
    afterDatasetsDraw(chart, args, o) {
      if (!o || !o.show) return;
      const { ctx } = chart;
      ctx.save();
      ctx.font = '600 ' + (o.size || 11) + 'px ' + (o.font || 'sans-serif');
      ctx.fillStyle = o.color || '#333';
      const type = chart.config.type;
      const shown = chart.data.datasets.filter((d, i) => !chart.getDatasetMeta(i).hidden && !d.pNoLabel);
      const points = shown.reduce((a, d) => a + d.data.length, 0);
      const stackedAll = chart.options.scales && chart.options.scales.x && chart.options.scales.x.stacked;
      if (type !== 'doughnut' && type !== 'pie' && !stackedAll && points > (o.max || 16)) { ctx.restore(); return; }
      chart.data.datasets.forEach((ds, di) => {
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden || ds.pNoLabel) return;
        const n = meta.data.length;
        if (type === 'line' && n > 16) return;
        meta.data.forEach((el, i) => {
          const raw = ds.data[i];
          const v = typeof raw === 'object' && raw ? raw.y : raw;
          if (v == null) return;
          if (type === 'doughnut' || type === 'pie') {
            const total = ds.data.reduce((a, b) => a + (b || 0), 0) || 1;
            const pct = (v / total) * 100;
            if (pct < 4) return;
            const p = el.tooltipPosition();
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(trimNum(pct, 1) + '%', p.x, p.y);
            return;
          }
          const text = o.pct ? trimNum(v, 0) + '%' : fmtNum(v, o.unit, o.maxAbs, '');
          const horiz = chart.options.indexAxis === 'y';
          const stacked = chart.options.scales && chart.options.scales.x && chart.options.scales.x.stacked;
          ctx.fillStyle = o.color || '#333';
          if (stacked && el.height != null) {
            const h = horiz ? Math.abs(el.x - el.base) : Math.abs(el.base - el.y);
            if (h < 18) return;
            const c = el.getCenterPoint();
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, c.x, c.y);
          } else if (horiz) {
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(text, el.x + 4, el.y);
          } else {
            ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillText(text, el.x, el.y - 4);
          }
        });
      });
      ctx.restore();
    }
  };
  const bgPlugin = {
    id: 'pBg',
    beforeDraw(chart, args, o) {
      if (!o || !o.color) return;
      const { ctx } = chart;
      ctx.save();
      ctx.fillStyle = o.color;
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.restore();
    }
  };

  function chartConfig(kind, m, opts, th) {
    const pal = paletteOf(opts, th);
    const font = getComputedStyle(document.body).fontFamily || 'sans-serif';
    const unit = opts.unit || 'auto';
    const maxAbs = m.maxAbs;
    const sfx0 = (m.series[0] && m.series[0].unit) || '';
    const tick = (v) => fmtNum(v, unit, maxAbs, '');
    const legendPos = opts.legend || 'top';
    const base = {
      responsive: !opts.fixed, maintainAspectRatio: false,
      animation: opts.animate === false ? false : { duration: 350 },
      devicePixelRatio: opts.dpr || undefined,
      layout: { padding: { top: opts.labels ? 18 : 6, right: 12, left: 4, bottom: 2 } },
      font: { family: font },
      plugins: {
        legend: { display: legendPos !== 'none', position: legendPos === 'none' ? 'top' : legendPos, align: 'start', labels: { sort: (a, b) => a.datasetIndex - b.datasetIndex, color: th.text, boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'rect', padding: 14, font: { family: font, size: 12 } } },
        title: { display: !!opts.title, text: opts.title || '', align: 'start', color: th.text, font: { family: font, size: opts.big ? 17 : 14, weight: '700' }, padding: { top: 2, bottom: 12 } },
        tooltip: {
          callbacks: {
            label: (c) => {
              const ds = c.dataset;
              const v = c.parsed && typeof c.parsed === 'object' ? (c.chart.options.indexAxis === 'y' ? c.parsed.x : c.parsed.y) : c.raw;
              if (kind === 'stack100') return ds.label + ': ' + trimNum(v, 1) + '% (' + fullNum(ds.pRaw && ds.pRaw[c.dataIndex], ds.pUnit) + ')';
              if (kind === 'scatter') return (c.raw.l ? c.raw.l + ' · ' : '') + fullNum(c.raw.x) + ', ' + fullNum(c.raw.y);
              return (ds.label ? ds.label + ': ' : '') + fullNum(kind === 'doughnut' || kind === 'pie' ? c.raw : v, ds.pUnit);
            }
          }
        },
        pValues: { show: !!opts.labels, unit, maxAbs, color: th.text, font, size: opts.big ? 12 : 10.5, pct: kind === 'stack100', max: opts.big ? 40 : 16 },
        pBg: { color: opts.bg || null }
      }
    };
    const axisCommon = { grid: { color: th.grid, drawTicks: false }, border: { display: false }, ticks: { color: th.muted, font: { family: font, size: 11 }, padding: 6 } };
    const valueAxis = Object.assign({}, axisCommon, { beginAtZero: true, ticks: Object.assign({}, axisCommon.ticks, { callback: (v) => tick(v), maxTicksLimit: 6 }) });
    const catAxis = Object.assign({}, axisCommon, { grid: { display: false }, ticks: Object.assign({}, axisCommon.ticks, { autoSkip: true, maxRotation: 0, callback: function (v) { const l = String(this.getLabelForValue(v)); return l.length > 10 ? l.slice(0, 9) + '…' : l; } }) });
    const ds = (s, i, extra) => Object.assign({
      label: s.name, data: s.values, pUnit: s.unit,
      backgroundColor: pal[i % pal.length], borderColor: pal[i % pal.length],
      borderWidth: 0, borderRadius: 2, borderSkipped: 'start', maxBarThickness: 44
    }, extra || {});
    const legendFor = (n) => (n > 1 ? base.plugins.legend : Object.assign({}, base.plugins.legend, { display: false }));
    let cfg;
    switch (kind) {
      case 'bar':
        cfg = { type: 'bar', data: { labels: m.labels, datasets: m.series.map((s, i) => ds(s, i)) }, options: { scales: { x: catAxis, y: valueAxis } } };
        cfg.options.plugins = { legend: legendFor(m.series.length) };
        break;
      case 'hbar': {
        const order = m.labels.map((l, i) => i).sort((a, b) => (m.series[0].values[b] || 0) - (m.series[0].values[a] || 0)).slice(0, 25);
        cfg = {
          type: 'bar',
          data: { labels: order.map((i) => m.labels[i]), datasets: [ds(m.series[0], 0, { data: order.map((i) => m.series[0].values[i]), borderSkipped: 'start' })] },
          options: { indexAxis: 'y', scales: { y: catAxis, x: valueAxis }, plugins: { legend: legendFor(1) } }
        };
        break;
      }
      case 'stack':
        cfg = { type: 'bar', data: { labels: m.labels, datasets: m.series.map((s, i) => ds(s, i, { borderRadius: 2, borderWidth: { top: 2 }, borderColor: th.bg })) }, options: { scales: { x: Object.assign({}, catAxis, { stacked: true }), y: Object.assign({}, valueAxis, { stacked: true }) } } };
        break;
      case 'stack100': {
        const totals = m.labels.map((_, i) => m.series.reduce((a, s) => a + (s.values[i] || 0), 0) || 1);
        cfg = {
          type: 'bar',
          data: { labels: m.labels, datasets: m.series.map((s, i) => ds(s, i, { data: s.values.map((v, j) => ((v || 0) / totals[j]) * 100), pRaw: s.values, borderRadius: 2, borderWidth: { top: 2 }, borderColor: th.bg })) },
          options: { scales: { x: Object.assign({}, catAxis, { stacked: true }), y: Object.assign({}, valueAxis, { stacked: true, max: 100, ticks: Object.assign({}, valueAxis.ticks, { callback: (v) => v + '%' }) }) } }
        };
        break;
      }
      case 'line':
      case 'area': {
        const area = kind === 'area';
        cfg = {
          type: 'line',
          data: {
            labels: m.labels,
            datasets: m.series.map((s, i) => ds(s, i, {
              borderWidth: 2, tension: 0.25, pointRadius: m.n > 24 ? 0 : 3, pointHoverRadius: 5, pointBackgroundColor: pal[i % pal.length], pointBorderColor: th.bg, pointBorderWidth: 1.5,
              fill: area ? (i === 0 ? 'origin' : '-1') : false, backgroundColor: area ? alpha(pal[i % pal.length], 0.28) : pal[i % pal.length], spanGaps: true
            }))
          },
          options: { interaction: { mode: 'index', intersect: false }, scales: { x: catAxis, y: Object.assign({}, valueAxis, { stacked: area && m.series.length > 1, beginAtZero: area || !m.tight }) } }
        };
        cfg.options.plugins = { legend: legendFor(m.series.length) };
        break;
      }
      case 'doughnut':
      case 'pie': {
        const parts = topN(m, 8);
        cfg = {
          type: kind,
          data: { labels: parts.map((p) => p.l), datasets: [{ label: m.series[0].name, pUnit: sfx0, data: parts.map((p) => p.v), backgroundColor: parts.map((_, i) => (parts[i].l === '기타' ? th.muted : pal[i % pal.length])), borderColor: th.bg, borderWidth: 2 }] },
          options: { cutout: kind === 'doughnut' ? '58%' : 0, plugins: { legend: Object.assign({}, base.plugins.legend, { display: legendPos !== 'none', position: legendPos === 'top' ? 'right' : legendPos }) } }
        };
        break;
      }
      case 'combo':
        cfg = {
          type: 'bar',
          data: { labels: m.labels, datasets: m.series.map((s, i) => (i === 0 ? ds(s, 0, { order: 2 }) : ds(s, i, { type: 'line', order: 1, borderWidth: 2, tension: 0.25, pointRadius: 3, pointBackgroundColor: pal[i % pal.length], pointBorderColor: th.bg, fill: false }))) },
          options: { scales: { x: catAxis, y: valueAxis } }
        };
        break;
      case 'scatter': {
        const [a, b] = m.series;
        const pts = a.values.map((x, i) => ({ x, y: b.values[i], l: m.labels[i] })).filter((p) => p.x != null && p.y != null);
        const xAxis = Object.assign({}, valueAxis, { beginAtZero: false, title: { display: true, text: a.name, color: th.muted }, ticks: Object.assign({}, valueAxis.ticks) });
        const yAxis = Object.assign({}, valueAxis, { beginAtZero: false, title: { display: true, text: b.name, color: th.muted } });
        cfg = { type: 'scatter', data: { datasets: [{ label: a.name + ' × ' + b.name, data: pts, backgroundColor: alpha(pal[0], 0.8), borderColor: th.bg, borderWidth: 1.5, pointRadius: 5, pointHoverRadius: 7, pNoLabel: true }] }, options: { scales: { x: xAxis, y: yAxis }, plugins: { legend: legendFor(1) } } };
        break;
      }
      case 'radar':
        cfg = {
          type: 'radar',
          data: { labels: m.labels, datasets: m.series.slice(0, 3).map((s, i) => ({ label: s.name, data: s.values, pUnit: s.unit, borderColor: pal[i], backgroundColor: alpha(pal[i], 0.16), borderWidth: 2, pointRadius: 3, pointBackgroundColor: pal[i], pNoLabel: true })) },
          options: { scales: { r: { beginAtZero: !m.tight, suggestedMin: m.tight ? Math.floor(m.minV - (m.maxAbs - m.minV) * 0.6) : undefined, grid: { color: th.grid }, angleLines: { color: th.grid }, pointLabels: { color: th.text, font: { family: font, size: 11 } }, ticks: { color: th.muted, backdropColor: 'transparent', callback: (v) => tick(v), maxTicksLimit: 5 } } }, plugins: { legend: legendFor(Math.min(3, m.series.length)) } }
        };
        break;
      case 'hist': {
        const vals = m.series[0].values.filter((v) => v != null);
        const k = Math.max(4, Math.min(14, Math.ceil(Math.log2(vals.length || 1) + 1)));
        const lo = Math.min(...vals), hi = Math.max(...vals);
        const w = (hi - lo) / k || 1;
        const bins = Array.from({ length: k }, () => 0);
        vals.forEach((v) => { bins[Math.min(k - 1, Math.floor((v - lo) / w))]++; });
        const lab = bins.map((_, i) => fmtNum(lo + w * i, unit, maxAbs) + '~');
        cfg = { type: 'bar', data: { labels: lab, datasets: [ds({ name: m.series[0].name + ' 개수', values: bins, unit: '개' }, 0, { categoryPercentage: 1, barPercentage: 0.96, borderRadius: 2 })] }, options: { scales: { x: catAxis, y: Object.assign({}, valueAxis, { ticks: Object.assign({}, valueAxis.ticks, { callback: (v) => (Number.isInteger(v) ? v : '') }) }) }, plugins: { legend: legendFor(1) } } };
        cfg.options.plugins.pValues = Object.assign({}, base.plugins.pValues, { unit: 'none' });
        break;
      }
      default:
        return null;
    }
    cfg.options = deepMerge(base, cfg.options);
    cfg.plugins = [valueLabels, bgPlugin];
    return cfg;
  }
  function deepMerge(a, b) {
    const out = Array.isArray(a) ? a.slice() : Object.assign({}, a);
    for (const k in b) {
      const v = b[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && typeof v !== 'function' && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) out[k] = deepMerge(a[k], v);
      else out[k] = v;
    }
    return out;
  }

  // Chart.js가 없는 종류는 캔버스에 직접 그림
  function drawCustom(kind, canvas, m, opts, th, w, h, dpr) {
    const ctx = canvas.getContext('2d');
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (opts.bg) { ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, w, h); }
    const font = getComputedStyle(document.body).fontFamily || 'sans-serif';
    let top = 6;
    if (opts.title) {
      ctx.fillStyle = th.text; ctx.font = '700 ' + (opts.big ? 17 : 14) + 'px ' + font; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(opts.title, 10, 6);
      top = opts.big ? 34 : 28;
    }
    const unit = opts.unit || 'auto';
    if (kind === 'kpi') {
      const s = m.series[0];
      const vals = s.values.map((v, i) => ({ v, l: m.labels[i] })).filter((x) => x.v != null);
      const sum = vals.reduce((a, b) => a + b.v, 0);
      const mx = vals.reduce((a, b) => (b.v > a.v ? b : a), vals[0] || { v: 0, l: '' });
      const mn = vals.reduce((a, b) => (b.v < a.v ? b : a), vals[0] || { v: 0, l: '' });
      const tiles = m.ratio ? [
        ['평균', fmtNum(vals.length ? sum / vals.length : 0, 'none', null, s.unit), s.name + ' · ' + vals.length + '개 항목'],
        ['최대', fmtNum(mx.v, 'none', null, s.unit), mx.l],
        ['최소', fmtNum(mn.v, 'none', null, s.unit), mn.l],
        ['차이(최대−최소)', fmtNum(mx.v - mn.v, 'none', null, s.unit), '항목 간 편차']
      ] : [
        ['합계', fmtNum(sum, unit, Math.abs(sum), s.unit), s.name + ' · ' + vals.length + '개 항목'],
        ['평균', fmtNum(vals.length ? sum / vals.length : 0, unit, m.maxAbs, s.unit), '항목당'],
        ['최대', fmtNum(mx.v, unit, m.maxAbs, s.unit), mx.l],
        ['최소', fmtNum(mn.v, unit, m.maxAbs, s.unit), mn.l]
      ];
      if (m.timeLike && vals.length >= 2 && !m.ratio) {
        const a = vals[vals.length - 2].v, b = vals[vals.length - 1].v;
        const ch = a ? ((b - a) / Math.abs(a)) * 100 : 0;
        tiles[3] = ['직전 대비', (ch >= 0 ? '▲ ' : '▼ ') + trimNum(Math.abs(ch), 1) + '%', vals[vals.length - 1].l + ' 기준'];
      }
      const cols = w >= 260 ? 2 : 1, rowsN = Math.ceil(tiles.length / cols);
      const gap = 10, tw = (w - gap * (cols + 1)) / cols, thh = Math.min(120, (h - top - gap * (rowsN + 1)) / rowsN);
      const big = Math.max(15, Math.min(30, thh * 0.3, tw / 7));
      tiles.forEach((t, i) => {
        const x = gap + (i % cols) * (tw + gap), y = top + gap + Math.floor(i / cols) * (thh + gap);
        ctx.fillStyle = th.soft;
        roundRect(ctx, x, y, tw, thh, 6); ctx.fill();
        ctx.strokeStyle = th.grid; ctx.lineWidth = 1; ctx.stroke();
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillStyle = th.muted; ctx.font = '600 12px ' + font; ctx.fillText(t[0], x + 12, y + thh * 0.12, tw - 20);
        ctx.textBaseline = 'middle';
        ctx.fillStyle = th.text; ctx.font = '700 ' + big + 'px ' + font; ctx.fillText(t[1], x + 12, y + thh * 0.52, tw - 20);
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = th.muted; ctx.font = '12px ' + font; ctx.fillText(String(t[2] || '').slice(0, 24), x + 12, y + thh - thh * 0.1, tw - 20);
      });
      return;
    }
    if (kind === 'heat') {
      const S = m.series.slice(0, 8);
      const n = Math.min(m.n, 40);
      const left = Math.min(140, Math.max(60, w * 0.24)), headH = 26;
      const cw = (w - left - 8) / S.length, ch = Math.max(12, (h - top - headH - 6) / n);
      const seq = th.dark ? SEQ.dark : SEQ.light;
      const lerp = (t) => {
        const a = seq[0].replace('#', ''), b = seq[1].replace('#', '');
        const c = (k) => Math.round(parseInt(a.slice(k, k + 2), 16) + (parseInt(b.slice(k, k + 2), 16) - parseInt(a.slice(k, k + 2), 16)) * t);
        return [c(0), c(2), c(4)];
      };
      ctx.font = '600 11px ' + font; ctx.textBaseline = 'middle';
      S.forEach((s, j) => { ctx.fillStyle = th.muted; ctx.textAlign = 'center'; ctx.fillText(s.name.slice(0, 10), left + cw * j + cw / 2, top + headH / 2); });
      S.forEach((s, j) => {
        const vs = s.values.slice(0, n).filter((v) => v != null);
        const lo = Math.min(...vs), hi = Math.max(...vs);
        for (let i = 0; i < n; i++) {
          const v = s.values[i];
          const x = left + cw * j, y = top + headH + ch * i;
          if (v == null) continue;
          const t = hi === lo ? 0.6 : (v - lo) / (hi - lo);
          const [r, g, b] = lerp(0.08 + t * 0.92);
          ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
          roundRect(ctx, x + 1, y + 1, cw - 2, ch - 2, 3); ctx.fill();
          if (ch >= 14 && cw >= 40) {
            ctx.fillStyle = (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1b2233' : '#ffffff';
            ctx.font = '600 ' + Math.min(12, ch * 0.6) + 'px ' + font; ctx.textAlign = 'center';
            ctx.fillText(fmtNum(v, unit, m.maxAbs, ''), x + cw / 2, y + ch / 2);
          }
        }
      });
      ctx.fillStyle = th.text; ctx.textAlign = 'right'; ctx.font = Math.min(12, ch * 0.62) + 'px ' + font;
      for (let i = 0; i < n; i++) {
        const l = m.labels[i];
        ctx.fillText(l.length > 12 ? l.slice(0, 11) + '…' : l, left - 8, top + headH + ch * i + ch / 2);
      }
    }
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  const CUSTOM = { kpi: 1, heat: 1 };

  // 캔버스 하나에 차트 그리기 → 정리 함수 반환
  function renderInto(box, kind, m, opts) {
    box.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', (opts.title || KINDS[kind].name) + ' 차트');
    box.appendChild(canvas);
    const th = themeColors(false);
    if (CUSTOM[kind]) {
      const draw = () => { const r = box.getBoundingClientRect(); if (r.width) drawCustom(kind, canvas, m, opts, th, r.width, r.height, window.devicePixelRatio || 1); };
      draw();
      const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(draw) : null;
      if (ro) ro.observe(box);
      return { destroy() { if (ro) ro.disconnect(); }, canvas };
    }
    const cfg = chartConfig(kind, m, opts, th);
    const chart = new window.Chart(canvas, cfg);
    return { destroy() { chart.destroy(); }, canvas, chart };
  }
  // 2배 해상도·흰 배경 PNG 만들기
  function exportPNG(kind, m, opts, w, h, scale) {
    return new Promise((resolve) => {
      const W = w || 1200, H = h || 720, dpr = scale || 2;
      const o = Object.assign({}, opts, { bg: '#ffffff', big: true, animate: false, fixed: true, dpr });
      const th = themeColors(true);
      const holder = document.createElement('div');
      holder.style.cssText = 'position:fixed;left:-99999px;top:0;width:' + W + 'px;height:' + H + 'px;';
      document.body.appendChild(holder);
      const canvas = document.createElement('canvas');
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      holder.appendChild(canvas);
      let chart = null;
      if (CUSTOM[kind]) drawCustom(kind, canvas, m, o, th, W, H, dpr);
      else {
        canvas.width = W; canvas.height = H;
        const cfg = chartConfig(kind, m, o, th);
        cfg.options.responsive = false;
        cfg.options.devicePixelRatio = dpr;
        chart = new window.Chart(canvas, cfg);
      }
      canvas.toBlob((blob) => {
        if (chart) chart.destroy();
        holder.remove();
        resolve(blob);
      }, 'image/png');
    });
  }
  function thumbData(kind, m, opts) {
    return exportPNG(kind, m, Object.assign({}, opts), 480, 300, 1).then((blob) => new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.readAsDataURL(blob);
    }));
  }

  /* ================= 화면 ================= */
  async function mountStudio(root, ctx, fileId, newFolder) {
    root.innerHTML = '<div class="page charts-page"><div class="charts-loading">불러오는 중…</div></div>';
    try { await P.loadScript(LIB.chart); } catch (e) {
      root.innerHTML = '<div class="page"><div class="empty card"><h2>차트 라이브러리를 불러오지 못했습니다</h2><p>vendor/chartjs 파일을 확인하세요.</p></div></div>';
      return null;
    }
    let file = null;
    if (fileId) {
      try { file = await P.store.get(COL, fileId); } catch (e) { file = null; }
      if (!root.isConnected) return null;
      if (!file || !file.data) {
        root.innerHTML = '<div class="page"><div class="empty card"><h2>차트를 찾을 수 없습니다</h2><p>삭제되었거나 다른 저장 위치에 있을 수 있습니다.</p><a class="btn btn-primary" href="#/charts">차트 목록으로</a></div></div>';
        return null;
      }
    }
    const folder = file ? (file.folder || null) : (newFolder || null);
    const live = [];
    const state = {
      data: null, source: '', title: '',
      opts: { palette: P.settings.get('charts.palette', 'base'), unit: P.settings.get('charts.unit', 'auto'), labels: P.settings.get('charts.labels', false), legend: 'top' }
    };
    themeDefaults();
    const TYPE_L = { cat: '항목', num: '숫자', date: '날짜', skip: '빼기' };
    const smpMeta = (smp) => { const d = parseText(smp.text); return d.rows.length + '행 · ' + d.columns.length + '열'; };
    root.innerHTML =
      '<div class="page charts-page">' +
        '<div class="page-head charts-head"><div class="charts-head-l">' +
          '<a class="btn btn-ghost charts-back" href="' + P.files.backHref('charts', folder) + '" title="차트 목록" aria-label="차트 목록">' + BACK + '<span>목록</span></a>' +
          '<input class="charts-name" type="text" maxlength="120" aria-label="차트 제목" placeholder="차트 제목">' +
          '<span class="charts-save" role="status" aria-live="polite"></span></div>' +
          '<div class="toolbar charts-head-r"><span class="charts-io"></span><button type="button" class="btn btn-primary" data-act="save">' + SAVE_IC + '<span>저장</span></button></div></div>' +
        '<div class="charts-studio">' +
          '<aside class="charts-side">' +
            '<section class="charts-panel charts-input">' +
              '<div class="charts-panel-head"><h2 class="charts-h2">자료</h2>' +
                '<div class="seg charts-tabs" role="tablist" aria-label="자료 넣는 방법">' +
                  '<button type="button" data-tab="paste" role="tab" aria-selected="true">붙여넣기</button>' +
                  '<button type="button" data-tab="file" role="tab" aria-selected="false">파일</button>' +
                  '<button type="button" data-tab="sample" role="tab" aria-selected="false">예시</button>' +
                '</div></div>' +
              '<div class="charts-pane" data-pane="paste">' +
                '<textarea class="charts-paste" rows="7" spellcheck="false" aria-label="표 붙여넣기" placeholder="엑셀·한글 표를 복사해 붙여넣기&#10;&#10;월	접수	처리&#10;1월	1240	1180&#10;2월	1105	1090"></textarea>' +
                '<div class="charts-draw"><button type="button" class="btn btn-primary btn-sm" data-act="draw">차트 그리기</button><span class="charts-hint"><kbd class="kbd">Ctrl</kbd><kbd class="kbd">Enter</kbd></span></div>' +
              '</div>' +
              '<div class="charts-pane" data-pane="file" hidden>' +
                '<label class="charts-drop"><input type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" hidden>' + P.icons.upload + '<b>XLSX·CSV 고르기</b><span>또는 여기로 끌어다 놓기</span></label>' +
              '</div>' +
              '<div class="charts-pane" data-pane="sample" hidden><div class="list charts-samples">' +
                SAMPLES.map((smp) => '<button type="button" class="list-row" data-sample="' + smp.id + '"><span class="list-row-main"><b>' + esc(smp.title) + '</b></span><span class="list-row-end">' + smpMeta(smp) + '</span></button>').join('') +
              '</div></div>' +
            '</section>' +
            '<section class="charts-panel charts-data" hidden>' +
              '<div class="charts-panel-head"><h2 class="charts-h2">열</h2><span class="charts-src"></span><span class="charts-dim tnum"></span></div>' +
              '<div class="charts-table-wrap"><table class="charts-table"></table></div>' +
            '</section>' +
          '</aside>' +
          '<div class="charts-main">' +
            '<div class="charts-ph"><div class="charts-ph-grid"><div class="charts-ph-main empty-art"><div class="fx-img-slot" data-slot="empty-charts"></div><div class="empty-txt"><h3>표를 넣으면 차트가 여기 그려집니다</h3><p>막대·꺾은선·원형 가운데 자료에 맞는 것을 골라 한꺼번에 보여 줍니다.</p></div></div><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i></div></div>' +
            '<div class="charts-result" hidden>' +
              '<div class="charts-opts" role="group" aria-label="차트 옵션">' +
                '<label class="charts-opt"><span>색</span><select data-opt="palette">' + Object.keys(PALETTES).map((k) => '<option value="' + k + '">' + PALETTES[k].label + '</option>').join('') + '</select><span class="charts-sw" aria-hidden="true"></span></label>' +
                '<label class="charts-opt"><span>단위</span><select data-opt="unit">' + Object.keys(UNITS).map((k) => '<option value="' + k + '">' + UNITS[k] + '</option>').join('') + '</select></label>' +
                '<label class="charts-chk"><input type="checkbox" data-opt="labels"> 값 표시</label>' +
                '<span class="charts-count tnum"></span>' +
              '</div>' +
              '<div class="charts-grid"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    const $ = (s) => root.querySelector(s);
    const grid = $('.charts-grid');
    const paste = $('.charts-paste');
    const optsBar = $('.charts-opts');
    optsBar.querySelector('[data-opt="palette"]').value = state.opts.palette;
    optsBar.querySelector('[data-opt="unit"]').value = state.opts.unit;
    optsBar.querySelector('[data-opt="labels"]').checked = !!state.opts.labels;
    const swatchHTML = (pal) => pal.slice(0, 6).map((c) => '<i style="background:' + c + '"></i>').join('');
    function syncSwatch() { optsBar.querySelector('.charts-sw').innerHTML = swatchHTML(paletteOf(state.opts, themeColors(false))); }
    syncSwatch();

    function clearLive() { while (live.length) { try { live.pop().destroy(); } catch (e) { /* 무시 */ } } }

    function setData(data, source, opt) {
      if (!data || !data.columns || !data.rows || !data.rows.length) { P.ui.toast('표를 찾지 못했습니다. 첫 행에 제목, 아래에 값을 넣어 주세요.', 'warn'); return; }
      state.data = { columns: data.columns.map(String), rows: data.rows.slice(0, 2000), types: data.types || null };
      state.source = source || '';
      state.title = data.title || '';
      if (state.title && !nameIn.value.trim()) nameIn.value = state.title;
      drawAll();
      if (!opt || !opt.quiet) markDirty();
    }
    function model() { return buildModel(state.data); }
    function cellText(v, type) {
      if (v == null) return '';
      if (typeof v === 'number') return v.toLocaleString('ko-KR');
      if (type === 'num') { const p = parseNum(v); if (p && /^[-+]?[\d,]+(\.\d+)?$/.test(String(v).trim())) return p.n.toLocaleString('ko-KR', { maximumFractionDigits: 4 }); }
      return v;
    }
    function drawTable(m) {
      const t = $('.charts-table');
      const head = '<thead><tr>' + m.cols.map((c, i) => '<th class="' + (c.type === 'num' ? 'num' : '') + '"><span>' + esc(c.name) + '</span><select class="charts-type" data-type="' + c.type + '" data-col="' + i + '" aria-label="' + esc(c.name) + ' 열 종류">' +
        [['cat', TYPE_L.cat], ['num', TYPE_L.num], ['date', TYPE_L.date], ['skip', TYPE_L.skip]].map(([v, l]) => '<option value="' + v + '"' + (c.type === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></th>').join('') + '</tr></thead>';
      const body = '<tbody>' + state.data.rows.slice(0, 6).map((r) => '<tr>' + m.cols.map((c, i) => '<td class="' + (c.type === 'num' ? 'num' : '') + (c.type === 'skip' ? ' skip' : '') + '">' + esc(cellText(r[i], c.type)) + '</td>').join('') + '</tr>').join('') +
        (state.data.rows.length > 6 ? '<tr><td colspan="' + m.cols.length + '" class="charts-more">+ ' + (state.data.rows.length - 6) + '행</td></tr>' : '') + '</tbody>';
      t.innerHTML = head + body;
      $('.charts-src').textContent = state.source;
      $('.charts-src').title = state.source;
      $('.charts-dim').textContent = state.data.rows.length + '행 · ' + m.cols.length + '열';
    }
    function drawAll() {
      clearLive();
      themeDefaults();
      syncSwatch();
      const m = model();
      $('.charts-result').hidden = false;
      $('.charts-data').hidden = false;
      $('.charts-ph').hidden = true;
      drawTable(m);
      const kinds = recommend(m);
      if (!m.series.length) {
        grid.innerHTML = '<div class="empty"><h3>숫자 열이 없습니다</h3><p>왼쪽 표에서 열 종류를 숫자로 바꿔 주세요.</p></div>';
        $('.charts-count').textContent = '';
        return;
      }
      $('.charts-count').textContent = kinds.length + '개';
      state.kinds = kinds;
      grid.innerHTML = kinds.map((k, i) => '<article class="charts-card' + (i === 0 ? ' is-lead' : '') + (k === pickedKind(kinds) ? ' on' : '') + '" data-kind="' + k + '">' +
        '<header><h3>' + KINDS[k].name + '</h3>' + (i === 0 ? '<span class="badge badge-accent">추천</span>' : '') + '<span class="charts-why">' + KINDS[k].why + '</span></header>' +
        '<button type="button" class="charts-canvas" data-open="' + k + '" aria-label="' + KINDS[k].name + ' 편집"></button>' +
        '<footer><button type="button" class="btn btn-ghost btn-sm" data-open="' + k + '">' + EDIT + '편집</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-png="' + k + '" title="PNG로 내려받기">' + P.icons.download + 'PNG</button>' +
        '<button type="button" class="btn btn-ghost btn-sm charts-pick" data-pick="' + k + '" aria-pressed="' + (k === pickedKind(kinds) ? 'true' : 'false') + '" title="이 차트로 저장">' + PICK + '<span>' + (k === pickedKind(kinds) ? '고름' : '고르기') + '</span></button></footer>' +
        '</article>').join('');
      grid.querySelectorAll('.charts-card').forEach((card) => {
        const k = card.dataset.kind;
        try { live.push(renderInto(card.querySelector('.charts-canvas'), k, m, Object.assign({}, state.opts))); }
        catch (e) { console.error(e); card.querySelector('.charts-canvas').innerHTML = '<p class="muted">그릴 수 없는 자료입니다.</p>'; }
      });
    }
    function defaultTitle(kind, m) {
      const base = state.title || (m.series.length === 1 ? m.series[0].name : m.series.slice(0, 3).map((s) => s.name).join('·'));
      return base + (m.labelIdx >= 0 && !state.title ? ' (' + m.labelName + '별)' : '');
    }
    function safeName(s) { return String(s || '차트').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60); }
    async function savePNG(kind, m, opts) {
      const blob = await exportPNG(kind, m, opts);
      P.ui.download(safeName(opts.title || KINDS[kind].name) + '.png', blob, 'image/png');
      P.ui.toast('PNG(2배 해상도)로 내려받았습니다.', 'ok');
    }
    async function copyPNG(kind, m, opts) {
      try {
        if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) throw new Error('unsupported');
        const blob = await exportPNG(kind, m, opts);
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
        P.ui.toast('그림을 복사했습니다. 한글·PPT에 Ctrl+V로 붙여넣으세요.', 'ok');
      } catch (e) {
        P.ui.toast('이 브라우저에서는 그림 복사가 막혀 있습니다. PNG로 내려받아 넣어 주세요.', 'warn');
      }
    }
    function pickedKind(kinds) {
      const ks = kinds || state.kinds || [];
      return state.picked && (ks.includes(state.picked) || KINDS[state.picked]) ? state.picked : ks[0] || 'bar';
    }
    function setPicked(k) {
      state.picked = k;
      grid.querySelectorAll('.charts-card').forEach((c) => {
        const onn = c.dataset.kind === k;
        c.classList.toggle('on', onn);
        const b = c.querySelector('[data-pick]');
        if (b) { b.setAttribute('aria-pressed', String(onn)); b.querySelector('span').textContent = onn ? '고름' : '고르기'; }
      });
    }
    /* ---------- 파일 저장 ---------- */
    const nameIn = $('.charts-name');
    const saveEl = $('.charts-save');
    let saveTimer = null;
    let saving = Promise.resolve();
    function setSave(st, txt) { saveEl.dataset.state = st; saveEl.textContent = txt; }
    function markDirty() {
      if (!state.data) return;
      if (!fileId) { setSave('new', '저장 전'); return; }
      setSave('dirty', '저장 안 됨');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveFile(), 1200);
    }
    function fileTitle() {
      const m = model();
      return nameIn.value.trim() || state.opts.title || defaultTitle(pickedKind(), m);
    }
    function saveFile(over) {
      saving = saving.then(async () => {
        clearTimeout(saveTimer);
        if (!state.data) { P.ui.toast('먼저 자료를 넣어 차트를 그려 주세요.', 'warn'); return false; }
        const m = model();
        const kind = (over && over.kind) || pickedKind();
        const o = Object.assign({}, state.opts, over && over.opts);
        const title = (over && over.opts && over.opts.title) || fileTitle();
        o.title = title;
        if (!nameIn.value.trim() || (over && over.opts && over.opts.title)) nameIn.value = title;
        let thumb = '';
        try { thumb = await thumbData(kind, m, o); } catch (e) { thumb = ''; }
        const isNew = !fileId;
        const id = fileId || P.store.uid();
        const rec = {
          title, kind, opts: { palette: o.palette, unit: o.unit, labels: !!o.labels, legend: o.legend || 'top', title },
          data: state.data, thumb, source: state.source, folder,
          createdAt: (file && file.createdAt) || new Date().toISOString()
        };
        setSave('saving', '저장 중…');
        try {
          await P.store.put(COL, id, rec);
          file = rec;
          fileId = id;
          state.opts.title = title;
          setSave('saved', '저장됨');
          if (isNew) {
            try { history.replaceState(null, '', '#/charts/' + encodeURIComponent(id)); } catch (e) { /* 무시 */ }
            P.ui.toast('"' + title + '" 차트를 저장했습니다.', 'ok');
          }
          return true;
        } catch (e) { setSave('error', '저장 실패'); return false; }
      });
      return saving;
    }

    // 크게 보기·꾸미기
    function openBig(kind, data, preset, savedId) {
      const m = buildModel(data);
      const allKinds = Object.keys(KINDS).filter((k) => {
        if (['stack', 'stack100', 'combo', 'scatter', 'heat'].includes(k) && m.series.length < 2) return k === 'heat';
        return true;
      });
      const opts = Object.assign({}, state.opts, { legend: 'top', title: defaultTitle(kind, m) }, preset || {}, { big: true });
      const body = document.createElement('div');
      body.className = 'charts-big';
      const opt = (list, v) => list.map(([val, l]) => '<option value="' + val + '"' + (val === v ? ' selected' : '') + '>' + l + '</option>').join('');
      body.innerHTML =
        '<div class="charts-big-stage"><div class="charts-big-canvas"></div></div>' +
        '<div class="charts-big-ctl charts-insp">' +
          '<div class="field"><label for="cb-title">제목</label><input id="cb-title" data-b="title" value="' + esc(opts.title) + '"></div>' +
          '<div class="field"><label for="cb-kind">종류</label><select id="cb-kind" data-b="kind">' + opt(allKinds.map((x) => [x, KINDS[x].name]), kind) + '</select></div>' +
          '<div class="field"><label for="cb-pal">색</label><select id="cb-pal" data-b="palette">' + opt(Object.keys(PALETTES).map((x) => [x, PALETTES[x].label]), opts.palette) + '</select><div class="charts-swatch" aria-hidden="true"></div></div>' +
          '<div class="charts-insp-row">' +
            '<div class="field"><label for="cb-legend">범례</label><select id="cb-legend" data-b="legend">' + opt([['top', '위'], ['bottom', '아래'], ['right', '오른쪽'], ['none', '숨김']], opts.legend) + '</select></div>' +
            '<div class="field"><label for="cb-unit">단위</label><select id="cb-unit" data-b="unit">' + opt(Object.keys(UNITS).map((x) => [x, UNITS[x]]), opts.unit) + '</select></div>' +
          '</div>' +
          '<label class="charts-chk charts-big-chk"><input type="checkbox" data-b="labels"' + (opts.labels ? ' checked' : '') + '> 값 표시</label>' +
          '<p class="charts-insp-meta tnum">' + m.n + '행 · 계열 ' + m.series.length + '개</p>' +
        '</div>';
      let cur = null;
      let k = kind;
      const box = body.querySelector('.charts-big-canvas');
      const redraw = () => {
        if (cur) cur.destroy();
        try { cur = renderInto(box, k, m, opts); } catch (e) { console.error(e); box.innerHTML = '<p class="muted">그릴 수 없는 종류입니다.</p>'; cur = null; }
        const pal = paletteOf(opts, themeColors(false));
        body.querySelector('.charts-swatch').innerHTML = pal.map((c) => '<i style="background:' + c + '"></i>').join('');
      };
      body.addEventListener('input', (e) => {
        const f = e.target.dataset.b;
        if (!f) return;
        if (f === 'kind') k = e.target.value;
        else if (f === 'labels') opts.labels = e.target.checked;
        else opts[f] = e.target.value;
        clearTimeout(body._t);
        body._t = setTimeout(redraw, f === 'title' ? 250 : 0);
      });
      const actions = [
        { label: 'PNG 저장', onClick: () => { savePNG(k, m, opts); return false; } },
        { label: '그림 복사', onClick: () => { copyPNG(k, m, opts); return false; } }
      ];
      actions.push({ label: '차트 저장', primary: true, onClick: async () => {
        // 크게 본 종류·꾸밈을 이 파일의 차트로 저장
        const o = { palette: opts.palette, unit: opts.unit, labels: !!opts.labels, legend: opts.legend, title: opts.title };
        state.opts = Object.assign(state.opts, { palette: o.palette, unit: o.unit, labels: o.labels, legend: o.legend });
        state.opts.title = o.title;
        nameIn.value = o.title || nameIn.value;
        setPicked(k);
        const ok = await saveFile({ kind: k, opts: o });
        if (ok && !fileId) return false;
        optsBar.querySelector('[data-opt="palette"]').value = state.opts.palette;
        optsBar.querySelector('[data-opt="unit"]').value = state.opts.unit;
        optsBar.querySelector('[data-opt="labels"]').checked = !!state.opts.labels;
        if (state.data) drawAll();
      } });
      P.ui.modal({ title: '차트 편집', body, wide: true, actions, onClose: () => { if (cur) cur.destroy(); cur = null; } });
      requestAnimationFrame(redraw);
    }

    /* ---------- 입력 ---------- */
    function showTab(t) {
      root.querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === t; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
      root.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== t; });
    }
    async function readFile(file) {
      try {
        const buf = await file.arrayBuffer();
        if (/\.(csv|tsv|txt)$/i.test(file.name)) {
          let text;
          try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { text = new TextDecoder('euc-kr').decode(buf); }
          setData(parseText(text.replace(/^﻿/, '')), file.name);
          return;
        }
        await P.loadScript(LIB.xlsx);
        const wb = window.XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, blankrows: false, defval: '' });
        const text = aoa.map((r) => r.map((v) => String(v).replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
        setData(parseText(text), file.name + ' · ' + wb.SheetNames[0]);
      } catch (e) {
        console.error(e);
        P.ui.toast('파일을 읽지 못했습니다: ' + (e.message || e), 'error');
      }
    }
    root.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) { showTab(t.dataset.tab); return; }
      const s = e.target.closest('[data-sample]');
      if (s) { root.querySelectorAll('[data-sample]').forEach((x) => x.setAttribute('aria-current', String(x === s))); const smp = SAMPLES.find((x) => x.id === s.dataset.sample); const d = parseText(smp.text); d.title = smp.title; setData(d, '예시: ' + smp.title); return; }
      const a = e.target.closest('[data-act="draw"]');
      if (a) { setData(parseText(paste.value), '붙여넣은 자료'); return; }
      const op = e.target.closest('[data-open]');
      if (op) {
        openBig(op.dataset.open, state.data);
        return;
      }
      const pk = e.target.closest('[data-pick]');
      if (pk) { setPicked(pk.dataset.pick); markDirty(); return; }
      const sb = e.target.closest('[data-act="save"]');
      if (sb) { P.ui.busy(sb, () => saveFile()); return; }
      const pn = e.target.closest('[data-png]');
      if (pn) { const m = model(); P.ui.busy(pn, () => savePNG(pn.dataset.png, m, Object.assign({}, state.opts, { title: defaultTitle(pn.dataset.png, m) }))).catch((err) => console.error(err)); return; }
    });
    paste.addEventListener('paste', () => setTimeout(() => { if (paste.value.trim()) setData(parseText(paste.value), '붙여넣은 자료'); }, 0));
    paste.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setData(parseText(paste.value), '붙여넣은 자료'); } });
    const fileIn = root.querySelector('.charts-drop input');
    fileIn.addEventListener('change', () => { if (fileIn.files[0]) readFile(fileIn.files[0]); fileIn.value = ''; });
    const drop = root.querySelector('.charts-drop');
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) readFile(f); });
    optsBar.addEventListener('change', (e) => {
      const k = e.target.dataset.opt;
      if (!k) return;
      state.opts[k] = k === 'labels' ? e.target.checked : e.target.value;
      P.settings.set('charts.' + k, state.opts[k]);
      if (k === 'palette') syncSwatch();
      if (state.data) { drawAll(); markDirty(); }
    });
    root.querySelector('.charts-table').addEventListener('change', (e) => {
      const i = e.target.dataset.col;
      if (i == null) return;
      const m = model();
      state.data.types = m.cols.map((c) => c.type);
      state.data.types[+i] = e.target.value;
      drawAll();
      markDirty();
    });
    nameIn.addEventListener('input', () => { state.opts.title = nameIn.value.trim(); markDirty(); });
    nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); nameIn.blur(); } });
    // 테마가 바뀌면 다시 그리기
    const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
    const onTheme = () => { themeDefaults(); syncSwatch(); if (state.data) drawAll(); };
    if (mq && mq.addEventListener) mq.addEventListener('change', onTheme);
    const mo = new MutationObserver(onTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    /* ---------- 가져오기·내보내기 (공통 단추) ---------- */
    const io = P.files.ioButtons({
      kind: 'charts', compact: true, multiple: false, exportTitle: '이 차트',
      importers: [{ id: 'table', label: '표 파일', ext: 'XLSX · CSV', accept: CHART_ACCEPT, run: (f) => readFile(f) }],
      exporters: () => {
        const ready = !!(state.data && model().series.length);
        const k = ready ? pickedKind() : 'bar';
        return [
          { id: 'png', label: '고른 차트 그림', ext: 'PNG', desc: ready ? KINDS[k].name + ' · 2배 해상도, 흰 바탕' : '먼저 자료를 넣으세요', icon: P.files.icons.image, disabled: !ready, run: () => { const m = model(); return savePNG(k, m, Object.assign({}, state.opts, { title: fileTitle() })); } },
          { id: 'zip', label: '후보 차트 모두', ext: 'ZIP', desc: '추천된 차트마다 PNG 한 장씩', icon: P.files.icons.zip, disabled: !ready, run: async () => {
            const m = model();
            await P.loadScript('vendor/jszip/jszip.min.js');
            const zip = new window.JSZip();
            for (const kk of state.kinds || []) zip.file(String((state.kinds.indexOf(kk) + 1)).padStart(2, '0') + '-' + KINDS[kk].name.replace(/[\\/:*?"<>|()%+]/g, '') + '.png', await exportPNG(kk, m, Object.assign({}, state.opts, { title: fileTitle() })));
            P.ui.download(safeName(fileTitle()) + '-차트.zip', await zip.generateAsync({ type: 'blob' }));
            P.ui.toast('후보 차트 ' + (state.kinds || []).length + '개를 ZIP으로 내보냈습니다.', 'ok');
          } }
        ];
      }
    });
    $('.charts-io').replaceWith(io.el);

    /* ---------- 시작 자료 ---------- */
    if (file) {
      nameIn.value = file.title || '';
      state.opts = Object.assign(state.opts, file.opts || {});
      state.picked = file.kind || null;
      optsBar.querySelector('[data-opt="palette"]').value = state.opts.palette;
      optsBar.querySelector('[data-opt="unit"]').value = state.opts.unit;
      optsBar.querySelector('[data-opt="labels"]').checked = !!state.opts.labels;
      if (file.data && file.data.columns) setData(Object.assign({}, file.data, { title: file.title }), file.source || '', { quiet: true });
      setSave('saved', '저장됨');
      if (file.data && file.data.columns && ctx.params[1] !== 'studio') openBig(file.kind || pickedKind(), state.data, Object.assign({}, file.opts || {}, { title: file.title }));
    } else {
      let incoming = null;
      try { incoming = JSON.parse(sessionStorage.getItem('charts:incoming') || 'null'); sessionStorage.removeItem('charts:incoming'); } catch (e) { incoming = null; }
      if (incoming && incoming.columns && incoming.rows) {
        setData({ columns: incoming.columns, rows: incoming.rows, title: incoming.title || '' }, incoming.source || ('엑셀에서 가져옴' + (incoming.title ? ': ' + incoming.title : '')));
        if (!incoming.source) P.ui.toast('엑셀에서 고른 범위로 차트를 그렸습니다.', 'ok');
      } else setSave('new', '새 차트');
    }
    return () => {
      clearLive();
      mo.disconnect();
      if (mq && mq.removeEventListener) mq.removeEventListener('change', onTheme);
    };
  }
  const EDIT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
  const PICK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>';
  const BACK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  const SAVE_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/></svg>';
  const CHART_ACCEPT = '.xlsx,.xls,.csv,.tsv,.txt';

  /* ================= 목록 (차트 파일) ================= */
  /* 예전 '차트 모음' 항목을 파일로: 폴더·만든 날짜를 채움. 이미 채운 항목은 건드리지 않음(여러 번 불러도 같음) */
  async function migrate() {
    let rows = [];
    try { rows = await P.store.list(COL); } catch (e) { return; }
    for (const r of rows) {
      const d = r && r.data;
      if (!d || typeof d !== 'object' || d.fileV) continue;
      const next = Object.assign({}, d, { fileV: 1, folder: d.folder || null, createdAt: d.createdAt || r.updatedAt || new Date().toISOString(), title: d.title || (d.opts && d.opts.title) || '제목 없는 차트' });
      try { await P.store.put(COL, r.id, next); } catch (e) { /* core가 알림 */ }
    }
  }
  async function tableFromFile(file) {
    const buf = await file.arrayBuffer();
    if (/\.(csv|tsv|txt)$/i.test(file.name)) {
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { text = new TextDecoder('euc-kr').decode(buf); }
      return { data: parseText(text.replace(/^﻿/, '')), source: file.name };
    }
    await P.loadScript(LIB.xlsx);
    const wb = window.XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, blankrows: false, defval: '' });
    const text = aoa.map((r) => r.map((v) => String(v).replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
    return { data: parseText(text), source: file.name + ' · ' + wb.SheetNames[0] };
  }
  function sampleThumb(smp) {
    const d = parseText(smp.text);
    const vals = d.rows.map((r) => parseNum(r[1])).map((x) => (x ? x.n : 0)).slice(0, 8);
    const mx = Math.max(1, ...vals);
    const bw = 88 / (vals.length * 1.6);
    return '<svg class="charts-tpl-pv" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path class="charts-tpl-ax" d="M4 56H96"/>' +
      vals.map((v, i) => '<rect class="' + (i === vals.indexOf(mx) ? 'hi' : '') + '" x="' + (6 + i * bw * 1.6).toFixed(1) + '" y="' + (56 - (v / mx) * 46).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + ((v / mx) * 46).toFixed(1) + '" rx="1"/>').join('') + '</svg>';
  }
  async function mountList(root, ctx) {
    const folder = ctx.params[0] === 'f' ? ctx.params[1] || null : null;
    // 엑셀에서 넘어온 자료는 새 차트로 바로
    let incoming = null;
    try { incoming = sessionStorage.getItem('charts:incoming'); } catch (e) { incoming = null; }
    if (incoming) { ctx.navigate('charts/new'); return null; }
    root.innerHTML = '<div class="page">' + P.ui.skeleton(3) + '</div>';
    await migrate();
    if (!root.isConnected) return null;
    const startNew = (f, payload) => {
      if (payload) { try { sessionStorage.setItem('charts:incoming', JSON.stringify(payload)); } catch (e) { P.ui.toast('자료가 너무 커서 넘기지 못했습니다.', 'error'); return; } }
      ctx.navigate('charts/new' + (f ? '/f/' + encodeURIComponent(f) : ''));
    };
    const tplHTML = '<div class="charts-tpls">' +
      '<button type="button" class="charts-tpl" data-tpl="blank"><span class="charts-tpl-thumb charts-tpl-blank" aria-hidden="true">' + P.icons.plus + '</span><b>빈 차트</b><small>붙여넣기·파일로 시작</small></button>' +
      SAMPLES.map((smp) => '<button type="button" class="charts-tpl" data-tpl="' + smp.id + '"><span class="charts-tpl-thumb">' + sampleThumb(smp) + '</span><b>' + esc(smp.title) + '</b><small>예시 자료</small></button>').join('') + '</div>';
    let chartReady = null;
    const needChart = () => (chartReady = chartReady || P.loadScript(LIB.chart).then(() => themeDefaults()));
    const fb = P.files.browser(root, {
      col: COL, kind: 'charts', folder, defaultView: 'grid',
      title: '차트', itemName: '차트', newLabel: '새 차트', mineLabel: '내 차트', searchHint: '제목·자료 이름 검색',
      pageClass: 'charts-list', itemClass: 'charts-file', newAttrs: { 'data-act': 'new' },
      textOf: (it) => String(it.data.title || '') + ' ' + String(it.data.source || ''),
      templates: { title: '새로 만들기', html: tplHTML, cls: 'charts-tpl-sec' },
      onTemplate: (id, f) => {
        if (id === 'blank') return startNew(f);
        const smp = SAMPLES.find((x) => x.id === id);
        const d = parseText(smp.text);
        startNew(f, { columns: d.columns, rows: d.rows, title: smp.title, source: '예시: ' + smp.title });
      },
      newItem: (f) => startNew(f),
      icon: () => P.files.icons.chart,
      badge: (it) => '<span class="badge">' + esc(KINDS[it.data.kind] ? KINDS[it.data.kind].name : '차트') + '</span>',
      meta: (it) => { const d = it.data.data; return [d && d.rows ? d.rows.length + '행' : '', it.data.source || ''].filter(Boolean).join(' · '); },
      thumb: (it) => (it.data.thumb ? '<img src="' + esc(it.data.thumb) + '" alt="" loading="lazy">' : P.files.icons.chart),
      empty: { slot: 'empty-charts', title: '아직 저장한 차트가 없습니다', desc: '새 차트에서 표를 붙여넣거나 XLSX·CSV를 넣고, 마음에 드는 차트를 골라 저장하세요.' },
      io: {
        importers: [
          { id: 'table', label: '표 파일', ext: 'XLSX · CSV', accept: CHART_ACCEPT, run: async (file, c) => {
            const r = await tableFromFile(file);
            if (!r.data || !r.data.rows || !r.data.rows.length) throw new Error('표를 찾지 못했습니다.');
            startNew(c.folder, { columns: r.data.columns, rows: r.data.rows, title: file.name.replace(/\.[^.]+$/, ''), source: r.source });
          } },
          { id: 'paste', label: '붙여넣기', ext: '표 복사', paste: true, run: async (text, c) => {
            const d = parseText(text);
            if (!d || !d.rows.length) throw new Error('붙여넣은 내용에서 표를 찾지 못했습니다. 첫 줄에 제목, 아래에 값을 넣어 주세요.');
            startNew(c.folder, { columns: d.columns, rows: d.rows, title: '', source: '붙여넣은 자료' });
          } }
        ],
        exporters: [
          { id: 'png', label: '차트 그림', ext: 'PNG', desc: '저장한 종류·꾸밈 그대로, 2배 해상도', icon: P.files.icons.image, file: async (r) => {
            await needChart();
            const d = r.data;
            const blob = await exportPNG(d.kind || 'bar', buildModel(d.data), Object.assign({ palette: 'base', unit: 'auto', legend: 'top' }, d.opts || {}, { title: d.title }));
            return { name: String(d.title || '차트').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) + '.png', blob };
          } }
        ]
      }
    });
    return () => fb.destroy();
  }
  async function mount(root, ctx) {
    const p0 = ctx.params[0];
    if (!p0 || p0 === 'f') return mountList(root, ctx);
    if (p0 === 'new') return mountStudio(root, ctx, null, ctx.params[1] === 'f' ? ctx.params[2] || null : null);
    return mountStudio(root, ctx, p0, null);
  }

  P.registerApp({
    id: 'charts',
    title: '차트',
    short: '차트',
    order: 6,
    desc: '자료를 넣으면 여러 도표를 한 번에 그려 고르게',
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/></svg>',
    mount
  });
})();
