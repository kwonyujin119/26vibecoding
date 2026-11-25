/* 레퍼런스: data/references.json 묶음 + 내 레퍼런스(store 'refs-user') — 왼쪽 모음·분류, 오른쪽 목록/격자 */
(function () {
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/></svg>';
  const IC_LIST = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
  const IC_GRID = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></svg>';
  const COL = 'refs-user';
  const MINE = '__mine';
  const CATS = ['UI/UX', 'PT', '문서', '엑셀', '디자인', '공공AI', '기타'];
  const TINTS = ['#4C63B6', '#13897B', '#B7791F', '#7C5CC4', '#C0497A', '#2F86B5', '#5E8F32', '#8A6A4E', '#5B6B7F', '#3F7F9F'];
  const esc = (s) => P.esc(s);
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '');
  const tidy = (s) => String(s || '').replace(/\s*—\s*/g, ' · ');
  function domainOf(u) {
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }
  function tintOf(s) {
    let h = 0;
    for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return TINTS[h % TINTS.length];
  }
  /* 검색어 강조: 글자를 이스케이프한 뒤 태그 밖에서만 <mark> */
  function hl(text, ts) {
    const out = esc(text);
    if (!ts.length) return out;
    const re = new RegExp('(' + ts.map((t) => esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
    return out.replace(/(<[^>]*>)|([^<]+)/g, (m, tag, txt) => tag || txt.replace(re, '<mark>$1</mark>'));
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

  function itemHtml(it, mine, ts) {
    const url = safeUrl(it.url);
    const dom = url ? domainOf(url) : '';
    const tags = Array.isArray(it.tags) ? it.tags : [];
    const mono = (dom.match(/[a-z0-9]/i) || [it.title ? Array.from(String(it.title))[0] : '?'])[0].toUpperCase();
    return '<article class="rf-row' + (mine ? ' rf-mine' : '') + '">' +
      '<span class="rf-mono" style="--c:' + tintOf(dom || it.title) + '" aria-hidden="true">' + esc(mono) + '</span>' +
      '<div class="rf-row-main">' +
      (url ? '<a class="rf-title" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer"' + (it.source ? ' title="출처: ' + esc(it.source) + '"' : '') + '>' + hl(tidy(it.title) || url, ts) + '</a>' : '<b class="rf-title">' + hl(it.title || '제목 없음', ts) + '</b>') +
      (it.note ? '<p class="rf-note">' + hl(tidy(it.note), ts) + '</p>' : '') +
      '<div class="rf-meta">' +
      (dom ? '<span class="rf-domain">' + hl(dom, ts) + '</span>' : '') +
      (it.category ? '<span class="rf-cat">' + hl(it.category, ts) + '</span>' : '') +
      tags.slice(0, 4).map((t) => '<span class="rf-tag">#' + hl(t, ts) + '</span>').join('') +
      '</div></div>' +
      (mine ? '<span class="rf-acts"><button type="button" class="btn btn-ghost btn-sm p-icon-btn" data-edit="' + esc(it._id) + '" aria-label="수정" title="수정">' + P.icons.edit + '</button><button type="button" class="btn btn-ghost btn-sm p-icon-btn" data-del="' + esc(it._id) + '" aria-label="삭제" title="삭제">' + P.icons.trash + '</button></span>' : '') +
      (url ? '<span class="rf-go" aria-hidden="true">' + P.icons.external + '</span>' : '') +
      '</article>';
  }

  function matches(it, ts, cat) {
    if (cat && it.category !== cat) return false;
    if (!ts.length) return true;
    const hay = [it.title, it.note, it.source, it.category, it.url].concat(it.tags || []).join(' ').toLowerCase();
    return ts.every((w) => hay.includes(w));
  }

  function mount(el) {
    const state = { sectors: [], mine: [], q: '', cat: '', sec: '', layout: P.settings.get('refs.layout', 'list'), open: P.settings.get('refs.open', {}) };
    let alive = true;

    el.innerHTML =
      '<div class="page rf-page">' +
      '<div class="page-head"><div><h1>레퍼런스</h1></div>' +
      '<button type="button" class="btn btn-primary" data-act="add">' + P.icons.plus + '추가</button></div>' +
      '<div class="rf-layout">' +
      '<nav class="rf-side" aria-label="레퍼런스 모음"><div class="rf-side-group rf-secs"></div><div class="rf-side-group rf-cats"></div></nav>' +
      '<div class="rf-main">' +
      '<div class="rf-tools">' +
      '<label class="p-search rf-search">' + P.icons.search + '<span class="sr-only">검색</span><input type="search" placeholder="제목·설명·태그·사이트 검색"></label>' +
      '<span class="rf-count num" aria-live="polite"></span>' +
      '<div class="seg rf-layout-seg" role="radiogroup" aria-label="보기">' +
      '<button type="button" role="radio" data-layout="list" aria-label="목록" title="목록" aria-checked="' + (state.layout !== 'grid') + '">' + IC_LIST + '</button>' +
      '<button type="button" role="radio" data-layout="grid" aria-label="격자" title="격자" aria-checked="' + (state.layout === 'grid') + '">' + IC_GRID + '</button></div>' +
      '</div>' +
      '<div class="rf-list"><div class="empty">불러오는 중…</div></div>' +
      '</div></div></div>';
    const list = el.querySelector('.rf-list');
    const secsBox = el.querySelector('.rf-secs');
    const catsBox = el.querySelector('.rf-cats');
    const count = el.querySelector('.rf-count');
    const search = el.querySelector('input[type="search"]');
    const terms = () => state.q.trim().toLowerCase().split(/\s+/).filter(Boolean);

    function allSectors() {
      const mineSector = { id: MINE, title: '내 레퍼런스', desc: '직접 추가한 링크. 지금 저장 위치에 저장됩니다.', items: state.mine };
      return [mineSector].concat(state.sectors);
    }
    const sid = (s) => String(s.id || s.title);

    function renderSide() {
      const ts = terms();
      const seen = new Set();
      allSectors().forEach((s) => (s.items || []).forEach((it) => it.category && seen.add(it.category)));
      const cats = CATS.filter((c) => seen.has(c)).concat(Array.from(seen).filter((c) => !CATS.includes(c)));
      if (state.cat && !seen.has(state.cat)) state.cat = '';
      if (state.sec && !allSectors().some((s) => sid(s) === state.sec)) state.sec = '';
      const nSec = (s) => (s.items || []).filter((it) => matches(it, ts, state.cat)).length;
      const total = allSectors().reduce((a, s) => a + nSec(s), 0);
      const nav = (attr, val, label, n, cur) => '<button type="button" class="rf-nav' + (n ? '' : ' zero') + '" ' + attr + '="' + esc(val) + '"' + (cur ? ' aria-current="true"' : '') + '><span class="rf-nav-l">' + esc(label) + '</span><span class="rf-nav-n num">' + n + '</span></button>';
      secsBox.innerHTML = '<h2 class="rf-side-title">모음</h2>' + nav('data-sec', '', '전체', total, !state.sec) +
        allSectors().map((s) => nav('data-sec', sid(s), s.title || '분류 없음', nSec(s), state.sec === sid(s))).join('');
      const inSec = allSectors().filter((s) => !state.sec || sid(s) === state.sec).flatMap((s) => s.items || []).filter((it) => matches(it, ts, ''));
      catsBox.innerHTML = '<h2 class="rf-side-title">분류</h2>' + nav('data-cat', '', '모든 분류', inSec.length, !state.cat) +
        cats.map((c) => nav('data-cat', c, c, inSec.filter((it) => it.category === c).length, state.cat === c)).join('');
    }

    function render() {
      const ts = terms();
      const filtering = !!(ts.length || state.cat);
      let total = 0;
      const grid = state.layout === 'grid';
      const html = allSectors().filter((s) => !state.sec || sid(s) === state.sec).map((s) => {
        const items = (s.items || []).filter((it) => matches(it, ts, state.cat));
        total += items.length;
        const isMine = s.id === MINE;
        if (!items.length && (filtering || !isMine)) return '';
        const id = sid(s);
        const open = filtering || !!state.sec || state.open[id] !== false;
        return '<section class="rf-sec' + (open ? '' : ' closed') + '" data-sid="' + esc(id) + '">' +
          '<button type="button" class="rf-sec-head" data-toggle="' + esc(id) + '" aria-expanded="' + open + '"' + (s.desc ? ' title="' + esc(tidy(s.desc)) + '"' : '') + '>' +
          '<span class="rf-chev" aria-hidden="true">' + P.icons.chevron + '</span><span class="rf-sec-title">' + esc(s.title || '분류 없음') + '</span><span class="rf-sec-n num">' + items.length + '</span>' +
          (s.desc ? '<span class="rf-sec-desc">' + esc(tidy(s.desc)) + '</span>' : '') + '</button>' +
          (open ? (items.length ? '<div class="rf-items' + (grid ? ' is-grid' : '') + '">' + items.map((it) => itemHtml(it, isMine, ts)).join('') + '</div>'
            : '<div class="rf-mine-empty"><span>직접 추가한 링크가 없습니다.</span><button type="button" class="btn btn-sm" data-act="add">' + P.icons.plus + '추가</button></div>') : '') +
          '</section>';
      }).join('');
      list.innerHTML = html || '<div class="empty card"><p>' + (filtering ? '검색 결과가 없습니다.' : '레퍼런스가 아직 없습니다.') + '</p>' + (filtering ? '<button type="button" class="btn btn-sm" data-act="reset">조건 지우기</button>' : '') + '</div>';
      count.textContent = total + '개';
    }
    const refresh = () => { renderSide(); render(); };

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
      refresh();
    }

    el.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.act === 'add') editForm(null);
      else if (t.dataset.act === 'reset') { state.q = ''; state.cat = ''; search.value = ''; refresh(); }
      else if (t.dataset.sec !== undefined) { state.sec = t.dataset.sec; refresh(); el.querySelector('.rf-main').scrollIntoView({ block: 'nearest' }); }
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
      refresh();
    });

    return () => { alive = false; clearTimeout(timer); };
  }

  P.registerApp({ id: 'refs', title: '레퍼런스', short: '레퍼런스', icon: ICON, order: 7, desc: 'UI·문서·PT·엑셀·디자인 참고 자료 저장소와 내 링크 모음', mount });
})();
