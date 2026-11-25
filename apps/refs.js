/* 레퍼런스 모음: data/references.json 섹터 + 내 레퍼런스(store 'refs-user') */
(function () {
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/></svg>';
  const COL = 'refs-user';
  const MINE = '__mine';
  const CATS = ['UI/UX', 'PT', '문서', '엑셀', '디자인', '공공AI', '기타'];
  const esc = (s) => P.esc(s);
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '');

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

  function itemHtml(it, mine) {
    const url = safeUrl(it.url);
    const tags = Array.isArray(it.tags) ? it.tags : [];
    return '<article class="refs-item' + (mine ? ' refs-mine' : '') + '">' +
      '<div class="refs-item-head">' +
      (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(it.title || url) + P.icons.external + '</a>' : '<b>' + esc(it.title || '제목 없음') + '</b>') +
      (mine ? '<span class="refs-item-acts"><button type="button" class="btn btn-ghost" data-edit="' + esc(it._id) + '" aria-label="수정">' + P.icons.edit + '</button><button type="button" class="btn btn-ghost" data-del="' + esc(it._id) + '" aria-label="삭제">' + P.icons.trash + '</button></span>' : '') +
      '</div>' +
      (it.note ? '<p>' + esc(it.note) + '</p>' : '') +
      '<div class="refs-item-meta">' +
      (it.source ? '<span class="refs-src">' + esc(it.source) + '</span>' : '') +
      (it.category ? '<span class="chip">' + esc(it.category) + '</span>' : '') +
      tags.slice(0, 5).map((t) => '<span class="refs-tag">#' + esc(t) + '</span>').join(' ') +
      '</div></article>';
  }

  function matches(it, q, cat) {
    if (cat && it.category !== cat) return false;
    if (!q) return true;
    const hay = [it.title, it.note, it.source, it.category, it.url].concat(it.tags || []).join(' ').toLowerCase();
    return q.split(/\s+/).every((w) => hay.includes(w));
  }

  function mount(el) {
    const state = { sectors: [], mine: [], q: '', cat: '', open: P.settings.get('refs.open', {}) };
    let alive = true;

    el.innerHTML =
      '<div class="page">' +
      '<div class="page-head"><div><h1>레퍼런스 모음</h1><p>업무 품질을 높이는 자료·디자인·도구 링크를 분류별로 모았습니다.</p></div>' +
      '<button type="button" class="btn btn-primary" data-act="add">' + P.icons.plus + '내 레퍼런스 추가</button></div>' +
      '<div class="refs-tools">' +
      '<label class="p-search">' + P.icons.search + '<span class="sr-only">검색</span><input type="search" placeholder="제목·설명·태그 검색"></label>' +
      '<span class="refs-count" aria-live="polite"></span></div>' +
      '<div class="chips refs-cats" role="group" aria-label="분류 필터" style="margin-bottom:16px"></div>' +
      '<div class="refs-list"><div class="empty">불러오는 중…</div></div>' +
      '</div>';
    const list = el.querySelector('.refs-list');
    const catsBox = el.querySelector('.refs-cats');
    const count = el.querySelector('.refs-count');
    const search = el.querySelector('input[type="search"]');

    function allSectors() {
      const mineSector = { id: MINE, title: '내 레퍼런스', desc: '직접 추가한 링크 — 현재 저장 위치에 저장됩니다.', items: state.mine };
      return [mineSector].concat(state.sectors);
    }

    function renderCats() {
      const seen = new Set();
      allSectors().forEach((s) => (s.items || []).forEach((it) => it.category && seen.add(it.category)));
      const cats = CATS.filter((c) => seen.has(c)).concat(Array.from(seen).filter((c) => !CATS.includes(c)));
      if (state.cat && !seen.has(state.cat)) state.cat = '';
      catsBox.innerHTML = ['', ...cats].map((c) => '<button type="button" class="chip" aria-pressed="' + (state.cat === c) + '" data-cat="' + esc(c) + '">' + esc(c || '전체') + '</button>').join('');
    }

    function render() {
      const q = state.q.trim().toLowerCase();
      const filtering = !!(q || state.cat);
      let total = 0;
      let collected = 0;
      const parts = allSectors().map((s) => {
        const items = (s.items || []).filter((it) => matches(it, q, state.cat));
        total += items.length;
        const isMine = s.id === MINE;
        if (!isMine) collected += items.length;
        if (!items.length && (filtering || !isMine)) return '';
        const sid = String(s.id || s.title);
        const open = filtering || state.open[sid] !== false;
        return '<details class="card refs-sector" data-sid="' + esc(sid) + '"' + (open ? ' open' : '') + '>' +
          '<summary><span class="refs-sector-title"><b>' + esc(s.title || '분류 없음') + '</b>' + (s.desc ? '<small>' + esc(s.desc) + '</small>' : '') + '</span>' +
          '<span class="refs-badge">' + items.length + '</span><span class="refs-chev">' + P.icons.chevron + '</span></summary>' +
          (items.length ? '<div class="refs-items">' + items.map((it) => itemHtml(it, isMine)).join('') + '</div>'
            : '<div class="empty" style="padding:4px 18px 22px">아직 추가한 링크가 없습니다. 오른쪽 위 <b>내 레퍼런스 추가</b>를 눌러 보세요.</div>') +
          '</details>';
      });
      const rest = parts.slice(1).join('');
      const html = parts[0] + (rest ? '<div class="refs-group"><h2>수집한 레퍼런스</h2><span class="muted">' + collected + '개 · 이전 작업에서 다시 모은 자료와 이번에 새로 모은 자료를 분류별로 담았습니다. 링크를 누르면 새 창으로 열립니다.</span></div>' + rest : '');
      list.innerHTML = html || '<div class="card empty"><h3>' + (filtering ? '검색 결과가 없습니다' : '레퍼런스가 아직 없습니다') + '</h3><p>' + (filtering ? '다른 검색어나 분류를 골라 보세요.' : '자료가 준비되면 이곳에 표시됩니다.') + '</p></div>';
      count.textContent = total + '개';
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
      renderCats();
      render();
    }

    el.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.act === 'add') editForm(null);
      else if (t.dataset.cat !== undefined) { state.cat = t.dataset.cat; renderCats(); render(); }
      else if (t.dataset.edit) editForm(state.mine.find((x) => x._id === t.dataset.edit));
      else if (t.dataset.del) {
        const it = state.mine.find((x) => x._id === t.dataset.del);
        if (it && await P.ui.confirm('"' + (it.title || '') + '" 링크를 삭제할까요?', { danger: true, okLabel: '삭제' })) {
          try { await P.store.remove(COL, it._id); P.ui.toast('삭제했습니다.', 'ok'); await refreshMine(); } catch (err) { /* 토스트는 core가 표시 */ }
        }
      }
    });
    list.addEventListener('toggle', (e) => {
      const d = e.target;
      if (!d.matches || !d.matches('details[data-sid]') || state.q || state.cat) return;
      state.open[d.dataset.sid] = d.open;
      P.settings.set('refs.open', state.open);
    }, true);
    let timer = 0;
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.q = search.value; render(); }, 120);
    });

    Promise.all([fetchRefs(), loadMine()]).then(([sectors]) => {
      if (!alive) return;
      state.sectors = sectors;
      renderCats();
      render();
    });

    return () => { alive = false; clearTimeout(timer); };
  }

  P.registerApp({ id: 'refs', title: '레퍼런스', short: '레퍼런스', icon: ICON, order: 7, desc: 'UI·문서·PT·엑셀·디자인 참고 자료 저장소와 내 링크 모음', mount });
})();
