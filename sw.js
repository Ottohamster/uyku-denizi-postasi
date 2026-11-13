/* Uyku Denizi Postası - servis çalışanı.
   Sayfalar ve sayı listesi: önce ağ (hep son sayı gelsin), ağ yoksa önbellek (çevrimdışı okuma).
   Yazı tipleri ve simgeler: önce önbellek. */
var SURUM = "udp-v1";
var KABUK = ["./", "index.html", "uygulama.js", "manifest.webmanifest", "sayilar.json",
             "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(SURUM).then(function (c) { return c.addAll(KABUK); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== SURUM; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function onceAg(istek) {
  return fetch(istek).then(function (y) {
    if (y && y.ok) { var k = y.clone(); caches.open(SURUM).then(function (c) { c.put(istek, k); }); }
    return y;
  }).catch(function () {
    return caches.match(istek, { ignoreSearch: true }).then(function (y) { return y || caches.match("index.html"); });
  });
}

function onceOnbellek(istek) {
  return caches.match(istek).then(function (y) {
    return y || fetch(istek).then(function (a) {
      if (a && (a.ok || a.type === "opaque")) { var k = a.clone(); caches.open(SURUM).then(function (c) { c.put(istek, k); }); }
      return a;
    });
  });
}

self.addEventListener("fetch", function (e) {
  var istek = e.request;
  if (istek.method !== "GET") return;
  var u = new URL(istek.url);
  if (u.origin === location.origin) {
    if (/\.pdf$/i.test(u.pathname)) return;            // PDF'ler önbelleğe alınmaz (büyük)
    if (/\/icons\//.test(u.pathname)) { e.respondWith(onceOnbellek(istek)); return; }
    e.respondWith(onceAg(istek));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(onceOnbellek(istek));
  }
});
