var CACHE='atena-crm-v1';
var PRECACHE=[
  'https://cdn.jsdelivr.net/npm/vazirmatn@33.003.0/Vazirmatn-font-face.css',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(PRECACHE.map(function(u){return new Request(u,{mode:'no-cors'});})).catch(function(){});}));
  self.skipWaiting();
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));}));
  self.clients.claim();
});
self.addEventListener('fetch',function(e){
  var url=e.request.url;
  if(url.indexOf('cdn.jsdelivr.net')!==-1||url.indexOf('cdnjs.cloudflare.com')!==-1){
    e.respondWith(caches.match(e.request).then(function(cached){
      return cached||fetch(e.request).then(function(r){
        var rc=r.clone();caches.open(CACHE).then(function(c){c.put(e.request,rc);});return r;
      }).catch(function(){return cached||new Response('',{status:503});});
    }));
  }
});
