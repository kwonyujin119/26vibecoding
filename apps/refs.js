/* 레퍼런스 = 서가 + 색인 카드함
   data/references.json 묶음(책) + 내 레퍼런스(store 'refs-user', 책 한 권).
   위: 서가(책등 = 묶음, 높이·두께는 자료 수). 책등을 누르면 빠져나오고 아래 카드함에 그 묶음의 색인 카드가 열림.
   서가는 role=tablist(←/→ · Home/End 는 core 가 처리), 카드함은 tabpanel. 카드/목록 보기 전환은 그대로. */
(function () {
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/></svg>';
  const IC_LIST = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
  const IC_GRID = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="7.5" height="5.5" rx=".8"/><rect x="13" y="5" width="7.5" height="5.5" rx=".8"/><rect x="3.5" y="13.5" width="7.5" height="5.5" rx=".8"/><rect x="13" y="13.5" width="7.5" height="5.5" rx=".8"/></svg>';
  const COL = 'refs-user';
  const MINE = '__mine';
  const ALL = '';
  const CATS = ['UI/UX', 'PT', '문서', '엑셀', '디자인', '공공AI', '기타'];
  /* 책등 색: 차분한 제본 천 색 10가지 (CSS 가 --c 로 받음) */
  const SPINE = ['#2B3A67', '#7A3B33', '#3D5C48', '#8E6B33', '#4D5866', '#6A4C3B', '#56664A', '#5B4560', '#2F5D6B', '#7F5A40'];
  const esc = (s) => P.esc(s);
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '');
  const tidy = (s) => String(s || '').replace(/\s*—\s*/g, ' · ');
  const shortTitle = (s) => String(s || '분류 없음').replace(/\s*\([^)]*\)\s*/g, '').trim() || String(s || '');
  /* 책등 제목: 7글자를 넘으면 가운데에 가까운 띄어쓰기·가운뎃점에서 두 줄로 (세로쓰기 두 단) */
  function spineLines(t, max) {
    const len = t.replace(/\s/g, '').length;
    if (len <= (max || 7)) return [t];
    let best = -1;
    for (let i = 1; i < t.length - 1; i++) if (/[\s·]/.test(t[i]) && (best < 0 || Math.abs(i - t.length / 2) < Math.abs(best - t.length / 2))) best = i;
    return best < 0 ? [t] : [t.slice(0, best).trim(), t.slice(best + 1).trim()];
  }
  function domainOf(u) {
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }
  /* 검색어 강조: 글자를 이스케이프한 뒤 태그 밖에서만 <mark> */
  function hl(text, ts) {
    const out = esc(text);
    if (!ts.length) return out;
    const re = new RegExp('(' + ts.map((t) => esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
    return out.replace(/(<[^>]*>)|([^<]+)/g, (m, tag, txt) => tag || txt.replace(re, '<mark>$1</mark>'));
  }
  /* 그림 자리 이름: 새 이름(tab-refs)이 목록에 없고 예전 이름(refs-header)만 있으면 예전 그림을 씀 */
  function pickSlot(name, legacy) {
    return fetch('data/images.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => {
      const s = j && Array.isArray(j.slots) ? j.slots.map(String) : [];
      return !s.includes(name) && legacy && s.includes(legacy) ? legacy : name;
    });
  }

  async function fetchRefs() {
    try {
      const res = await fetch('data/references.json', { cache: 'no-cache' });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json && json.sectors) ? json.sectors : [];
    } catch (e) {
      return [];
    }
  }

  function actsHtml(it) {
    return '<span class="rf-acts"><button type="button" class="btn btn-ghost btn-sm p-icon-btn" data-edit="' + esc(it._id) + '" aria-label="수정" title="수정">' + P.icons.edit + '</button><button type="button" class="btn btn-ghost btn-sm p-icon-btn" data-del="' + esc(it._id) + '" aria-label="삭제" title="삭제">' + P.icons.trash + '</button></span>';
  }
  function titleHtml(it, url, ts) {
    return url
      ? '<a class="rf-title" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer"' + (it.source ? ' title="출처: ' + esc(it.source) + '"' : '') + '>' + hl(tidy(it.title) || url, ts) + '</a>'
      : '<b class="rf-title">' + hl(it.title || '제목 없음', ts) + '</b>';
  }

  /* 색인 카드: 위 칸(분류 · 순번), 괘선 본문, 아래 구멍, 사이트 도장 */
  function cardHtml(it, mine, ts, no) {
    const url = safeUrl(it.url);
    const dom = url ? domainOf(url) : '';
    const tags = Array.isArray(it.tags) ? it.tags : [];
    return '<article class="rf-row rf-card' + (mine ? ' rf-mine' : '') + '">' +
      '<div class="rf-card-hd"><span class="rf-callno num">' + hl(it.category || '기타', ts) + '</span><span class="rf-no num" aria-hidden="true">' + String(no).padStart(3, '0') + '</span>' + (mine ? actsHtml(it) : '') + '</div>' +
      '<div class="rf-card-bd">' + titleHtml(it, url, ts) +
      (it.note ? '<p class="rf-note">' + hl(tidy(it.note), ts) + '</p>' : '') +
      (tags.length ? '<div class="rf-meta">' + tags.slice(0, 4).map((t) => '<span class="rf-tag">#' + hl(t, ts) + '</span>').join('') + '</div>' : '') +
      '</div>' +
      (dom ? '<span class="rf-stamp" title="' + esc(dom) + '">' + hl(dom, ts) + '</span>' : '') +
      '<span class="rf-hole" aria-hidden="true"></span>' +
      '</article>';
  }
  /* 목록(촘촘히): 대장 한 줄 */
  function rowHtml(it, mine, ts) {
    const url = safeUrl(it.url);
    const dom = url ? domainOf(url) : '';
    const tags = Array.isArray(it.tags) ? it.tags : [];
    return '<article class="rf-row rf-line' + (mine ? ' rf-mine' : '') + '">' +
      '<span class="rf-callno num">' + hl(it.category || '기타', ts) + '</span>' +
      '<div class="rf-row-main">' + titleHtml(it, url, ts) +
      (it.note ? '<p class="rf-note">' + hl(tidy(it.note), ts) + '</p>' : '') + '</div>' +
      '<div class="rf-meta">' + (dom ? '<span class="rf-domain">' + hl(dom, ts) + '</span>' : '') +
      tags.slice(0, 3).map((t) => '<span class="rf-tag">#' + hl(t, ts) + '</span>').join('') + '</div>' +
      (mine ? actsHtml(it) : (url ? '<span class="rf-go" aria-hidden="true">' + P.icons.external + '</span>' : '<span></span>')) +
      '</article>';
  }

  function matches(it, ts, cat) {
    if (cat && it.category !== cat) return false;
    if (!ts.length) return true;
    const hay = [it.title, it.note, it.source, it.category, it.url].concat(it.tags || []).join(' ').toLowerCase();
    return ts.every((w) => hay.includes(w));
  }

  /* 서가 장식 그림 (그림 파일이 없을 때): 책상 위 책 몇 권 + 색인 카드 한 장 + 사이트 도장 */
  function heroArt() {
    const L = (cls, d, r, i, st, inner) => '<div class="fx-layer ' + cls + '" style="--d:' + d + ';--r:' + r + 'deg;--i:' + i + ';' + (st || '') + '">' + (inner || '') + '</div>';
    const books = [[0, 72, 13], [3, 64, 11], [2, 80, 15], [8, 58, 10], [5, 70, 12], [1, 76, 14]].map(([c, h, w]) =>
      '<i style="--c:' + SPINE[c] + ';height:' + h + '%;width:' + w + '%"></i>').join('');
    return '<div class="fx-ph rf-art" aria-hidden="true">' +
      L('fx-desk', 0.12, 0, 0) +
      L('rf-art-books', 0.35, 0, 1, 'right:6%;bottom:18%;width:30%;height:66%', books + '<b class="rf-art-end"></b>') +
      L('rf-art-card back', 0.5, 4, 2, 'right:37%;bottom:34%;width:15%;aspect-ratio:5/3', '<i class="t"></i><i></i><i class="s"></i><u></u>') +
      L('rf-art-card', 0.7, -5, 3, 'right:30%;bottom:14%;width:17%;aspect-ratio:5/3', '<i class="t"></i><i></i><i></i><i class="s"></i><u></u>') +
      '</div>';
  }

  function mount(el) {
    const layout0 = P.settings.get('refs.layout', 'grid');
    const state = { sectors: [], mine: [], q: '', cat: '', sec: ALL, layout: layout0 === 'list' ? 'list' : 'grid', open: P.settings.get('refs.open', {}) };
    let alive = true;
    let loaded = false;

    el.innerHTML =
      '<div class="page rf-page">' +
      '<div class="page-head"><div><h1>레퍼런스</h1></div>' +
      '<button type="button" class="btn btn-primary" data-act="add">' + P.icons.plus + '추가</button></div>' +
      '<div class="rf-hero fx-scene">' +
      '<div class="rf-hero-slot" aria-hidden="true">' + heroArt() + '</div>' +
      '<div class="rf-hero-cap"><span class="rf-hero-k">자료 서가</span><b>업무·디자인 참고 자료</b><span class="rf-hero-s">책등을 누르면 색인 카드가 열립니다.</span><span class="rf-hero-n num" aria-live="polite"></span></div>' +
      '<div class="rf-sources" hidden></div>' +
      '</div>' +
      '<div class="rf-tools">' +
      '<label class="p-search rf-search">' + P.icons.search + '<span class="sr-only">검색</span><input type="search" placeholder="제목·설명·태그·사이트 검색"></label>' +
      '<span class="rf-count num" aria-live="polite"></span>' +
      '<div class="seg rf-layout-seg" role="radiogroup" aria-label="보기">' +
      '<button type="button" role="radio" data-layout="grid" aria-label="카드" title="카드" aria-checked="' + (state.layout === 'grid') + '">' + IC_GRID + '</button>' +
      '<button type="button" role="radio" data-layout="list" aria-label="목록" title="목록(촘촘히)" aria-checked="' + (state.layout === 'list') + '">' + IC_LIST + '</button></div>' +
      '</div>' +
      '<div class="rf-cats chips" role="group" aria-label="분류"></div>' +
      '<div class="rf-case"><div class="rf-shelf" role="tablist" aria-label="서가: 묶음 고르기"></div></div>' +
      '<section class="rf-drawer" id="rf-drawer" role="tabpanel" aria-label="색인 카드함">' +
      '<div class="rf-plate"></div>' +
      '<div class="rf-list">' + P.ui.skeleton(4) + '</div>' +
      '</section></div>';
    const list = el.querySelector('.rf-list');
    const shelf = el.querySelector('.rf-shelf');
    const plate = el.querySelector('.rf-plate');
    const drawer = el.querySelector('.rf-drawer');
    const catsBox = el.querySelector('.rf-cats');
    const count = el.querySelector('.rf-count');
    const heroN = el.querySelector('.rf-hero-n');
    const search = el.querySelector('input[type="search"]');
    const terms = () => state.q.trim().toLowerCase().split(/\s+/).filter(Boolean);

    pickSlot('tab-refs', 'refs-header').then((name) => {
      const s = el.querySelector('.rf-hero-slot');
      if (!alive || !s) return;
      s.dataset.slot = name;
      s.classList.add('fx-img-slot');
      if (P.fx && P.fx.refresh) P.fx.refresh();
    });

    function allSectors() {
      const mineSector = { id: MINE, title: '내 레퍼런스', desc: '직접 추가한 링크. 지금 저장 위치에 저장됩니다.', items: state.mine };
      return [mineSector].concat(state.sectors);
    }
    const sid = (s) => String(s.id || s.title);
    const secById = (id) => allSectors().find((s) => sid(s) === id);

    /* ---------- 서가 ---------- */
    function spineHtml(s, i) {
      const id = sid(s);
      const n = (s.items || []).length;
      const mine = id === MINE;
      const h = Math.round(Math.min(254, 158 + 16 * Math.log2(n + 1)));
      const w = Math.round(38 + 2.6 * Math.sqrt(n));
      const t = mine ? spineLines('내 레퍼런스', 3) : spineLines(shortTitle(s.title));
      return '<button type="button" role="tab" class="rf-spine' + (mine ? ' is-mine' : '') + '" data-sec="' + esc(id) + '" aria-controls="rf-drawer" aria-selected="false" tabindex="-1"' +
        ' style="--c:' + (mine ? '#B39465' : SPINE[i % SPINE.length]) + ';--h:' + h + ';--w:' + w + '"' + (s.desc ? ' title="' + esc(tidy(s.desc)) + '"' : '') + '>' +
        '<span class="rf-spine-band" aria-hidden="true"></span>' +
        '<span class="rf-spine-t" aria-hidden="true">' + t.map((x) => '<span>' + esc(x).replace(/ /g, '\u2009') + '</span>').join('') + '</span>' +
        '<span class="sr-only">' + esc(mine ? '내 레퍼런스' : (s.title || '분류 없음')) + '</span>' +
        '<span class="rf-spine-n num" aria-hidden="true"></span>' +
        '<span class="sr-only rf-spine-sr"></span>' +
        '</button>';
    }
    function buildShelf() {
      const keep = document.activeElement && shelf.contains(document.activeElement) ? document.activeElement.dataset.sec : null;
      shelf.innerHTML =
        '<button type="button" role="tab" class="rf-spine rf-end" data-sec="" aria-controls="rf-drawer" aria-selected="false" tabindex="-1">' +
        '<span class="rf-end-t">전체</span><span class="rf-spine-n num" aria-hidden="true"></span><span class="sr-only rf-spine-sr"></span></button>' +
        allSectors().map((s, i) => spineHtml(s, i - 1 < 0 ? 0 : i - 1)).join('') +
        '<span class="rf-bookend" aria-hidden="true"></span>';
      if (keep !== null && keep !== undefined) {
        const b = shelf.querySelector('[data-sec="' + CSS.escape(keep) + '"]');
        if (b) b.focus();
      }
    }
    function syncShelf() {
      const ts = terms();
      const filtering = !!(ts.length || state.cat);
      let total = 0;
      shelf.querySelectorAll('.rf-spine').forEach((b) => {
        const id = b.dataset.sec;
        const sel = id === state.sec;
        b.setAttribute('aria-selected', String(sel));
        b.tabIndex = sel ? 0 : -1;
        b.classList.toggle('is-out', sel && id !== ALL);
        if (id === ALL) return;
        const s = secById(id);
        const all = (s && s.items || []).length;
        const n = (s && s.items || []).filter((it) => matches(it, ts, state.cat)).length;
        total += n;
        b.classList.toggle('is-dim', filtering && !n);
        b.classList.toggle('is-hit', filtering && n > 0);
        b.querySelector('.rf-spine-n').textContent = filtering ? n : all;
        b.querySelector('.rf-spine-sr').textContent = ', ' + (filtering ? '찾은 자료 ' + n + '개 / ' : '') + all + '개';
      });
      const end = shelf.querySelector('.rf-end');
      if (end) {
        end.querySelector('.rf-spine-n').textContent = total;
        end.querySelector('.rf-spine-sr').textContent = ', ' + total + '개';
      }
    }

    /* ---------- 분류 칩 ---------- */
    function renderCats() {
      const ts = terms();
      const seen = new Set();
      allSectors().forEach((s) => (s.items || []).forEach((it) => it.category && seen.add(it.category)));
      const cats = CATS.filter((c) => seen.has(c)).concat(Array.from(seen).filter((c) => !CATS.includes(c)));
      if (state.cat && !seen.has(state.cat)) state.cat = '';
      const inSec = allSectors().filter((s) => !state.sec || sid(s) === state.sec).flatMap((s) => s.items || []).filter((it) => matches(it, ts, ''));
      const chip = (val, label, n) => '<button type="button" class="chip rf-chip' + (n ? '' : ' zero') + '" data-cat="' + esc(val) + '" aria-pressed="' + (state.cat === val) + '">' + esc(label) + ' <span class="num">' + n + '</span></button>';
      catsBox.innerHTML = '<span class="rf-cats-l" aria-hidden="true">분류</span>' + chip('', '모두', inSec.length) + cats.map((c) => chip(c, c, inSec.filter((it) => it.category === c).length)).join('');
    }

    /* ---------- 카드함 ---------- */
    function render() {
      const ts = terms();
      const filtering = !!(ts.length || state.cat);
      const grid = state.layout === 'grid';
      if (state.sec && !secById(state.sec)) state.sec = ALL;
      let total = 0;
      let no = 0;
      const one = state.sec !== ALL;
      const secs = allSectors().filter((s) => !one || sid(s) === state.sec);
      const html = secs.map((s) => {
        const items = (s.items || []).filter((it) => matches(it, ts, state.cat));
        total += items.length;
        const isMine = s.id === MINE;
        if (!items.length && (filtering || !isMine)) return '';
        const id = sid(s);
        const open = filtering || one || state.open[id] !== false;
        const body = items.length
          ? '<div class="rf-items' + (grid ? ' is-grid' : '') + '">' + items.map((it) => (grid ? cardHtml(it, isMine, ts, ++no) : rowHtml(it, isMine, ts))).join('') + '</div>'
          : '<div class="rf-mine-empty"><span>직접 추가한 링크가 없습니다. 자주 여는 사이트를 카드로 꽂아 두세요.</span><button type="button" class="btn btn-sm" data-act="add">' + P.icons.plus + '추가</button></div>';
        if (one) return '<section class="rf-sec is-one" data-sid="' + esc(id) + '">' + body + '</section>';
        return '<section class="rf-sec' + (open ? '' : ' closed') + '" data-sid="' + esc(id) + '">' +
          '<button type="button" class="rf-sec-head" data-toggle="' + esc(id) + '" aria-expanded="' + open + '"' + (s.desc ? ' title="' + esc(tidy(s.desc)) + '"' : '') + '>' +
          '<span class="rf-guide"><span class="rf-chev" aria-hidden="true">' + P.icons.chevron + '</span><span class="rf-sec-title">' + esc(s.title || '분류 없음') + '</span><span class="rf-sec-n num">' + items.length + '</span></span>' +
          (s.desc ? '<span class="rf-sec-desc">' + esc(tidy(s.desc)) + '</span>' : '') + '</button>' +
          (open ? body : '') + '</section>';
      }).join('');
      list.innerHTML = html || '<div class="empty card rf-empty"><p>' + (filtering ? '이 서랍에는 찾는 카드가 없습니다.' : '레퍼런스가 아직 없습니다.') + '</p>' + (filtering ? '<button type="button" class="btn btn-sm" data-act="reset">조건 지우기</button>' : '') + '</div>';
      count.textContent = total + '개';
      // 서랍 앞 이름판
      const s = one ? secById(state.sec) : null;
      const label = s ? (s.id === MINE ? '내 레퍼런스' : (s.title || '분류 없음')) : '전체 서가';
      plate.innerHTML = '<span class="rf-plate-frame"><b>' + esc(label) + '</b><span class="num">' + total + '장</span></span>' +
        '<span class="rf-plate-desc">' + esc(s ? tidy(s.desc || '') : (filtering ? '찾은 카드만 꽂혀 있습니다.' : '모든 묶음의 카드를 차례로 꽂았습니다. 책등을 누르면 한 묶음만 봅니다.')) + '</span>' +
        (one ? '<button type="button" class="btn btn-sm btn-ghost rf-back" data-sec="">서가에 꽂기</button>' : '');
      drawer.setAttribute('aria-label', '색인 카드함: ' + label + ' ' + total + '장');
    }
    function refresh() {
      renderCats();
      syncShelf();
      render();
      if (loaded) {
        const nb = state.sectors.length;
        const nc = state.sectors.reduce((a, s) => a + (s.items || []).length, 0) + state.mine.length;
        heroN.textContent = (nb + 1) + '권 · 카드 ' + nc + '장';
      }
    }
    function pull(id) {
      if (id === state.sec && id !== ALL) id = ALL; // 빼 둔 책을 다시 누르면 꽂음
      state.sec = id;
      refresh();
      drawer.classList.remove('is-pull');
      void drawer.offsetWidth;
      drawer.classList.add('is-pull');
    }

    async function loadMine() {
      try {
        const rows = await P.store.list(COL);
        state.mine = rows.map((r) => Object.assign({}, r.data, { _id: r.id, source: (r.data && r.data.source) || '직접 추가' }));
      } catch (e) {
        state.mine = [];
      }
    }

    function editForm(item) {
      const it = item || {};
      const f = document.createElement('form');
      f.innerHTML =
        '<div class="field"><label for="refs-f-title">제목</label><input id="refs-f-title" name="title" required maxlength="120"></div>' +
        '<div class="field"><label for="refs-f-url">주소(URL)</label><input id="refs-f-url" name="url" type="url" placeholder="https://" required></div>' +
        '<div class="field"><label for="refs-f-cat">분류</label><select id="refs-f-cat" name="category">' + CATS.map((c) => '<option>' + esc(c) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label for="refs-f-note">왜 유용한지 <small class="muted">한 줄</small></label><input id="refs-f-note" name="note" maxlength="200"></div>' +
        '<div class="field"><label for="refs-f-tags">태그 <small class="muted">쉼표로 구분</small></label><input id="refs-f-tags" name="tags"></div>';
      const E = f.elements;
      E.title.value = it.title || '';
      E.url.value = it.url || '';
      E.category.value = CATS.includes(it.category) ? it.category : '기타';
      E.note.value = it.note || '';
      E.tags.value = (it.tags || []).join(', ');
      f.addEventListener('submit', (e) => e.preventDefault());
      P.ui.modal({
        title: item ? '레퍼런스 수정' : '내 레퍼런스 추가',
        body: f,
        actions: [{ label: '취소' }, { label: '저장', primary: true, onClick: async () => {
          const url = safeUrl(E.url.value);
          if (!E.title.value.trim()) { P.ui.toast('제목을 입력하세요.', 'warn'); return false; }
          if (!url) { P.ui.toast('주소는 http:// 또는 https:// 로 시작해야 합니다.', 'warn'); return false; }
          const data = {
            title: E.title.value.trim(), url, category: E.category.value, note: E.note.value.trim(),
            tags: E.tags.value.split(',').map((t) => t.trim()).filter(Boolean), source: '직접 추가'
          };
          try { await P.store.put(COL, it._id || P.store.uid(), data); } catch (e) { return false; }
          P.ui.toast('저장했습니다.', 'ok');
          await refreshMine();
          return true;
        } }]
      });
    }

    async function refreshMine() {
      await loadMine();
      if (!alive) return;
      if (loaded) buildShelf(); // 내 레퍼런스가 늘거나 줄면 책 두께가 바뀜
      refresh();
    }

    el.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t || !el.contains(t)) return;
      if (t.dataset.act === 'add') editForm(null);
      else if (t.dataset.act === 'reset') { state.q = ''; state.cat = ''; search.value = ''; refresh(); }
      else if (t.dataset.sec !== undefined) pull(t.dataset.sec);
      else if (t.dataset.cat !== undefined) { state.cat = state.cat === t.dataset.cat ? '' : t.dataset.cat; refresh(); }
      else if (t.dataset.layout) {
        state.layout = t.dataset.layout;
        P.settings.set('refs.layout', state.layout);
        el.querySelectorAll('[data-layout]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.layout === state.layout)));
        render();
      } else if (t.dataset.toggle !== undefined) {
        if (state.q.trim() || state.cat || state.sec) return;
        const id = t.dataset.toggle;
        state.open[id] = state.open[id] === false;
        P.settings.set('refs.open', state.open);
        render();
      } else if (t.dataset.edit) editForm(state.mine.find((x) => x._id === t.dataset.edit));
      else if (t.dataset.del) {
        const it = state.mine.find((x) => x._id === t.dataset.del);
        if (it && await P.ui.confirm('"' + (it.title || '') + '" 링크를 삭제할까요?', { danger: true, okLabel: '삭제' })) {
          try { await P.store.remove(COL, it._id); P.ui.toast('삭제했습니다.', 'ok'); await refreshMine(); } catch (err) { /* 토스트는 core가 표시 */ }
        }
      }
    });
    let timer = 0;
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.q = search.value; refresh(); }, 120);
    });
    search.addEventListener('keydown', (e) => { if (e.key === 'Escape' && search.value) { e.stopPropagation(); search.value = ''; state.q = ''; refresh(); } });

    Promise.all([fetchRefs(), loadMine()]).then(([sectors]) => {
      if (!alive) return;
      state.sectors = sectors;
      loaded = true;
      buildShelf();
      refresh();
      drawSources();
    });

    /* 머리 띠: 자료가 많이 나온 출처 사이트 순 (흐르는 띠, 누르면 그 사이트로 검색) */
    function drawSources() {
      const box = el.querySelector('.rf-sources');
      if (!box || !P.fx || !P.fx.marquee) return;
      const n = new Map();
      state.sectors.forEach((sec) => (sec.items || []).forEach((it) => {
        const u = safeUrl(it.url);
        const d = u ? domainOf(u) : '';
        if (d) n.set(d, (n.get(d) || 0) + 1);
      }));
      const items = Array.from(n.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([d, c]) => ({ label: d, meta: String(c), title: d + ' 자료 ' + c + '건 · 눌러서 검색' }));
      P.fx.marquee(box, items, { label: '출처 사이트 ' + items.length + '곳', cap: '출처', speed: 24, onPick: (it) => {
        search.value = it.label;
        state.q = it.label;
        refresh();
        search.focus();
      } });
    }

    return () => { alive = false; clearTimeout(timer); };
  }

  P.registerApp({ id: 'refs', title: '레퍼런스', short: '레퍼런스', icon: ICON, order: 7, desc: 'UI·문서·PT·엑셀·디자인 참고 자료 서가와 내 링크 모음', mount });
})();
