const CACHE='bill-reminder-personal-shell-v5';
const FILES=['./','./index.html','./app.js','./core.js','./style.css','./icon.svg','./manifest.webmanifest','./reminder-core.js','./reminders.js','./unlock.js','./locked-bills.js'];
const allowed=new Set(FILES.map(p=>new URL(p,self.registration.scope).href));
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const k of await caches.keys())if((k.startsWith('bill-reminder-independent-shell-')||k.startsWith('bill-reminder-personal-shell-'))&&k!==CACHE)await caches.delete(k);await self.clients.claim();})());});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||!allowed.has(event.request.url))return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(event.request,copy)));}return response;}).catch(()=>caches.match(event.request)));});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const tabs=await self.clients.matchAll({type:'window'});const own=tabs.find(t=>t.url.startsWith(self.registration.scope));return own?own.focus():self.clients.openWindow(self.registration.scope);})());});
