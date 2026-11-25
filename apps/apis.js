/* API 모음: data/apis.json 을 그룹별 카드로 표시, 카드 클릭 한 번에 접속 */
(function () {
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16"/></svg>';
  const esc = (s) => P.esc(s);
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '');

  function cardHtml(it) {
    const url = safeUrl(it.url);
    const docs = safeUrl(it.docs);
    const free = /무료/.test(it.auth || '') && !/키|key|신청/i.test(it.auth || '');
    return '<article class="apis-card">' +
      '<h3>' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(it.name) + '</a>' : esc(it.name)) + '</h3>' +
      (url ? '<span class="apis-go" aria-hidden="true">' + P.icons.external + '</span>' : '') +
      (it.desc ? '<p>' + esc(it.desc) + '</p>' : '') +
      '<div class="apis-meta">' +
      (it.auth ? '<span class="chip apis-auth' + (free ? ' free' : '') + '">' + esc(it.auth) + '</span>' : '') +
      (it.provider ? '<span class="apis-prov">' + esc(it.provider) + '</span>' : '') +
      (docs ? '<a class="btn btn-sm btn-ghost apis-docs" href="' + esc(docs) + '" target="_blank" rel="noopener noreferrer" style="margin-left:auto">문서</a>' : '') +
      '</div></article>';
  }

  function mount(el) {
    let groups = [];
    let alive = true;
    el.innerHTML =
      '<div class="page">' +
      '<div class="page-head"><div><h1>업무 API 모음</h1><p>카드를 누르면 바로 접속(신청·콘솔) 화면이 새 창으로 열립니다. 문서 단추는 사용 설명서입니다.</p></div></div>' +
      '<div class="apis-tools"><label class="p-search">' + P.icons.search + '<span class="sr-only">검색</span><input type="search" placeholder="이름·기관·용도 검색"></label><span class="apis-count" aria-live="polite"></span></div>' +
      '<div class="apis-list"><div class="empty">불러오는 중…</div></div></div>';
    const list = el.querySelector('.apis-list');
    const count = el.querySelector('.apis-count');
    const search = el.querySelector('input[type="search"]');

    function render() {
      const q = search.value.trim().toLowerCase();
      let total = 0;
      const html = groups.map((g) => {
        const items = (g.items || []).filter((it) => !q || [it.name, it.desc, it.provider, it.auth, g.title].join(' ').toLowerCase().includes(q));
        total += items.length;
        if (!items.length) return '';
        return '<section class="apis-group"><h2>' + esc(g.title) + ' <span class="refs-badge">' + items.length + '</span></h2><div class="apis-cards">' + items.map(cardHtml).join('') + '</div></section>';
      }).join('');
      list.innerHTML = html || '<div class="card empty"><h3>' + (q ? '검색 결과가 없습니다' : 'API 목록이 아직 없습니다') + '</h3><p>' + (q ? '다른 검색어를 입력해 보세요.' : '목록이 준비되면 이곳에 표시됩니다.') + '</p></div>';
      count.textContent = total + '개';
    }

    let timer = 0;
    search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 120); });

    fetch('data/apis.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((json) => {
        if (!alive) return;
        groups = json && Array.isArray(json.groups) ? json.groups : [];
        render();
      });

    return () => { alive = false; clearTimeout(timer); };
  }

  P.registerApp({ id: 'apis', title: 'API 모음', short: 'API', icon: ICON, order: 8, desc: '공공데이터·지도·AI 등 업무에 쓰는 API를 클릭 한 번으로 접속', mount });
})();
