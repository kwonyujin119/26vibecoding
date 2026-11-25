/* 업데이트 기록: data/changelog.json 버전 타임라인 (항상 마지막 탭) */
(function () {
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
  const esc = (s) => P.esc(s);

  function cmpVer(a, b) {
    const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pb[i] || 0) - (pa[i] || 0);
      if (d) return d;
    }
    return 0;
  }

  function verHtml(v, latest) {
    const details = Array.isArray(v.details) ? v.details : [];
    return '<li class="changelog-ver card' + (latest ? ' latest' : '') + '">' +
      '<div class="changelog-head"><span class="changelog-v">v' + esc(v.version) + '</span>' +
      '<h2>' + esc(v.title || '업데이트') + '</h2>' +
      (latest ? '<span class="chip">최신</span>' : '') +
      (v.version === P.version ? '<span class="chip">사용 중</span>' : '') +
      '<span class="changelog-date">' + esc(v.date || '') + '</span></div>' +
      (Array.isArray(v.highlights) && v.highlights.length ? '<ul class="changelog-hl">' + v.highlights.map((h) => '<li>' + esc(h) + '</li>').join('') + '</ul>' : '') +
      (details.length ? '<details' + (latest ? ' open' : '') + '><summary>세부 변경 ' + details.reduce((s, d) => s + ((d.items || []).length), 0) + '건</summary>' +
        details.map((d) => '<div class="changelog-area"><h4>' + esc(d.area) + '</h4><ul>' + (d.items || []).map((i) => '<li>' + esc(i) + '</li>').join('') + '</ul></div>').join('') +
        '</details>' : '') +
      (Array.isArray(v.limits) && v.limits.length ? '<details class="changelog-limits"><summary>알려진 한계 ' + v.limits.length + '건</summary><ul>' + v.limits.map((i) => '<li>' + esc(i) + '</li>').join('') + '</ul></details>' : '') +
      '</li>';
  }

  function mount(el) {
    let alive = true;
    el.innerHTML = '<div class="page" style="max-width:880px">' +
      '<div class="page-head"><div><h1>업데이트 기록</h1><p>플랫폼 버전별 주요 변경 내용입니다. 현재 버전 v' + esc(P.version) + '</p></div></div>' +
      '<div class="changelog-body"><div class="empty">불러오는 중…</div></div></div>';
    const body = el.querySelector('.changelog-body');
    fetch('data/changelog.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((json) => {
        if (!alive) return;
        const vers = (json && Array.isArray(json.versions) ? json.versions : []).slice().sort((a, b) => cmpVer(a.version, b.version));
        body.innerHTML = vers.length
          ? '<ol class="changelog-list">' + vers.map((v, i) => verHtml(v, i === 0)).join('') + '</ol>'
          : '<div class="card empty"><h3>기록이 아직 없습니다</h3></div>';
      });
    return () => { alive = false; };
  }

  P.registerApp({ id: 'changelog', title: '업데이트 기록', short: '업데이트', icon: ICON, order: 9, desc: '플랫폼 버전과 주요 변경 내용 요약', mount });
})();
