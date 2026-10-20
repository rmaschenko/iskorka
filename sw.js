'use strict';
var DB = 'k', ST = 'k', KEY = null;
var TYPES = {html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',json:'application/json',webmanifest:'application/manifest+json',png:'image/png',svg:'image/svg+xml',mp3:'audio/mpeg',woff2:'font/woff2',txt:'text/plain; charset=utf-8',md:'text/plain; charset=utf-8'};
function idb(mode, fn){return new Promise(function(res,rej){var r=indexedDB.open(DB,1);r.onupgradeneeded=function(){r.result.createObjectStore(ST);};r.onsuccess=function(){var tx=r.result.transaction(ST,mode);var q=fn(tx.objectStore(ST));tx.oncomplete=function(){res(q&&q.result);};tx.onerror=function(){rej(tx.error);};};r.onerror=function(){rej(r.error);};});}
function b64(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
function load(){if(KEY)return Promise.resolve(KEY);return idb('readonly',function(s){return s.get('k');}).then(function(raw){if(!raw)return null;return Promise.all([crypto.subtle.importKey('raw',raw,{name:'HMAC',hash:'SHA-256'},false,['sign']),crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt'])]).then(function(k){KEY={h:k[0],a:k[1]};return KEY;});});}
function hex(buf){return Array.prototype.map.call(new Uint8Array(buf),function(x){return('0'+x.toString(16)).slice(-2);}).join('');}
function nf(){return new Response('Not found',{status:404,headers:{'Content-Type':'text/plain'}});}
self.addEventListener('install',function(){self.skipWaiting();});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.map(function(n){return caches.delete(n);}));}).then(function(){return self.clients.claim();}));});
self.addEventListener('message',function(e){if(!e.data||e.data.t!=='k')return;var raw=b64(e.data.k);KEY=null;e.waitUntil(idb('readwrite',function(s){return s.put(raw,'k');}).then(load).then(function(){if(e.ports[0])e.ports[0].postMessage('ok');}));});
self.addEventListener('fetch',function(e){
  var base=self.registration.scope, app=base+'app/', u=new URL(e.request.url);
  if(u.origin!==location.origin||u.href.indexOf(app)!==0)return;
  var rel=decodeURIComponent(u.pathname.slice(new URL(app).pathname.length));
  if(rel===''||rel.slice(-1)==='/')rel+='index.html';
  e.respondWith(load().then(function(k){
    if(!k)return nf();
    return crypto.subtle.sign('HMAC',k.h,new TextEncoder().encode(rel)).then(function(sig){
      return fetch(base+'d/'+hex(sig).slice(0,32)+'.bin').then(function(r){
        if(!r.ok)return nf();
        return r.arrayBuffer().then(function(b){
          return crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(b,0,12)},k.a,new Uint8Array(b,12)).then(function(p){
            var ext=(rel.split('.').pop()||'').toLowerCase();
            return new Response(p,{status:200,headers:{'Content-Type':TYPES[ext]||'application/octet-stream','Cache-Control':'no-store'}});
          });
        });
      });
    });
  }).catch(function(){return nf();}));
});
