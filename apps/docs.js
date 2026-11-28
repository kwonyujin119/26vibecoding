/* 문서: A4 쪽 편집기 (한글 대체) — 공문서 서식, 항목 번호, 표, 점검, HWPX·DOCX·PDF 내보내기 */
(function () {
  'use strict';

  const APP_ID = 'docs';
  const COL = 'docs';
  const esc = (s) => P.esc(s);
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6M9 9h2"/></svg>';
  const VENDOR_ZIP = 'vendor/jszip/jszip.min.js';
  const VENDOR_MAMMOTH = 'vendor/mammoth/mammoth.browser.min.js';

  /* ---------- 단위 ---------- */
  const PX_PER_MM = 96 / 25.4;
  const mm2px = (mm) => mm * PX_PER_MM;
  const PAGE_GAP = 24; // 화면에서 쪽 사이 간격(px)

  /* ---------- 아이콘 ---------- */
  const sv = (d, extra) => '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + d + '</svg>';
  const I = {
    back: sv('<path d="M15 6l-6 6 6 6"/>'),
    undo: sv('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
    redo: sv('<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>'),
    bold: sv('<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>', ' stroke-width="2.2"'),
    italic: sv('<path d="M14 5h-4M14 19h-4M14.5 5l-5 14"/>'),
    underline: sv('<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>'),
    strike: sv('<path d="M5 12h14M16 6.5A4 4 0 0 0 12.5 5h-1.5a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7H11a4 4 0 0 1-3.5-1.8"/>'),
    sup: sv('<path d="M4 7l8 10M12 7l-8 10M16 4h4l-4 5h4"/>'),
    sub: sv('<path d="M4 7l8 10M12 7l-8 10M16 15h4l-4 5h4"/>'),
    color: sv('<path d="M6 16L11 4h2l5 12M8 12h8"/><path d="M4 20h16" stroke-width="3"/>'),
    marker: sv('<path d="M9 15l-3 3h5l1-1M9 15l8-8 3 3-8 8M9 15l3 3"/><path d="M4 21h16" stroke-width="3"/>'),
    clear: sv('<path d="M6 5h12M12 5l-3 14M4 20l16-16"/>'),
    left: sv('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'),
    center: sv('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'),
    right: sv('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>'),
    justify: sv('<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>'),
    indent: sv('<path d="M10 6h10M10 10h10M10 14h10M4 18h16M4 9l3 2.5L4 14"/>'),
    outdent: sv('<path d="M10 6h10M10 10h10M10 14h10M4 18h16M7 9l-3 2.5L7 14"/>'),
    ol: sv('<path d="M10 6h10M10 12h10M10 18h10M4 5h1.5v4M4 9h3M4 14.5a1.5 1.5 0 0 1 3 0c0 1.5-3 2-3 3.5h3"/>'),
    ul: sv('<path d="M10 6h10M10 12h10M10 18h10"/><rect x="3.5" y="4.5" width="3" height="3"/><circle cx="5" cy="12" r="1.5"/><path d="M3.5 18h3"/>'),
    lineh: sv('<path d="M11 6h9M11 12h9M11 18h9M5 4v16M3 6l2-2 2 2M3 18l2 2 2-2"/>'),
    table: sv('<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9.5h18M3 15h18M9 4v16M15 4v16"/>'),
    image: sv('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'),
    pagebreak: sv('<path d="M6 3v5h12V3M6 21v-5h12v5M3 12h2M8 12h3M13 12h3M19 12h2"/>'),
    hr: sv('<path d="M4 12h16"/>'),
    symbol: sv('<path d="M8 19h-3v-1.5A7 7 0 1 1 19 17.5V19h-3"/>'),
    date: sv('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>'),
    find: sv('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    check: sv('<path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>'),
    page: sv('<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M8 7h8M8 17h8" stroke-dasharray="2 2"/>'),
    count: sv('<path d="M4 7V5h16v2M9 19h6M12 5v14"/>'),
    export: sv('<path d="M12 15V3M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>'),
    print: sv('<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7"/>'),
    more: sv('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
    outline: sv('<path d="M4 6h16M8 12h12M12 18h8M4 12h.01M8 18h.01"/>'),
    help: sv('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>'),
    won: sv('<path d="M4 6l3.5 12L12 8l4.5 10L20 6M3 11h18M3 14h18"/>'),
    copy: sv('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
    merge: sv('<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M8 12h8M14 9.5l2.5 2.5-2.5 2.5M10 9.5L7.5 12l2.5 2.5"/>'),
    split: sv('<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M12 4v16"/>'),
    fill: sv('<path d="M5 13l7-7 6 6-7 7z"/><path d="M19 15s2 2.2 2 3.5a2 2 0 0 1-4 0c0-1.3 2-3.5 2-3.5z"/>'),
    close: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
    up: sv('<path d="M6 15l6-6 6 6"/>'),
    down: sv('<path d="M6 9l6 6 6-6"/>'),
    rows: sv('<path d="M4 6h16M4 12h16M4 18h16"/>'),
    tiles: sv('<rect x="4" y="3" width="6.5" height="9" rx="1"/><rect x="13.5" y="3" width="6.5" height="9" rx="1"/><path d="M4 16h6.5M13.5 16h6.5M4 20h4.5M13.5 20h4.5"/>'),
    zoom: sv('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>')
  };

  /* ---------- 글꼴 · 크기 ---------- */
  const FONTS = [
    { k: 'hcrb', label: '함초롬바탕', css: '"함초롬바탕", "HCR Batang", "바탕", Batang, "AppleMyungjo", "Noto Serif KR", serif' },
    { k: 'hcrd', label: '함초롬돋움', css: '"함초롬돋움", "HCR Dotum", "맑은 고딕", "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif' },
    { k: 'mg', label: '맑은 고딕', css: '"맑은 고딕", "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif' },
    { k: 'hmj', label: '휴먼명조', css: '"휴먼명조", "HYMyeongJo", "바탕", Batang, "AppleMyungjo", "Noto Serif KR", serif' },
    { k: 'hyhl', label: 'HY헤드라인M', css: '"HY헤드라인M", "HYHeadLine-Medium", "맑은 고딕", "Malgun Gothic", "Noto Sans KR", sans-serif' },
    { k: 'bt', label: '바탕', css: '"바탕", Batang, "AppleMyungjo", "Noto Serif KR", serif' },
    { k: 'dt', label: '돋움', css: '"돋움", Dotum, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif' },
    { k: 'gl', label: '굴림', css: '"굴림", Gulim, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif' },
    { k: 'gs', label: '궁서', css: '"궁서", Gungsuh, "AppleMyungjo", serif' },
    { k: 'ng', label: '나눔고딕', css: '"나눔고딕", "NanumGothic", "Noto Sans KR", sans-serif' },
    { k: 'nm', label: '나눔명조', css: '"나눔명조", "NanumMyeongjo", "Noto Serif KR", serif' },
    { k: 'sans', label: '고딕(기본)', css: 'system-ui, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif' },
    { k: 'mono', label: '고정폭', css: 'ui-monospace, "D2Coding", Consolas, monospace' }
  ];
  const FONT_BY_KEY = new Map(FONTS.map((f) => [f.k, f]));
  const SIZES = [8, 9, 10, 10.5, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 60, 72];
  const LINE_HEIGHTS = [100, 115, 130, 145, 160, 180, 200, 250, 300];
  const HILITES = ['#fff176', '#b9f6ca', '#b3e5fc', '#f8bbd0', '#ffd8a8', '#e0e0e0'];
  const COLORS = ['#000000', '#444444', '#888888', '#c00000', '#e65100', '#b8860b', '#2e7d32', '#00838f', '#1f4e9e', '#6a1b9a', '#ffffff'];
  const CELL_BG = ['', '#f2f2f2', '#d9d9d9', '#dbe5f1', '#e2efda', '#fff2cc', '#fce4d6', '#e4dfec'];
  const SYMBOLS = ['※', '○', '●', '□', '■', '◇', '◆', '△', '▲', '▷', '▶', '☞', '→', '⇒', '↔', '·', 'ㆍ', '-', '―', '∼', '〃', '「', '」', '『', '』', '【', '】', '〈', '〉', '《', '》', '①', '②', '③', '④', '⑤', '㉮', '㉯', '㉰', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', '℃', '㎡', '㎞', '㎏', '%', '‰', '±', '×', '÷', '≒', '≤', '≥', '∴', '∵', '★', '☆', '✓', '…'];

  const DEFAULT_PAGE = {
    orient: 'portrait', mt: 35, mb: 30, ml: 30, mr: 30,
    font: 'hcrb', size: 12, lh: 160,
    header: { text: '', align: 'center' },
    footer: { text: '', align: 'center' },
    pageNum: { pos: 'bottom-center', fmt: 'dash' }
  };
  const MARGIN_PRESETS = [
    { k: 'normal', label: '보통(위 35 · 아래 30 · 좌우 30)', v: { mt: 35, mb: 30, ml: 30, mr: 30 } },
    { k: 'narrow', label: '좁게(위 30 · 아래 15 · 왼 20 · 오른 15)', v: { mt: 30, mb: 15, ml: 20, mr: 15 } },
    { k: 'wide', label: '넓게(상하좌우 25)', v: { mt: 25, mb: 25, ml: 25, mr: 25 } },
    { k: 'tight', label: '아주 좁게(상하좌우 12.7)', v: { mt: 12.7, mb: 12.7, ml: 12.7, mr: 12.7 } }
  ];

  /* ---------- 작은 도구 ---------- */
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  function fmtDate(d, withDay) {
    return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.' + (withDay ? '(' + WEEK[d.getDay()] + ')' : '');
  }
  function relTime(iso) {
    const t = Date.parse(iso);
    if (!t) return '';
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return '방금 전';
    if (s < 3600) return Math.floor(s / 60) + '분 전';
    if (s < 86400) return Math.floor(s / 3600) + '시간 전';
    if (s < 86400 * 7) return Math.floor(s / 86400) + '일 전';
    return fmtDate(new Date(t));
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function pageOf(data) {
    const p = Object.assign(clone(DEFAULT_PAGE), data || {});
    p.header = Object.assign({}, DEFAULT_PAGE.header, (data && data.header) || {});
    p.footer = Object.assign({}, DEFAULT_PAGE.footer, (data && data.footer) || {});
    p.pageNum = Object.assign({}, DEFAULT_PAGE.pageNum, (data && data.pageNum) || {});
    return p;
  }
  function pageDims(pg) {
    const land = pg.orient === 'landscape';
    return { w: land ? 297 : 210, h: land ? 210 : 297 };
  }
  function safeName(s) {
    return (String(s || '문서').replace(/[\\/:*?"<>|\n\r\t]+/g, ' ').trim() || '문서').slice(0, 80);
  }
  /* 입력 창: Enter로 닫힐 때 포커스가 돌아간 단추·본문에 Enter가 한 번 더 들어가지 않도록 먼저 포커스를 놓는다 */
  function askText(msg, def) {
    const a = document.activeElement;
    if (a && a !== document.body && a.blur) a.blur();
    return P.ui.prompt(msg, def).then((v) => new Promise((r) => setTimeout(() => r(v), 30)));
  }
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function isMac() { return /Mac|iPhone|iPad/.test(navigator.platform || ''); }
  function pickFile(accept, multiple) {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = accept;
      if (multiple) inp.multiple = true;
      inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.addEventListener('change', () => { resolve(Array.from(inp.files || [])); inp.remove(); });
      inp.addEventListener('cancel', () => { resolve([]); inp.remove(); });
      inp.click();
    });
  }
  function readAs(file, kind) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error('파일을 읽지 못했습니다.'));
      if (kind === 'buffer') r.readAsArrayBuffer(file);
      else if (kind === 'url') r.readAsDataURL(file);
      else r.readAsText(file);
    });
  }
  function rgbToHex(c) {
    if (!c) return null;
    if (c[0] === '#') return c.length === 4 ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(0, 7);
    const m = c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
    if (!m) return null;
    if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
    return '#' + [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('');
  }
  function xmlEsc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  }

  /* 금액 한글 읽기: 113560 → 일십일만삼천오백육십 */
  function wonToHangul(n) {
    n = Math.floor(Math.abs(Number(n) || 0));
    if (!n) return '영';
    const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
    const small = ['', '십', '백', '천'];
    const big = ['', '만', '억', '조', '경'];
    let out = '';
    let g = 0;
    while (n > 0) {
      const part = n % 10000;
      if (part) {
        let s = '';
        let p = part;
        for (let i = 0; i < 4 && p > 0; i++) {
          const d = p % 10;
          if (d) s = digits[d] + small[i] + s;
          p = Math.floor(p / 10);
        }
        out = s + big[g] + out;
      }
      n = Math.floor(n / 10000);
      g++;
    }
    return out;
  }
  const withComma = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  /* ================= 붙여넣기·가져오기 정리(허용 목록 방식) ================= */
  const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FORM', 'CANVAS', 'VIDEO', 'AUDIO', 'XML', 'O:P']);
  const BLOCK_TAGS = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'NAV', 'BLOCKQUOTE', 'PRE', 'ADDRESS', 'CENTER', 'LI', 'UL', 'OL', 'DL', 'DT', 'DD', 'FIGURE', 'FIGCAPTION', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'HR', 'CAPTION']);
  const INLINE_MAP = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', INS: 'u', S: 's', STRIKE: 's', DEL: 's', SUB: 'sub', SUP: 'sup', SPAN: 'span', FONT: 'span', MARK: 'span', CODE: 'span', KBD: 'span', SMALL: 'span', BIG: 'span', A: 'a', ABBR: 'span', CITE: 'span', Q: 'span', LABEL: 'span', TIME: 'span' };
  const INLINE_STYLES = ['color', 'background-color', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-decoration-line', 'vertical-align'];
  const BLOCK_STYLES = ['text-align', 'line-height', 'margin-left', 'text-indent'];
  const FONT_SIZE_ATTR = { 1: '8pt', 2: '10pt', 3: '12pt', 4: '14pt', 5: '18pt', 6: '24pt', 7: '36pt' };

  function safeStyleVal(v) {
    return v && !/url\(|expression|javascript:|@import|[<>]/i.test(v);
  }
  function pickStyles(src, names, extra) {
    const out = [];
    const st = src.style;
    if (st) {
      names.forEach((n) => {
        let v = st.getPropertyValue(n);
        if (n === 'text-decoration-line' && !v) {
          const td = st.getPropertyValue('text-decoration');
          if (/underline|line-through/.test(td)) v = td.match(/underline|line-through/g).join(' ');
        }
        if (n === 'background-color' && !v) {
          const bg = st.getPropertyValue('background');
          const m = bg && bg.match(/(#[0-9a-f]{3,8}|rgba?\([^)]*\))/i);
          if (m) v = m[1];
        }
        if (!safeStyleVal(v)) return;
        if (n === 'font-weight' && !/bold|[6-9]00/.test(v)) return;
        if (n === 'font-style' && v !== 'italic') return;
        if (n === 'vertical-align' && !/super|sub/.test(v)) return;
        if (n === 'background-color' && /transparent|rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|^(white|#fff|#ffffff|windowtext)$/i.test(v)) return;
        if (n === 'color' && /windowtext/i.test(v)) return;
        if (n === 'text-align' && !/^(left|center|right|justify)$/.test(v)) return;
        if (n === 'margin-left' || n === 'text-indent') {
          const px = parseFloat(v);
          if (!px || /%/.test(v)) return;
        }
        if (n === 'line-height') {
          const num = parseFloat(v);
          if (!num) return;
          if (/%$/.test(v)) v = String(num / 100);
          else if (!/^[\d.]+$/.test(v)) return;
          if (+v < 0.8 || +v > 4) return;
        }
        out.push(n + ':' + v);
      });
    }
    if (extra) out.push(...extra);
    return out.join(';');
  }
  function safeUrl(u, img) {
    u = String(u || '').trim();
    if (img) return /^data:image\/(png|jpe?g|gif|webp|bmp);base64,/i.test(u) || /^https?:\/\//i.test(u) ? u : '';
    return /^(https?:|mailto:|#)/i.test(u) ? u : '';
  }
  function isPageBreakStyle(node) {
    const s = node.getAttribute && (node.getAttribute('style') || '');
    return /page-break-(before|after)\s*:\s*always|break-(before|after)\s*:\s*page/i.test(s);
  }

  function sanitizeHTML(html) {
    const doc = new DOMParser().parseFromString('<!doctype html><body>' + String(html || '') + '</body>', 'text/html');
    const out = document.createElement('div');
    blockify(doc.body, out, { listDepth: 0 });
    finalizeContainer(out);
    return out.innerHTML;
  }

  /* 블록 문맥: 자식들을 블록 요소로 만들어 out에 넣는다 */
  function blockify(src, out, ctx) {
    let cur = null;
    const flush = () => { cur = null; };
    const curP = () => {
      if (!cur) { cur = document.createElement('p'); out.appendChild(cur); }
      return cur;
    };
    for (const node of Array.from(src.childNodes)) {
      if (node.nodeType === 3) {
        const t = node.nodeValue;
        if (!cur && !/\S/.test(t)) continue;
        curP().appendChild(document.createTextNode(t.replace(/[\r\n]+/g, ' ')));
        continue;
      }
      if (node.nodeType !== 1) continue;
      const tag = node.tagName;
      if (DROP_TAGS.has(tag)) continue;
      if (tag === 'BR') { if (cur) cur.appendChild(document.createElement('br')); else curP().appendChild(document.createElement('br')); flush(); continue; }
      if (!BLOCK_TAGS.has(tag)) {
        if (tag === 'IMG' || INLINE_MAP[tag] || !hasBlockDesc(node)) { inlineInto(node, curP()); continue; }
        // 인라인 태그 안에 블록이 있으면 풀어서 처리
        flush();
        blockify(node, out, ctx);
        continue;
      }
      flush();
      if (isPageBreakStyle(node) && /page-break-before|break-before/i.test(node.getAttribute('style') || '')) out.appendChild(pageBreakEl());
      if (tag === 'HR') {
        out.appendChild(node.classList.contains('docs-pagebreak') || isPageBreakStyle(node) ? pageBreakEl() : document.createElement('hr'));
        continue;
      }
      if (tag === 'TABLE') { const t = buildTable(node); if (t) out.appendChild(t); continue; }
      if (tag === 'UL' || tag === 'OL') { listInto(node, out, ctx.listDepth + 1, tag === 'OL'); continue; }
      if (/^(THEAD|TBODY|TFOOT|TR|TD|TH|CAPTION)$/.test(tag)) { blockify(node, out, ctx); continue; }
      if (hasBlockDesc(node)) { blockify(node, out, ctx); continue; }
      // 단일 블록
      let ntag = 'p';
      if (/^H[1-6]$/.test(tag)) ntag = 'h' + Math.min(3, +tag[1]);
      const b = document.createElement(ntag);
      const extra = [];
      const al = node.getAttribute('align');
      if (al && /^(left|center|right|justify)$/i.test(al)) extra.push('text-align:' + al.toLowerCase());
      if (tag === 'CENTER') extra.push('text-align:center');
      const st = pickStyles(node, BLOCK_STYLES, extra);
      if (st) b.setAttribute('style', st);
      ['data-ol', 'data-ul'].forEach((a) => {
        const v = parseInt(node.getAttribute(a), 10);
        if (v >= 1 && v <= (a === 'data-ol' ? 8 : 4)) b.setAttribute(a, String(v));
      });
      const inl = pickStyles(node, INLINE_STYLES);
      const target = inl ? b.appendChild(spanWith(inl)) : b;
      if (tag === 'PRE') preInto(node, target);
      else inlineChildren(node, target);
      out.appendChild(b);
      if (isPageBreakStyle(node) && /page-break-after|break-after/i.test(node.getAttribute('style') || '')) out.appendChild(pageBreakEl());
    }
  }
  function hasBlockDesc(node) {
    return !!node.querySelector && !!node.querySelector('p,div,section,article,header,footer,blockquote,pre,li,ul,ol,dl,h1,h2,h3,h4,h5,h6,table,hr,figure,address,center,main');
  }
  function spanWith(style) { const s = document.createElement('span'); s.setAttribute('style', style); return s; }
  function pageBreakEl() { const h = document.createElement('hr'); h.className = 'docs-pagebreak'; return h; }
  function preInto(node, target) {
    const lines = node.textContent.replace(/\r/g, '').split('\n');
    lines.forEach((ln, i) => {
      if (i) target.appendChild(document.createElement('br'));
      target.appendChild(document.createTextNode(ln.replace(/\t/g, '    ')));
    });
  }
  function inlineChildren(src, target) {
    for (const c of Array.from(src.childNodes)) inlineInto(c, target);
  }
  /* 인라인 문맥 변환 */
  function inlineInto(node, target) {
    if (node.nodeType === 3) { target.appendChild(document.createTextNode(node.nodeValue.replace(/[\r\n]+/g, ' '))); return; }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (DROP_TAGS.has(tag)) return;
    if (tag === 'BR') { target.appendChild(document.createElement('br')); return; }
    if (tag === 'IMG') {
      const src = safeUrl(node.getAttribute('src'), true);
      if (!src) return;
      const img = document.createElement('img');
      img.setAttribute('src', src);
      const alt = node.getAttribute('alt');
      if (alt) img.setAttribute('alt', alt.slice(0, 200));
      let w = node.style && node.style.width;
      if (!w || !/^\d+(\.\d+)?(%|px)$/.test(w)) {
        const aw = parseInt(node.getAttribute('width'), 10);
        w = aw ? aw + 'px' : '';
      }
      if (w) img.setAttribute('style', 'width:' + w);
      target.appendChild(img);
      return;
    }
    const mapped = INLINE_MAP[tag];
    if (!mapped || BLOCK_TAGS.has(tag)) {
      // 알 수 없는 태그·인라인 안의 블록: 내용만
      inlineChildren(node, target);
      if (BLOCK_TAGS.has(tag) && tag !== 'TD' && tag !== 'TH') target.appendChild(document.createElement('br'));
      return;
    }
    let n;
    if (mapped === 'a') {
      const href = safeUrl(node.getAttribute('href'));
      if (!href) { inlineChildren(node, target); return; }
      n = document.createElement('a');
      n.setAttribute('href', href);
    } else n = document.createElement(mapped);
    const extra = [];
    if (tag === 'FONT') {
      const c = node.getAttribute('color');
      if (c && /^#?[0-9a-z]+$/i.test(c)) extra.push('color:' + c);
      const f = node.getAttribute('face');
      if (f && safeStyleVal(f)) extra.push('font-family:' + f.replace(/[;"]/g, ''));
      const sz = node.getAttribute('size');
      if (FONT_SIZE_ATTR[sz]) extra.push('font-size:' + FONT_SIZE_ATTR[sz]);
    }
    if (tag === 'MARK') extra.push('background-color:#fff176');
    const st = pickStyles(node, INLINE_STYLES, extra);
    if (st) n.setAttribute('style', st);
    inlineChildren(node, n);
    if (mapped === 'span' && !st) { while (n.firstChild) target.appendChild(n.firstChild); return; }
    if (!n.childNodes.length) return;
    target.appendChild(n);
  }
  function listInto(list, out, depth, ordered) {
    for (const li of Array.from(list.children)) {
      if (li.tagName === 'UL' || li.tagName === 'OL') { listInto(li, out, depth + 1, li.tagName === 'OL'); continue; }
      if (li.tagName !== 'LI') continue;
      const p = document.createElement('p');
      if (ordered) p.setAttribute('data-ol', String(Math.min(8, depth)));
      else p.setAttribute('data-ul', String(Math.min(4, depth + 1)));
      const nested = [];
      for (const c of Array.from(li.childNodes)) {
        if (c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL')) nested.push(c);
        else if (c.nodeType === 1 && (c.tagName === 'P' || c.tagName === 'DIV')) { if (p.childNodes.length) p.appendChild(document.createElement('br')); inlineChildren(c, p); }
        else inlineInto(c, p);
      }
      trimBr(p);
      if (!p.childNodes.length) p.appendChild(document.createElement('br'));
      out.appendChild(p);
      nested.forEach((n) => listInto(n, out, depth + 1, n.tagName === 'OL'));
    }
  }
  function trimBr(p) {
    while (p.lastChild && p.lastChild.nodeName === 'BR' && p.childNodes.length > 1) p.removeChild(p.lastChild);
  }
  function buildTable(src) {
    const rows = [];
    (function collect(n) {
      for (const c of Array.from(n.children)) {
        if (c.tagName === 'TR') rows.push(c);
        else if (/^(THEAD|TBODY|TFOOT)$/.test(c.tagName)) collect(c);
      }
    })(src);
    if (!rows.length) return null;
    const t = document.createElement('table');
    t.className = 'docs-table';
    const tw = src.style && src.style.width;
    if (tw && /^\d+(\.\d+)?%$/.test(tw) && parseFloat(tw) < 100) t.setAttribute('style', 'width:' + tw);
    const cols = src.querySelectorAll(':scope > colgroup > col, :scope > col');
    const widths = [];
    cols.forEach((c) => {
      const span = parseInt(c.getAttribute('span'), 10) || 1;
      const w = (c.style && c.style.width) || (c.getAttribute('width') ? c.getAttribute('width') + (/%$/.test(c.getAttribute('width')) ? '' : 'px') : '');
      for (let i = 0; i < span; i++) widths.push(w);
    });
    const tb = document.createElement('tbody');
    let maxCols = 0;
    rows.forEach((r) => {
      const tr = document.createElement('tr');
      let n = 0;
      for (const c of Array.from(r.children)) {
        if (c.tagName !== 'TD' && c.tagName !== 'TH') continue;
        const td = document.createElement('td');
        const cs = Math.min(50, parseInt(c.getAttribute('colspan'), 10) || 1);
        const rs = Math.min(200, parseInt(c.getAttribute('rowspan'), 10) || 1);
        if (cs > 1) td.setAttribute('colspan', String(cs));
        if (rs > 1) td.setAttribute('rowspan', String(rs));
        n += cs;
        const extra = [];
        const bg = c.getAttribute('bgcolor');
        if (bg && /^#?[0-9a-z]+$/i.test(bg)) extra.push('background-color:' + bg);
        const va = (c.style && c.style.verticalAlign) || c.getAttribute('valign');
        if (va && /^(top|middle|bottom)$/i.test(va)) extra.push('vertical-align:' + va.toLowerCase());
        const st = pickStyles(c, ['background-color'], extra);
        if (st) td.setAttribute('style', st);
        if (!widths.length) {
          const w = (c.style && c.style.width) || c.getAttribute('width');
          if (w && cs === 1) td.dataset.w = /%|px|pt/.test(w) ? w : w + 'px';
        }
        const align = (c.style && c.style.textAlign) || c.getAttribute('align');
        blockify(c, td, { listDepth: 0 });
        finalizeContainer(td);
        if (c.tagName === 'TH') td.querySelectorAll('p').forEach((p) => { if (!p.querySelector('b')) { const b = document.createElement('b'); while (p.firstChild) b.appendChild(p.firstChild); p.appendChild(b); } });
        if (align && /^(left|center|right|justify)$/i.test(align)) td.querySelectorAll('p,h1,h2,h3').forEach((p) => { if (!p.style.textAlign) p.style.textAlign = align.toLowerCase(); });
        tr.appendChild(td);
      }
      if (!tr.children.length) { const td = document.createElement('td'); td.innerHTML = '<p><br></p>'; tr.appendChild(td); n = 1; }
      maxCols = Math.max(maxCols, n);
      tb.appendChild(tr);
    });
    // 열 너비
    const cg = document.createElement('colgroup');
    let ws = widths.slice(0, maxCols);
    if (ws.length < maxCols) {
      const first = tb.querySelector('tr');
      const fromCells = [];
      if (first) Array.from(first.children).forEach((td) => { const cs = +(td.getAttribute('colspan') || 1); for (let i = 0; i < cs; i++) fromCells.push(cs === 1 ? (td.dataset.w || '') : ''); });
      ws = fromCells.length === maxCols ? fromCells : [];
    }
    tb.querySelectorAll('td[data-w]').forEach((td) => td.removeAttribute('data-w'));
    const px = ws.map((w) => (/px$/.test(w) ? parseFloat(w) : /pt$/.test(w) ? parseFloat(w) * 4 / 3 : 0));
    const pct = ws.map((w) => (/%$/.test(w) ? parseFloat(w) : 0));
    let final;
    if (px.length === maxCols && px.every((v) => v > 0)) { const s = px.reduce((a, b) => a + b, 0); final = px.map((v) => v / s * 100); }
    else if (pct.length === maxCols && pct.every((v) => v > 0)) { const s = pct.reduce((a, b) => a + b, 0); final = pct.map((v) => v / s * 100); }
    else final = new Array(maxCols).fill(100 / Math.max(1, maxCols));
    final.forEach((w) => { const c = document.createElement('col'); c.style.width = (Math.round(w * 100) / 100) + '%'; cg.appendChild(c); });
    t.appendChild(cg);
    t.appendChild(tb);
    return t;
  }
  /* 컨테이너(본문·셀)가 항상 블록을 하나 이상 갖고, 빈 문단에는 <br> */
  function finalizeContainer(box) {
    Array.from(box.querySelectorAll('p,h1,h2,h3')).forEach((p) => {
      trimBr(p);
      if (!p.textContent.replace(/​/g, '').length && !p.querySelector('img,br')) p.appendChild(document.createElement('br'));
    });
    if (!box.firstElementChild) box.appendChild(Object.assign(document.createElement('p'), { innerHTML: '<br>' }));
    // 맨 끝이 표면 뒤에 빈 문단 하나
    if (box.lastElementChild && box.lastElementChild.tagName === 'TABLE') box.appendChild(Object.assign(document.createElement('p'), { innerHTML: '<br>' }));
  }
  function textToHTML(txt) {
    return String(txt || '').replace(/\r/g, '').split('\n').map((ln) => '<p>' + (ln ? esc(ln).replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;').replace(/ {2}/g, ' &nbsp;') : '<br>') + '</p>').join('');
  }

  /* ================= 항목 번호(공문서 항목 기호) ================= */
  const HANGUL_SEQ = '가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도로모보소오조초코토포호구누두루무부수우주추쿠투푸후'.split('');
  const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'.split('');
  const CIRCLED_H = '㉮㉯㉰㉱㉲㉳㉴㉵㉶㉷㉸㉹㉺㉻'.split('');
  const hg = (n) => HANGUL_SEQ[(n - 1) % HANGUL_SEQ.length];
  const OL_FMT = [
    (n) => n + '.',
    (n) => hg(n) + '.',
    (n) => n + ')',
    (n) => hg(n) + ')',
    (n) => '(' + n + ')',
    (n) => '(' + hg(n) + ')',
    (n) => CIRCLED[n - 1] || '(' + n + ')',
    (n) => CIRCLED_H[n - 1] || '(' + hg(n) + ')'
  ];
  const OL_LABEL = ['1.', '가.', '1)', '가)', '(1)', '(가)', '①', '㉮'];
  const UL_SYM = ['□', '○', '-', '·'];

  function renumber(root) {
    const groups = new Map();
    root.querySelectorAll('p[data-ol], p[data-ul], h1, h2, h3').forEach((p) => {
      const box = p.parentElement && p.parentElement.closest('td') ? p.parentElement.closest('td') : root;
      if (!groups.has(box)) groups.set(box, []);
      groups.get(box).push(p);
    });
    root.querySelectorAll('[data-mk]').forEach((p) => { if (!p.hasAttribute('data-ol') && !p.hasAttribute('data-ul')) p.removeAttribute('data-mk'); });
    groups.forEach((list) => {
      const cnt = new Array(10).fill(0);
      list.forEach((p) => {
        if (/^H/.test(p.tagName)) { cnt.fill(0); return; }
        const ol = parseInt(p.getAttribute('data-ol'), 10);
        if (ol >= 1) {
          const lv = Math.min(8, ol);
          cnt[lv]++;
          for (let j = lv + 1; j < cnt.length; j++) cnt[j] = 0;
          const mk = OL_FMT[lv - 1](cnt[lv]);
          if (p.getAttribute('data-mk') !== mk) p.setAttribute('data-mk', mk);
          return;
        }
        const ul = Math.min(4, parseInt(p.getAttribute('data-ul'), 10) || 1);
        const mk = UL_SYM[ul - 1];
        if (p.getAttribute('data-mk') !== mk) p.setAttribute('data-mk', mk);
      });
    });
  }

  /* ================= 서식(템플릿) ================= */
  function tbl(widths, rows, opts) {
    const o = opts || {};
    const cg = '<colgroup>' + widths.map((w) => '<col style="width:' + w + '%">').join('') + '</colgroup>';
    const body = rows.map((r, ri) => '<tr>' + r.map((c) => {
      const cell = typeof c === 'string' ? { t: c } : c;
      const attrs = (cell.cs ? ' colspan="' + cell.cs + '"' : '') + (cell.rs ? ' rowspan="' + cell.rs + '"' : '');
      const bg = cell.bg || (o.head && ri === 0 ? '#f2f2f2' : '');
      const style = bg ? ' style="background-color:' + bg + '"' : '';
      const al = cell.al || (o.head && ri === 0 ? 'center' : o.align || '');
      const inner = cell.b || (o.head && ri === 0) ? '<b>' + cell.t + '</b>' : cell.t;
      return '<td' + attrs + style + '><p' + (al ? ' style="text-align:' + al + '"' : '') + '>' + (cell.t ? inner : '<br>') + '</p></td>';
    }).join('') + '</tr>').join('');
    return '<table class="docs-table">' + cg + '<tbody>' + body + '</tbody></table>';
  }
  const ctr = (html, pt, bold) => '<p style="text-align:center">' + (pt ? '<span style="font-size:' + pt + 'pt">' : '') + (bold ? '<b>' + html + '</b>' : html) + (pt ? '</span>' : '') + '</p>';
  const rgt = (html) => '<p style="text-align:right">' + html + '</p>';
  const P_ = (html, attrs) => '<p' + (attrs || '') + '>' + (html || '<br>') + '</p>';
  const ol = (lv, html) => P_(html, ' data-ol="' + lv + '"');
  const ul = (lv, html) => P_(html, ' data-ul="' + lv + '"');
  const BR = '<p><br></p>';

  function templates() {
    const now = new Date();
    const today = fmtDate(now, true);
    const later = new Date(now.getTime() + 7 * 86400000);
    const next = fmtDate(later, true);
    const yy = now.getFullYear();
    return [
      { id: 'blank', name: '빈 문서', desc: 'A4 빈 쪽에서 시작합니다.', kind: 'blank', html: BR },
      {
        id: 'gian', name: '기안문', desc: '수신·제목·본문·붙임·끝 표시와 결재란을 갖춘 일반 기안문', kind: 'gian',
        page: { mt: 30, mb: 15, ml: 20, mr: 15, size: 12, font: 'hcrb' },
        html:
          ctr('(행정기관명)', 20, true) + BR +
          P_('수신&nbsp;&nbsp;내부결재') +
          P_('(경유)') +
          P_('<b>제목&nbsp;&nbsp;○○○○ 추진 계획 보고</b>') + '<hr>' +
          ol(1, '관련: ○○과-0000(' + fmtDate(now) + ')') +
          ol(1, '위 호와 관련하여 ○○○○을 다음과 같이 추진하고자 합니다.') +
          ol(2, '일시: ' + next + ' 14:00') +
          ol(2, '장소: ○○○ 회의실') +
          ol(2, '대상: ○○○ 등 00명') +
          ol(2, '내용: ○○○○○○') +
          ol(1, '협조하여 주시기 바랍니다.') + BR +
          P_('붙임&nbsp;&nbsp;1. ○○○○ 계획서 1부.') +
          P_('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2. ○○○○ 명단 1부.&nbsp;&nbsp;끝.') + BR + BR +
          ctr('(발신명의)', 18, true) + BR +
          tbl([16, 17, 16, 17, 17, 17], [
            [{ t: '기안자', al: 'center', bg: '#f2f2f2' }, { t: '(직위) 서명', al: 'center' }, { t: '검토자', al: 'center', bg: '#f2f2f2' }, { t: '(직위) 서명', al: 'center' }, { t: '결재권자', al: 'center', bg: '#f2f2f2' }, { t: '(직위) 서명', al: 'center' }],
            [{ t: '협조자', al: 'center', bg: '#f2f2f2' }, { t: '', cs: 5 }]
          ]) +
          P_('시행&nbsp;&nbsp;○○과-0000(' + fmtDate(now) + ')&nbsp;&nbsp;&nbsp;&nbsp;접수&nbsp;&nbsp;') +
          P_('우 00000&nbsp;&nbsp;(주소)&nbsp;&nbsp;/&nbsp;&nbsp;(홈페이지 주소)') +
          P_('전화번호 (000)000-0000&nbsp;&nbsp;전송 (000)000-0000&nbsp;&nbsp;/&nbsp;&nbsp;(이메일)&nbsp;&nbsp;/&nbsp;&nbsp;(공개 구분)')
      },
      {
        id: 'report', name: '보고서(개조식)', desc: '□ ○ - · 기호 체계의 한 장 보고서', kind: 'report',
        page: { font: 'hmj', size: 15, lh: 160 },
        html:
          tbl([100], [[{ t: '<span style="font-size:20pt">○○○○ 추진 상황 보고</span>', al: 'center', b: true, bg: '#dbe5f1' }]]) +
          rgt('<span style="font-size:12pt">' + today + '&nbsp;&nbsp;○○과</span>') +
          ul(1, '<b>개요</b>') +
          ul(2, '(목적) ○○○○을 위해 ○○○○을 추진') +
          ul(2, '(기간) ' + fmtDate(now) + ' ~ ' + fmtDate(later)) +
          ul(2, '(대상) ○○○ 00명') + BR +
          ul(1, '<b>추진 경과</b>') +
          ul(2, '○○○○ 계획 수립(' + fmtDate(now) + ')') +
          ul(3, '주요 내용: ○○○○○○') +
          ul(4, '세부 사항: ○○○○') + BR +
          ul(1, '<b>주요 성과 및 문제점</b>') +
          ul(2, '(성과) ○○○○ 00% 향상') +
          ul(2, '(문제점) ○○○○ 부족') + BR +
          ul(1, '<b>향후 계획</b>') +
          ul(2, '○○○○ 보완 추진(~ ' + fmtDate(later) + ')') + BR +
          P_('<span style="font-size:12pt">※ 참고: ○○○○</span>')
      },
      {
        id: 'plan', name: '계획(안)', desc: '추진 배경·개요·세부 계획·예산·행정 사항', kind: 'plan',
        page: { font: 'hmj', size: 14 },
        html:
          '<h1 style="text-align:center">○○○○ 운영 계획(안)</h1>' +
          rgt('<span style="font-size:12pt">' + today + '&nbsp;&nbsp;○○과</span>') + BR +
          '<h2>Ⅰ. 추진 배경</h2>' +
          ul(2, '○○○○ 환경 변화에 따라 ○○○○ 필요') +
          ul(2, '○○○○ 기본계획(' + yy + ')에 따른 후속 조치') + BR +
          '<h2>Ⅱ. 추진 개요</h2>' +
          ul(2, '기간: ' + fmtDate(now) + ' ~ ' + fmtDate(later)) +
          ul(2, '장소: ○○○ 회의실') +
          ul(2, '대상: ○○○ 등 00명') +
          ul(2, '내용: ○○○○, ○○○○') + BR +
          '<h2>Ⅲ. 세부 추진 계획</h2>' +
          ol(1, '사전 준비') + ol(2, '○○○○ 수요 조사') + ol(2, '○○○○ 대상자 선정') +
          ol(1, '본 행사 운영') + ol(2, '○○○○') + BR +
          tbl([18, 42, 22, 18], [['구분', '내용', '기간', '담당'], ['준비', '○○○○', fmtDate(now) + ' ~', '○○팀'], ['운영', '○○○○', fmtDate(later) + ' ~', '○○팀'], ['평가', '결과 분석 및 보고', '', '○○팀']], { head: true, align: 'center' }) + BR +
          '<h2>Ⅳ. 소요 예산</h2>' +
          rgt('<span style="font-size:11pt">(단위: 천원)</span>') +
          tbl([25, 45, 15, 15], [['항목', '산출 내역', '금액', '비고'], ['운영비', '○○○ × 00명 × 0회', '0,000', ''], ['홍보비', '○○○ 제작', '000', ''], [{ t: '합계', cs: 2, al: 'center', b: true }, { t: '0,000', al: 'right', b: true }, '']], { head: true }) + BR +
          '<h2>Ⅴ. 행정 사항</h2>' +
          ul(2, '관련 부서는 ○○○○에 적극 협조') +
          ul(2, '추진 결과는 ' + fmtDate(later) + '까지 보고') + BR +
          P_('붙임&nbsp;&nbsp;○○○○ 세부 일정 1부.')
      },
      {
        id: 'result', name: '결과보고', desc: '추진 결과·성과·개선 사항과 사진 칸', kind: 'result',
        page: { font: 'hmj', size: 14 },
        html:
          tbl([100], [[{ t: '<span style="font-size:20pt">○○○○ 결과 보고</span>', al: 'center', b: true, bg: '#e2efda' }]]) +
          rgt('<span style="font-size:12pt">' + today + '&nbsp;&nbsp;○○과</span>') +
          ul(1, '<b>추진 개요</b>') +
          ul(2, '(일시) ' + today + ' 10:00 ~ 12:00') +
          ul(2, '(장소) ○○○ 회의실') +
          ul(2, '(참석) ○○○ 등 00명') + BR +
          ul(1, '<b>추진 결과</b>') +
          ul(2, '○○○○ 완료(목표 대비 000%)') +
          ul(3, '○○○○ 00건, ○○○○ 00명 참여') + BR +
          ul(1, '<b>성과 및 개선 사항</b>') +
          ul(2, '(성과) ○○○○') +
          ul(2, '(개선) ○○○○ → ○○○○로 보완') + BR +
          ul(1, '<b>향후 계획</b>') +
          ul(2, '○○○○ 확대 시행(' + fmtDate(later) + ')') + BR +
          tbl([50, 50], [[{ t: '(사진 1)', al: 'center' }, { t: '(사진 2)', al: 'center' }], [{ t: '사진 설명', al: 'center' }, { t: '사진 설명', al: 'center' }]])
      },
      {
        id: 'minutes', name: '회의록', desc: '회의 정보표·안건·논의·결정·조치 사항', kind: 'minutes',
        page: { font: 'mg', size: 11 },
        html:
          ctr('회 의 록', 22, true) + BR +
          tbl([18, 32, 18, 32], [
            [{ t: '회의명', b: true, bg: '#f2f2f2', al: 'center' }, { t: '○○○○ 회의', cs: 3 }],
            [{ t: '일시', b: true, bg: '#f2f2f2', al: 'center' }, today + ' 14:00', { t: '장소', b: true, bg: '#f2f2f2', al: 'center' }, '○○○ 회의실'],
            [{ t: '참석자', b: true, bg: '#f2f2f2', al: 'center' }, { t: '○○○, ○○○, ○○○ (총 00명)', cs: 3 }],
            [{ t: '작성자', b: true, bg: '#f2f2f2', al: 'center' }, '○○과 ○○○', { t: '안건', b: true, bg: '#f2f2f2', al: 'center' }, '○○○○ 논의']
          ]) + BR +
          '<h2>1. 논의 내용</h2>' +
          ul(2, '(○○○) ○○○○ 의견 제시') +
          ul(2, '(○○○) ○○○○ 필요성 언급') + BR +
          '<h2>2. 결정 사항</h2>' +
          ul(2, '○○○○ 추진하기로 함') + BR +
          '<h2>3. 향후 조치</h2>' +
          tbl([50, 25, 25], [['조치 사항', '담당', '기한'], ['○○○○ 계획 수립', '○○팀', fmtDate(later)], ['○○○○ 결과 공유', '○○팀', fmtDate(later)]], { head: true, align: 'center' })
      },
      {
        id: 'press', name: '보도자료', desc: '배포 일시·담당자 표, 제목·부제, 본문', kind: 'press',
        page: { font: 'mg', size: 12, lh: 170 },
        html:
          tbl([22, 28, 22, 28], [
            [{ t: '<span style="font-size:18pt">보도자료</span>', b: true, cs: 2, rs: 2, al: 'center', bg: '#dbe5f1' }, { t: '배포 일시', b: true, al: 'center', bg: '#f2f2f2' }, today + ' 10:00'],
            [{ t: '보도 일시', b: true, al: 'center', bg: '#f2f2f2' }, '배포 즉시'],
            [{ t: '담당 부서', b: true, al: 'center', bg: '#f2f2f2' }, '○○과', { t: '담당자', b: true, al: 'center', bg: '#f2f2f2' }, '○○○ (000-0000-0000)']
          ]) + BR +
          ctr('○○○○, ○○○○ 본격 추진', 20, true) +
          ctr('- ○○○○ 대상 00명, ' + fmtDate(later) + '부터 -') +
          ctr('- ○○○○ 통해 ○○○○ 기대 -') + BR +
          P_('□ ○○○○(기관명)은 ' + fmtDate(later) + '부터 ○○○○을 추진한다고 밝혔다.') + BR +
          P_('□ 이번 사업은 ○○○○을 위해 마련되었으며, ○○○○ 등 00명을 대상으로 진행된다.') + BR +
          P_('□ ○○○ ○○○○장은 "○○○○○○"라고 말했다.') + BR +
          P_('붙임&nbsp;&nbsp;1. ○○○○ 사진 1부.')
      }
    ];
  }

  /* ================= 목록 화면 ================= */
  function plainText(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function newDocData(tpl, title) {
    const now = new Date().toISOString();
    const html = sanitizeHTML(tpl ? tpl.html : BR);
    return {
      title: title || (tpl && tpl.id !== 'blank' ? tpl.name.replace(/\(.*\)/, '') + ' ' + fmtDate(new Date()) : '제목 없는 문서'),
      html,
      page: pageOf(tpl && tpl.page),
      kind: (tpl && tpl.kind) || 'blank',
      preview: plainText(html).slice(0, 140),
      chars: plainText(html).length,
      createdAt: now
    };
  }
  async function createDoc(ctx, tpl, title, folder) {
    const id = P.store.uid();
    const data = newDocData(tpl, title);
    data.folder = folder || null;
    await P.store.put(COL, id, data);
    ctx.navigate(APP_ID + '/' + encodeURIComponent(id));
  }

  function kindName(tpls, kind) {
    const t = tpls.find((x) => x.kind === kind && x.id !== 'blank');
    return t ? t.name.replace(/\(.*\)/, '') : '일반';
  }
  /* 목록에서 내보내기: 화면 밖에 본문을 그려 편집기와 같은 변환기를 씀 */
  async function withOffscreenBody(data, fn) {
    const pg = pageOf(data.page);
    const d = pageDims(pg);
    const f = FONT_BY_KEY.get(pg.font) || FONTS[0];
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;left:-30000px;top:0;width:' + mm2px(d.w) + 'px;height:10px;overflow:visible;visibility:hidden;pointer-events:none;';
    const body = document.createElement('div');
    body.className = 'docs-body docs-paper-text';
    body.style.cssText = 'left:0;top:0;width:' + (mm2px(d.w) - mm2px(pg.ml) - mm2px(pg.mr)) + 'px;font-family:' + f.css.replace(/"/g, "'") + ';font-size:' + pg.size + 'pt;line-height:' + (pg.lh / 100) + ';';
    body.innerHTML = sanitizeHTML(data.html || BR);
    host.appendChild(body);
    document.body.appendChild(host);
    try {
      renumber(body);
      await Promise.all(Array.from(body.querySelectorAll('img')).map((im) => (im.complete ? null : im.decode().catch(() => null))));
      return await fn(body, pg);
    } finally { host.remove(); }
  }
  const DOC_FORMATS = [
    { id: 'hwpx', label: '한글 문서', ext: 'HWPX', desc: '한글 2014 이상에서 열기', icon: P.files.icons.doc },
    { id: 'docx', label: '워드 문서', ext: 'DOCX', desc: 'MS Word·한컴오피스·구글 문서', icon: P.files.icons.doc },
    { id: 'pdf', label: 'PDF · 인쇄', ext: 'PDF', desc: '인쇄 창에서 "PDF로 저장" 선택', icon: P.files.icons.print },
    { id: 'html', label: '웹 문서', ext: 'HTML', desc: '메일 본문·게시판 붙여넣기용', icon: P.files.icons.code },
    { id: 'txt', label: '텍스트', ext: 'TXT', desc: '서식 없이 글자만', icon: P.files.icons.text }
  ];
  async function docFile(row, fmt) {
    const data = row.data || {};
    const name = safeName(data.title);
    return withOffscreenBody(data, async (body, pg) => {
      if (fmt === 'txt') return { name: name + '.txt', data: exportTXT(body), mime: 'text/plain' };
      if (fmt === 'html') return { name: name + '.html', data: exportHTMLDoc(body, pg, name), mime: 'text/html' };
      if (fmt === 'hwpx') return { name: name + '.hwpx', blob: await exportHWPX(body, pg, name) };
      return { name: name + '.docx', blob: await exportDOCX(body, pg, name) };
    });
  }
  function mountList(root, ctx) {
    const tpls = templates();
    const folder = ctx.params[0] === 'f' ? ctx.params[1] || null : null;
    const tplHTML = '<div class="docs-tpl-row">' +
      tpls.map((t) => '<button type="button" class="docs-tpl" data-tpl="' + t.id + '" title="' + esc(t.desc) + '"><span class="docs-tpl-thumb docs-thumb-' + t.id + '" aria-hidden="true">' + thumbLines(t.id) + '</span><b>' + esc(t.name) + '</b></button>').join('') + '</div>';
    const fb = P.files.browser(root, {
      col: COL, kind: APP_ID, folder,
      title: '문서', itemName: '문서', newLabel: '새 문서', mineLabel: '내 문서', searchHint: '제목·내용 검색',
      pageClass: 'docs-list', itemClass: 'docs-card', newAttrs: { 'data-act': 'new' },
      templates: { title: '서식', html: tplHTML, cls: 'docs-tpls' },
      onTemplate: (id, f) => createDoc(ctx, tpls.find((x) => x.id === id), null, f),
      newItem: (f) => createDoc(ctx, tpls[0], null, f),
      icon: () => '<span class="docs-glyph"></span>',
      badge: (it) => '<span class="badge">' + esc(kindName(tpls, it.data.kind)) + '</span>',
      meta: (it) => [(it.data.pages || 1) + '쪽', String(it.data.preview || '').slice(0, 80)].filter(Boolean).join(' · '),
      thumb: (it) => '<span class="docs-a4" aria-hidden="true"><span class="docs-a4-t">' + esc(it.data.title || '') + '</span><span class="docs-a4-p">' + esc(String(it.data.preview || '').slice(0, 220)) + '</span></span>',
      empty: { slot: 'empty-docs', title: '아직 문서가 없습니다', desc: '위 서식에서 고르거나 빈 문서로 시작하세요. HWPX·DOCX 파일은 가져오기로 엽니다.' },
      io: {
        attrs: { import: { 'data-act': 'import' } },
        importers: [{ id: 'doc', label: '문서 파일', ext: 'HWPX · DOCX · TXT · HTML', accept: '.hwpx,.docx,.txt,.html,.htm,.md,.hwp,.doc', multiple: true, run: (files, c) => importFiles(ctx, files, c.folder) }],
        exporters: DOC_FORMATS.map((x) => (x.id === 'pdf'
          ? Object.assign({}, x, { single: true, run: (rows) => { ctx.navigate(APP_ID + '/' + encodeURIComponent(rows[0].id) + '/print'); } })
          : Object.assign({}, x, { file: (row) => docFile(row, x.id) })))
      }
    });
    return () => fb.destroy();
  }
  function thumbLines(id) {
    const L = (w, cls) => '<i class="' + (cls || '') + '" style="width:' + w + '%"></i>';
    const map = {
      blank: '',
      gian: L(50, 'c b') + L(30) + L(70, 'b') + L(90) + L(80, 'in') + L(75, 'in') + L(60) + L(40, 'c b'),
      report: L(100, 'box') + L(35, 'r') + L(40, 'b') + L(85, 'in') + L(80, 'in') + L(40, 'b') + L(75, 'in'),
      plan: L(60, 'c b') + L(30, 'r') + L(40, 'b') + L(85, 'in') + L(40, 'b') + L(100, 'tb'),
      result: L(100, 'box g') + L(35, 'r') + L(40, 'b') + L(80, 'in') + L(70, 'in') + L(100, 'tb2'),
      minutes: L(40, 'c b') + L(100, 'tb') + L(40, 'b') + L(80, 'in') + L(40, 'b') + L(75, 'in'),
      press: L(100, 'tb') + L(70, 'c b') + L(55, 'c') + L(95) + L(90) + L(85)
    };
    return map[id] || '';
  }

  /* ================= 표 격자 계산 · 편집 ================= */
  function newCell(bg) {
    const td = document.createElement('td');
    td.innerHTML = '<p><br></p>';
    if (bg) td.style.backgroundColor = bg;
    return td;
  }
  function tableGrid(table) {
    const trs = Array.from(table.rows);
    const grid = [];
    const pos = new Map();
    trs.forEach((tr, r) => {
      grid[r] = grid[r] || [];
      let c = 0;
      Array.from(tr.cells).forEach((td) => {
        while (grid[r][c]) c++;
        const rs = Math.max(1, Math.min(td.rowSpan || 1, trs.length - r));
        const cs = Math.max(1, td.colSpan || 1);
        for (let i = 0; i < rs; i++) {
          grid[r + i] = grid[r + i] || [];
          for (let j = 0; j < cs; j++) grid[r + i][c + j] = td;
        }
        pos.set(td, { r, c, rs, cs });
        c += cs;
      });
    });
    const cols = grid.reduce((m, g) => Math.max(m, g ? g.length : 0), 0);
    for (let r = 0; r < trs.length; r++) { grid[r] = grid[r] || []; for (let c = 0; c < cols; c++) if (!grid[r][c]) grid[r][c] = null; }
    return { grid, pos, rows: trs.length, cols, trs };
  }
  function insertCellAt(table, r, c, td) {
    const G = tableGrid(table);
    const tr = G.trs[r];
    let ref = null;
    for (const x of Array.from(tr.cells)) { if (G.pos.get(x).c > c) { ref = x; break; } }
    tr.insertBefore(td, ref);
  }
  function colWidths(table) {
    const G = tableGrid(table);
    const cols = Array.from(table.querySelectorAll(':scope > colgroup > col'));
    if (cols.length === G.cols) {
      const ws = cols.map((c) => parseFloat(c.style.width) || 0);
      if (ws.every((w) => w > 0)) return ws;
    }
    // 측정해서 만든다
    const ws = new Array(G.cols).fill(0);
    for (let c = 0; c < G.cols; c++) {
      for (let r = 0; r < G.rows; r++) { const td = G.grid[r][c]; if (td && G.pos.get(td).cs === 1) { ws[c] = td.offsetWidth; break; } }
    }
    const known = ws.filter((w) => w > 0);
    const avg = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 1;
    const filled = ws.map((w) => w || avg);
    const sum = filled.reduce((a, b) => a + b, 0) || 1;
    return filled.map((w) => w / sum * 100);
  }
  function setColWidths(table, ws) {
    let cg = table.querySelector(':scope > colgroup');
    if (!cg) { cg = document.createElement('colgroup'); table.insertBefore(cg, table.firstChild); }
    const sum = ws.reduce((a, b) => a + b, 0) || 1;
    cg.innerHTML = ws.map((w) => '<col style="width:' + (Math.round(w / sum * 10000) / 100) + '%">').join('');
  }
  function tblInsertRow(table, cell, below) {
    const G = tableGrid(table);
    const p = G.pos.get(cell);
    const idx = below ? p.r + p.rs : p.r;
    const tr = document.createElement('tr');
    for (let c = 0; c < G.cols;) {
      const cur = idx < G.rows ? G.grid[idx][c] : null;
      const above = idx > 0 ? G.grid[idx - 1][c] : null;
      if (cur && above && cur === above) { cur.rowSpan = G.pos.get(cur).rs + 1; c += G.pos.get(cur).cs; continue; }
      const ref = above || cur;
      tr.appendChild(newCell(ref && ref.style.backgroundColor && idx > 0 && G.pos.get(ref).r !== 0 ? ref.style.backgroundColor : ''));
      c++;
    }
    if (idx < G.rows) G.trs[idx].before(tr); else G.trs[G.rows - 1].after(tr);
    return tr;
  }
  function tblInsertCol(table, cell, right) {
    const ws = colWidths(table);
    const G = tableGrid(table);
    const p = G.pos.get(cell);
    const idx = right ? p.c + p.cs : p.c;
    for (let r = 0; r < G.rows; r++) {
      const cur = idx < G.cols ? G.grid[r][idx] : null;
      const left = idx > 0 ? G.grid[r][idx - 1] : null;
      if (cur && left && cur === left) { if (G.pos.get(cur).r === r) cur.colSpan = G.pos.get(cur).cs + 1; continue; }
      insertCellAt(table, r, idx - 0.5, newCell());
    }
    const base = right ? p.c + p.cs - 1 : p.c;
    const half = ws[base] / 2;
    ws[base] = half;
    ws.splice(idx, 0, half);
    setColWidths(table, ws);
  }
  function tblDeleteRow(table, cell) {
    const G = tableGrid(table);
    const r = G.pos.get(cell).r;
    if (G.rows <= 1) { return 'table'; }
    const seen = new Set();
    for (let c = 0; c < G.cols; c++) {
      const td = G.grid[r][c];
      if (!td || seen.has(td)) continue;
      seen.add(td);
      const pp = G.pos.get(td);
      if (pp.rs > 1) {
        td.rowSpan = pp.rs - 1;
        if (pp.r === r) {
          const next = G.trs[r + 1];
          let ref = null;
          for (const x of Array.from(next.cells)) { if (G.pos.get(x).c > pp.c) { ref = x; break; } }
          next.insertBefore(td, ref);
        }
      }
    }
    G.trs[r].remove();
    return 'ok';
  }
  function tblDeleteCol(table, cell) {
    const ws = colWidths(table);
    const G = tableGrid(table);
    const c = G.pos.get(cell).c;
    if (G.cols <= 1) return 'table';
    const seen = new Set();
    for (let r = 0; r < G.rows; r++) {
      const td = G.grid[r][c];
      if (!td || seen.has(td)) continue;
      seen.add(td);
      const pp = G.pos.get(td);
      if (pp.cs > 1) td.colSpan = pp.cs - 1; else td.remove();
    }
    ws.splice(c, 1);
    setColWidths(table, ws);
    cleanupRows(table);
    return 'ok';
  }
  function cleanupRows(table) {
    for (let guard = 0; guard < 500; guard++) {
      const trs = Array.from(table.rows);
      const i = trs.findIndex((tr) => !tr.cells.length);
      if (i < 0) break;
      const G = tableGrid(table);
      const seen = new Set();
      for (let c = 0; c < G.cols; c++) {
        const td = G.grid[i][c];
        if (td && !seen.has(td)) { seen.add(td); if (td.rowSpan > 1) td.rowSpan = td.rowSpan - 1; }
      }
      trs[i].remove();
    }
    table.querySelectorAll('td[rowspan="1"]').forEach((td) => td.removeAttribute('rowspan'));
    table.querySelectorAll('td[colspan="1"]').forEach((td) => td.removeAttribute('colspan'));
  }
  function rectOf(G, a, b) {
    const pa = G.pos.get(a), pb = G.pos.get(b);
    let r1 = Math.min(pa.r, pb.r), r2 = Math.max(pa.r + pa.rs - 1, pb.r + pb.rs - 1);
    let c1 = Math.min(pa.c, pb.c), c2 = Math.max(pa.c + pa.cs - 1, pb.c + pb.cs - 1);
    // 걸친 셀을 모두 포함할 때까지 넓힌다
    for (let changed = true, guard = 0; changed && guard < 50; guard++) {
      changed = false;
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
        const td = G.grid[r] && G.grid[r][c];
        if (!td) continue;
        const p = G.pos.get(td);
        if (p.r < r1) { r1 = p.r; changed = true; }
        if (p.c < c1) { c1 = p.c; changed = true; }
        if (p.r + p.rs - 1 > r2) { r2 = p.r + p.rs - 1; changed = true; }
        if (p.c + p.cs - 1 > c2) { c2 = p.c + p.cs - 1; changed = true; }
      }
    }
    return { r1, r2, c1, c2 };
  }
  function cellsIn(G, rc) {
    const out = [];
    for (let r = rc.r1; r <= rc.r2; r++) for (let c = rc.c1; c <= rc.c2; c++) {
      const td = G.grid[r] && G.grid[r][c];
      if (td && !out.includes(td)) out.push(td);
    }
    return out;
  }
  function tblMerge(table, rc) {
    const G = tableGrid(table);
    const list = cellsIn(G, rc);
    if (list.length < 2) return false;
    const master = G.grid[rc.r1][rc.c1];
    list.forEach((td) => {
      if (td === master) return;
      const hasText = td.textContent.trim() || td.querySelector('img');
      if (hasText) {
        if (!master.textContent.trim() && !master.querySelector('img')) master.innerHTML = '';
        while (td.firstChild) master.appendChild(td.firstChild);
      }
      td.remove();
    });
    master.rowSpan = rc.r2 - rc.r1 + 1;
    master.colSpan = rc.c2 - rc.c1 + 1;
    if (!master.firstElementChild) master.innerHTML = '<p><br></p>';
    cleanupRows(table);
    return master;
  }
  function tblSplit(table, cell) {
    const G = tableGrid(table);
    const p = G.pos.get(cell);
    if (p.rs === 1 && p.cs === 1) return false;
    cell.removeAttribute('rowspan');
    cell.removeAttribute('colspan');
    for (let r = p.r; r < p.r + p.rs; r++) for (let c = p.c; c < p.c + p.cs; c++) {
      if (r === p.r && c === p.c) continue;
      insertCellAt(table, r, c - 0.5, newCell(cell.style.backgroundColor));
    }
    return true;
  }
  function makeTable(rows, cols) {
    let h = '<table class="docs-table"><colgroup>';
    for (let c = 0; c < cols; c++) h += '<col style="width:' + (Math.round(10000 / cols) / 100) + '%">';
    h += '</colgroup><tbody>';
    for (let r = 0; r < rows; r++) {
      h += '<tr>';
      for (let c = 0; c < cols; c++) h += '<td><p><br></p></td>';
      h += '</tr>';
    }
    return h + '</tbody></table>';
  }

  /* ================= 편집 화면 ================= */
  const BLOCK_SEL = 'p,h1,h2,h3';
  const TOP_OK = /^(P|H1|H2|H3|TABLE|HR)$/;
  const MOD = isMac() ? '⌘' : 'Ctrl';

  function tb(cmd, icon, label, key) {
    return '<button type="button" class="docs-tb" data-cmd="' + cmd + '" data-hint="' + esc(label) + '"' + (key ? ' data-key="' + esc(key) + '"' : '') + ' aria-label="' + esc(label) + (key ? ' (' + esc(key) + ')' : '') + '">' + icon + '</button>';
  }
  function tbm(cmd, icon, label, text) {
    return '<button type="button" class="docs-tb docs-tb-menu" data-menu="' + cmd + '" data-hint="' + esc(label) + '" aria-label="' + esc(label) + '" aria-haspopup="menu">' + icon + (text ? '<span class="docs-tb-txt">' + esc(text) + '</span>' : '') + '<svg class="docs-caret" viewBox="0 0 10 10" width="8" height="8" aria-hidden="true"><path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button>';
  }

  async function mountEditor(root, ctx, id) {
    root.innerHTML = '<div class="page"><div class="empty">문서를 여는 중…</div></div>';
    let data = null;
    try { data = await P.store.get(COL, id); } catch (e) { data = null; }
    if (!root.isConnected) return;
    if (!data) {
      root.innerHTML = '<div class="page"><div class="empty card"><h2>문서를 찾을 수 없습니다</h2><p>삭제되었거나 다른 저장 위치에 있는 문서입니다.</p><a class="btn btn-primary" href="#/docs">문서 목록으로</a></div></div>';
      return;
    }
    const pg = pageOf(data.page);
    const kind = data.kind || 'blank';
    const offs = [];
    const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); offs.push(() => t.removeEventListener(ev, fn, opt)); };

    root.innerHTML =
      '<div class="docs-editor">' +
      '<div class="docs-top">' +
      '<a class="btn btn-ghost docs-icon docs-back" href="' + P.files.backHref(APP_ID, data.folder) + '" title="문서 목록" aria-label="문서 목록">' + I.back + '<span class="docs-back-lbl">목록</span></a>' +
      '<input class="docs-title" type="text" aria-label="문서 제목" maxlength="120">' +
      '<span class="docs-save" role="status" aria-live="polite"></span>' +
      '<span class="docs-top-sp"></span>' +
      '<button type="button" class="btn btn-ghost docs-icon" data-cmd="find" title="찾기·바꾸기 (' + MOD + '+F)" aria-label="찾기·바꾸기">' + I.find + '</button>' +
      '<button type="button" class="btn btn-sm docs-check-btn" data-cmd="check" title="공문서 점검">' + I.check + '<span>점검</span></button>' +
      '<span class="docs-io"></span>' +
      '<button type="button" class="btn btn-ghost docs-icon" data-menu="more" title="더 보기" aria-label="더 보기" aria-haspopup="menu">' + I.more + '</button>' +
      '</div>' +
      '<div class="docs-ribbon" role="toolbar" aria-label="서식 도구">' +
      '<div class="docs-grp">' + tb('undo', I.undo, '실행 취소', MOD + '+Z') + tb('redo', I.redo, '다시 실행', MOD + '+Y') + '</div>' +
      '<div class="docs-grp"><select class="docs-sel docs-sel-style" data-sel="style" aria-label="문단 종류" title="문단 종류"><option value="p">본문</option><option value="h1">제목 1</option><option value="h2">제목 2</option><option value="h3">제목 3</option></select>' +
      '<select class="docs-sel docs-sel-font" data-sel="font" aria-label="글꼴" title="글꼴"><option value="">글꼴</option>' + FONTS.map((f) => '<option value="' + f.k + '">' + esc(f.label) + '</option>').join('') + '</select>' +
      '<input class="docs-sel docs-sel-size" data-sel="size" list="docs-sizes" inputmode="decimal" aria-label="글자 크기(pt)" title="글자 크기(pt)">' +
      '<datalist id="docs-sizes">' + SIZES.map((s) => '<option value="' + s + '">').join('') + '</datalist></div>' +
      '<div class="docs-grp">' + tb('bold', I.bold, '굵게', MOD + '+B') + tb('italic', I.italic, '기울임', MOD + '+I') + tb('underline', I.underline, '밑줄', MOD + '+U') + tb('strike', I.strike, '취소선') +
      tb('sup', I.sup, '위 첨자') + tb('sub', I.sub, '아래 첨자') + tbm('color', I.color, '글자 색') + tbm('hilite', I.marker, '형광펜') + tb('clear', I.clear, '글자 모양 지우기') + '</div>' +
      '<div class="docs-grp">' + tb('align-left', I.left, '왼쪽 정렬', MOD + '+Shift+L') + tb('align-center', I.center, '가운데 정렬', MOD + '+Shift+E') + tb('align-right', I.right, '오른쪽 정렬', MOD + '+Shift+R') + tb('align-justify', I.justify, '양쪽 정렬', MOD + '+Shift+J') +
      tbm('lineh', I.lineh, '줄 간격') + tb('outdent', I.outdent, '수준 올림', 'Shift+Tab') + tb('indent', I.indent, '수준 내림', 'Tab') + '</div>' +
      '<div class="docs-grp">' + tbm('ol', I.ol, '항목 번호 1. 가. 1)', '') + tbm('ul', I.ul, '보고서 기호 □ ○ -', '') + '</div>' +
      '<div class="docs-grp">' + tbm('table', I.table, '표 넣기') + tb('image', I.image, '그림 넣기') + tb('pagebreak', I.pagebreak, '쪽 나누기', MOD + '+Enter') + tb('hr', I.hr, '가로선') +
      tbm('symbol', I.symbol, '특수 문자') + tbm('date', I.date, '날짜·시간 넣기') + tb('won', I.won, '금액 표기 넣기') + '</div>' +
      '</div>' +
      '<div class="docs-tblbar" role="toolbar" aria-label="표 도구" hidden><b class="docs-tblbar-t">표</b>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-tcmd="row-above">위에 줄</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-tcmd="row-below">아래에 줄</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-tcmd="col-left">왼쪽 칸</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-tcmd="col-right">오른쪽 칸</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-tcmd="row-del">줄 지우기</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-tcmd="col-del">칸 지우기</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-tcmd="merge" title="셀을 끌어서 여러 칸을 고른 뒤 누르세요">' + I.merge + '셀 합치기</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-tcmd="split">' + I.split + '셀 나누기</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-tmenu="cellbg">' + I.fill + '셀 배경</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-tcmd="equal">칸 너비 같게</button>' +
      '<button type="button" class="btn btn-sm btn-ghost docs-danger" data-tcmd="table-del">표 지우기</button>' +
      '</div>' +
      '<div class="docs-main">' +
      '<div class="docs-desk" tabindex="-1"><div class="docs-scaler"><div class="docs-pages">' +
      '<div class="docs-bg" aria-hidden="true"></div>' +
      '<div class="docs-body docs-paper-text" contenteditable="true" spellcheck="false" role="textbox" aria-multiline="true" aria-label="문서 본문"></div>' +
      '<span class="docs-imgh" hidden></span>' +
      '</div></div>' +
      '<div class="docs-imgbar" hidden role="toolbar" aria-label="그림 도구">' +
      '<button type="button" class="btn btn-sm btn-ghost" data-icmd="25">25%</button><button type="button" class="btn btn-sm btn-ghost" data-icmd="50">50%</button><button type="button" class="btn btn-sm btn-ghost" data-icmd="75">75%</button><button type="button" class="btn btn-sm btn-ghost" data-icmd="100">100%</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-icmd="left" aria-label="왼쪽">' + I.left + '</button><button type="button" class="btn btn-sm btn-ghost" data-icmd="center" aria-label="가운데">' + I.center + '</button><button type="button" class="btn btn-sm btn-ghost" data-icmd="right" aria-label="오른쪽">' + I.right + '</button>' +
      '<button type="button" class="btn btn-sm btn-ghost docs-danger" data-icmd="del" aria-label="그림 지우기">' + P.icons.trash + '</button></div>' +
      '</div>' +
      '<div class="docs-findbar" hidden role="search">' +
      '<div class="docs-find-row"><input type="search" class="docs-find-q" placeholder="찾을 내용" aria-label="찾을 내용"><span class="docs-find-n">0/0</span>' +
      '<button type="button" class="btn btn-sm btn-ghost docs-icon" data-fcmd="prev" aria-label="이전">' + I.up + '</button><button type="button" class="btn btn-sm btn-ghost docs-icon" data-fcmd="next" aria-label="다음">' + I.down + '</button>' +
      '<button type="button" class="btn btn-sm btn-ghost docs-icon" data-fcmd="close" aria-label="닫기">' + I.close + '</button></div>' +
      '<div class="docs-find-row"><input type="text" class="docs-find-r" placeholder="바꿀 내용" aria-label="바꿀 내용">' +
      '<button type="button" class="btn btn-sm" data-fcmd="one">바꾸기</button><button type="button" class="btn btn-sm" data-fcmd="all">모두</button></div>' +
      '<label class="docs-find-opt"><input type="checkbox" class="docs-find-case"> 대소문자 구분</label></div>' +
      '<aside class="docs-side" hidden aria-label="보조 창"><div class="docs-side-head"><div class="seg docs-side-tabs"><button type="button" data-side="outline">개요</button><button type="button" data-side="check">점검</button></div>' +
      '<button type="button" class="btn btn-ghost btn-sm docs-icon" data-side="close" aria-label="닫기">' + I.close + '</button></div><div class="docs-side-body"></div></aside>' +
      '</div>' +
      '<div class="docs-status"><span class="docs-st-page num">1 / 1쪽</span><button type="button" class="docs-st-btn docs-st-chars num" data-cmd="count" title="글자 수 자세히"></button><span class="docs-top-sp"></span>' +
      '<button type="button" class="docs-st-btn docs-st-outline" data-cmd="outline" aria-pressed="false" title="개요">' + I.outline + '<span>개요</span></button>' +
      '<button type="button" class="docs-st-btn" data-cmd="page" title="쪽 설정 (여백·머리말·쪽 번호)" aria-label="쪽 설정">' + I.page + '<span>쪽 설정</span></button>' +
      '<label class="docs-st-zoom">' + I.zoom + '<span class="sr-only">배율</span><select class="docs-zoom" aria-label="배율"><option value="fit">쪽 맞춤</option><option value="text">글자 폭 맞춤</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option><option value="2">200%</option></select></label></div>' +
      '</div>';

    root.style.height = '100%';
    const $ = (s) => root.querySelector(s);
    const body = $('.docs-body');
    const pagesEl = $('.docs-pages');
    const bgEl = $('.docs-bg');
    const scaler = $('.docs-scaler');
    const desk = $('.docs-desk');
    const ribbon = $('.docs-ribbon');
    const tblbar = $('.docs-tblbar');
    const titleInp = $('.docs-title');
    const saveEl = $('.docs-save');
    const side = $('.docs-side');
    const findbar = $('.docs-findbar');
    const imgbar = $('.docs-imgbar');
    const imgh = $('.docs-imgh');
    const zoomSel = $('.docs-zoom');

    titleInp.value = data.title || '';
    body.innerHTML = sanitizeHTML(data.html || BR);
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); document.execCommand('styleWithCSS', false, true); } catch (e) { /* 무시 */ }

    /* ----- 선택 영역 도구 ----- */
    let lastRange = null;
    function getRange() {
      const s = window.getSelection();
      if (!s || !s.rangeCount) return null;
      const r = s.getRangeAt(0);
      return body.contains(r.commonAncestorContainer) ? r : null;
    }
    function setRange(r) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
    function placeCaret(node, atEnd) {
      if (!node) return;
      const r = document.createRange();
      r.selectNodeContents(node);
      r.collapse(!atEnd);
      setRange(r);
    }
    function ensureSel() {
      let r = getRange();
      if (r) return r;
      if (document.activeElement !== body) body.focus({ preventScroll: true });
      if (lastRange && body.contains(lastRange.startContainer) && body.contains(lastRange.endContainer)) { setRange(lastRange); return getRange(); }
      placeCaret(body.lastElementChild || body, true);
      return getRange();
    }
    function blockOf(node) {
      while (node && node !== body) { if (node.nodeType === 1 && /^(P|H1|H2|H3)$/.test(node.tagName)) return node; node = node.parentNode; }
      return null;
    }
    function topOf(node) {
      while (node && node.parentNode && node.parentNode !== body) node = node.parentNode;
      return node && node.parentNode === body ? node : null;
    }
    function isEmptyBlock(b) { return !b.textContent.replace(/​/g, '').length && !b.querySelector('img'); }
    function selectedBlocks() {
      if (cellSel) return cellSel.cells.flatMap((td) => Array.from(td.querySelectorAll(BLOCK_SEL)));
      const r = ensureSel();
      if (!r) return [];
      if (r.collapsed) { const b = blockOf(r.startContainer); return b ? [b] : []; }
      let list = Array.from(body.querySelectorAll(BLOCK_SEL)).filter((b) => r.intersectsNode(b));
      if (list.length > 1) {
        const last = list[list.length - 1];
        const rr = document.createRange();
        rr.setStart(last, 0);
        try { rr.setEnd(r.endContainer, r.endOffset); if (!rr.toString() && !rr.cloneContents().querySelector('img')) list = list.slice(0, -1); } catch (e) { /* 무시 */ }
      }
      if (!list.length) { const b = blockOf(r.startContainer); if (b) list = [b]; }
      return list;
    }
    function pathOf(node) {
      const p = [];
      while (node && node !== body) {
        const par = node.parentNode;
        if (!par) return null;
        p.unshift(Array.prototype.indexOf.call(par.childNodes, node));
        node = par;
      }
      return node === body ? p : null;
    }
    function nodeAt(path) {
      let n = body;
      for (const i of path) { if (!n.childNodes[i]) return null; n = n.childNodes[i]; }
      return n;
    }
    const maxOff = (n) => (n.nodeType === 3 ? n.length : n.childNodes.length);
    function saveSel() {
      const r = getRange();
      if (!r) return null;
      const s = pathOf(r.startContainer), e = pathOf(r.endContainer);
      return s && e ? { s, so: r.startOffset, e, eo: r.endOffset } : null;
    }
    function restoreSel(sel) {
      if (!sel) return;
      const a = nodeAt(sel.s), b = nodeAt(sel.e);
      if (!a || !b) return;
      const r = document.createRange();
      try { r.setStart(a, Math.min(sel.so, maxOff(a))); r.setEnd(b, Math.min(sel.eo, maxOff(b))); } catch (e) { return; }
      setRange(r);
    }
    function textPos(node, off) {
      const rr = document.createRange();
      rr.setStart(body, 0);
      try { rr.setEnd(node, off); } catch (e) { return 0; }
      return rr.toString().length;
    }
    function locateText(pos) {
      const w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      let n, acc = 0, last = null;
      while ((n = w.nextNode())) {
        if (acc + n.length >= pos) return [n, pos - acc];
        acc += n.length;
        last = n;
      }
      return last ? [last, last.length] : [body, 0];
    }
    function saveSelText() {
      const r = getRange();
      return r ? { s: textPos(r.startContainer, r.startOffset), e: textPos(r.endContainer, r.endOffset) } : null;
    }
    function restoreSelText(o) {
      if (!o) return;
      const a = locateText(o.s), b = locateText(o.e);
      const r = document.createRange();
      try { r.setStart(a[0], a[1]); r.setEnd(b[0], b[1]); setRange(r); } catch (e) { /* 무시 */ }
    }

    /* ----- 본문 정리 ----- */
    function cleanHTML() {
      const c = body.cloneNode(true);
      c.querySelectorAll('[data-pg]').forEach((e) => { e.removeAttribute('data-pg'); e.style.removeProperty('--pg'); });
      c.querySelectorAll('.docs-cell-sel,.docs-img-sel').forEach((e) => e.classList.remove('docs-cell-sel', 'docs-img-sel'));
      c.querySelectorAll('[data-mk]').forEach((e) => e.removeAttribute('data-mk'));
      c.querySelectorAll('[class=""]').forEach((e) => e.removeAttribute('class'));
      c.querySelectorAll('[style=""]').forEach((e) => e.removeAttribute('style'));
      return c.innerHTML;
    }
    function scrub() {
      body.querySelectorAll('script,style,iframe,object,embed,form,input,button,textarea,select,link,meta').forEach((n) => n.remove());
      body.querySelectorAll('*').forEach((n) => {
        for (const a of Array.from(n.attributes)) {
          if (/^on/i.test(a.name) || ((a.name === 'href' || a.name === 'src') && /^\s*(javascript|vbscript):/i.test(a.value))) n.removeAttribute(a.name);
        }
      });
    }
    function normalizeTop() {
      let need = !body.firstElementChild;
      for (const n of Array.from(body.childNodes)) {
        if (n.nodeType === 3 ? /\S/.test(n.nodeValue) : n.nodeType === 1 && !TOP_OK.test(n.tagName)) { need = true; break; }
      }
      if (!need) return;
      const s = saveSelText();
      let cur = null;
      for (const n of Array.from(body.childNodes)) {
        if (n.nodeType === 1 && n.tagName === 'DIV') {
          const p = document.createElement('p');
          for (const a of Array.from(n.attributes)) p.setAttribute(a.name, a.value);
          while (n.firstChild) p.appendChild(n.firstChild);
          n.replaceWith(p);
          cur = null;
          continue;
        }
        if (n.nodeType === 1 && TOP_OK.test(n.tagName)) { cur = null; continue; }
        if (n.nodeType === 3 && !/\S/.test(n.nodeValue) && !cur) { n.remove(); continue; }
        if (n.nodeType !== 1 && n.nodeType !== 3) { n.remove(); continue; }
        if (!cur) { cur = document.createElement('p'); n.before(cur); }
        cur.appendChild(n);
      }
      if (!body.firstElementChild) body.innerHTML = '<p><br></p>';
      body.querySelectorAll(':scope > p, :scope > h1, :scope > h2, :scope > h3').forEach((p) => { if (!p.firstChild) p.appendChild(document.createElement('br')); });
      if (s) restoreSelText(s); else placeCaret(body.firstElementChild, false);
    }

    /* ----- 실행 취소 ----- */
    const hist = { stack: [], idx: -1 };
    function histRecord() {
      const html = cleanHTML();
      const sel = saveSel();
      const top = hist.stack[hist.idx];
      if (top && top.html === html) { if (sel) top.sel = sel; return; }
      hist.stack = hist.stack.slice(0, hist.idx + 1);
      hist.stack.push({ html, sel, page: JSON.stringify(pg) });
      if (hist.stack.length > 150) hist.stack.shift();
      hist.idx = hist.stack.length - 1;
      updateHistBtns();
    }
    function histApply(st) {
      body.innerHTML = st.html;
      try { Object.assign(pg, JSON.parse(st.page)); } catch (e) { /* 무시 */ }
      clearCellSel();
      selectImg(null);
      body.focus({ preventScroll: true });
      if (st.sel) restoreSel(st.sel); else placeCaret(body.firstElementChild, false);
      changed({ noHist: true, relayout: true });
      updateHistBtns();
    }
    function undo() {
      clearTimeout(histTimer);
      histRecord();
      if (hist.idx > 0) { hist.idx--; histApply(hist.stack[hist.idx]); }
    }
    function redo() {
      clearTimeout(histTimer);
      if (hist.idx < hist.stack.length - 1) { hist.idx++; histApply(hist.stack[hist.idx]); }
    }
    function updateHistBtns() {
      const u = ribbon.querySelector('[data-cmd="undo"]'), r = ribbon.querySelector('[data-cmd="redo"]');
      if (u) u.disabled = hist.idx <= 0 && !dirtySinceRecord;
      if (r) r.disabled = hist.idx >= hist.stack.length - 1;
    }
    let histTimer = null;
    let dirtySinceRecord = false;

    /* ----- 저장 ----- */
    let dirty = false;
    let saveTimer = null;
    let saveChain = Promise.resolve();
    let saveState = 'saved';
    function setSave(st) {
      saveState = st;
      saveEl.dataset.state = st;
      saveEl.textContent = st === 'saving' ? '저장 중…' : st === 'pending' ? '고치는 중' : st === 'error' ? '저장 실패 · 다시 시도' : '저장됨';
      saveEl.title = st === 'error' ? '눌러서 다시 저장' : '';
    }
    function markDirty() {
      dirty = true;
      setSave('pending');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveNow, 1000);
    }
    function snapshot() {
      const text = body.innerText || '';
      const html = cleanHTML();
      return Object.assign({}, data, {
        title: titleInp.value.trim() || '제목 없는 문서',
        html,
        page: clone(pg),
        kind,
        preview: text.replace(/\s+/g, ' ').trim().slice(0, 140),
        chars: text.replace(/\n/g, '').length,
        pages: pageCount
      });
    }
    function saveNow() {
      clearTimeout(saveTimer);
      if (!dirty) return saveChain;
      dirty = false;
      const snap = snapshot();
      setSave('saving');
      saveChain = saveChain.then(() => P.store.put(COL, id, snap)).then(() => {
        data = snap;
        if (!dirty) setSave('saved');
      }, () => { dirty = true; setSave('error'); });
      return saveChain;
    }
    saveEl.addEventListener('click', () => { if (saveState === 'error') { dirty = true; saveNow(); } });

    /* ----- 쪽 배치 ----- */
    let geo = null;
    let pageCount = 1;
    let scale = 1;
    let layoutTimer = null;
    let zoom = P.settings.get('docs.zoom', window.innerWidth < 600 ? 'text' : 'fit');
    zoomSel.value = String(zoom);
    function computeGeo() {
      const d = pageDims(pg);
      const W = mm2px(d.w), H = mm2px(d.h);
      const mt = mm2px(pg.mt), mb = mm2px(pg.mb), ml = mm2px(pg.ml), mr = mm2px(pg.mr);
      geo = { W, H, mt, mb, ml, mr, cw: W - ml - mr, ch: H - mt - mb, stride: H + PAGE_GAP };
      pagesEl.style.width = W + 'px';
      body.style.left = ml + 'px';
      body.style.top = mt + 'px';
      body.style.width = geo.cw + 'px';
      const f = FONT_BY_KEY.get(pg.font) || FONTS[0];
      body.style.fontFamily = f.css;
      body.style.fontSize = pg.size + 'pt';
      body.style.lineHeight = String(pg.lh / 100);
    }
    function clearPush(e) { e.removeAttribute('data-pg'); e.style.removeProperty('--pg'); if (!e.getAttribute('style')) e.removeAttribute('style'); }
    function setPush(e, px) { e.setAttribute('data-pg', ''); e.style.setProperty('--pg', Math.max(0, px) + 'px'); }
    function paginate() {
      if (!geo) computeGeo();
      const { stride, ch } = geo;
      body.querySelectorAll(':scope > [data-pg]').forEach(clearPush);
      let lastPage = 0;
      let force = false;
      let any = false;
      for (const child of Array.from(body.children)) {
        if (child.tagName === 'HR' && child.classList.contains('docs-pagebreak')) { force = true; continue; }
        let top = child.offsetTop;
        const h = child.offsetHeight;
        const k = Math.floor(top / stride);
        const inPage = top - k * stride;
        let target = null;
        if (force) {
          if (!(any && k > lastPage && inPage <= 0.5)) target = (Math.max(k, lastPage) + 1) * stride;
        } else if (inPage > ch - 0.5) target = (k + 1) * stride;
        else if (inPage + h > ch + 0.5 && inPage > 0.5 && h <= ch) target = (k + 1) * stride;
        force = false;
        if (target != null) {
          const m0 = parseFloat(getComputedStyle(child).marginTop) || 0;
          setPush(child, target - top + m0);
          let nt = child.offsetTop;
          if (Math.abs(nt - target) > 0.5) { setPush(child, target - top + m0 + (target - nt)); nt = child.offsetTop; }
          top = nt;
        }
        any = true;
        lastPage = Math.max(lastPage, Math.floor(Math.max(0, top + h - 1) / stride));
      }
      const n = Math.max(1, lastPage + 1 + (force ? 1 : 0));
      body.style.minHeight = ((n - 1) * stride + ch) + 'px';
      if (n !== pageCount || !bgEl.firstChild) { pageCount = n; drawPages(); }
      pagesEl.style.height = (n * stride - PAGE_GAP) + 'px';
      applyScale();
      positionImgTools();
      updateStatus();
    }
    function pageNumText(i, total) {
      const f = pg.pageNum.fmt;
      return f === 'plain' ? String(i) : f === 'total' ? i + ' / ' + total : '- ' + i + ' -';
    }
    function drawPages() {
      const { W, H, mt, mb, ml, mr, stride } = geo;
      const slot = (txt, al) => ({ left: al === 'left' ? txt : '', center: al === 'center' ? txt : '', right: al === 'right' ? txt : '' });
      let h = '';
      for (let i = 0; i < pageCount; i++) {
        const top = slot(pg.header.text, pg.header.align);
        const bot = slot(pg.footer.text, pg.footer.align);
        const pn = pageNumText(i + 1, pageCount);
        const pos = pg.pageNum.pos;
        if (pos === 'bottom-center') bot.center = (bot.center ? bot.center + '  ' : '') + pn;
        else if (pos === 'bottom-right') bot.right = (bot.right ? bot.right + '  ' : '') + pn;
        else if (pos === 'top-right') top.right = (top.right ? top.right + '  ' : '') + pn;
        const line = (s, cls, y) => '<div class="docs-hf ' + cls + '" style="left:' + ml + 'px;right:' + mr + 'px;' + y + '"><span>' + esc(s.left) + '</span><span>' + esc(s.center) + '</span><span>' + esc(s.right) + '</span></div>';
        h += '<div class="docs-sheet" style="top:' + (i * stride) + 'px;width:' + W + 'px;height:' + H + 'px">' +
          '<i class="docs-crn" style="left:' + ml + 'px;top:' + mt + 'px;right:' + mr + 'px;bottom:' + mb + 'px"></i>' +
          line(top, 'docs-hdr', 'top:' + Math.max(6, mt / 2 - 8) + 'px') +
          line(bot, 'docs-ftr', 'bottom:' + Math.max(6, mb / 2 - 8) + 'px') +
          '</div>';
      }
      bgEl.innerHTML = h;
    }
    function applyScale() {
      const pad = desk.clientWidth < 600 ? 16 : 48;
      const fit = Math.min(1, Math.max(0.2, (desk.clientWidth - pad) / geo.W));
      const prev = scale;
      scale = zoom === 'fit' ? fit : zoom === 'text' ? Math.min(1.5, Math.max(0.2, (desk.clientWidth - 12) / geo.cw)) : (+zoom || 1);
      const totalH = pageCount * geo.stride - PAGE_GAP;
      scaler.style.width = (geo.W * scale) + 'px';
      scaler.style.height = (totalH * scale) + 'px';
      pagesEl.style.transform = scale === 1 ? '' : 'scale(' + scale + ')';
      if (zoom === 'text' && (prev !== scale || !desk.scrollLeft)) desk.scrollLeft = Math.max(0, geo.ml * scale - 6);
    }
    function relayout() { computeGeo(); drawPages(); paginate(); }
    function schedulePaginate() {
      if (layoutTimer) return;
      layoutTimer = requestAnimationFrame(() => { layoutTimer = null; paginate(); });
    }

    /* ----- 변경 처리 ----- */
    function changed(opt) {
      const o = opt || {};
      renumber(body);
      if (o.relayout) relayout(); else schedulePaginate();
      markDirty();
      if (!o.noHist) { clearTimeout(histTimer); histRecord(); dirtySinceRecord = false; }
      updateState();
      scheduleCount();
    }
    function cmdWrap(fn) {
      ensureSel();
      clearTimeout(histTimer);
      histRecord();
      const res = fn();
      changed();
      return res;
    }

    /* ----- 글자 모양 ----- */
    let pendingSize = null;
    function fixSizeSpans(pt) {
      body.querySelectorAll('font[size="7"]').forEach((f) => {
        const s = document.createElement('span');
        s.style.fontSize = pt + 'pt';
        while (f.firstChild) s.appendChild(f.firstChild);
        f.replaceWith(s);
      });
      body.querySelectorAll('span[style*="xxx-large"]').forEach((s) => { s.style.fontSize = pt + 'pt'; });
    }
    function applySize(pt) {
      pt = Math.max(1, Math.min(200, Math.round(parseFloat(pt) * 2) / 2));
      if (!pt) return;
      cmdWrap(() => {
        const r = getRange();
        if (r && r.collapsed) {
          const b = blockOf(r.startContainer);
          if (b && isEmptyBlock(b)) { b.style.fontSize = pt + 'pt'; return; }
          pendingSize = pt;
        }
        document.execCommand('fontSize', false, '7');
        fixSizeSpans(pt);
      });
    }
    function applyFont(k) {
      const f = FONT_BY_KEY.get(k);
      if (!f) return;
      cmdWrap(() => document.execCommand('fontName', false, f.css));
    }
    function setBlockTag(tag) {
      cmdWrap(() => {
        const s = saveSel();
        selectedBlocks().forEach((b) => {
          if (b.tagName.toLowerCase() === tag) return;
          const n = document.createElement(tag);
          for (const a of Array.from(b.attributes)) if (tag === 'p' || !/^data-(ol|ul|mk)$/.test(a.name)) n.setAttribute(a.name, a.value);
          while (b.firstChild) n.appendChild(b.firstChild);
          b.replaceWith(n);
        });
        restoreSel(s);
      });
    }
    function setAlign(al) {
      cmdWrap(() => selectedBlocks().forEach((b) => { if (al === 'justify') b.style.removeProperty('text-align'); else b.style.textAlign = al; if (!b.getAttribute('style')) b.removeAttribute('style'); }));
    }
    function setLineHeight(v) {
      cmdWrap(() => selectedBlocks().forEach((b) => { if (+v === pg.lh) b.style.removeProperty('line-height'); else b.style.lineHeight = String(v / 100); if (!b.getAttribute('style')) b.removeAttribute('style'); }));
    }
    function indent(delta) {
      cmdWrap(() => selectedBlocks().forEach((b) => {
        const o = parseInt(b.getAttribute('data-ol'), 10), u = parseInt(b.getAttribute('data-ul'), 10);
        if (o) b.setAttribute('data-ol', String(Math.max(1, Math.min(8, o + delta))));
        else if (u) b.setAttribute('data-ul', String(Math.max(1, Math.min(4, u + delta))));
        else {
          const cur = parseFloat(b.style.marginLeft) || 0;
          const nv = Math.max(0, cur + delta * 20);
          if (nv) b.style.marginLeft = nv + 'px'; else b.style.removeProperty('margin-left');
          if (!b.getAttribute('style')) b.removeAttribute('style');
        }
      }));
    }
    function setList(type, lv) {
      cmdWrap(() => {
        const s = saveSel();
        selectedBlocks().forEach((b) => {
          if (/^H/.test(b.tagName)) {
            const n = document.createElement('p');
            for (const a of Array.from(b.attributes)) n.setAttribute(a.name, a.value);
            while (b.firstChild) n.appendChild(b.firstChild);
            b.replaceWith(n);
            b = n;
          }
          b.removeAttribute('data-ol');
          b.removeAttribute('data-ul');
          b.removeAttribute('data-mk');
          if (type && lv) b.setAttribute('data-' + type, String(lv));
        });
        restoreSel(s);
      });
    }

    /* ----- 삽입 ----- */
    function currentTop() {
      const r = ensureSel();
      return r ? topOf(r.startContainer) || body.lastElementChild : body.lastElementChild;
    }
    function insertBlockAfter(node) {
      const top = currentTop();
      if (top && /^(P|H1|H2|H3)$/.test(top.tagName) && isEmptyBlock(top)) top.replaceWith(node);
      else if (top) top.after(node);
      else body.appendChild(node);
      let next = node.nextElementSibling;
      if (!next || !/^(P|H1|H2|H3)$/.test(next.tagName)) { next = document.createElement('p'); next.innerHTML = '<br>'; node.after(next); }
      return next;
    }
    function insertTable(rows, cols) {
      cmdWrap(() => {
        const w = document.createElement('div');
        w.innerHTML = makeTable(rows, cols);
        const t = w.firstElementChild;
        insertBlockAfter(t);
        placeCaret(t.querySelector('td p'), false);
      });
    }
    function insertPageBreak() {
      cmdWrap(() => {
        const hr = pageBreakEl();
        const next = insertBlockAfter(hr);
        placeCaret(next, false);
      });
    }
    function insertHr() {
      cmdWrap(() => { const next = insertBlockAfter(document.createElement('hr')); placeCaret(next, false); });
    }
    function insertText(t) {
      ensureSel();
      document.execCommand('insertText', false, t);
    }
    async function prepImage(file) {
      const url = await readAs(file, 'url');
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('그림을 읽지 못했습니다.')); i.src = url; });
      let src = url;
      let w = img.naturalWidth, h = img.naturalHeight;
      const MAX = 1600;
      if (w > MAX || file.size > 700 * 1024) {
        const k = Math.min(1, MAX / w);
        const cv = document.createElement('canvas');
        cv.width = Math.round(w * k); cv.height = Math.round(h * k);
        const g = cv.getContext('2d');
        const png = /png|gif/.test(file.type) && file.size < 1500 * 1024;
        if (!png) { g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); }
        g.drawImage(img, 0, 0, cv.width, cv.height);
        src = png ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.86);
        w = cv.width; h = cv.height;
      }
      return { src, w, h };
    }
    async function insertImages(files, at) {
      const list = files.filter((f) => /^image\//.test(f.type));
      if (!list.length) return;
      if (list.some((f) => f.size > 15 * 1024 * 1024)) { P.ui.toast('15MB가 넘는 그림은 넣을 수 없습니다.', 'warn'); return; }
      let made;
      try { made = await Promise.all(list.map(prepImage)); } catch (e) { P.ui.toast(e.message, 'error'); return; }
      if (at) setRange(at);
      cmdWrap(() => {
        const r = ensureSel();
        const host = blockOf(r.startContainer);
        const boxW = host ? host.clientWidth : geo.cw;
        made.forEach((m) => {
          const img = document.createElement('img');
          img.src = m.src;
          img.alt = '';
          const pct = Math.min(100, Math.round(m.w / (boxW || geo.cw) * 100));
          img.style.width = pct + '%';
          const rr = getRange() || r;
          rr.deleteContents();
          rr.insertNode(img);
          rr.setStartAfter(img);
          rr.collapse(true);
          setRange(rr);
        });
        normalizeTop();
      });
      body.querySelectorAll('img').forEach((i) => { if (!i.complete) i.addEventListener('load', schedulePaginate, { once: true }); });
    }
    function insertHTMLAtCaret(html) {
      const r = ensureSel();
      const inCell = r && r.startContainer.parentNode && (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentNode).closest('td');
      if (inCell && /<table/i.test(html)) {
        const w = document.createElement('div');
        w.innerHTML = html;
        w.querySelectorAll('table').forEach((t) => {
          const frag = document.createDocumentFragment();
          Array.from(t.rows).forEach((tr) => { const p = document.createElement('p'); p.textContent = Array.from(tr.cells).map((c) => c.textContent.trim()).join('  '); frag.appendChild(p); });
          t.replaceWith(frag);
        });
        html = w.innerHTML;
      }
      clearTimeout(histTimer);
      histRecord();
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const blocks = Array.from(tmp.children);
      if (!inCell && (blocks.length > 1 || blocks.some((n) => !/^P$/.test(n.tagName)))) {
        // 여러 문단·표: 현재 문단 뒤에 문단 단위로 넣는다(앞 문단과 섞이지 않게)
        const top = currentTop();
        const frag = document.createDocumentFragment();
        blocks.forEach((n) => frag.appendChild(n));
        const last = frag.lastChild;
        if (top && /^(P|H1|H2|H3)$/.test(top.tagName) && isEmptyBlock(top)) top.replaceWith(frag);
        else if (top) top.after(frag);
        else body.appendChild(frag);
        if (last.tagName === 'TABLE' && (!last.nextElementSibling || last.nextElementSibling.tagName === 'TABLE')) last.after(Object.assign(document.createElement('p'), { innerHTML: '<br>' }));
        placeCaret(last.tagName === 'TABLE' ? last.nextElementSibling : last, true);
      } else {
        document.execCommand('insertHTML', false, blocks.length === 1 ? blocks[0].innerHTML : html);
      }
      scrub();
      normalizeTop();
      fixSizeSpans(pg.size);
      changed();
    }

    /* ----- 금액·날짜 ----- */
    async function insertWon() {
      const saved = saveSel();
      const v = await askText('금액(숫자만, 예: 1250000)', '');
      if (v == null) return;
      const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
      if (!n) { P.ui.toast('숫자를 입력해 주세요.', 'warn'); return; }
      body.focus({ preventScroll: true });
      restoreSel(saved);
      insertText('금' + withComma(n) + '원(금' + wonToHangul(n) + '원)');
    }

    /* ----- 메뉴(팝오버) ----- */
    let menuClose = null;
    function openMenu(anchor, content, onPick) {
      if (menuClose) { const same = menuClose.anchor === anchor; menuClose(); if (same) return; }
      const pop = el('div', 'p-pop docs-pop');
      pop.setAttribute('role', 'menu');
      if (typeof content === 'string') pop.innerHTML = content; else pop.appendChild(content);
      document.body.appendChild(pop);
      const ar = anchor.getBoundingClientRect();
      const pw = pop.offsetWidth, ph = pop.offsetHeight;
      let left = Math.min(ar.left, window.innerWidth - pw - 8);
      let top = ar.bottom + 4;
      if (top + ph > window.innerHeight - 8) top = Math.max(8, ar.top - ph - 4);
      pop.style.left = Math.max(8, left) + 'px';
      pop.style.top = top + 'px';
      anchor.setAttribute('aria-expanded', 'true');
      const close = () => {
        pop.remove();
        anchor.setAttribute('aria-expanded', 'false');
        document.removeEventListener('mousedown', outside, true);
        document.removeEventListener('keydown', esc_, true);
        if (menuClose === close) menuClose = null;
      };
      close.anchor = anchor;
      const outside = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) close(); };
      const esc_ = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); anchor.focus(); } };
      document.addEventListener('mousedown', outside, true);
      document.addEventListener('keydown', esc_, true);
      pop.addEventListener('mousedown', (e) => { if (!e.target.closest('input,select,textarea')) e.preventDefault(); });
      pop.addEventListener('click', (e) => {
        const it = e.target.closest('[data-v]');
        if (!it) return;
        close();
        onPick(it.dataset.v, it);
      });
      menuClose = close;
      const first = pop.querySelector('[data-v], input');
      if (first && !('ontouchstart' in window)) setTimeout(() => { try { first.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } }, 0);
      return pop;
    }
    function swatches(list, none) {
      return '<div class="docs-sw">' + (none ? '<button type="button" class="docs-sw-none" data-v="none">' + esc(none) + '</button>' : '') +
        list.map((c) => '<button type="button" class="docs-swc" data-v="' + c + '" style="background:' + c + '" title="' + c + '" aria-label="' + c + '"></button>').join('') + '</div>';
    }
    function menuItems(items) {
      return items.map((it) => it === '-' ? '<div class="docs-pop-sep"></div>' : '<button type="button" class="p-pop-item docs-pop-item" role="menuitem" data-v="' + esc(it.v) + '">' + (it.ic || '') + '<span class="p-pop-txt"><b>' + esc(it.t) + '</b>' + (it.s ? '<small>' + esc(it.s) + '</small>' : '') + '</span></button>').join('');
    }
    function openRibbonMenu(name, anchor) {
      if (name === 'color') {
        const pop = openMenu(anchor, '<div class="p-pop-title">글자 색</div>' + swatches(COLORS, '기본 색') + '<label class="docs-pop-custom">직접 고르기 <input type="color" value="#1f4e9e"></label>', (v) => {
          cmdWrap(() => document.execCommand('foreColor', false, v === 'none' ? '#000000' : v));
        });
        const ci = pop.querySelector('input[type=color]');
        const sel = saveSel();
        ci.addEventListener('change', () => { menuClose && menuClose(); body.focus({ preventScroll: true }); restoreSel(sel); cmdWrap(() => document.execCommand('foreColor', false, ci.value)); });
      } else if (name === 'hilite') {
        openMenu(anchor, '<div class="p-pop-title">형광펜</div>' + swatches(HILITES, '없음'), (v) => {
          cmdWrap(() => document.execCommand('hiliteColor', false, v === 'none' ? 'transparent' : v));
        });
      } else if (name === 'lineh') {
        openMenu(anchor, '<div class="p-pop-title">줄 간격</div>' + menuItems(LINE_HEIGHTS.map((v) => ({ v: String(v), t: v + '%' + (v === pg.lh ? ' (문서 기본)' : '') }))), (v) => setLineHeight(+v));
      } else if (name === 'ol') {
        openMenu(anchor, '<div class="p-pop-title">공문서 항목 번호</div>' + menuItems([{ v: '0', t: '번호 없음' }].concat(OL_LABEL.map((l, i) => ({ v: String(i + 1), t: l, s: (i + 1) + '수준' + (i === 0 ? ' · Tab/Shift+Tab으로 수준 변경' : '') })))), (v) => setList(+v ? 'ol' : null, +v));
      } else if (name === 'ul') {
        openMenu(anchor, '<div class="p-pop-title">보고서 기호</div>' + menuItems([{ v: '0', t: '기호 없음' }].concat(UL_SYM.map((s, i) => ({ v: String(i + 1), t: s, s: (i + 1) + '수준' })))), (v) => setList(+v ? 'ul' : null, +v));
      } else if (name === 'table') {
        const box = el('div', 'docs-tgrid-wrap');
        box.innerHTML = '<div class="p-pop-title docs-tgrid-label">표 만들기</div><div class="docs-tgrid">' + Array.from({ length: 64 }, (_, i) => '<button type="button" data-v="' + (Math.floor(i / 8) + 1) + 'x' + (i % 8 + 1) + '" aria-label="' + (Math.floor(i / 8) + 1) + '줄 ' + (i % 8 + 1) + '칸"></button>').join('') + '</div><button type="button" class="btn btn-sm btn-ghost docs-tgrid-more" data-v="custom">줄·칸 수 직접 입력…</button>';
        const lab = box.querySelector('.docs-tgrid-label');
        box.addEventListener('mouseover', (e) => {
          const b = e.target.closest('.docs-tgrid [data-v]');
          if (!b) return;
          const [r, c] = b.dataset.v.split('x').map(Number);
          lab.textContent = r + '줄 × ' + c + '칸';
          box.querySelectorAll('.docs-tgrid button').forEach((x) => { const [rr, cc] = x.dataset.v.split('x').map(Number); x.classList.toggle('on', rr <= r && cc <= c); });
        });
        const sel = saveSel();
        openMenu(anchor, box, async (v) => {
          if (v === 'custom') {
            const s = await askText('줄 수 × 칸 수 (예: 5x4)', '3x3');
            const m = s && s.match(/(\d+)\s*[x×*,\s]\s*(\d+)/i);
            if (!m) return;
            body.focus({ preventScroll: true });
            restoreSel(sel);
            insertTable(Math.min(100, +m[1]), Math.min(20, +m[2]));
          } else { const [r, c] = v.split('x').map(Number); insertTable(r, c); }
        });
      } else if (name === 'symbol') {
        openMenu(anchor, '<div class="p-pop-title">특수 문자</div><div class="docs-sym">' + SYMBOLS.map((s) => '<button type="button" data-v="' + esc(s) + '">' + esc(s) + '</button>').join('') + '</div>', (v) => insertText(v));
      } else if (name === 'date') {
        const d = new Date();
        const hh = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        openMenu(anchor, menuItems([
          { v: fmtDate(d), t: fmtDate(d), s: '공문서 날짜' },
          { v: fmtDate(d, true), t: fmtDate(d, true), s: '요일 포함' },
          { v: fmtDate(d, true) + ' ' + hh, t: fmtDate(d, true) + ' ' + hh, s: '날짜와 시각' },
          { v: d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일', t: d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일', s: '문장용' }
        ]), (v) => insertText(v));
      }
    }
    function openTopMenu(name, anchor) {
      if (name === 'more') {
        openMenu(anchor, menuItems([
          { v: 'print', t: '인쇄', s: MOD + '+P', ic: '<span class="p-pop-ic">' + I.print + '</span>' },
          { v: 'page', t: '쪽 설정', s: '용지·여백·머리말·쪽 번호', ic: '<span class="p-pop-ic">' + I.page + '</span>' },
          { v: 'find', t: '찾기·바꾸기', s: MOD + '+F / ' + MOD + '+H', ic: '<span class="p-pop-ic">' + I.find + '</span>' },
          { v: 'count', t: '글자 수 세기', ic: '<span class="p-pop-ic">' + I.count + '</span>' },
          { v: 'import', t: '파일 내용 끼워 넣기', s: 'DOCX·HWPX·HTML·TXT', ic: '<span class="p-pop-ic">' + P.icons.upload + '</span>' },
          { v: 'dup', t: '사본 만들기', ic: '<span class="p-pop-ic">' + I.copy + '</span>' },
          { v: 'help', t: '단축키 도움말', ic: '<span class="p-pop-ic">' + I.help + '</span>' }
        ]), (v) => runCmd(v));
      }
    }

    /* ----- 명령 실행 ----- */
    function runCmd(cmd) {
      switch (cmd) {
        case 'undo': return undo();
        case 'redo': return redo();
        case 'bold': case 'italic': case 'underline':
          return cmdWrap(() => document.execCommand(cmd));
        case 'strike': return cmdWrap(() => document.execCommand('strikeThrough'));
        case 'sup': return cmdWrap(() => document.execCommand('superscript'));
        case 'sub': return cmdWrap(() => document.execCommand('subscript'));
        case 'clear': return cmdWrap(() => { document.execCommand('removeFormat'); document.execCommand('unlink'); });
        case 'align-left': return setAlign('left');
        case 'align-center': return setAlign('center');
        case 'align-right': return setAlign('right');
        case 'align-justify': return setAlign('justify');
        case 'indent': return indent(1);
        case 'outdent': return indent(-1);
        case 'image': return pickFile('image/*', true).then((f) => insertImages(f));
        case 'pagebreak': return insertPageBreak();
        case 'hr': return insertHr();
        case 'won': return insertWon();
        case 'find': return openFind(false);
        case 'replace': return openFind(true);
        case 'check': return openSide('check');
        case 'outline': return (!side.hidden && side.querySelector('[data-side="outline"]').getAttribute('aria-pressed') === 'true') ? closeSide() : openSide('outline');
        case 'page': return openPageSetup();
        case 'count': return openCount();
        case 'print': return doExport('pdf');
        case 'help': return openHelp();
        case 'import': return importInto();
        case 'dup': return duplicate();
        default: return null;
      }
    }
    ribbon.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    tblbar.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    imgbar.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    root.querySelector('.docs-status').addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cmd],[data-menu]');
      if (!b || !root.contains(b) || b.closest('.docs-pop')) return;
      if (b.dataset.menu) {
        if (b.dataset.menu === 'export') return; // 공통 내보내기 단추가 처리
        if (b.dataset.menu === 'more') openTopMenu(b.dataset.menu, b);
        else openRibbonMenu(b.dataset.menu, b);
      } else runCmd(b.dataset.cmd);
    });
    ribbon.addEventListener('change', (e) => {
      const s = e.target.closest('[data-sel]');
      if (!s) return;
      body.focus({ preventScroll: true });
      if (lastRange) setRange(lastRange);
      if (s.dataset.sel === 'style') setBlockTag(s.value);
      else if (s.dataset.sel === 'font') applyFont(s.value);
      else if (s.dataset.sel === 'size') applySize(s.value);
    });
    ribbon.querySelector('[data-sel="size"]').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); e.target.dispatchEvent(new Event('change', { bubbles: true })); }
    });

    /* ----- 상태 표시 ----- */
    let stateRaf = null;
    function updateState() {
      if (stateRaf) return;
      stateRaf = requestAnimationFrame(() => {
        stateRaf = null;
        const r = getRange();
        const first = Array.from(body.querySelectorAll(BLOCK_SEL)).find((b) => !b.closest('td')) || body.querySelector(BLOCK_SEL);
        const node = r ? (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement) : first && (first.firstElementChild || first);
        if (!node) return;
        const b = blockOf(node);
        const cs = node && node.nodeType === 1 ? getComputedStyle(node) : null;
        const styleSel = ribbon.querySelector('[data-sel="style"]');
        if (b && document.activeElement !== styleSel) styleSel.value = /^H[123]$/.test(b.tagName) ? b.tagName.toLowerCase() : 'p';
        const fontSel = ribbon.querySelector('[data-sel="font"]');
        const sizeInp = ribbon.querySelector('[data-sel="size"]');
        if (cs) {
          const fam = (cs.fontFamily.split(',')[0] || '').replace(/["']/g, '').trim();
          const f = FONTS.find((x) => x.label === fam || x.css.split(',')[0].replace(/["']/g, '').trim() === fam);
          if (document.activeElement !== fontSel) fontSel.value = f ? f.k : '';
          if (document.activeElement !== sizeInp) sizeInp.value = String(Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2);
        }
        ['bold', 'italic', 'underline', 'strikeThrough', 'superscript', 'subscript'].forEach((c, i) => {
          const btn = ribbon.querySelector('[data-cmd="' + ['bold', 'italic', 'underline', 'strike', 'sup', 'sub'][i] + '"]');
          let st = false;
          try { st = document.queryCommandState(c); } catch (e) { /* 무시 */ }
          btn.classList.toggle('on', !!st);
          btn.setAttribute('aria-pressed', st ? 'true' : 'false');
        });
        const al = b ? getComputedStyle(b).textAlign : '';
        ['left', 'center', 'right', 'justify'].forEach((a) => {
          const btn = ribbon.querySelector('[data-cmd="align-' + a + '"]');
          const on = al === a || (a === 'left' && al === 'start');
          btn.classList.toggle('on', on);
          btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        ribbon.querySelector('[data-menu="ol"]').classList.toggle('on', !!(b && b.hasAttribute('data-ol')));
        ribbon.querySelector('[data-menu="ul"]').classList.toggle('on', !!(b && b.hasAttribute('data-ul')));
        const inTable = (!!r && !!(node && node.closest && node.closest('td'))) || !!cellSel;
        if (tblbar.hidden === inTable) { tblbar.hidden = !inTable; }
        updateStatus();
      });
    }
    function caretPage() {
      const r = getRange();
      if (!r || !geo) return 1;
      const top = topOf(r.startContainer);
      if (!top) return 1;
      return Math.min(pageCount, Math.floor(top.offsetTop / geo.stride) + 1);
    }
    function updateStatus() {
      $('.docs-st-page').textContent = caretPage() + ' / ' + pageCount + '쪽';
    }
    let countTimer = null;
    function scheduleCount() {
      clearTimeout(countTimer);
      countTimer = setTimeout(() => {
        const t = body.innerText || '';
        $('.docs-st-chars').textContent = '글자 ' + withComma(t.replace(/\n/g, '').length) + ' (공백 제외 ' + withComma(t.replace(/\s/g, '').length) + ')';
      }, 300);
    }

    /* ----- 표: 셀 선택 · 너비 조절 ----- */
    let cellSel = null;
    let cellAnchor = null;
    let colDrag = null;
    function clearCellSel() {
      if (!cellSel) return;
      cellSel.cells.forEach((td) => td.classList.remove('docs-cell-sel'));
      cellSel = null;
    }
    function setCellSel(a, b) {
      const table = a.closest('table');
      if (!table || b.closest('table') !== table) return;
      clearCellSel();
      const G = tableGrid(table);
      const rc = rectOf(G, a, b);
      const cells = cellsIn(G, rc);
      if (cells.length < 2) return;
      cells.forEach((td) => td.classList.add('docs-cell-sel'));
      cellSel = { table, rc, cells };
      updateState();
    }
    function currentCell() {
      if (cellSel) return cellSel.cells[0];
      const r = getRange() || lastRange;
      if (!r) return null;
      const n = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
      return n && n.closest ? n.closest('td') : null;
    }
    function nearColEdge(e) {
      const td = e.target.closest && e.target.closest('td');
      if (!td || !body.contains(td)) return null;
      const rc = td.getBoundingClientRect();
      if (rc.right - e.clientX <= 5 * scale && rc.right - e.clientX >= -2) return td;
      const prev = td.previousElementSibling;
      if (prev && e.clientX - rc.left <= 4 * scale) return prev;
      return null;
    }
    on(body, 'mousedown', (e) => {
      if (e.button !== 0) return;
      const img = e.target.closest('img');
      if (img && body.contains(img)) { selectImg(img); } else selectImg(null);
      const edge = nearColEdge(e);
      if (edge) {
        e.preventDefault();
        const table = edge.closest('table');
        const G = tableGrid(table);
        const p = G.pos.get(edge);
        const ci = p.c + p.cs - 1;
        const ws = colWidths(table);
        const tw = table.offsetWidth;
        if (ci >= ws.length - 1) return;
        colDrag = { table, ci, ws, tw, x: e.clientX };
        histRecord();
        document.documentElement.classList.add('docs-resizing');
        return;
      }
      const td = e.target.closest('td');
      if (e.shiftKey && td && cellAnchor && cellAnchor !== td && body.contains(cellAnchor)) { e.preventDefault(); setCellSel(cellAnchor, td); return; }
      clearCellSel();
      cellAnchor = td && body.contains(td) ? td : null;
    });
    on(body, 'mousemove', (e) => {
      if (colDrag) return;
      if (e.buttons === 1 && cellAnchor) {
        const td = e.target.closest && e.target.closest('td');
        if (td && td !== cellAnchor && body.contains(td) && td.closest('table') === cellAnchor.closest('table')) {
          setCellSel(cellAnchor, td);
          const s = window.getSelection();
          if (s.rangeCount) { const r = document.createRange(); r.selectNodeContents(td); r.collapse(false); setRange(r); }
        }
        return;
      }
      body.classList.toggle('docs-col-hover', !!nearColEdge(e));
    });
    on(window, 'mousemove', (e) => {
      if (!colDrag) return;
      const d = colDrag;
      const dx = (e.clientX - d.x) / scale / d.tw * 100;
      const ws = d.ws.slice();
      const a = Math.max(3, Math.min(ws[d.ci] + ws[d.ci + 1] - 3, ws[d.ci] + dx));
      ws[d.ci + 1] = ws[d.ci] + ws[d.ci + 1] - a;
      ws[d.ci] = a;
      setColWidths(d.table, ws);
    });
    on(window, 'mouseup', () => {
      if (!colDrag) return;
      colDrag = null;
      document.documentElement.classList.remove('docs-resizing');
      changed();
    });
    function tableCmd(cmd) {
      const td = currentCell();
      if (!td) { P.ui.toast('표 안을 먼저 누르세요.', 'warn'); return; }
      const table = td.closest('table');
      cmdWrap(() => {
        if (cmd === 'row-above' || cmd === 'row-below') tblInsertRow(table, td, cmd === 'row-below');
        else if (cmd === 'col-left' || cmd === 'col-right') tblInsertCol(table, td, cmd === 'col-right');
        else if (cmd === 'row-del' || cmd === 'col-del') {
          const res = cmd === 'row-del' ? tblDeleteRow(table, td) : tblDeleteCol(table, td);
          clearCellSel();
          if (res === 'table') removeTable(table);
          else { const c = table.querySelector('td p'); if (c) placeCaret(c, false); }
        } else if (cmd === 'merge') {
          if (!cellSel) { P.ui.toast('합칠 셀들을 마우스로 끌어서 고르세요. (Shift+클릭도 됩니다)', 'info'); return; }
          const m = tblMerge(table, cellSel.rc);
          clearCellSel();
          if (m) placeCaret(m.querySelector('p') || m, true);
        } else if (cmd === 'split') {
          if (!tblSplit(table, td)) P.ui.toast('합쳐진 셀이 아닙니다.', 'info');
        } else if (cmd === 'equal') {
          const n = tableGrid(table).cols;
          setColWidths(table, new Array(n).fill(100 / n));
        } else if (cmd === 'table-del') { clearCellSel(); removeTable(table); }
      });
    }
    function removeTable(table) {
      const next = table.nextElementSibling;
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      if (next && /^P$/.test(next.tagName) && isEmptyBlock(next)) { table.remove(); placeCaret(next, false); }
      else { table.replaceWith(p); placeCaret(p, false); }
      normalizeTop();
    }
    tblbar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tcmd],[data-tmenu]');
      if (!b) return;
      if (b.dataset.tmenu === 'cellbg') {
        openMenu(b, '<div class="p-pop-title">셀 배경</div>' + swatches(CELL_BG.filter(Boolean), '없음'), (v) => {
          const td = currentCell();
          if (!td) return;
          cmdWrap(() => (cellSel ? cellSel.cells : [td]).forEach((c) => { if (v === 'none') c.style.removeProperty('background-color'); else c.style.backgroundColor = v; if (!c.getAttribute('style')) c.removeAttribute('style'); }));
        });
        return;
      }
      tableCmd(b.dataset.tcmd);
    });

    /* ----- 그림 선택 · 크기 ----- */
    let selImg = null;
    function selectImg(img) {
      if (selImg === img) { positionImgTools(); return; }
      if (selImg) selImg.classList.remove('docs-img-sel');
      selImg = img;
      if (img) img.classList.add('docs-img-sel');
      positionImgTools();
    }
    function positionImgTools() {
      if (!selImg || !body.contains(selImg)) {
        if (selImg && !body.contains(selImg)) selImg = null;
        imgbar.hidden = true; imgh.hidden = true;
        return;
      }
      const pr = pagesEl.getBoundingClientRect();
      const ir = selImg.getBoundingClientRect();
      imgh.hidden = false;
      imgh.style.left = ((ir.right - pr.left) / scale - 6) + 'px';
      imgh.style.top = ((ir.bottom - pr.top) / scale - 6) + 'px';
      const dr = desk.getBoundingClientRect();
      imgbar.hidden = false;
      const top = ir.top - dr.top + desk.scrollTop - imgbar.offsetHeight - 8;
      imgbar.style.top = Math.max(desk.scrollTop + 4, top) + 'px';
      imgbar.style.left = Math.max(8, Math.min(desk.clientWidth - imgbar.offsetWidth - 8, ir.left - dr.left)) + 'px';
    }
    imgbar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-icmd]');
      if (!b || !selImg) return;
      const v = b.dataset.icmd;
      const img = selImg;
      histRecord();
      if (/^\d+$/.test(v)) img.style.width = v + '%';
      else if (v === 'del') { selectImg(null); img.remove(); }
      else { const blk = blockOf(img); if (blk) { if (v === 'left') blk.style.textAlign = 'left'; else blk.style.textAlign = v; } }
      changed();
      positionImgTools();
    });
    let imgDrag = null;
    on(imgh, 'pointerdown', (e) => {
      if (!selImg) return;
      e.preventDefault();
      imgh.setPointerCapture(e.pointerId);
      const host = selImg.parentElement;
      imgDrag = { x: e.clientX, w: selImg.offsetWidth, base: host.clientWidth || geo.cw };
      histRecord();
    });
    on(imgh, 'pointermove', (e) => {
      if (!imgDrag || !selImg) return;
      const w = imgDrag.w + (e.clientX - imgDrag.x) / scale;
      selImg.style.width = Math.max(3, Math.min(100, Math.round(w / imgDrag.base * 1000) / 10)) + '%';
      positionImgTools();
    });
    on(imgh, 'pointerup', () => { if (!imgDrag) return; imgDrag = null; changed(); });

    /* ----- 키보드 ----- */
    function cellNav(td, back) {
      const table = td.closest('table');
      const cells = Array.from(table.querySelectorAll('td')).filter((c) => c.closest('table') === table);
      const i = cells.indexOf(td);
      let next = cells[i + (back ? -1 : 1)];
      if (!next && !back) {
        cmdWrap(() => { const tr = tblInsertRow(table, td, true); next = tr.querySelector('td'); });
      }
      if (next) { const r = document.createRange(); r.selectNodeContents(next.querySelector('p') || next); setRange(r); }
    }
    on(body, 'keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key;
      if (mod && !e.altKey) {
        const lk = k.toLowerCase();
        if (lk === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
        if ((lk === 'z' && e.shiftKey) || lk === 'y') { e.preventDefault(); redo(); return; }
        if (lk === 'b' || lk === 'i' || lk === 'u') { e.preventDefault(); runCmd(lk === 'b' ? 'bold' : lk === 'i' ? 'italic' : 'underline'); return; }
        if (e.shiftKey && ['l', 'e', 'r', 'j'].includes(lk)) { e.preventDefault(); setAlign({ l: 'left', e: 'center', r: 'right', j: 'justify' }[lk]); return; }
        if (k === 'Enter') { e.preventDefault(); insertPageBreak(); return; }
        if (k === ']' || k === '[') {
          e.preventDefault();
          const cur = parseFloat(ribbon.querySelector('[data-sel="size"]').value) || pg.size;
          const idx = SIZES.findIndex((s) => s >= cur);
          const nv = k === ']' ? SIZES[Math.min(SIZES.length - 1, (SIZES[idx] === cur ? idx + 1 : idx))] : SIZES[Math.max(0, (idx < 0 ? SIZES.length : idx) - 1)];
          applySize(nv);
          return;
        }
      }
      if (mod && e.altKey && /^[0-3]$/.test(k)) { e.preventDefault(); setBlockTag(k === '0' ? 'p' : 'h' + k); return; }
      if (k === 'Tab') {
        const r = getRange();
        const node = r && (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement);
        const b = r && blockOf(r.startContainer);
        if (b && (b.hasAttribute('data-ol') || b.hasAttribute('data-ul'))) { e.preventDefault(); indent(e.shiftKey ? -1 : 1); return; }
        const td = node && node.closest('td');
        if (td) { e.preventDefault(); cellNav(td, e.shiftKey); return; }
        if (!e.shiftKey) { e.preventDefault(); insertText('    '); }
        return;
      }
      if (k === 'Enter' && !e.shiftKey && !mod) {
        const r = getRange();
        const b = r && r.collapsed && blockOf(r.startContainer);
        if (b && (b.hasAttribute('data-ol') || b.hasAttribute('data-ul')) && isEmptyBlock(b)) {
          e.preventDefault();
          setList(null, 0);
          return;
        }
      }
      if (k === 'Backspace' && !mod) {
        const r = getRange();
        const b = r && r.collapsed && blockOf(r.startContainer);
        if (b && (b.hasAttribute('data-ol') || b.hasAttribute('data-ul'))) {
          const rr = document.createRange();
          rr.setStart(b, 0);
          rr.setEnd(r.startContainer, r.startOffset);
          if (!rr.toString()) { e.preventDefault(); setList(null, 0); return; }
        }
        if (selImg) { e.preventDefault(); histRecord(); const i = selImg; selectImg(null); i.remove(); changed(); return; }
      }
      if (k === 'Delete' && selImg) { e.preventDefault(); histRecord(); const i = selImg; selectImg(null); i.remove(); changed(); return; }
      if ((k === 'Backspace' || k === 'Delete') && cellSel) {
        e.preventDefault();
        cmdWrap(() => { cellSel.cells.forEach((td) => { td.innerHTML = '<p><br></p>'; }); });
      }
    });
    on(root, 'keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const lk = e.key.toLowerCase();
      if (lk === 's') { e.preventDefault(); dirty = true; saveNow().then(() => { if (saveState === 'saved') P.ui.toast('저장했습니다.', 'ok'); }); }
      else if (lk === 'f' && !e.shiftKey) { e.preventDefault(); openFind(false); }
      else if (lk === 'h') { e.preventDefault(); openFind(true); }
    });
    on(body, 'beforeinput', (e) => {
      if (e.inputType === 'historyUndo') { e.preventDefault(); undo(); }
      else if (e.inputType === 'historyRedo') { e.preventDefault(); redo(); }
    });
    on(body, 'input', (e) => {
      if (/insertFromDrop|insertFromPaste|insertReplacementText/.test(e.inputType || '')) scrub();
      normalizeTop();
      if (pendingSize) { fixSizeSpans(pendingSize); pendingSize = null; }
      renumber(body);
      schedulePaginate();
      markDirty();
      dirtySinceRecord = true;
      updateHistBtns();
      clearTimeout(histTimer);
      histTimer = setTimeout(() => { histRecord(); dirtySinceRecord = false; }, 500);
      scheduleCount();
      if (findState.open) scheduleFind();
    });
    on(body, 'paste', (e) => {
      const cd = e.clipboardData;
      if (!cd) return;
      e.preventDefault();
      const files = Array.from(cd.files || []).filter((f) => /^image\//.test(f.type));
      const html = cd.getData('text/html');
      const text = cd.getData('text/plain');
      if (files.length && (!html || !/<(p|table|span|b|div)\b/i.test(html))) { insertImages(files); return; }
      if (html) { insertHTMLAtCaret(sanitizeHTML(html)); return; }
      if (text) {
        if (/\n/.test(text.replace(/\n$/, ''))) insertHTMLAtCaret(textToHTML(text.replace(/\n$/, '')));
        else { histRecord(); document.execCommand('insertText', false, text); }
      }
    });
    on(body, 'dragover', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) e.preventDefault(); });
    on(body, 'drop', (e) => {
      const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
      if (!files.length) return;
      e.preventDefault();
      let at = null;
      if (document.caretRangeFromPoint) at = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (at && !body.contains(at.startContainer)) at = null;
      if (files.some((f) => /^image\//.test(f.type))) insertImages(files, at);
      else importInto(files[0]);
    });
    on(document, 'selectionchange', () => {
      const r = getRange();
      if (r) { lastRange = r.cloneRange(); updateState(); }
    });
    on(pagesEl, 'mousedown', (e) => {
      if (body.contains(e.target) || e.target === imgh) return;
      e.preventDefault();
      body.focus({ preventScroll: true });
      const last = body.lastElementChild;
      const br = last ? last.getBoundingClientRect() : null;
      if (br && e.clientY > br.bottom) { placeCaret(last.tagName === 'TABLE' ? last.querySelector('td:last-child p') : last, true); return; }
      const bb = body.getBoundingClientRect();
      const x = Math.max(bb.left + 2, Math.min(bb.right - 2, e.clientX));
      const r = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, e.clientY) : null;
      if (r && body.contains(r.startContainer)) setRange(r); else placeCaret(last, true);
    });
    on(desk, 'scroll', () => { if (selImg) positionImgTools(); }, { passive: true });
    titleInp.addEventListener('input', markDirty);
    titleInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); body.focus(); placeCaret(body.firstElementChild, false); } });
    zoomSel.addEventListener('change', () => { zoom = /^(fit|text)$/.test(zoomSel.value) ? zoomSel.value : +zoomSel.value; P.settings.set('docs.zoom', zoom); applyScale(); positionImgTools(); });
    const ro = new ResizeObserver(() => { if (geo) { applyScale(); positionImgTools(); } });
    ro.observe(desk);
    offs.push(() => ro.disconnect());

    /* ----- 글자 위치 지도 (찾기·점검 공용) ----- */
    function textMap(b) {
      const nodes = [];
      let text = '';
      const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) { nodes.push([n, text.length]); text += n.nodeValue; }
      return { text, nodes, block: b };
    }
    function mapRange(m, s, e) {
      let sn = null, so = 0, en = null, eo = 0;
      for (const [n, st] of m.nodes) {
        const len = n.nodeValue.length;
        if (!sn && s >= st && s < st + len) { sn = n; so = s - st; }
        if (e > st && e <= st + len) { en = n; eo = e - st; break; }
      }
      if (!sn || !en) return null;
      const r = document.createRange();
      r.setStart(sn, so);
      r.setEnd(en, eo);
      return r;
    }
    function allBlocks() { return Array.from(body.querySelectorAll(BLOCK_SEL)); }
    function revealRange(r) {
      const n = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
      if (n && n.scrollIntoView) n.scrollIntoView({ block: 'center', inline: 'nearest' });
    }

    /* ----- 찾기 · 바꾸기 ----- */
    const findState = { open: false, ranges: [], idx: -1 };
    const hasHL = !!(window.CSS && CSS.highlights && window.Highlight);
    const fq = findbar.querySelector('.docs-find-q');
    const fr = findbar.querySelector('.docs-find-r');
    const fcase = findbar.querySelector('.docs-find-case');
    let findTimer = null;
    function scheduleFind() { clearTimeout(findTimer); findTimer = setTimeout(() => doSearch(false), 200); }
    function doSearch(keepIdx) {
      const q = fq.value;
      const cs = fcase.checked;
      const out = [];
      if (q) {
        const Q = cs ? q : q.toLowerCase();
        allBlocks().forEach((b) => {
          const m = textMap(b);
          const T = cs ? m.text : m.text.toLowerCase();
          let i = 0;
          while ((i = T.indexOf(Q, i)) >= 0) { const r = mapRange(m, i, i + Q.length); if (r) out.push(r); i += Q.length; }
        });
      }
      findState.ranges = out;
      if (!keepIdx || findState.idx >= out.length) findState.idx = out.length ? 0 : -1;
      if (!keepIdx && out.length) {
        const r = getRange() || lastRange;
        if (r) { const k = out.findIndex((x) => x.compareBoundaryPoints(Range.START_TO_START, r) >= 0); findState.idx = k >= 0 ? k : 0; }
      }
      paintFind();
    }
    function paintFind() {
      const { ranges, idx } = findState;
      findbar.querySelector('.docs-find-n').textContent = (ranges.length ? idx + 1 : 0) + '/' + ranges.length;
      if (hasHL) {
        CSS.highlights.set('docs-find', new Highlight(...ranges));
        CSS.highlights.set('docs-find-cur', idx >= 0 && ranges[idx] ? new Highlight(ranges[idx]) : new Highlight());
      }
      if (idx >= 0 && ranges[idx]) revealRange(ranges[idx]);
    }
    function clearFindHL() { if (hasHL) { CSS.highlights.delete('docs-find'); CSS.highlights.delete('docs-find-cur'); } }
    function openFind(withReplace) {
      findState.open = true;
      findbar.hidden = false;
      const r = getRange();
      const t = r && !r.collapsed ? r.toString() : '';
      if (t && t.length < 80 && !/\n/.test(t)) fq.value = t;
      const target = withReplace && fq.value ? fr : fq;
      target.focus();
      target.select();
      doSearch(false);
    }
    function closeFind() {
      findState.open = false;
      findbar.hidden = true;
      clearFindHL();
      const r = findState.ranges[findState.idx];
      body.focus({ preventScroll: true });
      if (r) setRange(r);
    }
    function stepFind(d) {
      const n = findState.ranges.length;
      if (!n) return;
      findState.idx = (findState.idx + d + n) % n;
      paintFind();
      if (!hasHL) setRange(findState.ranges[findState.idx]);
    }
    function replaceRange(r, text) {
      r.deleteContents();
      if (text) r.insertNode(document.createTextNode(text));
    }
    findbar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fcmd]');
      if (!b) return;
      const c = b.dataset.fcmd;
      if (c === 'close') closeFind();
      else if (c === 'next') stepFind(1);
      else if (c === 'prev') stepFind(-1);
      else if (c === 'one' || c === 'all') {
        if (!findState.ranges.length) return;
        clearTimeout(histTimer);
        histRecord();
        if (c === 'one') {
          const keep = findState.idx;
          replaceRange(findState.ranges[keep], fr.value);
          body.normalize();
          changed();
          doSearch(true);
          findState.idx = Math.min(keep, findState.ranges.length - 1);
          paintFind();
        } else {
          const n = findState.ranges.length;
          findState.ranges.slice().reverse().forEach((r) => replaceRange(r, fr.value));
          body.normalize();
          changed();
          doSearch(false);
          P.ui.toast(n + '곳을 바꿨습니다.', 'ok');
        }
      }
    });
    fq.addEventListener('input', () => doSearch(false));
    fcase.addEventListener('change', () => doSearch(false));
    findbar.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFind(); }
      else if (e.key === 'Enter' && e.target === fq) { e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); }
      else if (e.key === 'Enter' && e.target === fr) { e.preventDefault(); findbar.querySelector('[data-fcmd="one"]').click(); }
    });

    /* ----- 공문서 점검 ----- */
    const jong = (ch) => { const c = ch.charCodeAt(0) - 0xac00; return c >= 0 && c < 11172 ? c % 28 : -1; };
    const pad2 = (n) => String(n).padStart(2, '0');
    const LABEL_WORDS = /^(수신|제목|붙임|경유|시행|접수|우|전화번호|전송|협조자|기안자|검토자|결재권자|발신)$/;
    const PURIFY = [
      [/금번/g, '이번'], [/익일/g, '다음 날'], [/명일(?!\s?\d)/g, '내일'], [/금일/g, '오늘'],
      [/당해(?=\s?(연도|년도|기관|사업|부서|지역))/g, '해당'], [/상기(?=의|\s?(내용|사항|와|기관|건|자))/g, '위'], [/하기(?=의|\s?(내용|사항|와 같이|와))/g, '아래'],
      [/에\s?의거하여/g, '에 따라'], [/에\s?의거/g, '에 따라'], [/시건장치/g, '잠금장치'], [/가료/g, '치료'],
      [/송부(?=하|함|합|드)/g, '보내'], [/기\s?시행/g, '이미 시행'], [/만전을\s?기하/g, '빈틈없이 하'], [/제반(?=\s)/g, '여러'],
      [/지득/g, '알게 됨'], [/적의\s?조치/g, '적절히 조치'], [/구비\s?서류/g, '갖출 서류'], [/수범\s?사례/g, '모범 사례'], [/차기(?=\s?(회의|연도|년도))/g, '다음']
    ];
    const RULES = [
      {
        id: 'date', lv: 'warn', title: '날짜 표기',
        scan(T) {
          const out = [];
          const re = /(\d{4})\s*(\.|-|\/|년)\s*(\d{1,2})\s*(?:\.|-|\/|월)\s*(\d{1,2})(\s*일|\.(?!\d))?/g;
          let m;
          while ((m = re.exec(T))) {
            if (/\d/.test(T[m.index - 1] || '') || /\d/.test(T[m.index + m[0].length] || '')) continue;
            const y = +m[1], mo = +m[3], d = +m[4];
            if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > 31) continue;
            const canon = y + '. ' + mo + '. ' + d + '.';
            if (m[0] === canon) continue;
            out.push({ s: m.index, e: m.index + m[0].length, lv: m[2] === '년' ? 'info' : 'warn', msg: '날짜는 "' + canon + '"처럼 연·월·일 대신 온점을 찍고 한 칸씩 띄웁니다.', fix: canon });
          }
          return out;
        }
      },
      {
        id: 'weekday', lv: 'err', title: '요일 확인',
        scan(T) {
          const out = [];
          const re = /(\d{4})\.\s?(\d{1,2})\.\s?(\d{1,2})\.?\s?\(([월화수목금토일])\)/g;
          let m;
          while ((m = re.exec(T))) {
            const dt = new Date(+m[1], +m[2] - 1, +m[3]);
            if (dt.getMonth() !== +m[2] - 1) { out.push({ s: m.index, e: m.index + m[0].length, msg: '없는 날짜입니다.' }); continue; }
            const w = WEEK[dt.getDay()];
            if (w !== m[4]) out.push({ s: m.index, e: m.index + m[0].length, msg: '요일이 맞지 않습니다. ' + m[1] + '. ' + (+m[2]) + '. ' + (+m[3]) + '.은 ' + w + '요일입니다.', fix: m[0].replace(/\([월화수목금토일]\)$/, '(' + w + ')') });
          }
          return out;
        }
      },
      {
        id: 'time', lv: 'info', title: '시각 표기',
        scan(T) {
          const out = [];
          let m;
          const re1 = /(오전|오후)\s?(\d{1,2})\s?시(?!간|경|부터|까지|에서)(?:\s?(\d{1,2})\s?분)?/g;
          while ((m = re1.exec(T))) {
            let h = +m[2];
            if (h > 12) continue;
            if (m[1] === '오후' && h < 12) h += 12;
            if (m[1] === '오전' && h === 12) h = 0;
            const fix = pad2(h) + ':' + pad2(+(m[3] || 0));
            out.push({ s: m.index, e: m.index + m[0].length, msg: '시각은 24시각제로 "' + fix + '"처럼 씁니다.', fix });
          }
          const re2 = /(?<![\d:오전후])(\d{1,2})\s?시\s?(\d{1,2})\s?분/g;
          while ((m = re2.exec(T))) {
            if (+m[1] > 24 || +m[2] > 59) continue;
            if (/(오전|오후)\s?$/.test(T.slice(0, m.index))) continue;
            const fix = pad2(+m[1]) + ':' + pad2(+m[2]);
            out.push({ s: m.index, e: m.index + m[0].length, msg: '시각은 "' + fix + '"처럼 쌍점(:)으로 씁니다.', fix });
          }
          return out;
        }
      },
      {
        id: 'money', lv: 'warn', title: '금액 표기',
        scan(T) {
          const out = [];
          let m;
          const re1 = /(?<![\d,.])(\d{4,})(?=\s?(?:원|천원|만원|억원|백만원))/g;
          while ((m = re1.exec(T))) out.push({ s: m.index, e: m.index + m[1].length, msg: '금액은 세 자리마다 쉼표를 찍습니다.', fix: withComma(m[1]) });
          const re2 = /금\s?([\d,]+)\s?원(?!\s?\()/g;
          while ((m = re2.exec(T))) {
            const n = parseInt(m[1].replace(/,/g, ''), 10);
            if (!n) continue;
            const fix = '금' + withComma(n) + '원(금' + wonToHangul(n) + '원)';
            out.push({ s: m.index, e: m.index + m[0].length, lv: 'info', msg: '금액은 "' + fix + '"처럼 한글을 함께 씁니다.', fix });
          }
          return out;
        }
      },
      {
        id: 'space', lv: 'warn', title: '띄어쓰기',
        scan(T) {
          const out = [];
          let m;
          const add = (s, e, msg, fix, lv) => out.push({ s, e, msg, fix, lv });
          const reSu = /([가-힣])(\s?)수(\s?)(있|없)/g;
          while ((m = reSu.exec(T))) {
            if (jong(m[1]) !== 8 || (m[2] && m[3])) continue;
            add(m.index, m.index + m[0].length, '"' + m[1] + ' 수 ' + m[4] + '"처럼 띄어 씁니다.', m[1] + ' 수 ' + m[4]);
          }
          const reGeot = /([가-힣])것(?=[이을은도만과에으로]|\s|$|[.,])/g;
          while ((m = reGeot.exec(T))) {
            const j = jong(m[1]);
            if ('그이저새옛날헌'.includes(m[1]) || !(j === 4 || j === 8 || m[1] === '는')) continue;
            add(m.index, m.index + 2, '의존 명사 "것"은 띄어 씁니다.', m[1] + ' 것');
          }
          const reTtae = /([가-힣])때(?=[에는도의]|\s|$|[.,])/g;
          while ((m = reTtae.exec(T))) { if (jong(m[1]) === 8 && m[1] !== '날') add(m.index, m.index + 2, '"' + m[1] + ' 때"처럼 띄어 씁니다.', m[1] + ' 때'); }
          const reJosa = /([가-힣])(에|을|를)(대한|대하여|대해|관한|관하여|관해|따라|따른|의한|의하여|위한|위하여|위해|통한|통하여|통해)/g;
          while ((m = reJosa.exec(T))) add(m.index + 1, m.index + m[0].length, '"' + m[2] + ' ' + m[3] + '"처럼 띄어 씁니다.', m[2] + ' ' + m[3]);
          const reMit = /([^\s(]?)및([^\s)]?)/g;
          while ((m = reMit.exec(T))) { if (m[1] || m[2]) add(m.index, m.index + m[0].length, '"및"은 앞뒤를 띄어 씁니다.', (m[1] ? m[1] + ' ' : '') + '및' + (m[2] ? ' ' + m[2] : '')); }
          const reAn = /안(되|돼)(?!어서는)/g;
          while ((m = reAn.exec(T))) { if (!/[가-힣]$/.test(T.slice(0, m.index))) add(m.index, m.index + m[0].length, '부정의 "안"은 띄어 씁니다("안 되다").', '안 ' + m[1], 'info'); }
          const rePunc = /([^\s])[ \u00a0]+([.,])(?!\d)/g;
          while ((m = rePunc.exec(T))) add(m.index, m.index + m[0].length, '문장 부호 앞에는 띄어 쓰지 않습니다.', m[1] + m[2]);
          const rePct = /(\d)[ \u00a0]+%/g;
          while ((m = rePct.exec(T))) add(m.index, m.index + m[0].length, '"%"는 숫자에 붙여 씁니다.', m[1] + '%');
          const reDbl = /([가-힣A-Za-z,.])([ \u00a0]{2,})(?=[가-힣A-Za-z])/g;
          while ((m = reDbl.exec(T))) {
            const before = (T.slice(0, m.index + 1).match(/(\S+)$/) || ['', ''])[1];
            const after = (T.slice(m.index + m[0].length).match(/^(\S+)/) || ['', ''])[1];
            if (LABEL_WORDS.test(before) || LABEL_WORDS.test(after) || /^끝\./.test(after) || /^(붙임|시행|우|전화번호)[\s\u00a0]/.test(T)) continue;
            add(m.index + 1, m.index + m[0].length, '빈칸이 두 번 이상 들어갔습니다.', ' ', 'info');
          }
          return out;
        }
      },
      {
        id: 'purify', lv: 'info', title: '쉬운 행정 용어',
        scan(T) {
          const out = [];
          PURIFY.forEach(([re, to]) => {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(T))) out.push({ s: m.index, e: m.index + m[0].length, msg: '"' + m[0] + '" 대신 "' + to + '"처럼 쉬운 말을 권장합니다.', fix: to });
          });
          return out;
        }
      },
      {
        id: 'long', lv: 'info', title: '긴 문장',
        scan(T, b) {
          if (b.closest('td')) return [];
          const out = [];
          const re = /[^.!?]+[.!?]?/g;
          let m;
          while ((m = re.exec(T))) { if (m[0].trim().length > 150) out.push({ s: m.index, e: m.index + m[0].length, msg: '한 문장이 ' + m[0].trim().length + '자입니다. 짧게 나누거나 개조식으로 쓰면 읽기 쉽습니다.' }); }
          return out;
        }
      }
    ];
    const LIT = [
      [1, /^(\d{1,2})\.(?!\d)[ \u00a0]*/], [2, /^([가-하])\.[ \u00a0]+/], [3, /^(\d{1,2})\)[ \u00a0]*/], [4, /^([가-하])\)[ \u00a0]*/],
      [5, /^\((\d{1,2})\)[ \u00a0]*/], [6, /^\(([가-하])\)[ \u00a0]*/], [7, /^([①-⑳])/], [8, /^([㉮-㉻])/]
    ];
    function litValue(lv, s) {
      if (lv === 1 || lv === 3 || lv === 5) return +s;
      if (lv === 7) return CIRCLED.indexOf(s) + 1;
      if (lv === 8) return CIRCLED_H.indexOf(s) + 1;
      return HANGUL_SEQ.indexOf(s) + 1;
    }
    function checkOrder(issues) {
      const groups = new Map();
      allBlocks().forEach((b) => {
        const box = b.closest('td') || body;
        if (!groups.has(box)) groups.set(box, []);
        groups.get(box).push(b);
      });
      groups.forEach((list) => {
        let prev = 0;
        const cnt = new Array(10).fill(0);
        let stop = false;
        list.forEach((b) => {
          if (stop) return;
          if (/^H/.test(b.tagName)) { prev = 0; cnt.fill(0); return; }
          const m = textMap(b);
          const lead = (m.text.match(/^[ \u00a0\u3000]*/) || [''])[0].length;
          const T = m.text.slice(lead);
          if (/^붙임/.test(T)) { stop = true; return; }
          let lv = parseInt(b.getAttribute('data-ol'), 10) || 0;
          let lit = null;
          if (!lv) {
            for (const [l, re] of LIT) { const mm = T.match(re); if (mm && (l % 2 === 1 || l >= 7 || HANGUL_SEQ.slice(0, 14).includes(mm[1]))) { lv = l; lit = mm; break; } }
          }
          if (!lv) return;
          const label = OL_LABEL[lv - 1];
          const mkEnd = lit ? lead + lit[0].replace(/[ \u00a0]+$/, '').length : 0;
          const range = lit ? mapRange(m, lead, mkEnd) : mapRange(m, 0, Math.min(m.text.length, 1)) || null;
          if (lv > prev + 1) {
            issues.push({ rule: 'order', lv: 'warn', title: '항목 기호 순서', b, range, msg: prev ? '"' + OL_LABEL[prev - 1] + '" 다음에는 "' + OL_LABEL[prev] + '" 단계가 와야 하는데 "' + label + '"이(가) 왔습니다.' : '첫 항목은 "1."부터 시작합니다. 지금은 "' + label + '"입니다.' });
          }
          cnt[lv]++;
          for (let j = lv + 1; j < cnt.length; j++) cnt[j] = 0;
          if (lit) {
            const v = litValue(lv, lit[1]);
            if (v && v !== cnt[lv]) {
              const want = OL_FMT[lv - 1](cnt[lv]);
              issues.push({ rule: 'order', lv: 'warn', title: '항목 기호 순서', b, range, msg: '번호가 이어지지 않습니다. "' + want + '"이(가) 와야 합니다.', fix: want });
            }
          }
          prev = lv;
        });
      });
    }
    function checkEnd(issues) {
      const tops = Array.from(body.querySelectorAll(':scope > p'));
      const isGian = kind === 'gian' || tops.some((p) => /^수신[\s\u00a0]/.test(p.textContent.trim()));
      if (!isGian) return;
      const withEnd = allBlocks().filter((b) => /끝\.\s*$/.test(b.textContent.replace(/\u00a0/g, ' ')));
      if (!withEnd.length) {
        const lastItem = tops.filter((p) => p.hasAttribute('data-ol') || /^붙임/.test(p.textContent.trim())).pop() || tops[tops.length - 1];
        const m = textMap(lastItem);
        issues.push({ rule: 'end', lv: 'warn', title: '끝 표시', b: lastItem, range: mapRange(m, Math.max(0, m.text.length - 1), m.text.length), msg: '본문(또는 붙임) 마지막 글자 뒤에 두 칸 띄우고 "끝."을 씁니다.', fixFn: () => { lastItem.appendChild(document.createTextNode('\u00a0\u00a0끝.')); } });
        return;
      }
      withEnd.forEach((b) => {
        const m = textMap(b);
        const mm = m.text.match(/([^\s\u00a0])?([\s\u00a0]*)끝\.\s*$/);
        if (!mm || !mm[1]) return;
        if (mm[2].length === 2) return;
        const s = m.text.length - mm[0].length + 1;
        issues.push({ rule: 'end', lv: 'warn', title: '끝 표시', b, range: mapRange(m, s, m.text.length), msg: '"끝." 앞은 두 칸(한 글자) 띄웁니다.', fix: '\u00a0\u00a0끝.' });
      });
    }
    function runCheck() {
      const issues = [];
      allBlocks().forEach((b) => {
        const m = textMap(b);
        if (!m.text.trim()) return;
        RULES.forEach((rule) => {
          rule.scan(m.text, b).forEach((it) => {
            const range = mapRange(m, it.s, it.e);
            if (range) issues.push({ rule: rule.id, title: rule.title, lv: it.lv || rule.lv, msg: it.msg, fix: it.fix, b, range });
          });
        });
      });
      checkOrder(issues);
      checkEnd(issues);
      const rank = { err: 0, warn: 1, info: 2 };
      const order = new Map(allBlocks().map((b, i) => [b, i]));
      issues.sort((a, b) => (rank[a.lv] - rank[b.lv]) || ((order.get(a.b) || 0) - (order.get(b.b) || 0)));
      return issues;
    }
    function applyFix(it) {
      if (it.fixFn) it.fixFn();
      else if (it.fix != null && it.range) replaceRange(it.range, it.fix);
    }
    function overlaps(a, b) {
      try { return a.range && b.range && a.range.compareBoundaryPoints(Range.END_TO_START, b.range) < 0 && a.range.compareBoundaryPoints(Range.START_TO_END, b.range) > 0; } catch (e) { return false; }
    }
    function fixLabel(it) {
      if (it.fix == null) return '고치기';
      const show = (t) => (t.replace(/\u00a0/g, ' ').trim() ? '"' + esc(t.replace(/\u00a0/g, ' ')) + '"' : '빈칸 한 개');
      const from = it.range ? it.range.toString() : '';
      return (from ? show(from) + ' → ' : '') + show(it.fix) + ' 고치기';
    }
    let checkIssues = [];
    function renderCheck() {
      checkIssues = runCheck();
      const sb = side.querySelector('.docs-side-body');
      const n = { err: 0, warn: 0, info: 0 };
      checkIssues.forEach((i) => n[i.lv]++);
      const fixable = checkIssues.filter((i) => i.fix != null || i.fixFn).length;
      if (hasHL) CSS.highlights.set('docs-check', new Highlight(...checkIssues.map((i) => i.range).filter(Boolean)));
      const ctxOf = (it) => {
        if (!it.range) return '';
        const m = textMap(it.b);
        const pre = document.createRange();
        pre.setStart(it.b, 0);
        pre.setEnd(it.range.startContainer, it.range.startOffset);
        const s = pre.toString().length;
        const t = it.range.toString();
        return esc((s > 14 ? '…' : '') + m.text.slice(Math.max(0, s - 14), s)) + '<mark>' + esc(t || ' ') + '</mark>' + esc(m.text.slice(s + t.length, s + t.length + 14)) + (m.text.length > s + t.length + 14 ? '…' : '');
      };
      sb.innerHTML =
        '<div class="docs-ck-sum"><span class="docs-ck-b err">오류 ' + n.err + '</span><span class="docs-ck-b warn">주의 ' + n.warn + '</span><span class="docs-ck-b info">참고 ' + n.info + '</span></div>' +
        '<div class="toolbar docs-ck-tools"><button type="button" class="btn btn-sm" data-ck="re">다시 점검</button>' + (fixable ? '<button type="button" class="btn btn-sm btn-primary" data-ck="all">고칠 수 있는 ' + fixable + '건 모두 고치기</button>' : '') + '</div>' +
        (checkIssues.length ? '<ol class="docs-ck-list">' + checkIssues.map((it, i) =>
          '<li class="docs-ck-item ' + it.lv + '"><button type="button" class="docs-ck-go" data-ck="go" data-i="' + i + '"><b>' + esc(it.title) + '</b><span class="docs-ck-ctx">' + ctxOf(it) + '</span><small>' + esc(it.msg) + '</small></button>' +
          (it.fix != null || it.fixFn ? '<button type="button" class="btn btn-sm docs-ck-fix" data-ck="fix" data-i="' + i + '">' + fixLabel(it) + '</button>' : '') + '</li>').join('') + '</ol>'
          : '<div class="empty"><p>고칠 곳이 없습니다.</p></div>') +
        '<p class="docs-ck-note muted">행정업무 편람 기준 · 문맥에 따라 맞는 표현도 표시될 수 있음</p>';
    }
    side.addEventListener('click', (e) => {
      const t = e.target.closest('[data-side],[data-ck],[data-ol-i]');
      if (!t) return;
      if (t.dataset.side) { if (t.dataset.side === 'close') closeSide(); else openSide(t.dataset.side); return; }
      if (t.dataset.olI != null) { const b = outlineItems[+t.dataset.olI]; if (b && body.contains(b)) { b.scrollIntoView({ block: 'center' }); body.focus({ preventScroll: true }); placeCaret(b, false); } return; }
      const ck = t.dataset.ck;
      if (ck === 're') renderCheck();
      else if (ck === 'go') {
        const it = checkIssues[+t.dataset.i];
        if (it && it.range && body.contains(it.range.startContainer)) { revealRange(it.range); body.focus({ preventScroll: true }); setRange(it.range); }
      } else if (ck === 'fix') {
        const it = checkIssues[+t.dataset.i];
        if (!it) return;
        clearTimeout(histTimer);
        histRecord();
        applyFix(it);
        body.normalize();
        changed();
        renderCheck();
      } else if (ck === 'all') {
        clearTimeout(histTimer);
        histRecord();
        const done = [];
        const list = checkIssues.filter((i) => i.fix != null || i.fixFn);
        // 문서 뒤쪽부터 고쳐야 앞쪽 위치가 흔들리지 않는다
        list.sort((a, b) => (a.range && b.range ? b.range.compareBoundaryPoints(Range.START_TO_START, a.range) : 0));
        list.forEach((it) => { if (done.some((d) => overlaps(d, it))) return; applyFix(it); done.push(it); });
        body.normalize();
        changed();
        renderCheck();
        P.ui.toast(done.length + '건을 고쳤습니다.', 'ok');
      }
    });

    /* ----- 개요 · 보조 창 ----- */
    let outlineItems = [];
    function renderOutline() {
      outlineItems = Array.from(body.querySelectorAll(':scope > h1, :scope > h2, :scope > h3, :scope > p[data-ol="1"], :scope > p[data-ol="2"], :scope > p[data-ul="1"]'));
      const sb = side.querySelector('.docs-side-body');
      if (!outlineItems.length) { sb.innerHTML = '<div class="empty"><p>제목이 없습니다.</p></div>'; return; }
      sb.innerHTML = '<ol class="docs-outline">' + outlineItems.map((b, i) => {
        const lv = b.tagName === 'H1' ? 0 : b.tagName === 'H2' ? 1 : b.tagName === 'H3' ? 2 : b.getAttribute('data-ol') === '2' ? 2 : 1;
        const t = ((b.getAttribute('data-mk') ? b.getAttribute('data-mk') + ' ' : '') + b.textContent).trim().slice(0, 60) || '(빈 제목)';
        return '<li><button type="button" class="docs-outline-i lv' + lv + '" data-ol-i="' + i + '">' + esc(t) + '</button></li>';
      }).join('') + '</ol>';
    }
    function openSide(mode) {
      side.hidden = false;
      root.querySelector('.docs-editor').classList.add('docs-side-open');
      side.querySelectorAll('[data-side]').forEach((b) => { if (b.dataset.side !== 'close') b.setAttribute('aria-pressed', b.dataset.side === mode ? 'true' : 'false'); });
      root.querySelector('.docs-st-outline').setAttribute('aria-pressed', mode === 'outline' ? 'true' : 'false');
      if (mode === 'check') renderCheck(); else { if (hasHL) CSS.highlights.delete('docs-check'); renderOutline(); }
      applyScale();
    }
    function closeSide() {
      side.hidden = true;
      root.querySelector('.docs-editor').classList.remove('docs-side-open');
      root.querySelector('.docs-st-outline').setAttribute('aria-pressed', 'false');
      if (hasHL) CSS.highlights.delete('docs-check');
      applyScale();
    }

    /* ----- 쪽 설정 ----- */
    function openPageSetup() {
      const f = el('div', 'docs-pgset');
      const opt = (list, cur) => list.map(([v, t]) => '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
      const presetCur = (MARGIN_PRESETS.find((p) => p.v.mt === pg.mt && p.v.mb === pg.mb && p.v.ml === pg.ml && p.v.mr === pg.mr) || { k: '' }).k;
      f.innerHTML =
        '<div class="docs-pgset-grid">' +
        '<div class="field"><label>용지 방향</label><select name="orient">' + opt([['portrait', 'A4 세로'], ['landscape', 'A4 가로']], pg.orient) + '</select></div>' +
        '<div class="field"><label>여백 모음</label><select name="preset"><option value="">직접 입력</option>' + opt(MARGIN_PRESETS.map((p) => [p.k, p.label]), presetCur) + '</select></div>' +
        '<div class="field"><label>위쪽 <small class="muted">mm</small></label><input type="number" name="mt" min="5" max="80" step="0.5" value="' + pg.mt + '"></div>' +
        '<div class="field"><label>아래쪽 <small class="muted">mm</small></label><input type="number" name="mb" min="5" max="80" step="0.5" value="' + pg.mb + '"></div>' +
        '<div class="field"><label>왼쪽 <small class="muted">mm</small></label><input type="number" name="ml" min="5" max="80" step="0.5" value="' + pg.ml + '"></div>' +
        '<div class="field"><label>오른쪽 <small class="muted">mm</small></label><input type="number" name="mr" min="5" max="80" step="0.5" value="' + pg.mr + '"></div>' +
        '<div class="field"><label>기본 글꼴</label><select name="font">' + opt(FONTS.map((x) => [x.k, x.label]), pg.font) + '</select></div>' +
        '<div class="field"><label>기본 크기 <small class="muted">pt</small></label><input type="number" name="size" min="6" max="40" step="0.5" value="' + pg.size + '"></div>' +
        '<div class="field"><label>기본 줄 간격</label><select name="lh">' + opt(LINE_HEIGHTS.map((v) => [v, v + '%']), pg.lh) + '</select></div>' +
        '<div class="field"><label>쪽 번호</label><select name="pnpos">' + opt([['none', '넣지 않음'], ['bottom-center', '아래 가운데'], ['bottom-right', '아래 오른쪽'], ['top-right', '위 오른쪽']], pg.pageNum.pos) + '</select></div>' +
        '<div class="field"><label>쪽 번호 모양</label><select name="pnfmt">' + opt([['dash', '- 1 -'], ['plain', '1'], ['total', '1 / 3']], pg.pageNum.fmt) + '</select></div>' +
        '<div class="field"><label>머리말 위치</label><select name="hal">' + opt([['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']], pg.header.align) + '</select></div>' +
        '</div>' +
        '<div class="field"><label>머리말 <small class="muted">모든 쪽 위에 표시</small></label><input type="text" name="htext" maxlength="120" value="' + esc(pg.header.text) + '" placeholder="예: 대외비 / ○○과"></div>' +
        '<div class="docs-pgset-grid"><div class="field"><label>꼬리말 위치</label><select name="fal">' + opt([['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']], pg.footer.align) + '</select></div></div>' +
        '<div class="field"><label>꼬리말 <small class="muted">모든 쪽 아래에 표시</small></label><input type="text" name="ftext" maxlength="120" value="' + esc(pg.footer.text) + '" placeholder="예: ○○과 (담당 000-0000)"></div>';
      const g = (n) => f.querySelector('[name="' + n + '"]');
      g('preset').addEventListener('change', () => { const p = MARGIN_PRESETS.find((x) => x.k === g('preset').value); if (p) ['mt', 'mb', 'ml', 'mr'].forEach((k) => { g(k).value = p.v[k]; }); });
      ['mt', 'mb', 'ml', 'mr'].forEach((k) => g(k).addEventListener('input', () => { g('preset').value = ''; }));
      const sel = saveSel();
      P.ui.modal({
        title: '쪽 설정', wide: true, body: f,
        actions: [{ label: '취소' }, {
          label: '적용', primary: true, onClick: () => {
            const num = (n, lo, hi, d) => { const v = parseFloat(g(n).value); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
            const d = pageDims({ orient: g('orient').value });
            const next = {
              orient: g('orient').value,
              mt: num('mt', 5, 80, pg.mt), mb: num('mb', 5, 80, pg.mb), ml: num('ml', 5, 80, pg.ml), mr: num('mr', 5, 80, pg.mr),
              font: g('font').value, size: num('size', 6, 40, pg.size), lh: +g('lh').value,
              header: { text: g('htext').value.trim(), align: g('hal').value },
              footer: { text: g('ftext').value.trim(), align: g('fal').value },
              pageNum: { pos: g('pnpos').value, fmt: g('pnfmt').value }
            };
            if (d.w - next.ml - next.mr < 40 || d.h - next.mt - next.mb < 40) { P.ui.toast('여백이 너무 커서 본문 자리가 없습니다.', 'warn'); return false; }
            clearTimeout(histTimer);
            histRecord();
            Object.assign(pg, next);
            body.focus({ preventScroll: true });
            restoreSel(sel);
            changed({ relayout: true });
            return true;
          }
        }]
      });
    }

    /* ----- 글자 수 ----- */
    function openCount() {
      const t = body.innerText || '';
      const r = getRange() || lastRange;
      const selT = r && !r.collapsed ? r.toString() : '';
      const words = (s) => (s.match(/[^\s]+/g) || []).length;
      const rows = [
        ['쪽', pageCount + '쪽'],
        ['글자(공백 포함)', withComma(t.replace(/\n/g, '').length) + '자'],
        ['글자(공백 제외)', withComma(t.replace(/\s/g, '').length) + '자'],
        ['낱말', withComma(words(t)) + '개'],
        ['문단', withComma(Array.from(body.querySelectorAll(BLOCK_SEL)).filter((b) => b.textContent.trim()).length) + '개'],
        ['표 · 그림', body.querySelectorAll('table').length + '개 · ' + body.querySelectorAll('img').length + '개'],
        ['원고지(200자) 환산', Math.ceil(t.replace(/\n/g, '').length / 200) + '매']
      ];
      if (selT) rows.push(['선택한 부분', withComma(selT.replace(/\n/g, '').length) + '자 (공백 제외 ' + withComma(selT.replace(/\s/g, '').length) + '자)']);
      P.ui.modal({ title: '글자 수', body: '<table class="docs-count-tbl">' + rows.map(([a, b]) => '<tr><th>' + esc(a) + '</th><td>' + esc(b) + '</td></tr>').join('') + '</table>', actions: [{ label: '닫기', primary: true }] });
    }

    /* ----- 도움말 ----- */
    function openHelp() {
      const k = [
        [MOD + '+S', '바로 저장 (입력을 멈추면 1초 뒤 자동 저장)'], [MOD + '+Z / ' + MOD + '+Y', '실행 취소 / 다시 실행'],
        [MOD + '+B · I · U', '굵게 · 기울임 · 밑줄'], [MOD + '+] / [', '글자 크게 / 작게'],
        [MOD + '+Shift+L · E · R · J', '왼쪽 · 가운데 · 오른쪽 · 양쪽 정렬'], [MOD + '+Alt+1 · 2 · 3 · 0', '제목 1 · 2 · 3 · 본문'],
        ['Tab / Shift+Tab', '항목 번호 수준 내림/올림 · 표에서 다음/이전 칸'], ['빈 항목에서 Enter', '번호 끝내기'],
        [MOD + '+Enter', '쪽 나누기'], ['Shift+Enter', '문단 안에서 줄 바꾸기'], [MOD + '+F / ' + MOD + '+H', '찾기 / 바꾸기'],
        [MOD + '+P', '인쇄 · PDF 저장'], ['표 셀 끌기 · Shift+클릭', '여러 셀 고르기(합치기·배경)'], ['표 세로선 끌기', '칸 너비 조절']
      ];
      P.ui.modal({ title: '단축키', wide: true, body: '<table class="docs-count-tbl docs-keys">' + k.map(([a, b]) => '<tr><th><kbd>' + esc(a) + '</kbd></th><td>' + esc(b) + '</td></tr>').join('') + '</table>', actions: [{ label: '닫기', primary: true }] });
    }

    /* ----- 끼워 넣기 · 사본 ----- */
    async function importInto(file) {
      const saved = saveSel();
      const f = file || (await pickFile('.docx,.hwpx,.html,.htm,.txt,.md', false))[0];
      if (!f) return;
      try {
        const res = await (file ? importFile(f) : P.ui.busy(root.querySelector('[data-menu="more"]'), () => importFile(f)));
        body.focus({ preventScroll: true });
        restoreSel(saved);
        insertHTMLAtCaret(res.html);
        P.ui.toast('"' + f.name + '" 내용을 넣었습니다.', 'ok');
      } catch (e) { P.ui.toast(e.message || '파일을 읽지 못했습니다.', 'error'); }
    }
    async function duplicate() {
      await saveNow();
      const copy = snapshot();
      copy.title = copy.title + ' (사본)';
      copy.createdAt = new Date().toISOString();
      const nid = P.store.uid();
      try { await P.store.put(COL, nid, copy); P.ui.toast('사본을 만들었습니다.', 'ok'); ctx.navigate(APP_ID + '/' + encodeURIComponent(nid)); } catch (e) { /* core가 알림 */ }
    }

    /* ----- 내보내기 · 인쇄 ----- */
    const PRINT_ID = 'docs-print-style';
    function cssStr(s) { return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ') + '"'; }
    function applyPrintCSS() {
      let st = document.getElementById(PRINT_ID);
      if (!st) { st = document.createElement('style'); st.id = PRINT_ID; document.head.appendChild(st); }
      const pn = pg.pageNum.fmt === 'plain' ? 'counter(page)' : pg.pageNum.fmt === 'total' ? 'counter(page) " / " counter(pages)' : '"- " counter(page) " -"';
      const boxes = { 'top-left': [], 'top-center': [], 'top-right': [], 'bottom-left': [], 'bottom-center': [], 'bottom-right': [] };
      if (pg.header.text) boxes['top-' + pg.header.align].push(cssStr(pg.header.text));
      if (pg.footer.text) boxes['bottom-' + pg.footer.align].push(cssStr(pg.footer.text));
      if (pg.pageNum.pos !== 'none') { const b = boxes[pg.pageNum.pos]; if (b.length) b.push('"  "'); b.push(pn); }
      const d = pageDims(pg);
      st.textContent = '@page { size: ' + d.w + 'mm ' + d.h + 'mm; margin: ' + pg.mt + 'mm ' + pg.mr + 'mm ' + pg.mb + 'mm ' + pg.ml + 'mm; ' +
        Object.keys(boxes).filter((k) => boxes[k].length).map((k) => '@' + k + ' { content: ' + boxes[k].join(' ') + '; font-size: 9pt; color: #555; font-family: ' + (FONT_BY_KEY.get(pg.font) || FONTS[0]).css.replace(/;/g, '') + '; }').join(' ') + ' }';
    }
    function removePrintCSS() { const st = document.getElementById(PRINT_ID); if (st) st.remove(); }
    on(window, 'beforeprint', applyPrintCSS);
    on(window, 'afterprint', removePrintCSS);
    async function doExport(fmt) {
      const name = safeName(titleInp.value);
      if (fmt === 'pdf') {
        selectImg(null);
        clearCellSel();
        applyPrintCSS();
        P.ui.toast('인쇄 창에서 대상을 "PDF로 저장"으로 고르면 PDF 파일이 됩니다.', 'info');
        setTimeout(() => window.print(), 300);
        return;
      }
      await saveNow();
      selectImg(null);
      clearCellSel();
      try {
        if (fmt === 'txt') P.ui.download(name + '.txt', exportTXT(body), 'text/plain');
        else if (fmt === 'html') P.ui.download(name + '.html', exportHTMLDoc(body, pg, name), 'text/html');
        else if (fmt === 'hwpx') P.ui.download(name + '.hwpx', await exportHWPX(body, pg, name));
        else if (fmt === 'docx') P.ui.download(name + '.docx', await exportDOCX(body, pg, name));
        else return;
        P.ui.toast(fmt.toUpperCase() + ' 파일을 내려받았습니다.', 'ok');
      } catch (e) {
        console.error(e);
        P.ui.toast('내보내기에 실패했습니다: ' + (e.message || e), 'error');
      }
    }

    /* ----- 시작 ----- */
    on(window, 'beforeunload', () => { if (dirty) saveNow(); });
    renumber(body);
    computeGeo();
    drawPages();
    paginate();
    histRecord();
    setSave('saved');
    scheduleCount();
    updateState();
    body.querySelectorAll('img').forEach((i) => { if (!i.complete) i.addEventListener('load', schedulePaginate, { once: true }); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (root.isConnected) schedulePaginate(); });
    if (!('ontouchstart' in window) || !matchMedia('(pointer: coarse)').matches) {
      body.focus({ preventScroll: true });
      placeCaret(body.firstElementChild, false);
    }
    if (ctx.params[1] === 'check') openSide('check');
    if (ctx.params[1] === 'print') {
      try { history.replaceState(null, '', '#/' + APP_ID + '/' + encodeURIComponent(id)); } catch (e) { /* 무시 */ }
      setTimeout(() => { if (root.isConnected) doExport('pdf'); }, 400);
    }

    /* 가져오기·내보내기 (공통 단추) */
    const io = P.files.ioButtons({
      kind: APP_ID, size: 'sm', compact: true, keepFocus: true,
      attrs: { export: { 'data-menu': 'export' } }, menuClass: 'docs-pop',
      exportTitle: '이 문서',
      importers: [{ id: 'doc', label: '파일 내용 끼워 넣기', ext: 'HWPX · DOCX · TXT · HTML', accept: '.hwpx,.docx,.txt,.html,.htm,.md', run: (f) => importInto(f) }],
      exporters: DOC_FORMATS.map((x) => Object.assign({}, x, { run: () => doExport(x.id) }))
    });
    root.querySelector('.docs-io').replaceWith(io.el);

    return () => {
      offs.forEach((f) => f());
      if (menuClose) menuClose();
      clearTimeout(histTimer);
      clearTimeout(countTimer);
      clearTimeout(findTimer);
      if (layoutTimer) cancelAnimationFrame(layoutTimer);
      removePrintCSS();
      if (hasHL) { clearFindHL(); CSS.highlights.delete('docs-check'); }
      document.documentElement.classList.remove('docs-resizing');
      if (dirty) saveNow();
    };
  }

  /* ================= 내보내기: 공통 문서 모델 ================= */
  const GENERIC_FONT = { 'sans-serif': '맑은 고딕', 'system-ui': '맑은 고딕', '-apple-system': '맑은 고딕', serif: '바탕', monospace: '굴림체', 'ui-monospace': '굴림체' };
  function firstFamily(ff) {
    const f = String(ff || '').split(',')[0].replace(/["']/g, '').trim();
    return GENERIC_FONT[f] || f || '함초롬바탕';
  }
  function mapAlign(a) {
    return a === 'center' ? 'CENTER' : a === 'right' || a === 'end' ? 'RIGHT' : a === 'justify' ? 'JUSTIFY' : 'LEFT';
  }
  function dataUrlParts(src) {
    const m = /^data:(image\/[a-z+]+);base64,(.*)$/i.exec(src || '');
    if (!m) return null;
    const mime = m[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : m[1].toLowerCase();
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/bmp': 'bmp', 'image/webp': 'png' }[mime] || 'png';
    return { mime, ext, b64: m[2] };
  }
  const zf = (zip, path, data, opt) => zip.file(path, data, Object.assign({ createFolders: false }, opt));
  async function webpToPng(src) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    cv.getContext('2d').drawImage(img, 0, 0);
    return cv.toDataURL('image/png');
  }

  async function buildModel(body) {
    const cache = new Map();
    const cs = (n) => { let c = cache.get(n); if (!c) { c = getComputedStyle(n); cache.set(n, c); } return c; };
    const images = [];
    function runStyle(elm, block) {
      const c = cs(elm);
      let underline = false, strike = false, bg = null, sup = false, sub = false;
      for (let n = elm; n; n = n.parentElement) {
        const cc = cs(n);
        const tdl = cc.textDecorationLine || '';
        if (tdl.indexOf('underline') >= 0) underline = true;
        if (tdl.indexOf('line-through') >= 0) strike = true;
        if (!bg && n !== block) bg = rgbToHex(cc.backgroundColor);
        if (cc.verticalAlign === 'super') sup = true;
        if (cc.verticalAlign === 'sub') sub = true;
        if (n === block) break;
      }
      let size = parseFloat(c.fontSize) * 0.75;
      if ((sup || sub) && elm.parentElement) size = parseFloat(cs(elm.closest('sup,sub') ? elm.closest('sup,sub').parentElement : elm).fontSize) * 0.75;
      return {
        font: firstFamily(c.fontFamily), size: Math.round(size * 2) / 2,
        bold: (parseInt(c.fontWeight, 10) || 400) >= 600, italic: c.fontStyle === 'italic',
        underline, strike, color: rgbToHex(c.color) || '#000000', bg, sup, sub
      };
    }
    async function imgRun(img) {
      let src = img.getAttribute('src') || '';
      if (/^data:image\/webp/i.test(src)) { try { src = await webpToPng(src); } catch (e) { return null; } }
      const parts = dataUrlParts(src);
      if (!parts) return null;
      const info = { mime: parts.mime, ext: parts.ext, b64: parts.b64, w: img.offsetWidth || img.naturalWidth || 100, h: img.offsetHeight || img.naturalHeight || 100, nw: img.naturalWidth || img.offsetWidth, nh: img.naturalHeight || img.offsetHeight };
      info.n = images.push(info);
      return { img: info };
    }
    async function para(block) {
      const c = cs(block);
      const fs = parseFloat(c.fontSize) || 16;
      const lhRaw = c.lineHeight;
      const lh = lhRaw === 'normal' ? 1.2 : /px$/.test(lhRaw) ? parseFloat(lhRaw) / fs : parseFloat(lhRaw);
      const runs = [];
      const mk = block.getAttribute('data-mk');
      if (mk) runs.push({ text: mk + ' ', st: runStyle(block, block) });
      const walk = async (node) => {
        for (const ch of Array.from(node.childNodes)) {
          if (ch.nodeType === 3) {
            const t = ch.nodeValue.replace(/[\r\n]+/g, ' ').replace(/​/g, '');
            if (t) runs.push({ text: t, st: runStyle(ch.parentElement, block) });
          } else if (ch.nodeType === 1) {
            if (ch.tagName === 'BR') runs.push({ br: true, st: runStyle(ch.parentElement, block) });
            else if (ch.tagName === 'IMG') { const r = await imgRun(ch); if (r) runs.push(r); }
            else await walk(ch);
          }
        }
      };
      await walk(block);
      while (runs.length && runs[runs.length - 1].br) runs.pop();
      // 같은 모양의 글자 합치기
      const merged = [];
      runs.forEach((r) => {
        const last = merged[merged.length - 1];
        if (r.text != null && last && last.text != null && JSON.stringify(last.st) === JSON.stringify(r.st)) last.text += r.text;
        else merged.push(r);
      });
      const left = (parseFloat(c.marginLeft) || 0) + (parseFloat(c.paddingLeft) || 0);
      return {
        type: 'p', tag: block.tagName, align: mapAlign(c.textAlign), lh: Math.round(lh * 100),
        left, indent: parseFloat(c.textIndent) || 0,
        before: block.hasAttribute('data-pg') ? 0 : (parseFloat(c.marginTop) || 0), after: parseFloat(c.marginBottom) || 0,
        st: runStyle(block, block), runs: merged, pageBreak: false
      };
    }
    async function table(t) {
      const G = tableGrid(t);
      const ws = colWidths(t);
      const W = t.offsetWidth;
      const rows = [];
      for (let r = 0; r < G.rows; r++) {
        const tr = G.trs[r];
        const cells = [];
        for (const td of Array.from(tr.cells)) {
          const p = G.pos.get(td);
          const blocks = [];
          for (const b of Array.from(td.children)) { if (/^(P|H1|H2|H3)$/.test(b.tagName)) blocks.push(await para(b)); }
          if (!blocks.length) blocks.push({ type: 'p', align: 'LEFT', lh: 160, left: 0, indent: 0, before: 0, after: 0, st: runStyle(td, td), runs: [] });
          cells.push({ r: p.r, c: p.c, rs: p.rs, cs: p.cs, bg: rgbToHex(td.style.backgroundColor), valign: cs(td).verticalAlign, h: td.offsetHeight, blocks });
        }
        rows.push({ h: tr.offsetHeight, cells });
      }
      return { type: 'table', W, ws, nRows: G.rows, nCols: G.cols, rows, grid: G, pageBreak: false };
    }
    const blocks = [];
    let pb = false;
    for (const ch of Array.from(body.children)) {
      if (ch.tagName === 'HR') {
        if (ch.classList.contains('docs-pagebreak')) { pb = true; continue; }
        blocks.push({ type: 'hr', pageBreak: pb });
        pb = false;
        continue;
      }
      let b = null;
      if (ch.tagName === 'TABLE') b = await table(ch);
      else if (/^(P|H1|H2|H3)$/.test(ch.tagName)) b = await para(ch);
      if (!b) continue;
      b.pageBreak = pb;
      pb = false;
      blocks.push(b);
    }
    if (!blocks.length || blocks[blocks.length - 1].type !== 'p') blocks.push({ type: 'p', align: 'LEFT', lh: 160, left: 0, indent: 0, before: 0, after: 0, st: runStyle(body, body), runs: [], pageBreak: pb });
    return { blocks, images, cw: body.clientWidth, base: runStyle(body, body) };
  }

  /* ================= HWPX (OWPML) ================= */
  const HWPX_NS = 'xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"';
  const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>';
  const HU_PER_PX = 75; // 1px = 0.75pt, 1pt = 100 HWPUNIT
  const HU_PER_MM = 7200 / 25.4;
  const LANGS = ['HANGUL', 'LATIN', 'HANJA', 'JAPANESE', 'OTHER', 'SYMBOL', 'USER'];
  const hu = (px) => Math.round(px * HU_PER_PX);

  async function exportHWPX(body, pg, title) {
    await P.loadScript(VENDOR_ZIP);
    const M = await buildModel(body);
    const fonts = [];
    const fontId = (f) => { let i = fonts.indexOf(f); if (i < 0) { i = fonts.length; fonts.push(f); } return i; };
    const borderFills = [];
    const bfKey = new Map();
    const borderFill = (kind, fill) => {
      const key = kind + '|' + (fill || '');
      if (bfKey.has(key)) return bfKey.get(key);
      const id = borderFills.length + 1;
      const line = (side) => {
        const t = kind === 'cell' ? 'SOLID' : kind === 'hr' && side === 'bottom' ? 'SOLID' : 'NONE';
        const w = kind === 'hr' ? '0.4 mm' : '0.12 mm';
        return '<hh:' + side + 'Border type="' + t + '" width="' + w + '" color="#000000"/>';
      };
      borderFills.push('<hh:borderFill id="' + id + '" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">' +
        '<hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>' +
        line('left') + line('right') + line('top') + line('bottom') +
        '<hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/>' +
        (fill ? '<hc:fillBrush><hc:winBrush faceColor="' + fill + '" hatchColor="#999999" alpha="0"/></hc:fillBrush>' : '') +
        '</hh:borderFill>');
      bfKey.set(key, id);
      return id;
    };
    borderFill('none');
    const charPrs = [];
    const cpKey = new Map();
    const charPr = (st) => {
      const s = st || M.base;
      const key = JSON.stringify(s);
      if (cpKey.has(key)) return cpKey.get(key);
      const id = charPrs.length;
      const f = fontId(s.font);
      const all = (v) => LANGS.map((l) => l.toLowerCase() + '="' + v + '"').join(' ');
      charPrs.push('<hh:charPr id="' + id + '" height="' + Math.round(s.size * 100) + '" textColor="' + (s.color || '#000000').toUpperCase() + '" shadeColor="' + (s.bg ? s.bg.toUpperCase() : 'none') + '" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="1">' +
        '<hh:fontRef ' + all(f) + '/><hh:ratio ' + all(100) + '/><hh:spacing ' + all(0) + '/><hh:relSz ' + all(100) + '/><hh:offset ' + all(0) + '/>' +
        (s.italic ? '<hh:italic/>' : '') + (s.bold ? '<hh:bold/>' : '') +
        '<hh:underline type="' + (s.underline ? 'BOTTOM' : 'NONE') + '" shape="SOLID" color="#000000"/>' +
        '<hh:strikeout shape="' + (s.strike ? 'CONTINUOUS' : 'NONE') + '" color="#000000"/>' +
        '<hh:outline type="NONE"/><hh:shadow type="NONE" color="#B2B2B2" offsetX="10" offsetY="10"/>' +
        (s.sup ? '<hh:supscript/>' : '') + (s.sub ? '<hh:subscript/>' : '') +
        '</hh:charPr>');
      cpKey.set(key, id);
      return id;
    };
    charPr(M.base);
    const paraPrs = [];
    const ppKey = new Map();
    const paraPr = (b, extra) => {
      const left = hu(b.left + Math.min(0, b.indent));
      const o = { align: b.align || 'JUSTIFY', lh: Math.max(50, Math.min(500, b.lh || 160)), left, indent: hu(b.indent), prev: hu(b.before || 0), next: hu(b.after || 0), border: extra === 'hr' ? borderFill('hr') : 1 };
      const key = JSON.stringify(o);
      if (ppKey.has(key)) return ppKey.get(key);
      const id = paraPrs.length;
      paraPrs.push('<hh:paraPr id="' + id + '" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">' +
        '<hh:align horizontal="' + o.align + '" vertical="BASELINE"/>' +
        '<hh:heading type="NONE" idRef="0" level="0"/>' +
        '<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>' +
        '<hh:margin><hc:intent value="' + o.indent + '" unit="HWPUNIT"/><hc:left value="' + o.left + '" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="' + o.prev + '" unit="HWPUNIT"/><hc:next value="' + o.next + '" unit="HWPUNIT"/></hh:margin>' +
        '<hh:lineSpacing type="PERCENT" value="' + o.lh + '" unit="HWPUNIT"/>' +
        '<hh:border borderFillIDRef="' + o.border + '" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/>' +
        '<hh:autoSpacing eAsianEng="0" eAsianNum="0"/>' +
        '</hh:paraPr>');
      ppKey.set(key, id);
      return id;
    };
    paraPr({ align: 'JUSTIFY', lh: pg.lh, left: 0, indent: 0 });

    let pid = 0;
    let objId = 1000;
    const zip = new JSZip();
    zf(zip, 'mimetype', 'application/hwp+zip', { compression: 'STORE' });
    const binItems = [];
    const text = (s) => xmlEsc(s.replace(/ /g, ' '));
    const picXml = (im, maxW) => {
      let w = hu(im.w), h = hu(im.h);
      if (maxW && w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      const id = ++objId;
      return '<hp:pic id="' + id + '" zOrder="' + id + '" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="' + id + '" reverse="0">' +
        '<hp:sz width="' + w + '" widthRelTo="ABSOLUTE" height="' + h + '" heightRelTo="ABSOLUTE" protect="0"/>' +
        '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>' +
        '<hp:outMargin left="0" right="0" top="0" bottom="0"/>' +
        '<hp:offset x="0" y="0"/><hp:orgSz width="' + w + '" height="' + h + '"/><hp:curSz width="' + w + '" height="' + h + '"/>' +
        '<hp:flip horizontal="0" vertical="0"/><hp:rotationInfo angle="0" centerX="' + Math.round(w / 2) + '" centerY="' + Math.round(h / 2) + '" rotateimage="1"/>' +
        '<hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo>' +
        '<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="' + w + '" y="0"/><hc:pt2 x="' + w + '" y="' + h + '"/><hc:pt3 x="0" y="' + h + '"/></hp:imgRect>' +
        '<hp:imgClip left="0" right="' + hu(im.nw) + '" top="0" bottom="' + hu(im.nh) + '"/><hp:effects/>' +
        '<hp:inMargin left="0" right="0" top="0" bottom="0"/><hp:imgDim dimwidth="' + hu(im.nw) + '" dimheight="' + hu(im.nh) + '"/>' +
        '<hc:img binaryItemIDRef="image' + im.n + '" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/></hp:pic>';
    };
    const runsXml = (b, maxW) => {
      let out = '';
      let lastCp = charPr(b.st);
      b.runs.forEach((r) => {
        if (r.img) { out += '<hp:run charPrIDRef="' + lastCp + '">' + picXml(r.img, maxW) + '</hp:run>'; return; }
        const cp = charPr(r.st);
        lastCp = cp;
        out += '<hp:run charPrIDRef="' + cp + '"><hp:t>' + (r.br ? '<hp:lineBreak/>' : text(r.text)) + '</hp:t></hp:run>';
      });
      if (!out) out = '<hp:run charPrIDRef="' + lastCp + '"/>';
      return out;
    };
    const pOpen = (ppr, pb) => '<hp:p id="' + (pid++) + '" paraPrIDRef="' + ppr + '" styleIDRef="0" pageBreak="' + (pb ? 1 : 0) + '" columnBreak="0" merged="0">';
    const paraXml = (b, lead, maxW) => pOpen(paraPr(b), b.pageBreak) + (lead || '') + runsXml(b, maxW) + '</hp:p>';
    const cwHU = hu(M.cw);
    const tableXml = (t, lead) => {
      const W = Math.min(cwHU, hu(t.W));
      const colHU = t.ws.map((w) => Math.round(W * w / 100));
      const diff = W - colHU.reduce((a, b) => a + b, 0);
      colHU[colHU.length - 1] += diff;
      const rowHU = t.rows.map((r) => Math.max(600, hu(r.h)));
      const H = rowHU.reduce((a, b) => a + b, 0);
      const id = ++objId;
      let x = '<hp:tbl id="' + id + '" zOrder="' + id + '" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="' + t.nRows + '" colCnt="' + t.nCols + '" cellSpacing="0" borderFillIDRef="' + borderFill('cell') + '" noAdjust="0">' +
        '<hp:sz width="' + W + '" widthRelTo="ABSOLUTE" height="' + H + '" heightRelTo="ABSOLUTE" protect="0"/>' +
        '<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>' +
        '<hp:outMargin left="0" right="0" top="0" bottom="283"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>';
      t.rows.forEach((row) => {
        x += '<hp:tr>';
        row.cells.forEach((c) => {
          let w = 0;
          for (let i = c.c; i < c.c + c.cs && i < colHU.length; i++) w += colHU[i];
          let h = 0;
          for (let i = c.r; i < c.r + c.rs && i < rowHU.length; i++) h += rowHU[i];
          const va = c.valign === 'top' ? 'TOP' : c.valign === 'bottom' ? 'BOTTOM' : 'CENTER';
          x += '<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="' + borderFill('cell', c.bg ? c.bg.toUpperCase() : '') + '">' +
            '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="' + va + '" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">' +
            c.blocks.map((b) => paraXml(Object.assign({}, b, { pageBreak: false }), '', Math.max(1000, w - 1020))).join('') +
            '</hp:subList><hp:cellAddr colAddr="' + c.c + '" rowAddr="' + c.r + '"/><hp:cellSpan colSpan="' + c.cs + '" rowSpan="' + c.rs + '"/>' +
            '<hp:cellSz width="' + w + '" height="' + h + '"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>';
        });
        x += '</hp:tr>';
      });
      x += '</hp:tbl>';
      return pOpen(paraPr({ align: 'LEFT', lh: 100, left: 0, indent: 0 }), t.pageBreak) + (lead || '') + '<hp:run charPrIDRef="0">' + x + '</hp:run></hp:p>';
    };

    // 구역 정의 (용지·여백·머리말·꼬리말·쪽 번호) — 첫 문단 첫 글자 묶음에 들어간다
    const d = pageDims(pg);
    const land = pg.orient === 'landscape';
    const hdrMM = Math.min(15, Math.max(5, pg.mt * 0.4));
    const ftrMM = Math.min(15, Math.max(5, pg.mb * 0.4));
    const mmHU = (mm) => Math.round(mm * HU_PER_MM);
    const subP = (txt, al) => '<hp:p id="' + (pid++) + '" paraPrIDRef="' + paraPr({ align: al === 'left' ? 'LEFT' : al === 'right' ? 'RIGHT' : 'CENTER', lh: 130, left: 0, indent: 0 }) + '" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="' + charPr(Object.assign({}, M.base, { size: 9, color: '#555555', bold: false, italic: false, underline: false, strike: false, bg: null })) + '"><hp:t>' + text(txt) + '</hp:t></hp:run></hp:p>';
    const textW = mmHU(d.w - pg.ml - pg.mr);
    let ctrls = '<hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl>';
    if (pg.header.text) ctrls += '<hp:ctrl><hp:header id="1" applyPageType="BOTH"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="' + textW + '" textHeight="' + mmHU(hdrMM) + '" hasTextRef="0" hasNumRef="0">' + subP(pg.header.text, pg.header.align) + '</hp:subList></hp:header></hp:ctrl>';
    if (pg.footer.text) ctrls += '<hp:ctrl><hp:footer id="2" applyPageType="BOTH"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="BOTTOM" linkListIDRef="0" linkListNextIDRef="0" textWidth="' + textW + '" textHeight="' + mmHU(ftrMM) + '" hasTextRef="0" hasNumRef="0">' + subP(pg.footer.text, pg.footer.align) + '</hp:subList></hp:footer></hp:ctrl>';
    if (pg.pageNum.pos !== 'none') ctrls += '<hp:ctrl><hp:pageNum pos="' + { 'bottom-center': 'BOTTOM_CENTER', 'bottom-right': 'BOTTOM_RIGHT', 'top-right': 'TOP_RIGHT' }[pg.pageNum.pos] + '" formatType="DIGIT" sideChar="' + (pg.pageNum.fmt === 'dash' ? '-' : '') + '"/></hp:ctrl>';
    const pbf = (type) => '<hp:pageBorderFill type="' + type + '" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill>';
    const secPr = '<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">' +
      '<hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/><hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/>' +
      '<hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>' +
      '<hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/>' +
      '<hp:pagePr landscape="' + (land ? 'NARROWLY' : 'WIDELY') + '" width="59528" height="84186" gutterType="LEFT_ONLY">' +
      '<hp:margin header="' + mmHU(hdrMM) + '" footer="' + mmHU(ftrMM) + '" gutter="0" left="' + mmHU(pg.ml) + '" right="' + mmHU(pg.mr) + '" top="' + mmHU(pg.mt - hdrMM) + '" bottom="' + mmHU(pg.mb - ftrMM) + '"/></hp:pagePr>' +
      '<hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr>' +
      '<hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr>' +
      pbf('BOTH') + pbf('EVEN') + pbf('ODD') + '</hp:secPr>';
    const lead = '<hp:run charPrIDRef="0">' + secPr + ctrls + '</hp:run>';

    let secBody = '';
    M.blocks.forEach((b, i) => {
      const l = i === 0 ? lead : '';
      if (b.type === 'table') secBody += tableXml(b, l);
      else if (b.type === 'hr') secBody += pOpen(paraPr({ align: 'LEFT', lh: 100, left: 0, indent: 0 }, 'hr'), b.pageBreak) + l + '<hp:run charPrIDRef="0"/></hp:p>';
      else secBody += paraXml(b, l, cwHU);
    });
    M.images.forEach((im) => {
      zf(zip, 'BinData/image' + im.n + '.' + im.ext, im.b64, { base64: true });
      binItems.push('<opf:item id="image' + im.n + '" href="BinData/image' + im.n + '.' + im.ext + '" media-type="' + im.mime + '" isEmbeded="1"/>');
    });

    const numbering = '<hh:numberings itemCnt="1"><hh:numbering id="1" start="0">' +
      [['DIGIT', '^1.'], ['HANGUL_SYLLABLE', '^2.'], ['DIGIT', '^3)'], ['HANGUL_SYLLABLE', '^4)'], ['DIGIT', '(^5)'], ['HANGUL_SYLLABLE', '(^6)'], ['CIRCLED_DIGIT', '^7']]
        .map(([f, t], i) => '<hh:paraHead start="1" level="' + (i + 1) + '" align="LEFT" useInstWidth="1" autoIndent="1" widthAdjust="0" textOffsetType="PERCENT" textOffset="50" numFormat="' + f + '" charPrIDRef="4294967295" checkable="0">' + xmlEsc(t) + '</hh:paraHead>').join('') +
      '</hh:numbering></hh:numberings>';
    const header = XML_HEAD + '<hh:head ' + HWPX_NS + ' version="1.4" secCnt="1">' +
      '<hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/><hh:refList>' +
      '<hh:fontfaces itemCnt="' + LANGS.length + '">' + LANGS.map((l) => '<hh:fontface lang="' + l + '" fontCnt="' + fonts.length + '">' + fonts.map((f, i) => '<hh:font id="' + i + '" face="' + xmlEsc(f) + '" type="TTF" isEmbedded="0"><hh:typeInfo familyType="FCAT_GOTHIC" weight="6" proportion="4" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/></hh:font>').join('') + '</hh:fontface>').join('') + '</hh:fontfaces>' +
      '<hh:borderFills itemCnt="' + borderFills.length + '">' + borderFills.join('') + '</hh:borderFills>' +
      '<hh:charProperties itemCnt="' + charPrs.length + '">' + charPrs.join('') + '</hh:charProperties>' +
      '<hh:tabProperties itemCnt="1"><hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/></hh:tabProperties>' +
      numbering +
      '<hh:paraProperties itemCnt="' + paraPrs.length + '">' + paraPrs.join('') + '</hh:paraProperties>' +
      '<hh:styles itemCnt="1"><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/></hh:styles>' +
      '</hh:refList><hh:compatibleDocument targetProgram="HWP201X"><hh:layoutCompatibility/></hh:compatibleDocument>' +
      '<hh:trackchageConfig flags="56"/><hh:docOption><hh:linkinfo path="" pageInherit="0" footnoteInherit="0"/></hh:docOption></hh:head>';
    const section = XML_HEAD + '<hs:sec ' + HWPX_NS + '>' + secBody + '</hs:sec>';
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const hpf = XML_HEAD + '<opf:package ' + HWPX_NS + ' version="" unique-identifier="" id=""><opf:metadata><opf:title>' + xmlEsc(title) + '</opf:title><opf:language>ko</opf:language>' +
      '<opf:meta name="creator" content="text"></opf:meta><opf:meta name="subject" content="text"></opf:meta><opf:meta name="description" content="text"></opf:meta>' +
      '<opf:meta name="CreatedDate" content="text">' + now + '</opf:meta><opf:meta name="ModifiedDate" content="text">' + now + '</opf:meta><opf:meta name="keyword" content="text"></opf:meta></opf:metadata>' +
      '<opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/><opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/><opf:item id="settings" href="settings.xml" media-type="application/xml"/>' + binItems.join('') + '</opf:manifest>' +
      '<opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>';
    const prv = exportTXT(body).slice(0, 1024);
    zf(zip, 'version.xml', XML_HEAD + '<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="0" buildNumber="1" os="1" xmlVersion="1.4" application="Hancom Office Hangul" appVersion="11, 0, 0, 0"/>');
    zf(zip, 'Contents/header.xml', header);
    zf(zip, 'Contents/section0.xml', section);
    zf(zip, 'Contents/content.hpf', hpf);
    zf(zip, 'settings.xml', XML_HEAD + '<ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"><ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/></ha:HWPApplicationSetting>');
    zf(zip, 'Preview/PrvText.txt', prv);
    zf(zip, 'META-INF/container.xml', XML_HEAD + '<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/><ocf:rootfile full-path="Preview/PrvText.txt" media-type="text/plain"/></ocf:rootfiles></ocf:container>');
    zf(zip, 'META-INF/manifest.xml', XML_HEAD + '<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>');
    zf(zip, 'META-INF/container.rdf', XML_HEAD + '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about=""><ns0:hasPart xmlns:ns0="http://www.hancom.co.kr/hwpml/2016/meta/pkg#" rdf:resource="Contents/header.xml"/></rdf:Description><rdf:Description rdf:about="Contents/header.xml"><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#HeaderFile"/></rdf:Description><rdf:Description rdf:about=""><ns0:hasPart xmlns:ns0="http://www.hancom.co.kr/hwpml/2016/meta/pkg#" rdf:resource="Contents/section0.xml"/></rdf:Description><rdf:Description rdf:about="Contents/section0.xml"><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#SectionFile"/></rdf:Description><rdf:Description rdf:about=""><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#Document"/></rdf:Description></rdf:RDF>');
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/hwp+zip' });
  }

  /* ================= DOCX (WordprocessingML) ================= */
  const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const TW_PER_PX = 15;
  const TW_PER_MM = 1440 / 25.4;
  const EMU_PER_PX = 9525;

  async function exportDOCX(body, pg, title) {
    await P.loadScript(VENDOR_ZIP);
    const M = await buildModel(body);
    const zip = new JSZip();
    const tw = (px) => Math.round(px * TW_PER_PX);
    const hex = (c) => (c || '#000000').replace('#', '').toUpperCase();
    let docPr = 0;
    const rPr = (s) => {
      const f = xmlEsc(s.font);
      return '<w:rPr><w:rFonts w:ascii="' + f + '" w:hAnsi="' + f + '" w:eastAsia="' + f + '" w:cs="' + f + '"/>' +
        (s.bold ? '<w:b/>' : '') + (s.italic ? '<w:i/>' : '') + (s.strike ? '<w:strike/>' : '') +
        '<w:color w:val="' + hex(s.color) + '"/><w:sz w:val="' + Math.round(s.size * 2) + '"/><w:szCs w:val="' + Math.round(s.size * 2) + '"/>' +
        (s.underline ? '<w:u w:val="single"/>' : '') + (s.bg ? '<w:shd w:val="clear" w:color="auto" w:fill="' + hex(s.bg) + '"/>' : '') +
        (s.sup ? '<w:vertAlign w:val="superscript"/>' : s.sub ? '<w:vertAlign w:val="subscript"/>' : '') + '</w:rPr>';
    };
    const drawing = (im, maxPx) => {
      let w = im.w, h = im.h;
      if (maxPx && w > maxPx) { h = h * maxPx / w; w = maxPx; }
      const cx = Math.round(w * EMU_PER_PX), cy = Math.round(h * EMU_PER_PX);
      const n = ++docPr;
      return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + n + '" name="그림 ' + n + '"/>' +
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
        '<pic:pic><pic:nvPicPr><pic:cNvPr id="' + n + '" name="image' + im.n + '.' + im.ext + '"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg' + im.n + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
        '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
    };
    const jc = (a) => ({ CENTER: 'center', RIGHT: 'right', JUSTIFY: 'both' }[a] || 'left');
    const pXml = (b, maxPx, extraPPr) => {
      const style = b.tag === 'H1' ? 'Heading1' : b.tag === 'H2' ? 'Heading2' : b.tag === 'H3' ? 'Heading3' : '';
      const left = tw(b.left), ind = tw(b.indent);
      let ppr = (style ? '<w:pStyle w:val="' + style + '"/>' : '') + (b.pageBreak ? '<w:pageBreakBefore/>' : '') + (extraPPr || '') +
        '<w:spacing w:before="' + tw(b.before || 0) + '" w:after="' + tw(b.after || 0) + '" w:line="' + Math.round(240 * (b.lh || 160) / 100) + '" w:lineRule="auto"/>';
      if (left || ind) ppr += '<w:ind w:left="' + Math.max(0, left) + '"' + (ind < 0 ? ' w:hanging="' + (-ind) + '"' : ind > 0 ? ' w:firstLine="' + ind + '"' : '') + '/>';
      ppr += '<w:jc w:val="' + jc(b.align) + '"/>';
      let runs = '';
      (b.runs || []).forEach((r) => {
        if (r.img) runs += drawing(r.img, maxPx);
        else if (r.br) runs += '<w:r>' + rPr(r.st) + '<w:br/></w:r>';
        else runs += '<w:r>' + rPr(r.st) + '<w:t xml:space="preserve">' + xmlEsc(r.text.replace(/ /g, ' ')) + '</w:t></w:r>';
      });
      return '<w:p><w:pPr>' + ppr + '<w:rPr><w:sz w:val="' + Math.round((b.st ? b.st.size : pg.size) * 2) + '"/></w:rPr></w:pPr>' + runs + '</w:p>';
    };
    const tblXml = (t) => {
      const totalTw = Math.min(tw(M.cw), tw(t.W));
      const cols = t.ws.map((w) => Math.round(totalTw * w / 100));
      const bd = (s) => '<w:' + s + ' w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
      let x = '<w:tbl><w:tblPr><w:tblW w:w="' + totalTw + '" w:type="dxa"/><w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(bd).join('') + '</w:tblBorders><w:tblLayout w:type="fixed"/>' +
        '<w:tblCellMar><w:left w:w="85" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' + cols.map((w) => '<w:gridCol w:w="' + w + '"/>').join('') + '</w:tblGrid>';
      const G = t.grid;
      const byCell = new Map();
      t.rows.forEach((row) => row.cells.forEach((c) => byCell.set(c.r + ':' + c.c, c)));
      for (let r = 0; r < t.nRows; r++) {
        x += '<w:tr>' + (t.rows[r].h ? '<w:trPr><w:trHeight w:val="' + tw(t.rows[r].h) + '"/></w:trPr>' : '');
        for (let c = 0; c < t.nCols;) {
          const td = G.grid[r][c];
          if (!td) { x += '<w:tc><w:tcPr><w:tcW w:w="' + cols[c] + '" w:type="dxa"/></w:tcPr><w:p/></w:tc>'; c++; continue; }
          const p = G.pos.get(td);
          let w = 0;
          for (let i = p.c; i < p.c + p.cs; i++) w += cols[i] || 0;
          const cell = byCell.get(p.r + ':' + p.c);
          const tcPr = '<w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + (p.cs > 1 ? '<w:gridSpan w:val="' + p.cs + '"/>' : '') +
            (p.rs > 1 ? (p.r === r ? '<w:vMerge w:val="restart"/>' : '<w:vMerge/>') : '') +
            (cell && cell.bg ? '<w:shd w:val="clear" w:color="auto" w:fill="' + hex(cell.bg) + '"/>' : '') +
            '<w:vAlign w:val="' + (cell && cell.valign === 'top' ? 'top' : cell && cell.valign === 'bottom' ? 'bottom' : 'center') + '"/></w:tcPr>';
          const content = p.r === r && cell ? cell.blocks.map((b) => pXml(Object.assign({}, b, { pageBreak: false }), w / TW_PER_PX - 12)).join('') : '<w:p/>';
          x += '<w:tc>' + tcPr + content + '</w:tc>';
          c += p.cs;
        }
        x += '</w:tr>';
      }
      return x + '</w:tbl>';
    };
    let bodyXml = '';
    M.blocks.forEach((b) => {
      if (b.type === 'table') {
        if (b.pageBreak) bodyXml += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
        bodyXml += tblXml(b);
      } else if (b.type === 'hr') bodyXml += '<w:p><w:pPr>' + (b.pageBreak ? '<w:pageBreakBefore/>' : '') + '<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="000000"/></w:pBdr></w:pPr></w:p>';
      else bodyXml += pXml(b, M.cw);
    });
    const d = pageDims(pg);
    const mmTw = (mm) => Math.round(mm * TW_PER_MM);
    const pnField = () => {
      const fld = (instr) => '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ' + instr + ' </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
      const t = (s) => '<w:r><w:t xml:space="preserve">' + s + '</w:t></w:r>';
      return pg.pageNum.fmt === 'plain' ? fld('PAGE') : pg.pageNum.fmt === 'total' ? fld('PAGE') + t(' / ') + fld('NUMPAGES') : t('- ') + fld('PAGE') + t(' -');
    };
    const hfPara = (txt, al, withPn) => '<w:p><w:pPr><w:jc w:val="' + (al === 'left' ? 'left' : al === 'right' ? 'right' : 'center') + '"/><w:rPr><w:sz w:val="18"/></w:rPr></w:pPr>' +
      (txt ? '<w:r><w:rPr><w:color w:val="555555"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">' + xmlEsc(txt) + (withPn ? '  ' : '') + '</w:t></w:r>' : '') + (withPn ? pnField() : '') + '</w:p>';
    const pnPos = pg.pageNum.pos;
    const pnAl = pnPos === 'none' ? null : pnPos.split('-')[1];
    const hdrParas = (pg.header.text ? [hfPara(pg.header.text, pg.header.align, pnPos === 'top-right' && pg.header.align === 'right')] : [])
      .concat(pnPos === 'top-right' && !(pg.header.text && pg.header.align === 'right') ? [hfPara('', 'right', true)] : []);
    const ftrParas = (pg.footer.text ? [hfPara(pg.footer.text, pg.footer.align, pnPos.startsWith('bottom') && pg.footer.align === pnAl)] : [])
      .concat(pnPos.startsWith('bottom') && !(pg.footer.text && pg.footer.align === pnAl) ? [hfPara('', pnAl, true)] : []);
    const rels = ['<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'];
    let sectRefs = '';
    if (hdrParas.length) {
      zf(zip, 'word/header1.xml', XML_HEAD + '<w:hdr ' + W_NS + '>' + hdrParas.join('') + '</w:hdr>');
      rels.push('<Relationship Id="rIdHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>');
      sectRefs += '<w:headerReference w:type="default" r:id="rIdHdr"/>';
    }
    if (ftrParas.length) {
      zf(zip, 'word/footer1.xml', XML_HEAD + '<w:ftr ' + W_NS + '>' + ftrParas.join('') + '</w:ftr>');
      rels.push('<Relationship Id="rIdFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>');
      sectRefs += '<w:footerReference w:type="default" r:id="rIdFtr"/>';
    }
    const exts = new Set();
    M.images.forEach((im) => {
      zf(zip, 'word/media/image' + im.n + '.' + im.ext, im.b64, { base64: true });
      exts.add(im.ext);
      rels.push('<Relationship Id="rIdImg' + im.n + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image' + im.n + '.' + im.ext + '"/>');
    });
    const land = pg.orient === 'landscape';
    const sect = '<w:sectPr>' + sectRefs + '<w:pgSz w:w="' + mmTw(d.w) + '" w:h="' + mmTw(d.h) + '"' + (land ? ' w:orient="landscape"' : '') + '/>' +
      '<w:pgMar w:top="' + mmTw(pg.mt) + '" w:right="' + mmTw(pg.mr) + '" w:bottom="' + mmTw(pg.mb) + '" w:left="' + mmTw(pg.ml) + '" w:header="' + mmTw(Math.max(5, pg.mt * 0.45)) + '" w:footer="' + mmTw(Math.max(5, pg.mb * 0.45)) + '" w:gutter="0"/></w:sectPr>';
    zf(zip, 'word/document.xml', XML_HEAD + '<w:document ' + W_NS + '><w:body>' + bodyXml + sect + '</w:body></w:document>');
    const f = xmlEsc(M.base.font);
    const heading = (n, sz) => '<w:style w:type="paragraph" w:styleId="Heading' + n + '"><w:name w:val="heading ' + n + '"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="' + (n - 1) + '"/></w:pPr><w:rPr><w:b/><w:sz w:val="' + sz + '"/></w:rPr></w:style>';
    zf(zip, 'word/styles.xml', XML_HEAD + '<w:styles ' + W_NS + '><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="' + f + '" w:hAnsi="' + f + '" w:eastAsia="' + f + '" w:cs="' + f + '"/><w:sz w:val="' + Math.round(pg.size * 2) + '"/><w:szCs w:val="' + Math.round(pg.size * 2) + '"/><w:lang w:val="ko-KR" w:eastAsia="ko-KR"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="' + Math.round(2.4 * pg.lh) + '" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      heading(1, 36) + heading(2, 30) + heading(3, 26) +
      '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
      '</w:styles>');
    zf(zip, 'word/_rels/document.xml.rels', XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels.join('') + '</Relationships>');
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    zf(zip, 'docProps/core.xml', XML_HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + xmlEsc(title) + '</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified></cp:coreProperties>');
    zf(zip, '_rels/.rels', XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
    const mime = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp' };
    zf(zip, '[Content_Types].xml', XML_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      Array.from(exts).map((e) => '<Default Extension="' + e + '" ContentType="' + mime[e] + '"/>').join('') +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      (hdrParas.length ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : '') +
      (ftrParas.length ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : '') +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  /* ================= HTML · 텍스트 ================= */
  function exportTXT(body) {
    const lines = [];
    const blockText = (b) => {
      const c = b.cloneNode(true);
      c.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
      return (b.getAttribute('data-mk') ? b.getAttribute('data-mk') + ' ' : '') + c.textContent.replace(/ /g, ' ');
    };
    Array.from(body.children).forEach((ch) => {
      if (ch.tagName === 'TABLE') Array.from(ch.rows).forEach((tr) => lines.push(Array.from(tr.cells).map((td) => Array.from(td.children).map(blockText).join(' ').trim()).join('\t')));
      else if (ch.tagName === 'HR') lines.push(ch.classList.contains('docs-pagebreak') ? '\f' : '----------');
      else {
        const lv = parseInt(ch.getAttribute('data-ol') || ch.getAttribute('data-ul'), 10) || 1;
        lines.push('  '.repeat(lv - 1) + blockText(ch));
      }
    });
    return lines.join('\r\n').replace(/\n\f\r?\n/g, '\n\f');
  }
  function exportHTMLDoc(body, pg, title) {
    const c = body.cloneNode(true);
    const live = Array.from(body.querySelectorAll('[data-mk]'));
    Array.from(c.querySelectorAll('[data-mk]')).forEach((n, i) => {
      const src = live[i];
      const cs = src ? getComputedStyle(src) : null;
      const mk = document.createElement('span');
      mk.className = 'mk';
      mk.textContent = n.getAttribute('data-mk') + ' ';
      n.insertBefore(mk, n.firstChild);
      if (cs) { n.style.paddingLeft = cs.paddingLeft; n.style.textIndent = cs.textIndent; }
      n.removeAttribute('data-mk');
    });
    c.querySelectorAll('[data-pg]').forEach((e) => { e.removeAttribute('data-pg'); e.style.removeProperty('--pg'); });
    c.querySelectorAll('.docs-cell-sel,.docs-img-sel').forEach((e) => e.classList.remove('docs-cell-sel', 'docs-img-sel'));
    const d = pageDims(pg);
    const f = (FONT_BY_KEY.get(pg.font) || FONTS[0]).css;
    const css = '*{box-sizing:border-box}body{margin:0;background:#eef0f4;color:#000}' +
      '.doc{width:' + d.w + 'mm;max-width:100%;margin:24px auto;background:#fff;padding:' + pg.mt + 'mm ' + pg.mr + 'mm ' + pg.mb + 'mm ' + pg.ml + 'mm;box-shadow:0 2px 12px rgba(0,0,0,.12);font-family:' + f + ';font-size:' + pg.size + 'pt;line-height:' + (pg.lh / 100) + ';text-align:justify;word-break:keep-all;overflow-wrap:anywhere}' +
      'p,h1,h2,h3{margin:0}h1{font-size:1.7em;margin:0 0 .3em}h2{font-size:1.35em;margin:.2em 0 .2em}h3{font-size:1.15em;margin:.1em 0 .1em}' +
      'table{border-collapse:collapse;width:100%;table-layout:fixed;margin:2px 0}td{border:1px solid #000;padding:2px 6px;vertical-align:middle}img{max-width:100%;height:auto}' +
      'hr{border:0;border-top:1px solid #000;margin:6px 0}hr.docs-pagebreak{border:0;margin:0;page-break-after:always;break-after:page}.mk{display:inline-block}' +
      '@media print{body{background:#fff}.doc{margin:0;padding:0;width:auto;box-shadow:none}@page{size:' + d.w + 'mm ' + d.h + 'mm;margin:' + pg.mt + 'mm ' + pg.mr + 'mm ' + pg.mb + 'mm ' + pg.ml + 'mm}}' +
      '@media (max-width:820px){.doc{margin:0;padding:16px;width:auto}}';
    return '<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(title) + '</title><style>' + css + '</style></head><body><main class="doc">' + c.innerHTML + '</main></body></html>';
  }

  /* ================= 가져오기 ================= */
  function extOf(name) { return (String(name).match(/\.([a-z0-9]+)$/i) || ['', ''])[1].toLowerCase(); }
  async function importFile(file) {
    const ext = extOf(file.name);
    const base = file.name.replace(/\.[^.]+$/, '');
    if (file.size > 40 * 1024 * 1024) throw new Error('40MB가 넘는 파일은 가져올 수 없습니다.');
    if (ext === 'hwp') throw new Error('예전 HWP 형식은 바로 읽을 수 없습니다. 한글에서 "다른 이름으로 저장 → HWPX"로 저장한 뒤 가져오세요.');
    if (ext === 'doc') throw new Error('예전 DOC 형식은 읽을 수 없습니다. 워드에서 DOCX로 저장한 뒤 가져오세요.');
    if (ext === 'docx') {
      await P.loadScript(VENDOR_MAMMOTH);
      const buf = await readAs(file, 'buffer');
      const res = await window.mammoth.convertToHtml({ arrayBuffer: buf }, {
        styleMap: ['p[style-name=\'Title\'] => h1:fresh', 'p[style-name=\'Subtitle\'] => h2:fresh', 'p[style-name=\'제목\'] => h1:fresh']
      });
      return { html: sanitizeHTML(res.value || ''), title: base };
    }
    if (ext === 'hwpx') return importHWPX(await readAs(file, 'buffer'), base);
    if (ext === 'html' || ext === 'htm') return { html: sanitizeHTML(await readAs(file, 'text')), title: base };
    if (ext === 'txt' || ext === 'md' || ext === 'csv' || !ext) return { html: sanitizeHTML(textToHTML(await readAs(file, 'text'))), title: base };
    throw new Error('지원하지 않는 파일 형식입니다(.' + ext + '). DOCX·HWPX·HTML·TXT를 가져올 수 있습니다.');
  }

  async function importHWPX(buf, fallbackTitle) {
    await P.loadScript(VENDOR_ZIP);
    let zip;
    try { zip = await JSZip.loadAsync(buf); } catch (e) { throw new Error('HWPX 파일을 열지 못했습니다. 손상되었거나 암호가 걸린 파일일 수 있습니다.'); }
    const parse = (s) => {
      const d = new DOMParser().parseFromString(s, 'application/xml');
      if (d.getElementsByTagName('parsererror').length) throw new Error('HWPX 안의 XML을 읽지 못했습니다.');
      return d;
    };
    const kids = (n, name) => Array.from(n ? n.children : []).filter((c) => !name || c.localName === name);
    const kid = (n, name) => kids(n, name)[0] || null;
    const desc = (n, name) => (n ? Array.from(n.getElementsByTagName('*')).filter((c) => c.localName === name) : []);
    // 목차(content.hpf)
    const hpfPath = Object.keys(zip.files).find((p) => /content\.hpf$/i.test(p)) || 'Contents/content.hpf';
    const hpfFile = zip.file(hpfPath);
    const manifest = new Map();
    let title = fallbackTitle;
    let sections = [];
    if (hpfFile) {
      const hpf = parse(await hpfFile.async('string'));
      desc(hpf, 'item').forEach((it) => manifest.set(it.getAttribute('id'), { href: it.getAttribute('href'), type: it.getAttribute('media-type') }));
      const t = desc(hpf, 'title')[0];
      if (t && t.textContent.trim()) title = t.textContent.trim();
      sections = desc(hpf, 'itemref').map((r) => manifest.get(r.getAttribute('idref'))).filter((m) => m && /section\d*\.xml$/i.test(m.href)).map((m) => m.href);
    }
    if (!sections.length) sections = Object.keys(zip.files).filter((p) => /Contents\/section\d+\.xml$/i.test(p)).sort((a, b) => parseInt(a.match(/(\d+)\.xml/)[1], 10) - parseInt(b.match(/(\d+)\.xml/)[1], 10));
    if (!sections.length) throw new Error('HWPX 본문(section)을 찾지 못했습니다.');
    // 머리 정보: 글꼴 · 글자 모양 · 문단 모양 · 테두리/배경
    const fonts = {};
    const chars = {};
    const paras = {};
    const fills = {};
    const headerFile = zip.file(Object.keys(zip.files).find((p) => /Contents\/header\.xml$/i.test(p)) || 'Contents/header.xml');
    if (headerFile) {
      const h = parse(await headerFile.async('string'));
      desc(h, 'fontface').forEach((ff) => { if (ff.getAttribute('lang') === 'HANGUL') kids(ff, 'font').forEach((f) => { fonts[f.getAttribute('id')] = f.getAttribute('face'); }); });
      desc(h, 'charPr').forEach((c) => {
        const fr = kid(c, 'fontRef');
        const ul = kid(c, 'underline');
        const so = kid(c, 'strikeout');
        chars[c.getAttribute('id')] = {
          size: (parseInt(c.getAttribute('height'), 10) || 1000) / 100,
          color: c.getAttribute('textColor'),
          shade: c.getAttribute('shadeColor'),
          font: fr ? fonts[fr.getAttribute('hangul')] : null,
          bold: !!kid(c, 'bold'), italic: !!kid(c, 'italic'),
          underline: !!(ul && ul.getAttribute('type') && ul.getAttribute('type') !== 'NONE'),
          strike: !!(so && so.getAttribute('shape') && so.getAttribute('shape') !== 'NONE'),
          sup: !!kid(c, 'supscript'), sub: !!kid(c, 'subscript')
        };
      });
      desc(h, 'paraPr').forEach((p) => {
        const al = kid(p, 'align');
        const ls = desc(p, 'lineSpacing')[0];
        const left = desc(p, 'left')[0];
        const intent = desc(p, 'intent')[0];
        paras[p.getAttribute('id')] = {
          align: al ? al.getAttribute('horizontal') : 'JUSTIFY',
          lh: ls && ls.getAttribute('type') === 'PERCENT' ? parseInt(ls.getAttribute('value'), 10) : 0,
          left: left ? parseInt(left.getAttribute('value'), 10) || 0 : 0,
          indent: intent ? parseInt(intent.getAttribute('value'), 10) || 0 : 0
        };
      });
      desc(h, 'borderFill').forEach((b) => { const wb = desc(b, 'winBrush')[0]; if (wb && wb.getAttribute('faceColor') && wb.getAttribute('faceColor') !== 'none') fills[b.getAttribute('id')] = wb.getAttribute('faceColor'); });
    }
    const base = chars['0'] || { size: 10 };
    const page = {};
    let textWidthHU = 42520;
    const imgCache = new Map();
    async function imgSrc(id) {
      if (imgCache.has(id)) return imgCache.get(id);
      const m = manifest.get(id);
      let src = '';
      const path = m ? m.href : Object.keys(zip.files).find((p) => new RegExp('BinData/' + id + '\\.', 'i').test(p));
      const f = path && (zip.file(path) || zip.file('Contents/' + path));
      if (f) {
        const ext = extOf(path);
        const mime = (m && m.type) || ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp' }[ext] || '');
        if (/^image\/(png|jpeg|gif|bmp)$/.test(mime)) src = 'data:' + mime + ';base64,' + await f.async('base64');
      }
      imgCache.set(id, src);
      return src;
    }
    function runStyle(cp) {
      const c = chars[cp];
      if (!c) return '';
      const st = [];
      if (c.size && Math.abs(c.size - base.size) > 0.01) st.push('font-size:' + c.size + 'pt');
      if (c.font && c.font !== base.font) st.push('font-family:' + c.font.replace(/[;"<>]/g, ''));
      if (c.color && /^#[0-9a-f]{6}$/i.test(c.color) && c.color.toUpperCase() !== '#000000') st.push('color:' + c.color);
      if (c.shade && /^#[0-9a-f]{6}$/i.test(c.shade) && c.shade.toUpperCase() !== '#FFFFFF') st.push('background-color:' + c.shade);
      if (c.bold) st.push('font-weight:bold');
      if (c.italic) st.push('font-style:italic');
      const td = (c.underline ? 'underline ' : '') + (c.strike ? 'line-through' : '');
      if (td.trim()) st.push('text-decoration-line:' + td.trim());
      if (c.sup) st.push('vertical-align:super');
      if (c.sub) st.push('vertical-align:sub');
      return st.join(';');
    }
    function tText(t) {
      let s = '';
      for (const n of Array.from(t.childNodes)) {
        if (n.nodeType === 3) s += esc(n.nodeValue);
        else if (n.nodeType === 1) {
          if (n.localName === 'lineBreak') s += '<br>';
          else if (n.localName === 'tab') s += '&nbsp;&nbsp;&nbsp;&nbsp;';
          else if (/Space$/.test(n.localName)) s += ' ';
          else s += esc(n.textContent);
        }
      }
      return s.replace(/ {2}/g, ' &nbsp;');
    }
    // 문단 → [블록 HTML...]
    async function convP(p) {
      const out = [];
      let inline = '';
      const flush = () => {
        const pp = paras[p.getAttribute('paraPrIDRef')] || {};
        const st = [];
        if (pp.align && pp.align !== 'JUSTIFY') st.push('text-align:' + ({ LEFT: 'left', CENTER: 'center', RIGHT: 'right', DISTRIBUTE: 'justify' }[pp.align] || 'left'));
        if (pp.lh && pp.lh !== 160) st.push('line-height:' + (pp.lh / 100));
        const firstPx = pp.indent / HU_PER_PX;
        const realLeft = (pp.left - Math.min(0, pp.indent)) / HU_PER_PX;
        if (realLeft > 1) st.push('margin-left:' + Math.round(realLeft) + 'px');
        if (Math.abs(firstPx) > 1) st.push('text-indent:' + Math.round(firstPx) + 'px');
        out.push('<p' + (st.length ? ' style="' + st.join(';') + '"' : '') + '>' + (inline || '<br>') + '</p>');
        inline = '';
      };
      if (p.getAttribute('pageBreak') === '1') out.push('<hr class="docs-pagebreak">');
      for (const run of kids(p, 'run')) {
        const st = runStyle(run.getAttribute('charPrIDRef'));
        for (const c of kids(run)) {
          if (c.localName === 't') { const t = tText(c); if (t) inline += st ? '<span style="' + st + '">' + t + '</span>' : t; }
          else if (c.localName === 'tbl') { if (inline) flush(); out.push(await convTbl(c)); }
          else if (c.localName === 'pic') {
            const img = desc(c, 'img')[0];
            const sz = kid(c, 'curSz') || kid(c, 'sz');
            const src = img ? await imgSrc(img.getAttribute('binaryItemIDRef')) : '';
            if (src) {
              const w = sz ? parseInt(sz.getAttribute('width'), 10) : 0;
              const pct = w ? Math.max(5, Math.min(100, Math.round(w / textWidthHU * 100))) : 50;
              inline += '<img src="' + src + '" style="width:' + pct + '%" alt="">';
            }
          } else if (c.localName === 'secPr') {
            const pp = desc(c, 'pagePr')[0];
            const mg = pp && kid(pp, 'margin');
            if (pp && mg) {
              const mm = (v) => Math.round((parseInt(mg.getAttribute(v), 10) || 0) / HU_PER_MM * 2) / 2;
              page.orient = pp.getAttribute('landscape') === 'NARROWLY' ? 'landscape' : 'portrait';
              page.ml = mm('left'); page.mr = mm('right');
              page.mt = mm('top') + mm('header'); page.mb = mm('bottom') + mm('footer');
              const pw = parseInt(pp.getAttribute('width'), 10) || 59528;
              const ph = parseInt(pp.getAttribute('height'), 10) || 84186;
              const W = page.orient === 'landscape' ? Math.max(pw, ph) : Math.min(pw, ph);
              textWidthHU = Math.max(10000, W - (parseInt(mg.getAttribute('left'), 10) || 0) - (parseInt(mg.getAttribute('right'), 10) || 0));
            }
          } else if (c.localName === 'ctrl') {
            const hd = kid(c, 'header'), ft = kid(c, 'footer');
            if (hd || ft) {
              const txt = desc(hd || ft, 't').map((t) => t.textContent).join('').trim();
              if (txt) page[hd ? 'header' : 'footer'] = { text: txt.slice(0, 120), align: 'center' };
            }
          }
        }
      }
      if (inline || !out.length || out[out.length - 1] === '<hr class="docs-pagebreak">') flush();
      return out;
    }
    async function convTbl(t) {
      const rows = kids(t, 'tr');
      const nCols = parseInt(t.getAttribute('colCnt'), 10) || 1;
      const widths = new Array(nCols).fill(0);
      let h = '';
      for (const tr of rows) {
        h += '<tr>';
        for (const tc of kids(tr, 'tc')) {
          const span = kid(tc, 'cellSpan');
          const addr = kid(tc, 'cellAddr');
          const sz = kid(tc, 'cellSz');
          const cs = span ? parseInt(span.getAttribute('colSpan'), 10) || 1 : 1;
          const rs = span ? parseInt(span.getAttribute('rowSpan'), 10) || 1 : 1;
          const ca = addr ? parseInt(addr.getAttribute('colAddr'), 10) || 0 : 0;
          if (cs === 1 && sz && ca < nCols && !widths[ca]) widths[ca] = parseInt(sz.getAttribute('width'), 10) || 0;
          const bg = fills[tc.getAttribute('borderFillIDRef')];
          let inner = '';
          for (const p of kids(kid(tc, 'subList'), 'p')) inner += (await convP(p)).join('');
          h += '<td' + (cs > 1 ? ' colspan="' + cs + '"' : '') + (rs > 1 ? ' rowspan="' + rs + '"' : '') + (bg ? ' style="background-color:' + bg + '"' : '') + '>' + (inner || '<p><br></p>') + '</td>';
        }
        h += '</tr>';
      }
      const sum = widths.reduce((a, b) => a + b, 0);
      const cg = widths.every((w) => w > 0) ? '<colgroup>' + widths.map((w) => '<col style="width:' + (Math.round(w / sum * 10000) / 100) + '%">').join('') + '</colgroup>' : '';
      return '<table class="docs-table">' + cg + '<tbody>' + h + '</tbody></table>';
    }
    let html = '';
    for (const s of sections) {
      const f = zip.file(s) || zip.file('Contents/' + s.replace(/^.*\//, ''));
      if (!f) continue;
      const doc = parse(await f.async('string'));
      for (const p of kids(doc.documentElement, 'p')) html += (await convP(p)).join('');
    }
    if (base.size) page.size = Math.round(base.size * 2) / 2;
    if (base.font) { const fk = FONTS.find((x) => x.label === base.font); if (fk) page.font = fk.k; }
    return { html: sanitizeHTML(html), title, page };
  }

  async function importFiles(ctx, files, folder) {
    let firstId = null;
    let ok = 0;
    for (const f of files) {
      try {
        const res = await importFile(f);
        const id = P.store.uid();
        const now = new Date().toISOString();
        const text = plainText(res.html);
        await P.store.put(COL, id, { title: res.title || '가져온 문서', html: res.html, page: pageOf(res.page), kind: 'blank', preview: text.slice(0, 140), chars: text.length, createdAt: now, folder: folder || null });
        if (!firstId) firstId = id;
        ok++;
      } catch (e) { P.ui.toast('"' + f.name + '": ' + (e.message || '가져오지 못했습니다.'), 'error'); }
    }
    if (ok) {
      P.ui.toast(ok + '개 문서를 가져왔습니다.', 'ok');
      ctx.navigate(APP_ID + '/' + encodeURIComponent(firstId));
    }
  }

  /* ================= 등록 ================= */
  P.registerApp({
    id: APP_ID,
    title: '문서',
    short: '문서',
    icon: ICON,
    order: 3,
    desc: 'A4 쪽 편집, 공문서 서식·점검, 한글(HWPX)·워드·PDF로 내보내기',
    mount(root, ctx) {
      const id = ctx.params[0];
      if (!id || id === 'f') return mountList(root, ctx);
      return mountEditor(root, ctx, id);
    }
  });
})();
