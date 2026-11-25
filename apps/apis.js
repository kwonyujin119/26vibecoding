/* API 모음: data/apis.json 을 묶음별 표로 표시. 열기(접속·신청) · 문서 단추 */
(function () {
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16"/></svg>';
  const esc = (s) => P.esc(s);
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '');
  const tidy = (s) => String(s || '').replace(/\s*—\s*/g, ' · ');
  /* 인증 구분: 무료(바로 사용) / 키 필요 / 유료 */
  function authKind(a) {
    const s = String(a || '');
    if (/유료/.test(s) && !/무료/.test(s)) return 'paid';
    if (/키|key|신청|토큰|token|oauth|계정|승인|id\//i.test(s)) return 'key';
    return 'free';
  }
  const AUTH = { free: ['무료', 'badge badge-ok'], key: ['키 필요', 'badge'], paid: ['유료', 'badge badge-warn'] };
  function hl(text, ts) {
    const out = esc(text);
    if (!ts.length) return out;
    const re = new RegExp('(' + ts.map((t) => esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
    return out.replace(/(<[^>]*>)|([^<]+)/g, (m, tag, txt) => tag || txt.replace(re, '<mark>$1</mark>'));
  }

  function rowHtml(it, ts) {
    const url = safeUrl(it.url);
    const docs = safeUrl(it.docs);
    const kind = authKind(it.auth);
    const detail = String(it.auth || '').replace(/^무료\s*·\s*/, '').trim();
    return '<div class="ap-row">' +
      '<div class="ap-name">' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + hl(it.name, ts) + '</a>' : '<b>' + hl(it.name, ts) + '</b>') +
      (it.desc ? '<p>' + hl(tidy(it.desc), ts) + '</p>' : '') + '</div>' +
      '<div class="ap-prov">' + hl(it.provider || '', ts) + '</div>' +
      '<div class="ap-auth"><span class="' + AUTH[kind][1] + '">' + AUTH[kind][0] + '</span>' + (detail && detail !== '무료' ? '<small title="' + esc(it.auth) + '">' + hl(detail, ts) + '</small>' : '') + '</div>' +
      '<div class="ap-acts">' +
      (url ? '<a class="btn btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(it.name) + ' 열기">열기' + P.icons.external + '</a>' : '') +
      (docs ? '<a class="btn btn-sm btn-ghost" href="' + esc(docs) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(it.name) + ' 문서">문서</a>' : '<span aria-hidden="true"></span>') +
      '</div></div>';
  }

  function mount(el) {
    let groups = [];
    let alive = true;
    let auth = 'all';
    el.innerHTML =
      '<div class="page ap-page">' +
      '<div class="page-head"><div><h1>API 모음</h1></div></div>' +
      '<div class="ap-tools"><label class="p-search">' + P.icons.search + '<span class="sr-only">검색</span><input type="search" placeholder="이름·기관·용도 검색"></label>' +
      '<div class="seg" role="radiogroup" aria-label="인증 거르기">' + [['all', '전체'], ['free', '무료'], ['key', '키 필요']].map(([v, l]) => '<button type="button" role="radio" data-auth="' + v + '" aria-checked="' + (v === auth) + '">' + l + '</button>').join('') + '</div>' +
      '<span class="ap-count num" aria-live="polite"></span></div>' +
      '<div class="ap-list"><div class="empty">불러오는 중…</div></div></div>';
    const list = el.querySelector('.ap-list');
    const count = el.querySelector('.ap-count');
    const search = el.querySelector('input[type="search"]');

    function render() {
      const ts = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      let total = 0;
      const html = groups.map((g) => {
        const items = (g.items || []).filter((it) => {
          const k = authKind(it.auth);
          if (auth === 'free' && k !== 'free') return false;
          if (auth === 'key' && k === 'free') return false;
          const hay = [it.name, it.desc, it.provider, it.auth, g.title].join(' ').toLowerCase();
          return ts.every((t) => hay.includes(t));
        });
        total += items.length;
        if (!items.length) return '';
        return '<section class="ap-group"><h2 class="ap-group-head"><span>' + esc(g.title) + '</span><span class="num">' + items.length + '</span></h2>' + items.map((it) => rowHtml(it, ts)).join('') + '</section>';
      }).join('');
      list.innerHTML = html
        ? '<div class="ap-table"><div class="ap-head" aria-hidden="true"><span>API</span><span>제공</span><span>인증</span><span></span></div>' + html + '</div>'
        : '<div class="card empty"><p>' + (ts.length || auth !== 'all' ? '조건에 맞는 API가 없습니다.' : 'API 목록이 아직 없습니다.') + '</p></div>';
      count.textContent = total + '개';
    }

    let timer = 0;
    search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 120); });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-auth]');
      if (!b) return;
      auth = b.dataset.auth;
      el.querySelectorAll('[data-auth]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      render();
    });

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
