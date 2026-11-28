/* 업데이트 기록 = 연혁 (기관 연혁 인쇄면처럼)
   data/changelog.json 을 해·달별로 묶어 세로 연표로. 왼쪽 여백에 큰 해·달 숫자, 줄 왼쪽에 날짜,
   큰 판(x.0.0)은 인주 도장(초판 · 제2판 …), 주요 변경은 굵은 줄, 세부 변경은 접기, 알려진 한계는 각주. (항상 마지막 탭) */
(function () {
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
  const esc = (s) => P.esc(s);
  const tidy = (s) => String(s || '').replace(/\s*—\s*/g, ' · ');
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];

  function cmpVer(a, b) {
    const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pb[i] || 0) - (pa[i] || 0);
      if (d) return d;
    }
    return 0;
  }
  const parts = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? { y: m[1], m: Number(m[2]), d: Number(m[3]), dow: DOW[new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay()] } : null; };
  const isMajor = (v) => /^\d+\.0\.0$/.test(String(v.version || ''));
  const edition = (v) => { const n = parseInt(v.version, 10) || 1; return n === 1 ? '초판' : '제' + n + '판'; };
  function pickSlot(name, legacy) {
    return fetch('data/images.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => {
      const s = j && Array.isArray(j.slots) ? j.slots.map(String) : [];
      return !s.includes(name) && legacy && s.includes(legacy) ? legacy : name;
    });
  }

  function verHtml(v, latest, showDay) {
    const details = Array.isArray(v.details) ? v.details : [];
    const limits = Array.isArray(v.limits) ? v.limits : [];
    const n = details.reduce((s, d) => s + ((d.items || []).length), 0);
    const p = parts(v.date);
    const major = isMajor(v);
    const fid = 'cl-fn-' + String(v.version).replace(/[^0-9a-z]/gi, '-');
    const areas = details.map((d) => '<section class="cl-area"><h4>' + esc(d.area) + '</h4><ul>' + (d.items || []).map((i) => '<li>' + esc(tidy(i)) + '</li>').join('') + '</ul></section>').join('');
    return '<article class="cl-ver' + (latest ? ' latest' : '') + (major ? ' is-major' : '') + '" id="v' + esc(v.version) + '">' +
      '<div class="cl-day" aria-hidden="' + (showDay ? 'false' : 'true') + '">' + (p && showDay ? '<b class="num">' + p.d + '</b><small>' + p.dow + '요일</small>' : '') + '</div>' +
      '<div class="cl-body">' +
      '<span class="cl-node" aria-hidden="true"></span>' +
      '<div class="cl-meta"><span class="cl-v num">v' + esc(v.version) + '</span>' +
      '<time class="num" datetime="' + esc(v.date || '') + '">' + (p ? p.y + '. ' + p.m + '. ' + p.d + '.' : esc(v.date || '')) + '</time>' +
      (latest ? '<span class="badge badge-accent">최신</span>' : '') + (v.version === P.version ? '<span class="badge">사용 중</span>' : '') + '</div>' +
      '<h3 class="cl-title">' + esc(v.title || '업데이트') + (limits.length ? '<sup class="cl-fnref" aria-hidden="true">주</sup>' : '') + '</h3>' +
      (major ? '<span class="cl-seal" role="img" aria-label="' + esc(edition(v)) + ' 큰 판"><b>' + esc(edition(v)) + '</b></span>' : '') +
      (Array.isArray(v.highlights) && v.highlights.length ? '<ul class="cl-hl">' + v.highlights.map((h) => '<li>' + esc(tidy(h)) + '</li>').join('') + '</ul>' : '') +
      (details.length ? '<details class="cl-fold"' + (latest ? ' open' : '') + '><summary>세부 변경 <span class="num">' + n + '</span></summary><div class="cl-details">' + areas + '</div></details>' : '') +
      (limits.length ? '<aside class="cl-limits" id="' + fid + '" aria-label="알려진 한계"><p class="cl-limits-t">주) 알려진 한계</p><ol>' + limits.map((i) => '<li>' + esc(tidy(i)) + '</li>').join('') + '</ol></aside>' : '') +
      '</div></article>';
  }

  /* 대체 그림: 판마다 한 권씩 묶은 연혁 책 + 인주 도장 */
  function heroArt() {
    const L = (cls, d, r, i, st, inner) => '<div class="fx-layer ' + cls + '" style="--d:' + d + ';--r:' + r + 'deg;--i:' + i + ';' + (st || '') + '">' + (inner || '') + '</div>';
    const ver = esc(String(P.version || '').split('.').slice(0, 2).join('.'));
    return '<div class="fx-ph cl-art" aria-hidden="true">' +
      L('fx-desk', 0.12, 0, 0) +
      L('fx-sheet', 0.3, -6, 1, 'right:31%;top:20%;width:17%;aspect-ratio:210/297', '<i class="t"></i><i></i><i class="m"></i><i></i><i class="s"></i>') +
      L('fx-sheet', 0.5, 3, 2, 'right:17%;top:12%;width:17%;aspect-ratio:210/297', '<i class="t"></i><i class="in"></i><i></i><i class="m"></i><i></i>') +
      L('cl-art-rule', 0.6, 0, 3, 'right:6%;top:14%;width:8%;height:74%', '<i></i><i class="on"></i><i></i><i class="on"></i>') +
      L('fx-seal', 1, -8, 4, 'right:25%;top:54%;width:9%;font-size:clamp(12px,1.6vw,20px)', ver) +
      '</div>';
  }

  function mount(el) {
    let alive = true;
    el.innerHTML = '<div class="page cl-page">' +
      '<div class="page-head"><div><h1>업데이트 기록</h1></div><span class="cl-cur num">지금 v' + esc(P.version) + '</span></div>' +
      '<div class="cl-hero fx-scene">' +
      '<div class="cl-hero-slot" aria-hidden="true">' + heroArt() + '</div>' +
      '<div class="cl-hero-cap"><span class="cl-hero-k">연혁</span><b>공마일이 걸어온 길</b><span class="cl-hero-s">판마다 바뀐 점을 날짜 순으로 적었습니다.</span><span class="cl-hero-n num"></span></div>' +
      '</div>' +
      '<div class="cl-list">' + P.ui.skeleton(4) + '</div></div>';
    const body = el.querySelector('.cl-list');
    const heroN = el.querySelector('.cl-hero-n');
    pickSlot('tab-changelog', 'changelog-header').then((name) => {
      const s = el.querySelector('.cl-hero-slot');
      if (!alive || !s) return;
      s.dataset.slot = name;
      s.classList.add('fx-img-slot');
      if (P.fx && P.fx.refresh) P.fx.refresh();
    });
    fetch('data/changelog.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((json) => {
        if (!alive) return;
        const vers = (json && Array.isArray(json.versions) ? json.versions : []).slice().sort((a, b) => cmpVer(a.version, b.version));
        if (!vers.length) { body.innerHTML = '<div class="card empty"><p>기록이 아직 없습니다.</p></div>'; return; }
        // 해 · 달로 묶기 (새 판이 위)
        const groups = [];
        vers.forEach((v) => {
          const p = parts(v.date) || { y: '', m: 0 };
          const key = p.y + '-' + p.m;
          let g = groups[groups.length - 1];
          if (!g || g.key !== key) { g = { key, y: p.y, m: p.m, vers: [] }; groups.push(g); }
          g.vers.push(v);
        });
        let prevYear = null;
        body.innerHTML = '<div class="cl-hist">' + groups.map((g) => {
          const newYear = g.y !== prevYear;
          prevYear = g.y;
          let prevDate = null;
          return '<section class="cl-month' + (newYear ? ' is-newyear' : '') + '" aria-label="' + esc(g.y + '년 ' + g.m + '월') + '">' +
            '<div class="cl-ym" aria-hidden="true">' + (newYear ? '<span class="cl-yr num">' + esc(g.y) + '</span>' : '') + (g.m ? '<span class="cl-mo num">' + g.m + '<small>월</small></span>' : '') + '</div>' +
            '<div class="cl-entries">' + g.vers.map((v) => {
              const show = v.date !== prevDate;
              prevDate = v.date;
              return verHtml(v, v === vers[0], show);
            }).join('') + '</div></section>';
        }).join('') + '</div>';
        const first = vers[vers.length - 1];
        const fp = parts(first.date);
        const majors = vers.filter(isMajor).length;
        heroN.textContent = (fp ? fp.y + '. ' + fp.m + '. ' + fp.d + '. 첫 출시 · ' : '') + '판 ' + vers.length + '개 · 큰 판 ' + majors + '개';
      });
    return () => { alive = false; };
  }

  P.registerApp({ id: 'changelog', title: '업데이트 기록', short: '업데이트', icon: ICON, order: 9, desc: '플랫폼 버전과 주요 변경 내용 요약', mount });
})();
