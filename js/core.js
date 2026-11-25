/* 공마일(0MILE) 공통 기반: 라우터, 앱 등록, 저장소(브라우저/클라우드/사무실 서버), UI 도구 */
(function () {
  'use strict';

  const VERSION = '1.0.0';
  const DEFAULT_TITLE = '공마일';
  const DEFAULT_SUBTITLE = '0MILE - 업무의 출발점 / 공무원이 마음껏 일할 수 있는 플랫폼';

  /* ---------- 작은 도구 ---------- */
  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  }
  function el(tag, attrs, html) {
    const node = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') node.className = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) node.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    if (html != null) node.innerHTML = html;
    return node;
  }
  function toJSON(data) {
    // 저장 전 JSON 직렬화 가능한 값으로 정규화
    return data === undefined ? null : JSON.parse(JSON.stringify(data));
  }
  function uid() {
    const t = Date.now().toString(36);
    let r = '';
    try {
      const a = new Uint8Array(8);
      crypto.getRandomValues(a);
      r = Array.from(a, (b) => (b % 36).toString(36)).join('');
    } catch (e) {
      r = Math.random().toString(36).slice(2, 10);
    }
    return t + r;
  }

  /* ---------- 아이콘 (24x24, stroke) ---------- */
  const svg = (d) => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const icons = {
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    local: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
    cloud: svg('<path d="M17.5 19H7a5 5 0 1 1 .9-9.9A6 6 0 0 1 19.5 11 4 4 0 0 1 17.5 19z"/>'),
    server: svg('<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>'),
    grid: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    check: svg('<path d="M5 12l5 5L20 7"/>'),
    chevron: svg('<path d="M6 9l6 6 6-6"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    external: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
    upload: svg('<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>'),
    edit: svg('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>'),
    trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    home: svg('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
    auto: svg('<circle cx="12" cy="12" r="8"/><path d="M12 4v16a8 8 0 0 0 0-16z" fill="currentColor"/>')
  };

  /* ---------- 설정 (기기별 localStorage) ---------- */
  const SKEY = 'P:';
  const memSettings = {};
  const settings = {
    get(key, def) {
      try {
        const raw = localStorage.getItem(SKEY + key);
        if (raw != null) return JSON.parse(raw);
      } catch (e) { /* 저장소 차단 시 메모리 값 사용 */ }
      return Object.prototype.hasOwnProperty.call(memSettings, key) ? memSettings[key] : def;
    },
    set(key, value) {
      memSettings[key] = value;
      try {
        if (value === undefined || value === null) localStorage.removeItem(SKEY + key);
        else localStorage.setItem(SKEY + key, JSON.stringify(value));
      } catch (e) { /* 무시 */ }
    }
  };

  /* ---------- UI: 토스트 · 모달 · 확인 ---------- */
  function toastBox() {
    let box = document.getElementById('p-toasts');
    if (!box) {
      box = el('div', { id: 'p-toasts', 'aria-live': 'polite' });
      document.body.appendChild(box);
    }
    return box;
  }
  function toast(msg, type) {
    const kind = ['ok', 'error', 'warn', 'info'].includes(type) ? type : 'info';
    const node = el('div', { class: 'p-toast p-toast-' + kind, role: kind === 'error' ? 'alert' : 'status' });
    const mark = kind === 'ok' ? icons.check : kind === 'error' ? icons.close : '';
    node.innerHTML = (mark ? '<span class="p-toast-ic">' + mark + '</span>' : '') + '<span>' + esc(msg) + '</span>';
    const close = () => {
      node.classList.add('out');
      setTimeout(() => node.remove(), 200);
    };
    node.addEventListener('click', close);
    toastBox().appendChild(node);
    setTimeout(close, kind === 'error' ? 6000 : 3200);
    return close;
  }

  const modalStack = [];
  function modal(opts) {
    const o = opts || {};
    const lastFocus = document.activeElement;
    const back = el('div', { class: 'p-modal-back' });
    const box = el('div', { class: 'p-modal' + (o.wide ? ' p-modal-wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || '대화상자' });
    const head = el('div', { class: 'p-modal-head' });
    head.appendChild(el('h2', null, esc(o.title || '')));
    const xBtn = el('button', { class: 'btn btn-ghost p-icon-btn', type: 'button', 'aria-label': '닫기' }, icons.close);
    head.appendChild(xBtn);
    const body = el('div', { class: 'p-modal-body' });
    if (o.body instanceof Node) body.appendChild(o.body);
    else if (o.body != null) body.innerHTML = o.body;
    box.appendChild(head);
    box.appendChild(body);

    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      const i = modalStack.indexOf(close);
      if (i >= 0) modalStack.splice(i, 1);
      back.classList.add('out');
      setTimeout(() => back.remove(), 160);
      if (typeof o.onClose === 'function') { try { o.onClose(); } catch (e) { console.error(e); } }
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* 무시 */ } }
    }

    const actions = o.actions || [];
    if (actions.length) {
      const foot = el('div', { class: 'p-modal-foot' });
      actions.forEach((a) => {
        const b = el('button', { type: 'button', class: 'btn ' + (a.danger ? 'btn-danger' : a.primary ? 'btn-primary' : 'btn-ghost') }, esc(a.label));
        b.addEventListener('click', async () => {
          let keep = false;
          if (typeof a.onClick === 'function') {
            b.disabled = true;
            try { keep = (await a.onClick(close)) === false; } catch (e) { console.error(e); keep = true; toast(e.message || '처리하지 못했습니다.', 'error'); }
            b.disabled = false;
          }
          if (!keep) close();
        });
        foot.appendChild(b);
      });
      box.appendChild(foot);
    }
    xBtn.addEventListener('click', close);
    back.addEventListener('mousedown', (e) => { if (e.target === back && o.dismissible !== false) close(); });
    back.appendChild(box);
    document.body.appendChild(back);
    modalStack.push(close);
    requestAnimationFrame(() => {
      const f = box.querySelector('[autofocus], input, select, textarea, .p-modal-foot .btn-primary') || xBtn;
      try { f.focus(); } catch (e) { /* 무시 */ }
    });
    close.element = box;
    close.body = body;
    return close;
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalStack.length) {
      e.preventDefault();
      modalStack[modalStack.length - 1]();
    }
  });

  function confirmDialog(msg, opts) {
    const o = opts || {};
    return new Promise((resolve) => {
      let result = false;
      modal({
        title: o.title || '확인',
        body: '<p class="p-modal-msg">' + esc(msg).replace(/\n/g, '<br>') + '</p>',
        onClose: () => resolve(result),
        actions: [
          { label: o.cancelLabel || '취소' },
          { label: o.okLabel || '확인', primary: !o.danger, danger: !!o.danger, onClick: () => { result = true; } }
        ]
      });
    });
  }
  function promptDialog(msg, def) {
    return new Promise((resolve) => {
      let result = null;
      const wrap = el('div', { class: 'field' });
      wrap.innerHTML = '<label>' + esc(msg) + '</label>';
      const input = el('input', { type: 'text', autofocus: true });
      input.value = def == null ? '' : String(def);
      wrap.appendChild(input);
      const close = modal({
        title: '입력',
        body: wrap,
        onClose: () => resolve(result),
        actions: [{ label: '취소' }, { label: '확인', primary: true, onClick: () => { result = input.value; } }]
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) { result = input.value; close(); }
      });
      setTimeout(() => input.select(), 30);
    });
  }
  function download(filename, data, mime) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: (mime || 'text/plain') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename || 'download' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* ---------- 스크립트 · 스타일 지연 로드 ---------- */
  const loaded = new Map();
  function loadScript(src) {
    if (!loaded.has(src)) {
      loaded.set(src, new Promise((resolve, reject) => {
        const s = el('script', { src });
        s.onload = () => resolve();
        s.onerror = () => { loaded.delete(src); s.remove(); reject(new Error('스크립트를 불러오지 못했습니다: ' + src)); };
        document.head.appendChild(s);
      }));
    }
    return loaded.get(src);
  }
  function loadCSS(href) {
    const key = 'css:' + href;
    if (!loaded.has(key)) {
      loaded.set(key, new Promise((resolve, reject) => {
        const l = el('link', { rel: 'stylesheet', href });
        l.onload = () => resolve();
        l.onerror = () => { loaded.delete(key); l.remove(); reject(new Error('스타일을 불러오지 못했습니다: ' + href)); };
        document.head.appendChild(l);
      }));
    }
    return loaded.get(key);
  }

  /* ---------- 저장소 백엔드 ---------- */
  const sortByUpdated = (a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0);

  function makeLocal() {
    const LS = 'P:item:';
    let dbPromise = null;
    function openDB() {
      if (!dbPromise) {
        dbPromise = new Promise((resolve) => {
          try {
            if (!window.indexedDB) return resolve(null);
            const req = indexedDB.open('platform-store', 1);
            req.onupgradeneeded = () => {
              const os = req.result.createObjectStore('items', { keyPath: 'k' });
              os.createIndex('col', 'col');
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
            req.onblocked = () => resolve(null);
          } catch (e) { resolve(null); }
        });
      }
      return dbPromise;
    }
    function run(mode, fn) {
      return openDB().then((db) => {
        if (!db) return undefined;
        return new Promise((resolve, reject) => {
          const tx = db.transaction('items', mode);
          const os = tx.objectStore('items');
          let out;
          fn(os, (v) => { out = v; });
          tx.oncomplete = () => resolve({ value: out });
          tx.onerror = () => reject(tx.error || new Error('브라우저 저장소 오류'));
          tx.onabort = () => reject(tx.error || new Error('브라우저 저장소 공간이 부족할 수 있습니다.'));
        });
      });
    }
    const key = (col, id) => col + '\u0001' + id;
    const lsKey = (col, id) => LS + encodeURIComponent(col) + ':' + encodeURIComponent(id);
    function lsAll() {
      const out = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || !k.startsWith(LS)) continue;
          const [c, id] = k.slice(LS.length).split(':').map(decodeURIComponent);
          const rec = JSON.parse(localStorage.getItem(k));
          out.push({ col: c, id, data: rec.data, updatedAt: rec.updatedAt });
        }
      } catch (e) { /* 무시 */ }
      return out;
    }
    function lsFail(e) {
      throw new Error(e && e.name === 'QuotaExceededError' ? '브라우저 저장 공간이 가득 찼습니다. 백업 후 오래된 항목을 지우세요.' : '브라우저 저장소를 사용할 수 없습니다(사생활 보호 모드인지 확인하세요).');
    }
    return {
      kind: 'local',
      async ping() { await openDB(); return true; },
      async get(col, id) {
        const r = await run('readonly', (os, set) => { const q = os.get(key(col, id)); q.onsuccess = () => set(q.result); });
        if (r) return r.value ? r.value.data : null;
        try { const raw = localStorage.getItem(lsKey(col, id)); return raw ? JSON.parse(raw).data : null; } catch (e) { return null; }
      },
      async put(col, id, data, updatedAt) {
        const rec = { k: key(col, id), col, id, data, updatedAt: updatedAt || new Date().toISOString() };
        const r = await run('readwrite', (os) => { os.put(rec); });
        if (r) return;
        try { localStorage.setItem(lsKey(col, id), JSON.stringify({ data, updatedAt: rec.updatedAt })); } catch (e) { lsFail(e); }
      },
      async list(col) {
        const r = await run('readonly', (os, set) => { const q = os.index('col').getAll(col); q.onsuccess = () => set(q.result); });
        const rows = r ? (r.value || []) : lsAll().filter((x) => x.col === col);
        return rows.map((x) => ({ id: x.id, data: x.data, updatedAt: x.updatedAt })).sort(sortByUpdated);
      },
      async remove(col, id) {
        const r = await run('readwrite', (os) => { os.delete(key(col, id)); });
        if (r) return;
        try { localStorage.removeItem(lsKey(col, id)); } catch (e) { /* 무시 */ }
      },
      async cols() {
        const r = await run('readonly', (os, set) => {
          const q = os.index('col').openKeyCursor(null, 'nextunique');
          const out = [];
          q.onsuccess = () => { const c = q.result; if (c) { out.push(c.key); c.continue(); } else set(out); };
        });
        if (r) return r.value || [];
        return Array.from(new Set(lsAll().map((x) => x.col)));
      }
    };
  }

  function netError(e, kind) {
    if (e && e.name === 'AbortError') return new Error('응답이 너무 늦습니다(15초 초과). 네트워크 상태를 확인하세요.');
    if (kind === 'server' && location.protocol === 'https:') {
      return new Error('사무실 서버에 연결할 수 없습니다. 보안(https) 주소로 연 화면에서는 http 서버에 접속이 막힐 수 있습니다. 사무실 서버 주소(http://…)로 플랫폼을 직접 여세요.');
    }
    return new Error(kind === 'server' ? '사무실 서버에 연결할 수 없습니다. 서버가 켜져 있는지, 주소·방화벽을 확인하세요.' : '클라우드에 연결할 수 없습니다. 인터넷 연결과 Supabase 주소를 확인하세요.');
  }
  async function httpCall(kind, url, init) {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 15000) : null;
    let res;
    try {
      res = await fetch(url, Object.assign({}, init, ctrl ? { signal: ctrl.signal } : {}));
    } catch (e) {
      throw netError(e, kind);
    } finally {
      if (timer) clearTimeout(timer);
    }
    const text = await res.text();
    let body = null;
    if (text) { try { body = JSON.parse(text); } catch (e) { body = text; } }
    if (!res.ok) {
      const detail = body && typeof body === 'object' ? (body.message || body.error || '') : '';
      let msg;
      if (res.status === 401 || res.status === 403) msg = kind === 'server' ? '사무실 서버 접속 키가 맞지 않습니다.' : 'Supabase 키 또는 작업공간 코드가 올바르지 않습니다.';
      else if (res.status === 404 && kind === 'supabase') msg = 'Supabase에 플랫폼 함수가 없습니다. server/supabase.sql 을 SQL Editor에서 실행했는지 확인하세요.';
      else if (res.status === 413) msg = '저장하려는 데이터가 너무 큽니다.';
      else msg = (kind === 'server' ? '사무실 서버' : '클라우드') + ' 오류(' + res.status + ')' + (detail ? ': ' + detail : '');
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return { status: res.status, body };
  }

  function makeSupabase(cfg) {
    const base = String(cfg.url || '').replace(/\/+$/, '');
    const key = String(cfg.key || '').trim();
    const ws = String(cfg.workspace || '').trim();
    const rpc = (name, args) => httpCall('supabase', base + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(Object.assign({ p_workspace: ws }, args))
    }).then((r) => r.body);
    return {
      kind: 'supabase',
      async ping() { await rpc('p_cols', {}); return true; },
      async get(col, id) { const v = await rpc('p_get', { p_col: col, p_id: id }); return v == null ? null : v; },
      async put(col, id, data) { await rpc('p_put', { p_col: col, p_id: id, p_data: data }); },
      async list(col) {
        const rows = (await rpc('p_list', { p_col: col })) || [];
        return rows.map((r) => ({ id: r.id, data: r.data, updatedAt: new Date(r.updated_at).toISOString() })).sort(sortByUpdated);
      },
      async remove(col, id) { await rpc('p_remove', { p_col: col, p_id: id }); },
      async cols() { return (await rpc('p_cols', {})) || []; }
    };
  }

  function serverBase(cfg) {
    const raw = String((cfg && cfg.url) || '').trim().replace(/\/+$/, '');
    if (raw) return /^https?:\/\//i.test(raw) ? raw : 'http://' + raw;
    return location.origin;
  }
  function makeServer(cfg) {
    const base = serverBase(cfg);
    const headers = { 'Content-Type': 'application/json' };
    if (cfg && cfg.key) headers['X-Platform-Key'] = String(cfg.key);
    const call = (method, path, body) => httpCall('server', base + '/api' + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body)
    }).then((r) => r.body);
    const p = (col, id) => '/items/' + encodeURIComponent(col) + (id == null ? '' : '/' + encodeURIComponent(id));
    return {
      kind: 'server',
      async ping() {
        const r = await call('GET', '/health');
        if (!r || r.app !== 'platform') throw new Error('입력한 주소는 플랫폼 사무실 서버가 아닙니다.');
        return true;
      },
      async get(col, id) {
        try { const r = await call('GET', p(col, id)); return r ? r.data : null; } catch (e) { if (e.status === 404) return null; throw e; }
      },
      async put(col, id, data) { await call('PUT', p(col, id), data); },
      async list(col) { return ((await call('GET', p(col))) || []).sort(sortByUpdated); },
      async remove(col, id) { await call('DELETE', p(col, id)); },
      async cols() { const r = await call('GET', '/items'); return (r && r.cols) || []; }
    };
  }

  const KINDS = {
    local: { label: '이 브라우저', short: '브라우저', icon: icons.local, desc: '설정 없이 바로 사용. 이 기기·브라우저에만 저장됩니다.' },
    supabase: { label: '클라우드(Supabase)', short: '클라우드', icon: icons.cloud, desc: '작업공간 코드로 부서원과 공유. 어디서든 이어서 작업.' },
    server: { label: '사무실 서버', short: '사무실 서버', icon: icons.server, desc: '내부망 PC에서 실행한 서버에 저장. 인터넷 없이 공유.' }
  };
  function backendConfig(kind) {
    if (kind === 'supabase') return settings.get('storage.supabase', null);
    if (kind === 'server') return settings.get('storage.server', null);
    return {};
  }
  function isConfigured(kind) {
    const c = backendConfig(kind);
    if (kind === 'supabase') return !!(c && c.url && c.key && c.workspace);
    if (kind === 'server') return !!c;
    return true;
  }
  function createBackend(kind, cfg) {
    const c = cfg || backendConfig(kind) || {};
    if (kind === 'supabase') return makeSupabase(c);
    if (kind === 'server') return makeServer(c);
    return makeLocal();
  }

  let active = null;
  let activeKind = 'local';
  let connState = 'ok'; // ok | error | checking
  const storeListeners = new Set();
  let lastErrToast = 0;

  function guard(promise) {
    return promise.then((v) => {
      if (connState === 'error') { connState = 'ok'; renderStorageButton(); }
      return v;
    }, (e) => {
      if (activeKind !== 'local' && !e.status) { connState = 'error'; renderStorageButton(); }
      if (Date.now() - lastErrToast > 5000) { lastErrToast = Date.now(); toast(e.message || '저장소 오류', 'error'); }
      throw e;
    });
  }
  function checkCol(col) {
    if (typeof col !== 'string' || !col) throw new Error('컬렉션 이름이 필요합니다.');
  }

  const store = {
    backend: () => activeKind,
    get(col, id) { checkCol(col); return guard(active.get(col, String(id))); },
    put(col, id, data) {
      checkCol(col);
      let clean;
      try { clean = toJSON(data); } catch (e) { return Promise.reject(new Error('저장할 수 없는 데이터 형식입니다.')); }
      return guard(active.put(col, String(id), clean));
    },
    list(col) { checkCol(col); return guard(active.list(col)); },
    remove(col, id) { checkCol(col); return guard(active.remove(col, String(id))); },
    uid,
    on(evt, fn) {
      if (evt !== 'change' || typeof fn !== 'function') return () => {};
      storeListeners.add(fn);
      const off = () => storeListeners.delete(fn);
      if (mounted) mounted.offs.push(off);
      return off;
    },
    collections() { return guard(active.cols()); }
  };

  async function copyAll(from, to, onProgress) {
    const cols = await from.cols();
    let total = 0;
    const batches = [];
    for (const c of cols) {
      const rows = await from.list(c);
      batches.push([c, rows]);
      total += rows.length;
    }
    let done = 0;
    for (const [c, rows] of batches) {
      // 오래된 것부터 넣어 최신 순서를 최대한 유지
      for (let i = rows.length - 1; i >= 0; i--) {
        await to.put(c, rows[i].id, rows[i].data, rows[i].updatedAt);
        done++;
        if (onProgress) onProgress(done, total);
      }
    }
    return total;
  }

  async function switchTo(kind) {
    if (!KINDS[kind]) return false;
    if (!isConfigured(kind)) {
      const ok = await openStorageConfig(kind);
      if (!ok) return false;
    }
    if (kind === activeKind && kind === 'local') return true;
    const next = createBackend(kind);
    const t = toast(KINDS[kind].label + '에 연결하는 중…', 'info');
    try {
      await next.ping();
    } catch (e) {
      t();
      toast('전환하지 못했습니다. ' + e.message + ' (이전 저장 위치를 그대로 사용합니다)', 'error');
      return false;
    }
    t();
    const choice = await new Promise((resolve) => {
      let r = 'cancel';
      modal({
        title: '저장 위치 전환',
        body: '<p class="p-modal-msg"><b>' + esc(KINDS[activeKind].label) + '</b> → <b>' + esc(KINDS[kind].label) + '</b><br>현재 데이터를 새 위치로 복사할까요?<br><span class="muted">같은 항목은 덮어씁니다. 복사하지 않으면 새 위치의 데이터만 보입니다.</span></p>',
        onClose: () => resolve(r),
        actions: [
          { label: '취소' },
          { label: '복사 없이 전환', onClick: () => { r = 'skip'; } },
          { label: '복사하고 전환', primary: true, onClick: () => { r = 'copy'; } }
        ]
      });
    });
    if (choice === 'cancel') return false;
    if (choice === 'copy') {
      const prog = toast('데이터 복사 준비 중…', 'info');
      try {
        const n = await copyAll(active, next, (d, tot) => {
          const node = document.querySelector('#p-toasts .p-toast:last-child span:last-child');
          if (node) node.textContent = '데이터 복사 중… ' + d + ' / ' + tot;
        });
        prog();
        toast(n + '개 항목을 복사했습니다.', 'ok');
      } catch (e) {
        prog();
        toast('복사 중 오류가 나서 전환을 취소했습니다. ' + e.message, 'error');
        return false;
      }
    }
    active = next;
    activeKind = kind;
    connState = 'ok';
    settings.set('storage.backend', kind);
    renderStorageButton();
    toast('저장 위치: ' + KINDS[kind].label, 'ok');
    emitStoreChange();
    return true;
  }

  function emitStoreChange() {
    const cur = current;
    unmountCurrent();
    storeListeners.forEach((fn) => { try { fn(activeKind); } catch (e) { console.error(e); } });
    if (cur) mountRoute();
  }

  /* ---------- 저장 위치 단추 · 메뉴 ---------- */
  function renderStorageButton() {
    const btn = document.getElementById('p-storage-btn');
    if (!btn) return;
    const k = KINDS[activeKind];
    btn.innerHTML = k.icon + '<span class="p-storage-label">' + esc(k.short) + '</span>' + icons.chevron.replace('width="20" height="20"', 'width="14" height="14"');
    btn.dataset.kind = activeKind;
    btn.dataset.state = connState;
    btn.title = '저장 위치: ' + k.label + (connState === 'error' ? ' (연결 오류)' : '') + ' — 눌러서 바꾸기';
    btn.setAttribute('aria-label', btn.title);
  }
  let popClose = null;
  function openStorageMenu() {
    if (popClose) { popClose(); return; }
    const btn = document.getElementById('p-storage-btn');
    const pop = el('div', { class: 'p-pop', role: 'menu', 'aria-label': '저장 위치 선택' });
    pop.innerHTML = '<div class="p-pop-title">저장 위치</div>' + Object.keys(KINDS).map((k) => {
      const kk = KINDS[k];
      const cur = k === activeKind;
      const needs = !isConfigured(k);
      return '<button type="button" role="menuitemradio" aria-checked="' + cur + '" class="p-pop-item' + (cur ? ' active' : '') + '" data-kind="' + k + '">' +
        '<span class="p-pop-ic">' + kk.icon + '</span><span class="p-pop-txt"><b>' + esc(kk.label) + (needs ? ' <em>설정 필요</em>' : '') + '</b><small>' + esc(kk.desc) + '</small></span>' +
        (cur ? '<span class="p-pop-check">' + icons.check + '</span>' : '') + '</button>';
    }).join('') + '<button type="button" class="p-pop-foot" data-act="settings">' + icons.gear + '저장 위치 설정 · 백업</button>';
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect();
    const w = Math.min(320, window.innerWidth - 16);
    pop.style.width = w + 'px';
    pop.style.top = (r.bottom + 6) + 'px';
    pop.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
    btn.setAttribute('aria-expanded', 'true');
    const onDoc = (e) => { if (!pop.contains(e.target) && !btn.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') { close(); btn.focus(); } };
    function close() {
      pop.remove();
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      popClose = null;
    }
    popClose = close;
    setTimeout(() => {
      document.addEventListener('mousedown', onDoc);
      document.addEventListener('keydown', onKey);
      window.addEventListener('resize', close);
    });
    pop.addEventListener('click', (e) => {
      const it = e.target.closest('[data-kind],[data-act]');
      if (!it) return;
      close();
      if (it.dataset.act === 'settings') openSettings('storage');
      else if (it.dataset.kind !== activeKind) switchTo(it.dataset.kind);
      else if (it.dataset.kind !== 'local') openStorageConfig(it.dataset.kind);
    });
    const first = pop.querySelector('.p-pop-item.active') || pop.querySelector('.p-pop-item');
    if (first) first.focus();
  }

  /* ---------- 저장 위치 설정 창 ---------- */
  function openStorageConfig(kind) {
    return new Promise((resolve) => {
      let saved = false;
      const isSb = kind === 'supabase';
      const c = backendConfig(kind) || {};
      const f = el('form', { class: 'p-form', autocomplete: 'off' });
      if (isSb) {
        f.innerHTML =
          '<p class="muted p-form-help">Supabase(무료 클라우드 DB)에 프로젝트를 만들고 <b>SQL Editor</b>에서 저장소의 <code>server/supabase.sql</code> 을 한 번 실행하세요. 같은 작업공간 코드를 쓰는 사람끼리 데이터를 함께 봅니다. 부서원이 이미 설정했다면 <b>받은 연결 정보 넣기</b>로 한 번에 채울 수 있습니다.</p>' +
          '<div class="field"><label for="p-sb-url">Supabase URL</label><input id="p-sb-url" name="url" type="url" placeholder="https://xxxx.supabase.co" required></div>' +
          '<div class="field"><label for="p-sb-key">anon(공개) 키</label><input id="p-sb-key" name="key" type="text" spellcheck="false" placeholder="eyJ… 또는 sb_publishable_…" required></div>' +
          '<div class="field"><label for="p-sb-ws">작업공간 코드 <small class="muted">부서끼리 공유하는 비밀 코드, 8자 이상</small></label><input id="p-sb-ws" name="workspace" type="text" spellcheck="false" minlength="8" required></div>';
        f.url.value = c.url || '';
        f.key.value = c.key || '';
        f.workspace.value = c.workspace || '';
      } else {
        f.innerHTML =
          '<p class="muted p-form-help">사무실 PC에서 <code>python server/local_server.py 8787</code> 을 실행한 뒤 그 주소를 적으세요. 비워 두면 지금 열린 주소를 서버로 씁니다(서버 주소로 플랫폼을 열었을 때).</p>' +
          '<div class="field"><label for="p-sv-url">서버 주소</label><input id="p-sv-url" name="url" type="text" spellcheck="false" placeholder="예: http://192.168.0.10:8787"></div>' +
          '<div class="field"><label for="p-sv-key">접속 키 <small class="muted">서버를 --key 로 실행한 경우만</small></label><input id="p-sv-key" name="key" type="text" spellcheck="false"></div>';
        f.url.value = c.url || '';
        f.key.value = c.key || '';
      }
      const tools = el('div', { class: 'p-form-tools' });
      tools.innerHTML = (isSb
        ? '<a class="btn btn-sm btn-ghost" href="server/supabase.sql" target="_blank" rel="noopener noreferrer">SQL 파일 보기</a>' +
          '<a class="btn btn-sm btn-ghost" href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">Supabase 열기</a>'
        : '<a class="btn btn-sm btn-ghost" href="server/local_server.py" download>서버 파일 받기</a>') +
        '<button type="button" class="btn btn-sm btn-ghost" data-act="share">연결 정보 복사</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-act="join">받은 연결 정보 넣기</button>';
      f.appendChild(tools);
      const SHARE_TAG = '공마일-연결:';
      tools.querySelector('[data-act="share"]').addEventListener('click', async () => {
        const v = read();
        const bad = validate(v);
        if (bad) { status.className = 'p-form-status err'; status.textContent = bad; return; }
        const text = SHARE_TAG + kind + ':' + btoa(unescape(encodeURIComponent(JSON.stringify(v))));
        try { await navigator.clipboard.writeText(text); toast('연결 정보를 복사했습니다. 부서원에게 메신저로 보내 주세요.', 'ok'); }
        catch (e) { promptDialog('아래 글을 복사해 부서원에게 보내 주세요.', text); }
      });
      tools.querySelector('[data-act="join"]').addEventListener('click', async () => {
        const raw = await promptDialog('부서원에게 받은 연결 정보(' + SHARE_TAG + '…)를 붙여넣으세요.', '');
        if (raw == null) return;
        const m = new RegExp('^\\s*' + SHARE_TAG + '(\\w+):([A-Za-z0-9+/=]+)\\s*$').exec(raw);
        let v = null;
        try { v = m && m[1] === kind ? JSON.parse(decodeURIComponent(escape(atob(m[2])))) : null; } catch (e) { v = null; }
        if (!v || typeof v !== 'object') {
          status.className = 'p-form-status err';
          status.textContent = m && m[1] !== kind ? '다른 저장 위치(' + (KINDS[m[1]] ? KINDS[m[1]].label : m[1]) + ')의 연결 정보입니다.' : '연결 정보 형식이 아닙니다. 받은 글 전체를 그대로 붙여넣으세요.';
          return;
        }
        ['url', 'key', 'workspace'].forEach((k) => { if (f[k] && typeof v[k] === 'string') f[k].value = v[k]; });
        status.className = 'p-form-status'; status.textContent = '채웠습니다. [저장]을 누르면 연결을 확인합니다.';
      });
      const status = el('p', { class: 'p-form-status', role: 'status' });
      f.appendChild(status);
      function read() {
        if (isSb) {
          return { url: f.url.value.trim().replace(/\/+$/, ''), key: f.key.value.trim(), workspace: f.workspace.value.trim() };
        }
        return { url: f.url.value.trim(), key: f.key.value.trim() };
      }
      function validate(v) {
        if (isSb) {
          if (!/^https:\/\/.+/i.test(v.url)) return 'Supabase URL은 https:// 로 시작해야 합니다.';
          if (!v.key) return 'anon 키를 입력하세요.';
          if (v.workspace.length < 8) return '작업공간 코드는 8자 이상으로 정하세요.';
        } else if (!v.url && location.protocol === 'file:') {
          return '서버 주소를 입력하세요.';
        }
        return '';
      }
      async function test() {
        const v = read();
        const bad = validate(v);
        if (bad) { status.className = 'p-form-status err'; status.textContent = bad; return false; }
        status.className = 'p-form-status'; status.textContent = '연결 확인 중…';
        try {
          await createBackend(kind, v).ping();
          status.className = 'p-form-status ok'; status.textContent = '연결되었습니다.';
          return v;
        } catch (e) {
          status.className = 'p-form-status err'; status.textContent = e.message;
          return false;
        }
      }
      f.addEventListener('submit', (e) => e.preventDefault());
      modal({
        title: KINDS[kind].label + ' 설정',
        body: f,
        onClose: () => resolve(saved),
        actions: [
          { label: '취소' },
          { label: '연결 테스트', onClick: async () => { await test(); return false; } },
          { label: '저장', primary: true, onClick: async () => {
            const v = await test();
            if (!v) return false;
            settings.set('storage.' + kind, v);
            saved = true;
            if (kind === activeKind) { active = createBackend(kind); connState = 'ok'; renderStorageButton(); emitStoreChange(); }
            return true;
          } }
        ]
      });
    });
  }

  /* ---------- 백업 ---------- */
  async function exportBackup() {
    const t = toast('백업 파일을 만드는 중…', 'info');
    try {
      const cols = await active.cols();
      const items = {};
      let n = 0;
      for (const c of cols) { items[c] = await active.list(c); n += items[c].length; }
      const payload = { format: 'platform-backup', version: VERSION, exportedAt: new Date().toISOString(), backend: activeKind, items };
      const d = new Date();
      const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
      download('platform-backup-' + stamp + '.json', JSON.stringify(payload, null, 1), 'application/json');
      t();
      toast(n + '개 항목을 백업했습니다.', 'ok');
    } catch (e) {
      t();
      toast('백업하지 못했습니다. ' + e.message, 'error');
    }
  }
  function importBackup() {
    const input = el('input', { type: 'file', accept: '.json,application/json' });
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      let data;
      try { data = JSON.parse(await file.text()); } catch (e) { toast('JSON 파일을 읽지 못했습니다.', 'error'); return; }
      if (!data || data.format !== 'platform-backup' || typeof data.items !== 'object') { toast('플랫폼 백업 파일이 아닙니다.', 'error'); return; }
      const cols = Object.keys(data.items);
      const total = cols.reduce((s, c) => s + (Array.isArray(data.items[c]) ? data.items[c].length : 0), 0);
      const ok = await confirmDialog('현재 저장 위치(' + KINDS[activeKind].label + ')에 ' + total + '개 항목을 가져옵니다.\n같은 항목은 백업 내용으로 덮어씁니다.', { okLabel: '가져오기' });
      if (!ok) return;
      try {
        for (const c of cols) {
          const rows = Array.isArray(data.items[c]) ? data.items[c] : [];
          for (let i = rows.length - 1; i >= 0; i--) {
            if (rows[i] && rows[i].id != null) await active.put(c, String(rows[i].id), toJSON(rows[i].data), rows[i].updatedAt);
          }
        }
        toast(total + '개 항목을 가져왔습니다.', 'ok');
        emitStoreChange();
      } catch (e) {
        toast('가져오는 중 오류: ' + e.message, 'error');
      }
    });
    input.click();
  }

  /* ---------- 브랜드 · 테마 ---------- */
  function brand() {
    const title = settings.get('title', '') || DEFAULT_TITLE;
    const subtitle = settings.get('subtitle', null);
    const logo = settings.get('logo', '') || (title === DEFAULT_TITLE ? '0' : Array.from(title.trim())[0]) || '0';
    return { title, subtitle: subtitle == null ? DEFAULT_SUBTITLE : subtitle, logo: Array.from(logo).slice(0, 2).join('') };
  }
  function applyBrand() {
    const b = brand();
    const t = document.getElementById('p-title');
    const s = document.getElementById('p-subtitle');
    const l = document.getElementById('p-logo');
    if (t) t.textContent = b.title;
    if (s) { s.textContent = b.subtitle; s.hidden = !b.subtitle; }
    if (l) { l.textContent = b.logo; l.dataset.len = Array.from(b.logo).length; }
    updateDocTitle();
  }
  function applyTheme() {
    const th = settings.get('theme', 'auto');
    if (th === 'light' || th === 'dark') document.documentElement.setAttribute('data-theme', th);
    else document.documentElement.removeAttribute('data-theme');
    const dark = th === 'dark' || (th !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0f1420' : '#ffffff');
  }

  /* ---------- 설정 창 ---------- */
  function openSettings(section) {
    const b = brand();
    const th = settings.get('theme', 'auto');
    const wrap = el('div', { class: 'p-settings' });
    wrap.innerHTML =
      '<section id="p-set-brand"><h3>기본 정보</h3>' +
      '<div class="field"><label for="p-set-title">플랫폼 제목</label><input id="p-set-title" maxlength="40" placeholder="' + esc(DEFAULT_TITLE) + '" value="' + esc(settings.get('title', '')) + '"></div>' +
      '<div class="field"><label for="p-set-sub">부제</label><input id="p-set-sub" maxlength="80" value="' + esc(b.subtitle) + '"></div>' +
      '<div class="field"><label for="p-set-logo">로고 글자 <small class="muted">1~2자, 비우면 제목 첫 글자</small></label><input id="p-set-logo" maxlength="2" value="' + esc(settings.get('logo', '')) + '"></div>' +
      '</section>' +
      '<section><h3>화면</h3><div class="p-seg" role="radiogroup" aria-label="테마">' +
      [['light', '밝게', icons.sun], ['dark', '어둡게', icons.moon], ['auto', '자동', icons.auto]].map(([v, l, ic]) =>
        '<button type="button" role="radio" aria-checked="' + (th === v) + '" data-theme-val="' + v + '">' + ic + l + '</button>').join('') +
      '</div></section>' +
      '<section id="p-set-storage"><h3>저장 위치</h3><div class="p-set-kinds">' +
      Object.keys(KINDS).map((k) => '<div class="p-set-kind' + (k === activeKind ? ' active' : '') + '"><span class="p-pop-ic">' + KINDS[k].icon + '</span><div><b>' + esc(KINDS[k].label) + (k === activeKind ? ' <span class="chip">사용 중</span>' : '') + '</b><small class="muted">' + esc(KINDS[k].desc) + '</small></div>' +
        '<div class="p-set-kind-btns">' + (k !== 'local' ? '<button type="button" class="btn btn-ghost btn-sm" data-cfg="' + k + '">설정</button>' : '') +
        (k !== activeKind ? '<button type="button" class="btn btn-sm" data-use="' + k + '">전환</button>' : '') + '</div></div>').join('') +
      '</div></section>' +
      '<section><h3>데이터 백업</h3><p class="muted">현재 저장 위치의 모든 데이터를 JSON 파일로 내보내거나 다시 가져옵니다.</p><div class="toolbar">' +
      '<button type="button" class="btn" data-act="export">' + icons.download + '백업 내보내기</button>' +
      '<button type="button" class="btn" data-act="import">' + icons.upload + '백업 가져오기</button></div></section>' +
      '<p class="muted p-set-ver">버전 ' + esc(VERSION) + ' · <a href="#/changelog">업데이트 기록</a></p>';
    const close = modal({
      title: '설정',
      body: wrap,
      wide: true,
      actions: [{ label: '닫기' }, { label: '저장', primary: true, onClick: () => {
        settings.set('title', wrap.querySelector('#p-set-title').value.trim());
        settings.set('subtitle', wrap.querySelector('#p-set-sub').value.trim());
        settings.set('logo', wrap.querySelector('#p-set-logo').value.trim());
        applyBrand();
        if (current && current.app.id === 'home') { unmountCurrent(); mountRoute(); }
        toast('설정을 저장했습니다.', 'ok');
      } }]
    });
    wrap.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.themeVal) {
        settings.set('theme', t.dataset.themeVal);
        applyTheme();
        wrap.querySelectorAll('[data-theme-val]').forEach((x) => x.setAttribute('aria-checked', String(x === t)));
      } else if (t.dataset.cfg) {
        openStorageConfig(t.dataset.cfg);
      } else if (t.dataset.use) {
        close();
        switchTo(t.dataset.use);
      } else if (t.dataset.act === 'export') exportBackup();
      else if (t.dataset.act === 'import') { close(); importBackup(); }
    });
    if (section === 'storage') setTimeout(() => { const s = wrap.querySelector('#p-set-storage'); if (s) s.scrollIntoView({ block: 'start' }); }, 50);
  }

  /* ---------- 앱 등록 · 라우터 ---------- */
  const apps = new Map();
  let current = null; // { app, cleanup }
  let mounted = null; // { offs: [] } 현재 마운트 범위의 리스너
  let booted = false;
  let navTimer = null;

  function registerApp(def) {
    if (!def || !def.id || typeof def.mount !== 'function') {
      console.error('registerApp: id와 mount가 필요합니다.', def);
      return;
    }
    apps.set(def.id, Object.assign({ title: def.id, short: def.title || def.id, icon: icons.grid, order: 50, desc: '' }, def));
    if (booted) {
      clearTimeout(navTimer);
      navTimer = setTimeout(() => {
        renderNav();
        const id = parseHash().id;
        if (apps.has(id) && (!current || current.app.id !== id)) mountRoute();
      }, 0);
    }
  }
  function appList() {
    return Array.from(apps.values()).sort((a, b) => (a.order - b.order) || String(a.title).localeCompare(String(b.title), 'ko'));
  }
  function parseHash() {
    const raw = (location.hash || '').replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch (e) { return s; } });
    return { id: parts[0] || 'home', params: parts.slice(1) };
  }
  function navigate(path) {
    const p = String(path || '').replace(/^#?\/?/, '');
    const target = '#/' + p;
    if (location.hash === target) mountRoute(); else location.hash = target;
  }
  function updateDocTitle() {
    const b = brand();
    document.title = current && current.app.id !== 'home' ? current.app.title + ' · ' + b.title : b.title;
  }
  function unmountCurrent() {
    if (mounted) { mounted.offs.forEach((off) => off()); mounted = null; }
    if (current && typeof current.cleanup === 'function') {
      try { current.cleanup(); } catch (e) { console.error(e); }
    }
    current = null;
  }
  function mountRoute() {
    const view = document.getElementById('view');
    if (!view) return;
    const { id, params } = parseHash();
    const app = apps.get(id);
    unmountCurrent();
    view.innerHTML = '';
    view.scrollTop = 0;
    view.dataset.app = id;
    markActive(id);
    if (!app) {
      view.innerHTML = '<div class="page"><div class="empty card"><h2>준비 중인 화면입니다</h2><p>요청한 화면(' + esc(id) + ')을 찾을 수 없습니다.</p><a class="btn btn-primary" href="#/home">홈으로</a></div></div>';
      document.title = brand().title;
      return;
    }
    if (app.shared && activeKind === 'local' && !settings.get('hint.shared.off', false)) view.appendChild(sharedHint());
    const root = el('div', { class: 'p-app p-app-' + id });
    view.appendChild(root);
    const entry = { app, cleanup: null };
    current = entry;
    mounted = { offs: [] };
    updateDocTitle();
    const ctx = { params, navigate };
    let res;
    try {
      res = app.mount(root, ctx);
    } catch (e) {
      console.error(e);
      root.innerHTML = errorCard(app, e);
      return;
    }
    if (res && typeof res.then === 'function') {
      res.then((fn) => {
        if (typeof fn !== 'function') return;
        if (current === entry) entry.cleanup = fn; else { try { fn(); } catch (e) { console.error(e); } }
      }, (e) => { console.error(e); if (current === entry) root.innerHTML = errorCard(app, e); });
    } else if (typeof res === 'function') entry.cleanup = res;
  }
  /* 함께 보는 앱(shared: true)을 '이 브라우저' 저장으로 쓸 때 안내 */
  function sharedHint() {
    const box = el('div', { class: 'p-share-hint', role: 'note' });
    box.innerHTML = '<span class="p-share-hint-ic">' + icons.local + '</span>' +
      '<p><b>지금은 이 브라우저에만 저장됩니다.</b> 부서원과 함께 보려면 저장 위치를 클라우드나 사무실 서버로 바꾸세요.</p>' +
      '<button type="button" class="btn btn-sm" data-act="switch">저장 위치 바꾸기</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-act="off">다시 보지 않기</button>';
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'switch') openStorageMenu();
      else { settings.set('hint.shared.off', true); box.remove(); }
    });
    return box;
  }
  function errorCard(app, e) {
    return '<div class="page"><div class="empty card"><h2>' + esc(app.title) + ' 화면을 여는 중 문제가 생겼습니다</h2><p class="muted">' + esc(e && e.message) + '</p><button class="btn btn-primary" type="button" onclick="location.reload()">새로고침</button></div></div>';
  }

  /* ---------- 탐색 표시 ---------- */
  function renderNav() {
    const list = appList();
    const tabs = document.getElementById('p-tabs');
    if (tabs) {
      tabs.innerHTML = list.map((a) => '<a class="p-tab" href="#/' + esc(a.id) + '" data-app="' + esc(a.id) + '">' + '<span class="p-tab-ic">' + (a.icon || '') + '</span><span>' + esc(a.short || a.title) + '</span></a>').join('');
    }
    const bottom = document.getElementById('p-bottom');
    if (bottom) {
      const quick = list.slice(0, 4);
      bottom.innerHTML = quick.map((a) => '<a class="p-bt" href="#/' + esc(a.id) + '" data-app="' + esc(a.id) + '"><span class="p-tab-ic">' + (a.icon || '') + '</span><span>' + esc(a.short || a.title) + '</span></a>').join('') +
        '<button type="button" class="p-bt" id="p-all-btn" aria-haspopup="dialog"><span class="p-tab-ic">' + icons.grid + '</span><span>전체</span></button>';
      bottom.querySelector('#p-all-btn').addEventListener('click', openAllApps);
    }
    markActive(parseHash().id);
  }
  function markActive(id) {
    document.querySelectorAll('.p-tab, .p-bt[data-app]').forEach((a) => {
      if (a.dataset.app === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const all = document.getElementById('p-all-btn');
    if (all) {
      const inQuick = !!document.querySelector('.p-bt[data-app="' + CSS.escape(id) + '"]');
      all.classList.toggle('active', !inQuick && apps.has(id));
    }
    const act = document.querySelector('.p-tab[aria-current="page"]');
    if (act && act.scrollIntoView) {
      const bar = act.parentElement;
      const l = act.offsetLeft - bar.clientWidth / 2 + act.clientWidth / 2;
      bar.scrollTo({ left: Math.max(0, l), behavior: 'smooth' });
    }
  }
  function openAllApps() {
    const g = el('div', { class: 'p-allapps' });
    g.innerHTML = appList().map((a) => '<a href="#/' + esc(a.id) + '" class="p-allapp"><span class="p-allapp-ic">' + (a.icon || '') + '</span><span>' + esc(a.title) + '</span></a>').join('');
    const close = modal({ title: '전체 메뉴', body: g });
    g.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  }

  /* ---------- 시작 ---------- */
  function boot() {
    booted = true;
    applyTheme();
    applyBrand();
    const saved = settings.get('storage.backend', 'local');
    activeKind = KINDS[saved] && isConfigured(saved) ? saved : 'local';
    active = createBackend(activeKind);
    renderStorageButton();
    const sbtn = document.getElementById('p-storage-btn');
    if (sbtn) sbtn.addEventListener('click', openStorageMenu);
    const gbtn = document.getElementById('p-settings-btn');
    if (gbtn) gbtn.addEventListener('click', () => openSettings());
    renderNav();
    mountRoute();
    window.addEventListener('hashchange', mountRoute);
    if (window.matchMedia) {
      const mq = matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', applyTheme);
    }
    if (activeKind !== 'local') {
      connState = 'checking';
      renderStorageButton();
      active.ping().then(() => { connState = 'ok'; renderStorageButton(); }, (e) => {
        connState = 'error';
        renderStorageButton();
        toast(KINDS[activeKind].label + ' 연결 실패: ' + e.message + ' 저장 위치 단추에서 다른 위치로 바꿀 수 있습니다.', 'error');
      });
    }
  }

  window.P = {
    version: VERSION,
    registerApp,
    store,
    settings: { get: settings.get, set: settings.set },
    ui: { toast, confirm: confirmDialog, prompt: promptDialog, modal, download },
    loadScript,
    loadCSS,
    esc,
    // 추가 도구(선택)
    apps: appList,
    navigate,
    icons,
    brand,
    storage: { kinds: KINDS, switchTo, openMenu: openStorageMenu, configure: openStorageConfig, exportBackup, importBackup, openSettings }
  };

  // defer 로 실행되므로 DOMContentLoaded 는 모든 앱 스크립트 실행 뒤에 온다.
  if (document.readyState === 'complete') setTimeout(boot, 0);
  else document.addEventListener('DOMContentLoaded', boot);
})();
