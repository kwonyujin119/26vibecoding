/* 이어하기: 마지막으로 연 작업과 그 안의 자리(문서 스크롤·글자 위치, PT 슬라이드, 엑셀 시트·셀, 차트 파일)를 기억
   P.resume.save(app, id, state)  앱이 자리가 바뀔 때 부름 (가볍게, 기기별 설정에 저장)
   P.resume.take(app, id)         이어하기로 열었을 때만 그 자리를 돌려줌(한 번)
   P.resume.last()                마지막 작업 { app, id, state, at }
   P.resume.open(rec)             그 작업을 그 자리로 다시 열기 (없으면 마지막 작업)
   주소(#/docs/<id> 등)를 지켜보다가 연 작업을 자동으로 기록하므로 앱은 자리만 알려 주면 됨 */
(function () {
  'use strict';
  if (!window.P) return;
  const KEY = 'resume.v1';
  const APPS = ['docs', 'slides', 'sheets', 'charts'];
  const MAX = 40;
  let pending = null;

  function load() {
    const v = P.settings.get(KEY, null);
    return v && typeof v === 'object' && v.items && typeof v.items === 'object' ? v : { last: null, items: {} };
  }
  function store(v) {
    const keys = Object.keys(v.items);
    if (keys.length > MAX) {
      keys.sort((a, b) => String(v.items[b].at).localeCompare(String(v.items[a].at))).slice(MAX).forEach((k) => { delete v.items[k]; });
    }
    P.settings.set(KEY, v);
  }
  const key = (app, id) => app + ':' + id;
  function save(app, id, state) {
    if (!APPS.includes(app) || id == null || id === '') return;
    const v = load();
    const k = key(app, String(id));
    const at = new Date().toISOString();
    v.items[k] = Object.assign({}, v.items[k] || {}, state || {}, { app, id: String(id), at });
    v.last = { app, id: String(id), at };
    store(v);
  }
  function get(app, id) {
    const it = load().items[key(app, String(id))];
    return it ? Object.assign({}, it) : null;
  }
  function last() {
    const v = load();
    if (!v.last) return null;
    const it = v.items[key(v.last.app, v.last.id)];
    return it ? { app: it.app, id: it.id, state: it, at: it.at } : null;
  }
  function list() {
    const v = load();
    return Object.keys(v.items).map((k) => v.items[k]).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }
  function take(app, id) {
    if (!pending || pending.app !== app || pending.id !== String(id)) return null;
    pending = null;
    return get(app, id);
  }
  function open(rec) {
    const r = rec && rec.app ? rec : last();
    if (!r) { P.ui.toast('이어서 할 작업이 아직 없습니다. 문서·PT·엑셀·차트를 열면 기억합니다.', 'info'); return false; }
    pending = { app: r.app, id: String(r.id) };
    setTimeout(() => { pending = null; }, 15000);
    P.navigate(r.app + '/' + encodeURIComponent(r.id));
    return true;
  }
  function forget(app, id) {
    const v = load();
    delete v.items[key(app, String(id))];
    if (v.last && v.last.app === app && v.last.id === String(id)) v.last = null;
    store(v);
  }
  /* 주소로 연 작업 기록: #/docs/<id> · #/slides/<id> · #/sheets/<id> · #/charts/<id> */
  function onRoute() {
    const raw = (location.hash || '').replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch (e) { return s; } });
    const app = parts[0];
    const pid = parts[1];
    if (!APPS.includes(app) || !pid || pid === 'f' || pid === 'new') return;
    save(app, pid, {});
  }
  window.addEventListener('hashchange', onRoute);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onRoute); else onRoute();

  /* 단축키는 두지 않음: Ctrl+Shift+R(강력 새로 고침)은 브라우저 몫. 홈 단추와 Ctrl+K '이어하기'로 연다 */

  P.resume = { save, get, last, list, take, open, forget, apps: APPS.slice() };
})();
