/* API 모음 = 연결 단자함 (patch panel)
   data/apis.json 의 묶음 = 단자판 한 줄(랙 한 칸), API 하나 = 단자(포트) 하나.
   단자 테두리 색 = 인증 구분(무료 · 키 필요 · 유료), 실제 단자함의 색 구분 단자처럼. 열기(접속·신청) · 문서 단추.
   연결 상태 확인(외부 주소에 요청 보내기)은 넣지 않음: Chromium 은 닿지 않는 주소마다 콘솔에 'Failed to load resource' 를
   남기고(fetch · Image · prefetch 모두), 페이지 코드로 막을 수 없어서. */
(function () {
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16"/></svg>';
  const esc = (s) => P.esc(s);
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '');
  const tidy = (s) => String(s || '').replace(/\s*—\s*/g, ' · ');
  const pad = (n) => String(n).padStart(2, '0');
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
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  function pickSlot(name, legacy) {
    return fetch('data/images.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => {
      const s = j && Array.isArray(j.slots) ? j.slots.map(String) : [];
      return !s.includes(name) && legacy && s.includes(legacy) ? legacy : name;
    });
  }

  /* 단자 하나 */
  function portHtml(it, ts, no) {
    const url = safeUrl(it.url);
    const docs = safeUrl(it.docs);
    const kind = authKind(it.auth);
    const detail = String(it.auth || '').replace(/^무료\s*·\s*/, '').trim();
    return '<li class="ap-port" data-kind="' + kind + '">' +
      '<div class="ap-jack" aria-hidden="true"><span class="ap-socket"><i></i></span><span class="ap-pno num">' + pad(no) + '</span></div>' +
      '<div class="ap-port-bd">' +
      '<div class="ap-port-hd">' + (url ? '<a class="ap-name" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + hl(it.name, ts) + '</a>' : '<b class="ap-name">' + hl(it.name, ts) + '</b>') +
      '<span class="' + AUTH[kind][1] + ' ap-badge">' + AUTH[kind][0] + '</span></div>' +
      '<div class="ap-prov">' + hl(it.provider || '', ts) + (url ? '<span class="ap-host num">' + esc(host(url)) + '</span>' : '') + '</div>' +
      (it.desc ? '<p class="ap-desc">' + hl(tidy(it.desc), ts) + '</p>' : '') +
      (detail && detail !== '무료' ? '<p class="ap-auth" title="' + esc(it.auth) + '">' + hl(detail, ts) + '</p>' : '') +
      '<div class="ap-acts">' +
      (url ? '<a class="btn btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(it.name) + ' 열기">열기' + P.icons.external + '</a>' : '') +
      (docs ? '<a class="btn btn-sm btn-ghost" href="' + esc(docs) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(it.name) + ' 문서">문서</a>' : '') +
      '</div></div></li>';
  }

  /* 대체 그림: 단자판 한 칸 + 꽂힌 선 두 가닥 */
  function heroArt() {
    const ports = Array.from({ length: 8 }, (_, i) => '<i class="' + (i === 1 || i === 5 ? 'on' : '') + (i === 3 ? ' key' : '') + '"></i>').join('');
    const L = (cls, d, r, i, st, inner) => '<div class="fx-layer ' + cls + '" style="--d:' + d + ';--r:' + r + 'deg;--i:' + i + ';' + (st || '') + '">' + (inner || '') + '</div>';
    return '<div class="fx-ph ap-art" aria-hidden="true">' +
      L('fx-desk', 0.12, 0, 0) +
      L('ap-art-panel', 0.4, 0, 1, 'right:5%;top:22%;width:52%;height:34%', '<b></b>' + ports + '<b></b>') +
      L('ap-art-panel lower', 0.3, 0, 2, 'right:5%;top:62%;width:52%;height:24%', '<b></b>' + ports.replace(/ class="[^"]*"/g, '') + '<b></b>') +
      L('ap-art-cable', 0.7, 0, 3, 'right:38%;top:44%;width:14%;height:46%') +
      L('ap-art-cable b', 0.8, 0, 4, 'right:16%;top:44%;width:10%;height:50%') +
      '</div>';
  }

  function mount(el) {
    let groups = [];
    let alive = true;
    let auth = 'all';
    el.innerHTML =
      '<div class="page ap-page">' +
      '<div class="page-head"><div><h1>API 모음</h1></div></div>' +
      '<div class="ap-hero fx-scene">' +
      '<div class="ap-hero-slot" aria-hidden="true">' + heroArt() + '</div>' +
      '<div class="ap-hero-cap"><span class="ap-hero-k">연결 단자함</span><b>업무에 쓰는 API</b><span class="ap-hero-s">단자 이름이나 열기를 누르면 그 서비스로 바로 접속합니다.</span><span class="ap-hero-n num"></span></div>' +
      '</div>' +
      '<div class="ap-tools"><label class="p-search">' + P.icons.search + '<span class="sr-only">검색</span><input type="search" placeholder="이름·기관·용도 검색"></label>' +
      '<div class="seg" role="radiogroup" aria-label="인증 거르기">' + [['all', '전체'], ['free', '무료'], ['key', '키 필요']].map(([v, l]) => '<button type="button" role="radio" data-auth="' + v + '" aria-checked="' + (v === auth) + '">' + l + '</button>').join('') + '</div>' +
      '<span class="ap-count num" aria-live="polite"></span></div>' +
      '<p class="ap-legend"><span class="ap-key" data-kind="free"><i aria-hidden="true"></i>무료, 바로 사용</span><span class="ap-key" data-kind="key"><i aria-hidden="true"></i>키·신청 필요</span><span class="ap-key" data-kind="paid"><i aria-hidden="true"></i>유료</span><span class="ap-legend-n">단자 테두리 색이 인증 구분입니다.</span></p>' +
      '<div class="ap-list">' + P.ui.skeleton(4) + '</div></div>';
    const list = el.querySelector('.ap-list');
    const count = el.querySelector('.ap-count');
    const heroN = el.querySelector('.ap-hero-n');
    const search = el.querySelector('input[type="search"]');

    pickSlot('tab-apis', null).then((name) => {
      const s = el.querySelector('.ap-hero-slot');
      if (!alive || !s) return;
      s.dataset.slot = name;
      s.classList.add('fx-img-slot');
      if (P.fx && P.fx.refresh) P.fx.refresh();
    });

    function render() {
      const ts = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      let total = 0;
      let no = 0;
      const html = groups.map((g, gi) => {
        const all = g.items || [];
        const items = all.filter((it) => {
          const k = authKind(it.auth);
          if (auth === 'free' && k !== 'free') return false;
          if (auth === 'key' && k === 'free') return false;
          const hay = [it.name, it.desc, it.provider, it.auth, g.title].join(' ').toLowerCase();
          return ts.every((t) => hay.includes(t));
        });
        total += items.length;
        const base = no;
        no += all.length;
        if (!items.length) return '';
        const num = new Map(all.map((it, i) => [it, base + i + 1]));
        return '<section class="ap-group" aria-labelledby="ap-g' + gi + '">' +
          '<span class="ap-ear" aria-hidden="true"><i></i><i></i></span>' +
          '<div class="ap-panel">' +
          '<h2 class="ap-label" id="ap-g' + gi + '"><span class="ap-label-no num" aria-hidden="true">' + pad(gi + 1) + '</span><span class="ap-label-t">' + esc(g.title) + '</span><span class="ap-label-n num">' + items.length + (items.length !== all.length ? ' / ' + all.length : '') + '</span></h2>' +
          '<ul class="ap-ports">' + items.map((it) => portHtml(it, ts, num.get(it))).join('') + '</ul>' +
          '</div>' +
          '<span class="ap-ear" aria-hidden="true"><i></i><i></i></span>' +
          '</section>';
      }).join('');
      list.innerHTML = html
        ? '<div class="ap-rack">' + html + '</div>'
        : '<div class="card empty"><p>' + (ts.length || auth !== 'all' ? '조건에 맞는 API가 없습니다.' : 'API 목록이 아직 없습니다.') + '</p></div>';
      count.textContent = total + '개';
    }

    let timer = 0;
    search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 120); });
    search.addEventListener('keydown', (e) => { if (e.key === 'Escape' && search.value) { e.stopPropagation(); search.value = ''; render(); } });
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
        const n = groups.reduce((a, g) => a + (g.items || []).length, 0);
        const free = groups.reduce((a, g) => a + (g.items || []).filter((it) => authKind(it.auth) === 'free').length, 0);
        if (n) heroN.textContent = groups.length + '개 단자판 · 단자 ' + n + '개 · 무료 ' + free + '개';
        render();
      });

    return () => { alive = false; clearTimeout(timer); };
  }

  P.registerApp({ id: 'apis', title: 'API 모음', short: 'API', icon: ICON, order: 8, desc: '공공데이터·지도·AI 등 업무에 쓰는 API를 클릭 한 번으로 접속', mount });
})();
