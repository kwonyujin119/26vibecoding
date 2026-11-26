/* PT: 16:9 슬라이드 편집기 — 레이아웃·테마, 발표 모드, 개요로 만들기, 품질 점검, PPTX·PDF·PNG 내보내기 */
(function () {
  'use strict';

  const APP_ID = 'slides';
  const COL = 'slides';
  const W = 1280;
  const H = 720;
  const PX = 4 / 3; // 1pt = 4/3px (96px = 1in)
  const VENDOR_JSZIP = 'vendor/jszip/jszip.min.js';
  const VENDOR_PPTX = 'vendor/pptxgenjs/pptxgen.min.js'; // JSZip 전역이 먼저 있어야 함
  const FONT = "'Pretendard','Malgun Gothic','맑은 고딕','Apple SD Gothic Neo','Noto Sans KR',system-ui,sans-serif";
  const PPT_FONT = 'Malgun Gothic';
  const esc = (s) => P.esc(s);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const round = (v) => Math.round(v);
  const uid = () => P.store.uid();
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
  const MOD = isMac ? '⌘' : 'Ctrl';

  /* ---------- 아이콘 ---------- */
  const sv = (d, extra) => '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + d + '</svg>';
  const I = {
    app: sv('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M7 12l3-3 2 2 4-4"/>'),
    back: sv('<path d="M15 6l-6 6 6 6"/>'),
    undo: sv('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
    redo: sv('<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>'),
    slide: sv('<rect x="3" y="5" width="18" height="12" rx="1.5"/><path d="M12 9v4M10 11h4"/>'),
    text: sv('<path d="M5 6V5h14v1M12 5v14M9 19h6"/>'),
    shape: sv('<rect x="3" y="11" width="9" height="9" rx="1"/><circle cx="16" cy="8" r="5"/>'),
    image: sv('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'),
    table: sv('<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>'),
    chart: sv('<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>'),
    layout: sv('<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18M10 9v11"/>'),
    theme: sv('<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/>'),
    outline: sv('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
    check: sv('<path d="M9 12l2 2 4-4"/><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>'),
    play: sv('<path d="M7 4l13 8-13 8z"/>'),
    download: sv('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
    upload: sv('<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>'),
    plus: sv('<path d="M12 5v14M5 12h14"/>'),
    copy: sv('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
    trash: sv('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    edit: sv('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>'),
    more: sv('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
    up: sv('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    down: sv('<path d="M12 5v14M6 13l6 6 6-6"/>'),
    bold: sv('<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>', ' stroke-width="2.2"'),
    italic: sv('<path d="M14 5h-4M14 19h-4M14.5 5l-5 14"/>'),
    underline: sv('<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>'),
    aL: sv('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'),
    aC: sv('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'),
    aR: sv('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>'),
    vT: sv('<path d="M4 4h16M12 8v12M8 12l4-4 4 4"/>'),
    vM: sv('<path d="M4 12h16M12 3v5M12 21v-5M9 6l3 2 3-2M9 18l3-2 3 2"/>'),
    vB: sv('<path d="M4 20h16M12 4v12M8 12l4 4 4-4"/>'),
    front: sv('<rect x="9" y="9" width="11" height="11" rx="1.5" fill="currentColor" fill-opacity=".25"/><path d="M15 9V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h4"/>'),
    backward: sv('<rect x="4" y="4" width="11" height="11" rx="1.5" fill="currentColor" fill-opacity=".25"/><path d="M9 15v4a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-4"/>'),
    panel: sv('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>'),
    help: sv('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>'),
    close: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
    prev: sv('<path d="M15 6l-6 6 6 6"/>'),
    next: sv('<path d="M9 6l6 6-6 6"/>'),
    notes: sv('<path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h4"/>'),
    screen: sv('<rect x="3" y="5" width="18" height="12" rx="1.5" fill="currentColor"/><path d="M8 21h8"/>'),
    full: sv('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    alignL: sv('<path d="M4 4v16M8 8h12M8 16h7"/>'),
    alignCH: sv('<path d="M12 4v16M6 8h12M8 16h8"/>'),
    alignR: sv('<path d="M20 4v16M4 8h12M9 16h7"/>'),
    alignT: sv('<path d="M4 4h16M8 8v12M16 8v7"/>'),
    alignCV: sv('<path d="M4 12h16M8 6v12M16 8v8"/>'),
    alignB: sv('<path d="M4 20h16M8 4v12M16 9v7"/>')
  };

  /* ---------- 테마 6종 ---------- */
  const THEMES = {
    clean: {
      name: '깔끔한 행정', desc: '흰 바탕과 파란 강조. 일반 보고·설명용',
      base: { bg: '#FFFFFF', title: '#0F2B5B', text: '#26324A', accent: '#2563EB', accent2: '#0E7490', soft: '#E8EFFC', muted: '#64748B' },
      cover: { bg: '#0F2B5B', title: '#FFFFFF', text: '#DCE6F7', accent: '#60A5FA', accent2: '#7DD3FC', soft: '#1B3C73', muted: '#A9BCDD' },
      deco: { base: [{ shape: 'rect', x: 0, y: 0, w: W, h: 8, fill: '@accent' }], cover: [{ shape: 'rect', x: 0, y: 0, w: 24, h: H, fill: '@accent' }] }
    },
    navy: {
      name: '남색 공식', desc: '남색 띠와 금색 선. 공식 보고·외부 발표',
      base: { bg: '#F6F7FA', title: '#1B2A4A', text: '#2B3446', accent: '#1F3A6B', accent2: '#9A7B22', soft: '#E3E8F1', muted: '#5B6478' },
      cover: { bg: '#1B2A4A', title: '#FFFFFF', text: '#E3E7EF', accent: '#D4AF37', accent2: '#D4AF37', soft: '#26385E', muted: '#AEB7C9' },
      deco: { base: [{ shape: 'rect', x: 0, y: 0, w: W, h: 14, fill: '@title' }, { shape: 'rect', x: 0, y: 14, w: W, h: 4, fill: '@accent2' }], cover: [{ shape: 'rect', x: 96, y: 556, w: 200, h: 6, fill: '@accent' }] }
    },
    dark: {
      name: '어두운 발표', desc: '어두운 바탕과 밝은 강조. 강당·대형 화면',
      base: { bg: '#0F172A', title: '#F8FAFC', text: '#CBD5E1', accent: '#38BDF8', accent2: '#F472B6', soft: '#1E293B', muted: '#94A3B8' },
      cover: { bg: '#020617', title: '#FFFFFF', text: '#CBD5E1', accent: '#38BDF8', accent2: '#F472B6', soft: '#0F1E3A', muted: '#94A3B8' },
      deco: { base: [{ shape: 'ellipse', x: 1060, y: -180, w: 400, h: 400, fill: '@soft' }], cover: [{ shape: 'ellipse', x: 820, y: 260, w: 620, h: 620, fill: '@soft' }, { shape: 'rect', x: 96, y: 128, w: 80, h: 6, fill: '@accent' }] }
    },
    warm: {
      name: '따뜻한 교육', desc: '크림 바탕과 주황 강조. 교육·교안',
      base: { bg: '#FFF8EF', title: '#7C2D12', text: '#44403C', accent: '#C2410C', accent2: '#15803D', soft: '#FCE7CF', muted: '#78716C' },
      cover: { bg: '#9A3412', title: '#FFF7ED', text: '#FFEDD5', accent: '#FDBA74', accent2: '#BBF7D0', soft: '#B4471C', muted: '#FED7AA' },
      deco: { base: [{ shape: 'ellipse', x: 1150, y: 590, w: 260, h: 260, fill: '@soft' }, { shape: 'rect', x: 0, y: H - 10, w: W, h: 10, fill: '@accent' }], cover: [{ shape: 'ellipse', x: 900, y: -140, w: 520, h: 520, fill: '@soft' }] }
    },
    mono: {
      name: '미니멀 흑백', desc: '흑백과 여백. 인쇄·흑백 배포',
      base: { bg: '#FFFFFF', title: '#111111', text: '#333333', accent: '#111111', accent2: '#8A8A8A', soft: '#F1F1F1', muted: '#666666' },
      cover: { bg: '#FFFFFF', title: '#111111', text: '#333333', accent: '#111111', accent2: '#8A8A8A', soft: '#F1F1F1', muted: '#666666' },
      deco: { base: [{ shape: 'rect', x: 80, y: 672, w: 1120, h: 2, fill: '@accent2' }], cover: [{ shape: 'rect', x: 96, y: 128, w: 80, h: 6, fill: '@accent' }] }
    },
    contrast: {
      name: '강조 대비', desc: '빨강·노랑 강조. 핵심 메시지·성과 발표',
      base: { bg: '#FFFFFF', title: '#0A0A0A', text: '#1F2937', accent: '#E11D48', accent2: '#B45309', soft: '#FFE4E6', muted: '#6B7280' },
      cover: { bg: '#0A0A0A', title: '#FFFFFF', text: '#E5E7EB', accent: '#FB7185', accent2: '#FBBF24', soft: '#1F1F1F', muted: '#A3A3A3' },
      deco: { base: [{ shape: 'rect', x: 0, y: 0, w: 16, h: H, fill: '@accent' }], cover: [{ shape: 'rect', x: 0, y: H - 24, w: W, h: 24, fill: '@accent' }, { shape: 'rect', x: 96, y: 128, w: 120, h: 8, fill: '@accent2' }] }
    }
  };
  const THEME_IDS = Object.keys(THEMES);
  const CHART_EXTRA = ['#F59E0B', '#10B981', '#8B5CF6', '#EF4444', '#14B8A6', '#64748B'];

  function palette(deck, slide) {
    const t = THEMES[deck.theme] || THEMES.clean;
    return Object.assign({}, slide && slide.variant === 'cover' ? t.cover : t.base);
  }
  function col(c, p) {
    if (!c) return null;
    if (c[0] === '@') {
      const k = c.slice(1);
      if (k === 'white') return '#FFFFFF';
      if (k === 'black') return '#000000';
      return p[k] || '#000000';
    }
    return c;
  }
  function slideBg(slide, p) { return slide.bg || p.bg; }

  /* ---------- 색 계산(대비) ---------- */
  function rgb(hex) {
    let h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    if (isNaN(n) || h.length !== 6) return [0, 0, 0];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function lum(hex) {
    const a = rgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function contrast(a, b) {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function rgba(hex, a) { const c = rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mix(a, b, t) { const x = rgb(a), y = rgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
  const onColor = (bg) => (lum(bg) > 0.45 ? '#111111' : '#FFFFFF');

  /* ---------- 요소 기본값 ---------- */
  const TEXT_DEF = { type: 'text', text: '', size: 24, color: null, bold: false, italic: false, underline: false, align: 'left', valign: 'top', list: null, lh: 1.3 };
  const T = (o) => Object.assign({}, TEXT_DEF, o);
  const S = (o) => Object.assign({}, TEXT_DEF, { type: 'shape', shape: 'rect', fill: '@accent', stroke: null, strokeW: 2, opacity: 1, size: 20, color: '@white', align: 'center', valign: 'middle', lh: 1.25 }, o);
  const TITLE = (o) => T(Object.assign({ role: 'title', x: 80, y: 40, w: 1120, h: 100, size: 36, bold: true, color: '@title', valign: 'bottom', lh: 1.2, ph: '제목을 입력하세요' }, o));
  const BODY = (o) => T(Object.assign({ role: 'body', x: 80, y: 168, w: 1120, h: 480, size: 24, list: 'bullet', lh: 1.45, ph: '내용을 입력하세요\n  들여쓰기는 줄 앞에 공백 두 칸(Tab)' }, o));

  function timelineEls(c) {
    const steps = Array.isArray(c.steps) && c.steps.length ? c.steps.slice(0, 5) : [{}, {}, {}, {}];
    const n = Math.max(2, steps.length);
    const left = 160, right = 1120, gap = (right - left) / (n - 1);
    const colW = Math.min(300, gap - 20);
    const els = [TITLE({}), S({ role: 'line', shape: 'rect', x: left, y: 378, w: right - left, h: 4, fill: '@muted', opacity: 0.45 })];
    for (let i = 0; i < n; i++) {
      const cx = left + gap * i;
      const s = steps[i] || {};
      els.push(S({ role: 'dot', shape: 'ellipse', x: cx - 16, y: 364, w: 32, h: 32, fill: '@accent' }));
      els.push(T({ role: 'step' + (i + 1), x: cx - colW / 2, y: 280, w: colW, h: 70, size: 22, bold: true, color: '@accent', align: 'center', valign: 'bottom', text: s.label || '', ph: (i + 1) + '단계' }));
      els.push(T({ role: 'desc' + (i + 1), x: cx - colW / 2, y: 420, w: colW, h: 200, size: 18, align: 'center', lh: 1.4, text: s.desc || '', ph: '설명' }));
    }
    return els;
  }

  const LAYOUTS = [
    { id: 'cover', name: '표지', variant: 'cover', els: () => [
      TITLE({ x: 96, y: 150, w: 1040, h: 220, size: 48, ph: '발표 제목' }),
      T({ role: 'body', x: 96, y: 388, w: 1040, h: 64, size: 24, ph: '부제목 또는 한 줄 요약' }),
      T({ role: 'meta', x: 96, y: 600, w: 900, h: 44, size: 18, color: '@muted', ph: '날짜 · 부서 · 발표자' })
    ] },
    { id: 'toc', name: '목차', els: () => [TITLE({ text: '목차' }), BODY({ size: 26, list: 'step', lh: 1.75, ph: '첫 번째 내용\n두 번째 내용\n세 번째 내용' })] },
    { id: 'titleBody', name: '제목+본문', els: () => [TITLE({}), BODY({})] },
    { id: 'twoCol', name: '2단 비교', els: () => [
      TITLE({}),
      T({ role: 'head1', x: 80, y: 168, w: 540, h: 56, size: 26, bold: true, color: '@accent', valign: 'middle', ph: '왼쪽 제목' }),
      BODY({ role: 'body', x: 80, y: 236, w: 540, h: 420, size: 22 }),
      S({ role: 'divider', shape: 'rect', x: 639, y: 176, w: 2, h: 470, fill: '@muted', opacity: 0.35 }),
      T({ role: 'head2', x: 660, y: 168, w: 540, h: 56, size: 26, bold: true, color: '@accent', valign: 'middle', ph: '오른쪽 제목' }),
      BODY({ role: 'body2', x: 660, y: 236, w: 540, h: 420, size: 22 })
    ] },
    { id: 'bigNumber', name: '큰 숫자 강조', els: () => [
      TITLE({ size: 30 }),
      T({ role: 'number', x: 80, y: 176, w: 1120, h: 230, size: 120, bold: true, color: '@accent', align: 'center', valign: 'middle', lh: 1, ph: '87%' }),
      T({ role: 'body', x: 80, y: 414, w: 1120, h: 80, size: 28, align: 'center', valign: 'middle', ph: '숫자가 뜻하는 바' }),
      T({ role: 'meta', x: 80, y: 510, w: 1120, h: 60, size: 18, color: '@muted', align: 'center', ph: '출처 · 기준일' })
    ] },
    { id: 'quote', name: '인용', els: () => [
      T({ role: 'mark', x: 72, y: 60, w: 200, h: 220, size: 160, bold: true, color: '@accent', lh: 1, text: '“' }),
      T({ role: 'body', x: 150, y: 190, w: 980, h: 290, size: 34, color: '@title', valign: 'middle', lh: 1.45, ph: '인용문을 입력하세요' }),
      T({ role: 'meta', x: 150, y: 500, w: 980, h: 50, size: 20, color: '@muted', ph: '— 말한 사람, 출처' })
    ] },
    { id: 'photo', name: '사진 전체', deco: false, els: () => [
      { type: 'image', role: 'photo', x: 0, y: 0, w: W, h: H, asset: null, fit: 'cover', radius: 0 },
      S({ role: 'body', shape: 'rect', x: 0, y: 600, w: W, h: 120, fill: '#000000', opacity: 0.55, color: '#FFFFFF', size: 24, align: 'left', valign: 'middle', ph: '사진 설명을 입력하세요' })
    ] },
    { id: 'timeline', name: '타임라인', els: timelineEls },
    { id: 'table', name: '표', els: () => [
      TITLE({}),
      { type: 'table', role: 'table', x: 80, y: 170, w: 1120, h: 400, size: 18, header: true, band: true, rows: [['구분', '항목 1', '항목 2', '비고'], ['', '', '', ''], ['', '', '', ''], ['', '', '', '']] }
    ] },
    { id: 'closing', name: '마무리', variant: 'cover', els: () => [
      TITLE({ x: 80, y: 230, w: 1120, h: 150, size: 54, align: 'center', valign: 'middle', text: '감사합니다', ph: '감사합니다' }),
      T({ role: 'body', x: 80, y: 400, w: 1120, h: 60, size: 22, align: 'center', ph: '문의: 부서 · 연락처' })
    ] },
    { id: 'chart', name: '제목+차트', els: () => [
      TITLE({}),
      { type: 'chart', role: 'chart', x: 80, y: 160, w: 1120, h: 500, kind: 'bar', title: '', labels: ['1분기', '2분기', '3분기', '4분기'], values: [42, 58, 71, 86], showValues: true, size: 18 }
    ] },
    { id: 'blank', name: '빈 화면', els: () => [] }
  ];
  const LAYOUT = {};
  LAYOUTS.forEach((l) => { LAYOUT[l.id] = l; });

  function makeSlide(layoutId, c) {
    const L = LAYOUT[layoutId] || LAYOUT.titleBody;
    c = c || {};
    const els = L.els(c).map((e) => {
      const x = Object.assign({ id: uid() }, clone(e));
      if (x.role && typeof c[x.role] === 'string') x.text = c[x.role];
      if (x.type === 'table' && Array.isArray(c.rows) && c.rows.length) x.rows = clone(c.rows);
      if (x.type === 'chart' && c.chart) Object.assign(x, clone(c.chart));
      if (x.type === 'image' && c.asset) { x.asset = c.asset; x.nw = c.nw; x.nh = c.nh; }
      return x;
    });
    return { id: uid(), layout: L.id, variant: L.variant || 'base', deco: L.deco !== false, bg: null, bgAsset: null, notes: c.notes || '', els };
  }
  function roleTexts(slide) {
    const c = {};
    slide.els.forEach((e) => {
      if (e.role && typeof e.text === 'string' && e.text.trim() && e.role !== 'mark') c[e.role] = e.text;
      if (e.type === 'table') c.rows = e.rows;
      if (e.type === 'chart') c.chart = { kind: e.kind, labels: e.labels, values: e.values, title: e.title };
      if (e.type === 'image' && e.role === 'photo' && e.asset) { c.asset = e.asset; c.nw = e.nw; c.nh = e.nh; }
    });
    return c;
  }
  function relayout(slide, layoutId) {
    const c = roleTexts(slide);
    const target = LAYOUT[layoutId];
    const roles = new Set(target.els(c).map((e) => e.role));
    // 대상 레이아웃에 없는 칸의 글은 본문으로 모은다
    const extra = [];
    ['body2', 'head1', 'head2', 'number', 'meta'].forEach((r) => { if (c[r] && !roles.has(r)) extra.push(c[r]); });
    if (extra.length) c.body = [c.body].concat(extra).filter(Boolean).join('\n');
    if (!c.title && c.number && !roles.has('number')) c.title = c.number;
    const fresh = makeSlide(layoutId, c);
    const kept = slide.els.filter((e) => !e.role);
    slide.layout = fresh.layout;
    slide.variant = fresh.variant;
    slide.deco = fresh.deco;
    slide.els = fresh.els.concat(kept);
  }

  /* ---------- 렌더링(HTML 문자열, 인라인 스타일 → 편집·썸네일·발표·PNG·인쇄 공통) ---------- */
  const VJ = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
  const PAD_T = [5, 10]; // 글상자 안쪽 여백(위아래, 좌우) px
  const PAD_S = [10, 14]; // 도형 안쪽 여백

  function listLines(text) {
    return String(text || '').split('\n').map((line) => {
      const m = /^([ \t]*)(.*)$/.exec(line);
      const lvl = Math.min(2, Math.floor(m[1].replace(/\t/g, '  ').length / 2));
      return { lvl, t: m[2] };
    });
  }
  function textLayer(e, p, opts) {
    const color = col(e.color, p) || p.text;
    const pad = e.type === 'shape' ? PAD_S : PAD_T;
    const style = 'position:absolute;inset:0;padding:' + pad[0] + 'px ' + pad[1] + 'px;display:flex;flex-direction:column;justify-content:' + (VJ[e.valign] || 'flex-start') +
      ';text-align:' + (e.align || 'left') + ';font-size:' + (e.size * PX).toFixed(2) + 'px;line-height:' + (e.lh || 1.3) + ';color:' + color +
      ';font-weight:' + (e.bold ? 700 : 400) + ';font-style:' + (e.italic ? 'italic' : 'normal') + ';text-decoration:' + (e.underline ? 'underline' : 'none') +
      ';white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere;font-family:' + FONT + ';box-sizing:border-box';
    let inner;
    if (!e.text) {
      if (!(opts.edit && e.ph)) return '';
      inner = '<div style="opacity:.38">' + esc(e.ph) + '</div>';
    } else if (e.list) {
      const n = [0, 0, 0];
      const mk = col('@accent', p);
      inner = listLines(e.text).map(({ lvl, t }) => {
        if (!t) return '<div style="height:' + (e.lh || 1.3) + 'em"></div>';
        n[lvl]++;
        for (let k = lvl + 1; k < 3; k++) n[k] = 0;
        let mark;
        if (e.list === 'number') mark = lvl === 0 ? n[0] + '.' : lvl === 1 ? String.fromCharCode(96 + Math.min(26, n[1])) + ')' : '·';
        else if (e.list === 'step') mark = lvl === 0 ? String(n[0]).padStart(2, '0') : '·';
        else mark = lvl === 0 ? '•' : lvl === 1 ? '–' : '·';
        const mStyle = 'flex:none;color:' + (lvl ? color : mk) + ';' + (e.list === 'step' && lvl === 0 ? 'font-weight:800;min-width:1.7em;' : e.list === 'number' ? 'min-width:1.2em;' : '');
        return '<div style="display:flex;gap:.45em;text-align:left;padding-left:' + (lvl * 1.3) + 'em;' + (lvl ? 'font-size:.86em;' : '') + '"><span style="' + mStyle + '">' + mark + '</span><span style="min-width:0;flex:1">' + esc(t) + '</span></div>';
      }).join('');
    } else inner = esc(e.text);
    return '<div data-tx style="' + style + '"><div data-tin>' + inner + '</div></div>';
  }
  function shapeLayer(e, p) {
    const fill = col(e.fill, p);
    const stroke = col(e.stroke, p);
    const sw = stroke ? (e.strokeW || 2) : 0;
    const op = e.opacity == null ? 1 : e.opacity;
    const fc = fill ? (op < 1 ? rgba(fill, op) : fill) : 'none';
    if (e.shape === 'rect' || e.shape === 'roundRect' || e.shape === 'ellipse') {
      const rad = e.shape === 'ellipse' ? '50%' : e.shape === 'roundRect' ? Math.round(Math.min(e.w, e.h) * 0.18) + 'px' : '0';
      return '<div style="position:absolute;inset:0;box-sizing:border-box;border-radius:' + rad + ';background:' + (fill ? fc : 'transparent') + ';' + (sw ? 'border:' + sw + 'px solid ' + stroke + ';' : '') + '"></div>';
    }
    const w = e.w, h = e.h;
    let d = '';
    if (e.shape === 'triangle') d = '<polygon points="' + (w / 2) + ',' + (sw / 2) + ' ' + (w - sw / 2) + ',' + (h - sw / 2) + ' ' + (sw / 2) + ',' + (h - sw / 2) + '"/>';
    else if (e.shape === 'rightArrow') {
      const hx = Math.max(w - h * 0.6, w * 0.55), t = h * 0.25;
      d = '<polygon points="0,' + t + ' ' + hx + ',' + t + ' ' + hx + ',0 ' + w + ',' + (h / 2) + ' ' + hx + ',' + h + ' ' + hx + ',' + (h - t) + ' 0,' + (h - t) + '"/>';
    } else if (e.shape === 'line') {
      const c = stroke || fill || '#000000';
      const lw = e.strokeW || 3;
      const horiz = w >= h;
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" style="position:absolute;inset:0;overflow:visible"><line x1="' + (horiz ? 0 : w / 2) + '" y1="' + (horiz ? h / 2 : 0) + '" x2="' + (horiz ? w : w / 2) + '" y2="' + (horiz ? h / 2 : h) + '" stroke="' + c + '" stroke-width="' + lw + '" stroke-linecap="round"/></svg>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" style="position:absolute;inset:0;overflow:visible"><g fill="' + (fill || 'none') + '" fill-opacity="' + op + '"' + (sw ? ' stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linejoin="round"' : '') + '>' + d + '</g></svg>';
  }
  function tableLayer(e, p, bg) {
    const rows = e.rows || [];
    const light = lum(bg) > 0.45;
    const border = light ? '#D5DBE5' : mix(bg, '#FFFFFF', 0.22);
    const head = col('@accent', p);
    const headTx = onColor(head);
    const band = light ? mix(bg, col('@accent', p), 0.07) : mix(bg, '#FFFFFF', 0.06);
    const fs = (e.size * PX).toFixed(2);
    let html = '<table style="width:100%;height:100%;border-collapse:collapse;table-layout:fixed;font-family:' + FONT + ';font-size:' + fs + 'px;line-height:1.3;color:' + p.text + '">';
    rows.forEach((r, ri) => {
      const isHead = e.header && ri === 0;
      const bgc = isHead ? head : (e.band && ri % 2 === (e.header ? 0 : 1) ? band : 'transparent');
      html += '<tr>' + r.map((c, ci) => '<td data-r="' + ri + '" data-c="' + ci + '" style="border:1px solid ' + (isHead ? head : border) + ';padding:6px 10px;vertical-align:middle;background:' + bgc + ';' +
        (isHead ? 'color:' + headTx + ';font-weight:700;' : '') + 'text-align:' + (ci === 0 || isHead ? 'center' : 'left') + ';overflow:hidden;word-break:keep-all;overflow-wrap:anywhere">' + esc(c) + '</td>').join('') + '</tr>';
    });
    return html + '</table>';
  }
  function chartColors(p) { return [col('@accent', p), col('@accent2', p)].concat(CHART_EXTRA); }
  function chartLayer(e, p) {
    const w = e.w, h = e.h;
    const fs = (e.size || 18) * PX;
    const labels = (e.labels || []).map(String);
    const vals = (e.values || []).map((v) => { const n = Number(v); return isFinite(n) ? n : 0; });
    const n = Math.max(labels.length, vals.length);
    const colors = chartColors(p);
    const txt = p.text;
    const fmt = (v) => (Math.round(v * 100) / 100).toLocaleString('ko-KR');
    let s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="position:absolute;inset:0;font-family:' + FONT.replace(/"/g, '') + '">';
    let top = 6;
    if (e.title) {
      s += '<text x="' + (w / 2) + '" y="' + (fs * 1.15) + '" text-anchor="middle" font-size="' + (fs * 1.1) + '" font-weight="700" fill="' + p.title + '">' + esc(e.title) + '</text>';
      top = fs * 1.9;
    }
    if (!n) return s + '<text x="' + (w / 2) + '" y="' + (h / 2) + '" text-anchor="middle" font-size="' + fs + '" fill="' + p.muted + '">데이터를 입력하세요</text></svg>';
    if (e.kind === 'pie') {
      const total = vals.reduce((a, b) => a + Math.max(0, b), 0) || 1;
      const legendW = Math.min(w * 0.45, 360);
      const r = Math.max(10, Math.min((h - top - 10) / 2, (w - legendW - 30) / 2));
      const cx = r + 10 + Math.max(0, (w - legendW - 2 * r - 30) / 2), cy = top + (h - top) / 2;
      const rm = r * 0.72, sw = r * 0.56, C = 2 * Math.PI * rm;
      let off = 0;
      s += '<g transform="rotate(-90 ' + cx + ' ' + cy + ')">';
      vals.forEach((v, i) => {
        const len = (Math.max(0, v) / total) * C;
        s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rm + '" fill="none" stroke="' + colors[i % colors.length] + '" stroke-width="' + sw + '" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>';
        off += len;
      });
      s += '</g>';
      const lx = cx + r + 30, rowH = fs * 1.6, ly0 = cy - (n * rowH) / 2 + rowH / 2;
      labels.forEach((l, i) => {
        const y = ly0 + i * rowH;
        const pct = Math.round((Math.max(0, vals[i] || 0) / total) * 1000) / 10;
        s += '<rect x="' + lx + '" y="' + (y - fs * 0.45) + '" width="' + (fs * 0.9) + '" height="' + (fs * 0.9) + '" rx="3" fill="' + colors[i % colors.length] + '"/>';
        s += '<text x="' + (lx + fs * 1.3) + '" y="' + (y + fs * 0.35) + '" font-size="' + fs + '" fill="' + txt + '">' + esc(l) + (e.showValues ? ' <tspan fill="' + p.muted + '">' + pct + '%</tspan>' : '') + '</text>';
      });
      return s + '</svg>';
    }
    const bottom = h - fs * 1.9, left = 12, right = w - 12;
    const max = Math.max(0, ...vals), min = Math.min(0, ...vals);
    const span = (max - min) || 1;
    const valTop = top + (e.showValues ? fs * 1.4 : 6);
    const y = (v) => valTop + (max - v) / span * (bottom - valTop);
    const slot = (right - left) / n;
    s += '<line x1="' + left + '" y1="' + y(0) + '" x2="' + right + '" y2="' + y(0) + '" stroke="' + p.muted + '" stroke-opacity=".6" stroke-width="2"/>';
    if (e.kind === 'line') {
      const pts = vals.map((v, i) => [left + slot * i + slot / 2, y(v)]);
      s += '<polyline points="' + pts.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ') + '" fill="none" stroke="' + colors[0] + '" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>';
      pts.forEach((q, i) => {
        s += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="8" fill="' + p.bg + '" stroke="' + colors[0] + '" stroke-width="4"/>';
        if (e.showValues) s += '<text x="' + q[0] + '" y="' + (q[1] - fs * 0.7) + '" text-anchor="middle" font-size="' + fs + '" font-weight="700" fill="' + txt + '">' + fmt(vals[i]) + '</text>';
      });
    } else {
      const bw = Math.min(slot * 0.62, 160);
      vals.forEach((v, i) => {
        const x = left + slot * i + (slot - bw) / 2;
        const y1 = y(Math.max(0, v)), y2 = y(Math.min(0, v));
        s += '<rect x="' + x.toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, y2 - y1).toFixed(1) + '" rx="4" fill="' + colors[0] + '"/>';
        if (e.showValues) s += '<text x="' + (x + bw / 2) + '" y="' + (v >= 0 ? y1 - fs * 0.35 : y2 + fs * 1.05) + '" text-anchor="middle" font-size="' + fs + '" font-weight="700" fill="' + txt + '">' + fmt(v) + '</text>';
      });
    }
    labels.forEach((l, i) => {
      s += '<text x="' + (left + slot * i + slot / 2) + '" y="' + (h - fs * 0.5) + '" text-anchor="middle" font-size="' + fs + '" fill="' + txt + '">' + esc(l) + '</text>';
    });
    return s + '</svg>';
  }
  function imageLayer(e, deck, opts) {
    if (opts.noImg) return '';
    const src = e.asset && deck.assets && deck.assets[e.asset];
    if (!src) {
      if (!opts.edit) return '';
      return '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(127,127,127,.14);border:3px dashed rgba(127,127,127,.55);color:rgba(110,110,110,1);font-family:' + FONT + ';font-size:26px;box-sizing:border-box">' +
        '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg><span>두 번 눌러 사진 넣기</span></div>';
    }
    return '<img alt="" src="' + src + '" draggable="false" style="position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:' + (e.fit === 'contain' ? 'contain' : 'cover') + ';border-radius:' + (e.radius || 0) + 'px">';
  }
  function elementHTML(e, p, deck, slide, opts, deco) {
    let inner = '';
    if (e.type === 'text') inner = textLayer(e, p, opts);
    else if (e.type === 'shape') inner = shapeLayer(e, p) + textLayer(e, p, opts);
    else if (e.type === 'image') inner = imageLayer(e, deck, opts);
    else if (e.type === 'table') inner = tableLayer(e, p, slideBg(slide, p));
    else if (e.type === 'chart') inner = chartLayer(e, p);
    const box = 'position:absolute;left:' + e.x + 'px;top:' + e.y + 'px;width:' + e.w + 'px;height:' + e.h + 'px;' + (e.type === 'image' ? 'overflow:hidden;border-radius:' + (e.radius || 0) + 'px;' : '');
    if (deco) return '<div style="' + box + 'pointer-events:none">' + inner + '</div>';
    return '<div' + (opts.edit ? ' class="slides-el"' : '') + (opts.edit || opts.ids ? ' data-id="' + esc(e.id) + '"' : '') + ' style="' + box + '">' + inner + '</div>';
  }
  function slideMarkup(deck, slide, opts) {
    opts = opts || {};
    const p = palette(deck, slide);
    const bg = slideBg(slide, p);
    let html = '';
    const bgSrc = !opts.noImg && slide.bgAsset && deck.assets && deck.assets[slide.bgAsset];
    if (bgSrc) html += '<img alt="" src="' + bgSrc + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block">';
    if (slide.deco !== false) {
      const t = THEMES[deck.theme] || THEMES.clean;
      (t.deco[slide.variant === 'cover' ? 'cover' : 'base'] || []).forEach((d) => { html += elementHTML(S(Object.assign({ id: '' }, d)), p, deck, slide, {}, true); });
    }
    slide.els.forEach((e) => { html += elementHTML(e, p, deck, slide, opts); });
    return '<div class="slides-sl" style="position:relative;width:' + W + 'px;height:' + H + 'px;overflow:hidden;background:' + bg + ';font-family:' + FONT + ';color:' + p.text + '">' + html + '</div>';
  }
  /** 축소 미리보기 상자 — scaleMinis()가 폭에 맞춰 배율을 맞춘다 */
  function miniHTML(deck, slide, opts) {
    return '<div class="slides-mini"><div class="slides-mini-in">' + slideMarkup(deck, slide, opts) + '</div></div>';
  }
  function scaleMinis(scope) {
    scope.querySelectorAll('.slides-mini').forEach((m) => {
      const k = m.clientWidth / W;
      const inner = m.firstElementChild;
      if (inner && k > 0) inner.style.transform = 'scale(' + k + ')';
    });
  }

  /* ---------- 문서 모델 ---------- */
  function blankDeck(title, theme) {
    return { v: 1, title: title || '새 PT', theme: theme || 'clean', slides: [makeSlide('cover', {})], assets: {} };
  }
  function normalizeDeck(d) {
    const deck = Object.assign({ v: 1, title: '새 PT', theme: 'clean', slides: [], assets: {} }, d || {});
    if (!THEMES[deck.theme]) deck.theme = 'clean';
    if (!Array.isArray(deck.slides)) deck.slides = [];
    deck.slides = deck.slides.filter(Boolean).map((s) => Object.assign({ id: uid(), layout: 'blank', variant: 'base', deco: true, bg: null, bgAsset: null, notes: '', els: [] }, s));
    deck.slides.forEach((s) => { s.els = (s.els || []).filter((e) => e && e.type).map((e) => Object.assign({ id: uid() }, e)); });
    if (!deck.slides.length) deck.slides.push(makeSlide('cover', {}));
    if (!deck.assets || typeof deck.assets !== 'object') deck.assets = {};
    return deck;
  }
  function usedAssets(deck) {
    const used = new Set();
    deck.slides.forEach((s) => {
      if (s.bgAsset) used.add(s.bgAsset);
      s.els.forEach((e) => { if (e.type === 'image' && e.asset) used.add(e.asset); });
    });
    return used;
  }
  function gcAssets(deck) {
    const used = usedAssets(deck);
    Object.keys(deck.assets).forEach((k) => { if (!used.has(k)) delete deck.assets[k]; });
  }
  function serialize(deck) {
    return { v: 1, title: deck.title, theme: deck.theme, slides: deck.slides, assets: deck.assets, slideCount: deck.slides.length, createdAt: deck.createdAt || new Date().toISOString() };
  }

  /* ---------- 서식(템플릿) ---------- */
  const TEMPLATES = [
    { id: 'blank', name: '빈 발표', desc: '표지 한 장으로 시작', theme: 'clean', slides: [['cover', {}]] },
    { id: 'report', name: '업무 보고', desc: '배경 → 성과 → 실적 → 일정', theme: 'clean', slides: [
      ['cover', { title: '2026년 주요 업무 추진 현황 보고', body: '추진 실적과 향후 계획', meta: '2026. 11. · 기획팀', notes: '보고 목적을 한 문장으로 먼저 말합니다.' }],
      ['toc', { body: '추진 배경\n주요 성과\n추진 실적\n향후 일정' }],
      ['titleBody', { title: '추진 배경', body: '현장 요구 증가에 따른 업무 체계 개선 필요\n부서 간 정보 공유 지연으로 처리 기간 증가\n  평균 처리 기간 7일 → 목표 3일\n관련 지침 개정 사항 반영', notes: '숫자는 화면에 두고, 경위는 말로 설명합니다.' }],
      ['bigNumber', { title: '주요 성과', number: '42%', body: '민원 처리 기간 단축', meta: '전년 대비 · 내부 집계 기준' }],
      ['table', { title: '추진 실적', rows: [['구분', '계획', '실적', '달성률'], ['교육 운영', '12회', '14회', '117%'], ['현장 점검', '40건', '38건', '95%'], ['제도 개선', '5건', '5건', '100%']] }],
      ['timeline', { title: '향후 일정', steps: [{ label: '12월', desc: '세부 계획 수립' }, { label: '1월', desc: '시범 운영' }, { label: '3월', desc: '확대 적용' }, { label: '6월', desc: '성과 평가' }] }],
      ['closing', { title: '감사합니다', body: '문의: 기획팀 · 내선 0000' }]
    ] },
    { id: 'lesson', name: '교육 교안', desc: '목표 → 내용 → 비교 → 정리', theme: 'warm', slides: [
      ['cover', { title: '현장 안전 기본 수칙', body: '신규 직원 직무 교육 1차시', meta: '교육 담당 · 50분' }],
      ['titleBody', { title: '학습 목표', body: '현장 위험 요소를 세 가지 이상 찾을 수 있다\n상황별 기본 대응 절차를 설명할 수 있다\n보호 장비를 올바르게 착용할 수 있다', notes: '목표는 "~할 수 있다"로 끝나게 말합니다.' }],
      ['toc', { title: '오늘 배울 내용', body: '위험 요소 찾기\n기본 대응 절차\n보호 장비 착용\n사례로 정리' }],
      ['twoCol', { title: '바른 예와 잘못된 예', head1: '바른 예', body: '출동 전 장비 점검표 확인\n2인 1조로 진입\n무전으로 위치 보고', head2: '잘못된 예', body2: '점검 없이 출동\n혼자 먼저 진입\n보고 없이 이동' }],
      ['quote', { body: '안전은 절차를 지키는 습관에서 시작됩니다.', meta: '— 현장 안전 기본 원칙' }],
      ['photo', { body: '현장 사진을 넣고 한 줄 설명을 적으세요' }],
      ['titleBody', { title: '정리', body: '위험 요소는 출동 전에 먼저 확인한다\n절차는 순서대로, 2인 1조로\n장비는 매번 같은 순서로 착용한다' }],
      ['closing', { title: '질문 있으신가요?', body: '다음 차시: 상황별 대응 실습' }]
    ] },
    { id: 'meeting', name: '회의 안건', desc: '안건 → 논의 → 역할 → 결정', theme: 'navy', slides: [
      ['cover', { title: '주간 업무 회의', body: '안건 및 논의 사항', meta: '2026. 11. 25.(수) 10:00 · 소회의실' }],
      ['toc', { title: '안건', body: '지난 회의 후속 조치\n이번 주 주요 일정\n역할 분담\n결정 사항' }],
      ['titleBody', { title: '지난 회의 후속 조치', body: '자료 취합 양식 확정: 완료\n시스템 점검 일정 조율: 진행 중\n  업체 회신 대기(금요일까지)' }],
      ['table', { title: '역할 분담', rows: [['과제', '담당', '기한', '상태'], ['자료 취합', '', '11. 28.', '진행'], ['현장 점검', '', '12. 2.', '예정'], ['결과 보고', '', '12. 5.', '예정']] }],
      ['titleBody', { title: '결정 사항 및 다음 일정', body: '결정 1:\n결정 2:\n다음 회의: 12. 2.(화) 10:00' }]
    ] },
    { id: 'result', name: '성과 발표', desc: '숫자 → 추이 → 전후 비교', theme: 'contrast', slides: [
      ['cover', { title: '2026년 성과 발표', body: '숫자로 보는 한 해', meta: '2026. 12.' }],
      ['bigNumber', { title: '핵심 성과', number: '1,248건', body: '올해 처리한 현장 지원 요청', meta: '1~11월 누계' }],
      ['chart', { title: '분기별 처리 건수', chart: { kind: 'bar', labels: ['1분기', '2분기', '3분기', '4분기'], values: [240, 310, 352, 346] } }],
      ['twoCol', { title: '도입 전과 후', head1: '도입 전', body: '종이 서식으로 접수\n처리 현황 확인에 하루\n중복 접수 잦음', head2: '도입 후', body2: '온라인 접수\n실시간 현황 확인\n중복 접수 자동 확인' }],
      ['closing', { title: '감사합니다', body: '' }]
    ] },
    { id: 'seminar', name: '세미나 발표', desc: '어두운 화면, 큰 글자', theme: 'dark', slides: [
      ['cover', { title: '일하는 방식을 바꾸는 작은 습관', body: '부서 공유 세미나', meta: '발표자 · 2026. 11.' }],
      ['quote', { body: '좋은 보고는 한 장에 한 가지 메시지를 담습니다.', meta: '— 발표 디자인 원칙' }],
      ['titleBody', { title: '오늘의 세 가지', body: '한 장에 한 메시지\n글은 줄이고 말로 설명\n숫자는 크게, 근거는 노트에' }],
      ['chart', { title: '업무 시간 사용 비율', chart: { kind: 'pie', labels: ['문서 작성', '회의', '현장 업무', '기타'], values: [38, 22, 30, 10] } }],
      ['closing', { title: '감사합니다', body: '자료는 부서 공유 폴더에 있습니다' }]
    ] }
  ];
  function deckFromTemplate(tpl) {
    const deck = blankDeck(tpl.id === 'blank' ? '새 PT' : tpl.name, tpl.theme);
    deck.slides = tpl.slides.map(([l, c]) => makeSlide(l, c));
    return deck;
  }

  /* ---------- 개요 → 슬라이드 ---------- */
  const NUM_RE = /^[+\-]?[\d][\d.,]*\s*[%a-zA-Z가-힣]{0,3}$/;
  /* '#' 없이 쓴 개요도 받기: 빈 줄로 나뉜 덩어리의 첫 줄, 또는 글머리(-) 아닌 줄을 슬라이드 제목으로 본다 */
  const BULLET_RE = /^([ \t]*)(?:[-*•·]|\d{1,2}[.)])\s+/;
  const SPECIAL_RE = /^\s*(?:(노트|메모|note)\s*[:：]|>|\|)/i;
  function autoHeadings(lines) {
    if (lines.some((l) => /^#(?!#)/.test(l))) return lines;
    const plain = (l) => l.trim() && !/^\s/.test(l) && !BULLET_RE.test(l) && !SPECIAL_RE.test(l);
    const blocks = lines.join('\n').split(/\n\s*\n/).filter((b) => b.trim());
    if (blocks.length > 1) {
      return blocks.map((b) => {
        const ls = b.split('\n');
        const i = ls.findIndex((l) => l.trim());
        if (i >= 0 && plain(ls[i])) ls[i] = '# ' + ls[i].trim();
        return ls.join('\n');
      }).join('\n\n').split('\n');
    }
    if (lines.some((l) => BULLET_RE.test(l))) return lines.map((l) => (plain(l) ? '# ' + l.trim() : l));
    return lines;
  }
  function parseOutline(text) {
    const groups = [];
    let g = null;
    const newGroup = (title) => { g = { title, items: [], subs: [], quote: [], table: [], notes: [], bullets: 0 }; groups.push(g); };
    autoHeadings(String(text || '').replace(/\r/g, '').split('\n')).forEach((raw) => {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) return;
      if (/^#(?!#)/.test(line)) { newGroup(line.replace(/^#\s*/, '').trim()); return; }
      if (!g) newGroup('');
      if (/^##/.test(line)) { g.subs.push({ head: line.replace(/^#+\s*/, '').trim(), items: [] }); return; }
      const nm = /^\s*(노트|메모|note)\s*[:：]\s*(.*)$/i.exec(line);
      if (nm) { g.notes.push(nm[2]); return; }
      if (/^\s*>/.test(line)) { g.quote.push(line.replace(/^\s*>\s?/, '')); return; }
      if (/^\s*\|.*\|\s*$/.test(line)) {
        if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) return;
        g.table.push(line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim()));
        return;
      }
      const m = /^([ \t]*)(?:[-*•·]|\d{1,2}[.)])\s+(.*)$/.exec(line);
      let item;
      if (m) g.bullets++;
      if (m) item = '  '.repeat(Math.min(2, Math.floor(m[1].replace(/\t/g, '  ').length / 2))) + m[2];
      else item = line.trim();
      if (g.subs.length) g.subs[g.subs.length - 1].items.push(item); else g.items.push(item);
    });
    return groups;
  }
  function outlineToSlides(text, opts) {
    opts = opts || {};
    const groups = parseOutline(text);
    const out = [];
    groups.forEach((g, gi) => {
      const notes = g.notes.join('\n');
      const top = g.items.filter((x) => !/^\s/.test(x));
      if (gi === 0 && g.title && g.items.length <= 2 && !g.bullets && !g.table.length && !g.quote.length && !g.subs.length) {
        out.push(makeSlide('cover', { title: g.title, body: g.items[0] || '', meta: g.items[1] || '', notes }));
        return;
      }
      if (/^(감사|마무리|끝|맺음|Q\s*&\s*A|질의|질문)/i.test(g.title) && !g.table.length) {
        out.push(makeSlide('closing', { title: g.title, body: g.items.join(' · '), notes }));
        return;
      }
      if (/^(목차|차례|순서|agenda)/i.test(g.title)) {
        out.push(makeSlide('toc', { title: g.title, body: top.join('\n'), notes }));
        out[out.length - 1]._toc = true;
        return;
      }
      if (g.table.length) {
        out.push(makeSlide('table', { title: g.title, rows: normalizeRows(g.table), notes: [notes, g.items.join('\n')].filter(Boolean).join('\n') }));
        return;
      }
      if (g.quote.length) {
        const meta = g.items[0] ? (/^[—-]/.test(g.items[0]) ? g.items[0] : '— ' + g.items[0]) : '';
        out.push(makeSlide('quote', { body: g.quote.join('\n'), meta, notes: [g.title, notes].filter(Boolean).join('\n') }));
        return;
      }
      if (g.subs.length >= 2) {
        out.push(makeSlide('twoCol', { title: g.title, head1: g.subs[0].head, body: g.subs[0].items.join('\n'), head2: g.subs[1].head, body2: g.subs.slice(1).map((s, i) => (i ? s.head + '\n' : '') + s.items.join('\n')).join('\n'), notes }));
        return;
      }
      if (g.items.length && g.items.length <= 3 && NUM_RE.test(g.items[0].trim())) {
        out.push(makeSlide('bigNumber', { title: g.title, number: g.items[0].trim(), body: g.items[1] || '', meta: g.items[2] || '', notes }));
        return;
      }
      const stepRe = /^(.{1,14}?)\s*[:：]\s*(.+)$/;
      if (/(일정|단계|추진|로드맵|계획|절차|과정|흐름)/.test(g.title) && top.length >= 2 && top.length <= 5 && top.length === g.items.length && top.every((x) => stepRe.test(x))) {
        out.push(makeSlide('timeline', { title: g.title, steps: top.map((x) => { const m = stepRe.exec(x); return { label: m[1], desc: m[2] }; }), notes }));
        return;
      }
      const sub = g.subs.length === 1 ? [g.subs[0].head].concat(g.subs[0].items.map((x) => '  ' + x)) : [];
      const items = g.items.concat(sub);
      if (!items.length) { out.push(makeSlide('titleBody', { title: g.title, notes })); return; }
      const chunks = [];
      if (opts.split && top.length > 6) {
        let cur = [], count = 0;
        items.forEach((x) => {
          const isTop = !/^\s/.test(x);
          if (isTop && count === 6) { chunks.push(cur); cur = []; count = 0; }
          if (isTop) count++;
          cur.push(x);
        });
        if (cur.length) chunks.push(cur);
      } else chunks.push(items);
      chunks.forEach((ch, ci) => out.push(makeSlide('titleBody', { title: g.title + (ci ? ' (계속)' : ''), body: ch.join('\n'), notes: ci ? '' : notes })));
    });
    if (opts.toc && !out.some((s) => s._toc)) {
      const titles = [];
      out.forEach((s) => {
        if (s.layout === 'cover' || s.layout === 'closing' || s.layout === 'quote') return;
        const t = s.els.find((e) => e.role === 'title');
        const tx = t && t.text.replace(/\s*\(계속\)$/, '');
        if (tx && !titles.includes(tx)) titles.push(tx);
      });
      if (titles.length >= 3) out.splice(out[0] && out[0].layout === 'cover' ? 1 : 0, 0, makeSlide('toc', { title: '목차', body: titles.slice(0, 8).join('\n') }));
    }
    out.forEach((s) => { delete s._toc; });
    return out;
  }
  function normalizeRows(rows) {
    const cols = Math.max(1, ...rows.map((r) => r.length));
    return rows.map((r) => Array.from({ length: cols }, (_, i) => (r[i] == null ? '' : String(r[i]))));
  }
  function deckToOutline(deck) {
    const lines = [];
    deck.slides.forEach((s) => {
      const c = roleTexts(s);
      const strip = (t) => String(t || '').split('\n').filter((x) => x.trim());
      lines.push('# ' + (c.title || c.number || (s.layout === 'quote' ? '인용' : '슬라이드')).replace(/\n/g, ' '));
      if (s.layout === 'quote') { strip(c.body).forEach((x) => lines.push('> ' + x)); if (c.meta) lines.push(c.meta); }
      else if (s.layout === 'twoCol') {
        if (c.head1 || c.body) { lines.push('## ' + (c.head1 || '왼쪽')); strip(c.body).forEach((x) => lines.push('- ' + x.replace(/^(\s*)/, '$1'))); }
        if (c.head2 || c.body2) { lines.push('## ' + (c.head2 || '오른쪽')); strip(c.body2).forEach((x) => lines.push('- ' + x)); }
      } else if (s.layout === 'timeline') {
        for (let i = 1; i <= 5; i++) if (c['step' + i] || c['desc' + i]) lines.push('- ' + (c['step' + i] || '') + ': ' + (c['desc' + i] || ''));
      } else {
        if (s.layout === 'bigNumber' && c.number && c.title) lines.push(c.number);
        if (s.layout === 'cover') { if (c.body) lines.push(c.body); if (c.meta) lines.push(c.meta); }
        else {
          strip(c.body).forEach((x) => { const m = /^(\s*)(.*)$/.exec(x); lines.push(m[1] + '- ' + m[2]); });
          if (s.layout !== 'closing') strip(c.body2).forEach((x) => lines.push('- ' + x));
          if (c.meta && s.layout !== 'closing') lines.push(c.meta);
        }
        if (c.rows) c.rows.forEach((r) => lines.push('| ' + r.join(' | ') + ' |'));
        if (c.chart && !c.rows) (c.chart.labels || []).forEach((l, i) => lines.push('| ' + l + ' | ' + ((c.chart.values || [])[i] == null ? '' : c.chart.values[i]) + ' |'));
      }
      if (s.notes) s.notes.split('\n').filter(Boolean).forEach((n) => lines.push('노트: ' + n));
      lines.push('');
    });
    return lines.join('\n');
  }

  /* ---------- 품질 점검 ---------- */
  function measureOverflow(deck, slides) {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-20000px;top:0;width:' + W + 'px;visibility:hidden;pointer-events:none';
    document.body.appendChild(box);
    const res = {};
    try {
      slides.forEach((s) => {
        box.innerHTML = slideMarkup(deck, s, { ids: true, noImg: true });
        const set = new Set();
        box.querySelectorAll('[data-id]').forEach((n) => {
          const tx = n.querySelector('[data-tx]');
          const tin = tx && tx.firstElementChild;
          if (!tin) return;
          const cs = getComputedStyle(tx);
          const avail = tx.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
          if (tin.offsetHeight > avail + 3 || tin.scrollWidth > tx.clientWidth + 3) set.add(n.dataset.id);
        });
        res[s.id] = set;
      });
    } finally { box.remove(); }
    return res;
  }
  function checkDeck(deck) {
    const issues = [];
    const over = measureOverflow(deck, deck.slides);
    deck.slides.forEach((s, si) => {
      const p = palette(deck, s);
      const bg = slideBg(s, p);
      const add = (level, msg, el) => issues.push({ si, level, msg, el: el || null });
      let chars = 0, items = 0, hasTitle = false;
      const sizes = new Set();
      const images = s.els.filter((e) => e.type === 'image' && e.asset);
      s.els.forEach((e) => {
        const hasText = (e.type === 'text' || e.type === 'shape') && String(e.text || '').trim();
        if (hasText && e.role !== 'mark') {
          const tx = String(e.text).trim();
          chars += tx.replace(/\s/g, '').length;
          sizes.add(e.size);
          if (e.list) items += listLines(tx).filter((l) => l.t.trim() && l.lvl === 0).length;
          if (e.role === 'title') {
            hasTitle = true;
            if (tx.replace(/\s/g, '').length > 40) add('info', '제목이 깁니다. 20자 안팎 한 줄로 줄여 보세요.', e.id);
          }
          if (e.size < 18) add('warn', '글자 크기 ' + e.size + 'pt. 18pt 이상을 권장합니다.', e.id);
          let behind = bg, known = !s.bgAsset;
          if (e.type === 'shape' && col(e.fill, p) && (e.opacity == null || e.opacity >= 0.6)) { behind = col(e.fill, p); known = true; }
          else if (e.type === 'shape' && col(e.fill, p) && e.opacity > 0) { behind = mix(bg, col(e.fill, p), e.opacity); known = !images.length; }
          else if (images.some((im) => im.x < e.x + e.w && im.x + im.w > e.x && im.y < e.y + e.h && im.y + im.h > e.y)) {
            known = false;
            add('info', '사진 위에 글자가 있습니다. 반투명 띠를 깔면 읽기 쉽습니다.', e.id);
          }
          if (known) {
            const fg = col(e.color, p) || p.text;
            const ratio = contrast(fg, behind);
            const need = e.size >= 24 || (e.bold && e.size >= 18.5) ? 3 : 4.5;
            if (ratio < need) add('warn', '글자와 배경의 대비가 낮습니다 (' + ratio.toFixed(1) + ':1, 기준 ' + need + ':1).', e.id);
          }
          if (over[s.id] && over[s.id].has(e.id)) add('warn', '글이 상자를 넘칩니다. 글을 줄이거나 상자를 키우세요.', e.id);
        }
        if (e.type === 'table') {
          sizes.add(e.size);
          if (e.size < 18) add('warn', '표 글자 크기 ' + e.size + 'pt. 18pt 이상을 권장합니다.', e.id);
          const cells = (e.rows || []).reduce((a, r) => a + r.length, 0);
          if ((e.rows || []).length > 8 || cells > 40) add('warn', '표가 큽니다(' + (e.rows || []).length + '행). 핵심 행만 남기세요.', e.id);
          chars += (e.rows || []).reduce((a, r) => a + r.join('').replace(/\s/g, '').length, 0) * 0.5;
        }
        if (e.type === 'chart') {
          if ((e.labels || []).length > 8) add('info', '차트 항목이 ' + e.labels.length + '개입니다. 7개 이하로 묶어 보세요.', e.id);
          if ((e.size || 18) < 18) add('warn', '차트 글자 크기 ' + e.size + 'pt. 18pt 이상을 권장합니다.', e.id);
        }
        if (e.type === 'image' && !e.asset) add('warn', '비어 있는 사진 자리가 있습니다.', e.id);
        if (e.x < -2 || e.y < -2 || e.x + e.w > W + 2 || e.y + e.h > H + 2) add('warn', '슬라이드 밖으로 나간 요소가 있습니다.', e.id);
      });
      const boxes = s.els.filter((e) => ((e.type === 'text' && String(e.text || '').trim() && e.role !== 'mark') || e.type === 'table' || e.type === 'chart'));
      for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
        const A = boxes[a], B = boxes[b];
        const ix = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x), iy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
        if (ix > 0 && iy > 0 && ix * iy > 0.2 * Math.min(A.w * A.h, B.w * B.h)) { add('warn', '글·표·차트가 서로 겹칩니다.', B.id); a = boxes.length; break; }
      }
      chars = Math.round(chars);
      if (chars > 200) add('warn', '글자가 많습니다(' + chars + '자). 설명은 발표자 노트로 옮기세요.');
      else if (chars > 140) add('info', '글자가 다소 많습니다(' + chars + '자). 말로 할 내용은 노트로 옮겨 보세요.');
      if (items > 6) add('warn', '항목이 ' + items + '개입니다. 한 장에 6개 이하로 나누세요.');
      if (!hasTitle && ['titleBody', 'twoCol', 'table', 'timeline', 'chart', 'toc'].includes(s.layout)) add('info', '제목이 비어 있습니다.');
      if (sizes.size > 4) add('info', '글자 크기가 ' + sizes.size + '가지입니다. 3~4가지로 줄여 보세요.');
      if (s.els.length > 14) add('info', '요소가 ' + s.els.length + '개입니다. 한 장에 한 메시지만 담아 보세요.');
    });
    const warn = issues.filter((i) => i.level === 'warn').length;
    const info = issues.length - warn;
    const noNotes = deck.slides.filter((s) => !String(s.notes || '').trim() && !['cover', 'closing'].includes(s.layout)).length;
    const score = Math.max(0, Math.round(100 - warn * 6 - info * 2));
    return { issues, warn, info, score, noNotes };
  }

  /* ---------- 이미지 읽기(크게는 줄여서 저장) ---------- */
  function readImage(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('사진을 읽지 못했습니다.'));
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('지원하지 않는 사진 형식입니다.'));
        img.onload = () => {
          const max = 1920;
          let w = img.naturalWidth, h = img.naturalHeight;
          const big = Math.max(w, h) > max || file.size > 1.5 * 1024 * 1024;
          if (!big || /svg|gif/.test(file.type)) { resolve({ data: fr.result, w, h }); return; }
          const k = Math.min(1, max / Math.max(w, h));
          w = Math.round(w * k); h = Math.round(h * k);
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          const png = /png|webp/.test(file.type);
          let data = c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.86);
          if (png && data.length > 2.5 * 1024 * 1024) data = c.toDataURL('image/jpeg', 0.86);
          resolve({ data, w, h });
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  function pickFiles(accept, multiple) {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = accept;
      inp.multiple = !!multiple;
      inp.style.display = 'none';
      inp.addEventListener('change', () => { resolve(Array.from(inp.files || [])); inp.remove(); });
      document.body.appendChild(inp);
      inp.click();
    });
  }
  const baseName = (n) => String(n || '').replace(/\.[^.]+$/, '');
  const safeFile = (t) => (String(t || 'PT').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'PT').slice(0, 80);

  /* ---------- 내보내기: PPTX ---------- */
  const inch = (v) => Math.round((v / 96) * 10000) / 10000;
  const hx = (c) => String(c || '#000000').replace('#', '').toUpperCase();
  function pptRuns(e, p) {
    const color = hx(col(e.color, p) || p.text);
    const lines = listLines(e.text);
    if (!e.list) return String(e.text || '');
    const runs = [];
    const n = [0, 0, 0];
    lines.forEach(({ lvl, t }, i) => {
      const last = i === lines.length - 1;
      if (!t) { runs.push({ text: ' ', options: { breakLine: !last } }); return; }
      n[lvl]++;
      for (let k = lvl + 1; k < 3; k++) n[k] = 0;
      const o = { indentLevel: lvl, breakLine: !last, fontSize: lvl ? Math.round(e.size * 0.86) : e.size };
      if (e.list === 'step' && lvl === 0) {
        runs.push({ text: String(n[0]).padStart(2, '0') + '   ', options: { bold: true, color: hx(col('@accent', p)), fontSize: e.size } });
        runs.push({ text: t, options: o });
      } else {
        o.bullet = e.list === 'number' && lvl === 0 ? { type: 'number' } : { code: lvl === 0 ? '2022' : lvl === 1 ? '2013' : '00B7' };
        if (lvl === 0) o.color = color;
        runs.push({ text: t, options: o });
      }
    });
    return runs;
  }
  function pptTextOpts(e, p) {
    const pad = e.type === 'shape' ? PAD_S : PAD_T;
    return {
      x: inch(e.x), y: inch(e.y), w: inch(e.w), h: inch(e.h),
      fontFace: PPT_FONT, fontSize: e.size, color: hx(col(e.color, p) || p.text),
      bold: !!e.bold, italic: !!e.italic, underline: e.underline ? { style: 'sng' } : undefined,
      align: e.align || 'left', valign: e.valign === 'middle' ? 'middle' : e.valign === 'bottom' ? 'bottom' : 'top',
      lineSpacingMultiple: e.lh ? Math.max(0.8, Math.min(2.5, e.lh * 0.83)) : undefined,
      margin: [pad[1] * 0.75, pad[1] * 0.75, pad[0] * 0.75, pad[0] * 0.75],
      paraSpaceAfter: e.list ? 4 : 0,
      fit: 'none'
    };
  }
  const PPT_SHAPE = { rect: 'rect', roundRect: 'roundRect', ellipse: 'ellipse', triangle: 'triangle', rightArrow: 'rightArrow', line: 'line' };
  function pptShape(pptx, s, e, p) {
    const fill = col(e.fill, p);
    const stroke = col(e.stroke, p);
    const op = e.opacity == null ? 1 : e.opacity;
    if (e.shape === 'line') {
      const horiz = e.w >= e.h;
      s.addShape(pptx.ShapeType.line, {
        x: inch(horiz ? e.x : e.x + e.w / 2), y: inch(horiz ? e.y + e.h / 2 : e.y), w: horiz ? inch(e.w) : 0, h: horiz ? 0 : inch(e.h),
        line: { color: hx(stroke || fill || '#000000'), width: (e.strokeW || 3) * 0.75 }
      });
      return;
    }
    const o = { x: inch(e.x), y: inch(e.y), w: inch(e.w), h: inch(e.h) };
    if (fill) o.fill = { color: hx(fill), transparency: Math.round((1 - op) * 100) };
    if (stroke) o.line = { color: hx(stroke), width: (e.strokeW || 2) * 0.75 };
    if (e.shape === 'roundRect') o.rectRadius = inch(Math.min(e.w, e.h) * 0.18);
    const type = pptx.ShapeType[PPT_SHAPE[e.shape] || 'rect'];
    if (String(e.text || '').trim()) s.addText(pptRuns(e, p), Object.assign(pptTextOpts(e, p), o, { shape: type }));
    else s.addShape(type, o);
  }
  async function buildPPTX(deck) {
    await P.loadScript(VENDOR_JSZIP);
    await P.loadScript(VENDOR_PPTX);
    if (!window.PptxGenJS) throw new Error('PPTX 도구를 불러오지 못했습니다.');
    const pptx = new window.PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.title = deck.title || 'PT';
    pptx.theme = { headFontFace: PPT_FONT, bodyFontFace: PPT_FONT };
    const theme = THEMES[deck.theme] || THEMES.clean;
    deck.slides.forEach((sl) => {
      const p = palette(deck, sl);
      const bg = slideBg(sl, p);
      const s = pptx.addSlide();
      const bgSrc = sl.bgAsset && deck.assets[sl.bgAsset];
      const ext = bgSrc ? ((/^data:image\/(png|jpeg|gif)/.exec(bgSrc) || [0, 'png'])[1]) : '';
      s.background = bgSrc ? { data: bgSrc, path: 'background.' + ext } : { color: hx(bg) };
      if (sl.deco !== false) (theme.deco[sl.variant === 'cover' ? 'cover' : 'base'] || []).forEach((d) => pptShape(pptx, s, S(d), p));
      sl.els.forEach((e) => {
        try {
          if (e.type === 'text') { if (String(e.text || '').length) s.addText(pptRuns(e, p), pptTextOpts(e, p)); }
          else if (e.type === 'shape') pptShape(pptx, s, e, p);
          else if (e.type === 'image') {
            const src = e.asset && deck.assets[e.asset];
            if (!src) return;
            const nw = e.nw || e.w, nh = e.nh || e.h;
            if (e.fit === 'contain') {
              const k = Math.min(e.w / nw, e.h / nh);
              const w = nw * k, h = nh * k;
              s.addImage({ data: src, x: inch(e.x + (e.w - w) / 2), y: inch(e.y + (e.h - h) / 2), w: inch(w), h: inch(h) });
            } else {
              s.addImage({ data: src, x: inch(e.x), y: inch(e.y), w: inch(nw), h: inch(nh), sizing: { type: 'cover', w: inch(e.w), h: inch(e.h) } });
            }
          } else if (e.type === 'table') {
            const light = lum(bg) > 0.45;
            const border = hx(light ? '#D5DBE5' : mix(bg, '#FFFFFF', 0.22));
            const head = col('@accent', p);
            const band = light ? mix(bg, col('@accent', p), 0.07) : mix(bg, '#FFFFFF', 0.06);
            const rows = (e.rows || []).map((r, ri) => r.map((c, ci) => {
              const isHead = e.header && ri === 0;
              const o = { bold: isHead, color: hx(isHead ? onColor(head) : p.text), align: ci === 0 || isHead ? 'center' : 'left', valign: 'middle' };
              if (isHead) o.fill = { color: hx(head) };
              else if (e.band && ri % 2 === (e.header ? 0 : 1)) o.fill = { color: hx(band) };
              return { text: String(c == null ? '' : c), options: o };
            }));
            if (!rows.length) return;
            const cols = rows[0].length;
            s.addTable(rows, {
              x: inch(e.x), y: inch(e.y), w: inch(e.w), colW: Array(cols).fill(inch(e.w / cols)), rowH: inch(e.h / rows.length),
              fontFace: PPT_FONT, fontSize: e.size, border: { type: 'solid', pt: 0.75, color: border }, margin: [0.06, 0.1, 0.06, 0.1]
            });
          } else if (e.type === 'chart') {
            const labels = (e.labels || []).map(String);
            const values = (e.values || []).map((v) => Number(v) || 0);
            if (!labels.length) return;
            const kind = e.kind === 'pie' ? pptx.ChartType.doughnut : e.kind === 'line' ? pptx.ChartType.line : pptx.ChartType.bar;
            const colors = chartColors(p).map(hx);
            s.addChart(kind, [{ name: e.title || '값', labels, values }], {
              x: inch(e.x), y: inch(e.y), w: inch(e.w), h: inch(e.h),
              barDir: 'col', chartColors: e.kind === 'pie' ? colors : [colors[0]], lineSize: 3, lineDataSymbolSize: 9,
              showValue: !!e.showValues && e.kind !== 'pie', showPercent: !!e.showValues && e.kind === 'pie',
              dataLabelFontSize: e.size || 18, dataLabelColor: hx(p.text), dataLabelFontFace: PPT_FONT,
              catAxisLabelFontSize: e.size || 18, catAxisLabelColor: hx(p.text), catAxisLabelFontFace: PPT_FONT,
              valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
              showLegend: e.kind === 'pie', legendPos: 'r', legendFontSize: e.size || 18, legendColor: hx(p.text), legendFontFace: PPT_FONT,
              showTitle: !!e.title, title: e.title || '', titleFontSize: Math.round((e.size || 18) * 1.1), titleColor: hx(p.title), titleFontFace: PPT_FONT,
              holeSize: 50, dataLabelPosition: e.kind === 'bar' || !e.kind ? 'outEnd' : undefined
            });
          }
        } catch (err) { console.warn('PPTX 요소 변환 실패', err); }
      });
      if (String(sl.notes || '').trim()) s.addNotes(sl.notes);
    });
    return pptx.write({ outputType: 'blob' });
  }

  /* ---------- 내보내기: PNG ---------- */
  async function slidePNG(deck, slide, scale) {
    scale = scale || 1.5;
    const holder = document.createElement('div');
    holder.innerHTML = slideMarkup(deck, slide, {});
    const node = holder.firstElementChild;
    node.style.transform = 'scale(' + scale + ')';
    node.style.transformOrigin = '0 0';
    const xhtml = new XMLSerializer().serializeToString(node);
    const cw = Math.round(W * scale), ch = Math.round(H * scale);
    const svgText = '<svg xmlns="http://www.w3.org/2000/svg" width="' + cw + '" height="' + ch + '"><foreignObject x="0" y="0" width="' + cw + '" height="' + ch + '">' + xhtml + '</foreignObject></svg>';
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
    await img.decode();
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const g = c.getContext('2d');
    g.fillStyle = slideBg(slide, palette(deck, slide));
    g.fillRect(0, 0, cw, ch);
    g.drawImage(img, 0, 0);
    return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지를 만들지 못했습니다.'))), 'image/png'));
  }

  /* ---------- 내보내기: PDF(인쇄) ---------- */
  function printDeck(root, deck) {
    const old = root.querySelector('.slides-print');
    if (old) old.remove();
    const box = document.createElement('div');
    box.className = 'slides-print';
    box.innerHTML = deck.slides.map((s) => '<div class="slides-print-page">' + slideMarkup(deck, s, {}) + '</div>').join('');
    root.appendChild(box);
    document.body.classList.add('slides-printing');
    const done = () => {
      box.remove();
      document.body.classList.remove('slides-printing');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    const imgs = Array.from(box.querySelectorAll('img'));
    Promise.all(imgs.map((im) => (im.complete ? null : im.decode().catch(() => null)))).then(() => {
      setTimeout(() => {
        window.print();
      }, 60);
    });
    return done;
  }

  /* ---------- 공통 작은 UI ---------- */
  let openPop = null;
  function popover(anchor, content, opts) {
    closePopover();
    opts = opts || {};
    const pop = document.createElement('div');
    pop.className = 'slides-pop' + (opts.cls ? ' ' + opts.cls : '');
    pop.setAttribute('role', 'menu');
    if (Array.isArray(content)) {
      content.forEach((it) => {
        if (it === '-') { pop.appendChild(Object.assign(document.createElement('hr'), {})); return; }
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'slides-pop-item';
        b.setAttribute('role', 'menuitem');
        b.innerHTML = (it.icon || '') + '<span>' + esc(it.label) + '</span>' + (it.hint ? '<small>' + esc(it.hint) + '</small>' : '');
        if (it.disabled) b.disabled = true;
        b.addEventListener('click', () => { closePopover(); it.onClick(); });
        pop.appendChild(b);
      });
    } else pop.appendChild(content);
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = opts.alignRight ? r.right - pw : r.left;
    left = clamp(left, 8, window.innerWidth - pw - 8);
    let top = r.bottom + 6;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    const onDown = (ev) => { if (!pop.contains(ev.target) && !anchor.contains(ev.target)) closePopover(); };
    setTimeout(() => document.addEventListener('pointerdown', onDown, true), 0);
    openPop = { pop, off: () => document.removeEventListener('pointerdown', onDown, true) };
    const first = pop.querySelector('button, input, textarea, select');
    if (first && opts.focus !== false) setTimeout(() => first.focus(), 0);
    return closePopover;
  }
  function closePopover() {
    if (!openPop) return false;
    openPop.off();
    openPop.pop.remove();
    openPop = null;
    return true;
  }
  function relTime(iso) {
    const t = Date.parse(iso);
    if (!t) return '';
    const sec = Math.round((Date.now() - t) / 1000);
    if (sec < 60) return '방금 전';
    if (sec < 3600) return Math.floor(sec / 60) + '분 전';
    if (sec < 86400) return Math.floor(sec / 3600) + '시간 전';
    if (sec < 86400 * 7) return Math.floor(sec / 86400) + '일 전';
    return fmtDate(iso);
  }
  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const now = new Date();
    const same = d.toDateString() === now.toDateString();
    const p2 = (n) => String(n).padStart(2, '0');
    return same ? '오늘 ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) : d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';
  }

  /* ---------- 서식·레이아웃·테마 고르기 ---------- */
  function layoutGallery(deck, onPick) {
    const wrap = document.createElement('div');
    wrap.className = 'slides-gal';
    LAYOUTS.forEach((l) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'slides-gal-item';
      b.dataset.layout = l.id;
      b.innerHTML = miniHTML(deck, makeSlide(l.id, {}), { edit: true }) + '<span>' + esc(l.name) + '</span>';
      b.addEventListener('click', () => onPick(l.id));
      wrap.appendChild(b);
    });
    requestAnimationFrame(() => scaleMinis(wrap));
    return wrap;
  }
  function themeGallery(current, onPick) {
    const wrap = document.createElement('div');
    wrap.className = 'slides-gal slides-gal-theme';
    const sample = [makeSlide('cover', { title: '발표 제목', body: '부제목' }), makeSlide('titleBody', { title: '제목', body: '첫 번째 항목\n두 번째 항목' })];
    THEME_IDS.forEach((id) => {
      const t = THEMES[id];
      const d = { theme: id, assets: {} };
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'slides-gal-item' + (id === current ? ' active' : '');
      b.dataset.theme = id;
      b.setAttribute('aria-pressed', id === current ? 'true' : 'false');
      b.innerHTML = '<div class="slides-gal-pair">' + miniHTML(d, sample[0], {}) + miniHTML(d, sample[1], {}) + '</div><span>' + esc(t.name) + '</span><small>' + esc(t.desc) + '</small>';
      b.addEventListener('click', () => onPick(id));
      wrap.appendChild(b);
    });
    requestAnimationFrame(() => scaleMinis(wrap));
    return wrap;
  }
  const OUTLINE_SAMPLE = '# 2026년 교육 운영 결과 보고\n교육 운영 실적과 개선 방향\n2026. 11. · 교육팀\n\n# 추진 배경\n- 신규 인력 증가로 기초 교육 수요 확대\n- 현장 의견: 실습 비중 확대 요청\n  - 설문 응답자의 78%\n노트: 설문은 10월에 실시했습니다.\n\n# 핵심 성과\n96%\n교육 만족도\n교육생 설문, 312명 응답\n\n# 과정별 실적\n| 과정 | 계획 | 실적 |\n| 기본 | 10회 | 12회 |\n| 심화 | 6회 | 6회 |\n\n# 이전과 이후\n## 이전\n- 이론 중심\n## 이후\n- 실습 중심\n\n# 향후 추진 일정\n- 12월: 계획 수립\n- 2월: 과정 개편\n- 4월: 시범 운영\n\n# 감사합니다\n문의: 교육팀';
  function outlineDialog(opts) {
    return new Promise((resolve) => {
      const body = document.createElement('div');
      body.className = 'slides-outline';
      body.innerHTML = '<p class="muted slides-outline-help"><b># 제목</b>마다 슬라이드 한 장 · <b>- 항목</b> 글머리(앞에 공백 두 칸이면 하위 항목) · <b>## 소제목</b> 두 개면 2단 비교 · <b>&gt; 인용</b> · <b>| 표 | 칸 |</b> · 숫자 한 줄(예: 96%)이면 큰 숫자 · "일정: 내용" 줄이면 타임라인 · <b>노트:</b> 발표자 노트<br>기호가 어려우면 빈 줄로 장을 나누고 각 덩어리의 첫 줄을 제목으로 쓰셔도 됩니다.</p>' +
        '<textarea class="slides-outline-ta" rows="14" spellcheck="false" placeholder="' + esc(OUTLINE_SAMPLE) + '"></textarea>' +
        '<div class="slides-outline-opts"><label><input type="checkbox" data-o="split" checked> 항목이 6개를 넘으면 다음 장으로 나누기</label><label><input type="checkbox" data-o="toc"> 목차 장 자동 추가</label>' +
        (opts.withTheme ? '<label>테마 <select data-o="theme">' + THEME_IDS.map((id) => '<option value="' + id + '">' + esc(THEMES[id].name) + '</option>').join('') + '</select></label>' : '') +
        '</div><div class="slides-outline-foot"><button type="button" class="btn btn-sm btn-ghost" data-o="sample">예시 넣기</button><span class="muted" data-o="count">슬라이드 0장</span></div>';
      const ta = body.querySelector('textarea');
      const count = body.querySelector('[data-o="count"]');
      if (opts.initial) ta.value = opts.initial;
      const read = () => ({ split: body.querySelector('[data-o="split"]').checked, toc: body.querySelector('[data-o="toc"]').checked, theme: opts.withTheme ? body.querySelector('[data-o="theme"]').value : null });
      const upd = () => { count.textContent = '슬라이드 ' + (ta.value.trim() ? outlineToSlides(ta.value, read()).length : 0) + '장 생성 예정'; };
      ta.addEventListener('input', upd);
      body.querySelectorAll('input,select').forEach((x) => x.addEventListener('change', upd));
      body.querySelector('[data-o="sample"]').addEventListener('click', () => { ta.value = OUTLINE_SAMPLE; upd(); ta.focus(); });
      upd();
      let result = null;
      const actions = [{ label: '취소' }];
      (opts.actions || [{ id: 'new', label: '슬라이드 만들기' }]).forEach((a, i, arr) => actions.push({
        label: a.label, primary: i === arr.length - 1,
        onClick: () => {
          if (!ta.value.trim()) { P.ui.toast('개요를 입력하세요.', 'warn'); return false; }
          const o = read();
          result = { mode: a.id, slides: outlineToSlides(ta.value, o), theme: o.theme, text: ta.value, opts: o };
          return true;
        }
      }));
      P.ui.modal({ title: '개요로 만들기', body, wide: true, actions, onClose: () => resolve(result) });
    });
  }

  /* ========== 목록 화면 ========== */
  function mountList(root, ctx) {
    let alive = true;
    let items = [];
    root.innerHTML = '<div class="page slides-list">' +
      '<div class="page-head"><div><h1>PT</h1></div>' +
      '<div class="toolbar slides-list-acts"><button type="button" class="btn btn-ghost" data-a="import" title="PT 파일(.json) 열기">' + I.upload + '<span>파일 열기</span></button>' +
      '<button type="button" class="btn" data-a="photos" title="사진으로 만들기">' + I.image + '<span>사진으로</span></button>' +
      '<button type="button" class="btn" data-a="outline" title="개요로 만들기">' + I.outline + '<span>개요로</span></button>' +
      '<button type="button" class="btn btn-primary" data-a="new">' + I.plus + '새 PT</button></div></div>' +
      '<section class="slides-sec slides-sec-tpl" aria-label="서식으로 시작"><h2 class="section-title">서식</h2><div class="slides-tpls"></div></section>' +
      '<section class="slides-sec"><div class="slides-list-head"><h2 class="slides-h2">내 PT <span class="slides-count"></span></h2><label class="p-search">' + P.icons.search + '<input type="search" placeholder="제목 검색" aria-label="PT 찾기"></label></div><div class="slides-cards">' + P.ui.skeleton(2) + '</div></section></div>';
    const tplBox = root.querySelector('.slides-tpls');
    TEMPLATES.forEach((t) => {
      const d = deckFromTemplate(t);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'slides-tpl';
      b.title = t.desc;
      b.innerHTML = miniHTML(d, d.slides[0], { edit: t.id === 'blank' }) + '<span class="slides-tpl-txt"><b>' + esc(t.name) + '</b><small>' + d.slides.length + '장</small></span>';
      b.addEventListener('click', () => createDeck(deckFromTemplate(t)));
      tplBox.appendChild(b);
    });
    const cards = root.querySelector('.slides-cards');
    const search = root.querySelector('input[type="search"]');

    async function createDeck(deck) {
      const id = uid();
      deck.createdAt = new Date().toISOString();
      try {
        await P.store.put(COL, id, serialize(deck));
        ctx.navigate(APP_ID + '/' + id);
      } catch (e) { /* core가 알림 */ }
    }
    function render() {
      const q = search.value.trim().toLowerCase();
      const list = items.filter((it) => !q || String(it.data.title || '').toLowerCase().includes(q));
      root.querySelector('.slides-count').textContent = items.length ? String(items.length) : '';
      if (!items.length) {
        cards.innerHTML = '<div class="empty slides-empty"><p>아직 PT가 없습니다.</p><button type="button" class="btn btn-primary" data-a="new-empty">' + I.plus + '새 PT</button></div>';
        cards.querySelector('[data-a="new-empty"]').addEventListener('click', () => createDeck(blankDeck()));
        return;
      }
      if (!list.length) { cards.innerHTML = '<div class="empty slides-empty"><p>검색 결과 없음</p></div>'; return; }
      cards.innerHTML = '';
      list.forEach((it) => {
        const d = normalizeDeck(it.data);
        const card = document.createElement('div');
        card.className = 'slides-card';
        card.innerHTML = '<a class="slides-card-open" href="#/' + APP_ID + '/' + encodeURIComponent(it.id) + '" aria-label="' + esc(d.title || '제목 없음') + ' 열기">' + miniHTML(d, d.slides[0], {}) + '</a>' +
          '<div class="slides-card-meta"><a class="slides-card-title" href="#/' + APP_ID + '/' + encodeURIComponent(it.id) + '">' + esc(d.title || '제목 없음') + '</a>' +
          '<small>' + d.slides.length + '장 · ' + esc(relTime(it.updatedAt)) + '</small></div>' +
          '<div class="slides-card-acts"><button type="button" class="btn btn-ghost btn-sm p-icon-btn" data-a="rename" title="이름 변경" aria-label="이름 변경">' + I.edit + '</button>' +
          '<button type="button" class="btn btn-ghost btn-sm p-icon-btn" data-a="dup" title="복제" aria-label="복제">' + I.copy + '</button>' +
          '<button type="button" class="btn btn-ghost btn-sm p-icon-btn" data-a="del" title="삭제" aria-label="삭제">' + I.trash + '</button></div>';
        card.querySelector('[data-a="rename"]').addEventListener('click', async () => {
          const name = await P.ui.prompt('새 이름', d.title);
          if (name == null || !name.trim()) return;
          const fresh = await P.store.get(COL, it.id);
          if (!fresh) return;
          fresh.title = name.trim();
          await P.store.put(COL, it.id, fresh);
          P.ui.toast('이름을 바꿨습니다.', 'ok');
          load();
        });
        card.querySelector('[data-a="dup"]').addEventListener('click', async () => {
          const fresh = await P.store.get(COL, it.id);
          if (!fresh) return;
          fresh.title = (fresh.title || 'PT') + ' (사본)';
          fresh.createdAt = new Date().toISOString();
          await P.store.put(COL, uid(), fresh);
          P.ui.toast('복제했습니다.', 'ok');
          load();
        });
        card.querySelector('[data-a="del"]').addEventListener('click', async () => {
          const ok = await P.ui.confirm('"' + (d.title || '제목 없음') + '"을(를) 삭제할까요?\n삭제하면 되돌릴 수 없습니다.', { danger: true, okLabel: '삭제' });
          if (!ok) return;
          await P.store.remove(COL, it.id);
          P.ui.toast('삭제했습니다.', 'ok');
          load();
        });
        cards.appendChild(card);
      });
      requestAnimationFrame(() => scaleMinis(cards));
    }
    async function load() {
      try {
        const all = await P.store.list(COL);
        if (!alive) return;
        items = all.filter((x) => x && x.data);
      } catch (e) { items = []; }
      render();
    }
    search.addEventListener('input', render);
    root.querySelector('[data-a="new"]').addEventListener('click', () => createDeck(blankDeck()));
    root.querySelector('[data-a="outline"]').addEventListener('click', async () => {
      const r = await outlineDialog({ withTheme: true, actions: [{ id: 'new', label: '새 PT 만들기' }] });
      if (!r || !r.slides.length) return;
      const deck = blankDeck('', r.theme || 'clean');
      deck.slides = r.slides;
      const t = r.slides[0].els.find((e) => e.role === 'title');
      deck.title = (t && t.text) || '개요로 만든 PT';
      createDeck(deck);
    });
    root.querySelector('[data-a="photos"]').addEventListener('click', async () => {
      const files = (await pickFiles('image/*', true)).filter((f) => /^image\//.test(f.type));
      if (!files.length) return;
      const deck = blankDeck('사진 모음', 'dark');
      deck.slides = [];
      for (const f of files) {
        try {
          const im = await readImage(f);
          const aid = 'a' + uid();
          deck.assets[aid] = im.data;
          deck.slides.push(makeSlide('photo', { asset: aid, nw: im.w, nh: im.h, body: baseName(f.name) }));
        } catch (e) { P.ui.toast(f.name + ': ' + e.message, 'warn'); }
      }
      if (!deck.slides.length) return;
      deck.slides.unshift(makeSlide('cover', { title: '사진 모음' }));
      createDeck(deck);
    });
    root.querySelector('[data-a="import"]').addEventListener('click', async () => {
      const f = (await pickFiles('.json,application/json', false))[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data || !Array.isArray(data.slides)) throw new Error('PT 파일 형식이 아닙니다.');
        const deck = normalizeDeck(data);
        createDeck(deck);
      } catch (e) { P.ui.toast('파일을 열지 못했습니다: ' + e.message, 'error'); }
    });
    let ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(() => scaleMinis(root)); ro.observe(root); }
    requestAnimationFrame(() => scaleMinis(tplBox));
    load();
    return () => { alive = false; if (ro) ro.disconnect(); closePopover(); };
  }

  /* ========== 발표 모드 ========== */
  function present(deck, start, onExit) {
    let i = clamp(start || 0, 0, deck.slides.length - 1);
    let cover = null; // 'black' | 'white'
    let panel = P.settings.get('slides.presenter', false);
    let t0 = Date.now(), paused = 0, pauseAt = 0;
    const ov = document.createElement('div');
    ov.className = 'slides-pv';
    ov.tabIndex = -1;
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', '발표 모드');
    ov.innerHTML = '<div class="slides-pv-main"><div class="slides-pv-stage"></div><div class="slides-pv-cover"></div><div class="slides-pv-progress" aria-hidden="true"><i></i></div>' +
      '<div class="slides-pv-bar"><button type="button" data-k="prev" aria-label="이전">' + I.prev + '</button><span class="slides-pv-count"></span><button type="button" data-k="next" aria-label="다음">' + I.next + '</button>' +
      '<span class="slides-pv-sep"></span><button type="button" data-k="black" title="검은 화면 (B)" aria-label="검은 화면">' + I.screen + '</button><button type="button" data-k="panel" title="발표자 보기 (S)" aria-label="발표자 보기">' + I.notes + '</button>' +
      '<button type="button" data-k="full" title="전체 화면 (F)" aria-label="전체 화면">' + I.full + '</button><button type="button" data-k="exit" title="끝내기 (Esc)" aria-label="끝내기">' + I.close + '</button></div></div>' +
      '<aside class="slides-pv-side"><div class="slides-pv-timer"><span class="slides-pv-time">00:00</span><button type="button" data-k="pause">일시정지</button><button type="button" data-k="reset">다시</button></div>' +
      '<div class="slides-pv-label slides-pv-nl">다음 슬라이드</div><div class="slides-pv-next"></div><div class="slides-pv-label">발표자 노트</div><div class="slides-pv-notes"></div>' +
      '<div class="slides-pv-help"><span><kbd>→</kbd> 다음</span><span><kbd>←</kbd> 이전</span><span><kbd>B</kbd> 검은 화면</span><span><kbd>W</kbd> 흰 화면</span><span><kbd>S</kbd> 발표자 보기</span><span><kbd>Esc</kbd> 끝내기</span></div></aside>';
    document.body.appendChild(ov);
    const stage = ov.querySelector('.slides-pv-stage');
    const main = ov.querySelector('.slides-pv-main');
    const coverEl = ov.querySelector('.slides-pv-cover');
    const countEl = ov.querySelector('.slides-pv-count');
    const nextEl = ov.querySelector('.slides-pv-next');
    const notesEl = ov.querySelector('.slides-pv-notes');
    const timeEl = ov.querySelector('.slides-pv-time');

    function fit() {
      const r = main.getBoundingClientRect();
      const k = Math.min(r.width / W, r.height / H);
      const inner = stage.firstElementChild;
      if (inner) {
        inner.style.transform = 'scale(' + k + ')';
        stage.style.width = W * k + 'px';
        stage.style.height = H * k + 'px';
      }
      scaleMinis(nextEl);
    }
    function render(anim) {
      const s = deck.slides[i];
      stage.innerHTML = '<div class="slides-pv-in' + (anim ? ' slides-pv-fade' : '') + '">' + slideMarkup(deck, s, {}) + '</div>';
      countEl.textContent = (i + 1) + ' / ' + deck.slides.length;
      ov.querySelector('.slides-pv-progress i').style.width = ((i + 1) / deck.slides.length * 100) + '%';
      const nx = deck.slides[i + 1];
      nextEl.innerHTML = nx ? miniHTML(deck, nx, {}) : '<div class="slides-pv-end">마지막 슬라이드입니다</div>';
      notesEl.textContent = s.notes || '(노트 없음)';
      ov.classList.toggle('panel', !!panel);
      fit();
    }
    function go(n) {
      if (cover) { cover = null; coverEl.className = 'slides-pv-cover'; return; }
      const j = clamp(n, 0, deck.slides.length - 1);
      if (j === i && n >= deck.slides.length) { P.ui.toast('마지막 슬라이드입니다. Esc로 끝냅니다.', 'info'); return; }
      if (j === i) return;
      i = j;
      render(true);
    }
    function setCover(kind) {
      cover = cover === kind ? null : kind;
      coverEl.className = 'slides-pv-cover' + (cover ? ' on ' + cover : '');
    }
    function tick() {
      const ms = (pauseAt || Date.now()) - t0 - paused;
      const s = Math.max(0, Math.floor(ms / 1000));
      timeEl.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }
    const timer = setInterval(tick, 500);
    function exit() {
      clearInterval(timer);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', fit);
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) { /* 무시 */ } }
      ov.remove();
      if (onExit) onExit(i);
    }
    function onFs() { setTimeout(fit, 50); if (!document.fullscreenElement && wasFull) exit(); }
    let wasFull = false;
    function onKey(e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key;
      let used = true;
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === ' ' || k === 'PageDown' || k === 'Enter' || k === 'n' || k === 'N') go(i + 1);
      else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace' || k === 'p' || k === 'P') go(i - 1);
      else if (k === 'Home') go(0);
      else if (k === 'End') go(deck.slides.length - 1);
      else if (k === 'b' || k === 'B' || k === '.' || k === 'ㅠ') setCover('black');
      else if (k === 'w' || k === 'W' || k === ',' || k === 'ㅈ') setCover('white');
      else if (k === 's' || k === 'S' || k === 'ㄴ') togglePanel();
      else if (k === 'f' || k === 'F' || k === 'ㄹ') toggleFull();
      else if (k === 'Escape') exit();
      else used = false;
      if (used) { e.preventDefault(); e.stopPropagation(); }
    }
    function togglePanel() { panel = !panel; P.settings.set('slides.presenter', panel); render(false); }
    function toggleFull() {
      if (document.fullscreenElement) { wasFull = false; document.exitFullscreen().catch(() => {}); }
      else if (ov.requestFullscreen) ov.requestFullscreen().then(() => { wasFull = true; }).catch(() => {});
    }
    ov.querySelector('.slides-pv-bar').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.stopPropagation();
      const k = b.dataset.k;
      if (k === 'prev') go(i - 1); else if (k === 'next') go(i + 1); else if (k === 'black') setCover('black');
      else if (k === 'panel') togglePanel(); else if (k === 'full') toggleFull(); else if (k === 'exit') exit();
    });
    ov.querySelector('.slides-pv-timer').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.k === 'reset') { t0 = Date.now(); paused = 0; if (pauseAt) pauseAt = Date.now(); }
      else if (pauseAt) { paused += Date.now() - pauseAt; pauseAt = 0; b.textContent = '일시정지'; }
      else { pauseAt = Date.now(); b.textContent = '계속'; }
      tick();
    });
    let sx = null, sy = 0;
    main.addEventListener('pointerdown', (e) => { if (e.target.closest('.slides-pv-bar')) return; sx = e.clientX; sy = e.clientY; });
    main.addEventListener('pointerup', (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { go(dx < 0 ? i + 1 : i - 1); return; }
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        const r = main.getBoundingClientRect();
        go(e.clientX - r.left < r.width * 0.3 ? i - 1 : i + 1);
      }
    });
    let hideT = null;
    ov.addEventListener('pointermove', () => {
      ov.classList.add('show-bar');
      clearTimeout(hideT);
      hideT = setTimeout(() => ov.classList.remove('show-bar'), 2200);
    });
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', fit);
    document.addEventListener('fullscreenchange', onFs);
    if (ov.requestFullscreen && P.settings.get('slides.fullscreen', true)) ov.requestFullscreen().then(() => { wasFull = true; }).catch(() => {});
    render(false);
    ov.focus();
    tick();
    return exit;
  }

  /* ========== 편집 화면 ========== */
  async function mountEditor(root, ctx, id) {
    root.innerHTML = '<div class="page"><div class="empty">불러오는 중…</div></div>';
    let data = null;
    try { data = await P.store.get(COL, id); } catch (e) { data = null; }
    if (!data) {
      root.innerHTML = '<div class="page"><div class="empty card"><h2>PT를 찾을 수 없습니다</h2><p>삭제되었거나 다른 저장 위치에 있을 수 있습니다.</p><a class="btn btn-primary" href="#/' + APP_ID + '">PT 목록으로</a></div></div>';
      return null;
    }
    const deck = normalizeDeck(data);
    deck.createdAt = data.createdAt;
    root.style.height = '100%';
    gcAssets(deck);

    const st = { cur: 0, sel: null, editing: null, undo: [], redo: [], lastKey: null, lastAt: 0, dirty: false, saving: false, again: false, k: 1, clip: null, propsOpen: false, exitPresent: null };
    const offs = [];
    const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };

    root.innerHTML = '<div class="slides-ed">' +
      '<div class="slides-top">' +
        '<a class="btn btn-ghost p-icon-btn" href="#/' + APP_ID + '" title="PT 목록" aria-label="PT 목록">' + I.back + '</a>' +
        '<input class="slides-title" type="text" aria-label="PT 제목" maxlength="120">' +
        '<span class="slides-status" aria-live="polite"></span>' +
        '<span class="slides-grow"></span>' +
        '<button type="button" class="btn btn-sm" data-a="check" title="품질 점검">' + I.check + '<span class="slides-lbl">점검</span><b class="slides-badge" hidden></b></button>' +
        '<button type="button" class="btn btn-sm" data-a="export" title="내보내기">' + I.download + '<span class="slides-lbl">내보내기</span></button>' +
        '<button type="button" class="btn btn-sm btn-primary" data-a="present" title="발표 시작 (F5)">' + I.play + '<span class="slides-lbl">발표</span></button>' +
        '<button type="button" class="btn btn-sm btn-ghost p-icon-btn slides-props-tg" data-a="props" title="속성 패널" aria-label="속성 패널">' + I.panel + '</button>' +
      '</div>' +
      '<div class="slides-ribbon" role="toolbar" aria-label="편집 도구">' +
        '<button type="button" class="btn btn-sm btn-ghost p-icon-btn" data-a="undo" title="실행 취소 (' + MOD + '+Z)" aria-label="실행 취소">' + I.undo + '</button>' +
        '<button type="button" class="btn btn-sm btn-ghost p-icon-btn" data-a="redo" title="다시 실행 (' + MOD + '+Y)" aria-label="다시 실행">' + I.redo + '</button>' +
        '<span class="slides-div"></span>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-a="addSlide" title="새 슬라이드 (' + MOD + '+M)">' + I.slide + '<span>새 슬라이드</span></button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-a="addText" title="글상자">' + I.text + '<span>글상자</span></button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-a="addShape" title="도형">' + I.shape + '<span>도형</span></button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-a="addImage" title="사진">' + I.image + '<span>사진</span></button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-a="addTable" title="표">' + I.table + '<span>표</span></button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-a="addChart" title="차트">' + I.chart + '<span>차트</span></button>' +
        '<span class="slides-div"></span>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-a="layout" title="레이아웃 바꾸기">' + I.layout + '<span>레이아웃</span></button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-a="theme" title="테마">' + I.theme + '<span>테마</span></button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-a="outline" title="개요로 만들기">' + I.outline + '<span>개요</span></button>' +
        '<span class="slides-div"></span>' +
        '<button type="button" class="btn btn-sm btn-ghost p-icon-btn" data-a="help" title="단축키 (?)" aria-label="단축키 도움말">' + I.help + '</button>' +
      '</div>' +
      '<div class="slides-body">' +
        '<aside class="slides-rail" aria-label="슬라이드 목록"><div class="slides-thumbs" role="listbox" aria-label="슬라이드"></div><button type="button" class="btn btn-sm slides-rail-add" data-a="addSlide">' + I.plus + '<span>새 슬라이드</span></button></aside>' +
        '<section class="slides-center">' +
          '<div class="slides-canvas-wrap"><div class="slides-frame"><div class="slides-stage"></div><div class="slides-overlay"><div class="slides-ovl"></div></div></div></div>' +
          '<div class="slides-notes"><label for="slides-notes-ta">발표자 노트</label><textarea id="slides-notes-ta" rows="3" placeholder="발표할 때 볼 메모"></textarea></div>' +
        '</section>' +
        '<aside class="slides-props" aria-label="속성"></aside>' +
      '</div></div>';

    const $ = (s) => root.querySelector(s);
    const titleIn = $('.slides-title');
    const statusEl = $('.slides-status');
    const thumbs = $('.slides-thumbs');
    const wrap = $('.slides-canvas-wrap');
    const frame = $('.slides-frame');
    const stage = $('.slides-stage');
    const overlay = $('.slides-overlay');
    const ovl = $('.slides-ovl');
    const notesTa = $('#slides-notes-ta');
    const props = $('.slides-props');
    const badge = $('.slides-badge');
    titleIn.value = deck.title;

    const slide = () => deck.slides[st.cur];
    const selEl = () => (st.sel ? slide().els.find((e) => e.id === st.sel) || null : null);

    /* ----- 저장 ----- */
    function setStatus(s) {
      statusEl.dataset.s = s;
      statusEl.textContent = s === 'saving' ? '저장 중…' : s === 'error' ? '저장 실패 · 다시 시도 중' : s === 'dirty' ? '수정됨' : '저장됨';
    }
    setStatus('saved');
    let saveTimer = null;
    function scheduleSave() {
      st.dirty = true;
      setStatus('dirty');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveNow, 1000);
    }
    async function saveNow() {
      clearTimeout(saveTimer);
      if (st.saving) { st.again = true; return; }
      if (!st.dirty) return;
      st.saving = true;
      st.dirty = false;
      setStatus('saving');
      try {
        await P.store.put(COL, id, serialize(deck));
        setStatus(st.dirty ? 'dirty' : 'saved');
      } catch (e) {
        st.dirty = true;
        setStatus('error');
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveNow, 5000);
      }
      st.saving = false;
      if (st.again) { st.again = false; saveNow(); }
    }

    /* ----- 실행 취소 ----- */
    const snap = () => JSON.stringify({ title: deck.title, theme: deck.theme, slides: deck.slides, cur: st.cur });
    function checkpoint(key) {
      const now = Date.now();
      if (key && key === st.lastKey && now - st.lastAt < 1500) { st.lastAt = now; return; }
      st.undo.push(snap());
      if (st.undo.length > 120) st.undo.shift();
      st.redo = [];
      st.lastKey = key || null;
      st.lastAt = now;
    }
    function restore(s) {
      const o = JSON.parse(s);
      deck.title = o.title;
      deck.theme = o.theme;
      deck.slides = o.slides;
      st.cur = clamp(o.cur || 0, 0, deck.slides.length - 1);
      if (!selEl()) st.sel = null;
      titleIn.value = deck.title;
    }
    function undo() {
      finishEdit();
      if (!st.undo.length) { P.ui.toast('되돌릴 작업이 없습니다.', 'info'); return; }
      st.redo.push(snap());
      restore(st.undo.pop());
      st.lastKey = null;
      renderAll();
      scheduleSave();
    }
    function redo() {
      finishEdit();
      if (!st.redo.length) return;
      st.undo.push(snap());
      restore(st.redo.pop());
      st.lastKey = null;
      renderAll();
      scheduleSave();
    }
    /** 변경: 기록 → 적용 → 다시 그리기 → 저장 예약 */
    function change(fn, key, how) {
      checkpoint(key);
      fn();
      how = how || {};
      if (how.all) renderAll();
      else {
        renderCanvas();
        if (how.rail) renderRail(); else updateThumb(st.cur);
        if (how.props) renderProps();
      }
      scheduleSave();
      qualitySoon();
    }

    /* ----- 캔버스 ----- */
    function fitStage() {
      const r = wrap.getBoundingClientRect();
      const pad = r.width < 600 ? 10 : 28;
      const k = Math.max(0.1, Math.min((r.width - pad * 2) / W, (r.height - pad * 2) / H));
      st.k = k;
      frame.style.width = W * k + 'px';
      frame.style.height = H * k + 'px';
      stage.style.transform = 'scale(' + k + ')';
      overlay.style.setProperty('--k', k);
      drawSelection();
    }
    function renderCanvas() {
      stage.innerHTML = slideMarkup(deck, slide(), { edit: true });
      if (st.editing) {
        const n = stage.querySelector('[data-id="' + CSS.escape(st.editing.id) + '"] [data-tx]');
        if (n) n.style.visibility = 'hidden';
      }
      markOverflow();
      drawSelection();
    }
    function markOverflow() {
      stage.querySelectorAll('.slides-el').forEach((n) => {
        const tx = n.querySelector('[data-tx]');
        const tin = tx && tx.firstElementChild;
        let over = false;
        if (tin) {
          const cs = getComputedStyle(tx);
          over = tin.offsetHeight > tx.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) + 3;
        }
        n.classList.toggle('slides-over', over);
      });
    }
    function drawSelection(guides) {
      const e = selEl();
      let html = '';
      if (e) {
        const k = st.k;
        html += '<div class="slides-sel" style="left:' + e.x * k + 'px;top:' + e.y * k + 'px;width:' + e.w * k + 'px;height:' + e.h * k + 'px">' +
          (st.editing ? '' : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => '<span class="slides-h slides-h-' + h + '" data-h="' + h + '"></span>').join('')) +
          '<span class="slides-size">' + round(e.w) + ' × ' + round(e.h) + '</span></div>';
      }
      (guides || []).forEach((g) => {
        html += g.v ? '<div class="slides-guide v" style="left:' + g.v * st.k + 'px"></div>' : '<div class="slides-guide h" style="top:' + g.h * st.k + 'px"></div>';
      });
      ovl.innerHTML = html;
      if (st.editing) placeEditor();
    }
    function select(idOrNull) {
      if (st.editing && (!idOrNull || st.editing.id !== idOrNull)) finishEdit();
      st.sel = idOrNull;
      drawSelection();
      renderProps();
    }
    function goSlide(i, keepSel) {
      finishEdit();
      st.cur = clamp(i, 0, deck.slides.length - 1);
      if (!keepSel) st.sel = null;
      renderCanvas();
      notesTa.value = slide().notes || '';
      thumbs.querySelectorAll('.slides-th').forEach((t, j) => { t.classList.toggle('active', j === st.cur); t.setAttribute('aria-selected', j === st.cur ? 'true' : 'false'); });
      const act = thumbs.children[st.cur];
      if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      renderProps();
    }

    /* ----- 글 편집(겹쳐 놓는 입력칸) ----- */
    function startEdit(e) {
      if (!e || (e.type !== 'text' && e.type !== 'shape')) return;
      if (st.editing && st.editing.id === e.id) return;
      finishEdit();
      st.sel = e.id;
      const ta = document.createElement('textarea');
      ta.className = 'slides-ta';
      ta.value = e.text || '';
      ta.spellcheck = false;
      ta.setAttribute('aria-label', '글 편집');
      st.editing = { id: e.id, ta, started: false };
      overlay.appendChild(ta);
      on(ta, 'input', () => {
        const el = slide().els.find((x) => x.id === st.editing.id);
        if (!el) return;
        if (!st.editing.started) { checkpoint('text:' + el.id); st.editing.started = true; }
        el.text = ta.value;
        placeEditor();
        updateThumbSoon();
        scheduleSave();
        qualitySoon();
      });
      on(ta, 'keydown', (ev) => {
        if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finishEdit(); return; }
        if (ev.key === 'Tab') {
          ev.preventDefault();
          const v = ta.value, s0 = ta.selectionStart, s1 = ta.selectionEnd;
          const ls = v.lastIndexOf('\n', s0 - 1) + 1;
          let le = v.indexOf('\n', s1); if (le < 0) le = v.length;
          const block = v.slice(ls, le).split('\n');
          const nb = block.map((l) => (ev.shiftKey ? l.replace(/^( {1,2}|\t)/, '') : '  ' + l)).join('\n');
          ta.value = v.slice(0, ls) + nb + v.slice(le);
          ta.selectionStart = ls; ta.selectionEnd = ls + nb.length;
          ta.dispatchEvent(new Event('input'));
        }
      });
      renderCanvas();
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
    function placeEditor() {
      if (!st.editing) return;
      const e = slide().els.find((x) => x.id === st.editing.id);
      if (!e) return;
      const ta = st.editing.ta;
      const k = st.k;
      const p = palette(deck, slide());
      const pad = e.type === 'shape' ? PAD_S : PAD_T;
      ta.style.left = e.x * k + 'px';
      ta.style.top = e.y * k + 'px';
      ta.style.width = e.w * k + 'px';
      ta.style.fontSize = (e.size * PX * k) + 'px';
      ta.style.lineHeight = e.lh || 1.3;
      ta.style.padding = (pad[0] * k) + 'px ' + (pad[1] * k) + 'px';
      ta.style.textAlign = e.list ? 'left' : e.align;
      ta.style.fontWeight = e.bold ? 700 : 400;
      ta.style.fontStyle = e.italic ? 'italic' : 'normal';
      ta.style.color = col(e.color, p) || p.text;
      ta.style.background = rgba(e.type === 'shape' && col(e.fill, p) ? col(e.fill, p) : slideBg(slide(), p), 0.92);
      ta.style.height = 'auto';
      ta.style.height = Math.max(e.h * k, ta.scrollHeight) + 'px';
    }
    function finishEdit() {
      if (!st.editing) return;
      const ed = st.editing;
      st.editing = null;
      ed.ta.remove();
      if (ed.started) { updateThumb(st.cur); renderProps(); }
      renderCanvas();
    }

    /* ----- 끌기·크기 조절·맞춤선 ----- */
    function snapTargets(exceptId) {
      const xs = [0, W / 2, W], ys = [0, H / 2, H];
      slide().els.forEach((o) => {
        if (o.id === exceptId) return;
        xs.push(o.x, o.x + o.w / 2, o.x + o.w);
        ys.push(o.y, o.y + o.h / 2, o.y + o.h);
      });
      return { xs, ys };
    }
    function snapAxis(cands, targets, thr) {
      let best = null;
      cands.forEach((c, ci) => targets.forEach((t) => {
        const d = t - c;
        if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: t, ci };
      }));
      return best;
    }
    function startDrag(ev, e, handle) {
      if (ev.button !== 0) return;
      ev.preventDefault();
      const sx = ev.clientX, sy = ev.clientY;
      const o = { x: e.x, y: e.y, w: e.w, h: e.h };
      const tg = snapTargets(e.id);
      const ratio = o.w / o.h;
      let moved = false;
      const node = stage.querySelector('[data-id="' + CSS.escape(e.id) + '"]');
      const target = ev.currentTarget || ev.target;
      try { target.setPointerCapture(ev.pointerId); } catch (er) { /* 무시 */ }
      const move = (m) => {
        const dx = (m.clientX - sx) / st.k, dy = (m.clientY - sy) / st.k;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 2 / st.k) return;
        if (!moved) { checkpoint(); moved = true; }
        const thr = 6 / st.k;
        const noSnap = m.altKey;
        const guides = [];
        if (!handle) {
          let nx = o.x + dx, ny = o.y + dy;
          if (m.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) ny = o.y; else nx = o.x; }
          if (!noSnap) {
            const bx = snapAxis([nx, nx + o.w / 2, nx + o.w], tg.xs, thr);
            if (bx) { nx += bx.d; guides.push({ v: bx.at }); }
            const by = snapAxis([ny, ny + o.h / 2, ny + o.h], tg.ys, thr);
            if (by) { ny += by.d; guides.push({ h: by.at }); }
          }
          e.x = round(nx); e.y = round(ny);
        } else {
          let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
          if (handle.includes('w')) x1 = Math.min(x2 - 16, o.x + dx);
          if (handle.includes('e')) x2 = Math.max(x1 + 16, o.x + o.w + dx);
          if (handle.includes('n')) y1 = Math.min(y2 - 16, o.y + dy);
          if (handle.includes('s')) y2 = Math.max(y1 + 16, o.y + o.h + dy);
          if (!noSnap) {
            if (handle.includes('w')) { const b = snapAxis([x1], tg.xs, thr); if (b) { x1 += b.d; guides.push({ v: b.at }); } }
            if (handle.includes('e')) { const b = snapAxis([x2], tg.xs, thr); if (b) { x2 += b.d; guides.push({ v: b.at }); } }
            if (handle.includes('n')) { const b = snapAxis([y1], tg.ys, thr); if (b) { y1 += b.d; guides.push({ h: b.at }); } }
            if (handle.includes('s')) { const b = snapAxis([y2], tg.ys, thr); if (b) { y2 += b.d; guides.push({ h: b.at }); } }
          }
          const keep = (e.type === 'image') !== m.shiftKey;
          if (keep && handle.length === 2) {
            const w = x2 - x1, h = y2 - y1;
            if (w / h > ratio) { const nw = h * ratio; if (handle.includes('w')) x1 = x2 - nw; else x2 = x1 + nw; }
            else { const nh = w / ratio; if (handle.includes('n')) y1 = y2 - nh; else y2 = y1 + nh; }
          }
          e.x = round(x1); e.y = round(y1); e.w = round(x2 - x1); e.h = round(y2 - y1);
        }
        if (node) {
          node.style.left = e.x + 'px'; node.style.top = e.y + 'px'; node.style.width = e.w + 'px'; node.style.height = e.h + 'px';
          if (handle && (e.type === 'chart' || e.type === 'shape')) {
            const p = palette(deck, slide());
            node.innerHTML = e.type === 'chart' ? chartLayer(e, p) : shapeLayer(e, p) + textLayer(e, p, { edit: true });
          }
        }
        drawSelection(guides);
      };
      const up = () => {
        target.removeEventListener('pointermove', move);
        target.removeEventListener('pointerup', up);
        target.removeEventListener('pointercancel', up);
        if (moved) {
          renderCanvas();
          updateThumb(st.cur);
          updateGeom();
          scheduleSave();
          qualitySoon();
        }
      };
      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', up);
      target.addEventListener('pointercancel', up);
    }
    on(overlay, 'pointerdown', (ev) => {
      const h = ev.target.closest('.slides-h');
      const e = selEl();
      if (h && e) { startDrag(ev, e, h.dataset.h); return; }
      if (ev.target.closest('.slides-ta')) return;
      // 선택 상자 안을 누르면 아래 요소로 전달
      const sel = ev.target.closest('.slides-sel');
      if (sel && e) { startDrag(ev, e, null); return; }
      pickAt(ev);
    });
    on(overlay, 'dblclick', (ev) => {
      if (ev.target.closest('.slides-ta')) return;
      const e = selEl();
      if (!e) return;
      if (e.type === 'text' || e.type === 'shape') startEdit(e);
      else if (e.type === 'image') replaceImage(e);
      else if (e.type === 'table' || e.type === 'chart') { openProps(); const f = props.querySelector('.slides-tgrid input, .slides-cdata'); if (f) f.focus(); }
    });
    function pickAt(ev) {
      const r = frame.getBoundingClientRect();
      const x = (ev.clientX - r.left) / st.k, y = (ev.clientY - r.top) / st.k;
      const els = slide().els;
      let hit = null;
      for (let j = els.length - 1; j >= 0; j--) {
        const e = els[j];
        const pad = Math.max(4, 6 / st.k);
        if (x >= e.x - pad && x <= e.x + e.w + pad && y >= e.y - pad && y <= e.y + e.h + pad) { hit = e; break; }
      }
      if (!hit) { select(null); return; }
      if (st.sel !== hit.id) select(hit.id);
      startDrag(ev, hit, null);
    }

    /* ----- 슬라이드 목록(왼쪽) ----- */
    function thumbHTML(s, i) {
      return '<div class="slides-th' + (i === st.cur ? ' active' : '') + '" role="option" aria-selected="' + (i === st.cur) + '" tabindex="0" draggable="true" data-i="' + i + '">' +
        '<span class="slides-th-n">' + (i + 1) + '</span>' + miniHTML(deck, s, {}) +
        (String(s.notes || '').trim() ? '<span class="slides-th-note" title="노트 있음">' + I.notes + '</span>' : '') +
        '<span class="slides-th-acts"><button type="button" class="slides-th-btn" data-t="more" aria-label="슬라이드 메뉴" title="슬라이드 메뉴">' + I.more + '</button></span></div>';
    }
    function renderRail() {
      thumbs.innerHTML = deck.slides.map(thumbHTML).join('');
      scaleMinis(thumbs);
    }
    function updateThumb(i) {
      const t = thumbs.children[i];
      if (!t) { renderRail(); return; }
      const tmp = document.createElement('div');
      tmp.innerHTML = thumbHTML(deck.slides[i], i);
      const n = tmp.firstElementChild;
      t.replaceWith(n);
      scaleMinis(n);
    }
    let thumbT = null;
    function updateThumbSoon() { clearTimeout(thumbT); thumbT = setTimeout(() => updateThumb(st.cur), 250); }
    on(thumbs, 'click', (ev) => {
      const th = ev.target.closest('.slides-th');
      if (!th) return;
      const i = +th.dataset.i;
      if (ev.target.closest('[data-t="more"]')) { slideMenu(ev.target.closest('button'), i); return; }
      goSlide(i);
    });
    on(thumbs, 'contextmenu', (ev) => {
      const th = ev.target.closest('.slides-th');
      if (!th) return;
      ev.preventDefault();
      goSlide(+th.dataset.i);
      slideMenu(th, +th.dataset.i);
    });
    on(thumbs, 'keydown', (ev) => {
      const th = ev.target.closest('.slides-th');
      if (!th) return;
      const i = +th.dataset.i;
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); goSlide(i); }
      else if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') { ev.preventDefault(); if (ev.altKey) moveSlide(i, i + 1); else { goSlide(i + 1); focusThumb(); } }
      else if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') { ev.preventDefault(); if (ev.altKey) moveSlide(i, i - 1); else { goSlide(i - 1); focusThumb(); } }
      else if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); deleteSlide(i); }
    });
    function focusThumb() { const t = thumbs.children[st.cur]; if (t) t.focus(); }
    let dragFrom = null;
    on(thumbs, 'dragstart', (ev) => {
      const th = ev.target.closest('.slides-th');
      if (!th) return;
      dragFrom = +th.dataset.i;
      ev.dataTransfer.effectAllowed = 'move';
      try { ev.dataTransfer.setData('text/plain', 'slide'); } catch (e) { /* 무시 */ }
      th.classList.add('dragging');
    });
    function dropIndex(ev) {
      const list = Array.from(thumbs.children);
      const horiz = getComputedStyle(thumbs).flexDirection === 'row';
      for (let j = 0; j < list.length; j++) {
        const r = list[j].getBoundingClientRect();
        if (horiz ? ev.clientX < r.left + r.width / 2 : ev.clientY < r.top + r.height / 2) return j;
      }
      return list.length;
    }
    on(thumbs, 'dragover', (ev) => {
      if (dragFrom == null) return;
      ev.preventDefault();
      const j = dropIndex(ev);
      thumbs.querySelectorAll('.drop-before,.drop-after').forEach((n) => n.classList.remove('drop-before', 'drop-after'));
      const list = thumbs.children;
      if (list[j]) list[j].classList.add('drop-before'); else if (list[j - 1]) list[j - 1].classList.add('drop-after');
    });
    on(thumbs, 'drop', (ev) => {
      if (dragFrom == null) return;
      ev.preventDefault();
      let j = dropIndex(ev);
      const from = dragFrom;
      dragFrom = null;
      if (j > from) j--;
      moveSlide(from, j);
    });
    on(thumbs, 'dragend', () => {
      dragFrom = null;
      thumbs.querySelectorAll('.dragging,.drop-before,.drop-after').forEach((n) => n.classList.remove('dragging', 'drop-before', 'drop-after'));
    });
    function moveSlide(from, to) {
      to = clamp(to, 0, deck.slides.length - 1);
      if (from === to) { renderRail(); return; }
      change(() => {
        const [s] = deck.slides.splice(from, 1);
        deck.slides.splice(to, 0, s);
        st.cur = to;
      }, null, { all: true });
      focusThumb();
    }
    function duplicateSlide(i) {
      change(() => {
        const c = clone(deck.slides[i]);
        c.id = uid();
        c.els.forEach((e) => { e.id = uid(); });
        deck.slides.splice(i + 1, 0, c);
        st.cur = i + 1;
        st.sel = null;
      }, null, { all: true });
    }
    async function deleteSlide(i) {
      if (deck.slides.length <= 1) { P.ui.toast('마지막 한 장은 지울 수 없습니다.', 'warn'); return; }
      change(() => {
        deck.slides.splice(i, 1);
        st.cur = clamp(st.cur >= i ? st.cur - 1 : st.cur, 0, deck.slides.length - 1);
        if (i === 0) st.cur = 0;
        st.sel = null;
      }, null, { all: true });
      P.ui.toast('슬라이드를 지웠습니다. ' + MOD + '+Z로 되돌릴 수 있습니다.', 'info');
    }
    function slideMenu(anchor, i) {
      popover(anchor, [
        { label: '복제', icon: I.copy, hint: MOD + '+D', onClick: () => duplicateSlide(i) },
        { label: '위로', icon: I.up, hint: 'Alt+↑', disabled: i === 0, onClick: () => moveSlide(i, i - 1) },
        { label: '아래로', icon: I.down, hint: 'Alt+↓', disabled: i === deck.slides.length - 1, onClick: () => moveSlide(i, i + 1) },
        { label: '레이아웃 바꾸기', icon: I.layout, onClick: () => { goSlide(i); openLayoutPicker('change'); } },
        { label: '여기서부터 발표', icon: I.play, onClick: () => startPresent(i) },
        '-',
        { label: '삭제', icon: I.trash, hint: 'Delete', disabled: deck.slides.length <= 1, onClick: () => deleteSlide(i) }
      ]);
    }

    /* ----- 추가 ----- */
    function addSlide(layoutId) {
      change(() => {
        const s = makeSlide(layoutId, {});
        deck.slides.splice(st.cur + 1, 0, s);
        st.cur += 1;
        st.sel = null;
      }, null, { all: true });
    }
    function openLayoutPicker(mode) {
      const close = P.ui.modal({
        title: mode === 'change' ? '레이아웃 바꾸기 (글은 그대로 옮겨집니다)' : '새 슬라이드 레이아웃',
        wide: true,
        body: layoutGallery(deck, (lid) => {
          close();
          if (mode === 'change') change(() => { relayout(slide(), lid); st.sel = null; }, null, { all: true });
          else addSlide(lid);
        })
      });
    }
    function insertEl(e) {
      change(() => {
        e.id = uid();
        slide().els.push(e);
        st.sel = e.id;
      }, null, { props: true });
      return e;
    }
    function centered(w, h) { return { x: round((W - w) / 2), y: round((H - h) / 2), w, h }; }
    function addText() {
      const e = insertEl(T(Object.assign(centered(640, 90), { size: 28, ph: '글을 입력하세요' })));
      startEdit(e);
    }
    const SHAPES = [
      { id: 'rect', name: '사각형' }, { id: 'roundRect', name: '둥근 사각형' }, { id: 'ellipse', name: '원' },
      { id: 'triangle', name: '삼각형' }, { id: 'rightArrow', name: '화살표' }, { id: 'line', name: '선' }
    ];
    function addShape(kind) {
      const sz = kind === 'line' ? centered(400, 12) : kind === 'rightArrow' ? centered(320, 120) : centered(280, 180);
      insertEl(S(Object.assign(sz, { shape: kind, fill: kind === 'line' ? null : '@accent', stroke: kind === 'line' ? '@accent' : null, strokeW: kind === 'line' ? 4 : 2 })));
    }
    async function addImages(files, at) {
      const list = files.filter((f) => /^image\//.test(f.type));
      if (!list.length) return;
      for (const f of list) {
        try {
          const im = await readImage(f);
          const aid = 'a' + uid();
          deck.assets[aid] = im.data;
          const cur = selEl();
          if (cur && cur.type === 'image' && !cur.asset && list.length === 1) {
            change(() => { cur.asset = aid; cur.nw = im.w; cur.nh = im.h; }, null, { props: true });
            continue;
          }
          const k = Math.min(1, (W * 0.6) / im.w, (H * 0.7) / im.h);
          const w = round(im.w * k), h = round(im.h * k);
          const pos = centered(w, h);
          if (at) { pos.x = round(clamp(at.x - w / 2, 0, W - w)); pos.y = round(clamp(at.y - h / 2, 0, H - h)); }
          insertEl({ type: 'image', ...pos, asset: aid, nw: im.w, nh: im.h, fit: 'cover', radius: 0 });
        } catch (e) { P.ui.toast(f.name + ': ' + e.message, 'warn'); }
      }
    }
    async function replaceImage(e) {
      const f = (await pickFiles('image/*', false))[0];
      if (!f) return;
      try {
        const im = await readImage(f);
        const aid = 'a' + uid();
        deck.assets[aid] = im.data;
        change(() => { e.asset = aid; e.nw = im.w; e.nh = im.h; }, null, { props: true });
      } catch (er) { P.ui.toast(er.message, 'warn'); }
    }
    function addTable(rows) {
      const r = rows || [['구분', '항목 1', '항목 2'], ['', '', ''], ['', '', '']];
      const h = Math.min(520, 56 * r.length + 20);
      insertEl({ type: 'table', ...centered(900, h), size: 18, header: true, band: true, rows: normalizeRows(r) });
    }
    function addChart() {
      insertEl({ type: 'chart', ...centered(800, 440), kind: 'bar', title: '', labels: ['항목 1', '항목 2', '항목 3'], values: [30, 50, 40], showValues: true, size: 18 });
    }

    /* ----- 요소 조작 ----- */
    function deleteSel() {
      const e = selEl();
      if (!e) return;
      change(() => { slide().els = slide().els.filter((x) => x.id !== e.id); st.sel = null; }, null, { props: true });
    }
    function duplicateSel() {
      const e = selEl();
      if (!e) { duplicateSlide(st.cur); return; }
      const c = clone(e);
      c.x = clamp(c.x + 24, -c.w + 20, W - 20);
      c.y = clamp(c.y + 24, -c.h + 20, H - 20);
      insertEl(c);
    }
    function nudge(dx, dy) {
      const e = selEl();
      if (!e) return;
      change(() => { e.x += dx; e.y += dy; }, 'nudge:' + e.id);
      updateGeom();
    }
    function reorder(dir) {
      const e = selEl();
      if (!e) return;
      change(() => {
        const els = slide().els;
        const i = els.indexOf(e);
        els.splice(i, 1);
        if (dir === 'front') els.push(e); else if (dir === 'back') els.unshift(e);
        else els.splice(clamp(i + (dir === 'up' ? 1 : -1), 0, els.length), 0, e);
      });
    }
    function alignSel(how) {
      const e = selEl();
      if (!e) return;
      change(() => {
        if (how === 'l') e.x = 0; else if (how === 'c') e.x = round((W - e.w) / 2); else if (how === 'r') e.x = W - e.w;
        else if (how === 't') e.y = 0; else if (how === 'm') e.y = round((H - e.h) / 2); else if (how === 'b') e.y = H - e.h;
      });
      updateGeom();
    }
    function setProp(key, val, ckey) {
      const e = selEl();
      if (!e) return;
      change(() => { e[key] = val; }, ckey || (key + ':' + e.id));
    }

    /* ----- 속성 패널 ----- */
    const COLORS = [['@title', '제목색'], ['@text', '본문색'], ['@accent', '강조'], ['@accent2', '강조 2'], ['@muted', '흐린 글'], ['@soft', '연한 배경'], ['@white', '흰색'], ['@black', '검정']];
    function swatches(name, cur, allowNone) {
      const p = palette(deck, slide());
      let h = '<div class="slides-sw" data-sw="' + name + '">';
      if (allowNone) h += '<button type="button" class="slides-sw-b none' + (!cur ? ' on' : '') + '" data-v="" title="없음" aria-label="없음"></button>';
      COLORS.forEach(([v, label]) => { h += '<button type="button" class="slides-sw-b' + (cur === v ? ' on' : '') + '" data-v="' + v + '" title="' + label + '" aria-label="' + label + '" style="background:' + col(v, p) + '"></button>'; });
      const custom = cur && cur[0] === '#' ? cur : '';
      h += '<label class="slides-sw-c' + (custom ? ' on' : '') + '" title="직접 고르기"><input type="color" value="' + (custom || col(cur, p) || '#000000') + '" data-swc="' + name + '" aria-label="직접 고르기"></label></div>';
      return h;
    }
    function seg(name, cur, opts) {
      return '<div class="slides-seg" data-seg="' + name + '">' + opts.map(([v, icon, label]) => '<button type="button" data-v="' + v + '" aria-pressed="' + (String(cur) === String(v)) + '" title="' + label + '" aria-label="' + label + '">' + (icon || esc(label)) + '</button>').join('') + '</div>';
    }
    function geomHTML(e) {
      return '<div class="slides-geo">' + [['x', 'X'], ['y', 'Y'], ['w', '너비'], ['h', '높이']].map(([k, l]) => '<label><span>' + l + '</span><input type="number" step="1" data-geo="' + k + '" value="' + round(e[k]) + '"></label>').join('') + '</div>';
    }
    function updateGeom() {
      const e = selEl();
      if (!e) return;
      props.querySelectorAll('[data-geo]').forEach((inp) => { if (document.activeElement !== inp) inp.value = round(e[inp.dataset.geo]); });
    }
    function textPropsHTML(e) {
      const warn = e.size < 18 ? '<small class="slides-warn">18pt 미만은 뒷자리에서 읽기 어렵습니다</small>' : '';
      return '<div class="slides-pg"><h4>글자</h4>' +
        '<div class="slides-row"><div class="slides-size-in"><button type="button" class="btn btn-sm btn-ghost" data-act="size-" aria-label="글자 작게">−</button><input type="number" min="6" max="300" step="1" data-p="size" value="' + e.size + '" aria-label="글자 크기(pt)"><span>pt</span><button type="button" class="btn btn-sm btn-ghost" data-act="size+" aria-label="글자 크게">+</button></div>' +
        seg('style', '', [['bold', I.bold, '굵게'], ['italic', I.italic, '기울임'], ['underline', I.underline, '밑줄']]).replace(/data-v="(bold|italic|underline)" aria-pressed="false"/g, (m, k) => 'data-v="' + k + '" aria-pressed="' + !!e[k] + '"') + '</div>' + warn +
        '<label class="slides-lab">글자색</label>' + swatches('color', e.color || (e.role === 'title' ? '@title' : '@text'), false) +
        '<div class="slides-row">' + seg('align', e.align, [['left', I.aL, '왼쪽'], ['center', I.aC, '가운데'], ['right', I.aR, '오른쪽']]) +
        seg('valign', e.valign, [['top', I.vT, '위'], ['middle', I.vM, '가운데'], ['bottom', I.vB, '아래']]) + '</div>' +
        '<div class="slides-row"><label class="slides-inl">목록 <select data-p="list"><option value="">없음</option><option value="bullet">글머리 •</option><option value="number">번호 1.</option><option value="step">큰 번호 01</option></select></label>' +
        '<label class="slides-inl">줄 간격 <select data-p="lh">' + [1, 1.15, 1.3, 1.45, 1.6, 1.8, 2].map((v) => '<option value="' + v + '">' + v + '</option>').join('') + '</select></label></div>' +
        '<div class="slides-row"><button type="button" class="btn btn-sm" data-act="edit">' + I.edit + '글 고치기 (Enter)</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-act="fit" title="글이 상자를 넘치면 맞을 때까지 글자를 줄입니다">상자에 맞게 줄이기</button></div></div>';
    }
    function renderProps() {
      const e = selEl();
      const s = slide();
      let h = '';
      if (!e) {
        h += '<div class="slides-pg"><h4>슬라이드 ' + (st.cur + 1) + ' · ' + esc((LAYOUT[s.layout] || {}).name || '') + '</h4>' +
          '<button type="button" class="btn btn-sm" data-act="relayout">' + I.layout + '레이아웃 바꾸기</button></div>' +
          '<div class="slides-pg"><h4>배경</h4>' + seg('variant', s.variant, [['base', '', '기본'], ['cover', '', '표지 색']]) +
          '<label class="slides-lab">배경색</label>' + swatches('bg', s.bg, true) +
          '<div class="slides-row"><button type="button" class="btn btn-sm" data-act="bgimg">' + I.image + (s.bgAsset ? '배경 사진 바꾸기' : '배경 사진 넣기') + '</button>' + (s.bgAsset ? '<button type="button" class="btn btn-sm btn-ghost" data-act="bgimg-x">배경 사진 빼기</button>' : '') + '</div>' +
          '<label class="slides-check"><input type="checkbox" data-sp="deco"' + (s.deco !== false ? ' checked' : '') + '> 테마 장식 보이기</label></div>' +
          '<div class="slides-pg"><h4>슬라이드</h4><div class="slides-row"><button type="button" class="btn btn-sm" data-act="dupSlide">' + I.copy + '복제</button><button type="button" class="btn btn-sm" data-act="delSlide">' + I.trash + '삭제</button></div>' +
          '</div>';
      } else {
        const name = { text: '글상자', shape: '도형', image: '사진', table: '표', chart: '차트' }[e.type];
        h += '<div class="slides-pg slides-pg-head"><h4>' + name + '</h4><div class="slides-row">' +
          '<button type="button" class="btn btn-sm btn-ghost p-icon-btn" data-act="dup" title="복제 (' + MOD + '+D)" aria-label="복제">' + I.copy + '</button>' +
          '<button type="button" class="btn btn-sm btn-ghost p-icon-btn" data-act="front" title="맨 앞으로" aria-label="맨 앞으로">' + I.front + '</button>' +
          '<button type="button" class="btn btn-sm btn-ghost p-icon-btn" data-act="back" title="맨 뒤로" aria-label="맨 뒤로">' + I.backward + '</button>' +
          '<button type="button" class="btn btn-sm btn-ghost p-icon-btn" data-act="del" title="삭제 (Delete)" aria-label="삭제">' + I.trash + '</button></div></div>';
        if (e.type === 'shape') {
          h += '<div class="slides-pg"><h4>도형</h4><label class="slides-inl">모양 <select data-p="shape">' + SHAPES.map((x) => '<option value="' + x.id + '">' + x.name + '</option>').join('') + '</select></label>' +
            (e.shape !== 'line' ? '<label class="slides-lab">채우기</label>' + swatches('fill', e.fill, true) +
            '<label class="slides-lab">투명도 <output>' + Math.round((1 - (e.opacity == null ? 1 : e.opacity)) * 100) + '%</output></label><input type="range" min="0" max="100" step="5" data-p="opacity" value="' + Math.round((1 - (e.opacity == null ? 1 : e.opacity)) * 100) + '">' : '') +
            '<label class="slides-lab">' + (e.shape === 'line' ? '선 색' : '테두리') + '</label>' + swatches('stroke', e.stroke, e.shape !== 'line') +
            '<label class="slides-inl">두께 <input type="number" min="1" max="40" data-p="strokeW" value="' + (e.strokeW || 2) + '"> px</label></div>';
          if (e.shape !== 'line') h += textPropsHTML(e);
        }
        if (e.type === 'text') h += textPropsHTML(e);
        if (e.type === 'image') {
          h += '<div class="slides-pg"><h4>사진</h4>' + seg('fit', e.fit || 'cover', [['cover', '', '채우기(잘라냄)'], ['contain', '', '전체 보기']]) +
            '<label class="slides-lab">모서리 둥글게 <output>' + (e.radius || 0) + 'px</output></label><input type="range" min="0" max="80" step="4" data-p="radius" value="' + (e.radius || 0) + '">' +
            '<div class="slides-row"><button type="button" class="btn btn-sm" data-act="img">' + I.image + (e.asset ? '사진 바꾸기' : '사진 고르기') + '</button>' +
            (e.asset && e.nw ? '<button type="button" class="btn btn-sm btn-ghost" data-act="imgRatio">원래 비율로</button>' : '') + '</div></div>';
        }
        if (e.type === 'table') {
          const rows = e.rows || [];
          h += '<div class="slides-pg"><h4>표</h4><div class="slides-row">' +
            '<span class="slides-inl">행 ' + rows.length + '</span><button type="button" class="btn btn-sm btn-ghost" data-act="row+">+ 행</button><button type="button" class="btn btn-sm btn-ghost" data-act="row-">− 행</button>' +
            '<span class="slides-inl">열 ' + (rows[0] || []).length + '</span><button type="button" class="btn btn-sm btn-ghost" data-act="col+">+ 열</button><button type="button" class="btn btn-sm btn-ghost" data-act="col-">− 열</button></div>' +
            '<label class="slides-check"><input type="checkbox" data-p="header"' + (e.header ? ' checked' : '') + '> 첫 행을 머리글로</label><label class="slides-check"><input type="checkbox" data-p="band"' + (e.band ? ' checked' : '') + '> 줄무늬</label>' +
            '<label class="slides-inl">글자 크기 <input type="number" min="8" max="60" data-p="size" value="' + e.size + '"> pt</label>' + (e.size < 18 ? '<small class="slides-warn">18pt 이상 권장</small>' : '') +
            '<div class="slides-tgrid" style="grid-template-columns:repeat(' + (rows[0] || []).length + ',minmax(56px,1fr))">' + rows.map((r, ri) => r.map((c, ci) => '<input type="text" data-r="' + ri + '" data-c="' + ci + '" value="' + esc(c) + '" aria-label="' + (ri + 1) + '행 ' + (ci + 1) + '열">').join('')).join('') + '</div>' +
            '<label class="slides-lab">엑셀에서 복사한 표 붙여넣기</label><textarea class="slides-tpaste" rows="3" placeholder="엑셀·한글 표를 복사해 여기에 붙여 넣으면 표 전체가 바뀝니다"></textarea></div>';
        }
        if (e.type === 'chart') {
          h += '<div class="slides-pg"><h4>차트</h4>' + seg('kind', e.kind || 'bar', [['bar', '', '막대'], ['line', '', '꺾은선'], ['pie', '', '원형']]) +
            '<label class="slides-lab">제목</label><input type="text" data-p="title" value="' + esc(e.title || '') + '" placeholder="(선택) 차트 제목">' +
            '<label class="slides-lab">데이터 <small class="muted">한 줄에 "항목, 값"</small></label><textarea class="slides-cdata" rows="6">' + esc((e.labels || []).map((l, i) => l + ', ' + ((e.values || [])[i] == null ? '' : e.values[i])).join('\n')) + '</textarea>' +
            '<label class="slides-check"><input type="checkbox" data-p="showValues"' + (e.showValues ? ' checked' : '') + '> 값 표시</label>' +
            '<label class="slides-inl">글자 크기 <input type="number" min="8" max="48" data-p="size" value="' + (e.size || 18) + '"> pt</label></div>';
        }
        h += '<div class="slides-pg"><h4>위치·크기</h4>' + geomHTML(e) +
          '<div class="slides-row slides-align">' + [['l', I.alignL, '왼쪽 맞춤'], ['c', I.alignCH, '가로 가운데'], ['r', I.alignR, '오른쪽 맞춤'], ['t', I.alignT, '위쪽 맞춤'], ['m', I.alignCV, '세로 가운데'], ['b', I.alignB, '아래쪽 맞춤']].map(([v, ic, l]) => '<button type="button" class="btn btn-sm btn-ghost p-icon-btn" data-align="' + v + '" title="슬라이드 ' + l + '" aria-label="슬라이드 ' + l + '">' + ic + '</button>').join('') + '</div></div>';
      }
      props.innerHTML = '<div class="slides-props-head"><b>속성</b><button type="button" class="btn btn-sm btn-ghost p-icon-btn" data-act="closeProps" aria-label="속성 닫기">' + I.close + '</button></div>' + h;
      const lst = props.querySelector('[data-p="list"]');
      if (lst && e) lst.value = e.list || '';
      const lh = props.querySelector('[data-p="lh"]');
      if (lh && e) { const v = String(e.lh || 1.3); if (!Array.from(lh.options).some((o) => o.value === v)) lh.insertAdjacentHTML('beforeend', '<option value="' + v + '">' + v + '</option>'); lh.value = v; }
      const sh = props.querySelector('[data-p="shape"]');
      if (sh && e) sh.value = e.shape;
    }
    function fitSize(e) {
      const probe = (size) => {
        const t = Object.assign(clone(e), { size });
        const tmp = { id: 'fit', variant: slide().variant, deco: false, els: [t] };
        return !measureOverflow(deck, [tmp]).fit.has(t.id);
      };
      let lo = 8, hi = Math.max(8, Math.round(e.size));
      if (!probe(lo)) return lo;
      while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (probe(mid)) lo = mid; else hi = mid - 1; }
      return lo;
    }
    function parseChartData(text) {
      const labels = [], values = [];
      String(text).split('\n').forEach((line) => {
        if (!line.trim()) return;
        const parts = line.split(/\t|,(?=[^,]*$)/);
        const lab = (parts.length > 1 ? parts.slice(0, -1).join(',') : '').trim();
        const v = Number(String(parts[parts.length - 1]).replace(/[^\d.\-]/g, ''));
        if (parts.length === 1) { labels.push(parts[0].trim()); values.push(0); return; }
        labels.push(lab);
        values.push(isFinite(v) ? v : 0);
      });
      return { labels, values };
    }
    function parseTSV(text) {
      const rows = String(text).replace(/\r/g, '').split('\n').filter((l, i, a) => l.length || i < a.length - 1).map((l) => l.split('\t'));
      while (rows.length && rows[rows.length - 1].every((c) => !c.trim())) rows.pop();
      return rows.length ? normalizeRows(rows) : null;
    }
    on(props, 'click', (ev) => {
      const e = selEl();
      const s = slide();
      const sw = ev.target.closest('.slides-sw-b');
      if (sw) {
        const name = sw.closest('[data-sw]').dataset.sw;
        const v = sw.dataset.v || null;
        if (name === 'bg') change(() => { s.bg = v ? col(v, palette(deck, s)) : null; }, null, { props: true });
        else if (e) { change(() => { e[name] = v; }, null, { props: true }); }
        return;
      }
      const sg = ev.target.closest('.slides-seg button');
      if (sg) {
        const name = sg.parentElement.dataset.seg;
        const v = sg.dataset.v;
        if (name === 'variant') change(() => { s.variant = v; }, null, { props: true });
        else if (name === 'style' && e) change(() => { e[v] = !e[v]; }, null, { props: true });
        else if (e) change(() => { e[name] = v; }, null, { props: true });
        return;
      }
      const al = ev.target.closest('[data-align]');
      if (al) { alignSel(al.dataset.align); return; }
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const a = b.dataset.act;
      if (a === 'closeProps') { st.propsOpen = false; root.querySelector('.slides-ed').classList.remove('props-open'); return; }
      if (a === 'relayout') openLayoutPicker('change');
      else if (a === 'dupSlide') duplicateSlide(st.cur);
      else if (a === 'delSlide') deleteSlide(st.cur);
      else if (a === 'bgimg') pickFiles('image/*', false).then(async (fs) => {
        if (!fs[0]) return;
        try { const im = await readImage(fs[0]); const aid = 'a' + uid(); deck.assets[aid] = im.data; change(() => { s.bgAsset = aid; }, null, { props: true }); } catch (er) { P.ui.toast(er.message, 'warn'); }
      });
      else if (a === 'bgimg-x') change(() => { s.bgAsset = null; }, null, { props: true });
      if (!e) return;
      if (a === 'dup') duplicateSel();
      else if (a === 'del') deleteSel();
      else if (a === 'front') reorder('front');
      else if (a === 'back') reorder('back');
      else if (a === 'edit') startEdit(e);
      else if (a === 'fit') {
        const size = fitSize(e);
        if (size === e.size) P.ui.toast('글이 상자 안에 들어갑니다(' + size + 'pt).', 'info');
        else { change(() => { e.size = size; }, null, { props: true }); P.ui.toast('글자 크기를 ' + size + 'pt로 맞췄습니다.' + (size < 18 ? ' 글을 줄이거나 나눠 보세요.' : ''), size < 18 ? 'warn' : 'ok'); }
      }
      else if (a === 'size-' || a === 'size+') change(() => { e.size = clamp(e.size + (a === 'size+' ? 2 : -2), 6, 300); }, 'size:' + e.id, { props: true });
      else if (a === 'img') replaceImage(e);
      else if (a === 'imgRatio') change(() => { e.h = round(e.w * e.nh / e.nw); }, null, { props: true });
      else if (a === 'row+') change(() => { e.rows.push(e.rows[0].map(() => '')); e.h = Math.min(H - e.y, e.h + 50); }, null, { props: true });
      else if (a === 'row-') { if (e.rows.length > 1) change(() => { e.rows.pop(); e.h = Math.max(60, e.h - 50); }, null, { props: true }); }
      else if (a === 'col+') change(() => { e.rows.forEach((r) => r.push('')); }, null, { props: true });
      else if (a === 'col-') { if (e.rows[0].length > 1) change(() => { e.rows.forEach((r) => r.pop()); }, null, { props: true }); }
    });
    on(props, 'input', (ev) => {
      const e = selEl();
      const t = ev.target;
      if (t.matches('[data-swc]')) {
        const name = t.dataset.swc;
        if (name === 'bg') change(() => { slide().bg = t.value; }, 'bg:' + slide().id);
        else if (e) change(() => { e[name] = t.value; }, name + ':' + e.id);
        return;
      }
      if (!e) return;
      if (t.matches('[data-geo]')) {
        const v = Number(t.value);
        if (!isFinite(v)) return;
        change(() => { e[t.dataset.geo] = t.dataset.geo === 'w' || t.dataset.geo === 'h' ? Math.max(8, round(v)) : round(v); }, 'geo:' + e.id);
        return;
      }
      if (t.matches('.slides-tgrid input')) {
        change(() => { e.rows[+t.dataset.r][+t.dataset.c] = t.value; }, 'cell:' + e.id);
        return;
      }
      if (t.matches('.slides-cdata')) {
        const d = parseChartData(t.value);
        change(() => { e.labels = d.labels; e.values = d.values; }, 'cdata:' + e.id);
        return;
      }
      if (t.matches('.slides-tpaste')) {
        const rows = parseTSV(t.value);
        if (rows && (rows.length > 1 || rows[0].length > 1)) change(() => { e.rows = rows; }, null, { props: true });
        return;
      }
      const k = t.dataset.p;
      if (!k) return;
      if (k === 'size' || k === 'strokeW') { const v = Number(t.value); if (isFinite(v) && v > 0) setProp(k, clamp(v, 1, 300)); return; }
      if (k === 'opacity') { setProp('opacity', 1 - Number(t.value) / 100); const o = t.previousElementSibling && t.previousElementSibling.querySelector('output'); if (o) o.textContent = t.value + '%'; return; }
      if (k === 'radius') { setProp('radius', Number(t.value)); const o = t.previousElementSibling && t.previousElementSibling.querySelector('output'); if (o) o.textContent = t.value + 'px'; return; }
      if (k === 'title') { setProp('title', t.value); return; }
    });
    on(props, 'change', (ev) => {
      const e = selEl();
      const t = ev.target;
      if (t.matches('[data-sp="deco"]')) { change(() => { slide().deco = t.checked; }); return; }
      if (!e) return;
      const k = t.dataset.p;
      if (k === 'list') change(() => { e.list = t.value || null; });
      else if (k === 'lh') change(() => { e.lh = Number(t.value); });
      else if (k === 'shape') change(() => {
        e.shape = t.value;
        if (t.value === 'line') { e.stroke = e.stroke || e.fill || '@accent'; e.strokeW = Math.max(3, e.strokeW || 3); }
        else if (!e.fill) e.fill = '@accent';
      }, null, { props: true });
      else if (k === 'header' || k === 'band' || k === 'showValues') change(() => { e[k] = t.checked; });
      else if (k === 'size') renderProps();
    });
    function openProps() {
      st.propsOpen = true;
      root.querySelector('.slides-ed').classList.add('props-open');
    }

    /* ----- 노트·제목 ----- */
    let notesStarted = false;
    on(notesTa, 'focus', () => { notesStarted = false; });
    on(notesTa, 'input', () => {
      if (!notesStarted) { checkpoint('notes:' + slide().id); notesStarted = true; }
      slide().notes = notesTa.value;
      updateThumbSoon();
      scheduleSave();
    });
    on(titleIn, 'input', () => {
      checkpoint('title');
      deck.title = titleIn.value;
      scheduleSave();
    });
    on(titleIn, 'keydown', (ev) => { if (ev.key === 'Enter') titleIn.blur(); });

    /* ----- 품질 점검 ----- */
    let qT = null;
    function qualitySoon() { clearTimeout(qT); qT = setTimeout(updateBadge, 900); }
    function updateBadge() {
      const r = checkDeck(deck);
      badge.hidden = !r.warn;
      badge.textContent = r.warn;
      badge.title = '고칠 점 ' + r.warn + '개';
    }
    function openQuality() {
      finishEdit();
      const r = checkDeck(deck);
      const body = document.createElement('div');
      body.className = 'slides-qa';
      const grade = r.score >= 90 ? '좋음' : r.score >= 70 ? '보통' : '손볼 곳 많음';
      let h = '<div class="slides-qa-score"><div class="slides-qa-ring" style="--v:' + r.score + '"><b>' + r.score + '</b></div><div><b>' + grade + '</b><p class="muted">고칠 점 ' + r.warn + '개 · 참고 ' + r.info + '개' + (r.noNotes ? ' · 노트 없는 장 ' + r.noNotes + '개' : '') + '</p>' +
        '<p class="muted slides-qa-rule">기준: 18pt 이상 · 한 장 6항목 이하 · 200자 이하 · 명도 대비 4.5:1(큰 글자 3:1) · 한 장 한 메시지 · 말할 내용은 노트로</p></div></div>';
      if (!r.issues.length) h += '<div class="empty"><b>모든 슬라이드가 기준을 통과했습니다.</b></div>';
      else {
        h += '<ol class="slides-qa-list">';
        r.issues.forEach((it, n) => {
          h += '<li><button type="button" data-n="' + n + '" class="slides-qa-item ' + it.level + '"><span class="slides-qa-tag">' + (it.level === 'warn' ? '고칠 점' : '참고') + '</span><span class="slides-qa-sl">' + (it.si + 1) + '번</span><span>' + esc(it.msg) + '</span></button></li>';
        });
        h += '</ol>';
      }
      body.innerHTML = h;
      const close = P.ui.modal({ title: '품질 점검', body, wide: true, actions: [{ label: '닫기', primary: true }] });
      body.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-n]');
        if (!b) return;
        const it = r.issues[+b.dataset.n];
        close();
        goSlide(it.si);
        if (it.el) select(it.el);
      });
      updateBadge();
    }

    /* ----- 내보내기·가져오기 ----- */
    async function exportPPTX() {
      finishEdit();
      P.ui.toast('PPTX 파일을 만드는 중입니다…', 'info');
      try {
        const blob = await buildPPTX(deck);
        P.ui.download(safeFile(deck.title) + '.pptx', blob);
        P.ui.toast('PPTX로 내보냈습니다.', 'ok');
      } catch (e) { console.error(e); P.ui.toast('PPTX로 내보내지 못했습니다: ' + e.message, 'error'); }
    }
    async function exportPNG(all) {
      finishEdit();
      try {
        if (!all) {
          const b = await slidePNG(deck, slide(), 1.5);
          P.ui.download(safeFile(deck.title) + '-' + (st.cur + 1) + '.png', b);
          P.ui.toast('현재 슬라이드를 PNG로 저장했습니다.', 'ok');
          return;
        }
        P.ui.toast('이미지를 만드는 중입니다…', 'info');
        await P.loadScript(VENDOR_JSZIP);
        const zip = new window.JSZip();
        for (let i = 0; i < deck.slides.length; i++) zip.file('slide-' + String(i + 1).padStart(2, '0') + '.png', await slidePNG(deck, deck.slides[i], 1.5));
        P.ui.download(safeFile(deck.title) + '-images.zip', await zip.generateAsync({ type: 'blob' }));
        P.ui.toast('모든 슬라이드를 PNG 묶음(ZIP)으로 저장했습니다.', 'ok');
      } catch (e) { console.error(e); P.ui.toast('이미지를 만들지 못했습니다: ' + e.message, 'error'); }
    }
    function exportMenu(anchor) {
      popover(anchor, [
        { label: '파워포인트 (PPTX)', icon: I.download, hint: '편집 가능', onClick: () => P.ui.busy(anchor, exportPPTX) },
        { label: 'PDF (인쇄)', icon: I.download, hint: '한 장에 한 쪽', onClick: () => { finishEdit(); P.ui.toast('인쇄 창에서 "PDF로 저장"을 고르세요.', 'info'); printDeck(root, deck); } },
        { label: '현재 슬라이드 PNG', icon: I.image, onClick: () => P.ui.busy(anchor, () => exportPNG(false)) },
        { label: '모든 슬라이드 PNG (ZIP)', icon: I.image, onClick: () => P.ui.busy(anchor, () => exportPNG(true)) },
        '-',
        { label: '개요 텍스트 복사', icon: I.outline, onClick: async () => {
          const t = deckToOutline(deck);
          try { await navigator.clipboard.writeText(t); P.ui.toast('개요를 복사했습니다. 문서에 붙여 넣을 수 있습니다.', 'ok'); }
          catch (e) { P.ui.download(safeFile(deck.title) + '-outline.txt', t, 'text/plain'); }
        } },
        { label: 'PT 파일 백업 (.json)', icon: I.download, onClick: () => P.ui.download(safeFile(deck.title) + '.json', JSON.stringify(serialize(deck)), 'application/json') }
      ], { alignRight: true });
    }
    async function outlineImport() {
      finishEdit();
      const r = await outlineDialog({ actions: [{ id: 'replace', label: '전체 바꾸기' }, { id: 'append', label: '뒤에 추가' }] });
      if (!r || !r.slides.length) return;
      if (r.mode === 'replace') {
        const ok = await P.ui.confirm('지금 슬라이드를 모두 개요 내용으로 바꿀까요?\n' + MOD + '+Z로 되돌릴 수 있습니다.', { okLabel: '바꾸기' });
        if (!ok) return;
        change(() => { deck.slides = r.slides; st.cur = 0; st.sel = null; }, null, { all: true });
      } else {
        change(() => { const at = deck.slides.length; deck.slides.push(...r.slides); st.cur = at; st.sel = null; }, null, { all: true });
      }
      P.ui.toast('슬라이드 ' + r.slides.length + '장을 만들었습니다.', 'ok');
    }
    function startPresent(i) {
      finishEdit();
      saveNow();
      st.exitPresent = present(deck, i == null ? st.cur : i, (last) => { st.exitPresent = null; goSlide(last); });
    }
    function openThemes() {
      const close = P.ui.modal({
        title: '테마', wide: true,
        body: themeGallery(deck.theme, (tid) => { close(); change(() => { deck.theme = tid; }, null, { all: true }); })
      });
    }
    function shapeMenu(anchor) {
      popover(anchor, SHAPES.map((x) => ({ label: x.name, icon: I.shape, onClick: () => addShape(x.id) })));
    }
    function helpDialog() {
      const rows = [
        ['발표 시작 / 현재 장부터', 'F5 / Shift+F5'], ['실행 취소 / 다시 실행', MOD + '+Z / ' + MOD + '+Y'], ['저장', MOD + '+S'],
        ['새 슬라이드', MOD + '+M'], ['복제(요소 또는 슬라이드)', MOD + '+D'], ['복사 / 잘라내기 / 붙여넣기', MOD + '+C / X / V'],
        ['글 고치기 / 끝내기', 'Enter / Esc'], ['요소 삭제', 'Delete'], ['조금 이동 / 크게 이동', '방향키 / Shift+방향키'],
        ['굵게 / 기울임 / 밑줄', MOD + '+B / I / U'], ['글자 크게 / 작게', MOD + '+] / ['], ['이전·다음 슬라이드', 'PageUp / PageDown'],
        ['한 방향으로만 끌기 / 맞춤선 끄기', 'Shift / Alt (끄는 중)'], ['사진 비율 무시하고 크기 조절', 'Shift (모서리)'],
        ['글머리 들여쓰기 / 내어쓰기', 'Tab / Shift+Tab (글 고칠 때)'],
        ['발표 중: 다음 / 이전', '→ 스페이스 / ←'], ['발표 중: 검은 화면 / 흰 화면', 'B / W'], ['발표 중: 발표자 보기', 'S']
      ];
      P.ui.modal({ title: '단축키', body: '<table class="slides-keys">' + rows.map((r) => '<tr><td>' + esc(r[0]) + '</td><td><kbd>' + esc(r[1]) + '</kbd></td></tr>').join('') + '</table>', actions: [{ label: '닫기', primary: true }] });
    }

    /* ----- 단추 ----- */
    on(root, 'click', (ev) => {
      const b = ev.target.closest('[data-a]');
      if (!b || !root.contains(b)) return;
      const a = b.dataset.a;
      if (a === 'undo') undo();
      else if (a === 'redo') redo();
      else if (a === 'addSlide') openLayoutPicker('add');
      else if (a === 'addText') addText();
      else if (a === 'addShape') shapeMenu(b);
      else if (a === 'addImage') pickFiles('image/*', true).then((fs) => addImages(fs));
      else if (a === 'addTable') addTable();
      else if (a === 'addChart') addChart();
      else if (a === 'layout') openLayoutPicker('change');
      else if (a === 'theme') openThemes();
      else if (a === 'outline') outlineImport();
      else if (a === 'check') openQuality();
      else if (a === 'export') exportMenu(b);
      else if (a === 'present') startPresent(0);
      else if (a === 'help') helpDialog();
      else if (a === 'props') {
        const ed = root.querySelector('.slides-ed');
        st.propsOpen = !ed.classList.contains('props-open');
        ed.classList.toggle('props-open', st.propsOpen);
      }
    });

    /* ----- 키보드·붙여넣기·끌어다 놓기 ----- */
    const typing = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    on(document, 'keydown', (ev) => {
      if (st.exitPresent || document.querySelector('.p-modal-back')) return;
      if (ev.key === 'Escape' && closePopover()) { ev.preventDefault(); return; }
      const mod = ev.ctrlKey || ev.metaKey;
      const code = ev.code;
      if (mod && code === 'KeyS') { ev.preventDefault(); finishEdit(); st.dirty = true; saveNow(); return; }
      if (ev.key === 'F5') { ev.preventDefault(); startPresent(ev.shiftKey ? st.cur : 0); return; }
      if (typing(ev.target)) return;
      const e = selEl();
      if (mod && code === 'KeyZ') { ev.preventDefault(); if (ev.shiftKey) redo(); else undo(); return; }
      if (mod && code === 'KeyY') { ev.preventDefault(); redo(); return; }
      if (mod && code === 'KeyM') { ev.preventDefault(); addSlide('titleBody'); return; }
      if (mod && code === 'KeyD') { ev.preventDefault(); duplicateSel(); return; }
      if (mod && e && (e.type === 'text' || e.type === 'shape')) {
        if (code === 'KeyB') { ev.preventDefault(); setProp('bold', !e.bold); renderProps(); return; }
        if (code === 'KeyI') { ev.preventDefault(); setProp('italic', !e.italic); renderProps(); return; }
        if (code === 'KeyU') { ev.preventDefault(); setProp('underline', !e.underline); renderProps(); return; }
        if (code === 'BracketRight' || code === 'BracketLeft') { ev.preventDefault(); change(() => { e.size = clamp(e.size + (code === 'BracketRight' ? 2 : -2), 6, 300); }, 'size:' + e.id, { props: true }); return; }
      }
      if (mod) return;
      if (ev.target.closest && ev.target.closest('.slides-thumbs')) return;
      if (ev.key === 'PageDown') { ev.preventDefault(); goSlide(st.cur + 1); return; }
      if (ev.key === 'PageUp') { ev.preventDefault(); goSlide(st.cur - 1); return; }
      if (!e) {
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') { ev.preventDefault(); goSlide(st.cur + 1); }
        else if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') { ev.preventDefault(); goSlide(st.cur - 1); }
        else if (ev.key === '?') helpDialog();
        return;
      }
      const step = ev.shiftKey ? 10 : 1;
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); nudge(-step, 0); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); nudge(step, 0); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); nudge(0, -step); }
      else if (ev.key === 'ArrowDown') { ev.preventDefault(); nudge(0, step); }
      else if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); deleteSel(); }
      else if (ev.key === 'Enter' || ev.key === 'F2') { ev.preventDefault(); if (e.type === 'image') replaceImage(e); else startEdit(e); }
      else if (ev.key === 'Escape') { ev.preventDefault(); select(null); }
      else if (ev.key === '?') helpDialog();
    });
    const CLIP_TYPE = 'application/x-slides-element';
    function onCopy(ev, cut) {
      if (st.exitPresent || document.querySelector('.p-modal-back') || typing(ev.target) || st.editing) return;
      const e = selEl();
      if (!e || !ev.clipboardData) return;
      ev.preventDefault();
      st.clip = clone(e);
      st.clipText = e.type === 'text' || e.type === 'shape' ? String(e.text || '') : '[PT ' + ({ image: '사진', table: '표', chart: '차트' }[e.type] || '요소') + ']';
      if (e.type === 'table') st.clipText = (e.rows || []).map((r) => r.join('\t')).join('\n');
      try { ev.clipboardData.setData('text/plain', st.clipText); ev.clipboardData.setData(CLIP_TYPE, '1'); } catch (er) { /* 무시 */ }
      if (cut) deleteSel();
      P.ui.toast(cut ? '잘라냈습니다.' : '복사했습니다.', 'info');
    }
    on(document, 'copy', (ev) => onCopy(ev, false));
    on(document, 'cut', (ev) => onCopy(ev, true));
    on(document, 'paste', (ev) => {
      if (st.exitPresent || document.querySelector('.p-modal-back') || typing(ev.target)) return;
      const cd = ev.clipboardData;
      if (!cd) return;
      const files = Array.from(cd.files || []).filter((f) => /^image\//.test(f.type));
      if (files.length) { ev.preventDefault(); addImages(files); return; }
      const text = cd.getData('text/plain');
      let mine = false;
      try { mine = !!cd.getData(CLIP_TYPE); } catch (er) { /* 무시 */ }
      if (st.clip && (mine || text === st.clipText)) {
        ev.preventDefault();
        const c = clone(st.clip);
        c.x = clamp(c.x + 20, -c.w + 20, W - 20); c.y = clamp(c.y + 20, -c.h + 20, H - 20);
        st.clip = clone(c);
        insertEl(c);
        return;
      }
      if (!text || !text.trim()) return;
      ev.preventDefault();
      if (/\t/.test(text) && text.includes('\n')) { addTable(parseTSV(text)); P.ui.toast('붙여 넣은 표를 넣었습니다.', 'ok'); return; }
      const e = insertEl(T(Object.assign(centered(800, Math.min(500, 60 + 44 * text.split('\n').length)), { size: 24, text: text.trim(), list: text.trim().includes('\n') ? 'bullet' : null })));
      select(e.id);
    });
    on(wrap, 'dragover', (ev) => { if (ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes('Files')) { ev.preventDefault(); wrap.classList.add('drop'); } });
    on(wrap, 'dragleave', () => wrap.classList.remove('drop'));
    on(wrap, 'drop', (ev) => {
      wrap.classList.remove('drop');
      const files = Array.from((ev.dataTransfer && ev.dataTransfer.files) || []);
      if (!files.length) return;
      ev.preventDefault();
      const r = frame.getBoundingClientRect();
      addImages(files, { x: (ev.clientX - r.left) / st.k, y: (ev.clientY - r.top) / st.k });
    });
    on(window, 'beforeunload', (ev) => {
      if (st.dirty || st.saving) { saveNow(); ev.preventDefault(); ev.returnValue = ''; }
    });

    /* ----- 처음 그리기 ----- */
    function renderAll() {
      renderRail();
      goSlide(st.cur, true);
      fitStage();
    }
    let ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => { fitStage(); scaleMinis(thumbs); placeEditor(); });
      ro.observe(wrap);
      ro.observe(thumbs);
    } else on(window, 'resize', fitStage);
    renderAll();
    requestAnimationFrame(() => { fitStage(); scaleMinis(thumbs); });
    setTimeout(updateBadge, 400);

    return () => {
      if (st.exitPresent) st.exitPresent();
      closePopover();
      if (ro) ro.disconnect();
      clearTimeout(qT); clearTimeout(thumbT);
      offs.forEach((f) => f());
      if (st.dirty) saveNow();
      document.body.classList.remove('slides-printing');
    };
  }

  P.registerApp({
    id: APP_ID,
    title: 'PT 작업장',
    short: 'PT',
    icon: I.app,
    order: 4,
    desc: '16:9 슬라이드 편집, 테마·레이아웃, 발표 모드, 개요로 만들기, 파워포인트(PPTX)·PDF 내보내기',
    mount(root, ctx) {
      const id = ctx.params[0];
      if (!id) return mountList(root, ctx);
      return mountEditor(root, ctx, id);
    }
  });
})();
