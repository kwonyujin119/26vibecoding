/* 공마일 앱 설치 단추: 누르면 바로 설치. 이미 설치돼 있으면 숨김 */
(function () {
  'use strict';
  const ua = navigator.userAgent || '';
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isKakao = /KAKAOTALK/i.test(ua);
  const isInApp = isKakao || /NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(ua);
  const isAndroid = /Android/i.test(ua);
  let deferred = null;
  let btn = null;

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; show(); });
  addEventListener('appinstalled', () => { deferred = null; hide(); toast('설치했습니다. 홈 화면이나 바탕화면에서 공마일을 여세요.', 'ok'); });

  function toast(msg, type) { if (window.P && P.ui && P.ui.toast) P.ui.toast(msg, type || 'info'); }
  function hide() { if (btn) btn.hidden = true; }
  function show() { if (btn && !isStandalone()) btn.hidden = false; }

  function openExternal() {
    const url = location.href;
    if (isKakao) { location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url); return; }
    if (isAndroid) { location.href = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;end'; return; }
    toast('오른쪽 아래 메뉴에서 "Safari로 열기"를 누른 뒤 다시 설치하세요.');
  }

  function iosGuide() {
    const share = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8"/></svg>';
    const body = document.createElement('div');
    body.className = 'p-install-ios';
    body.innerHTML = '<ol><li>' + share + ' 공유 단추</li><li><b>홈 화면에 추가</b></li></ol>';
    if (window.P && P.ui && P.ui.modal) P.ui.modal({ title: '공마일 설치', body, actions: [{ label: '확인', primary: true }] });
  }

  async function install() {
    if (deferred) {
      const ev = deferred; deferred = null;
      ev.prompt();
      const r = await ev.userChoice.catch(() => null);
      if (!r || r.outcome !== 'accepted') btn.hidden = false;
      return;
    }
    if (isInApp) return openExternal();
    if (isIOS) return iosGuide();
    btn.setAttribute('aria-busy', 'true');
    const got = await new Promise((res) => {
      const t = setTimeout(() => res(false), 2500);
      addEventListener('beforeinstallprompt', () => { clearTimeout(t); res(true); }, { once: true });
    });
    btn.removeAttribute('aria-busy');
    if (got && deferred) return install();
    toast('주소창 오른쪽의 설치 아이콘(또는 브라우저 메뉴의 "앱 설치")을 눌러 주세요.');
  }

  function mount() {
    if (isStandalone()) return;
    const header = document.querySelector('.p-header');
    if (!header) return;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'p-install-btn';
    btn.className = 'p-install-btn';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/></svg><span>앱 설치</span>';
    btn.addEventListener('click', install);
    header.insertBefore(btn, document.getElementById('p-top-actions'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
