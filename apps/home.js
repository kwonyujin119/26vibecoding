/* 홈: 업무 카드 버튼 + 최근 작업 */
(function () {
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>';
  const RECENT_COLS = ['docs', 'sheets', 'slides'];
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  const HUES = { 'head-schedule': 'violet', schedule: 'teal', docs: 'accent', slides: 'rose', sheets: 'teal', charts: 'amber', refs: 'violet', apis: 'accent', changelog: 'amber' };
  const SKELETON = '<div class="p-skel-row" aria-hidden="true"><span class="p-skel"></span><span class="p-skel-lines"><span class="p-skel" style="width:55%;height:14px"></span><span class="p-skel" style="width:30%;height:11px"></span></span></div>';
  const EMPTY_ART = '<svg viewBox="0 0 96 72" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="14" y="10" width="40" height="52" rx="6" opacity=".3"/><rect x="24" y="4" width="40" height="52" rx="6" fill="currentColor" fill-opacity=".08"/>' +
    '<path d="M32 18h24M32 26h24M32 34h14"/><circle cx="68" cy="50" r="13" fill="currentColor" fill-opacity=".12"/><path d="M68 44v7l4 3"/>' +
    '<path d="M84 14l1.5 3.5L89 19l-3.5 1.5L84 24l-1.5-3.5L79 19l3.5-1.5z" fill="currentColor" stroke="none" opacity=".6"/></svg>';
  const HERO_ART = '<svg class="home-art" viewBox="0 0 220 170" fill="none" aria-hidden="true">' +
    '<g class="f1"><rect x="20" y="30" width="118" height="92" rx="14" fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.35)"/>' +
    '<rect x="34" y="46" width="54" height="8" rx="4" fill="rgba(255,255,255,.85)"/><rect x="34" y="62" width="88" height="6" rx="3" fill="rgba(255,255,255,.4)"/>' +
    '<rect x="34" y="74" width="74" height="6" rx="3" fill="rgba(255,255,255,.4)"/><rect x="34" y="94" width="22" height="16" rx="4" fill="#5eead4"/><rect x="60" y="88" width="22" height="22" rx="4" fill="rgba(255,255,255,.7)"/><rect x="86" y="80" width="22" height="30" rx="4" fill="#a5b4fc"/></g>' +
    '<g class="f2"><rect x="120" y="14" width="84" height="64" rx="12" fill="rgba(255,255,255,.92)"/>' +
    '<circle cx="146" cy="46" r="17" stroke="#2442c4" stroke-width="7" stroke-dasharray="72 107" transform="rotate(-90 146 46)"/><circle cx="146" cy="46" r="17" stroke="#0f766e" stroke-width="7" stroke-dasharray="35 107" stroke-dashoffset="-72" transform="rotate(-90 146 46)"/>' +
    '<rect x="172" y="34" width="22" height="5" rx="2.5" fill="#2442c4"/><rect x="172" y="44" width="16" height="5" rx="2.5" fill="#0f766e"/><rect x="172" y="54" width="20" height="5" rx="2.5" fill="#cbd5e1"/></g>' +
    '<g class="f3"><rect x="112" y="100" width="96" height="56" rx="12" fill="rgba(15,23,60,.55)" stroke="rgba(255,255,255,.3)"/>' +
    '<rect x="124" y="112" width="16" height="16" rx="4" fill="#5eead4"/><rect x="146" y="114" width="48" height="5" rx="2.5" fill="rgba(255,255,255,.8)"/><rect x="146" y="123" width="32" height="4" rx="2" fill="rgba(255,255,255,.4)"/>' +
    '<rect x="124" y="136" width="16" height="10" rx="3" fill="rgba(255,255,255,.3)"/><rect x="146" y="138" width="40" height="4" rx="2" fill="rgba(255,255,255,.4)"/></g></svg>';

  function greeting(h) {
    if (h < 6) return '늦은 시간까지 수고 많으십니다';
    if (h < 11) return '좋은 아침입니다';
    if (h < 14) return '점심 맛있게 드세요';
    if (h < 18) return '오후도 힘내세요';
    return '오늘 하루도 수고하셨습니다';
  }

  function relTime(iso) {
    const t = Date.parse(iso);
    if (!t) return '';
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return '방금 전';
    if (s < 3600) return Math.floor(s / 60) + '분 전';
    if (s < 86400) return Math.floor(s / 3600) + '시간 전';
    if (s < 86400 * 7) return Math.floor(s / 86400) + '일 전';
    const d = new Date(t);
    return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';
  }

  async function loadRecent(box, appMap) {
    const cols = RECENT_COLS.filter((c) => appMap.has(c));
    if (!cols.length) {
      box.innerHTML = '<div class="empty">문서·엑셀·PT 앱을 쓰면 최근 작업이 여기에 모입니다.</div>';
      return;
    }
    const lists = await Promise.all(cols.map((c) => P.store.list(c).then(
      (rows) => rows.map((r) => Object.assign({ col: c }, r)),
      () => []
    )));
    const rows = lists.flat().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 5);
    if (!box.isConnected) return;
    if (!rows.length) {
      box.innerHTML = '<div class="home-recent-empty">' + EMPTY_ART + '<div><b>아직 작업한 문서가 없습니다</b><p>위의 업무 카드에서 문서·엑셀·PT를 시작하면 여기에 바로 모입니다.</p></div></div>';
      return;
    }
    box.innerHTML = rows.map((r) => {
      const app = appMap.get(r.col);
      const title = (r.data && (r.data.title || r.data.name)) || '제목 없음';
      return '<a class="home-recent-item" href="#/' + P.esc(r.col) + '/' + encodeURIComponent(r.id) + '">' +
        '<span class="home-recent-ic">' + (app.icon || '') + '</span>' +
        '<span class="home-recent-txt"><b>' + P.esc(title) + '</b><small>' + P.esc(app.title) + '</small></span>' +
        '<span class="home-recent-time">' + P.esc(relTime(r.updatedAt)) + '</span></a>';
    }).join('');
  }

  function mount(el) {
    const b = P.brand();
    const apps = P.apps().filter((a) => a.id !== 'home');
    const appMap = new Map(apps.map((a) => [a.id, a]));
    const kind = P.storage.kinds[P.store.backend()];
    const now = new Date();
    const date = now.getFullYear() + '년 ' + (now.getMonth() + 1) + '월 ' + now.getDate() + '일 ' + WEEK[now.getDay()] + '요일';

    const hasDocs = appMap.has('docs');
    el.innerHTML =
      '<div class="page">' +
      '<section class="home-hero">' +
      '<div class="home-hero-txt">' +
      '<div class="home-date"><i></i>' + P.esc(date) + '</div>' +
      '<p class="home-greet">' + P.esc(greeting(now.getHours())) + '</p>' +
      '<h1>' + P.esc(b.title) + '</h1>' +
      (b.subtitle ? '<p>' + P.esc(b.subtitle) + '</p>' : '') +
      '<div class="home-hero-meta">' +
      (hasDocs ? '<a class="home-pill solid" href="#/docs">' + P.icons.plus + '문서 쓰기</a>' : '') +
      '<button type="button" class="home-pill" data-act="storage">' + kind.icon + '저장 위치: ' + P.esc(kind.label) + '</button>' +
      '<button type="button" class="home-pill" data-act="settings">' + P.icons.gear + '제목·테마 설정</button>' +
      '</div></div>' + HERO_ART + '</section>' +
      '<div class="home-section-title"><h2>업무 바로가기</h2><span class="muted">' + apps.length + '개</span></div>' +
      '<div class="home-apps">' + apps.map((a, i) =>
        '<a class="home-app" href="#/' + P.esc(a.id) + '" data-hue="' + (HUES[a.id] || 'accent') + '" style="--i:' + i + '">' +
        '<span class="home-app-ic">' + (a.icon || '') + '</span>' +
        '<h3>' + P.esc(a.title) + '</h3>' +
        (a.desc ? '<p>' + P.esc(a.desc) + '</p>' : '') +
        '<span class="home-app-go">' + P.icons.arrow + '</span></a>').join('') +
      '</div>' +
      '<div class="home-section-title"><h2>최근 작업</h2></div>' +
      '<div class="card home-recent" aria-busy="true">' + SKELETON + SKELETON + SKELETON + '</div>' +
      '</div>';

    el.querySelector('[data-act="storage"]').addEventListener('click', (e) => { e.stopPropagation(); P.storage.openMenu(); });
    el.querySelector('[data-act="settings"]').addEventListener('click', () => P.storage.openSettings());
    loadRecent(el.querySelector('.home-recent'), appMap).then(() => {
      const box = el.querySelector('.home-recent');
      if (box) box.removeAttribute('aria-busy');
    }, () => {
      const box = el.querySelector('.home-recent');
      if (!box) return;
      box.removeAttribute('aria-busy');
      box.innerHTML = '<div class="empty">최근 작업을 불러오지 못했습니다.</div>';
    });
  }

  P.registerApp({ id: 'home', title: '홈', short: '홈', icon: ICON, order: 0, desc: '모든 업무로 가는 시작 화면', mount });
})();
