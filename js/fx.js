/* 공마일 효과(3D · 카드 · 장면) — css/fx.css 와 짝. 앱 코드는 건드리지 않고, 화면이 바뀔 때마다 정해진 선택자에 효과를 붙임.
   P.fx.level() / P.fx.setLevel('rich' | 'basic' | 'off') / P.fx.refresh()
   그림 자리: <div class="fx-img-slot" data-slot="이름"> 은 data/images.json 의 slots 목록에 이름이 있으면 assets/img/<이름>.webp 를 넣고,
   없으면 CSS·SVG 대체 그림을 그림(없는 파일을 요청하지 않으므로 콘솔 오류 없음). */
(function () {
  'use strict';
  if (!window.P) return;
  const root = document.documentElement;
  const LEVELS = ['rich', 'basic', 'off'];
  const mm = (q) => (window.matchMedia ? matchMedia(q) : { matches: false, addEventListener: null });
  const mqReduce = mm('(prefers-reduced-motion: reduce)');
  const mqFine = mm('(hover: hover) and (pointer: fine)');

  /* ---------- 단계 ---------- */
  function defaultLevel() {
    const hc = navigator.hardwareConcurrency || 8;
    const mem = navigator.deviceMemory || 8;
    return hc <= 4 || mem <= 2 ? 'basic' : 'rich';
  }
  function level() {
    const v = P.settings.get('fx.level', null);
    return LEVELS.includes(v) ? v : defaultLevel();
  }
  let lvl = level();
  const reduce = () => mqReduce.matches;
  const fine = () => mqFine.matches;
  const tiltOK = () => lvl === 'rich' && fine() && !reduce();
  const motionOK = () => lvl !== 'off' && !reduce();
  function applyAttrs() {
    root.setAttribute('data-fx-level', lvl);
    root.setAttribute('data-fx-pointer', fine() ? 'fine' : 'coarse');
  }
  function setLevel(v) {
    if (!LEVELS.includes(v)) return;
    P.settings.set('fx.level', v);
    lvl = v;
    applyAttrs();
    if (!tiltOK() && cur) leave(cur);
    resetScenes();
  }
  applyAttrs();
  [mqReduce, mqFine].forEach((mq) => { if (mq.addEventListener) mq.addEventListener('change', applyAttrs); });

  /* ---------- 대상 목록 ----------
     [마우스를 받는 곳, 움직일 곳(없으면 같은 곳), 옵션] · 표·입력칸·편집 중인 화면은 넣지 않음 */
  const CARDS = [
    // 공통 폴더 목록(js/files.js) 격자 칸: 문서는 종이, 나머지는 미리보기 칸
    ['.docs-list .p-fb-items[data-mode="grid"] .p-fb-tile:not(.p-fb-folder) > .p-fb-open', '.docs-a4', { thumb: 1, paper: 1 }],
    ['.p-fb-items[data-mode="grid"] .p-fb-tile > .p-fb-open', '.p-fb-thumb', { thumb: 1 }],
    ['.charts-tpl', '.charts-tpl-thumb', { thumb: 1 }],
    ['.docs-tpl', '.docs-tpl-thumb', { thumb: 1, paper: 1 }],
    ['.docs-cards[data-mode="grid"] .docs-tile .docs-card-main', '.docs-a4', { thumb: 1, paper: 1 }],
    ['.slides-tpl', '.slides-mini', { thumb: 1 }],
    ['.slides-card-open', '.slides-mini', { thumb: 1 }],
    ['.sheets-tpl', null, { paper: 1 }],
    ['.charts-grid > .charts-card', null, {}],
    ['.charts-saved-card', null, {}],
    ['.rf-items.is-grid > .rf-row', null, {}],
    ['.sch-glance-card', null, {}],
    ['.p-set-kind', null, {}],
    ['.empty-art .fx-img-slot', null, { thumb: 1 }]
  ];
  /* 차례 등장 묶음 (같은 부모 안에서 40ms 간격, 최대 12개) */
  const STAGGER = [
    ['.hm-rail > .hm-card', 1], ['.hm-paper > .hm-sec', 0],
    ['.p-fb-items > .p-fb-row, .p-fb-items > .p-fb-tile', 0], ['.charts-tpls > .charts-tpl', 1],
    ['.docs-tpl-row > .docs-tpl', 1], ['.docs-cards > *', 0],
    ['.slides-tpls > .slides-tpl', 1], ['.slides-cards > *', 0],
    ['.sheets-tpls > .sheets-tpl', 1], ['.sheets-ftable tbody > tr', 0],
    ['.charts-grid > *', 1], ['.charts-saved > *', 0],
    ['.rf-items > .rf-row', 0], ['.ap-group', 0], ['.cl-ver', 0],
    ['.sch-glance > *', 1], ['.page > .empty', 0]
  ];
  /* 스크롤 등장 (처음 보일 때 한 번) */
  const REVEAL = ['.rf-sec', '.ap-group', '.cl-ver', '.charts-saved-wrap', '.charts-saved'];
  /* 편집기 열기 장면 */
  const RISE = ['.docs-scaler', '.slides-frame'];

  /* ---------- 카드 ---------- */
  function setupCard(host, tgtSel, opt) {
    host.__fx = 1;
    const target = (tgtSel && host.querySelector(tgtSel)) || host;
    host.__fxT = target;
    host.classList.add('fx-host');
    target.classList.add('fx-card');
    if (opt.thumb) target.classList.add('fx-thumb');
    if (opt.paper) target.classList.add('fx-paper');
    if (!target.querySelector(':scope > .fx-sheen')) {
      if (getComputedStyle(target).position === 'static') target.style.position = 'relative';
      const s = document.createElement('span');
      s.className = 'fx-sheen';
      s.setAttribute('aria-hidden', 'true');
      target.appendChild(s);
    }
  }

  let cur = null; // { host, target, rect, max }
  let lastEv = null;
  let raf = 0;
  function enter(host) {
    const t = host.__fxT;
    if (!t || !t.isConnected) return null;
    clearTimeout(t.__fxSettle);
    t.classList.remove('fx-settle');
    t.classList.add('fx-on');
    const r = host.getBoundingClientRect();
    const max = Math.min(6, Math.max(1.2, 900 / Math.max(r.width, r.height, 1)));
    return { host, target: t, rect: r, max };
  }
  function leave(c) {
    const t = c.target;
    t.classList.remove('fx-on', 'fx-press');
    ['--fx-rx', '--fx-ry', '--fx-sx', '--fx-sy'].forEach((k) => t.style.removeProperty(k));
    t.classList.add('fx-settle');
    clearTimeout(t.__fxSettle);
    t.__fxSettle = setTimeout(() => t.classList.remove('fx-settle'), 560);
    if (cur === c) cur = null;
  }
  function move(c, e) {
    const r = c.rect;
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    const t = c.target.style;
    t.setProperty('--fx-rx', ((0.5 - py) * 2 * c.max).toFixed(2) + 'deg');
    t.setProperty('--fx-ry', ((px - 0.5) * 2 * c.max).toFixed(2) + 'deg');
    t.setProperty('--fx-gx', (px * 100).toFixed(1) + '%');
    t.setProperty('--fx-gy', (py * 100).toFixed(1) + '%');
    t.setProperty('--fx-sx', ((0.5 - px) * 12).toFixed(1));
    t.setProperty('--fx-sy', ((0.5 - py) * 8).toFixed(1));
  }
  const NO_TILT = '.fx-dock-on, .fx-mq';
  const EDIT = 'input, textarea, select, [contenteditable="true"], .docs-body, .slides-stage, .sheets-grid';
  function frame() {
    raf = 0;
    const e = lastEv;
    if (!e) return;
    const tgt = e.target && e.target.closest ? e.target : null;
    // 독(확대 중)과 흐르는 띠 위에서는 카드 기울기를 쓰지 않음
    const host = lvl !== 'off' && tgt && !tgt.closest(EDIT) && !tgt.closest(NO_TILT) ? tgt.closest('.fx-host') : null;
    if (host !== (cur && cur.host)) {
      if (cur) leave(cur);
      cur = host ? enter(host) : null;
    }
    // 테두리 빛이 도는 카드는 올림만, 기울기 없음(빛 고리가 비틀려 보이지 않게)
    if (cur && tiltOK() && !cur.host.classList.contains('fx-beam')) move(cur, e);
    // 장면 시차
    const sc = tgt && tgt.closest('.fx-scene');
    if (sc !== curScene) { if (curScene) sceneLeave(curScene); curScene = sc; }
    if (sc && tiltOK()) sceneMove(sc, e);
  }
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    lastEv = e;
    if (!raf) raf = requestAnimationFrame(frame);
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    if (e.relatedTarget) return; // 창 밖으로 나갈 때만
    if (cur) leave(cur);
    if (curScene) { sceneLeave(curScene); curScene = null; }
  }, { passive: true });
  window.addEventListener('blur', () => { if (cur) leave(cur); });
  /* 누름 깊이: 마우스·터치 모두 */
  let pressed = null;
  document.addEventListener('pointerdown', (e) => {
    if (lvl === 'off' || e.button > 0 || !e.target.closest) return;
    if (e.target.closest(EDIT)) return;
    const host = e.target.closest('.fx-host');
    if (!host || !host.__fxT) return;
    pressed = host.__fxT;
    pressed.classList.add('fx-press');
  }, { passive: true });
  const unpress = () => {
    if (!pressed) return;
    const p = pressed;
    pressed = null;
    p.classList.remove('fx-press');
    if (!p.classList.contains('fx-on')) {
      p.classList.add('fx-settle');
      clearTimeout(p.__fxSettle);
      p.__fxSettle = setTimeout(() => p.classList.remove('fx-settle'), 400);
    }
  };
  ['pointerup', 'pointercancel', 'dragstart'].forEach((t) => document.addEventListener(t, unpress, { passive: true }));
  document.addEventListener('scroll', () => { if (cur) cur.rect = cur.host.getBoundingClientRect(); }, { passive: true, capture: true });

  /* ---------- 장면: 마우스 · 스크롤 시차 ---------- */
  let curScene = null;
  function sceneMove(sc, e) {
    const r = sc.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    sc.style.setProperty('--fx-px', Math.max(-1, Math.min(1, x)).toFixed(3));
    sc.style.setProperty('--fx-py', Math.max(-1, Math.min(1, y)).toFixed(3));
  }
  function sceneLeave(sc) { sc.style.setProperty('--fx-px', '0'); sc.style.setProperty('--fx-py', '0'); }
  function resetScenes() { document.querySelectorAll('.fx-scene').forEach((s) => { sceneLeave(s); s.style.setProperty('--fx-scroll', '0'); }); }
  let sraf = 0;
  function onViewScroll() {
    if (sraf || lvl !== 'rich' || reduce()) return;
    sraf = requestAnimationFrame(() => {
      sraf = 0;
      const v = document.getElementById('view');
      if (!v) return;
      const y = Math.min(400, v.scrollTop);
      v.querySelectorAll('.fx-scene').forEach((s) => s.style.setProperty('--fx-scroll', y.toFixed(0)));
    });
  }

  /* ---------- 그림 자리 ---------- */
  let slotSet = null;
  const slotReady = fetch('data/images.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    .then((j) => { slotSet = new Set(j && Array.isArray(j.slots) ? j.slots.map(String) : []); });

  const L = (cls, d, r, i, style, inner) => '<div class="fx-layer ' + cls + '" style="--d:' + d + ';--r:' + r + 'deg;--i:' + i + ';' + (style || '') + '">' + (inner || '') + '</div>';
  const lines = (spec) => spec.split(' ').map((c) => '<i' + (c === '-' ? '' : ' class="' + c.replace(/\./g, ' ') + '"') + '></i>').join('');
  const STAMP = '<b>결재</b>';
  const SEAL_TXT = () => { try { return P.esc((P.brand().logo || '0').slice(0, 2)); } catch (e) { return '0'; } };
  /* 넓은 장면 (홈 · 머리 띠): 책상 + 종이 몇 장 + 도장 */
  function wideScene(kind) {
    const seal = SEAL_TXT();
    if (kind === 'home-hero') {
      return L('fx-desk', 0.12, 0, 0) +
        L('fx-sheet', 0.35, -7, 1, 'left:14%;top:16%;width:30%;aspect-ratio:210/297', lines('t - m - in - s - - m')) +
        L('fx-sheet grid', 0.55, 4, 2, 'left:40%;top:30%;width:34%;aspect-ratio:4/3') +
        L('fx-sheet slide', 0.75, -3, 3, 'left:56%;top:8%;width:36%;aspect-ratio:16/9', lines('bar t s')) +
        L('fx-stamp', 0.6, -10, 4, 'left:21%;top:56%;width:13%;font-size:clamp(11px,1.5vw,18px)', STAMP) +
        L('fx-seal', 1, 12, 5, 'left:74%;top:56%;width:13%;font-size:clamp(14px,2vw,24px)', seal);
    }
    if (kind === 'changelog-header') {
      return L('fx-desk', 0.12, 0, 0) +
        L('fx-sheet', 0.3, -6, 1, 'right:30%;top:22%;width:18%;aspect-ratio:210/297', lines('t - m - s - m')) +
        L('fx-sheet', 0.5, 3, 2, 'right:17%;top:14%;width:18%;aspect-ratio:210/297', lines('t - in - m s - -')) +
        L('fx-sheet', 0.7, 9, 3, 'right:4%;top:28%;width:18%;aspect-ratio:210/297', lines('t m - - in s')) +
        L('fx-seal', 1, -8, 4, 'right:27%;top:52%;width:9%;font-size:clamp(12px,1.6vw,20px)', esc(P.version.split('.').slice(0, 2).join('.')));
    }
    // refs-header: 색인 카드 · 책갈피
    return L('fx-desk', 0.12, 0, 0) +
      L('fx-sheet', 0.3, -4, 1, 'right:31%;top:20%;width:26%;aspect-ratio:5/3', lines('t - m s')) +
      L('fx-sheet', 0.55, 5, 2, 'right:12%;top:30%;width:26%;aspect-ratio:5/3', lines('hd - m - s')) +
      L('fx-sheet slide', 0.8, -3, 3, 'right:4%;top:14%;width:15%;aspect-ratio:16/9', lines('bar t s')) +
      L('fx-stamp', 0.9, 8, 4, 'right:40%;top:50%;width:8%;font-size:clamp(9px,1.1vw,14px)', STAMP);
  }
  /* 작은 정물 (빈 화면) */
  function smallArt(kind) {
    const s = (cls, d, r, i, st, inner) => L(cls, d, r, i, st, inner);
    if (kind === 'empty-slides') {
      return s('fx-sheet slide', .4, -6, 0, 'left:6%;top:18%;width:62%;aspect-ratio:16/9;opacity:.55', lines('bar t')) +
        s('fx-sheet slide', .7, 3, 1, 'left:28%;top:34%;width:64%;aspect-ratio:16/9', lines('bar t s')) +
        s('fx-seal', 1, 10, 2, 'left:12%;top:58%;width:22%;font-size:13px', SEAL_TXT());
    }
    if (kind === 'empty-sheets') {
      return s('fx-sheet grid', .4, -5, 0, 'left:8%;top:10%;width:62%;aspect-ratio:4/3') +
        s('fx-sheet', .7, 4, 1, 'left:40%;top:26%;width:46%;aspect-ratio:4/3;padding:7px', lines('hd - - m')) +
        s('fx-stamp', 1, -8, 2, 'left:14%;top:56%;width:22%;font-size:9px', STAMP);
    }
    if (kind === 'empty-charts') {
      return s('fx-sheet', .5, -4, 0, 'left:10%;top:8%;width:70%;aspect-ratio:4/3;padding:9px 9px 7px;justify-content:flex-end;flex-direction:row;align-items:flex-end;gap:8%', '<i style="width:14%;height:30%;background:var(--fx-ink-b)"></i><i style="width:14%;height:62%;background:var(--accent)"></i><i style="width:14%;height:44%;background:var(--fx-ink-b)"></i><i style="width:14%;height:80%;background:var(--fx-ink-b)"></i>') +
        s('fx-seal', 1, 12, 1, 'left:66%;top:56%;width:22%;font-size:13px', SEAL_TXT());
    }
    if (kind === 'empty-schedule') {
      return s('fx-sheet', .4, -5, 0, 'left:10%;top:6%;width:56%;aspect-ratio:1;padding:0;background:repeating-linear-gradient(90deg,transparent 0 calc(14.28% - 1px),var(--fx-ink-a) calc(14.28% - 1px) 14.28%),repeating-linear-gradient(0deg,transparent 0 calc(20% - 1px),var(--fx-ink-a) calc(20% - 1px) 20%),var(--fx-paper)') +
        s('fx-sheet', .7, 5, 1, 'left:46%;top:24%;width:40%;aspect-ratio:210/297', lines('t - m - s')) +
        s('fx-stamp', 1, -6, 2, 'left:26%;top:44%;width:20%;font-size:9px', STAMP);
    }
    // 문서(기본)
    return s('fx-sheet', .4, -7, 0, 'left:14%;top:4%;width:44%;aspect-ratio:210/297;opacity:.7', lines('t - m - s')) +
      s('fx-sheet', .7, 4, 1, 'left:40%;top:10%;width:44%;aspect-ratio:210/297', lines('t - m in - s - m')) +
      s('fx-seal', 1, -10, 2, 'left:18%;top:60%;width:22%;font-size:13px', SEAL_TXT());
  }
  const esc = (s) => P.esc(s);
  function fillSlot(slot) {
    slot.dataset.fxReady = '1';
    const name = slot.dataset.slot || '';
    const wide = /-hero$|-header$/.test(name);
    if (!slot.querySelector(':scope > .fx-ph')) {
      const ph = document.createElement('div');
      ph.className = 'fx-ph' + (wide ? ' fx-stage' : ' fx-art');
      ph.setAttribute('aria-hidden', 'true');
      ph.innerHTML = wide ? wideScene(name) : smallArt(name);
      slot.appendChild(ph);
      if (motionOK()) {
        const sc = wide ? slot.closest('.fx-scene') : ph;
        if (sc) { sc.classList.add('fx-enter'); setTimeout(() => sc.classList.remove('fx-enter'), 1500); }
      }
    }
    slotReady.then(() => {
      if (!slotSet.has(name) || slot.querySelector(':scope > img')) return;
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.className = 'fx-img' + (wide ? ' fx-layer' : '');
      if (wide) img.style.cssText = '--d:.35;--r:0deg';
      img.onload = () => slot.classList.add('has-img');
      img.src = 'assets/img/' + encodeURIComponent(name) + '.webp';
      slot.insertBefore(img, slot.firstChild);
    });
  }

  /* ---------- 등장 · 스크롤 · 편집기 장면 ---------- */
  let routeAt = performance.now();
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('fx-shown');
      io.unobserve(en.target);
      setTimeout(() => { en.target.classList.remove('fx-reveal', 'fx-shown'); en.target.style.removeProperty('--fx-d'); }, 900);
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 }) : null;

  function animateOnce(node, cls, ms) {
    node.classList.add(cls);
    const done = () => { node.classList.remove(cls, 'fx-in-3d'); node.style.removeProperty('--fx-d'); };
    node.addEventListener('animationend', function h(e) { if (e.target === node) { node.removeEventListener('animationend', h); done(); } });
    setTimeout(done, ms);
  }

  function scan() {
    const view = document.getElementById('view');
    if (!view) return;
    // 카드
    CARDS.forEach(([sel, tgt, opt]) => {
      document.querySelectorAll(sel).forEach((h) => { if (!h.__fx) setupCard(h, tgt, opt); });
    });
    // 그림 자리
    document.querySelectorAll('.fx-img-slot:not([data-fx-ready])').forEach(fillSlot);
    const fresh = performance.now() - routeAt < 1100;
    const vr = view.getBoundingClientRect();
    const bottom = Math.min(window.innerHeight, vr.bottom);
    // 스크롤 등장: 화면 아래에 있는 것만
    if (io && motionOK()) {
      REVEAL.forEach((sel) => view.querySelectorAll(sel).forEach((n) => {
        if (n.__fxR) return;
        n.__fxR = 1;
        if (n.getBoundingClientRect().top > bottom + 8) { n.__fxSeen = 1; n.classList.add('fx-reveal'); io.observe(n); }
      }));
    }
    // 차례 등장
    if (fresh && motionOK()) {
      STAGGER.forEach(([sel, deep]) => {
        const groups = new Map();
        view.querySelectorAll(sel).forEach((n) => {
          if (n.__fxSeen) return;
          n.__fxSeen = 1;
          if (n.getBoundingClientRect().top > bottom) return;
          const g = groups.get(n.parentNode) || [];
          g.push(n);
          groups.set(n.parentNode, g);
        });
        groups.forEach((g) => g.slice(0, 12).forEach((n, i) => {
          n.style.setProperty('--fx-d', (i * 40) + 'ms');
          if (deep) n.classList.add('fx-in-3d');
          animateOnce(n, 'fx-in', 520 + i * 40 + 200);
        }));
      });
      RISE.forEach((sel) => view.querySelectorAll(sel).forEach((n) => {
        if (n.__fxRise) return;
        n.__fxRise = 1;
        animateOnce(n, 'fx-rise3d', 900);
      }));
    } else {
      STAGGER.forEach(([sel]) => view.querySelectorAll(sel).forEach((n) => { n.__fxSeen = 1; }));
      RISE.forEach((sel) => view.querySelectorAll(sel).forEach((n) => { n.__fxRise = 1; }));
    }
    scanInfo();
  }

  let scanT = 0, lastScan = 0;
  function queueScan() {
    if (scanT) return;
    const wait = Math.max(0, 90 - (performance.now() - lastScan));
    scanT = setTimeout(() => { scanT = 0; lastScan = performance.now(); requestAnimationFrame(scan); }, wait);
  }
  function start() {
    const view = document.getElementById('view');
    if (!view) return;
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.target === view) {
          for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList.contains('p-app')) { routeAt = performance.now(); if (cur) leave(cur); }
        }
      }
      queueScan();
    }).observe(view, { childList: true, subtree: true });
    // 설정 창 등 body 에 붙는 대화상자
    new MutationObserver(queueScan).observe(document.body, { childList: true });
    view.addEventListener('scroll', onViewScroll, { passive: true });
    queueScan();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  /* ================= 정보 효과 (1.6.0) =================
     흐르는 띠(marquee) · 테두리 빛(beam) · 반짝 글자(shimmer) · 독(dock) · 글자 섞기(scramble).
     모두 정보가 있는 곳에만: 오늘 흐름, 지금 진행 중, 추천, 기다리는 중, 누를 곳.
     끄기 · 동작 줄이기: 움직임 없음 (띠는 가로 스크롤 줄, 빛은 1px 고리, 반짝은 보통 글자, 독은 확대 없음, 섞기는 바로 최종 글자)
     기본: 띠·빛은 느리게, 독·섞기 없음, 반짝은 그대로 */
  const richOK = () => lvl === 'rich' && !reduce();
  const scrambleOK = () => richOK();
  const dockOK = () => richOK() && fine();

  /* 화면 밖 · 탭 숨김이면 멈춤 (CSS 가 .fx-offscreen · .fx-tab-hidden 을 보고 animation-play-state: paused) */
  const visIO = 'IntersectionObserver' in window ? new IntersectionObserver((ents) => {
    ents.forEach((en) => en.target.classList.toggle('fx-offscreen', !en.isIntersecting));
  }, { rootMargin: '40px' }) : null;
  const watched = new Set();
  function watchVis(n) {
    if (!visIO || !n || watched.has(n)) return;
    watched.add(n);
    visIO.observe(n);
  }
  function pruneVis() {
    watched.forEach((n) => { if (!n.isConnected) { visIO.unobserve(n); watched.delete(n); } });
  }
  const syncHidden = () => root.classList.toggle('fx-tab-hidden', document.visibilityState === 'hidden');
  document.addEventListener('visibilitychange', syncHidden);
  syncHidden();

  /* ---------- 흐르는 띠 ----------
     P.fx.marquee(host, items, { label, speed, onPick })
     items: [{ label, tag, tone, meta, href, title }] · 원본 목록은 읽을 수 있는 목록, 이어 붙인 사본은 aria-hidden + inert */
  const marquees = new Set();
  function mqItem(it, i, pick) {
    const inner = (it.tag ? '<span class="fx-mq-tag' + (it.tone ? ' is-' + esc(it.tone) : '') + '">' + esc(it.tag) + '</span>' : '') +
      '<span class="fx-mq-t">' + esc(it.label) + '</span>' + (it.meta ? '<span class="fx-mq-m num">' + esc(it.meta) + '</span>' : '');
    const t = it.title ? ' title="' + esc(it.title) + '"' : '';
    if (it.href) return '<li><a class="fx-mq-it' + (it.tone ? ' is-' + esc(it.tone) : '') + '" href="' + esc(it.href) + '"' + t + '>' + inner + '</a></li>';
    if (pick) return '<li><button type="button" class="fx-mq-it" data-mq="' + i + '"' + t + '>' + inner + '</button></li>';
    return '<li><span class="fx-mq-it">' + inner + '</span></li>';
  }
  function mqLayout(m) {
    const host = m.host;
    if (!host.isConnected) { marquees.delete(m); if (m.ro) m.ro.disconnect(); return; }
    const view = host.querySelector('.fx-mq-view');
    const list = host.querySelector('.fx-mq-list');
    if (!view || !list) return;
    const fits = list.scrollWidth <= view.clientWidth + 1;
    const run = motionOK() && !fits && !m.manual;
    host.classList.toggle('is-run', run);
    host.classList.toggle('is-static', !run);
    const speed = (m.o.speed || 40) * (lvl === 'basic' ? 0.6 : 1);
    host.style.setProperty('--fx-mq-dur', (list.scrollWidth / speed).toFixed(1) + 's');
  }
  function marquee(host, items, opts) {
    if (!host) return null;
    const o = opts || {};
    const list = Array.isArray(items) ? items.filter((x) => x && x.label) : [];
    let m = host.__fxMq;
    if (!list.length) { host.hidden = true; host.innerHTML = ''; if (m) marquees.delete(m); return null; }
    host.hidden = false;
    host.classList.add('fx-mq');
    const pick = typeof o.onPick === 'function';
    const lis = list.map((it, i) => mqItem(it, i, pick)).join('');
    host.innerHTML = (o.cap ? '<span class="fx-mq-cap" aria-hidden="true">' + esc(o.cap) + '</span>' : '') +
      '<div class="fx-mq-view"><div class="fx-mq-track">' +
      '<ul class="fx-mq-list"' + (o.label ? ' aria-label="' + esc(o.label) + '"' : '') + '>' + lis + '</ul>' +
      '<ul class="fx-mq-list fx-mq-dup" aria-hidden="true" inert>' + lis + '</ul></div></div>';
    if (!m) {
      m = { host, o, manual: false, ro: null };
      host.__fxMq = m;
      // 키보드 초점이 들어오면 흐름을 멈추고 손으로 넘기는 줄로 바꿈(초점 항목이 보이게)
      host.addEventListener('focusin', (e) => {
        if (!m.manual) { m.manual = true; mqLayout(m); }
        const it = e.target.closest('.fx-mq-it');
        if (it) it.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
      host.addEventListener('focusout', (e) => {
        if (e.relatedTarget && host.contains(e.relatedTarget)) return;
        m.manual = false;
        const v = host.querySelector('.fx-mq-view');
        if (v) v.scrollLeft = 0;
        mqLayout(m);
      });
      host.addEventListener('click', (e) => {
        const b = e.target.closest('[data-mq]');
        if (b && typeof m.o.onPick === 'function') m.o.onPick(m.items[Number(b.dataset.mq)], Number(b.dataset.mq));
      });
      if ('ResizeObserver' in window) { m.ro = new ResizeObserver(() => mqLayout(m)); m.ro.observe(host); }
    }
    m.o = o;
    m.items = list;
    marquees.add(m);
    watchVis(host);
    mqLayout(m);
    return m;
  }

  /* ---------- 테두리 빛 ----------
     P.fx.beam(el, on, { tone: 'now' | 'rec' | 'busy' }) · 고리 span 을 넣고 CSS 가 conic-gradient + 마스크로 그림 */
  function beam(el, on, opts) {
    if (!el) return;
    let ring = el.querySelector(':scope > .fx-beam-ring');
    if (!on) {
      if (ring) ring.remove();
      el.classList.remove('fx-beam');
      el.removeAttribute('data-fx-beam');
      return;
    }
    el.classList.add('fx-beam');
    el.setAttribute('data-fx-beam', (opts && opts.tone) || 'now');
    if (opts && opts.manual) el.__fxBeamManual = 1;
    if (!ring) {
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      ring = document.createElement('span');
      ring.className = 'fx-beam-ring';
      ring.setAttribute('aria-hidden', 'true');
      el.appendChild(ring);
    }
    watchVis(el);
  }
  /* 화면에 따라 자동으로 붙이는 곳: [선택자, 색] */
  const BEAMS = [
    ['.hs-tg .hs-blk.now:not(.ov)', 'now'],
    ['.hm-row.is-now:not(.is-stamped) > .hm-body', 'now'],
    ['.charts-grid > .charts-card.is-lead', 'rec']
  ];
  const BEAM_SEL = BEAMS.map((b) => b[0]).join(',');

  /* ---------- 반짝 글자 (기다리는 중에만) ---------- */
  function shimmer(el, on) {
    if (!el) return;
    el.classList.toggle('fx-shimmer', !!on);
    if (on) watchVis(el);
  }
  const WAIT_RE = /(중…|중\.\.\.|중입니다…)/;
  function scanToasts() {
    document.querySelectorAll('#p-toasts .p-toast-info > span:last-child').forEach((s) => shimmer(s, WAIT_RE.test(s.textContent)));
  }
  /* 처리 중 단추(P.ui.busy): 회전 표시 대신 단추 글자를 그대로 보이고 반짝. 글자가 안 보이는 아이콘 단추는 회전 표시 유지 */
  function busyOn(btn) {
    if (!btn.classList || !btn.classList.contains('btn')) return;
    Array.from(btn.childNodes).forEach((n) => {
      if (n.nodeType === 3 && n.nodeValue.trim()) {
        const s = document.createElement('span');
        s.className = 'fx-busy-w';
        n.parentNode.insertBefore(s, n);
        s.appendChild(n);
      }
    });
    const txt = Array.from(btn.children).filter((c) => c.tagName === 'SPAN' && c.textContent.trim() && !c.classList.contains('fx-beam-ring'));
    // 처리 중 단추는 visibility:hidden 이므로 글자 칸이 실제로 자리를 차지하는지로 판단
    const shown = txt.filter((c) => c.getClientRects().length && getComputedStyle(c).display !== 'none');
    if (!shown.length) return;
    btn.classList.add('fx-busy-txt');
    shown.forEach((c) => shimmer(c, true));
  }
  function busyOff(btn) {
    if (!btn.classList || !btn.classList.contains('fx-busy-txt')) return;
    btn.classList.remove('fx-busy-txt');
    btn.querySelectorAll(':scope > .fx-shimmer').forEach((c) => shimmer(c, false));
  }
  new MutationObserver((muts) => {
    muts.forEach((m) => {
      const t = m.target;
      if (t.getAttribute('aria-busy') === 'true') busyOn(t); else busyOff(t);
    });
  }).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['aria-busy'] });

  /* ---------- 글자 섞기 ----------
     P.fx.scramble(el, text, { duration }) → Promise · 숫자는 숫자로, 한글은 자모로, 영문은 A~Z 로 돌다가 왼쪽부터 확정 */
  const GLYPH = { d: '0123456789', l: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', k: 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅓㅗㅜㅡㅣ' };
  const glyphSet = (ch) => (/[0-9]/.test(ch) ? GLYPH.d : /[A-Za-z]/.test(ch) ? GLYPH.l : /[가-힣ㄱ-ㅣ]/.test(ch) ? GLYPH.k : '');
  function scramble(el, text, opts) {
    if (!el) return Promise.resolve();
    const o = opts || {};
    const final = text == null ? (el.__fxScrFinal != null ? el.__fxScrFinal : el.textContent) : String(text);
    if (el.__fxScr) { cancelAnimationFrame(el.__fxScr); el.__fxScr = 0; }
    const chars = Array.from(final);
    const finish = () => {
      el.textContent = final;
      el.__fxScr = 0;
      el.__fxScrFinal = null;
      el.classList.remove('fx-scrambling');
      el.style.removeProperty('min-width');
      if (el.getAttribute('aria-busy') === 'true' && el.__fxScrBusy) el.removeAttribute('aria-busy');
      el.__fxScrBusy = 0;
    };
    if (!scrambleOK() || chars.length > (o.max || 16) || document.visibilityState === 'hidden') { finish(); return Promise.resolve(); }
    const dur = Math.max(120, Math.min(600, o.duration || 500));
    el.__fxScrFinal = final;
    // 글자 폭이 흔들리지 않게 시작 폭을 붙잡음
    const w = el.getBoundingClientRect().width;
    el.classList.add('fx-scrambling');
    if (w) el.style.minWidth = Math.ceil(w) + 'px';
    if (!el.hasAttribute('aria-busy')) { el.setAttribute('aria-busy', 'true'); el.__fxScrBusy = 1; }
    const t0 = performance.now();
    let last = 0;
    return new Promise((res) => {
      const step = (now) => {
        const p = (now - t0) / dur;
        if (p >= 1) { finish(); res(); return; }
        if (now - last > 40) {
          last = now;
          const fixed = Math.floor(p * (chars.length + 1));
          el.textContent = chars.map((c, i) => {
            if (i < fixed) return c;
            const set = glyphSet(c);
            return set ? set[(Math.random() * set.length) | 0] : c;
          }).join('');
        }
        el.__fxScr = requestAnimationFrame(step);
      };
      el.__fxScr = requestAnimationFrame(step);
    });
  }
  /* 하루에 한 번: key 마다 마지막으로 보여 준 날짜를 기억 */
  function scrambleDaily(el, key, day) {
    if (!el) return Promise.resolve();
    const k = 'fx.scr.' + key;
    if (P.settings.get(k, '') === day) return Promise.resolve();
    P.settings.set(k, day);
    return scramble(el, el.textContent);
  }
  /* 로고 글자(0MILE): 마우스를 올리거나 초점이 오면 */
  function bindLogo() {
    document.querySelectorAll('.p-brand').forEach((a) => {
      if (a.__fxLogo) return;
      a.__fxLogo = 1;
      const run = () => { const w = a.querySelector('.p-brand-en'); if (w && !w.__fxScr) scramble(w, w.textContent, { duration: 500 }); };
      a.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') run(); });
      a.addEventListener('focus', run);
    });
  }

  /* ---------- 독 확대 ----------
     P.fx.dock(container, { items, axis: 'x'|'y', part, max, spread, layout, when })
     커서와의 거리로 가우스 확대(최대 1.35배), 가까운 이웃은 덜. transform 만 씀. 정밀 포인터 + 풍부하게 에서만 */
  const docks = new Set();
  function dock(container, opts) {
    if (!container) return null;
    if (container.__fxDock) return container.__fxDock;
    const o = Object.assign({ items: ':scope > *', axis: 'x', max: 1.35, spread: true, part: null, layout: false, when: null, tip: false }, opts || {});
    const d = { el: container, o, ev: null, raf: 0, live: false };
    container.__fxDock = d;
    container.classList.add('fx-dock');
    container.setAttribute('data-fx-axis', o.axis);
    const on = () => dockOK() && (!o.when || o.when());
    const items = () => Array.from(container.querySelectorAll(o.items)).filter((n) => n.offsetWidth || n.offsetHeight);
    const partOf = (n) => (o.part && n.querySelector(o.part)) || n;
    function reset() {
      d.live = false;
      container.querySelectorAll('.fx-dock-mag').forEach((p) => { p.classList.remove('fx-dock-mag'); p.style.removeProperty('transform'); });
    }
    function apply() {
      d.raf = 0;
      const e = d.ev;
      if (!e || !on()) { reset(); return; }
      const its = items();
      if (!its.length) return;
      const op = its[0].offsetParent || container;
      const r = op.getBoundingClientRect();
      const x = o.axis === 'x';
      const pos = x ? e.clientX - r.left + op.scrollLeft : e.clientY - r.top + op.scrollTop;
      const sizes = its.map((n) => (x ? n.offsetWidth : n.offsetHeight));
      const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      const sigma = Math.max(24, avg * 1.15);
      const sc = its.map((n, i) => {
        const c = (x ? n.offsetLeft : n.offsetTop) + sizes[i] / 2;
        const dd = pos - c;
        return 1 + (o.max - 1) * Math.exp(-(dd * dd) / (2 * sigma * sigma));
      });
      // 옆으로 벌리기: 커진 만큼 이웃을 밀어 겹치지 않게(묶음 가운데 기준)
      let total = 0;
      const extra = sc.map((s, i) => { const v = (s - 1) * sizes[i]; total += v; return v; });
      let acc = 0;
      its.forEach((n, i) => {
        const p = partOf(n);
        const sh = o.spread ? acc + extra[i] / 2 - total / 2 : 0;
        acc += extra[i];
        p.classList.add('fx-dock-mag');
        p.style.transform = (sh ? (x ? 'translate3d(' + sh.toFixed(1) + 'px,0,0) ' : 'translate3d(0,' + sh.toFixed(1) + 'px,0) ') : '') + 'scale(' + sc[i].toFixed(3) + ')';
      });
      d.live = true;
    }
    container.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      d.ev = e;
      if (!d.raf) d.raf = requestAnimationFrame(apply);
    }, { passive: true });
    container.addEventListener('pointerleave', () => { d.ev = null; if (d.raf) { cancelAnimationFrame(d.raf); d.raf = 0; } reset(); }, { passive: true });
    d.sync = () => {
      const active = on();
      container.classList.toggle('fx-dock-on', active);
      if (o.tip) items().forEach((n) => { const l = n.textContent.trim(); if (l && !n.dataset.fxTip) n.dataset.fxTip = l; });
      if (!active) reset();
    };
    d.reset = reset;
    docks.add(d);
    d.sync();
    return d;
  }
  /* 자동으로 붙이는 독 */
  const DOCKS = [
    ['.slides-pv-bar', { items: ':scope > *', axis: 'x' }],
    ['#p-side', { items: '.p-tab', axis: 'y', part: '.p-tab-ic', spread: false, when: () => root.getAttribute('data-nav') === 'rail' }]
  ];

  /* ---------- 정보 효과 붙이기 (scan 마다) ---------- */
  function scanInfo() {
    bindLogo();
    DOCKS.forEach(([sel, o]) => document.querySelectorAll(sel).forEach((c) => { const d = dock(c, o); if (d) d.sync(); }));
    docks.forEach((d) => { if (!d.el.isConnected) docks.delete(d); });
    // 테두리 빛: 맞는 곳에 붙이고, 더는 맞지 않는 곳은 뗌
    BEAMS.forEach(([sel, tone]) => document.querySelectorAll(sel).forEach((n) => { if (n.getAttribute('data-fx-beam') !== tone || !n.querySelector(':scope > .fx-beam-ring')) beam(n, true, { tone }); }));
    document.querySelectorAll('.fx-beam').forEach((n) => { if (!n.__fxBeamManual && !n.matches(BEAM_SEL)) beam(n, false); });
    document.querySelectorAll('.p-wait:not(.fx-shimmer)').forEach((n) => shimmer(n, true));
    scanToasts();
    pruneVis();
  }
  const toastsBox = document.getElementById('p-toasts');
  if (toastsBox) new MutationObserver(scanToasts).observe(toastsBox, { childList: true, subtree: true, characterData: true });
  /* 효과 단계 · 포인터 · 동작 줄이기가 바뀌면 다시 맞춤 */
  function resyncInfo() {
    marquees.forEach(mqLayout);
    docks.forEach((d) => d.sync());
  }
  [mqReduce, mqFine].forEach((mq) => { if (mq.addEventListener) mq.addEventListener('change', resyncInfo); });
  new MutationObserver(resyncInfo).observe(root, { attributes: true, attributeFilter: ['data-fx-level', 'data-fx-pointer', 'data-nav'] });

  P.fx = { level: () => lvl, setLevel, refresh: queueScan, defaultLevel, marquee, beam, shimmer, dock, scramble, scrambleDaily };
})();
