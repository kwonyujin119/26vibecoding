/* 업데이트 기록: data/changelog.json 을 릴리스 노트 형식으로 (항상 마지막 탭) */
(function () {
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
  const esc = (s) => P.esc(s);
  const tidy = (s) => String(s || '').replace(/\s*—\s*/g, ' · ');

  function cmpVer(a, b) {
    const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pb[i] || 0) - (pa[i] || 0);
      if (d) return d;
    }
    return 0;
  }
  const fmtDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? m[1] + '. ' + Number(m[2]) + '. ' + Number(m[3]) + '.' : esc(s || ''); };

  function verHtml(v, latest) {
    const details = Array.isArray(v.details) ? v.details : [];
    const n = details.reduce((s, d) => s + ((d.items || []).length), 0);
    const areas = details.map((d) => '<section class="cl-area"><h3>' + esc(d.area) + '</h3><ul>' + (d.items || []).map((i) => '<li>' + esc(tidy(i)) + '</li>').join('') + '</ul></section>').join('');
    return '<article class="cl-ver' + (latest ? ' latest' : '') + '" id="v' + esc(v.version) + '">' +
      '<div class="cl-aside"><span class="cl-v num">v' + esc(v.version) + '</span>' +
      '<time class="num" datetime="' + esc(v.date || '') + '">' + fmtDate(v.date) + '</time>' +
      '<span class="cl-tags">' + (latest ? '<span class="badge badge-accent">최신</span>' : '') + (v.version === P.version ? '<span class="badge">사용 중</span>' : '') + '</span></div>' +
      '<div class="cl-body"><h2>' + esc(v.title || '업데이트') + '</h2>' +
      (Array.isArray(v.highlights) && v.highlights.length ? '<ul class="cl-hl">' + v.highlights.map((h) => '<li>' + esc(tidy(h)) + '</li>').join('') + '</ul>' : '') +
      (details.length ? (latest ? '<div class="cl-details">' + areas + '</div>' : '<details class="cl-fold"><summary>세부 변경 <span class="num">' + n + '</span></summary><div class="cl-details">' + areas + '</div></details>') : '') +
      (Array.isArray(v.limits) && v.limits.length ? '<details class="cl-fold cl-limits"><summary>알려진 한계 <span class="num">' + v.limits.length + '</span></summary><ul>' + v.limits.map((i) => '<li>' + esc(tidy(i)) + '</li>').join('') + '</ul></details>' : '') +
      '</div></article>';
  }

  function mount(el) {
    let alive = true;
    el.innerHTML = '<div class="page cl-page">' +
      '<div class="page-head"><div><h1>업데이트 기록</h1></div><span class="cl-cur num">지금 v' + esc(P.version) + '</span></div>' +
      '<div class="fx-banner fx-scene" aria-hidden="true"><div class="fx-img-slot" data-slot="changelog-header"></div><div class="fx-banner-cap"><b>버전마다 바뀐 점</b><span>최신 버전은 세부 변경까지 펼쳐 둡니다.</span></div></div>' +
      '<div class="cl-list">' + P.ui.skeleton(4) + '</div></div>';
    const body = el.querySelector('.cl-list');
    fetch('data/changelog.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((json) => {
        if (!alive) return;
        const vers = (json && Array.isArray(json.versions) ? json.versions : []).slice().sort((a, b) => cmpVer(a.version, b.version));
        body.innerHTML = vers.length ? vers.map((v, i) => verHtml(v, i === 0)).join('') : '<div class="card empty"><p>기록이 아직 없습니다.</p></div>';
      });
    return () => { alive = false; };
  }

  P.registerApp({ id: 'changelog', title: '업데이트 기록', short: '업데이트', icon: ICON, order: 9, desc: '플랫폼 버전과 주요 변경 내용 요약', mount });
})();
