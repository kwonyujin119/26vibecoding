/* 공마일 서비스 워커: 앱 설치 조건용. 캐시하지 않고 항상 네트워크에서 받음(업데이트가 바로 반영됨) */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
