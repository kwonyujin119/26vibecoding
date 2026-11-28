/* 엑셀: 여러 시트·수식·서식·병합·틀 고정·정렬/필터·조건부 서식·데이터 유효성·XLSX/CSV 가져오기/내보내기 */
(function () {
  'use strict';
  const P = window.P;
  if (!P) return;

  const COL = 'sheets';
  const LIB = { formula: 'vendor/formula/parser.min.js', xlsx: 'vendor/xlsx/xlsx.full.min.js' };
  const DEF_ROWS = 100, DEF_COLS = 26, DEF_W = 96, DEF_H = 26, HEAD_W = 48, HEAD_H = 26;
  const MAX_ROWS = 20000, MAX_COLS = 200, UNDO_MAX = 60;
  const esc = P.esc;

  /* ================= 주소 도구 ================= */
  const K = (r, c) => r + ',' + c;
  function colName(c) {
    let s = '';
    let n = c + 1;
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }
  function colIndex(s) {
    let n = 0;
    for (const ch of s.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  }
  const a1 = (r, c) => colName(c) + (r + 1);
  function parseA1(s) {
    const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/.exec(String(s).trim());
    return m ? { r: +m[2] - 1, c: colIndex(m[1]) } : null;
  }
  function norm(g) {
    return { r1: Math.min(g.r1, g.r2), c1: Math.min(g.c1, g.c2), r2: Math.max(g.r1, g.r2), c2: Math.max(g.c1, g.c2) };
  }
  function parseRange(s) {
    if (!s) return null;
    const parts = String(s).split(':');
    const p = parseA1(parts[0]);
    const q = parts[1] ? parseA1(parts[1]) : p;
    if (!p || !q) return null;
    return norm({ r1: p.r, c1: p.c, r2: q.r, c2: q.c });
  }
  const rangeA1 = (g) => (g.r1 === g.r2 && g.c1 === g.c2 ? a1(g.r1, g.c1) : a1(g.r1, g.c1) + ':' + a1(g.r2, g.c2));
  const inRange = (g, r, c) => r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2;

  /* ================= 날짜 ================= */
  const EPOCH = Date.UTC(1899, 11, 30);
  const toSerial = (y, m, d) => (Date.UTC(y, m - 1, d) - EPOCH) / 86400000;
  function todaySerial() { const d = new Date(); return toSerial(d.getFullYear(), d.getMonth() + 1, d.getDate()); }

  /* ================= 입력 해석 ================= */
  function parseInput(t) {
    if (t == null) return null;
    t = String(t);
    if (t === '') return null;
    if (t[0] === "'") return { v: t.slice(1), text: true };
    if (t[0] === '=' && t.length > 1) return { f: t };
    const s = t.trim();
    let m;
    if (/^[-+]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(s)) {
      const fmt = s.includes(',') ? (s.includes('.') ? '#,##0.00' : '#,##0') : null;
      return { v: Number(s.replace(/,/g, '')), fmt };
    }
    if (/^[-+]?\.\d+$/.test(s)) return { v: Number(s) };
    if ((m = /^([-+]?\d+(?:\.\d+)?)%$/.exec(s))) return { v: Number(m[1]) / 100, fmt: m[1].includes('.') ? '0.0%' : '0%' };
    if ((m = /^([-+]?(?:\d{1,3}(?:,\d{3})+|\d+))원$/.exec(s))) return { v: Number(m[1].replace(/,/g, '')), fmt: '#,##0"원"' };
    if ((m = /^(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})\.?$/.exec(s))) {
      const y = +m[1], mo = +m[2], d = +m[3];
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return { v: toSerial(y, mo, d), fmt: 'yyyy-mm-dd' };
    }
    if ((m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s))) {
      const h = +m[1], mi = +m[2], se = +(m[3] || 0);
      if (h < 24 && mi < 60 && se < 60) return { v: (h * 3600 + mi * 60 + se) / 86400, fmt: m[3] ? 'hh:mm:ss' : 'hh:mm' };
    }
    if (/^(true|false)$/i.test(s)) return { v: /^true$/i.test(s) };
    return { v: t };
  }

  /* ================= 수식 참조 변환 ================= */
  // 시트 접두사(따옴표 포함) + 셀 참조 + 선택적 범위 끝
  const HANGUL = '\\u3131-\\u318E\\uAC00-\\uD7A3';
  const REF_RE = new RegExp(
    "(?<![\\w.$" + HANGUL + "])((?:'(?:[^']|'')+'|[A-Za-z0-9_." + HANGUL + "]+)!)?" +
    '(\\$?)([A-Za-z]{1,3})(\\$?)(\\d{1,7})(?::(\\$?)([A-Za-z]{1,3})(\\$?)(\\d{1,7}))?(?![\\w(' + HANGUL + '])', 'g');
  function sheetOfPrefix(prefix) {
    if (!prefix) return null;
    let s = prefix.slice(0, -1);
    if (s[0] === "'") s = s.slice(1, -1).replace(/''/g, "'");
    return s;
  }
  function quoteSheet(name) {
    return /^[A-Za-z_\u3131-\u318E\uAC00-\uD7A3][A-Za-z0-9_\u3131-\u318E\uAC00-\uD7A3]*$/.test(name) && !/^[A-Za-z]{1,3}\d+$/.test(name)
      ? name : "'" + name.replace(/'/g, "''") + "'";
  }
  // fn(ref) → 바꿀 문자열. ref = { prefix, sheet, a:{r,c,ra,ca}, b:{...}|null }
  function mapRefs(f, fn) {
    if (!f || f[0] !== '=') return f;
    return f.split(/("(?:[^"]|"")*")/).map((seg, i) => {
      if (i % 2 === 1) return seg;
      return seg.replace(REF_RE, (m, prefix, ca, cl, ra, rn, ca2, cl2, ra2, rn2) => {
        const a = { c: colIndex(cl), r: +rn - 1, ca: !!ca, ra: !!ra };
        const b = cl2 ? { c: colIndex(cl2), r: +rn2 - 1, ca: !!ca2, ra: !!ra2 } : null;
        const out = fn({ prefix: prefix || '', sheet: sheetOfPrefix(prefix), a, b });
        return out == null ? m : out;
      });
    }).join('');
  }
  const refStr = (p) => (p.ca ? '$' : '') + colName(p.c) + (p.ra ? '$' : '') + (p.r + 1);
  function shiftFormula(f, dr, dc) {
    return mapRefs(f, (ref) => {
      const mv = (p) => ({ r: p.ra ? p.r : p.r + dr, c: p.ca ? p.c : p.c + dc, ra: p.ra, ca: p.ca });
      const a = mv(ref.a), b = ref.b ? mv(ref.b) : null;
      if (a.r < 0 || a.c < 0 || (b && (b.r < 0 || b.c < 0))) return ref.prefix + '#REF!';
      return ref.prefix + refStr(a) + (b ? ':' + refStr(b) : '');
    });
  }
  // 행/열 삽입(n>0)·삭제(n<0) 시 참조 보정
  function structFormula(f, ownSheet, target, axis, at, n) {
    const T = target.toLowerCase();
    return mapRefs(f, (ref) => {
      const sh = (ref.sheet || ownSheet).toLowerCase();
      if (sh !== T) return null;
      const k = axis === 'r' ? 'r' : 'c';
      const one = (p) => {
        const q = Object.assign({}, p);
        if (n > 0) { if (q[k] >= at) q[k] += n; return q; }
        const d = -n;
        if (q[k] >= at + d) q[k] -= d; else if (q[k] >= at) return null;
        return q;
      };
      if (!ref.b) { const a = one(ref.a); return ref.prefix + (a ? refStr(a) : '#REF!'); }
      const a = Object.assign({}, ref.a), b = Object.assign({}, ref.b);
      if (n > 0) {
        if (a[k] >= at) a[k] += n;
        if (b[k] >= at) b[k] += n;
      } else {
        const d = -n;
        const s = a[k], e = b[k];
        a[k] = s >= at + d ? s - d : s >= at ? at : s;
        b[k] = e >= at + d ? e - d : e >= at ? at - 1 : e;
        if (b[k] < a[k]) return ref.prefix + '#REF!';
      }
      return ref.prefix + refStr(a) + ':' + refStr(b);
    });
  }
  function renameInFormula(f, oldName, newName) {
    const O = oldName.toLowerCase();
    return mapRefs(f, (ref) => (ref.sheet && ref.sheet.toLowerCase() === O
      ? quoteSheet(newName) + '!' + refStr(ref.a) + (ref.b ? ':' + refStr(ref.b) : '') : null));
  }
  function shiftRangeStr(s, axis, at, n) {
    const g = parseRange(s);
    if (!g) return null;
    const k1 = axis === 'r' ? 'r1' : 'c1', k2 = axis === 'r' ? 'r2' : 'c2';
    if (n > 0) { if (g[k1] >= at) g[k1] += n; if (g[k2] >= at) g[k2] += n; return rangeA1(g); }
    const d = -n;
    const s1 = g[k1], e1 = g[k2];
    g[k1] = s1 >= at + d ? s1 - d : s1 >= at ? at : s1;
    g[k2] = e1 >= at + d ? e1 - d : e1 >= at ? at - 1 : e1;
    return g[k2] < g[k1] ? null : rangeA1(g);
  }

  /* ================= 추가 함수 (엔진에 빠진 엑셀 함수 보완) ================= */
  function extraFunctions(FP) {
    const E = FP.FormulaError;
    const flat = (a) => {
      if (!a || a.omitted) return [];
      if (Array.isArray(a.value)) return [].concat(...a.value.map((r) => (Array.isArray(r) ? r : [r])));
      return [a.value];
    };
    const isRef = (a) => a.isArray || a.isRangeRef || a.isCellRef || Array.isArray(a.value);
    const chk = (v) => { if (v instanceof E) throw v; return v; };
    const num = (a) => {
      const v = chk(Array.isArray(a.value) ? flat(a)[0] : a.value);
      if (typeof v === 'number') return v;
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (v == null || v === '') return 0;
      const n = Number(v);
      if (isNaN(n)) throw E.VALUE;
      return n;
    };
    function nums(args, mode) {
      const out = [];
      for (const a of args) {
        if (!a || a.omitted) continue;
        if (isRef(a)) {
          for (const v of flat(a)) {
            chk(v);
            if (typeof v === 'number') out.push(v);
            else if (mode === 'a' && typeof v === 'boolean') out.push(v ? 1 : 0);
            else if (mode === 'a' && typeof v === 'string' && v !== '') out.push(0);
          }
        } else out.push(num(a));
      }
      return out;
    }
    function cmp(a, b, op) {
      switch (op) {
        case '=': return a === b;
        case '<>': return a !== b;
        case '<': return a < b;
        case '>': return a > b;
        case '<=': return a <= b;
        default: return a >= b;
      }
    }
    function crit(cv) {
      chk(cv);
      if (typeof cv === 'number') return (v) => v === cv || (typeof v === 'string' && v.trim() !== '' && Number(v) === cv);
      if (typeof cv === 'boolean') return (v) => v === cv;
      let s = cv == null ? '' : String(cv);
      let op = '=';
      const m = /^(<=|>=|<>|=|<|>)([\s\S]*)$/.exec(s);
      if (m) { op = m[1]; s = m[2]; }
      const n = s.trim() !== '' && !isNaN(Number(s)) ? Number(s) : null;
      if (n !== null) return (v) => (typeof v === 'number' ? cmp(v, n, op) : op === '<>');
      if (op === '=' || op === '<>') {
        if (s === '') return op === '=' ? (v) => v == null || v === '' : (v) => !(v == null || v === '');
        const re = new RegExp('^' + s.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/~\*/g, '\u0001').replace(/~\?/g, '\u0002')
          .replace(/\*/g, '[\\s\\S]*').replace(/\?/g, '[\\s\\S]').replace(/\u0001/g, '\\*').replace(/\u0002/g, '\\?') + '$', 'i');
        const hit = (v) => v != null && !(v instanceof E) && re.test(String(v));
        return op === '=' ? hit : (v) => !hit(v);
      }
      const t = s.toLowerCase();
      return (v) => typeof v === 'string' && cmp(v.toLowerCase(), t, op);
    }
    function pairs(args) {
      if (args.length % 2) throw E.VALUE;
      const out = [];
      for (let i = 0; i < args.length; i += 2) out.push([flat(args[i]), crit(args[i + 1].value)]);
      const len = out[0][0].length;
      if (out.some((p) => p[0].length !== len)) throw E.VALUE;
      return out;
    }
    const hits = (ps, i) => ps.every(([vals, f]) => f(vals[i]));
    function pickIfs(target, conds) {
      const t = flat(target);
      const ps = pairs(conds);
      if (ps[0][0].length !== t.length) throw E.VALUE;
      const out = [];
      for (let i = 0; i < t.length; i++) if (hits(ps, i) && typeof chk(t[i]) === 'number') out.push(t[i]);
      return out;
    }
    const sum = (a) => a.reduce((x, y) => x + y, 0);
    const sorted = (a) => a.slice().sort((x, y) => x - y);
    function pct(a, p) {
      if (!a.length || p < 0 || p > 1) throw E.NUM;
      const s = sorted(a);
      const idx = (s.length - 1) * p;
      const lo = Math.floor(idx), hi = Math.ceil(idx);
      return s[lo] + (s[hi] - s[lo]) * (idx - lo);
    }
    function variance(a, pop) {
      const n = a.length;
      if (n < (pop ? 1 : 2)) throw E.DIV0;
      const m = sum(a) / n;
      return a.reduce((x, v) => x + (v - m) * (v - m), 0) / (pop ? n : n - 1);
    }
    function eqVal(a, b) {
      if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
      return a === b;
    }
    const lt = (a, b) => (typeof a === typeof b ? (typeof a === 'string' ? a.toLowerCase() < b.toLowerCase() : a < b) : typeof a === 'number');
    function findIndex(look, arr, mode, search, wildcard) {
      const n = arr.length;
      const order = search === -1 ? Array.from({ length: n }, (_, i) => n - 1 - i) : Array.from({ length: n }, (_, i) => i);
      const test = wildcard && typeof look === 'string' ? crit('=' + look) : (v) => eqVal(v, look);
      for (const i of order) if (test(arr[i])) return i;
      if (mode === -1 || mode === 1) {
        let best = -1;
        for (const i of order) {
          const v = arr[i];
          if (v == null || v === '' || typeof v !== typeof look) continue;
          if (mode === -1 && lt(v, look) && (best < 0 || lt(arr[best], v))) best = i;
          if (mode === 1 && lt(look, v) && (best < 0 || lt(v, arr[best]))) best = i;
        }
        return best;
      }
      return -1;
    }
    const rank = (n, ref, order, avg) => {
      const a = nums([ref]);
      if (!a.includes(n)) throw E.NA;
      const better = a.filter((v) => (order ? v < n : v > n)).length;
      if (!avg) return better + 1;
      const same = a.filter((v) => v === n).length;
      return better + (same + 1) / 2;
    };
    const subtotalFn = {
      1: (a) => { if (!a.length) throw E.DIV0; return sum(a) / a.length; },
      2: (a) => a.length,
      4: (a) => (a.length ? Math.max(...a) : 0),
      5: (a) => (a.length ? Math.min(...a) : 0),
      6: (a) => a.reduce((x, y) => x * y, 1),
      7: (a) => Math.sqrt(variance(a, false)),
      9: sum
    };

    const str = (v) => {
      chk(v);
      if (v == null) return '';
      if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
      if (typeof v === 'number') return String(+v.toPrecision(15));
      return String(v);
    };
    const F = {
      CHOOSE: (i, ...vals) => {
        const k = Math.trunc(num(i));
        if (k < 1 || k > vals.length) throw E.VALUE;
        return chk(Array.isArray(vals[k - 1].value) ? flat(vals[k - 1])[0] : vals[k - 1].value);
      },
      SWITCH: (expr, ...rest) => {
        const v = chk(expr.value);
        let i = 0;
        for (; i + 1 < rest.length; i += 2) if (eqVal(chk(rest[i].value), v)) return rest[i + 1].value;
        if (i < rest.length) return rest[i].value;
        throw E.NA;
      },
      SUBSTITUTE: (text, oldT, newT, inst) => {
        const s = str(text.value), o = str(oldT.value), n = str(newT.value);
        if (!o) return s;
        if (!inst || inst.omitted) return s.split(o).join(n);
        const k = Math.trunc(num(inst));
        if (k < 1) throw E.VALUE;
        let idx = -1;
        for (let j = 0; j < k; j++) { idx = s.indexOf(o, idx + 1); if (idx < 0) return s; }
        return s.slice(0, idx) + n + s.slice(idx + o.length);
      },
      TEXTJOIN: (d, ign, ...texts) => {
        const sep = str(d.value);
        const skip = !!num(ign);
        const out = [];
        texts.forEach((t) => flat(t).forEach((v) => { const s = str(v); if (!(skip && s === '')) out.push(s); }));
        return out.join(sep);
      },
      MAX:(...a) => { const v = nums(a); return v.length ? Math.max(...v) : 0; },
      MIN: (...a) => { const v = nums(a); return v.length ? Math.min(...v) : 0; },
      MAXA: (...a) => { const v = nums(a, 'a'); return v.length ? Math.max(...v) : 0; },
      MINA: (...a) => { const v = nums(a, 'a'); return v.length ? Math.min(...v) : 0; },
      COUNTA: (...a) => a.reduce((n, x) => n + (x.omitted ? 0 : flat(x).filter((v) => v != null && v !== '').length), 0),
      COUNTBLANK: (a) => flat(a).filter((v) => v == null || v === '').length,
      COUNTIFS: (...a) => { const ps = pairs(a); let n = 0; for (let i = 0; i < ps[0][0].length; i++) if (hits(ps, i)) n++; return n; },
      SUMIFS: (t, ...c) => sum(pickIfs(t, c)),
      AVERAGEIFS: (t, ...c) => { const v = pickIfs(t, c); if (!v.length) throw E.DIV0; return sum(v) / v.length; },
      MAXIFS: (t, ...c) => { const v = pickIfs(t, c); return v.length ? Math.max(...v) : 0; },
      MINIFS: (t, ...c) => { const v = pickIfs(t, c); return v.length ? Math.min(...v) : 0; },
      MEDIAN: (...a) => pct(nums(a), 0.5),
      LARGE: (r, k) => { const s = sorted(nums([r])); const i = num(k); if (i < 1 || i > s.length) throw E.NUM; return s[s.length - i]; },
      SMALL: (r, k) => { const s = sorted(nums([r])); const i = num(k); if (i < 1 || i > s.length) throw E.NUM; return s[i - 1]; },
      'MODE.SNGL': (...a) => {
        const cnt = new Map();
        let best = null, bc = 1;
        for (const v of nums(a)) { const c = (cnt.get(v) || 0) + 1; cnt.set(v, c); if (c > bc) { bc = c; best = v; } }
        if (best === null) throw E.NA;
        return best;
      },
      'STDEV.S': (...a) => Math.sqrt(variance(nums(a), false)),
      'STDEV.P': (...a) => Math.sqrt(variance(nums(a), true)),
      'VAR.S': (...a) => variance(nums(a), false),
      'VAR.P': (...a) => variance(nums(a), true),
      'PERCENTILE.INC': (r, k) => pct(nums([r]), num(k)),
      'QUARTILE.INC': (r, q) => { const k = Math.floor(num(q)); if (k < 0 || k > 4) throw E.NUM; return pct(nums([r]), k / 4); },
      RANK: (n, ref, o) => rank(num(n), ref, o && !o.omitted ? num(o) : 0, false),
      'RANK.AVG': (n, ref, o) => rank(num(n), ref, o && !o.omitted ? num(o) : 0, true),
      MATCH: (look, arr, type) => {
        const t = type && !type.omitted ? num(type) : 1;
        const lv = chk(look.value);
        const a = flat(arr);
        let i;
        if (t === 0) i = findIndex(lv, a, 0, 1, true);
        else {
          i = -1;
          for (let k = 0; k < a.length; k++) {
            const v = a[k];
            if (v == null || v === '' || typeof v !== typeof lv) continue;
            if (eqVal(v, lv)) { i = k; if (t > 0) continue; break; }
            if (t > 0 ? lt(v, lv) : lt(lv, v)) i = k; else break;
          }
        }
        if (i < 0) throw E.NA;
        return i + 1;
      },
      XMATCH: (look, arr, mode, search) => {
        const i = findIndex(chk(look.value), flat(arr), mode && !mode.omitted ? num(mode) : 0,
          search && !search.omitted ? num(search) : 1, mode && !mode.omitted && num(mode) === 2);
        if (i < 0) throw E.NA;
        return i + 1;
      },
      XLOOKUP: (look, arr, ret, nf, mode, search) => {
        const la = flat(arr);
        const m = mode && !mode.omitted ? num(mode) : 0;
        const i = findIndex(chk(look.value), la, m, search && !search.omitted ? num(search) : 1, m === 2);
        if (i < 0) {
          if (nf && !nf.omitted) return nf.value;
          throw E.NA;
        }
        const rv = ret.value;
        if (!Array.isArray(rv)) return rv;
        if (rv.length === la.length) return rv[i][0];
        if (rv[0] && rv[0].length === la.length) return rv[0][i];
        throw E.VALUE;
      },
      LOOKUP: (look, vec, res) => {
        const a = flat(vec);
        const lv = chk(look.value);
        let i = -1;
        for (let k = 0; k < a.length; k++) {
          const v = a[k];
          if (v == null || v === '' || typeof v !== typeof lv) continue;
          if (eqVal(v, lv) || lt(v, lv)) i = k;
        }
        if (i < 0) throw E.NA;
        const r = res && !res.omitted ? flat(res) : a;
        return r[i];
      },
      SUBTOTAL: (fn, ...refs) => {
        let k = num(fn);
        if (k > 100) k -= 100;
        if (k === 3) return F.COUNTA(...refs);
        const f = subtotalFn[k];
        if (!f) throw E.VALUE;
        return f(nums(refs));
      }
    };
    F['MODE'] = F['MODE.SNGL'];
    F.STDEV = F['STDEV.S'];
    F.STDEVP = F['STDEV.P'];
    F.VAR = F['VAR.S'];
    F.VARP = F['VAR.P'];
    F.PERCENTILE = F['PERCENTILE.INC'];
    F.QUARTILE = F['QUARTILE.INC'];
    F['RANK.EQ'] = F.RANK;
    return F;
  }

  // 자주 쓰는 함수 도움말(자동 완성 목록)
  const FUNC_HELP = {
    SUM: '합계', AVERAGE: '평균', COUNT: '숫자 개수', COUNTA: '비어 있지 않은 셀 개수', COUNTBLANK: '빈 셀 개수',
    MAX: '최댓값', MIN: '최솟값', IF: '조건에 따라 값 선택', IFS: '여러 조건', IFERROR: '오류일 때 대체 값',
    VLOOKUP: '세로 방향 찾기', HLOOKUP: '가로 방향 찾기', XLOOKUP: '찾아서 값 가져오기', INDEX: '위치의 값', MATCH: '값의 위치',
    COUNTIF: '조건에 맞는 개수', COUNTIFS: '여러 조건에 맞는 개수', SUMIF: '조건에 맞는 합계', SUMIFS: '여러 조건에 맞는 합계',
    AVERAGEIF: '조건에 맞는 평균', AVERAGEIFS: '여러 조건에 맞는 평균', ROUND: '반올림', ROUNDUP: '올림', ROUNDDOWN: '내림',
    TEXT: '숫자를 서식 문자로', DATE: '날짜 만들기', TODAY: '오늘 날짜', NOW: '현재 시각', YEAR: '연도', MONTH: '월', DAY: '일',
    WEEKDAY: '요일 번호', DATEDIF: '두 날짜 사이', EDATE: '몇 달 뒤 날짜', EOMONTH: '월말 날짜', NETWORKDAYS: '근무일 수',
    WORKDAY: '근무일 기준 날짜', LEFT: '왼쪽 글자', RIGHT: '오른쪽 글자', MID: '가운데 글자', LEN: '글자 수', TRIM: '공백 정리',
    CONCAT: '문자 잇기', TEXTJOIN: '구분자로 잇기', SUBSTITUTE: '문자 바꾸기', RANK: '순위', LARGE: 'k번째 큰 값',
    SMALL: 'k번째 작은 값', MEDIAN: '중앙값', SUMPRODUCT: '곱의 합', ABS: '절댓값', INT: '정수', MOD: '나머지',
    AND: '모두 참', OR: '하나라도 참', NOT: '부정', SUBTOTAL: '부분합', STDEV: '표준편차', CHOOSE: '번호로 고르기',
    MAXIFS: '조건에 맞는 최댓값', MINIFS: '조건에 맞는 최솟값', ISBLANK: '빈 셀인지', ISNUMBER: '숫자인지'
  };

  /* ================= 계산 엔진 ================= */
  function makeEngine(book) {
    const FP = window.FormulaParser;
    const E = FP.FormulaError;
    const cache = new Map();
    const busy = new Set();
    const CIRC = new E('#CIRC!');
    const sheetIndex = (name) => {
      const n = String(name).toLowerCase();
      return book.sheets.findIndex((s) => s.name.toLowerCase() === n);
    };
    function si(name) { const i = sheetIndex(name); if (i < 0) throw E.REF; return i; }
    const parser = new FP({
      onCell: (ref) => value(si(ref.sheet), ref.row - 1, ref.col - 1),
      onRange: (ref) => {
        const i = si(ref.sheet);
        const sh = book.sheets[i];
        const r2 = Math.min(ref.to.row, sh.rows), c2 = Math.min(ref.to.col, sh.cols);
        const out = [];
        for (let r = ref.from.row; r <= r2; r++) {
          const row = [];
          for (let c = ref.from.col; c <= c2; c++) row.push(value(i, r - 1, c - 1));
          out.push(row);
        }
        if (!out.length) out.push([null]);
        return out;
      },
      functions: extraFunctions(FP)
    });
    // 엔진에 비어 있던 CHOOSE를 일반 함수로 다룸
    ['funsNeedContextAndNoDataRetrieve', 'funsNeedContext'].forEach((k) => {
      if (Array.isArray(parser[k])) parser[k] = parser[k].filter((n) => n !== 'CHOOSE');
    });
    function value(i, r, c) {
      const sh = book.sheets[i];
      const cell = sh && sh.cells[K(r, c)];
      if (!cell) return null;
      if (cell.f == null) return cell.v == null ? null : cell.v;
      const key = i + ':' + r + ',' + c;
      if (cache.has(key)) return cache.get(key);
      if (busy.has(key)) return CIRC;
      busy.add(key);
      let res;
      try {
        res = parser.parse(cell.f.slice(1), { sheet: sh.name, row: r + 1, col: c + 1 });
      } catch (e) {
        if (e instanceof E) res = e.error === '#ERROR!' && /implement/i.test(String(e.details || e.message || '')) ? E.NAME : e;
        else res = new E('#ERROR!');
      }
      busy.delete(key);
      if (Array.isArray(res)) res = Array.isArray(res[0]) ? res[0][0] : res[0];
      if (res === undefined || res === null) res = 0;
      cache.set(key, res);
      return res;
    }
    return {
      value,
      reset() { cache.clear(); },
      isErr: (v) => v instanceof E,
      errText: (v) => v.error || v._error || '#ERROR!',
      format: (fmt, v) => { try { return FP.SSF.format(fmt, v); } catch (e) { return String(v); } },
      functionNames: () => Object.keys(parser.functions).filter((n) => !/^_/.test(n)).sort()
    };
  }

  /* ================= 모델 ================= */
  function newSheet(name, rows, cols) {
    return { id: P.store.uid(), name, rows: rows || DEF_ROWS, cols: cols || DEF_COLS, cells: {}, colW: {}, rowH: {}, merges: [], freeze: { r: 0, c: 0 }, cf: [], dv: [], filter: null };
  }
  function newBook(title) {
    return { v: 1, title: title || '새 통합문서', active: 0, sheets: [newSheet('시트1')] };
  }
  function fixBook(b) {
    b = b && typeof b === 'object' ? b : newBook();
    if (!Array.isArray(b.sheets) || !b.sheets.length) b.sheets = [newSheet('시트1')];
    b.sheets.forEach((s, i) => {
      const d = newSheet(s.name || '시트' + (i + 1));
      for (const k in d) if (s[k] == null) s[k] = d[k];
    });
    b.active = Math.min(Math.max(0, b.active | 0), b.sheets.length - 1);
    b.title = b.title || '제목 없음';
    return b;
  }
  function usedBounds(sh) {
    let mr = -1, mc = -1;
    for (const k in sh.cells) {
      const i = k.indexOf(',');
      const r = +k.slice(0, i), c = +k.slice(i + 1);
      if (r > mr) mr = r;
      if (c > mc) mc = c;
    }
    sh.merges.forEach((m) => { if (m.r2 > mr) mr = m.r2; if (m.c2 > mc) mc = m.c2; });
    return { r: mr, c: mc };
  }
  const isEmptyCell = (cell) => !cell || (cell.f == null && (cell.v == null || cell.v === ''));

  /* ================= 템플릿 ================= */
  const HEAD_STYLE = { b: 1, bg: '#e4e7f0', ha: 'center', bd: { t: 1, r: 1, b: 1, l: 1 } };
  const BOX = { bd: { t: 1, r: 1, b: 1, l: 1 } };
  const TOTAL_STYLE = { b: 1, bg: '#f3f1ec', bd: { t: 2, r: 1, b: 1, l: 1 } };
  function sheetFrom(name, rows, opt) {
    const o = opt || {};
    const sh = newSheet(name, Math.max(DEF_ROWS, rows.length + 30), Math.max(DEF_COLS, Math.max(...rows.map((r) => r.length)) + 2));
    rows.forEach((row, r) => row.forEach((raw, c) => {
      const p = parseInput(raw);
      if (!p) return;
      const cell = {};
      if (p.f) cell.f = p.f; else cell.v = p.v;
      if (p.fmt) cell.s = { fmt: p.fmt };
      sh.cells[K(r, c)] = cell;
    }));
    const style = (range, s) => {
      const g = parseRange(range);
      for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) {
        const k = K(r, c);
        const cell = sh.cells[k] || (sh.cells[k] = {});
        cell.s = Object.assign({}, cell.s, JSON.parse(JSON.stringify(s)));
      }
    };
    (o.styles || []).forEach(([range, s]) => style(range, s));
    if (o.widths) o.widths.forEach((w, c) => { if (w) sh.colW[c] = w; });
    if (o.merges) sh.merges = o.merges.map(parseRange);
    if (o.freeze) sh.freeze = o.freeze;
    if (o.cf) sh.cf = o.cf.map((x) => Object.assign({ id: P.store.uid() }, x));
    if (o.dv) sh.dv = o.dv.map((x) => Object.assign({ id: P.store.uid() }, x));
    if (o.rowH) Object.assign(sh.rowH, o.rowH);
    return sh;
  }
  const TEMPLATES = [
    {
      id: 'budget', title: '예산 집행 현황', desc: '예산액·집행액·잔액·집행률 자동 계산, 부진 사업 강조',
      make() {
        const rows = [
          ['2026년 예산 집행 현황'],
          ['기준일', '=TODAY()', '', '', '', '', '(단위: 원)'],
          ['구분', '세부사업', '예산액', '집행액', '잔액', '집행률', '비고']
        ];
        const data = [
          ['운영비', '사무용품 구입', 3000000, 1850000], ['여비', '국내 출장', 5000000, 3200000],
          ['교육훈련비', '직무 교육', 8000000, 7600000], ['업무추진비', '간담회', 2000000, 650000],
          ['자산취득비', '장비 구입', 12000000, 0], ['시설비', '환경 개선', 6500000, 5900000]
        ];
        data.forEach((d, i) => {
          const r = i + 4;
          rows.push([d[0], d[1], String(d[2]), String(d[3]), '=C' + r + '-D' + r, '=IF(C' + r + '=0,0,D' + r + '/C' + r + ')', '=IF(F' + r + '<0.5,"집행 부진","")']);
        });
        rows.push(['합계', '', '=SUM(C4:C9)', '=SUM(D4:D9)', '=SUM(E4:E9)', '=IF(C10=0,0,D10/C10)', '']);
        return sheetFrom('집행현황', rows, {
          widths: [100, 140, 120, 120, 120, 90, 110],
          merges: ['A1:G1'], freeze: { r: 3, c: 0 }, rowH: { 0: 40 },
          styles: [['A1', { b: 1, fs: 18, ha: 'center', va: 'middle' }], ['A2', { b: 1 }], ['B2', { fmt: 'yyyy-mm-dd', ha: 'left' }], ['G2', { ha: 'right', fc: '#5d6880' }],
            ['A3:G3', HEAD_STYLE], ['A4:G9', BOX], ['C4:E10', { fmt: '#,##0' }], ['F4:F10', { fmt: '0.0%' }], ['G4:G9', { fc: '#d23b3b', ha: 'center' }], ['A10:G10', TOTAL_STYLE], ['A10', { ha: 'center' }], ['C4:E10', { fmt: '#,##0' }]],
          cf: [{ range: 'F4:F9', type: 'bar', color: '#5b6fc7' }, { range: 'F4:F9', type: 'lt', a: 0.5, style: 'red' }]
        });
      }
    },
    {
      id: 'travel', title: '출장비 계산', desc: '구분별 기준단가를 찾아 일비·식비·숙박비 자동 계산',
      make() {
        const head = ['연번', '성명', '구분', '출장지', '출발일', '도착일', '일수', '일비', '식비', '숙박비', '교통비', '합계'];
        const people = [['홍길동', '일반', '세종', '2026-11-03', '2026-11-04', '48000'], ['김철수', '관리자', '부산', '2026-11-10', '2026-11-12', '119600'], ['이영희', '일반', '대전', '2026-11-17', '2026-11-17', '23700']];
        const rows = [head];
        const look = (col) => 'IFERROR(VLOOKUP(C{r},기준단가!$A$2:$D$5,' + col + ',FALSE),0)';
        for (let i = 0; i < 8; i++) {
          const r = i + 2;
          const p = people[i] || ['', '', '', '', '', ''];
          rows.push([String(i + 1), p[0], p[1], p[2], p[3], p[4],
            '=IF(OR(E' + r + '="",F' + r + '=""),"",F' + r + '-E' + r + '+1)',
            '=IF(G' + r + '="",0,' + look(2).replace(/\{r\}/g, r) + '*G' + r + ')',
            '=IF(G' + r + '="",0,' + look(3).replace(/\{r\}/g, r) + '*G' + r + ')',
            '=IF(G' + r + '="",0,' + look(4).replace(/\{r\}/g, r) + '*(G' + r + '-1))',
            p[5], '=SUM(H' + r + ':K' + r + ')']);
        }
        rows.push(['합계', '', '', '', '', '', '=SUM(G2:G9)', '=SUM(H2:H9)', '=SUM(I2:I9)', '=SUM(J2:J9)', '=SUM(K2:K9)', '=SUM(L2:L9)']);
        const main = sheetFrom('출장비', rows, {
          widths: [50, 80, 80, 90, 105, 105, 60, 90, 90, 90, 90, 110], freeze: { r: 1, c: 2 },
          styles: [['A1:L1', HEAD_STYLE], ['A2:L9', BOX], ['E2:F9', { fmt: 'yyyy-mm-dd' }], ['H2:L10', { fmt: '#,##0' }], ['A10:L10', TOTAL_STYLE], ['A2:A9', { ha: 'center' }]],
          dv: [{ range: 'C2:C9', type: 'list', items: ['일반', '관리자'], strict: true }]
        });
        const ref = sheetFrom('기준단가', [
          ['구분', '일비(1일)', '식비(1일)', '숙박비 상한(1박)'],
          ['일반', '25000', '25000', '70000'], ['관리자', '25000', '25000', '80000'], ['', '', '', ''], ['', '', '', ''],
          [], ['※ 예시 금액입니다. 소속 기관의 여비 기준에 맞게 고쳐 쓰세요.']
        ], { widths: [90, 110, 110, 130], styles: [['A1:D1', HEAD_STYLE], ['A2:D5', BOX], ['B2:D5', { fmt: '#,##0' }], ['A7', { fc: '#5d6880' }]] });
        return [main, ref];
      }
    },
    {
      id: 'roster', title: '근무표', desc: '한 달 근무 편성, 요일 자동 표시, 근무 유형별 횟수 집계',
      make() {
        const days = Array.from({ length: 31 }, (_, i) => i + 1);
        const L = (i) => colName(i + 1);
        const rows = [
          ['월간 근무표'],
          ['연도', '2026', '월', '12', '', '근무 기호: 주(주간) · 야(야간) · 비(비번) · 휴(휴무) · 연(연가)'],
          [],
          ['성명'].concat(days.map((d) => '=IF(' + d + '>DAY(EOMONTH(DATE($B$2,$D$2,1),0)),"",' + d + ')')).concat(['주간', '야간', '비번', '휴무']),
          ['요일'].concat(days.map((d, i) => '=IF(' + L(i) + '4="","",CHOOSE(WEEKDAY(DATE($B$2,$D$2,' + L(i) + '4)),"일","월","화","수","목","금","토"))'))
        ];
        const cyc = ['주', '야', '비', '휴'];
        ['근무자1', '근무자2', '근무자3', '근무자4', '근무자5', '근무자6'].forEach((n, k) => {
          const r = rows.length + 1;
          rows.push([n].concat(days.map((d) => cyc[(d + k) % 4])).concat(['주', '야', '비', '휴'].map((t) => '=COUNTIF(B' + r + ':AF' + r + ',"' + t + '")')));
        });
        const widths = [80].concat(days.map(() => 34)).concat([48, 48, 48, 48]);
        return sheetFrom('근무표', rows, {
          widths, merges: ['A1:AJ1'], freeze: { r: 5, c: 1 }, rowH: { 0: 36 },
          styles: [['A1', { b: 1, fs: 16, ha: 'center', va: 'middle' }], ['A2', { b: 1 }], ['C2', { b: 1 }], ['F2', { fc: '#5d6880' }],
            ['A4:AJ5', HEAD_STYLE], ['A6:AJ11', BOX], ['B6:AF11', { ha: 'center' }], ['AG6:AJ11', { ha: 'center', b: 1 }]],
          cf: [{ range: 'B5:AF5', type: 'eq', a: '일', style: 'redtext' }, { range: 'B5:AF5', type: 'eq', a: '토', style: 'bluetext' },
            { range: 'B6:AF11', type: 'eq', a: '휴', style: 'green' }, { range: 'B6:AF11', type: 'eq', a: '야', style: 'blue' }],
          dv: [{ range: 'B6:AF11', type: 'list', items: ['주', '야', '비', '휴', '연'], strict: true }]
        });
      }
    },
    {
      id: 'assets', title: '물품 관리대장', desc: '수량×단가 금액 계산, 상태 선택 목록, 상태별 건수 집계',
      make() {
        const rows = [['연번', '물품명', '규격', '단위', '수량', '단가', '금액', '취득일', '보관장소', '상태', '비고', '', '상태', '건수']];
        const items = [['노트북', '15인치', '대', 12, 1350000, '2024-03-15', '사무실 A', '양호'], ['빔프로젝터', '5000안시', '대', 2, 890000, '2023-07-02', '회의실', '수리 필요'],
          ['무전기', '디지털', '대', 20, 420000, '2022-11-20', '장비실', '양호'], ['접이식 의자', '표준형', '개', 60, 35000, '2021-05-10', '창고', '불용'], ['카메라', '미러리스', '대', 3, 1100000, '2025-02-01', '홍보실', '양호']];
        for (let i = 0; i < 10; i++) {
          const r = i + 2;
          const it = items[i] || ['', '', '', '', '', '', '', ''];
          const row = [String(i + 1), it[0], it[1], it[2], String(it[3]), String(it[4]), '=IF(OR(E' + r + '="",F' + r + '=""),"",E' + r + '*F' + r + ')', it[5], it[6], it[7], ''];
          if (i < 3) row.push('', ['양호', '수리 필요', '불용'][i], '=COUNTIF($J$2:$J$11,M' + r + ')');
          rows.push(row);
        }
        rows.push(['합계', '', '', '', '=SUM(E2:E11)', '', '=SUM(G2:G11)']);
        return sheetFrom('물품대장', rows, {
          widths: [50, 120, 90, 50, 60, 100, 120, 105, 100, 90, 100, 20, 90, 60], freeze: { r: 1, c: 2 },
          styles: [['A1:K1', HEAD_STYLE], ['M1:N1', HEAD_STYLE], ['A2:K11', BOX], ['M2:N4', BOX], ['E2:G12', { fmt: '#,##0' }], ['H2:H11', { fmt: 'yyyy-mm-dd' }], ['A12:K12', TOTAL_STYLE], ['A2:A11', { ha: 'center' }], ['J2:J11', { ha: 'center' }]],
          cf: [{ range: 'J2:J11', type: 'eq', a: '불용', style: 'red' }, { range: 'J2:J11', type: 'eq', a: '수리 필요', style: 'yellow' }],
          dv: [{ range: 'J2:J11', type: 'list', items: ['양호', '수리 필요', '불용'], strict: true }]
        });
      }
    },
    {
      id: 'attendance', title: '교육 출석부', desc: 'O/△/X 입력으로 출석률·수료 여부 자동 판정',
      make() {
        const n = 8;
        const L = (i) => colName(3 + i);
        const rows = [['교육 출석부'], ['과정명', '(과정명을 입력하세요)', '', '', '', '', '수료 기준', '80%'],
          ['연번', '성명', '소속'].concat(Array.from({ length: n }, (_, i) => (i + 1) + '회')).concat(['출석', '출석률', '수료'])];
        const names = ['참가자1', '참가자2', '참가자3', '참가자4', '참가자5', '참가자6', '참가자7', '참가자8', '참가자9', '참가자10'];
        const marks = ['O', 'O', 'O', '△', 'O', 'X', 'O', 'O'];
        names.forEach((nm, k) => {
          const r = rows.length + 1;
          rows.push([String(k + 1), nm, '소속' + ((k % 3) + 1)].concat(Array.from({ length: n }, (_, i) => (k === 4 && i > 2 ? 'X' : marks[(i + k) % n])))
            .concat(['=COUNTIF(D' + r + ':K' + r + ',"O")+COUNTIF(D' + r + ':K' + r + ',"△")*0.5', '=L' + r + '/COUNTA($D$3:$K$3)', '=IF(M' + r + '>=$H$2,"수료","미수료")']));
        });
        rows.push(['', '회차별 출석', ''].concat(Array.from({ length: n }, (_, i) => '=COUNTIF(' + L(i) + '4:' + L(i) + '13,"O")')).concat(['', '=AVERAGE(M4:M13)', '=COUNTIF(N4:N13,"수료")&"명 수료"']));
        return sheetFrom('출석부', rows, {
          widths: [50, 90, 80].concat(Array.from({ length: n }, () => 46)).concat([56, 70, 80]),
          merges: ['A1:N1', 'B2:F2'], freeze: { r: 3, c: 2 }, rowH: { 0: 36 },
          styles: [['A1', { b: 1, fs: 16, ha: 'center', va: 'middle' }], ['A2', { b: 1 }], ['G2', { b: 1 }], ['H2', { fmt: '0%' }],
            ['A3:N3', HEAD_STYLE], ['A4:N13', BOX], ['D4:K13', { ha: 'center' }], ['A4:A13', { ha: 'center' }], ['M4:M14', { fmt: '0%' }], ['N4:N13', { ha: 'center' }], ['A14:N14', TOTAL_STYLE]],
          cf: [{ range: 'N4:N13', type: 'eq', a: '미수료', style: 'red' }, { range: 'M4:M13', type: 'bar', color: '#12b886' }],
          dv: [{ range: 'D4:K13', type: 'list', items: ['O', '△', 'X'], strict: true }]
        });
      }
    }
  ];
  function bookFromTemplate(t) {
    const made = t.make();
    const b = newBook(t.title);
    b.sheets = Array.isArray(made) ? made : [made];
    return b;
  }

  /* ================= 파일 입출력 ================= */
  const XERR = { '#NULL!': 0, '#DIV/0!': 7, '#VALUE!': 15, '#REF!': 23, '#NAME?': 29, '#NUM!': 36, '#N/A': 42 };
  function safeSheetName(n, used) {
    let s = String(n || '시트').replace(/[[\]:*?/\\]/g, ' ').slice(0, 31).trim() || '시트';
    let k = 2;
    const base = s;
    while (used.has(s.toLowerCase())) s = (base.slice(0, 27) + ' (' + k++ + ')');
    used.add(s.toLowerCase());
    return s;
  }
  // 엑셀 2010 이후 함수는 파일 안에서 _xlfn. 접두사가 있어야 엑셀이 인식함
  const XLFN = ['XLOOKUP', 'XMATCH', 'IFS', 'SWITCH', 'MAXIFS', 'MINIFS', 'TEXTJOIN', 'CONCAT', 'STDEV.S', 'STDEV.P', 'VAR.S', 'VAR.P', 'RANK.EQ', 'RANK.AVG',
    'MODE.SNGL', 'PERCENTILE.INC', 'QUARTILE.INC', 'DAYS', 'IFNA', 'AGGREGATE', 'NETWORKDAYS.INTL', 'WORKDAY.INTL', 'CEILING.MATH', 'FLOOR.MATH', 'ISOWEEKNUM'];
  const XLFN_RE = new RegExp('(^|[^A-Za-z0-9_.])(' + XLFN.map((n) => n.replace('.', '\\.')).join('|') + ')\\(', 'gi');
  function toXlsxFormula(f) {
    return f.split(/("(?:[^"]|"")*")/).map((seg, i) => (i % 2 ? seg : seg.replace(XLFN_RE, (m, pre, n) => pre + '_xlfn.' + n.toUpperCase() + '('))).join('');
  }
  function bookToXLSX(book, engine) {
    const X = window.XLSX;
    const wb = X.utils.book_new();
    const used = new Set();
    engine.reset();
    book.sheets.forEach((sh, si) => {
      const ws = {};
      const ub = usedBounds(sh);
      for (const k in sh.cells) {
        const [r, c] = k.split(',').map(Number);
        const cell = sh.cells[k];
        const fmt = cell.s && cell.s.fmt;
        if (isEmptyCell(cell) && !fmt) continue;
        const o = {};
        const v = cell.f != null ? engine.value(si, r, c) : cell.v;
        if (engine.isErr(v)) { o.t = 'e'; o.v = XERR[engine.errText(v)] != null ? XERR[engine.errText(v)] : 15; }
        else if (typeof v === 'number') { o.t = 'n'; o.v = v; }
        else if (typeof v === 'boolean') { o.t = 'b'; o.v = v; }
        else if (v == null || v === '') { o.t = cell.f != null ? 's' : 'z'; o.v = ''; }
        else { o.t = 's'; o.v = String(v); }
        if (cell.f != null) o.f = toXlsxFormula(cell.f.slice(1));
        if (fmt) o.z = fmt;
        ws[X.utils.encode_cell({ r, c })] = o;
      }
      ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, ub.r), c: Math.max(0, ub.c) } });
      if (sh.merges.length) ws['!merges'] = sh.merges.map((m) => ({ s: { r: m.r1, c: m.c1 }, e: { r: m.r2, c: m.c2 } }));
      const cols = [];
      for (let c = 0; c <= Math.max(ub.c, 0); c++) cols.push({ wpx: sh.colW[c] || DEF_W });
      ws['!cols'] = cols;
      const rows = [];
      for (const r in sh.rowH) rows[+r] = { hpx: sh.rowH[r] };
      if (rows.length) ws['!rows'] = rows;
      if (sh.filter) ws['!autofilter'] = { ref: rangeA1({ r1: sh.filter.r1, c1: sh.filter.c1, r2: Math.max(sh.filter.r1, ub.r), c2: sh.filter.c2 }) };
      X.utils.book_append_sheet(wb, ws, safeSheetName(sh.name, used));
    });
    return X.write(wb, { type: 'array', bookType: 'xlsx', compression: true });
  }
  function sheetFromSheetJS(name, ws) {
    const X = window.XLSX;
    const ref = ws['!ref'] ? X.utils.decode_range(ws['!ref']) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
    const er = Math.min(ref.e.r, MAX_ROWS - 1), ec = Math.min(ref.e.c, MAX_COLS - 1);
    const sh = newSheet(name, Math.min(MAX_ROWS, Math.max(DEF_ROWS, er + 30)), Math.min(MAX_COLS, Math.max(DEF_COLS, ec + 3)));
    for (const key in ws) {
      if (key[0] === '!') continue;
      const xc = ws[key];
      const { r, c } = X.utils.decode_cell(key);
      if (r > er || c > ec) continue;
      const cell = {};
      if (xc.f) cell.f = '=' + String(xc.f).replace(/_xlfn\.(_xlws\.)?/g, '');
      else if (xc.t === 'n' || xc.t === 'b') cell.v = xc.v;
      else if (xc.t === 'd') cell.v = (new Date(xc.v).getTime() - EPOCH) / 86400000;
      else if (xc.t === 'e') cell.v = xc.w || '#ERROR!';
      else if (xc.t === 's' || xc.t === 'str') cell.v = xc.v == null ? '' : String(xc.v);
      const s = {};
      if (xc.z && xc.z !== 'General') s.fmt = String(xc.z);
      const fill = xc.s && xc.s.fgColor && xc.s.patternType === 'solid' && xc.s.fgColor.rgb;
      if (fill && /^[0-9A-Fa-f]{6,8}$/.test(fill)) s.bg = '#' + fill.slice(-6);
      if (Object.keys(s).length) cell.s = s;
      if (cell.f != null || (cell.v != null && cell.v !== '') || cell.s) sh.cells[K(r, c)] = cell;
    }
    (ws['!merges'] || []).forEach((m) => { if (m.s.r <= er && m.s.c <= ec) sh.merges.push({ r1: m.s.r, c1: m.s.c, r2: Math.min(m.e.r, er), c2: Math.min(m.e.c, ec) }); });
    (ws['!cols'] || []).forEach((col, c) => {
      if (!col || c > ec) return;
      const w = col.wpx || (col.wch ? Math.round(col.wch * 7 + 12) : col.width ? Math.round(col.width * 7 + 5) : 0);
      if (w) sh.colW[c] = Math.max(24, Math.min(600, w));
    });
    (ws['!rows'] || []).forEach((row, r) => { if (row && row.hpx && r <= er) sh.rowH[r] = Math.max(16, Math.min(300, Math.round(row.hpx))); });
    return sh;
  }
  function decodeText(buf) {
    const u8 = new Uint8Array(buf);
    if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) return new TextDecoder('utf-8').decode(u8.subarray(3));
    if (u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder('utf-16le').decode(u8.subarray(2));
    try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch (e) {
      try { return new TextDecoder('euc-kr').decode(u8); } catch (e2) { return new TextDecoder('utf-8').decode(u8); }
    }
  }
  function parseDelimited(text, delim) {
    const d = delim || (text.split('\n', 5).join('\n').includes('\t') ? '\t' : ',');
    const rows = [];
    let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
      } else if (ch === '"' && cur === '') q = true;
      else if (ch === d) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); rows.push(row); row = []; cur = '';
      } else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    while (rows.length && rows[rows.length - 1].every((x) => x === '')) rows.pop();
    return rows;
  }
  function sheetFromRows(name, rows) {
    const nr = Math.min(rows.length, MAX_ROWS);
    const nc = Math.min(Math.max(1, ...rows.slice(0, nr).map((r) => r.length)), MAX_COLS);
    const sh = newSheet(name, Math.max(DEF_ROWS, nr + 30), Math.max(DEF_COLS, nc + 2));
    for (let r = 0; r < nr; r++) for (let c = 0; c < Math.min(rows[r].length, nc); c++) {
      const p = parseInput(rows[r][c]);
      if (!p) continue;
      const cell = p.f ? { f: p.f } : { v: p.v };
      if (p.fmt) cell.s = { fmt: p.fmt };
      sh.cells[K(r, c)] = cell;
    }
    return sh;
  }
  async function readFileAsSheets(file) {
    const name = file.name.replace(/\.[^.]+$/, '');
    const buf = await file.arrayBuffer();
    if (/\.(csv|tsv|txt)$/i.test(file.name)) {
      const text = decodeText(buf);
      return { title: name, sheets: [sheetFromRows(name.slice(0, 31) || '시트1', parseDelimited(text, /\.tsv$/i.test(file.name) ? '\t' : null))] };
    }
    await P.loadScript(LIB.xlsx);
    const wb = window.XLSX.read(buf, { type: 'array', cellFormula: true, cellNF: true, cellStyles: true });
    return { title: name, sheets: wb.SheetNames.map((n) => sheetFromSheetJS(n, wb.Sheets[n])) };
  }
  function csvOf(sh, si, engine, display) {
    const ub = usedBounds(sh);
    const lines = [];
    for (let r = 0; r <= ub.r; r++) {
      const row = [];
      for (let c = 0; c <= ub.c; c++) {
        let t = display(si, r, c);
        if (/[",\n\r]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
        row.push(t);
      }
      lines.push(row.join(','));
    }
    return '\ufeff' + lines.join('\r\n');
  }

  /* ================= 공통 UI 도구 ================= */
  function popMenu(anchor, items, opt) {
    closeMenus();
    const m = document.createElement('div');
    m.className = 'sheets-menu';
    m.setAttribute('role', 'menu');
    items.forEach((it) => {
      if (!it) return;
      if (it.sep) { m.appendChild(Object.assign(document.createElement('div'), { className: 'sheets-menu-sep' })); return; }
      if (it.head) { const h = document.createElement('div'); h.className = 'sheets-menu-head'; h.textContent = it.head; m.appendChild(h); return; }
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.innerHTML = '<span>' + esc(it.label) + '</span>' + (it.key ? '<kbd>' + esc(it.key) + '</kbd>' : it.hint ? '<small>' + esc(it.hint) + '</small>' : '');
      if (it.disabled) b.disabled = true;
      if (it.checked) b.classList.add('on');
      b.addEventListener('click', () => { closeMenus(); it.onClick && it.onClick(); });
      m.appendChild(b);
    });
    document.body.appendChild(m);
    const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    let x, y;
    if (anchor && anchor.getBoundingClientRect) { const r = anchor.getBoundingClientRect(); x = r.left; y = r.bottom + 4; }
    else { x = anchor.x; y = anchor.y; }
    const w = m.offsetWidth, h = m.offsetHeight;
    if (x + w > vw - 8) x = Math.max(8, vw - w - 8);
    if (y + h > vh - 8) y = Math.max(8, (opt && opt.above != null ? opt.above : y) - h - 8);
    m.style.left = x + 'px';
    m.style.top = Math.max(8, y) + 'px';
    const first = m.querySelector('button:not(:disabled)');
    if (first && !(opt && opt.noFocus)) first.focus({ preventScroll: true });
    m.addEventListener('keydown', (e) => {
      const bs = Array.from(m.querySelectorAll('button:not(:disabled)'));
      const i = bs.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (bs[i + 1] || bs[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (bs[i - 1] || bs[bs.length - 1]).focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenus(); }
    });
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
    function outside(e) { if (!m.contains(e.target)) closeMenus(); }
    m._off = () => document.removeEventListener('pointerdown', outside, true);
    return m;
  }
  function closeMenus() {
    document.querySelectorAll('.sheets-menu').forEach((m) => { if (m._off) m._off(); m.remove(); });
  }
  function fieldHTML(label, inner) { return '<div class="field"><label>' + esc(label) + '</label>' + inner + '</div>'; }
  const CF_STYLES = {
    red: { bg: '#ffe3e3', fc: '#c92a2a', label: '연한 빨강 채우기' },
    yellow: { bg: '#fff3bf', fc: '#8a6100', label: '연한 노랑 채우기' },
    green: { bg: '#d3f9d8', fc: '#2b8a3e', label: '연한 초록 채우기' },
    blue: { bg: '#dbe4ff', fc: '#364fc7', label: '연한 파랑 채우기' },
    redtext: { fc: '#e03131', b: 1, label: '빨간 굵은 글자' },
    bluetext: { fc: '#1c7ed6', b: 1, label: '파란 굵은 글자' },
    bold: { b: 1, label: '굵게' }
  };
  const CF_TYPES = {
    gt: '보다 큼', lt: '보다 작음', between: '사이(이상·이하)', eq: '같음', neq: '같지 않음', contains: '텍스트 포함',
    dup: '중복 값', top: '상위 N개', bottom: '하위 N개', above: '평균 초과', below: '평균 미만', bar: '데이터 막대', scale: '색조(낮음→높음)'
  };
  const FORMATS = [
    ['General', '일반'], ['#,##0', '숫자(1,234)'], ['#,##0.00', '숫자(1,234.56)'], ['#,##0"원"', '원(1,234원)'], ['₩#,##0', '통화(₩1,234)'],
    ['0%', '백분율(12%)'], ['0.0%', '백분율(12.3%)'], ['yyyy-mm-dd', '날짜(2026-01-31)'], ['yyyy"년" m"월" d"일"', '날짜(2026년 1월 31일)'],
    ['yyyy. m. d.', '날짜(2026. 1. 31.)'], ['hh:mm', '시간(13:30)'], ['@', '텍스트']
  ];

  /* ================= 편집기 ================= */
  function createEditor(root, book, id, ctx) {
    const engine = makeEngine(book);
    let funcNames = null;
    const st = {
      sel: { r1: 0, c1: 0, r2: 0, c2: 0 }, act: { r: 0, c: 0 },
      editing: null, undo: [], redo: [], clip: null, point: null,
      rendered: { start: 0, end: -1 }, saveTimer: null, saving: false, dirty: false, destroyed: false, touch: false
    };
    const cur = () => book.sheets[book.active];
    let G = null; // 현재 시트 기하 정보
    let tdMap = new Map();

    root.innerHTML =
      '<div class="sheets-ed">' +
        '<div class="sheets-top">' +
          '<a class="btn btn-ghost btn-sm sheets-back" href="' + P.files.backHref('sheets', book.folder) + '" title="목록으로" aria-label="목록으로"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg><span class="sheets-back-lbl">목록</span></a>' +
          '<span class="sheets-doc-ic" aria-hidden="true">' + P.icons.sheet + '</span>' +
          '<input class="sheets-title" aria-label="통합문서 이름" maxlength="80">' +
          '<span class="sheets-save" data-state="saved" aria-live="polite">저장됨</span>' +
          '<div class="sheets-top-actions">' +
            '<span class="sheets-io"></span>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-act="print" title="현재 시트 인쇄 (Ctrl+P)">' + IC_PRINT + '<span>인쇄</span></button>' +
            '<button type="button" class="btn btn-sm" data-act="chart" title="선택 영역으로 차트 만들기">' + P.icons.chart + '<span>차트 만들기</span></button>' +
            '<button type="button" class="btn btn-ghost btn-sm p-icon-btn" data-act="help" title="단축키" aria-label="단축키 도움말">' + IC_KEYS + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="sheets-ribbon" role="toolbar" aria-label="서식 도구"></div>' +
        '<div class="sheets-fbar">' +
          '<input class="sheets-name" aria-label="셀 주소(이동하려면 입력 후 Enter)" spellcheck="false">' +
          '<button type="button" class="sheets-fx" title="함수 넣기" aria-label="함수 넣기"><i>fx</i></button>' +
          '<input class="sheets-formula" aria-label="수식 입력줄" spellcheck="false" autocomplete="off">' +
        '</div>' +
        '<div class="sheets-wrap">' +
          '<table class="sheets-grid" role="grid" aria-label="시트"></table>' +
          '<textarea class="sheets-input" aria-label="셀 입력" spellcheck="false" autocomplete="off" autocapitalize="off" rows="1"></textarea>' +
          '<div class="sheets-fill" title="끌어서 채우기"></div>' +
          '<button type="button" class="sheets-dvbtn" tabindex="-1" aria-label="목록에서 고르기"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
        '</div>' +
        '<div class="sheets-ac" role="listbox" hidden></div>' +
        '<div class="sheets-bottom"><div class="sheets-tabs" role="tablist" aria-label="시트 목록"></div><div class="sheets-stat" aria-live="polite"></div></div>' +
      '</div>';
    const $ = (s) => root.querySelector(s);
    const wrap = $('.sheets-wrap'), table = $('.sheets-grid'), inp = $('.sheets-input'), fill = $('.sheets-fill'), dvbtn = $('.sheets-dvbtn');
    const nameBox = $('.sheets-name'), fx = $('.sheets-formula'), titleIn = $('.sheets-title'), saveEl = $('.sheets-save');
    const acBox = $('.sheets-ac'), tabsEl = $('.sheets-tabs'), statEl = $('.sheets-stat'), ribbon = $('.sheets-ribbon');
    titleIn.value = book.title;

    /* ---------- 저장 ---------- */
    function setSave(state, text) { saveEl.dataset.state = state; saveEl.textContent = text; }
    function scheduleSave() {
      st.dirty = true;
      setSave('pending', '저장 중…');
      clearTimeout(st.saveTimer);
      st.saveTimer = setTimeout(saveNow, 1000);
    }
    async function saveNow() {
      clearTimeout(st.saveTimer);
      if (!st.dirty) return;
      st.dirty = false;
      try {
        await P.store.put(COL, id, book);
        if (!st.dirty) setSave('saved', '저장됨');
      } catch (e) {
        st.dirty = true;
        setSave('error', '저장 실패');
      }
    }

    /* ---------- 실행 취소 ---------- */
    const snap = () => JSON.stringify({ sheets: book.sheets, active: book.active });
    function pushUndo() {
      st.undo.push(snap());
      if (st.undo.length > UNDO_MAX) st.undo.shift();
      st.redo.length = 0;
    }
    function restore(json) {
      const o = JSON.parse(json);
      book.sheets = o.sheets;
      book.active = Math.min(o.active, o.sheets.length - 1);
      clampSel();
      changed();
    }
    function undo() { if (!st.undo.length) return P.ui.toast('되돌릴 작업이 없습니다.'); st.redo.push(snap()); restore(st.undo.pop()); }
    function redo() { if (!st.redo.length) return P.ui.toast('다시 실행할 작업이 없습니다.'); st.undo.push(snap()); restore(st.redo.pop()); }
    function changed() { scheduleSave(); render(); }

    /* ---------- 값 표시 ---------- */
    function general(v) {
      if (Number.isInteger(v)) return Math.abs(v) >= 1e15 ? v.toExponential(4) : String(v);
      const a = Math.abs(v);
      if (a !== 0 && (a < 1e-9 || a >= 1e15)) return v.toExponential(4);
      return String(+v.toPrecision(11));
    }
    const DATE_FN = /^=\s*(TODAY|DATE|EDATE|EOMONTH|WORKDAY|DATEVALUE)\(/i;
    function display(si, r, c) {
      const sh = book.sheets[si];
      const cell = sh.cells[K(r, c)];
      if (!cell) return { t: '', k: 'empty', v: null };
      const v = cell.f != null ? engine.value(si, r, c) : cell.v;
      if (v == null || v === '') return { t: '', k: 'empty', v: null };
      if (engine.isErr(v)) return { t: engine.errText(v), k: 'err', v };
      if (typeof v === 'boolean') return { t: v ? 'TRUE' : 'FALSE', k: 'bool', v };
      if (typeof v === 'number') {
        if (!isFinite(v)) return { t: '#NUM!', k: 'err', v };
        let fmt = cell.s && cell.s.fmt;
        if (!fmt && cell.f && DATE_FN.test(cell.f)) fmt = 'yyyy-mm-dd';
        return { t: fmt && fmt !== 'General' && fmt !== '@' ? engine.format(fmt, v) : general(v), k: 'num', v };
      }
      return { t: String(v), k: 'text', v };
    }
    const dispText = (si, r, c) => display(si, r, c).t;
    function rawText(cell) {
      if (!cell) return '';
      if (cell.f != null) return cell.f;
      const v = cell.v;
      if (v == null) return '';
      const fmt = cell.s && cell.s.fmt;
      if (typeof v === 'number' && fmt) {
        if (/y|d/.test(fmt.replace(/"[^"]*"/g, '')) && !/h|s/.test(fmt.replace(/"[^"]*"/g, ''))) return engine.format('yyyy-mm-dd', v);
        if (/^hh:mm/.test(fmt)) return engine.format(fmt, v);
        if (/%$/.test(fmt)) return +(v * 100).toPrecision(12) + '%';
      }
      if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
      return String(v);
    }

    /* ---------- 기하 ---------- */
    const colW = (sh, c) => sh.colW[c] || DEF_W;
    const rowH = (sh, r) => sh.rowH[r] || DEF_H;
    function filterLast(sh) { return Math.max(sh.filter.r1, usedBounds(sh).r); }
    function hiddenRows(sh) {
      const hid = new Set();
      const f = sh.filter;
      if (!f || !f.cond || !Object.keys(f.cond).length) return hid;
      const last = filterLast(sh);
      const si = book.active;
      const conds = Object.keys(f.cond).map((c) => [+c, new Set(f.cond[c])]);
      for (let r = f.r1 + 1; r <= last; r++) {
        for (const [c, set] of conds) if (!set.has(dispText(si, r, c))) { hid.add(r); break; }
      }
      return hid;
    }
    function computeGeom() {
      const sh = cur();
      const hidden = hiddenRows(sh);
      const tops = new Float64Array(sh.rows + 1);
      for (let r = 0; r < sh.rows; r++) tops[r + 1] = tops[r] + (hidden.has(r) ? 0 : rowH(sh, r));
      const lefts = new Float64Array(sh.cols + 1);
      for (let c = 0; c < sh.cols; c++) lefts[c + 1] = lefts[c] + colW(sh, c);
      const fr = Math.min(sh.freeze.r || 0, sh.rows), fc = Math.min(sh.freeze.c || 0, sh.cols);
      const mergeAt = new Map();
      const covered = new Set();
      sh.merges.forEach((m) => {
        for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) {
          if (r === m.r1 && c === m.c1) mergeAt.set(K(r, c), m); else covered.add(K(r, c));
        }
      });
      G = { sh, hidden, tops, lefts, fr, fc, mergeAt, covered, frH: tops[fr], frW: lefts[fc] };
    }
    function mergeOf(r, c) {
      return cur().merges.find((m) => r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2) || null;
    }
    function lowerBound(arr, y) {
      let lo = 0, hi = arr.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < y) lo = mid + 1; else hi = mid; }
      return lo;
    }
    function wantedRows(buffer) {
      const { tops, fr, sh } = G;
      const s = wrap.scrollTop, h = wrap.clientHeight || 600;
      let start = Math.max(fr, lowerBound(tops, s - buffer) - 1);
      let end = Math.min(sh.rows - 1, lowerBound(tops, s + h + buffer));
      sh.merges.forEach((m) => { if (m.r1 >= fr && m.r1 < start && m.r2 >= start) start = m.r1; });
      return { start, end };
    }

    /* ---------- 조건부 서식 ---------- */
    function prepCF(sh, si) {
      return (sh.cf || []).map((rule) => {
        const g = parseRange(rule.range);
        if (!g) return null;
        const x = { rule, g };
        if (['dup', 'top', 'bottom', 'above', 'below', 'bar', 'scale'].includes(rule.type)) {
          const vals = [];
          const cnt = new Map();
          const r2 = Math.min(g.r2, sh.rows - 1), c2 = Math.min(g.c2, sh.cols - 1);
          for (let r = g.r1; r <= r2; r++) for (let c = g.c1; c <= c2; c++) {
            const d = display(si, r, c);
            if (d.k === 'num') vals.push(d.v);
            if (d.k !== 'empty') cnt.set(d.t, (cnt.get(d.t) || 0) + 1);
          }
          const s = vals.slice().sort((a, b) => a - b);
          x.min = s[0]; x.max = s[s.length - 1]; x.cnt = cnt;
          x.avg = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
          const n = Math.max(1, +rule.a || 10);
          x.topT = s[Math.max(0, s.length - n)]; x.botT = s[Math.min(s.length - 1, n - 1)];
        }
        return x;
      }).filter(Boolean);
    }
    function cfFor(cfs, d, r, c) {
      let style = null, bar = null, scale = null;
      for (const x of cfs) {
        if (!inRange(x.g, r, c)) continue;
        const R = x.rule, v = d.v;
        const n = typeof v === 'number' ? v : null;
        const A = Number(R.a), B = Number(R.b);
        const sa = String(R.a == null ? '' : R.a);
        let hit = false;
        switch (R.type) {
          case 'gt': hit = n != null && n > A; break;
          case 'lt': hit = n != null && n < A; break;
          case 'between': hit = n != null && n >= Math.min(A, B) && n <= Math.max(A, B); break;
          case 'eq': hit = d.k !== 'empty' && (n != null && sa.trim() !== '' && !isNaN(A) ? n === A : d.t === sa); break;
          case 'neq': hit = d.k !== 'empty' && !(n != null && !isNaN(A) ? n === A : d.t === sa); break;
          case 'contains': hit = d.k !== 'empty' && sa !== '' && d.t.toLowerCase().includes(sa.toLowerCase()); break;
          case 'dup': hit = d.k !== 'empty' && x.cnt.get(d.t) > 1; break;
          case 'top': hit = n != null && n >= x.topT; break;
          case 'bottom': hit = n != null && n <= x.botT; break;
          case 'above': hit = n != null && n > x.avg; break;
          case 'below': hit = n != null && n < x.avg; break;
          case 'bar':
            if (n != null && x.max != null) {
              const lo = Math.min(0, x.min), span = x.max - lo || 1;
              bar = { pct: Math.max(0, Math.min(100, ((n - lo) / span) * 100)), color: R.color || '#4c6ef5' };
            }
            break;
          case 'scale':
            if (n != null && x.max != null) scale = { t: x.max === x.min ? 1 : (n - x.min) / (x.max - x.min), color: R.color || '#2f9e44' };
            break;
        }
        if (hit && !style) style = CF_STYLES[R.style] || CF_STYLES.red;
      }
      return { style, bar, scale };
    }
    function mix(hex, t) {
      const h = hex.replace('#', '');
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      const k = 0.12 + 0.88 * t;
      const m = (x) => Math.round(255 + (x - 255) * k);
      return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')';
    }

    function inkFor(bg) {
      const m = /^#?([0-9a-f]{6})$/i.exec(bg) || /^rgb\((\d+),(\d+),(\d+)\)$/.exec(bg);
      if (!m) return 'inherit';
      let r, g, b;
      if (m.length === 2) { r = parseInt(m[1].slice(0, 2), 16); g = parseInt(m[1].slice(2, 4), 16); b = parseInt(m[1].slice(4, 6), 16); }
      else { r = +m[1]; g = +m[2]; b = +m[3]; }
      return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1b1f2a' : '#ffffff';
    }

    /* ---------- 그리기 ---------- */
    function render() {
      if (st.destroyed) return;
      engine.reset();
      clampSel();
      computeGeom();
      renderGrid(true);
      renderTabs();
      paintSel();
    }
    function renderGrid(force) {
      const { sh, tops, lefts, fr, fc, mergeAt, covered, hidden } = G;
      const want = wantedRows(0);
      if (!force && want.start >= st.rendered.start && want.end <= st.rendered.end) return false;
      const { start, end } = wantedRows(300);
      st.rendered = { start, end };
      const si = book.active;
      const cfs = prepCF(sh, si);
      const dvs = (sh.dv || []).filter((d) => d.type === 'list').map((d) => parseRange(d.range)).filter(Boolean);
      const f = sh.filter;
      const ncol = sh.cols;
      const out = [];
      out.push('<colgroup><col style="width:' + HEAD_W + 'px">');
      for (let c = 0; c < ncol; c++) out.push('<col style="width:' + colW(sh, c) + 'px">');
      out.push('</colgroup><thead><tr style="height:' + HEAD_H + 'px"><th class="sheets-corner" title="전체 선택"></th>');
      for (let c = 0; c < ncol; c++) {
        const fz = c < fc;
        out.push('<th class="sheets-ch' + (fz ? ' fzc' : '') + (c === fc - 1 ? ' fzrt' : '') + '" data-c="' + c + '"' + (fz ? ' style="left:' + (HEAD_W + lefts[c]) + 'px"' : '') + '>' + colName(c) + '<i class="sheets-rsz" data-rc="' + c + '"></i></th>');
      }
      out.push('</tr></thead><tbody>');
      const rowsHTML = (r, frozen) => {
        if (hidden.has(r)) return;
        const h = rowH(sh, r);
        const top = frozen ? 'top:' + (HEAD_H + tops[r]) + 'px;' : '';
        out.push('<tr style="height:' + h + 'px"><th class="sheets-rh' + (frozen ? ' fzr' : '') + (r === fr - 1 ? ' fzb' : '') + '" data-r="' + r + '" style="' + top + '">' + (r + 1) + '<i class="sheets-rszr" data-rr="' + r + '"></i></th>');
        for (let c = 0; c < ncol; c++) {
          const k = K(r, c);
          if (covered.has(k)) continue;
          const m = mergeAt.get(k);
          let rs = 1, cs = 1, hh = h;
          if (m) {
            const lastR = frozen ? Math.min(m.r2, fr - 1) : Math.min(m.r2, end);
            rs = 0; hh = 0;
            for (let rr = m.r1; rr <= lastR; rr++) if (!hidden.has(rr)) { rs++; hh += rowH(sh, rr); }
            rs = Math.max(1, rs);
            cs = Math.min(m.c2, ncol - 1) - m.c1 + 1;
          }
          const cell = sh.cells[k];
          const s = (cell && cell.s) || {};
          const d = display(si, r, c);
          let cls = 'c';
          let css = '';
          if (frozen) { cls += ' fzr'; css += top; }
          if (c < fc) { cls += ' fzc'; css += 'left:' + (HEAD_W + lefts[c]) + 'px;'; }
          if ((m ? Math.min(m.r2, end) : r) === fr - 1) cls += ' fzb';
          if (c + cs - 1 === fc - 1) cls += ' fzrt';
          if (d.k === 'err') cls += ' err';
          if (s.wrap) cls += ' wrap';
          const cf = cfs.length && d.k !== 'empty' ? cfFor(cfs, d, r, c) : null;
          const st2 = Object.assign({}, s, cf && cf.style ? { bg: cf.style.bg || s.bg, fc: cf.style.fc || s.fc, b: cf.style.b || s.b } : null);
          if (st2.b) css += 'font-weight:700;';
          if (st2.i) css += 'font-style:italic;';
          if (st2.u || st2.st) css += 'text-decoration:' + (st2.u ? 'underline ' : '') + (st2.st ? 'line-through' : '') + ';';
          let bg = st2.bg || '';
          if (cf && cf.scale) bg = mix(cf.scale.color, cf.scale.t);
          if (st2.fc) css += 'color:' + st2.fc + ';';
          else if (bg) css += 'color:' + inkFor(bg) + ';';
          if (bg) { css += 'background-color:' + bg + ';'; cls += ' hasbg'; }
          if (cf && cf.bar) css += 'background-image:linear-gradient(90deg,' + cf.bar.color + '66 ' + cf.bar.pct.toFixed(1) + '%,transparent ' + cf.bar.pct.toFixed(1) + '%);';
          if (st2.fs) css += 'font-size:' + st2.fs + 'px;';
          const bd = st2.bd;
          if (bd) {
            const sh2 = [];
            if (bd.t) sh2.push('inset 0 ' + bd.t + 'px 0 var(--text)');
            if (bd.l) sh2.push('inset ' + bd.l + 'px 0 0 var(--text)');
            if (sh2.length) css += 'box-shadow:' + sh2.join(',') + ';';
            if (bd.r) css += 'border-right:' + bd.r + 'px solid var(--text);';
            if (bd.b) css += 'border-bottom:' + bd.b + 'px solid var(--text);';
          }
          const ha = st2.ha || (d.k === 'num' ? 'right' : d.k === 'bool' || d.k === 'err' ? 'center' : 'left');
          const va = st2.va || 'middle';
          let shown = d.t;
          if (d.k === 'num' && !(s.fmt) && shown.includes('.') && !/e/i.test(shown)) {
            const fit = Math.max(4, Math.floor((colW(sh, c) - 10) / ((st2.fs || 13) * 0.6)));
            if (shown.length > fit) {
              const dec = Math.max(0, fit - shown.indexOf('.') - 1);
              shown = String(+d.v.toFixed(dec));
            }
          }
          let inner = esc(shown);
          if (f && r === f.r1 && c >= f.c1 && c <= f.c2) {
            cls += ' fhead';
            inner += '<button type="button" class="sheets-fbtn' + (f.cond && f.cond[c] ? ' on' : '') + '" data-fc="' + c + '" aria-label="' + colName(c) + '열 필터">▾</button>';
          }
          if (dvs.length && dvs.some((g) => inRange(g, r, c))) cls += ' dvl';
          // 글자가 넘치면 오른쪽 빈 셀로 이어서 표시(엑셀과 같은 방식)
          let ctW = '';
          if (!m && d.k === 'text' && ha === 'left' && !st2.wrap && c >= fc) {
            let w = colW(sh, c), cc = c + 1;
            const need = d.t.length * ((st2.fs || 13) + 1);
            while (w < need && cc < ncol && cc < c + 12 && isEmptyCell(sh.cells[K(r, cc)]) && !covered.has(K(r, cc)) && !mergeAt.has(K(r, cc))) { w += colW(sh, cc); cc++; }
            if (cc > c + 1) { cls += ' ovf'; ctW = 'width:' + (w - 1) + 'px;'; }
          }
          out.push('<td class="' + cls + '" data-r="' + r + '" data-c="' + c + '"' + (m ? ' rowspan="' + rs + '" colspan="' + cs + '" data-r2="' + m.r2 + '" data-c2="' + m.c2 + '"' : '') +
            (css ? ' style="' + css + '"' : '') + '><div class="ct" style="' + ctW + 'height:' + (hh - 1) + 'px;justify-content:' + (ha === 'right' ? 'flex-end' : ha === 'center' ? 'center' : 'flex-start') +
            ';text-align:' + ha + ';align-items:' + (va === 'top' ? 'flex-start' : va === 'bottom' ? 'flex-end' : 'center') + '">' + inner + '</div></td>');
        }
        out.push('</tr>');
      };
      for (let r = 0; r < fr; r++) rowsHTML(r, true);
      const padTop = tops[start] - tops[fr];
      if (padTop > 0) out.push('<tr class="sheets-sp" style="height:' + padTop + 'px"><td colspan="' + (ncol + 1) + '"></td></tr>');
      for (let r = start; r <= end; r++) rowsHTML(r, false);
      const padBot = tops[sh.rows] - tops[end + 1];
      if (padBot > 0) out.push('<tr class="sheets-sp" style="height:' + padBot + 'px"><td colspan="' + (ncol + 1) + '"></td></tr>');
      out.push('</tbody>');
      table.style.width = (HEAD_W + lefts[ncol]) + 'px';
      table.innerHTML = out.join('');
      tdMap = new Map();
      table.querySelectorAll('td.c').forEach((td) => tdMap.set(td.dataset.r + ',' + td.dataset.c, td));
      return true;
    }

    /* ---------- 선택 표시 ---------- */
    function clampSel() {
      const sh = cur();
      const cl = (v, max) => Math.max(0, Math.min(max - 1, v));
      st.sel = { r1: cl(st.sel.r1, sh.rows), c1: cl(st.sel.c1, sh.cols), r2: cl(st.sel.r2, sh.rows), c2: cl(st.sel.c2, sh.cols) };
      st.act = { r: cl(st.act.r, sh.rows), c: cl(st.act.c, sh.cols) };
    }
    function selRange() {
      // 병합 셀을 포함하도록 확장
      let g = norm(st.sel);
      const ms = cur().merges;
      let grew = true;
      while (grew) {
        grew = false;
        for (const m of ms) {
          if (m.r2 < g.r1 || m.r1 > g.r2 || m.c2 < g.c1 || m.c1 > g.c2) continue;
          const n = { r1: Math.min(g.r1, m.r1), c1: Math.min(g.c1, m.c1), r2: Math.max(g.r2, m.r2), c2: Math.max(g.c2, m.c2) };
          if (n.r1 !== g.r1 || n.c1 !== g.c1 || n.r2 !== g.r2 || n.c2 !== g.c2) { g = n; grew = true; }
        }
      }
      return g;
    }
    function paintSel() {
      const g = selRange();
      const am = mergeOf(st.act.r, st.act.c);
      const ar = am ? am.r1 : st.act.r, ac = am ? am.c1 : st.act.c;
      const multi = g.r1 !== g.r2 || g.c1 !== g.c2;
      tdMap.forEach((td) => {
        const r = +td.dataset.r, c = +td.dataset.c;
        const r2 = td.dataset.r2 ? +td.dataset.r2 : r, c2 = td.dataset.c2 ? +td.dataset.c2 : c;
        const inside = r >= g.r1 && r2 <= g.r2 && c >= g.c1 && c2 <= g.c2;
        const isAct = r === ar && c === ac;
        const cl = td.classList;
        cl.toggle('in', inside && multi && !isAct);
        cl.toggle('act', isAct);
        cl.toggle('et', inside && r === g.r1);
        cl.toggle('eb', inside && r2 === g.r2);
        cl.toggle('el', inside && c === g.c1);
        cl.toggle('er', inside && c2 === g.c2);
      });
      table.querySelectorAll('.sheets-ch').forEach((th) => { const c = +th.dataset.c; th.classList.toggle('hl', c >= g.c1 && c <= g.c2); });
      table.querySelectorAll('.sheets-rh').forEach((th) => { const r = +th.dataset.r; th.classList.toggle('hl', r >= g.r1 && r <= g.r2); });
      placeOverlays();
      if (document.activeElement !== nameBox) nameBox.value = multi ? rangeA1(g) : a1(st.act.r, st.act.c);
      if (!st.editing && document.activeElement !== fx) fx.value = rawText(cur().cells[K(ar, ac)]);
      updateStat(g);
    }
    function tdFor(r, c) {
      const m = mergeOf(r, c);
      return tdMap.get(m ? m.r1 + ',' + m.c1 : r + ',' + c) || null;
    }
    function relRect(td) {
      const wr = wrap.getBoundingClientRect(), tr = td.getBoundingClientRect();
      return { x: tr.left - wr.left + wrap.scrollLeft, y: tr.top - wr.top + wrap.scrollTop, w: tr.width, h: tr.height };
    }
    function placeOverlays() {
      const g = selRange();
      const tdEnd = tdFor(g.r2, g.c2);
      if (tdEnd && !st.editing) {
        const R = relRect(tdEnd);
        fill.style.transform = 'translate(' + (R.x + R.w - 5) + 'px,' + (R.y + R.h - 5) + 'px)';
        fill.hidden = false;
      } else fill.hidden = true;
      const tdA = tdFor(st.act.r, st.act.c);
      if (tdA) {
        const R = relRect(tdA);
        if (!st.editing) {
          inp.style.transform = 'translate(' + R.x + 'px,' + R.y + 'px)';
          inp.style.width = R.w + 'px';
          inp.style.height = R.h + 'px';
        }
        const dv = dvAt(st.act.r, st.act.c);
        if (dv && dv.type === 'list' && !st.editing) {
          dvbtn.hidden = false;
          dvbtn.style.transform = 'translate(' + (R.x + R.w + 1) + 'px,' + (R.y + (R.h - 22) / 2) + 'px)';
        } else dvbtn.hidden = true;
      } else dvbtn.hidden = true;
    }
    function updateStat(g) {
      const n = (g.r2 - g.r1 + 1) * (g.c2 - g.c1 + 1);
      if (n < 2) { statEl.textContent = ''; return; }
      let cnt = 0, nums = 0, sum = 0;
      const sh = cur(), si = book.active;
      const ub = usedBounds(sh);
      const r2 = Math.min(g.r2, ub.r), c2 = Math.min(g.c2, ub.c);
      for (let r = g.r1; r <= r2; r++) {
        if (G.hidden.has(r)) continue;
        for (let c = g.c1; c <= c2; c++) {
          const cell = sh.cells[K(r, c)];
          if (isEmptyCell(cell)) continue;
          cnt++;
          const v = cell.f != null ? engine.value(si, r, c) : cell.v;
          if (typeof v === 'number' && isFinite(v)) { nums++; sum += v; }
        }
      }
      const f = (v) => (Math.abs(v) >= 1000 ? Math.round(v * 100) / 100 : +v.toPrecision(10)).toLocaleString('ko-KR', { maximumFractionDigits: 4 });
      statEl.innerHTML = nums
        ? '<span>평균 <b>' + f(sum / nums) + '</b></span><span>개수 <b>' + cnt + '</b></span><span>합계 <b>' + f(sum) + '</b></span>'
        : (cnt ? '<span>개수 <b>' + cnt + '</b></span>' : '');
    }
    function ensureVisible(r, c) {
      if (!G) return;
      const { tops, lefts, fr, fc, frH, frW } = G;
      if (r >= fr) {
        const y = HEAD_H + tops[r], h = tops[r + 1] - tops[r];
        if (tops[r] < wrap.scrollTop + frH) wrap.scrollTop = Math.max(0, tops[r] - frH);
        else if (y + h > wrap.scrollTop + wrap.clientHeight) wrap.scrollTop = y + h - wrap.clientHeight;
      }
      if (c >= fc) {
        const x = HEAD_W + lefts[c], w = lefts[c + 1] - lefts[c];
        if (x < wrap.scrollLeft + HEAD_W + frW) wrap.scrollLeft = Math.max(0, lefts[c] - frW);
        else if (x + w > wrap.scrollLeft + wrap.clientWidth) wrap.scrollLeft = x + w - wrap.clientWidth;
      }
      renderGrid(false) && paintSel();
    }
    function select(r, c, extend) {
      const sh = cur();
      r = Math.max(0, Math.min(sh.rows - 1, r));
      c = Math.max(0, Math.min(sh.cols - 1, c));
      if (extend) { st.sel = { r1: st.act.r, c1: st.act.c, r2: r, c2: c }; }
      else { st.act = { r, c }; st.sel = { r1: r, c1: c, r2: r, c2: c }; }
      st.point = null;
      ensureVisible(r, c);
      paintSel();
      if (P.resume && st.resumeOn) P.resume.save('sheets', id, { sheet: book.active, r: st.act.r, c: st.act.c });
    }
    function visibleStep(r, d) {
      let n = r + d;
      while (G.hidden.has(n) && n > 0 && n < cur().rows - 1) n += d;
      return n;
    }
    function move(dr, dc, extend) {
      const base = extend ? { r: st.sel.r2, c: st.sel.c2 } : st.act;
      let r = base.r, c = base.c;
      if (!extend) {
        const m = mergeOf(r, c);
        if (m) { if (dr > 0) r = m.r2; if (dc > 0) c = m.c2; if (dr < 0) r = m.r1; if (dc < 0) c = m.c1; }
      }
      if (dr) r = visibleStep(r, dr);
      c += dc;
      if (extend) {
        const sh = cur();
        st.sel.r2 = Math.max(0, Math.min(sh.rows - 1, r));
        st.sel.c2 = Math.max(0, Math.min(sh.cols - 1, c));
        ensureVisible(st.sel.r2, st.sel.c2);
        paintSel();
      } else select(r, c);
    }
    function jump(dr, dc, extend) {
      const sh = cur();
      const from = extend ? { r: st.sel.r2, c: st.sel.c2 } : st.act;
      let r = from.r, c = from.c;
      const filled = (rr, cc) => !isEmptyCell(sh.cells[K(rr, cc)]);
      const inb = (rr, cc) => rr >= 0 && cc >= 0 && rr < sh.rows && cc < sh.cols;
      if (inb(r + dr, c + dc) && filled(r, c) && filled(r + dr, c + dc)) {
        while (inb(r + dr, c + dc) && filled(r + dr, c + dc)) { r += dr; c += dc; }
      } else {
        r += dr; c += dc;
        while (inb(r, c) && !filled(r, c) && inb(r + dr, c + dc)) { r += dr; c += dc; }
      }
      if (extend) { st.sel.r2 = Math.max(0, Math.min(sh.rows - 1, r)); st.sel.c2 = Math.max(0, Math.min(sh.cols - 1, c)); ensureVisible(st.sel.r2, st.sel.c2); paintSel(); }
      else select(r, c);
    }

    /* ---------- 셀 값 쓰기 ---------- */
    function dvAt(r, c) {
      return (cur().dv || []).find((d) => { const g = parseRange(d.range); return g && inRange(g, r, c); }) || null;
    }
    function validate(r, c, p) {
      const dv = dvAt(r, c);
      if (!dv || !p || p.f) return true;
      if (dv.type === 'list') {
        if ((dv.items || []).includes(String(p.v))) return true;
        return dv.strict === false ? 'warn' : '이 셀에는 목록에 있는 값만 넣을 수 있습니다: ' + (dv.items || []).join(', ');
      }
      if (dv.type === 'number') {
        const ok = typeof p.v === 'number' && (dv.min === '' || dv.min == null || p.v >= +dv.min) && (dv.max === '' || dv.max == null || p.v <= +dv.max);
        if (ok) return true;
        return dv.strict === false ? 'warn' : '이 셀에는 ' + (dv.min !== '' && dv.min != null ? dv.min + ' 이상 ' : '') + (dv.max !== '' && dv.max != null ? dv.max + ' 이하 ' : '') + '숫자만 넣을 수 있습니다.';
      }
      return true;
    }
    function writeCell(sh, r, c, text) {
      const k = K(r, c);
      const old = sh.cells[k];
      const isText = old && old.s && old.s.fmt === '@';
      const p = isText && text !== '' && text[0] !== '=' ? { v: String(text) } : parseInput(text);
      if (!p) {
        if (old && old.s) sh.cells[k] = { s: old.s }; else delete sh.cells[k];
        return;
      }
      const cell = old && old.s ? { s: Object.assign({}, old.s) } : {};
      if (p.f) cell.f = p.f.replace(/^=\s*/, '=').replace(/^=([a-z][a-z0-9.]*)\(/i, (m0, n) => '=' + n.toUpperCase() + '(');
      else cell.v = p.v;
      if (p.f && !(cell.s && cell.s.fmt)) {
        // 날짜 셀에 더하고 빼는 수식은 날짜 형식을 이어받음 (예: =A2+7)
        const m = /^=\s*(\$?[A-Za-z]{1,3}\$?\d+)\s*[+-]/.exec(p.f);
        const ref = m && parseA1(m[1]);
        const rf = ref && sh.cells[K(ref.r, ref.c)];
        const f0 = rf && rf.s && rf.s.fmt;
        if (f0 && /[yd]/.test(f0.replace(/"[^"]*"/g, ''))) cell.s = Object.assign({}, cell.s, { fmt: f0 });
      }
      if (p.text) cell.s = Object.assign({}, cell.s, { fmt: '@' });
      else if (p.fmt && !(cell.s && cell.s.fmt && cell.s.fmt !== 'General')) cell.s = Object.assign({}, cell.s, { fmt: p.fmt });
      sh.cells[k] = cell;
    }
    function setInput(r, c, text) {
      const p = parseInput(text);
      const ok = validate(r, c, p);
      if (ok !== true && ok !== 'warn') { P.ui.toast(ok, 'warn'); return false; }
      if (ok === 'warn') P.ui.toast('목록·범위에 없는 값이지만 입력했습니다.', 'warn');
      pushUndo();
      writeCell(cur(), r, c, text);
      const sh = cur();
      if (r >= sh.rows - 2) sh.rows = Math.min(MAX_ROWS, sh.rows + 50);
      if (c >= sh.cols - 1) sh.cols = Math.min(MAX_COLS, sh.cols + 5);
      changed();
      return true;
    }

    /* ---------- 셀 편집 ---------- */
    function startEdit(mode, text) {
      if (st.editing) return;
      const am = mergeOf(st.act.r, st.act.c);
      const r = am ? am.r1 : st.act.r, c = am ? am.c1 : st.act.c;
      st.act = { r, c };
      ensureVisible(r, c);
      const cell = cur().cells[K(r, c)];
      st.editing = { r, c, mode, orig: rawText(cell) };
      if (text != null) inp.value = text;
      const td = tdFor(r, c);
      const s = (cell && cell.s) || {};
      inp.style.fontWeight = s.b ? '700' : '';
      inp.style.fontStyle = s.i ? 'italic' : '';
      inp.style.fontSize = s.fs ? s.fs + 'px' : '';
      inp.style.textAlign = s.ha || '';
      if (td) {
        const R = relRect(td);
        inp.style.transform = 'translate(' + R.x + 'px,' + R.y + 'px)';
        inp.style.minWidth = R.w + 'px';
        inp.style.width = R.w + 'px';
        inp.style.height = R.h + 'px';
      }
      inp.classList.add('on');
      fill.hidden = true;
      dvbtn.hidden = true;
      if (!st.touch || document.activeElement === inp) focusGrid();
      else inp.focus();
      if (mode === 'edit') { const L = inp.value.length; inp.setSelectionRange(L, L); }
      grow();
      fx.value = inp.value;
    }
    function grow() {
      if (!st.editing) return;
      inp.style.width = '0px';
      const max = wrap.clientWidth - 8;
      inp.style.width = Math.min(max, Math.max(parseFloat(inp.style.minWidth) || 60, inp.scrollWidth + 4)) + 'px';
      inp.style.height = 'auto';
      inp.style.height = Math.max(DEF_H, inp.scrollHeight) + 'px';
    }
    function endEdit() {
      st.editing = null;
      st.point = null;
      inp.classList.remove('on');
      inp.value = '';
      inp.style.minWidth = '';
      hideAC();
    }
    function commitEdit() {
      const e = st.editing;
      if (!e) return true;
      const text = inp.value;
      if (text === e.orig) { endEdit(); paintSel(); return true; }
      const ok = validate(e.r, e.c, parseInput(text));
      if (ok !== true && ok !== 'warn') { P.ui.toast(ok, 'warn'); focusGrid(); return false; }
      endEdit();
      setInput(e.r, e.c, text);
      return true;
    }
    function cancelEdit() { endEdit(); paintSel(); }
    function focusGrid() { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } }

    /* ---------- 자동 완성 ---------- */
    let acState = null;
    function names() {
      if (!funcNames) {
        const all = engine.functionNames();
        const pri = Object.keys(FUNC_HELP);
        funcNames = pri.concat(all.filter((n) => !FUNC_HELP[n] && !/^(IM|BESSEL|BIT|BIN2|DEC2|HEX2|OCT2|ERF|GAMMA|F\.|T\.|CHISQ|BETA|NEGBINOM|HYPGEOM|WEIBULL|EXPON|LOGNORM|GAUSS|PHI|FISHER)/.test(n)));
        funcNames = Array.from(new Set(funcNames)).filter((n) => all.includes(n) || pri.includes(n));
      }
      return funcNames;
    }
    function acCheck(el) {
      const v = el.value;
      if (v[0] !== '=') return hideAC();
      const pos = el.selectionStart;
      const before = v.slice(0, pos);
      const m = /(?:^=|[=(,+\-*/^&<>;:\s])([A-Za-z][A-Za-z0-9.]*)$/.exec(before);
      if (!m) return hideAC();
      const tok = m[1].toUpperCase();
      const list = names().filter((n) => n.startsWith(tok)).slice(0, 8);
      if (!list.length || (list.length === 1 && list[0] === tok)) return hideAC();
      acState = { el, list, i: 0, start: pos - m[1].length, end: pos };
      acBox.innerHTML = list.map((n, i) => '<div role="option" class="sheets-ac-it' + (i === 0 ? ' on' : '') + '" data-i="' + i + '"><b>' + n + '</b><span>' + esc(FUNC_HELP[n] || '') + '</span></div>').join('');
      acBox.hidden = false;
      const r = el.getBoundingClientRect(), rr = root.getBoundingClientRect();
      acBox.style.left = Math.max(4, Math.min(r.left - rr.left, rr.width - 260)) + 'px';
      acBox.style.top = (r.bottom - rr.top + 2) + 'px';
    }
    function hideAC() { acState = null; acBox.hidden = true; }
    function acMove(d) {
      if (!acState) return;
      acState.i = (acState.i + d + acState.list.length) % acState.list.length;
      acBox.querySelectorAll('.sheets-ac-it').forEach((x, i) => x.classList.toggle('on', i === acState.i));
    }
    function acApply(i) {
      if (!acState) return;
      const { el, list, start, end } = acState;
      const name = list[i == null ? acState.i : i];
      el.value = el.value.slice(0, start) + name + '(' + el.value.slice(end);
      const p = start + name.length + 1;
      el.setSelectionRange(p, p);
      hideAC();
      if (el === inp) { grow(); fx.value = inp.value; } else if (st.editing) inp.value = fx.value;
      el.focus();
    }
    acBox.addEventListener('mousedown', (e) => {
      const it = e.target.closest('.sheets-ac-it');
      if (it) { e.preventDefault(); acApply(+it.dataset.i); }
    });

    /* ---------- 수식 참조 클릭 입력 ---------- */
    function canPoint() {
      if (!st.editing || inp.value[0] !== '=') return false;
      const pos = inp.selectionStart;
      if (st.point && pos === st.point.pos + st.point.len) return true;
      return /[=(,+\-*/^&<>:;]\s*$/.test(inp.value.slice(0, pos));
    }
    function pointRef(g) {
      const txt = rangeA1(norm(g));
      const v = inp.value;
      let pos = inp.selectionStart;
      if (st.point && pos === st.point.pos + st.point.len) {
        inp.value = v.slice(0, st.point.pos) + txt + v.slice(pos);
        pos = st.point.pos;
      } else inp.value = v.slice(0, pos) + txt + v.slice(pos);
      st.point = Object.assign({}, st.point || {}, { pos, len: txt.length });
      const e = pos + txt.length;
      inp.setSelectionRange(e, e);
      fx.value = inp.value;
      grow();
    }

    /* ---------- 마우스·터치 ---------- */
    let drag = null;
    let lastTap = { t: 0, k: '' };
    let rafMove = 0;
    const cellOf = (el) => {
      const td = el && el.closest ? el.closest('td.c') : null;
      return td && table.contains(td) ? { r: +td.dataset.r, c: +td.dataset.c } : null;
    };
    function selectCols(c1, c2) { st.sel = { r1: 0, c1, r2: cur().rows - 1, c2 }; paintSel(); }
    function selectRows(r1, r2) { st.sel = { r1, c1: 0, r2, c2: cur().cols - 1 }; paintSel(); }
    function selectAll() { st.sel = { r1: 0, c1: 0, r2: cur().rows - 1, c2: cur().cols - 1 }; paintSel(); }
    function onDown(e) {
      st.touch = e.pointerType === 'touch';
      const t = e.target;
      if (t === inp || t.closest('.sheets-fbtn') || t === dvbtn) return;
      closeMenus();
      if (t === fill) { e.preventDefault(); drag = { fill: true, src: selRange(), to: null }; return; }
      const rsz = t.closest('.sheets-rsz, .sheets-rszr');
      if (rsz) {
        e.preventDefault();
        const isCol = rsz.classList.contains('sheets-rsz');
        const idx = +(isCol ? rsz.dataset.rc : rsz.dataset.rr);
        const sh = cur();
        drag = { resize: true, isCol, idx, start: isCol ? colW(sh, idx) : rowH(sh, idx), x0: e.clientX, y0: e.clientY, snap: snap() };
        return;
      }
      const ch = t.closest('.sheets-ch'), rh = t.closest('.sheets-rh'), corner = t.closest('.sheets-corner');
      const cell = cellOf(t);
      if (!cell && !ch && !rh && !corner) return;
      if (st.touch) { drag = { touch: true, x: e.clientX, y: e.clientY, cell, ch, rh, corner }; return; }
      if (cell && e.button === 0 && canPoint()) {
        e.preventDefault();
        drag = { point: true, a: cell };
        pointRef({ r1: cell.r, c1: cell.c, r2: cell.r, c2: cell.c });
        return;
      }
      e.preventDefault();
      if (st.editing && !commitEdit()) return;
      if (corner) { selectAll(); focusGrid(); return; }
      if (e.button === 2 && cell && inRange(selRange(), cell.r, cell.c)) { focusGrid(); return; }
      if (ch) {
        const c = +ch.dataset.c;
        if (e.button === 2 && st.sel.r1 === 0 && st.sel.r2 === cur().rows - 1 && c >= Math.min(st.sel.c1, st.sel.c2) && c <= Math.max(st.sel.c1, st.sel.c2)) { focusGrid(); return; }
        const c0 = e.shiftKey ? st.act.c : c;
        if (!e.shiftKey) st.act = { r: Math.max(G.fr, Math.min(st.act.r, cur().rows - 1)), c };
        selectCols(c0, c);
        drag = { col: true, c0 };
      } else if (rh) {
        const r = +rh.dataset.r;
        if (e.button === 2 && st.sel.c1 === 0 && st.sel.c2 === cur().cols - 1 && r >= Math.min(st.sel.r1, st.sel.r2) && r <= Math.max(st.sel.r1, st.sel.r2)) { focusGrid(); return; }
        const r0 = e.shiftKey ? st.act.r : r;
        if (!e.shiftKey) st.act = { r, c: 0 };
        selectRows(r0, r);
        drag = { row: true, r0 };
      } else {
        select(cell.r, cell.c, e.shiftKey);
        drag = { cell: true };
      }
      focusGrid();
    }
    function onMove(e) {
      if (!drag) return;
      if (drag.touch) {
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 10) drag = null;
        return;
      }
      const x = e.clientX, y = e.clientY;
      cancelAnimationFrame(rafMove);
      rafMove = requestAnimationFrame(() => {
        if (!drag) return;
        if (drag.resize) {
          const sh = cur();
          const size = Math.round(Math.max(drag.isCol ? 24 : 16, Math.min(drag.isCol ? 800 : 400, drag.start + (drag.isCol ? x - drag.x0 : y - drag.y0))));
          if (drag.isCol) sh.colW[drag.idx] = size; else sh.rowH[drag.idx] = size;
          drag.moved = true;
          computeGeom(); renderGrid(true); paintSel();
          return;
        }
        const wr = wrap.getBoundingClientRect();
        if (y > wr.bottom - 24) wrap.scrollTop += 24; else if (y < wr.top + HEAD_H + 6) wrap.scrollTop -= 24;
        if (x > wr.right - 24) wrap.scrollLeft += 24; else if (x < wr.left + HEAD_W + 6) wrap.scrollLeft -= 24;
        const el = document.elementFromPoint(Math.min(Math.max(x, wr.left + HEAD_W + 2), wr.right - 4), Math.min(Math.max(y, wr.top + HEAD_H + 2), wr.bottom - 4));
        if (!el) return;
        if (drag.col) { const th = el.closest('.sheets-ch') || el.closest('td.c'); if (th) selectCols(drag.c0, +th.dataset.c); return; }
        if (drag.row) { const th = el.closest('.sheets-rh') || el.closest('td.c'); if (th) selectRows(drag.r0, +th.dataset.r); return; }
        const cell = cellOf(el);
        if (!cell) return;
        if (drag.point) { pointRef({ r1: drag.a.r, c1: drag.a.c, r2: cell.r, c2: cell.c }); return; }
        if (drag.fill) {
          const g = drag.src;
          let to = null;
          const dDown = cell.r - g.r2, dUp = g.r1 - cell.r, dR = cell.c - g.c2, dL = g.c1 - cell.c;
          const vmax = Math.max(dDown, dUp), hmax = Math.max(dR, dL);
          if (vmax > 0 && vmax >= hmax) to = dDown > 0 ? { r1: g.r1, c1: g.c1, r2: cell.r, c2: g.c2 } : { r1: cell.r, c1: g.c1, r2: g.r2, c2: g.c2 };
          else if (hmax > 0) to = dR > 0 ? { r1: g.r1, c1: g.c1, r2: g.r2, c2: cell.c } : { r1: g.r1, c1: cell.c, r2: g.r2, c2: g.c2 };
          drag.to = to;
          st.sel = to || Object.assign({}, g);
          paintSel();
          return;
        }
        if (drag.cell) {
          if (st.sel.r2 !== cell.r || st.sel.c2 !== cell.c) { st.sel.r2 = cell.r; st.sel.c2 = cell.c; paintSel(); }
        }
      });
    }
    function onUp(e) {
      const d = drag;
      drag = null;
      if (!d) return;
      if (d.resize) {
        if (d.moved) { st.undo.push(d.snap); st.redo.length = 0; scheduleSave(); }
        return;
      }
      if (d.fill) { if (d.to) doFill(d.src, d.to); else { st.sel = d.src; paintSel(); } return; }
      if (d.touch) {
        if (d.corner) { selectAll(); return; }
        if (d.ch) { const c = +d.ch.dataset.c; st.act = { r: st.act.r, c }; selectCols(c, c); return; }
        if (d.rh) { const r = +d.rh.dataset.r; st.act = { r, c: 0 }; selectRows(r, r); return; }
        if (!d.cell) return;
        if (st.editing && canPoint()) { pointRef({ r1: d.cell.r, c1: d.cell.c, r2: d.cell.r, c2: d.cell.c }); return; }
        if (st.editing && !commitEdit()) return;
        const k = d.cell.r + ',' + d.cell.c;
        const now = Date.now();
        select(d.cell.r, d.cell.c);
        if (now - lastTap.t < 380 && lastTap.k === k) {
          startEdit('edit', rawText(cur().cells[K(st.act.r, st.act.c)]));
          inp.focus();
        } else if (document.activeElement === inp) inp.blur();
        lastTap = { t: now, k };
      }
    }
    wrap.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    wrap.addEventListener('dblclick', (e) => {
      const rs = e.target.closest('.sheets-rsz');
      if (rs) { autofit(+rs.dataset.rc); return; }
      const rr = e.target.closest('.sheets-rszr');
      if (rr) { pushUndo(); delete cur().rowH[+rr.dataset.rr]; changed(); return; }
      const cell = cellOf(e.target);
      if (!cell || st.touch || st.editing) return;
      startEdit('edit', rawText(cur().cells[K(st.act.r, st.act.c)]));
    });
    wrap.addEventListener('click', (e) => {
      const fb = e.target.closest('.sheets-fbtn');
      if (fb) { e.preventDefault(); filterDialog(+fb.dataset.fc); return; }
      if (e.target === dvbtn) dvMenu();
    });
    wrap.addEventListener('contextmenu', (e) => {
      if (e.target === inp && st.editing) return;
      if (!e.target.closest('td.c, th')) return;
      e.preventDefault();
      if (st.touch) {
        const cell = cellOf(e.target);
        if (cell && !inRange(selRange(), cell.r, cell.c)) select(cell.r, cell.c);
        drag = null;
      }
      cellMenu({ x: e.clientX, y: e.clientY });
    });
    let rafScroll = 0;
    wrap.addEventListener('scroll', () => {
      cancelAnimationFrame(rafScroll);
      rafScroll = requestAnimationFrame(() => { if (renderGrid(false)) paintSel(); else placeOverlays(); });
    }, { passive: true });
    let rafResize = 0;
    const onResize = () => { cancelAnimationFrame(rafResize); rafResize = requestAnimationFrame(() => { if (!st.destroyed) { renderGrid(true); paintSel(); } }); };
    window.addEventListener('resize', onResize);

    function autofit(c) {
      const sh = cur(), si = book.active;
      const cv = autofit.cv || (autofit.cv = document.createElement('canvas').getContext('2d'));
      const font = getComputedStyle(table).fontFamily;
      let w = 30;
      const ub = usedBounds(sh);
      for (let r = 0; r <= Math.min(ub.r, 3000); r++) {
        const t = dispText(si, r, c);
        if (!t) continue;
        const s = (sh.cells[K(r, c)] || {}).s || {};
        if (sh.merges.some((m) => m.c1 <= c && m.c2 >= c && m.c1 !== m.c2 && m.r1 <= r && m.r2 >= r)) continue;
        cv.font = (s.b ? '700 ' : '400 ') + (s.fs || 13) + 'px ' + font;
        w = Math.max(w, cv.measureText(t).width + 16);
      }
      pushUndo();
      sh.colW[c] = Math.min(600, Math.ceil(w));
      changed();
    }

    /* ---------- 키보드 ---------- */
    function insertAtCaret(el, text) {
      const s = el.selectionStart, e2 = el.selectionEnd;
      el.value = el.value.slice(0, s) + text + el.value.slice(e2);
      el.setSelectionRange(s + text.length, s + text.length);
    }
    const ARROWS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    function onKey(e) {
      if (e.isComposing || e.keyCode === 229) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key;
      if (st.editing) {
        if (acState && acState.el === inp) {
          if (k === 'ArrowDown') { e.preventDefault(); acMove(1); return; }
          if (k === 'ArrowUp') { e.preventDefault(); acMove(-1); return; }
          if (k === 'Tab' || (k === 'Enter' && !e.altKey)) { e.preventDefault(); acApply(); return; }
          if (k === 'Escape') { e.preventDefault(); hideAC(); return; }
        }
        if (k === 'Enter' && (e.altKey || ctrl)) { e.preventDefault(); insertAtCaret(inp, '\n'); grow(); fx.value = inp.value; return; }
        if (k === 'Enter') { e.preventDefault(); if (commitEdit()) move(e.shiftKey ? -1 : 1, 0); return; }
        if (k === 'Tab') { e.preventDefault(); if (commitEdit()) move(0, e.shiftKey ? -1 : 1); return; }
        if (k === 'Escape') { e.preventDefault(); cancelEdit(); return; }
        if (k === 'F2') { e.preventDefault(); st.editing.mode = st.editing.mode === 'enter' ? 'edit' : 'enter'; return; }
        if (st.editing.mode === 'enter' && ARROWS[k] && !ctrl && !e.shiftKey) {
          e.preventDefault();
          const [dr, dc] = ARROWS[k];
          if (commitEdit()) move(dr, dc);
        }
        return;
      }
      if (ctrl && !e.altKey) {
        const kk = k.toLowerCase();
        if (kk === 'c' || kk === 'x') {
          inp.value = ' '; inp.select(); st.copyCut = kk === 'x';
          setTimeout(() => { if (!st.editing && inp.value === ' ') inp.value = ''; st.copyCut = null; }, 80);
          return;
        }
        if (kk === 'v') return;
        if (ARROWS[k]) { e.preventDefault(); jump(ARROWS[k][0], ARROWS[k][1], e.shiftKey); return; }
        const map = {
          z: () => (e.shiftKey ? redo() : undo()), y: redo, b: () => toggle('b'), i: () => toggle('i'), u: () => toggle('u'), '5': () => toggle('st'),
          s: () => { saveNow().then(() => P.ui.toast('저장했습니다.', 'ok')); }, f: () => findDialog(false), h: () => findDialog(true), a: selectAll,
          d: () => fillDir('down'), r: () => fillDir('right'), ';': () => setInput(st.act.r, st.act.c, engine.format('yyyy-mm-dd', todaySerial())),
          home: () => select(0, 0), end: () => { const ub = usedBounds(cur()); select(Math.max(0, ub.r), Math.max(0, ub.c)); }, p: printSheet
        };
        if (map[kk]) { e.preventDefault(); map[kk](); }
        return;
      }
      if (ARROWS[k]) { e.preventDefault(); move(ARROWS[k][0], ARROWS[k][1], e.shiftKey); return; }
      switch (k) {
        case 'Tab': e.preventDefault(); move(0, e.shiftKey ? -1 : 1); break;
        case 'Enter': e.preventDefault(); move(e.shiftKey ? -1 : 1, 0); break;
        case 'Home': e.preventDefault(); select(st.act.r, 0, e.shiftKey); break;
        case 'PageDown': case 'PageUp': {
          e.preventDefault();
          const n = Math.max(1, Math.floor((wrap.clientHeight - HEAD_H) / DEF_H) - 1);
          move(k === 'PageDown' ? n : -n, 0, e.shiftKey);
          break;
        }
        case 'Delete': case 'Backspace': e.preventDefault(); clearSel('contents'); break;
        case 'F2': e.preventDefault(); startEdit('edit', rawText(cur().cells[K(st.act.r, st.act.c)])); break;
        case 'Escape': st.clip = null; table.classList.remove('copying'); break;
        case 'ContextMenu': { e.preventDefault(); const td = tdFor(st.act.r, st.act.c); const r = td ? td.getBoundingClientRect() : wrap.getBoundingClientRect(); cellMenu({ x: r.left + 10, y: r.bottom }); break; }
        default:
          if (k === 'F10' && e.shiftKey) { e.preventDefault(); const td = tdFor(st.act.r, st.act.c); if (td) { const r = td.getBoundingClientRect(); cellMenu({ x: r.left + 10, y: r.bottom }); } }
      }
    }
    inp.addEventListener('keydown', onKey);
    // 메뉴를 고른 뒤처럼 포커스가 문서에 남아 있으면 키 입력을 격자로 보냄
    const onDocKey = (e) => {
      if (st.destroyed || e.defaultPrevented) return;
      if (document.activeElement !== document.body || document.querySelector('.p-modal-back, .sheets-menu')) return;
      if (!root.isConnected) return;
      focusGrid();
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) { e.preventDefault(); startEdit('enter', e.key); return; }
      onKey(e);
    };
    document.addEventListener('keydown', onDocKey);
    inp.addEventListener('input', () => {
      if (!st.editing) {
        if (inp.value === ' ' && st.copyCut != null) return;
        startEdit('enter', null);
      }
      grow();
      fx.value = inp.value;
      acCheck(inp);
    });
    inp.addEventListener('compositionstart', () => { if (!st.editing) startEdit('enter', null); });
    inp.addEventListener('copy', (e) => {
      if (st.editing) return;
      const d = copySel(!!st.copyCut);
      st.copyCut = null;
      e.clipboardData.setData('text/plain', d.text);
      e.clipboardData.setData('text/html', d.html);
      e.preventDefault();
      setTimeout(() => { if (!st.editing) inp.value = ''; }, 0);
    });
    inp.addEventListener('cut', (e) => {
      if (st.editing) return;
      const d = copySel(true);
      st.copyCut = null;
      e.clipboardData.setData('text/plain', d.text);
      e.clipboardData.setData('text/html', d.html);
      e.preventDefault();
      setTimeout(() => { if (!st.editing) inp.value = ''; }, 0);
    });
    inp.addEventListener('paste', (e) => {
      if (st.editing) return;
      e.preventDefault();
      pasteText(e.clipboardData.getData('text/plain'));
    });

    /* ---------- 수식 입력줄·이름 상자 ---------- */
    let fxOrig = '', fxCell = null;
    fx.addEventListener('focus', () => {
      if (st.editing) commitEdit();
      fxOrig = fx.value;
      const am = mergeOf(st.act.r, st.act.c);
      fxCell = am ? { r: am.r1, c: am.c1 } : Object.assign({}, st.act);
    });
    fx.addEventListener('input', () => acCheck(fx));
    fx.addEventListener('keydown', (e) => {
      if (acState && acState.el === fx) {
        if (e.key === 'ArrowDown') { e.preventDefault(); acMove(1); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); acMove(-1); return; }
        if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); acApply(); return; }
        if (e.key === 'Escape') { e.preventDefault(); hideAC(); return; }
      }
      if (e.key === 'Enter') { e.preventDefault(); focusGrid(); }
      else if (e.key === 'Escape') { e.preventDefault(); fx.value = fxOrig; focusGrid(); }
    });
    fx.addEventListener('blur', () => {
      setTimeout(() => { if (acState && acState.el === fx) hideAC(); }, 150);
      if (fxCell && fx.value !== fxOrig) {
        const c = fxCell;
        fxCell = null;
        if (!setInput(c.r, c.c, fx.value)) fx.value = fxOrig;
      }
      fxCell = null;
    });
    nameBox.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); focusGrid(); paintSel(); return; }
      if (e.key !== 'Enter') return;
      e.preventDefault();
      let v = nameBox.value.trim();
      const bang = v.lastIndexOf('!');
      if (bang > 0) {
        const nm = sheetOfPrefix(v.slice(0, bang + 1));
        const i = book.sheets.findIndex((s) => s.name.toLowerCase() === String(nm).toLowerCase());
        if (i < 0) { P.ui.toast('시트를 찾을 수 없습니다: ' + nm, 'warn'); return; }
        if (i !== book.active) switchSheet(i);
        v = v.slice(bang + 1);
      }
      const g = parseRange(v.toUpperCase());
      if (!g) { P.ui.toast('주소 형식이 올바르지 않습니다. 예: B3, A1:C10', 'warn'); return; }
      const sh = cur();
      if (g.r2 >= sh.rows) sh.rows = Math.min(MAX_ROWS, g.r2 + 20);
      if (g.c2 >= sh.cols) sh.cols = Math.min(MAX_COLS, g.c2 + 2);
      computeGeom();
      select(g.r1, g.c1);
      st.sel = g;
      paintSel();
      focusGrid();
    });
    titleIn.addEventListener('input', () => { book.title = titleIn.value.trim() || '제목 없음'; scheduleSave(); });
    titleIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); focusGrid(); } });

    /* ---------- 복사·붙여넣기 ---------- */
    function copySel(cut) {
      const g = selRange();
      const sh = cur(), si = book.active;
      const ub = usedBounds(sh);
      const r2 = Math.min(g.r2, Math.max(g.r1, ub.r)), c2 = Math.min(g.c2, Math.max(g.c1, ub.c));
      const lines = [], html = ['<table>'], cells = [];
      for (let r = g.r1; r <= r2; r++) {
        if (G.hidden.has(r)) continue;
        const row = [], tr = [];
        for (let c = g.c1; c <= c2; c++) {
          const cell = sh.cells[K(r, c)];
          cells.push({ dr: r - g.r1, dc: c - g.c1, cell: cell ? JSON.parse(JSON.stringify(cell)) : null });
          const t = dispText(si, r, c);
          row.push(/[\t\n"]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t);
          tr.push('<td>' + esc(t) + '</td>');
        }
        lines.push(row.join('\t'));
        html.push('<tr>' + tr.join('') + '</tr>');
      }
      html.push('</table>');
      const text = lines.join('\n');
      st.clip = { si, g: { r1: g.r1, c1: g.c1, r2, c2 }, cells, text: text.replace(/\r/g, ''), cut, sheetId: sh.id };
      table.classList.add('copying');
      P.ui.toast(cut ? '잘라냈습니다. 붙여넣을 셀을 고르고 Ctrl+V 하세요.' : '복사했습니다.');
      return { text, html: html.join('') };
    }
    function ensureSize(sh, r, c) {
      if (r >= sh.rows - 1) sh.rows = Math.min(MAX_ROWS, r + 30);
      if (c >= sh.cols - 1) sh.cols = Math.min(MAX_COLS, c + 3);
    }
    function pasteText(text) {
      text = String(text || '').replace(/\r\n?/g, '\n');
      const sh = cur();
      const g = selRange();
      const R = g.r1, C = g.c1;
      const clip = st.clip;
      if (clip && clip.text === text.replace(/\n$/, '')) {
        pushUndo();
        const src = book.sheets.find((s) => s.id === clip.sheetId);
        const h = clip.g.r2 - clip.g.r1 + 1, w = clip.g.c2 - clip.g.c1 + 1;
        const th = (g.r2 - g.r1 + 1), tw = (g.c2 - g.c1 + 1);
        const ry = !clip.cut && th % h === 0 ? th / h : 1, rx = !clip.cut && tw % w === 0 ? tw / w : 1;
        if (clip.cut && src) clip.cells.forEach((x) => { delete src.cells[K(clip.g.r1 + x.dr, clip.g.c1 + x.dc)]; });
        for (let iy = 0; iy < ry; iy++) for (let ix = 0; ix < rx; ix++) {
          clip.cells.forEach((x) => {
            const r = R + iy * h + x.dr, c = C + ix * w + x.dc;
            if (r >= MAX_ROWS || c >= MAX_COLS) return;
            ensureSize(sh, r, c);
            const k = K(r, c);
            if (!x.cell) { delete sh.cells[k]; return; }
            const nc = JSON.parse(JSON.stringify(x.cell));
            if (nc.f != null && !clip.cut) nc.f = shiftFormula(nc.f, r - (clip.g.r1 + x.dr), c - (clip.g.c1 + x.dc));
            sh.cells[k] = nc;
          });
        }
        st.sel = { r1: R, c1: C, r2: R + h * ry - 1, c2: C + w * rx - 1 };
        if (clip.cut) { st.clip = null; table.classList.remove('copying'); }
        changed();
        return;
      }
      const rows = parseDelimited(text.replace(/\n$/, ''), '\t');
      if (!rows.length) return;
      pushUndo();
      if (rows.length === 1 && rows[0].length === 1) {
        for (let r = g.r1; r <= Math.min(g.r2, R + 5000); r++) for (let c = g.c1; c <= g.c2; c++) writeCell(sh, r, c, rows[0][0]);
      } else {
        rows.forEach((row, dr) => row.forEach((v, dc) => {
          const r = R + dr, c = C + dc;
          if (r >= MAX_ROWS || c >= MAX_COLS) return;
          ensureSize(sh, r, c);
          writeCell(sh, r, c, v);
        }));
        st.sel = { r1: R, c1: C, r2: R + rows.length - 1, c2: C + Math.max(...rows.map((x) => x.length)) - 1 };
      }
      changed();
    }
    async function pasteFromMenu() {
      try {
        const t = await navigator.clipboard.readText();
        pasteText(t);
      } catch (e) {
        if (st.clip) pasteText(st.clip.text);
        else P.ui.toast('브라우저가 붙여넣기를 막았습니다. 키보드의 Ctrl+V를 사용하세요.', 'warn');
      }
    }

    /* ---------- 서식 명령 ---------- */
    function eachSel(fn) {
      const g = selRange();
      const sh = cur();
      let r2 = g.r2, c2 = g.c2;
      if ((r2 - g.r1 + 1) * (c2 - g.c1 + 1) > 60000) {
        const ub = usedBounds(sh);
        r2 = Math.min(r2, Math.max(ub.r, g.r1));
        c2 = Math.min(c2, Math.max(ub.c, g.c1));
      }
      for (let r = g.r1; r <= r2; r++) for (let c = g.c1; c <= c2; c++) if (!G.covered.has(K(r, c))) fn(r, c, g);
    }
    function patchStyle(sh, r, c, patch) {
      const k = K(r, c);
      const cell = sh.cells[k] || {};
      const s = Object.assign({}, cell.s);
      for (const key in patch) { if (patch[key] == null) delete s[key]; else s[key] = patch[key]; }
      if (Object.keys(s).length) cell.s = s; else delete cell.s;
      if (isEmptyCell(cell) && !cell.s) delete sh.cells[k]; else sh.cells[k] = cell;
    }
    function styleSel(patch) {
      pushUndo();
      const sh = cur();
      eachSel((r, c) => patchStyle(sh, r, c, patch));
      changed();
    }
    function actStyle() { const cell = cur().cells[K(st.act.r, st.act.c)]; return (cell && cell.s) || {}; }
    function toggle(key) { styleSel({ [key]: actStyle()[key] ? null : 1 }); }
    function decimals(d) {
      const cell = cur().cells[K(st.act.r, st.act.c)];
      let fmt = (cell && cell.s && cell.s.fmt) || 'General';
      if (fmt === 'General' || fmt === '@') {
        const v = cell && typeof cell.v === 'number' ? cell.v : 0;
        const cur0 = (String(v).split('.')[1] || '').length;
        fmt = '0' + (cur0 + d > 0 ? '.' + '0'.repeat(cur0 + d) : '');
      } else {
        const m = /(0)(\.0*)?(?![^"]*"(?:[^"]*"[^"]*")*[^"]*$)/.exec(fmt);
        if (!m) return;
        const places = m[2] ? m[2].length - 1 : 0;
        const np = Math.max(0, places + d);
        fmt = fmt.slice(0, m.index) + '0' + (np ? '.' + '0'.repeat(np) : '') + fmt.slice(m.index + m[0].length);
      }
      styleSel({ fmt });
    }
    function borders(kind) {
      pushUndo();
      const sh = cur();
      eachSel((r, c, g) => {
        const m = G.mergeAt.get(K(r, c));
        const re = m ? m.r2 : r, ce = m ? m.c2 : c;
        const cell = sh.cells[K(r, c)] || {};
        let bd = Object.assign({}, cell.s && cell.s.bd);
        const w = kind === 'thick' ? 2 : 1;
        if (kind === 'none') bd = null;
        else if (kind === 'all') bd = { t: 1, r: 1, b: 1, l: 1 };
        else if (kind === 'outer' || kind === 'thick') {
          if (r === g.r1) bd.t = w;
          if (re === g.r2) bd.b = w;
          if (c === g.c1) bd.l = w;
          if (ce === g.c2) bd.r = w;
        } else if (kind === 'bottom') { if (re === g.r2) bd.b = 1; }
        else if (kind === 'double-bottom') { if (re === g.r2) bd.b = 2; }
        patchStyle(sh, r, c, { bd: bd && Object.keys(bd).length ? bd : null });
      });
      changed();
    }
    function toggleMerge() {
      const g = selRange();
      const sh = cur();
      const hit = sh.merges.filter((m) => !(m.r2 < g.r1 || m.r1 > g.r2 || m.c2 < g.c1 || m.c1 > g.c2));
      if (hit.length) {
        pushUndo();
        sh.merges = sh.merges.filter((m) => !hit.includes(m));
        changed();
        return;
      }
      if (g.r1 === g.r2 && g.c1 === g.c2) { P.ui.toast('병합할 셀을 두 칸 이상 선택하세요.'); return; }
      if ((g.r2 - g.r1 + 1) * (g.c2 - g.c1 + 1) > 5000) { P.ui.toast('병합 범위가 너무 큽니다.', 'warn'); return; }
      let others = 0;
      for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) if ((r !== g.r1 || c !== g.c1) && !isEmptyCell(sh.cells[K(r, c)])) others++;
      const go = () => {
        pushUndo();
        for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) {
          if (r === g.r1 && c === g.c1) continue;
          const cell = sh.cells[K(r, c)];
          if (cell) { delete cell.v; delete cell.f; if (!cell.s) delete sh.cells[K(r, c)]; }
        }
        sh.merges.push(Object.assign({}, g));
        patchStyle(sh, g.r1, g.c1, { ha: 'center' });
        st.act = { r: g.r1, c: g.c1 };
        changed();
      };
      if (others) P.ui.confirm('병합하면 왼쪽 위 셀의 값만 남고 나머지 ' + others + '개 값은 지워집니다. 계속할까요?', { okLabel: '병합' }).then((ok) => ok && go());
      else go();
    }
    function setFreeze(r, c) {
      pushUndo();
      cur().freeze = { r, c };
      wrap.scrollTop = 0; wrap.scrollLeft = 0;
      changed();
      P.ui.toast(r || c ? '틀을 고정했습니다.' : '틀 고정을 해제했습니다.');
    }
    function clearSel(what) {
      pushUndo();
      const sh = cur();
      eachSel((r, c) => {
        const k = K(r, c);
        const cell = sh.cells[k];
        if (!cell) return;
        if (what === 'all') delete sh.cells[k];
        else if (what === 'formats') { delete cell.s; if (isEmptyCell(cell)) delete sh.cells[k]; }
        else { delete cell.v; delete cell.f; if (!cell.s) delete sh.cells[k]; }
      });
      changed();
    }

    /* ---------- 채우기 ---------- */
    function isDateFmt(f) { return !!f && /[yd]/.test(f.replace(/"[^"]*"/g, '')); }
    function doFill(src, dst) {
      const sh = cur();
      pushUndo();
      const vert = dst.r1 !== src.r1 || dst.r2 !== src.r2;
      const L = vert ? src.r2 - src.r1 + 1 : src.c2 - src.c1 + 1;
      const s0 = vert ? src.r1 : src.c1;
      const from = vert ? dst.r1 : dst.c1, to = vert ? dst.r2 : dst.c2;
      const laneA = vert ? src.c1 : src.r1, laneB = vert ? src.c2 : src.r2;
      for (let lane = laneA; lane <= laneB; lane++) {
        const cells = [];
        for (let i = 0; i < L; i++) {
          const r = vert ? src.r1 + i : lane, c = vert ? lane : src.c1 + i;
          cells.push({ r, c, cell: sh.cells[K(r, c)] });
        }
        const allNum = L >= 2 && cells.every((x) => x.cell && x.cell.f == null && typeof x.cell.v === 'number');
        const step = allNum ? (cells[L - 1].cell.v - cells[0].cell.v) / (L - 1) : 0;
        for (let p = from; p <= to; p++) {
          const i = p - s0;
          if (i >= 0 && i < L) continue;
          const j = ((i % L) + L) % L;
          const sx = cells[j];
          const r = vert ? p : lane, c = vert ? lane : p;
          ensureSize(sh, r, c);
          const k = K(r, c);
          if (!sx.cell) { delete sh.cells[k]; continue; }
          const nc = JSON.parse(JSON.stringify(sx.cell));
          if (nc.f != null) nc.f = shiftFormula(nc.f, r - sx.r, c - sx.c);
          else if (allNum) nc.v = +(cells[0].cell.v + step * i).toPrecision(15);
          else if (L === 1 && typeof nc.v === 'number' && isDateFmt(nc.s && nc.s.fmt)) nc.v = sx.cell.v + i;
          else if (L === 1 && typeof nc.v === 'string') {
            const m = /^(.*?)(\d+)(\D*)$/.exec(nc.v);
            if (m) { const n = +m[2] + i; if (n >= 0) nc.v = m[1] + String(n).padStart(m[2].length, '0') + m[3]; }
          }
          sh.cells[k] = nc;
        }
      }
      st.sel = Object.assign({}, dst);
      changed();
    }
    function fillDir(dir) {
      const g = selRange();
      if (dir === 'down') {
        if (g.r1 === g.r2) { if (g.r1 === 0) return; doFill({ r1: g.r1 - 1, c1: g.c1, r2: g.r1 - 1, c2: g.c2 }, { r1: g.r1 - 1, c1: g.c1, r2: g.r2, c2: g.c2 }); st.sel = g; paintSel(); }
        else doFill({ r1: g.r1, c1: g.c1, r2: g.r1, c2: g.c2 }, g);
      } else if (g.c1 === g.c2) { if (g.c1 === 0) return; doFill({ r1: g.r1, c1: g.c1 - 1, r2: g.r2, c2: g.c1 - 1 }, { r1: g.r1, c1: g.c1 - 1, r2: g.r2, c2: g.c2 }); st.sel = g; paintSel(); }
      else doFill({ r1: g.r1, c1: g.c1, r2: g.r2, c2: g.c1 }, g);
    }

    /* ---------- 영역·정렬·필터 ---------- */
    function currentRegion(r, c) {
      const sh = cur();
      const g = { r1: r, c1: c, r2: r, c2: c };
      const filled = (rr, cc) => rr >= 0 && cc >= 0 && !isEmptyCell(sh.cells[K(rr, cc)]);
      for (let it = 0; it < 500; it++) {
        let grew = false;
        for (let cc = g.c1 - 1; cc <= g.c2 + 1; cc++) { if (filled(g.r1 - 1, cc)) { g.r1--; grew = true; break; } }
        for (let cc = g.c1 - 1; cc <= g.c2 + 1; cc++) { if (filled(g.r2 + 1, cc)) { g.r2++; grew = true; break; } }
        for (let rr = g.r1 - 1; rr <= g.r2 + 1; rr++) { if (filled(rr, g.c1 - 1)) { g.c1--; grew = true; break; } }
        for (let rr = g.r1 - 1; rr <= g.r2 + 1; rr++) { if (filled(rr, g.c2 + 1)) { g.c2++; grew = true; break; } }
        if (!grew) break;
      }
      g.r2 = Math.min(g.r2, sh.rows - 1); g.c2 = Math.min(g.c2, sh.cols - 1);
      return g;
    }
    const TOTAL_RE = /^(합\s*계|총\s*계|소\s*계|누\s*계|계|total|sum)$/i;
    function rowInfo(r, g) {
      const si = book.active;
      let n = 0, t = 0, num = 0, styled = false, first = null;
      for (let c = g.c1; c <= g.c2; c++) {
        const d = display(si, r, c);
        if (d.k === 'empty') continue;
        n++;
        if (first == null) first = d.t.trim();
        if (d.k === 'text') t++;
        if (d.k === 'num') num++;
        const s = (cur().cells[K(r, c)] || {}).s;
        if (s && (s.b || s.bg)) styled = true;
      }
      return { n, t, num, styled, first };
    }
    // 데이터 표 범위 찾기: 위쪽 제목·머리글, 아래쪽 합계 행을 가려냄
    function tableRange(g0) {
      const sh = cur();
      const single = g0.r1 === g0.r2 && g0.c1 === g0.c2;
      const f = sh.filter;
      if (single && f && inRange({ r1: f.r1, c1: f.c1, r2: filterLast(sh), c2: f.c2 }, g0.r1, g0.c1)) {
        return { g: { r1: f.r1, c1: f.c1, r2: filterLast(sh), c2: f.c2 }, head: true };
      }
      let g = single ? currentRegion(g0.r1, g0.c1) : Object.assign({}, g0);
      if (!single) return { g, head: hasHeader(g) };
      const anchor = g0.r1;
      const merged = (r) => sh.merges.some((m) => m.r1 <= r && m.r2 >= r && m.c1 !== m.c2);
      let head = false;
      for (let r = anchor; r >= g.r1; r--) {
        if (merged(r)) continue;
        const a = rowInfo(r, g);
        const below = r < g.r2 ? rowInfo(r + 1, g) : null;
        const need = Math.min(2, g.c2 - g.c1 + 1);
        if (a.n >= need && a.t === a.n && (a.styled || (below && below.num > 0))) { g.r1 = r; head = true; break; }
      }
      if (!head) {
        while (g.r1 < anchor && merged(g.r1)) g.r1++;
        head = hasHeader(g);
      }
      while (g.r2 > g.r1 + (head ? 1 : 0)) {
        const z = rowInfo(g.r2, g);
        if (z.first != null && TOTAL_RE.test(z.first)) g.r2--; else break;
      }
      return { g, head };
    }
    function workRange() { return tableRange(selRange()).g; }
    function hasHeader(g) {
      if (g.r1 === g.r2) return false;
      const si = book.active;
      let text = 0, cnt = 0, numBelow = false;
      for (let c = g.c1; c <= g.c2; c++) {
        const d = display(si, g.r1, c);
        if (d.k !== 'empty') { cnt++; if (d.k === 'text') text++; }
        if (display(si, g.r1 + 1, c).k === 'num') numBelow = true;
      }
      const s = (cur().cells[K(g.r1, g.c1)] || {}).s || {};
      return cnt > 0 && text === cnt && (numBelow || !!s.b || !!s.bg);
    }
    function sortKey(d) { return d.k === 'empty' ? null : d.k === 'num' ? d.v : d.k === 'bool' ? (d.v ? 1 : 0) : d.t; }
    function compareKeys(a, b, asc) {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      let r;
      if (typeof a === 'number' && typeof b === 'number') r = a - b;
      else if (typeof a === 'number') r = -1;
      else if (typeof b === 'number') r = 1;
      else r = String(a).localeCompare(String(b), 'ko', { numeric: true });
      return asc ? r : -r;
    }
    function doSort(body, keys) {
      const sh = cur(), si = book.active;
      if (sh.merges.some((m) => !(m.r2 < body.r1 || m.r1 > body.r2 || m.c2 < body.c1 || m.c1 > body.c2))) {
        P.ui.toast('병합된 셀이 있어 정렬할 수 없습니다. 병합을 먼저 해제하세요.', 'warn');
        return;
      }
      pushUndo();
      const rows = [];
      for (let r = body.r1; r <= body.r2; r++) {
        const cells = [];
        for (let c = body.c1; c <= body.c2; c++) cells.push(sh.cells[K(r, c)]);
        rows.push({ r, cells, keys: keys.map((k) => sortKey(display(si, r, k.c))) });
      }
      rows.sort((a, b) => {
        for (let i = 0; i < keys.length; i++) { const x = compareKeys(a.keys[i], b.keys[i], keys[i].asc); if (x) return x; }
        return a.r - b.r;
      });
      rows.forEach((row, i) => {
        const nr = body.r1 + i;
        row.cells.forEach((cell, j) => {
          const k = K(nr, body.c1 + j);
          if (!cell) { delete sh.cells[k]; return; }
          const nc = JSON.parse(JSON.stringify(cell));
          if (nc.f != null && nr !== row.r) nc.f = shiftFormula(nc.f, nr - row.r, 0);
          sh.cells[k] = nc;
        });
      });
      changed();
    }
    function quickSort(asc) {
      const { g, head } = tableRange(selRange());
      const body = Object.assign({}, g, { r1: g.r1 + (head ? 1 : 0) });
      if (body.r2 <= body.r1) { P.ui.toast('정렬할 데이터가 부족합니다.'); return; }
      const c = Math.min(Math.max(st.act.c, g.c1), g.c2);
      doSort(body, [{ c, asc }]);
      P.ui.toast(colName(c) + '열 기준 ' + (asc ? '오름차순' : '내림차순') + ' 정렬' + (head ? ' (첫 행 제목 제외)' : ''), 'ok');
    }
    function sortDialog() {
      const tr = tableRange(selRange());
      const g = tr.g;
      const si = book.active;
      const opts = (useHead) => {
        let h = '';
        for (let c = g.c1; c <= g.c2; c++) {
          const t = useHead ? dispText(si, g.r1, c) : '';
          h += '<option value="' + c + '">' + colName(c) + '열' + (t ? ' · ' + esc(t) : '') + '</option>';
        }
        return h;
      };
      const head = tr.head;
      const body = document.createElement('div');
      body.innerHTML = '<p class="muted">범위: ' + rangeA1(g) + '</p>' +
        '<label class="sheets-check"><input type="checkbox" name="head"' + (head ? ' checked' : '') + '> 첫 행은 제목(정렬 제외)</label>' +
        '<div class="sheets-2col">' + fieldHTML('정렬 기준', '<select name="k1">' + opts(head) + '</select>') + fieldHTML('순서', '<select name="o1"><option value="1">오름차순(가→하, 1→9)</option><option value="0">내림차순</option></select>') + '</div>' +
        '<div class="sheets-2col">' + fieldHTML('다음 기준(선택)', '<select name="k2"><option value="">없음</option>' + opts(head) + '</select>') + fieldHTML('순서', '<select name="o2"><option value="1">오름차순</option><option value="0">내림차순</option></select>') + '</div>';
      const q = (n) => body.querySelector('[name="' + n + '"]');
      q('k1').value = String(Math.min(Math.max(st.act.c, g.c1), g.c2));
      q('head').addEventListener('change', () => { const a = q('k1').value, b = q('k2').value; q('k1').innerHTML = opts(q('head').checked); q('k2').innerHTML = '<option value="">없음</option>' + opts(q('head').checked); q('k1').value = a; q('k2').value = b; });
      P.ui.modal({
        title: '정렬', body,
        actions: [{ label: '취소' }, {
          label: '정렬', primary: true, onClick: () => {
            const keys = [{ c: +q('k1').value, asc: q('o1').value === '1' }];
            if (q('k2').value !== '') keys.push({ c: +q('k2').value, asc: q('o2').value === '1' });
            const b2 = Object.assign({}, g, { r1: g.r1 + (q('head').checked ? 1 : 0) });
            if (b2.r2 <= b2.r1) { P.ui.toast('정렬할 데이터가 부족합니다.'); return; }
            doSort(b2, keys);
          }
        }]
      });
    }
    function toggleFilter() {
      const sh = cur();
      pushUndo();
      if (sh.filter) { sh.filter = null; changed(); P.ui.toast('필터를 해제했습니다.'); return; }
      const g = workRange();
      sh.filter = { r1: g.r1, c1: g.c1, c2: g.c2, cond: {} };
      changed();
      P.ui.toast('제목 행의 ▾ 단추로 걸러 볼 값을 고르세요.');
    }
    function filterDialog(c) {
      const sh = cur(), si = book.active, f = sh.filter;
      if (!f) return;
      const last = filterLast(sh);
      const counts = new Map();
      for (let r = f.r1 + 1; r <= last; r++) { const t = dispText(si, r, c); counts.set(t, (counts.get(t) || 0) + 1); }
      const vals = Array.from(counts.keys()).sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'ko', { numeric: true })));
      const allowed = f.cond[c] ? new Set(f.cond[c]) : null;
      const body = document.createElement('div');
      body.className = 'sheets-filter';
      body.innerHTML = '<div class="toolbar"><button type="button" class="btn btn-sm" data-s="1">오름차순 정렬</button><button type="button" class="btn btn-sm" data-s="0">내림차순 정렬</button></div>' +
        '<input type="search" placeholder="값 검색" aria-label="값 검색">' +
        '<label class="sheets-check sheets-fall"><input type="checkbox" data-all checked> (모두 선택)</label>' +
        '<div class="sheets-flist">' + vals.map((v, i) => '<label class="sheets-check" data-t="' + esc(v.toLowerCase()) + '"><input type="checkbox" data-i="' + i + '"' + (!allowed || allowed.has(v) ? ' checked' : '') + '> ' + (v === '' ? '<span class="muted">(빈 셀)</span>' : esc(v)) + ' <span class="muted">' + counts.get(v) + '</span></label>').join('') + '</div>';
      const boxes = () => Array.from(body.querySelectorAll('.sheets-flist input'));
      const allBox = body.querySelector('[data-all]');
      allBox.checked = boxes().every((b) => b.checked);
      allBox.addEventListener('change', () => boxes().forEach((b) => { if (b.parentElement.style.display !== 'none') b.checked = allBox.checked; }));
      body.querySelector('input[type=search]').addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        body.querySelectorAll('.sheets-flist label').forEach((l) => { l.style.display = !q || l.dataset.t.includes(q) ? '' : 'none'; });
      });
      let close = null;
      body.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => {
        close();
        doSort({ r1: f.r1 + 1, c1: f.c1, r2: last, c2: f.c2 }, [{ c, asc: b.dataset.s === '1' }]);
      }));
      close = P.ui.modal({
        title: colName(c) + '열 필터 · ' + (dispText(si, f.r1, c) || ''), body,
        actions: [
          { label: '이 열 필터 지우기', onClick: () => { pushUndo(); delete f.cond[c]; changed(); } },
          { label: '취소' },
          {
            label: '적용', primary: true, onClick: () => {
              const chosen = boxes().filter((b) => b.checked).map((b) => vals[+b.dataset.i]);
              if (!chosen.length) { P.ui.toast('하나 이상 고르세요.', 'warn'); return false; }
              pushUndo();
              if (chosen.length === vals.length) delete f.cond[c]; else f.cond[c] = chosen;
              changed();
            }
          }
        ]
      });
    }

    /* ---------- 조건부 서식·데이터 유효성 ---------- */
    function cfDialog() {
      const sh = cur();
      const body = document.createElement('div');
      const listHTML = () => (sh.cf.length ? '<h3 class="sheets-h3">적용된 규칙</h3><ul class="sheets-rules">' + sh.cf.map((x) =>
        '<li><span><b>' + esc(x.range) + '</b> ' + esc(CF_TYPES[x.type] || x.type) + (x.a != null && x.a !== '' && !['dup', 'above', 'below', 'bar', 'scale'].includes(x.type) ? ' ' + esc(x.a) : '') + (x.type === 'between' ? ' ~ ' + esc(x.b) : '') +
        (x.style && CF_STYLES[x.style] ? ' → ' + CF_STYLES[x.style].label : '') + '</span><button type="button" class="btn btn-ghost btn-sm" data-del="' + x.id + '">삭제</button></li>').join('') + '</ul>' : '');
      body.innerHTML = fieldHTML('적용 범위', '<input name="range" value="' + rangeA1(selRange()) + '">') +
        '<div class="sheets-2col">' + fieldHTML('규칙', '<select name="type">' + Object.keys(CF_TYPES).map((k) => '<option value="' + k + '">' + CF_TYPES[k] + '</option>').join('') + '</select>') +
        fieldHTML('서식', '<select name="style">' + Object.keys(CF_STYLES).map((k) => '<option value="' + k + '">' + CF_STYLES[k].label + '</option>').join('') + '</select>') + '</div>' +
        '<div class="sheets-2col"><div data-f="a">' + fieldHTML('값', '<input name="a" placeholder="예: 100, 완료">') + '</div><div data-f="b">' + fieldHTML('두 번째 값', '<input name="b">') + '</div>' +
        '<div data-f="color">' + fieldHTML('색', '<input type="color" name="color" value="#4c6ef5">') + '</div></div><div class="sheets-cflist">' + listHTML() + '</div>';
      const q = (n) => body.querySelector('[name="' + n + '"]');
      const sync = () => {
        const t = q('type').value;
        body.querySelector('[data-f="a"]').hidden = ['dup', 'above', 'below', 'bar', 'scale'].includes(t);
        body.querySelector('[data-f="b"]').hidden = t !== 'between';
        body.querySelector('[data-f="color"]').hidden = !['bar', 'scale'].includes(t);
        q('style').closest('.field').hidden = ['bar', 'scale'].includes(t);
        if (t === 'top' || t === 'bottom') q('a').placeholder = '개수(예: 10)';
        else q('a').placeholder = '예: 100, 완료';
        if (t === 'scale') q('color').value = '#2f9e44';
      };
      q('type').addEventListener('change', sync);
      sync();
      body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-del]');
        if (!b) return;
        pushUndo();
        sh.cf = sh.cf.filter((x) => x.id !== b.dataset.del);
        changed();
        body.querySelector('.sheets-cflist').innerHTML = listHTML();
      });
      P.ui.modal({
        title: '조건부 서식', body, wide: true,
        actions: [{ label: '닫기' }, {
          label: '규칙 추가', primary: true, onClick: () => {
            const g = parseRange(q('range').value.toUpperCase());
            if (!g) { P.ui.toast('범위를 A1:B10 형식으로 입력하세요.', 'warn'); return false; }
            const t = q('type').value;
            if (['gt', 'lt', 'between', 'eq', 'neq', 'contains'].includes(t) && q('a').value === '') { P.ui.toast('값을 입력하세요.', 'warn'); return false; }
            const num = (v) => (v.trim() !== '' && !isNaN(Number(v.replace(/,/g, ''))) ? Number(v.replace(/,/g, '')) : v);
            pushUndo();
            sh.cf.push({ id: P.store.uid(), range: rangeA1(g), type: t, a: num(q('a').value), b: num(q('b').value), style: q('style').value, color: q('color').value });
            changed();
            P.ui.toast('조건부 서식을 추가했습니다.', 'ok');
          }
        }]
      });
    }
    function dvDialog() {
      const sh = cur();
      const body = document.createElement('div');
      const listHTML = () => (sh.dv.length ? '<h3 class="sheets-h3">적용된 규칙</h3><ul class="sheets-rules">' + sh.dv.map((x) =>
        '<li><span><b>' + esc(x.range) + '</b> ' + (x.type === 'list' ? '목록: ' + esc((x.items || []).join(', ')) : '숫자 ' + esc(x.min) + ' ~ ' + esc(x.max)) + (x.strict === false ? ' (경고만)' : '') +
        '</span><button type="button" class="btn btn-ghost btn-sm" data-del="' + x.id + '">삭제</button></li>').join('') + '</ul>' : '');
      body.innerHTML = fieldHTML('적용 범위', '<input name="range" value="' + rangeA1(selRange()) + '">') +
        fieldHTML('종류', '<select name="type"><option value="list">목록에서 고르기(드롭다운)</option><option value="number">숫자 범위</option></select>') +
        '<div data-f="list">' + fieldHTML('목록 항목 (쉼표로 구분)', '<input name="items" placeholder="예: 양호, 수리 필요, 불용">') + '</div>' +
        '<div class="sheets-2col" data-f="number">' + fieldHTML('최솟값', '<input name="min" inputmode="decimal">') + fieldHTML('최댓값', '<input name="max" inputmode="decimal">') + '</div>' +
        '<label class="sheets-check"><input type="checkbox" name="strict" checked> 잘못된 값은 입력을 막기 (끄면 경고만)</label>' +
        '<div class="sheets-dvlist">' + listHTML() + '</div>';
      const q = (n) => body.querySelector('[name="' + n + '"]');
      const sync = () => { body.querySelector('[data-f="list"]').hidden = q('type').value !== 'list'; body.querySelector('[data-f="number"]').hidden = q('type').value !== 'number'; };
      q('type').addEventListener('change', sync);
      sync();
      body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-del]');
        if (!b) return;
        pushUndo();
        sh.dv = sh.dv.filter((x) => x.id !== b.dataset.del);
        changed();
        body.querySelector('.sheets-dvlist').innerHTML = listHTML();
      });
      P.ui.modal({
        title: '데이터 유효성 검사', body,
        actions: [{ label: '닫기' }, {
          label: '규칙 추가', primary: true, onClick: () => {
            const g = parseRange(q('range').value.toUpperCase());
            if (!g) { P.ui.toast('범위를 A1:B10 형식으로 입력하세요.', 'warn'); return false; }
            const rule = { id: P.store.uid(), range: rangeA1(g), type: q('type').value, strict: q('strict').checked };
            if (rule.type === 'list') {
              rule.items = q('items').value.split(',').map((s) => s.trim()).filter(Boolean);
              if (!rule.items.length) { P.ui.toast('목록 항목을 입력하세요.', 'warn'); return false; }
            } else {
              rule.min = q('min').value.trim(); rule.max = q('max').value.trim();
              if (rule.min === '' && rule.max === '') { P.ui.toast('최솟값이나 최댓값을 입력하세요.', 'warn'); return false; }
            }
            pushUndo();
            sh.dv = sh.dv.filter((x) => x.range !== rule.range);
            sh.dv.push(rule);
            changed();
            P.ui.toast('유효성 규칙을 추가했습니다.', 'ok');
          }
        }]
      });
    }
    function dvMenu() {
      const dv = dvAt(st.act.r, st.act.c);
      if (!dv || dv.type !== 'list') return;
      const r = st.act.r, c = st.act.c;
      const curT = dispText(book.active, r, c);
      popMenu(dvbtn, dv.items.map((it) => ({ label: it, checked: it === curT, onClick: () => { setInput(r, c, it); focusGrid(); } }))
        .concat([{ sep: true }, { label: '지우기', onClick: () => { setInput(r, c, ''); focusGrid(); } }]));
    }

    /* ---------- 행·열 삽입·삭제 ---------- */
    function structural(axis, at, n) {
      const sh = cur();
      if (n < 0 && (axis === 'r' ? sh.rows : sh.cols) + n < 1) { P.ui.toast('모든 행/열을 지울 수는 없습니다.', 'warn'); return; }
      pushUndo();
      const nc = {};
      for (const k in sh.cells) {
        const i = k.indexOf(',');
        let r = +k.slice(0, i), c = +k.slice(i + 1);
        let p = axis === 'r' ? r : c;
        if (n > 0) { if (p >= at) p += n; }
        else { const d = -n; if (p >= at && p < at + d) continue; if (p >= at + d) p -= d; }
        if (axis === 'r') r = p; else c = p;
        nc[K(r, c)] = sh.cells[k];
      }
      sh.cells = nc;
      const sizes = axis === 'r' ? sh.rowH : sh.colW;
      const ns = {};
      for (const k in sizes) {
        let p = +k;
        if (n > 0) { if (p >= at) p += n; } else { const d = -n; if (p >= at && p < at + d) continue; if (p >= at + d) p -= d; }
        ns[p] = sizes[k];
      }
      if (axis === 'r') sh.rowH = ns; else sh.colW = ns;
      sh.merges = sh.merges.map((m) => parseRange(shiftRangeStr(rangeA1(m), axis, at, n))).filter((m) => m && (m.r1 !== m.r2 || m.c1 !== m.c2));
      sh.cf = sh.cf.map((x) => { const r = shiftRangeStr(x.range, axis, at, n); return r ? Object.assign({}, x, { range: r }) : null; }).filter(Boolean);
      sh.dv = sh.dv.map((x) => { const r = shiftRangeStr(x.range, axis, at, n); return r ? Object.assign({}, x, { range: r }) : null; }).filter(Boolean);
      if (sh.filter) {
        const f = sh.filter;
        const g = parseRange(shiftRangeStr(rangeA1({ r1: f.r1, c1: f.c1, r2: f.r1, c2: f.c2 }), axis, at, n));
        if (!g) sh.filter = null;
        else {
          const cond = {};
          if (axis === 'c') for (const c in f.cond) { const p = +c; if (n > 0) cond[p >= at ? p + n : p] = f.cond[c]; else if (p < at) cond[p] = f.cond[c]; else if (p >= at - n) cond[p + n] = f.cond[c]; }
          sh.filter = { r1: g.r1, c1: g.c1, c2: g.c2, cond: axis === 'c' ? cond : f.cond };
        }
      }
      if (axis === 'r') sh.rows = Math.max(1, Math.min(MAX_ROWS, sh.rows + n)); else sh.cols = Math.max(1, Math.min(MAX_COLS, sh.cols + n));
      book.sheets.forEach((s2) => { for (const k in s2.cells) { const cell = s2.cells[k]; if (cell.f != null) cell.f = structFormula(cell.f, s2.name, sh.name, axis, at, n); } });
      changed();
    }
    function insRows(below) { const g = selRange(); const n = g.r2 - g.r1 + 1; structural('r', below ? g.r2 + 1 : g.r1, n); }
    function delRows() { const g = selRange(); structural('r', g.r1, -(g.r2 - g.r1 + 1)); }
    function insCols(right) { const g = selRange(); const n = g.c2 - g.c1 + 1; if (cur().cols + n > MAX_COLS) { P.ui.toast('열은 최대 ' + MAX_COLS + '개까지입니다.', 'warn'); return; } structural('c', right ? g.c2 + 1 : g.c1, n); }
    function delCols() { const g = selRange(); structural('c', g.c1, -(g.c2 - g.c1 + 1)); }

    /* ---------- 자동 합계·함수 ---------- */
    function autoFn(fn) {
      const g = selRange();
      const sh = cur(), si = book.active;
      const isNum = (r, c) => { const d = display(si, r, c); return d.k === 'num'; };
      if (g.r2 > g.r1 || g.c2 > g.c1) {
        pushUndo();
        if (g.r2 > g.r1) {
          for (let c = g.c1; c <= g.c2; c++) { ensureSize(sh, g.r2 + 1, c); writeCell(sh, g.r2 + 1, c, '=' + fn + '(' + a1(g.r1, c) + ':' + a1(g.r2, c) + ')'); }
        } else {
          ensureSize(sh, g.r1, g.c2 + 1);
          writeCell(sh, g.r1, g.c2 + 1, '=' + fn + '(' + a1(g.r1, g.c1) + ':' + a1(g.r1, g.c2) + ')');
        }
        changed();
        return;
      }
      const { r, c } = st.act;
      let r0 = r - 1;
      while (r0 >= 0 && isNum(r0, c)) r0--;
      if (r0 < r - 1) { setInput(r, c, '=' + fn + '(' + a1(r0 + 1, c) + ':' + a1(r - 1, c) + ')'); return; }
      let c0 = c - 1;
      while (c0 >= 0 && isNum(r, c0)) c0--;
      if (c0 < c - 1) { setInput(r, c, '=' + fn + '(' + a1(r, c0 + 1) + ':' + a1(r, c - 1) + ')'); return; }
      startEdit('edit', '=' + fn + '(');
    }
    function insertFunction(name) {
      if (st.editing && inp.value[0] === '=') { insertAtCaret(inp, name + '('); grow(); fx.value = inp.value; focusGrid(); return; }
      startEdit('edit', '=' + name + '(');
    }
    function fxMenu() {
      const groups = [
        ['기본', ['SUM', 'AVERAGE', 'COUNT', 'COUNTA', 'MAX', 'MIN', 'ROUND']],
        ['조건', ['IF', 'IFS', 'IFERROR', 'COUNTIF', 'COUNTIFS', 'SUMIF', 'SUMIFS', 'AVERAGEIF']],
        ['찾기', ['VLOOKUP', 'XLOOKUP', 'INDEX', 'MATCH', 'HLOOKUP']],
        ['날짜', ['TODAY', 'DATE', 'YEAR', 'MONTH', 'DAY', 'WEEKDAY', 'DATEDIF', 'EOMONTH', 'NETWORKDAYS']],
        ['문자', ['TEXT', 'LEFT', 'RIGHT', 'MID', 'LEN', 'TRIM', 'CONCAT', 'TEXTJOIN', 'SUBSTITUTE']],
        ['통계', ['RANK', 'LARGE', 'SMALL', 'MEDIAN', 'STDEV', 'SUMPRODUCT', 'SUBTOTAL']]
      ];
      const items = [];
      groups.forEach(([g, fns], i) => {
        if (i) items.push({ sep: true });
        items.push({ head: g });
        fns.forEach((n) => items.push({ label: n, hint: FUNC_HELP[n] || '', onClick: () => insertFunction(n) }));
      });
      popMenu($('.sheets-fx'), items).classList.add('sheets-menu-tall');
    }

    /* ---------- 찾기·바꾸기 ---------- */
    function findDialog(withReplace) {
      const body = document.createElement('div');
      body.innerHTML = fieldHTML('찾을 내용', '<input name="q" autocomplete="off">') +
        (withReplace ? fieldHTML('바꿀 내용', '<input name="rep" autocomplete="off">') : '') +
        '<label class="sheets-check"><input type="checkbox" name="cs"> 대/소문자 구분</label> <label class="sheets-check"><input type="checkbox" name="whole"> 셀 내용 전체 일치</label><p class="muted sheets-found" aria-live="polite"></p>';
      const q = (n) => body.querySelector('[name="' + n + '"]');
      const msg = body.querySelector('.sheets-found');
      const sh = cur(), si = book.active;
      const matcher = () => {
        const s = q('q').value;
        if (!s) return null;
        const cs = q('cs').checked, whole = q('whole').checked;
        return (t) => { const a = cs ? t : t.toLowerCase(), b = cs ? s : s.toLowerCase(); return whole ? a === b : a.includes(b); };
      };
      const keys = () => Object.keys(sh.cells).map((k) => k.split(',').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const findNext = () => {
        const m = matcher();
        if (!m) return false;
        const all = keys().filter(([r, c]) => m(dispText(si, r, c)) || m(rawText(sh.cells[K(r, c)])));
        if (!all.length) { msg.textContent = '찾는 내용이 없습니다.'; return false; }
        const nx = all.find(([r, c]) => r > st.act.r || (r === st.act.r && c > st.act.c)) || all[0];
        select(nx[0], nx[1]);
        msg.textContent = all.length + '개 중 ' + (all.indexOf(nx) + 1) + '번째 (' + a1(nx[0], nx[1]) + ')';
        return false;
      };
      const replaceIn = (cell, rep) => {
        const s = q('q').value, cs = q('cs').checked, whole = q('whole').checked;
        const raw = rawText(cell);
        if (whole) return (cs ? raw === s : raw.toLowerCase() === s.toLowerCase()) ? rep : null;
        const re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), cs ? 'g' : 'gi');
        return re.test(raw) ? raw.replace(re, () => rep) : null;
      };
      const actions = [{ label: '닫기' }];
      if (withReplace) {
        actions.push({ label: '바꾸기', onClick: () => {
          const cell = sh.cells[K(st.act.r, st.act.c)];
          const nv = cell && replaceIn(cell, q('rep').value);
          if (nv != null) setInput(st.act.r, st.act.c, nv);
          return findNext();
        } });
        actions.push({ label: '모두 바꾸기', onClick: () => {
          if (!q('q').value) return false;
          pushUndo();
          let n = 0;
          keys().forEach(([r, c]) => { const nv = replaceIn(sh.cells[K(r, c)], q('rep').value); if (nv != null) { writeCell(sh, r, c, nv); n++; } });
          changed();
          msg.textContent = n + '개를 바꿨습니다.';
          return false;
        } });
      }
      actions.push({ label: '다음 찾기', primary: true, onClick: findNext });
      P.ui.modal({ title: withReplace ? '찾기 및 바꾸기' : '찾기', body, actions });
      q('q').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); findNext(); } });
    }

    /* ---------- 메뉴 ---------- */
    function cellMenu(pt) {
      const g = selRange();
      const whole = { rows: g.c1 === 0 && g.c2 === cur().cols - 1, cols: g.r1 === 0 && g.r2 === cur().rows - 1 };
      const nr = g.r2 - g.r1 + 1, ncl = g.c2 - g.c1 + 1;
      popMenu(pt, [
        { label: '잘라내기', key: 'Ctrl+X', onClick: () => { copySel(true); writeClipboard(); } },
        { label: '복사', key: 'Ctrl+C', onClick: () => { copySel(false); writeClipboard(); } },
        { label: '붙여넣기', key: 'Ctrl+V', onClick: pasteFromMenu },
        { sep: true },
        !whole.cols && { label: '위에 행 ' + nr + '개 삽입', onClick: () => insRows(false) },
        !whole.cols && { label: '아래에 행 ' + nr + '개 삽입', onClick: () => insRows(true) },
        !whole.cols && { label: '행 ' + nr + '개 삭제', onClick: delRows },
        !whole.rows && { label: '왼쪽에 열 ' + ncl + '개 삽입', onClick: () => insCols(false) },
        !whole.rows && { label: '오른쪽에 열 ' + ncl + '개 삽입', onClick: () => insCols(true) },
        !whole.rows && { label: '열 ' + ncl + '개 삭제', onClick: delCols },
        { sep: true },
        { label: '내용 지우기', key: 'Del', onClick: () => clearSel('contents') },
        { label: '서식 지우기', onClick: () => clearSel('formats') },
        { label: '셀 병합/해제', onClick: toggleMerge },
        { sep: true },
        { label: '선택 영역으로 차트 만들기', onClick: toChart }
      ].filter((x) => x !== false), { noFocus: false });
    }
    function writeClipboard() {
      if (!st.clip || !navigator.clipboard) return;
      navigator.clipboard.writeText(st.clip.text).catch(() => {});
    }
    function colorMenu(btn, key) {
      const colors = ['#000000', '#495057', '#868e96', '#ffffff', '#c92a2a', '#e8590c', '#f08c00', '#2b8a3e', '#0b7285', '#1864ab', '#5f3dc4', '#a61e4d',
        '#ffe3e3', '#ffe8cc', '#fff3bf', '#d3f9d8', '#c5f6fa', '#d0ebff', '#e5dbff', '#f1f3f5'];
      closeMenus();
      const m = popMenu(btn, [{ label: key === 'bg' ? '채우기 없음' : '자동(기본색)', onClick: () => styleSel({ [key]: null }) }]);
      const grid = document.createElement('div');
      grid.className = 'sheets-swatches';
      grid.innerHTML = colors.map((c) => '<button type="button" style="background:' + c + '" data-c="' + c + '" aria-label="' + c + '"></button>').join('') +
        '<label class="sheets-custom">다른 색 <input type="color" value="#1e2b5c"></label>';
      grid.addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b) { closeMenus(); styleSel({ [key]: b.dataset.c }); } });
      grid.querySelector('input').addEventListener('change', (e) => { closeMenus(); styleSel({ [key]: e.target.value }); });
      m.appendChild(grid);
    }

    /* ---------- 리본 ---------- */
    const I = (d) => '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
    const IC = {
      undo: I('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
      redo: I('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'),
      al: I('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'), ac: I('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'), ar: I('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>'),
      wrap: I('<path d="M4 6h16M4 12h13a3 3 0 0 1 0 6h-4"/><path d="M15 16l-2 2 2 2M4 18h5"/>'),
      merge: I('<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M7 12h10M7 12l2-2M7 12l2 2M17 12l-2-2M17 12l-2 2"/>'),
      border: I('<rect x="4" y="4" width="16" height="16"/><path d="M4 12h16M12 4v16" stroke-dasharray="2 2.5"/>'),
      freeze: I('<rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M3 9h18M9 3v18"/>'),
      sa: I('<path d="M7 4v16M4 17l3 3 3-3M14 6h2M14 11h4M14 16h6"/>'), sd: I('<path d="M7 4v16M4 17l3 3 3-3M14 6h6M14 11h4M14 16h2"/>'),
      filter: I('<path d="M4 5h16l-6 7.5V18l-4 2v-7.5z"/>'),
      cf: I('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M10 4v16"/><path d="M13 15h5" stroke-width="3"/>'),
      dv: I('<path d="M4 6h10M4 12h10M4 18h6M15 17l2.5 2.5L22 15"/>'),
      rows: I('<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 12h18M12 4v16"/><path d="M17 1v4M15 3h4" />'),
      clear: I('<path d="M16 4l4 4-10 10H6v-4z"/><path d="M4 21h16"/>'),
      fill: I('<path d="M5 11l7-7 7 7-7 7z"/><path d="M19 16s2 2.3 2 3.5a2 2 0 0 1-4 0c0-1.2 2-3.5 2-3.5z"/>'),
      text: I('<path d="M6 18L12 5l6 13M8.5 13h7"/>')
    };
    const fsOpts = [9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 36];
    ribbon.innerHTML =
      '<div class="sheets-grp"><button type="button" data-cmd="undo" title="실행 취소 (Ctrl+Z)" aria-label="실행 취소">' + IC.undo + '</button><button type="button" data-cmd="redo" title="다시 실행 (Ctrl+Y)" aria-label="다시 실행">' + IC.redo + '</button></div>' +
      '<div class="sheets-grp"><select data-cmd="fmt" title="표시 형식" aria-label="표시 형식">' + FORMATS.map(([v, l]) => '<option value="' + esc(v) + '">' + esc(l) + '</option>').join('') + '</select>' +
        '<button type="button" data-cmd="comma" title="쉼표 스타일(천 단위)" aria-label="쉼표 스타일"><b>,</b></button><button type="button" data-cmd="pct" title="백분율" aria-label="백분율"><b>%</b></button>' +
        '<button type="button" data-cmd="dec+" title="소수 자릿수 늘리기" aria-label="소수 자릿수 늘리기"><small>.0</small>+</button><button type="button" data-cmd="dec-" title="소수 자릿수 줄이기" aria-label="소수 자릿수 줄이기"><small>.0</small>−</button></div>' +
      '<div class="sheets-grp"><select data-cmd="fs" title="글자 크기" aria-label="글자 크기"><option value="">크기</option>' + fsOpts.map((n) => '<option value="' + n + '">' + n + '</option>').join('') + '</select>' +
        '<button type="button" data-cmd="b" title="굵게 (Ctrl+B)" aria-label="굵게"><b>가</b></button><button type="button" data-cmd="i" title="기울임 (Ctrl+I)" aria-label="기울임"><i>가</i></button>' +
        '<button type="button" data-cmd="u" title="밑줄 (Ctrl+U)" aria-label="밑줄"><u>가</u></button><button type="button" data-cmd="st" title="취소선" aria-label="취소선"><s>가</s></button>' +
        '<button type="button" data-cmd="fc" title="글자색" aria-label="글자색" class="sheets-cbtn">' + IC.text + '<span class="sheets-cbar" data-k="fc"></span></button>' +
        '<button type="button" data-cmd="bg" title="채우기 색" aria-label="채우기 색" class="sheets-cbtn">' + IC.fill + '<span class="sheets-cbar" data-k="bg"></span></button></div>' +
      '<div class="sheets-grp"><button type="button" data-cmd="al" title="왼쪽 맞춤" aria-label="왼쪽 맞춤">' + IC.al + '</button><button type="button" data-cmd="ac" title="가운데 맞춤" aria-label="가운데 맞춤">' + IC.ac + '</button><button type="button" data-cmd="ar" title="오른쪽 맞춤" aria-label="오른쪽 맞춤">' + IC.ar + '</button>' +
        '<button type="button" data-cmd="wrap" title="텍스트 줄 바꿈" aria-label="줄 바꿈">' + IC.wrap + '</button><button type="button" data-cmd="merge" title="병합하고 가운데 맞춤 / 해제" aria-label="셀 병합">' + IC.merge + '</button>' +
        '<button type="button" data-cmd="border" title="테두리" aria-label="테두리">' + IC.border + '</button></div>' +
      '<div class="sheets-grp"><button type="button" data-cmd="freeze" title="틀 고정" aria-label="틀 고정">' + IC.freeze + '<span class="sheets-lbl">틀 고정</span></button>' +
        '<button type="button" data-cmd="sa" title="오름차순 정렬" aria-label="오름차순 정렬">' + IC.sa + '</button><button type="button" data-cmd="sd" title="내림차순 정렬" aria-label="내림차순 정렬">' + IC.sd + '</button>' +
        '<button type="button" data-cmd="sort" title="정렬 기준 고르기" aria-label="정렬 대화상자"><span class="sheets-lbl keep">정렬</span></button>' +
        '<button type="button" data-cmd="filter" title="필터 켜기/끄기" aria-label="필터">' + IC.filter + '<span class="sheets-lbl">필터</span></button>' +
        '<button type="button" data-cmd="cf" title="조건부 서식" aria-label="조건부 서식">' + IC.cf + '<span class="sheets-lbl">조건부 서식</span></button>' +
        '<button type="button" data-cmd="dv" title="데이터 유효성 검사(목록 등)" aria-label="데이터 유효성 검사">' + IC.dv + '<span class="sheets-lbl">유효성</span></button></div>' +
      '<div class="sheets-grp"><button type="button" data-cmd="sum" title="자동 합계 (Σ)" aria-label="자동 합계"><b>Σ</b><span class="sheets-lbl">합계</span></button>' +
        '<button type="button" data-cmd="rows" title="행·열 삽입/삭제" aria-label="행·열">' + IC.rows + '<span class="sheets-lbl">행·열</span></button>' +
        '<button type="button" data-cmd="find" title="찾기·바꾸기 (Ctrl+F / Ctrl+H)" aria-label="찾기">' + P.icons.search + '</button>' +
        '<button type="button" data-cmd="clear" title="지우기" aria-label="지우기">' + IC.clear + '</button></div>';
    ribbon.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    ribbon.addEventListener('change', (e) => {
      const cmd = e.target.dataset.cmd;
      if (st.editing) commitEdit();
      if (cmd === 'fmt') styleSel({ fmt: e.target.value === 'General' ? null : e.target.value });
      if (cmd === 'fs' && e.target.value) styleSel({ fs: +e.target.value === 13 ? null : +e.target.value });
      focusGrid();
    });
    ribbon.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-cmd]');
      if (!b) return;
      if (st.editing && !commitEdit()) return;
      const cmd = b.dataset.cmd;
      const a = actStyle();
      const run = {
        undo, redo,
        comma: () => styleSel({ fmt: '#,##0' }), pct: () => styleSel({ fmt: '0%' }), 'dec+': () => decimals(1), 'dec-': () => decimals(-1),
        b: () => toggle('b'), i: () => toggle('i'), u: () => toggle('u'), st: () => toggle('st'),
        fc: () => colorMenu(b, 'fc'), bg: () => colorMenu(b, 'bg'),
        al: () => styleSel({ ha: a.ha === 'left' ? null : 'left' }), ac: () => styleSel({ ha: a.ha === 'center' ? null : 'center' }), ar: () => styleSel({ ha: a.ha === 'right' ? null : 'right' }),
        wrap: () => toggle('wrap'), merge: toggleMerge,
        border: () => popMenu(b, [
          { label: '모든 테두리', onClick: () => borders('all') }, { label: '바깥쪽 테두리', onClick: () => borders('outer') },
          { label: '굵은 바깥쪽 테두리', onClick: () => borders('thick') }, { label: '아래쪽 테두리', onClick: () => borders('bottom') },
          { label: '굵은 아래쪽 테두리', onClick: () => borders('double-bottom') }, { sep: true }, { label: '테두리 없음', onClick: () => borders('none') }]),
        freeze: () => popMenu(b, [
          { label: '현재 셀 위·왼쪽 고정 (' + a1(st.act.r, st.act.c) + ')', onClick: () => setFreeze(st.act.r, st.act.c) },
          { label: '첫 행 고정', onClick: () => setFreeze(1, 0) }, { label: '첫 열 고정', onClick: () => setFreeze(0, 1) },
          { label: '틀 고정 해제', onClick: () => setFreeze(0, 0), disabled: !cur().freeze.r && !cur().freeze.c }]),
        sa: () => quickSort(true), sd: () => quickSort(false), sort: sortDialog, filter: toggleFilter, cf: cfDialog, dv: dvDialog,
        sum: () => popMenu(b, [['SUM', '합계'], ['AVERAGE', '평균'], ['COUNT', '숫자 개수'], ['MAX', '최댓값'], ['MIN', '최솟값']].map(([f, l]) => ({ label: l + ' (' + f + ')', onClick: () => autoFn(f) }))
          .concat([{ sep: true }, { label: '함수 더 보기…', onClick: fxMenu }])),
        rows: () => popMenu(b, [
          { label: '위에 행 삽입', onClick: () => insRows(false) }, { label: '아래에 행 삽입', onClick: () => insRows(true) }, { label: '행 삭제', onClick: delRows }, { sep: true },
          { label: '왼쪽에 열 삽입', onClick: () => insCols(false) }, { label: '오른쪽에 열 삽입', onClick: () => insCols(true) }, { label: '열 삭제', onClick: delCols }, { sep: true },
          { label: '아래로 채우기 (Ctrl+D)', onClick: () => fillDir('down') }, { label: '오른쪽으로 채우기 (Ctrl+R)', onClick: () => fillDir('right') }]),
        find: () => findDialog(true),
        clear: () => popMenu(b, [{ label: '내용 지우기', onClick: () => clearSel('contents') }, { label: '서식 지우기', onClick: () => clearSel('formats') }, { label: '모두 지우기', onClick: () => clearSel('all') }])
      }[cmd];
      if (run) run();
      if (!['fc', 'bg', 'border', 'freeze', 'sum', 'rows', 'clear', 'sort', 'cf', 'dv', 'find'].includes(cmd)) focusGrid();
    });
    function syncRibbon() {
      const s = actStyle();
      ribbon.querySelectorAll('button[data-cmd]').forEach((b) => {
        const k = b.dataset.cmd;
        const on = ['b', 'i', 'u', 'st', 'wrap'].includes(k) ? !!s[k] : k === 'al' ? s.ha === 'left' : k === 'ac' ? s.ha === 'center' : k === 'ar' ? s.ha === 'right' : k === 'filter' ? !!cur().filter : k === 'freeze' ? !!(cur().freeze.r || cur().freeze.c) : null;
        if (on !== null) b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      const fsel = ribbon.querySelector('[data-cmd="fmt"]');
      const fv = s.fmt || 'General';
      if (!Array.from(fsel.options).some((o) => o.value === fv)) {
        fsel.querySelectorAll('option[data-custom]').forEach((o) => o.remove());
        const o = document.createElement('option'); o.value = fv; o.textContent = '사용자 지정(' + fv + ')'; o.dataset.custom = '1'; fsel.appendChild(o);
      }
      fsel.value = fv;
      ribbon.querySelector('[data-cmd="fs"]').value = s.fs ? String(s.fs) : '';
      ribbon.querySelectorAll('.sheets-cbar').forEach((x) => { x.style.background = s[x.dataset.k] || (x.dataset.k === 'fc' ? 'var(--text)' : 'transparent'); });
      ribbon.querySelector('[data-cmd="undo"]').disabled = !st.undo.length;
      ribbon.querySelector('[data-cmd="redo"]').disabled = !st.redo.length;
    }
    const _paint = paintSel;
    paintSel = function () { _paint(); syncRibbon(); };

    /* ---------- 시트 탭 ---------- */
    function renderTabs() {
      tabsEl.innerHTML = book.sheets.map((s, i) => '<button type="button" role="tab" class="sheets-tab' + (i === book.active ? ' on' : '') + '" aria-selected="' + (i === book.active) + '" data-i="' + i + '" title="두 번 눌러 이름 바꾸기">' + esc(s.name) + '</button>').join('') +
        '<button type="button" class="sheets-tab-add" title="시트 추가" aria-label="시트 추가">' + P.icons.plus + '</button>';
      const on = tabsEl.querySelector('.on');
      if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    tabsEl.addEventListener('click', (e) => {
      if (e.target.closest('.sheets-tab-add')) { addSheet(); return; }
      const t = e.target.closest('.sheets-tab');
      if (!t) return;
      const i = +t.dataset.i;
      if (i === book.active) sheetMenu(i, t); else switchSheet(i);
    });
    tabsEl.addEventListener('dblclick', (e) => { const t = e.target.closest('.sheets-tab'); if (t) { closeMenus(); renameSheet(+t.dataset.i); } });
    tabsEl.addEventListener('contextmenu', (e) => { const t = e.target.closest('.sheets-tab'); if (t) { e.preventDefault(); sheetMenu(+t.dataset.i, { x: e.clientX, y: e.clientY }); } });
    function sheetMenu(i, at) {
      popMenu(at, [
        { label: '이름 바꾸기', onClick: () => renameSheet(i) }, { label: '복제', onClick: () => dupSheet(i) },
        { label: '왼쪽으로 이동', disabled: i === 0, onClick: () => moveSheet(i, -1) }, { label: '오른쪽으로 이동', disabled: i === book.sheets.length - 1, onClick: () => moveSheet(i, 1) },
        { sep: true }, { label: '삭제', disabled: book.sheets.length < 2, onClick: () => deleteSheet(i) }
      ], { above: at.getBoundingClientRect ? at.getBoundingClientRect().top : at.y });
    }
    function switchSheet(i) {
      if (st.editing && !commitEdit()) return;
      book.active = i;
      st.sel = { r1: 0, c1: 0, r2: 0, c2: 0 };
      st.act = { r: 0, c: 0 };
      wrap.scrollTop = 0; wrap.scrollLeft = 0;
      scheduleSave();
      render();
      focusGrid();
      if (P.resume) P.resume.save('sheets', id, { sheet: i, r: 0, c: 0 });
    }
    function uniqueName(base) {
      const used = new Set(book.sheets.map((s) => s.name.toLowerCase()));
      if (!used.has(base.toLowerCase())) return base;
      for (let k = 2; ; k++) { const n = base.replace(/\s*\(\d+\)$/, '') + ' (' + k + ')'; if (!used.has(n.toLowerCase())) return n; }
    }
    function addSheet() {
      pushUndo();
      let n = book.sheets.length + 1;
      while (book.sheets.some((s) => s.name === '시트' + n)) n++;
      book.sheets.push(newSheet('시트' + n));
      switchSheet(book.sheets.length - 1);
    }
    async function renameSheet(i) {
      const old = book.sheets[i].name;
      const v = await P.ui.prompt('시트 이름', old);
      if (v == null) return;
      const name = v.trim();
      if (!name || name === old) return;
      if (/[[\]:*?/\\!]/.test(name) || name.length > 31) { P.ui.toast('시트 이름에는 [ ] : * ? / \\ ! 를 쓸 수 없고 31자 이내여야 합니다.', 'warn'); return; }
      if (book.sheets.some((s, k) => k !== i && s.name.toLowerCase() === name.toLowerCase())) { P.ui.toast('같은 이름의 시트가 있습니다.', 'warn'); return; }
      pushUndo();
      book.sheets.forEach((s) => { for (const k in s.cells) { const c = s.cells[k]; if (c.f != null) c.f = renameInFormula(c.f, old, name); } });
      book.sheets[i].name = name;
      changed();
    }
    function dupSheet(i) {
      pushUndo();
      const copy = JSON.parse(JSON.stringify(book.sheets[i]));
      copy.id = P.store.uid();
      copy.name = uniqueName(book.sheets[i].name + ' (2)');
      book.sheets.splice(i + 1, 0, copy);
      switchSheet(i + 1);
    }
    function moveSheet(i, d) {
      pushUndo();
      const [s] = book.sheets.splice(i, 1);
      book.sheets.splice(i + d, 0, s);
      book.active = i + d;
      changed();
    }
    async function deleteSheet(i) {
      if (book.sheets.length < 2) return;
      if (!(await P.ui.confirm('"' + book.sheets[i].name + '" 시트를 삭제할까요? 실행 취소(Ctrl+Z)로 되돌릴 수 있습니다.', { danger: true, okLabel: '삭제' }))) return;
      pushUndo();
      const name = book.sheets[i].name.toLowerCase();
      book.sheets.splice(i, 1);
      book.sheets.forEach((s) => { for (const k in s.cells) { const c = s.cells[k]; if (c.f != null) c.f = mapRefs(c.f, (ref) => (ref.sheet && ref.sheet.toLowerCase() === name ? '#REF!' : null)); } });
      book.active = Math.max(0, Math.min(i, book.sheets.length - 1) - (i > 0 ? 1 : 0));
      st.sel = { r1: 0, c1: 0, r2: 0, c2: 0 };
      st.act = { r: 0, c: 0 };
      changed();
    }

    /* ---------- 가져오기·내보내기·인쇄·차트 ---------- */
    function pickFile(accept) {
      return new Promise((resolve) => {
        const f = document.createElement('input');
        f.type = 'file';
        f.accept = accept;
        f.addEventListener('change', () => resolve(f.files && f.files[0]));
        f.click();
      });
    }
    async function importInto(btn, given) {
      const file = given || await pickFile('.xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt');
      if (!file) return;
      try {
        const res = await P.ui.busy(btn, () => readFileAsSheets(file));
        pushUndo();
        res.sheets.forEach((s) => { s.name = uniqueName(s.name); book.sheets.push(s); });
        P.ui.toast(res.sheets.length + '개 시트를 가져왔습니다.', 'ok');
        switchSheet(book.sheets.length - res.sheets.length);
      } catch (e) {
        console.error(e);
        P.ui.toast('파일을 읽지 못했습니다: ' + (e.message || e), 'error');
      }
    }
    function fileName(ext) { return (book.title || '통합문서').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) + '.' + ext; }
    async function exportXLSX() {
      try {
        await P.loadScript(LIB.xlsx);
        const out = bookToXLSX(book, engine);
        P.ui.download(fileName('xlsx'), new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        P.ui.toast('XLSX 파일을 내려받았습니다.', 'ok');
      } catch (e) {
        console.error(e);
        P.ui.toast('내보내기에 실패했습니다: ' + (e.message || e), 'error');
      }
      render();
    }
    function exportCSV() {
      engine.reset();
      P.ui.download(fileName('csv').replace(/\.csv$/, ' - ' + cur().name.replace(/[\\/:*?"<>|]/g, '_') + '.csv'), csvOf(cur(), book.active, engine, dispText), 'text/csv');
      P.ui.toast('현재 시트를 CSV로 내려받았습니다.', 'ok');
    }
    const io = P.files.ioButtons({
      kind: 'sheets', size: 'sm', compact: true,
      attrs: { import: { 'data-act': 'import' }, export: { 'data-act': 'export' } }, menuClass: 'sheets-menu', exportTitle: '이 통합문서',
      importers: [{ id: 'sheet', label: '새 시트로 가져오기', ext: 'XLSX · CSV', accept: '.xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt', run: (f) => importInto(io.importBtn, f) }],
      exporters: [
        { id: 'xlsx', label: '엑셀 파일 XLSX', ext: 'XLSX', desc: '모든 시트, 수식·서식 포함', icon: P.files.icons.sheet, run: () => { if (st.editing) commitEdit(); return exportXLSX(); } },
        { id: 'csv', label: '현재 시트 CSV', ext: 'CSV', desc: '지금 보는 시트 하나, 값만', icon: P.files.icons.text, run: () => { if (st.editing) commitEdit(); exportCSV(); } },
        '-',
        { id: 'print', label: '인쇄 · PDF로 저장', ext: 'PDF', desc: '현재 시트를 인쇄 창으로', icon: P.files.icons.print, run: printSheet }
      ]
    });
    $('.sheets-io').replaceWith(io.el);
    function printSheet() {
      if (st.editing) commitEdit();
      const sh = cur(), si = book.active;
      const ub = usedBounds(sh);
      if (ub.r < 0) { P.ui.toast('인쇄할 내용이 없습니다.'); return; }
      engine.reset();
      const covered = new Set(), at = new Map();
      sh.merges.forEach((m) => { for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) { if (r === m.r1 && c === m.c1) at.set(K(r, c), m); else covered.add(K(r, c)); } });
      const hid = hiddenRows(sh);
      let h = '<h1>' + esc(book.title) + ' · ' + esc(sh.name) + '</h1><table><colgroup>';
      for (let c = 0; c <= ub.c; c++) h += '<col style="width:' + colW(sh, c) + 'px">';
      h += '</colgroup>';
      for (let r = 0; r <= ub.r; r++) {
        if (hid.has(r)) continue;
        h += '<tr style="height:' + rowH(sh, r) + 'px">';
        for (let c = 0; c <= ub.c; c++) {
          const k = K(r, c);
          if (covered.has(k)) continue;
          const m = at.get(k);
          const d = display(si, r, c);
          const s = (sh.cells[k] || {}).s || {};
          let css = 'text-align:' + (s.ha || (d.k === 'num' ? 'right' : 'left')) + ';';
          if (s.b) css += 'font-weight:700;';
          if (s.i) css += 'font-style:italic;';
          if (s.fc) css += 'color:' + s.fc + ';';
          if (s.bg) css += 'background:' + s.bg + ';';
          if (s.fs) css += 'font-size:' + s.fs + 'px;';
          if (s.wrap) css += 'white-space:pre-wrap;';
          if (s.bd) ['t', 'r', 'b', 'l'].forEach((x) => { if (s.bd[x]) css += 'border-' + { t: 'top', r: 'right', b: 'bottom', l: 'left' }[x] + ':' + s.bd[x] + 'px solid #000;'; });
          h += '<td' + (m ? ' rowspan="' + (m.r2 - m.r1 + 1) + '" colspan="' + (m.c2 - m.c1 + 1) + '"' : '') + ' style="' + css + '">' + esc(d.t) + '</td>';
        }
        h += '</tr>';
      }
      h += '</table>';
      const div = document.createElement('div');
      div.className = 'sheets-print';
      div.innerHTML = h;
      document.body.appendChild(div);
      document.body.classList.add('sheets-printing');
      const done = () => { div.remove(); document.body.classList.remove('sheets-printing'); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      setTimeout(() => { window.print(); setTimeout(done, 600); }, 50);
    }
    function toChart() {
      if (st.editing && !commitEdit()) return;
      const tr = tableRange(selRange());
      const g = tr.g;
      const sh = cur(), si = book.active;
      const ub = usedBounds(sh);
      g.r2 = Math.min(g.r2, ub.r); g.c2 = Math.min(g.c2, ub.c);
      if (g.r2 < g.r1 || g.c2 < g.c1 || (g.r2 === g.r1 && g.c2 === g.c1)) { P.ui.toast('차트로 만들 데이터 범위(두 칸 이상)를 선택하세요.', 'warn'); return; }
      const head = tr.head || (g.r2 > g.r1 && (() => { let t = 0, n = 0; for (let c = g.c1; c <= g.c2; c++) { const d = display(si, g.r1, c); if (d.k !== 'empty') { n++; if (d.k === 'text') t++; } } return n > 1 && t === n; })());
      const columns = [];
      for (let c = g.c1; c <= g.c2; c++) columns.push((head && dispText(si, g.r1, c)) || colName(c) + '열');
      const rows = [];
      for (let r = g.r1 + (head ? 1 : 0); r <= g.r2 && rows.length < 5000; r++) {
        if (G.hidden.has(r)) continue;
        const row = [];
        let any = false;
        for (let c = g.c1; c <= g.c2; c++) {
          const d = display(si, r, c);
          const fmt = ((sh.cells[K(r, c)] || {}).s || {}).fmt;
          let v = null;
          if (d.k === 'num') v = isDateFmt(fmt) ? engine.format('yyyy-mm-dd', d.v) : d.v;
          else if (d.k !== 'empty') v = d.t;
          if (v != null) any = true;
          row.push(v);
        }
        if (any) rows.push(row);
      }
      try { sessionStorage.setItem('charts:incoming', JSON.stringify({ columns, rows, title: book.title + (book.sheets.length > 1 ? ' · ' + sh.name : '') })); } catch (e) { P.ui.toast('데이터가 너무 커서 넘기지 못했습니다.', 'error'); return; }
      saveNow();
      ctx.navigate('charts/new');
    }
    function helpDialog() {
      const rows = [['Enter / Tab', '아래 / 오른쪽 셀로 이동(입력 확정)'], ['F2 또는 두 번 클릭', '셀 수정'], ['Alt+Enter', '셀 안에서 줄 바꿈'], ['Esc', '입력 취소'],
        ['Ctrl+Z / Ctrl+Y', '실행 취소 / 다시 실행'], ['Ctrl+C / X / V', '복사 / 잘라내기 / 붙여넣기 (엑셀·한글과 주고받기 가능)'], ['Ctrl+B / I / U', '굵게 / 기울임 / 밑줄'],
        ['Ctrl+D / Ctrl+R', '아래로 / 오른쪽으로 채우기'], ['Ctrl+화살표', '데이터 끝으로 이동'], ['Shift+화살표', '범위 선택'], ['Ctrl+F / Ctrl+H', '찾기 / 바꾸기'],
        ['Ctrl+;', '오늘 날짜 입력'], ['Ctrl+S', '바로 저장'], ['Ctrl+P', '인쇄'], ['Delete', '내용 지우기'],
        ['= 입력 후 셀 클릭', '수식에 셀 주소 넣기'], ['선택 영역 오른쪽 아래 점 끌기', '자동 채우기(1,2,3… / 1월,2월… / 수식 복사)']];
      P.ui.modal({
        title: '단축키', wide: true,
        body: '<table class="sheets-help">' + rows.map(([k, v]) => '<tr><th><kbd>' + esc(k) + '</kbd></th><td>' + esc(v) + '</td></tr>').join('') + '</table>' +
          '<p class="muted">입력을 멈추면 1초 뒤 자동 저장됩니다. 지원 함수: SUM, AVERAGE, IF, IFS, VLOOKUP, XLOOKUP, INDEX/MATCH, COUNTIF(S), SUMIF(S), ROUND, TEXT, DATE, EOMONTH, NETWORKDAYS 등 300여 개.</p>',
        actions: [{ label: '닫기', primary: true }]
      });
    }
    root.querySelector('.sheets-top-actions').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (st.editing && !commitEdit()) return;
      const fn = ({ print: printSheet, chart: toChart, help: helpDialog })[b.dataset.act];
      if (fn) fn();
    });
    $('.sheets-fx').addEventListener('click', fxMenu);

    /* ---------- 시작·정리 ---------- */
    const onBeforeUnload = () => { if (st.dirty) saveNow(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    render();
    if (!matchMedia('(pointer: coarse)').matches) focusGrid();
    else st.touch = true;
    /* 이어하기(js/resume.js): 이어하기로 열면 마지막 시트·셀로 */
    const want = P.resume && P.resume.take('sheets', id);
    if (want && want.sheet >= 0 && want.sheet < book.sheets.length) {
      if (want.sheet !== book.active) { book.active = want.sheet; render(); }
      if (want.r >= 0 && want.c >= 0) select(want.r, want.c);
    }
    st.resumeOn = true;
    return function destroy() {
      st.destroyed = true;
      closeMenus();
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('keydown', onDocKey);
      if (st.dirty) saveNow();
    };
  }

  /* ================= 목록 화면 ================= */
  function fmtWhen(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return '방금 전';
    if (diff < 3600) return Math.floor(diff / 60) + '분 전';
    if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + '일 전';
    return d.toLocaleDateString('ko-KR');
  }
  const TPL_IC = {
    blank: '<path d="M4 4h16v16H4zM4 9h16M4 14h16M9 4v16M14 4v16"/>',
    budget: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
    travel: '<path d="M3 17h18M6 17l2-8h8l2 8M9 9V6h6v3"/>',
    roster: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    assets: '<path d="M4 8l8-4 8 4-8 4zM4 8v8l8 4 8-4V8M12 12v8"/>',
    attendance: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>'
  };
  /* 템플릿 미리보기: 작은 격자 그림. 칸 기호 . 빈칸 H 머리 t 글 n 숫자 b 합계 T 제목(병합) S 강조 o 동그라미 x 가위표 f 색칸 */
  const TPL_PV = {
    blank: { cols: [26, 26, 26, 26, 26], rows: ['.....', '.....', '.....', '.....', '.....', '.....', '.....', '.....'] },
    budget: { cols: [18, 26, 21, 21, 21, 15], rows: ['T.....', 't....p', 'HHHHHH', 'ttnnnn', 'ttnnnn', 'ttnnnS', 'ttnnnn', 'bbbbbb'] },
    travel: { cols: [9, 18, 14, 20, 19, 19, 19], rows: ['HHHHHHH', 'ntttnnn', 'ntttnnn', 'ntttnnn', 'ntttnnn', 'ntttnnn', '.....nb', '.......'] },
    roster: { cols: [22, 11, 11, 11, 11, 11, 11, 11, 11, 11], rows: ['T.........', 'HHHHHHHHHH', 'tff.f.ff.f', 'tf.ff.f.ff', 't.ff.ff.f.', 'tff.ff.f.f', 't.f.ff.ff.', 'tff.f..fff'] },
    assets: { cols: [9, 28, 18, 12, 14, 20, 21], rows: ['HHHHHHH', 'nttnnnn', 'nttnnnn', 'nttnnnn', 'nttnnnn', 'nttnnnn', 'b....bb', '.......'] },
    attendance: { cols: [9, 22, 18, 11, 11, 11, 11, 11, 16], rows: ['T........', 't.t......', 'HHHHHHHHH', 'ntt.oooon', 'ntt.ooxon', 'ntt.ooooon', 'ntt.oxoon', 'ntt.ooooon'] }
  };
  function tplPreview(id) {
    const spec = TPL_PV[id] || TPL_PV.blank;
    const hw = 8, hh = 7, rh = 8.6;
    const W = hw + spec.cols.reduce((a, b) => a + b, 0), H = hh + rh * spec.rows.length;
    const xs = [hw];
    spec.cols.forEach((w) => xs.push(xs[xs.length - 1] + w));
    const o = [];
    o.push('<rect class="pv-hd" x="0" y="0" width="' + W + '" height="' + hh + '"/><rect class="pv-hd" x="0" y="0" width="' + hw + '" height="' + H + '"/>');
    spec.rows.forEach((row, r) => {
      const y = hh + r * rh;
      if (row[0] === 'T') { o.push('<rect class="pv-ttl" x="' + (xs[0] + 4) + '" y="' + (y + 2.6) + '" width="' + Math.min(64, (W - hw) * 0.55) + '" height="3.4" rx=".6"/>'); return; }
      spec.cols.forEach((w, c) => {
        const k = row[c] || '.', x = xs[c], cy = y + rh / 2;
        if (k === 'H') { o.push('<rect class="pv-h" x="' + x + '" y="' + y + '" width="' + w + '" height="' + rh + '"/><rect class="pv-hb" x="' + (x + w / 2 - Math.min(7, w * 0.3)) + '" y="' + (cy - 1.1) + '" width="' + Math.min(14, w * 0.6) + '" height="2.2" rx=".5"/>'); }
        else if (k === 't' || k === 'p') { const bw = Math.min(w - 5, k === 'p' ? 10 : 8 + ((r * 7 + c * 5) % 9)); o.push('<rect class="pv-t" x="' + (x + 2.5) + '" y="' + (cy - 1) + '" width="' + bw + '" height="2" rx=".5"/>'); }
        else if (k === 'n' || k === 'b') { const bw = Math.min(w - 5, 7 + ((r * 5 + c * 3) % 8)); o.push('<rect class="' + (k === 'b' ? 'pv-b' : 'pv-n') + '" x="' + (x + w - 2.5 - bw) + '" y="' + (cy - 1) + '" width="' + bw + '" height="' + (k === 'b' ? 2.4 : 2) + '" rx=".5"/>'); }
        else if (k === 'S') { o.push('<rect class="pv-s" x="' + (x + 2.5) + '" y="' + (cy - 1.1) + '" width="' + (w - 5) + '" height="2.2" rx=".5"/>'); }
        else if (k === 'f') { o.push('<rect class="pv-f" x="' + (x + 1) + '" y="' + (y + 1) + '" width="' + (w - 2) + '" height="' + (rh - 2) + '"/>'); }
        else if (k === 'o') { o.push('<circle class="pv-o" cx="' + (x + w / 2) + '" cy="' + cy + '" r="1.9"/>'); }
        else if (k === 'x') { o.push('<path class="pv-x" d="M' + (x + w / 2 - 1.8) + ' ' + (cy - 1.8) + 'l3.6 3.6M' + (x + w / 2 + 1.8) + ' ' + (cy - 1.8) + 'l-3.6 3.6"/>'); }
      });
      if (row[0] === 'b') o.push('<path class="pv-sum" d="M' + hw + ' ' + y + 'H' + W + '"/>');
    });
    let g = '';
    xs.forEach((x) => { g += 'M' + x + ' 0V' + H; });
    for (let r = 0; r <= spec.rows.length; r++) { const y = hh + r * rh; g += 'M0 ' + y + 'H' + W; }
    o.unshift('<path class="pv-g" d="' + g + '"/>');
    if (id === 'blank') o.push('<rect class="pv-sel" x="' + xs[0] + '" y="' + hh + '" width="' + spec.cols[0] + '" height="' + rh + '"/><rect class="pv-fh" x="' + (xs[1] - 1.6) + '" y="' + (hh + rh - 1.6) + '" width="3.2" height="3.2"/>');
    return '<svg class="sheets-pv" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMinYMin slice" aria-hidden="true">' + o.join('') + '</svg>';
  }
  /* 목록에서 내보내기: 편집기 없이 계산해 파일로 */
  function plainDisplay(book, engine) {
    const gen = (v) => { if (Number.isInteger(v)) return String(v); return String(+v.toPrecision(11)); };
    return (si, r, c) => {
      const cell = book.sheets[si].cells[K(r, c)];
      if (!cell) return '';
      const v = cell.f != null ? engine.value(si, r, c) : cell.v;
      if (v == null || v === '') return '';
      if (engine.isErr(v)) return engine.errText(v);
      if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
      if (typeof v === 'number') { const fmt = cell.s && cell.s.fmt; return fmt && fmt !== 'General' && fmt !== '@' ? engine.format(fmt, v) : gen(v); }
      return String(v);
    };
  }
  const bookName = (b) => (b.title || '통합문서').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
  async function bookFiles(row, fmt) {
    await P.loadScript(LIB.formula);
    const b = fixBook(JSON.parse(JSON.stringify(row.data)));
    const engine = makeEngine(b);
    if (fmt === 'xlsx') {
      await P.loadScript(LIB.xlsx);
      return { name: bookName(b) + '.xlsx', blob: new Blob([bookToXLSX(b, engine)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) };
    }
    engine.reset();
    const si = Math.min(b.active || 0, b.sheets.length - 1);
    return { name: bookName(b) + ' - ' + b.sheets[si].name.replace(/[\\/:*?"<>|]/g, '_') + '.csv', data: csvOf(b.sheets[si], si, engine, plainDisplay(b, engine)), mime: 'text/csv' };
  }
  const SHEET_ACCEPT = '.xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt';
  function miniGrid(d) {
    const sh = Array.isArray(d.sheets) && d.sheets[0];
    const cells = (sh && sh.cells) || {};
    let h = '<span class="sheets-mini" aria-hidden="true"><table>';
    for (let r = 0; r < 7; r++) {
      h += '<tr>';
      for (let c = 0; c < 4; c++) { const x = cells[r + ',' + c]; const v = x ? (x.f != null ? 'ƒ' : x.v) : ''; h += '<td>' + esc(String(v == null ? '' : v).slice(0, 10)) + '</td>'; }
      h += '</tr>';
    }
    return h + '</table></span>';
  }
  async function mountList(root, ctx) {
    const folder = ctx.params[0] === 'f' ? ctx.params[1] || null : null;
    const tile = (id, title, desc) => '<button type="button" class="sheets-tpl" data-tpl="' + id + '"' + (desc ? ' title="' + esc(desc) + '"' : '') + '><span class="sheets-tpl-pv">' + tplPreview(id) + '</span><b>' + esc(title) + '</b></button>';
    async function create(book, f) {
      const id = P.store.uid();
      book.folder = f || null;
      if (!book.createdAt) book.createdAt = new Date().toISOString();
      try {
        await P.store.put(COL, id, book);
        ctx.navigate('sheets/' + id);
      } catch (e) { /* core가 알림 */ }
    }
    async function importFile(file, f) {
      const res = await readFileAsSheets(file);
      const b = newBook(res.title);
      const used = new Set();
      res.sheets.forEach((sh) => { sh.name = safeSheetName(sh.name, used); });
      b.sheets = res.sheets;
      await create(b, f);
    }
    const fb = P.files.browser(root, {
      col: COL, kind: 'sheets', folder,
      title: '엑셀', itemName: '통합문서', newLabel: '새 통합문서', mineLabel: '내 통합문서', searchHint: '이름으로 찾기',
      pageClass: 'sheets-list', openClass: 'sheets-file-main', itemClass: 'sheets-file', newAttrs: { 'data-act': 'new' },
      templates: { title: '새로 만들기', cls: 'sheets-sec', html: '<div class="sheets-tpls">' + tile('blank', '빈 통합문서', '') + TEMPLATES.map((t) => tile(t.id, t.title, t.desc)).join('') + '</div>' },
      onTemplate: (id, f) => (id === 'blank' ? create(newBook('새 통합문서'), f) : create(bookFromTemplate(TEMPLATES.find((x) => x.id === id)), f)),
      newItem: (f) => create(newBook('새 통합문서'), f),
      icon: () => '<span class="sheets-file-ic">' + I0(TPL_IC.blank) + '</span>',
      badge: (it) => '<span class="badge">시트 ' + (Array.isArray(it.data.sheets) ? it.data.sheets.length : 0) + '개</span>',
      meta: (it) => (Array.isArray(it.data.sheets) ? it.data.sheets.map((x) => x && x.name).filter(Boolean).slice(0, 4).join(' · ') : ''),
      thumb: (it) => miniGrid(it.data),
      empty: { slot: 'empty-sheets', title: '아직 통합문서가 없습니다', desc: '위 템플릿을 고르거나, 가지고 있는 XLSX·CSV 파일을 열어 이어서 작업하세요.' },
      io: {
        attrs: { import: { 'data-act': 'import' } },
        importers: [{ id: 'sheet', label: '표 파일', ext: 'XLSX · CSV', accept: SHEET_ACCEPT, multiple: true, run: async (files, c) => { for (const f of files) await importFile(f, c.folder); } }],
        exporters: [
          { id: 'xlsx', label: '엑셀 파일', ext: 'XLSX', desc: '모든 시트, 수식·서식 포함', icon: P.files.icons.sheet, file: (r) => bookFiles(r, 'xlsx') },
          { id: 'csv', label: '쉼표로 나눈 값', ext: 'CSV', desc: '마지막으로 본 시트 하나, 값만', icon: P.files.icons.text, file: (r) => bookFiles(r, 'csv') }
        ]
      }
    });
    return () => { closeMenus(); fb.destroy(); };
  }
  const IC_PRINT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M7 14h10v7H7z"/></svg>';
  const IC_KEYS = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.5 10h1M10.5 10h1M14.5 10h1M8 14h8"/></svg>';
  function I0(d) { return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; }

  /* ================= 등록 ================= */
  async function mountEditor(root, ctx, id) {
    root.innerHTML = '<div class="sheets-loading"><span class="sheets-spin" aria-hidden="true"></span>통합문서를 여는 중…</div>';
    try {
      await P.loadScript(LIB.formula);
    } catch (e) {
      root.innerHTML = '<div class="page"><div class="empty card"><h2>계산 엔진을 불러오지 못했습니다</h2><p class="muted">vendor/formula 파일이 있는지 확인하세요.</p><a class="btn btn-primary" href="#/sheets">목록으로</a></div></div>';
      return null;
    }
    let data = null;
    try { data = await P.store.get(COL, id); } catch (e) { data = null; }
    if (!data) {
      root.innerHTML = '<div class="page"><div class="empty card"><h2>통합문서를 찾을 수 없습니다</h2><p class="muted">삭제되었거나 다른 저장 위치에 있을 수 있습니다.</p><a class="btn btn-primary" href="#/sheets">목록으로</a></div></div>';
      return null;
    }
    root.classList.add('sheets-full');
    return createEditor(root, fixBook(data), id, ctx);
  }

  /* 홈 한 줄 명령이 같은 형식으로 새 통합문서를 만들 때 쓰는 도구 */
  window.SheetsKit = { newData(title) { const b = newBook(title ? String(title).slice(0, 120) : '새 통합문서'); b.createdAt = new Date().toISOString(); b.folder = null; return b; } };

  P.registerApp({
    id: 'sheets',
    title: '엑셀',
    short: '엑셀',
    order: 5,
    desc: '수식·서식·필터를 쓰는 표 계산, XLSX 주고받기',
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>',
    mount(el, ctx) {
      const id = ctx.params[0];
      return id && id !== 'f' ? mountEditor(el, ctx, id) : mountList(el, ctx);
    }
  });

})();
