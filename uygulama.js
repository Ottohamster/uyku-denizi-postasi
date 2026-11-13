/* Uyku Denizi Postası - uygulama katmanı.
   Her sayı sayfasına eklenir: sağ altta "Arşiv" düğmesi, geçmiş sayılar çekmecesi,
   daha yeni bir sayı çıktıysa haber şeridi ve çevrimdışı destek kaydı. */
(function () {
  "use strict";
  var KOK = new URL("..", location.href).href;          // sayilar/ klasörünün bir üstü
  if ("serviceWorker" in navigator) { navigator.serviceWorker.register(KOK + "sw.js", { scope: KOK }).catch(function () {}); }

  var css = "" +
    ".udp-fab{position:fixed;right:calc(14px + env(safe-area-inset-right));bottom:calc(14px + env(safe-area-inset-bottom));z-index:9000;" +
    "display:flex;align-items:center;gap:8px;padding:11px 16px;border:2px solid #2a2018;border-radius:999px;background:#9b2d20;color:#f6ead0;" +
    "font:700 15px/1 Georgia,'Times New Roman',serif;letter-spacing:.04em;box-shadow:0 4px 14px rgba(42,32,24,.35);cursor:pointer;-webkit-tap-highlight-color:transparent}" +
    ".udp-fab:active{transform:translateY(1px)}" +
    ".udp-ort{position:fixed;inset:0;z-index:9001;background:rgba(42,32,24,.5);opacity:0;pointer-events:none;transition:opacity .25s}" +
    ".udp-ort.acik{opacity:1;pointer-events:auto}" +
    ".udp-cek{position:fixed;left:0;right:0;bottom:0;z-index:9002;max-height:82vh;display:flex;flex-direction:column;background:#e9dcbf;color:#2a2018;" +
    "border-top:3px double #2a2018;border-radius:16px 16px 0 0;box-shadow:0 -8px 30px rgba(42,32,24,.4);transform:translateY(105%);transition:transform .3s ease;" +
    "font-family:Georgia,'Times New Roman',serif;padding-bottom:env(safe-area-inset-bottom)}" +
    ".udp-cek.acik{transform:none}" +
    ".udp-bas{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px 10px;border-bottom:1px solid rgba(42,32,24,.35)}" +
    ".udp-bas h2{margin:0;font:400 1.5rem/1.1 'Pirata One',Georgia,serif}" +
    ".udp-kapat{border:1px solid #2a2018;background:transparent;color:#2a2018;border-radius:999px;width:36px;height:36px;font-size:18px;cursor:pointer}" +
    ".udp-lis{list-style:none;margin:0;padding:6px 10px 14px;overflow-y:auto;-webkit-overflow-scrolling:touch}" +
    ".udp-lis li{display:flex;align-items:stretch;gap:8px;border-bottom:1px dashed rgba(42,32,24,.3)}" +
    ".udp-lis a.udp-s{flex:1;min-width:0;display:block;padding:12px 8px;color:inherit;text-decoration:none}" +
    ".udp-lis .udp-no{font:700 .78rem/1 'Special Elite','Courier New',monospace;letter-spacing:.08em;text-transform:uppercase;color:#9b2d20}" +
    ".udp-lis .udp-m{display:block;margin-top:4px;font-weight:700;font-size:1rem;line-height:1.25}" +
    ".udp-lis .udp-k{display:block;margin-top:3px;font-size:.84rem;color:#5a4a38;line-height:1.3}" +
    ".udp-lis li.simdi{background:rgba(31,78,95,.12)}" +
    ".udp-lis a.udp-pdf{align-self:center;flex:none;padding:8px 10px;border:1px solid #1f4e5f;border-radius:6px;color:#1f4e5f;text-decoration:none;font:700 .75rem/1 'Special Elite','Courier New',monospace}" +
    ".udp-yeni{position:fixed;left:50%;top:calc(10px + env(safe-area-inset-top));transform:translateX(-50%);z-index:9000;max-width:92vw;padding:10px 16px;border:2px solid #2a2018;" +
    "border-radius:999px;background:#1f4e5f;color:#f6ead0;font:700 14px/1.2 Georgia,serif;text-decoration:none;box-shadow:0 4px 14px rgba(42,32,24,.35)}" +
    "@media (min-width:720px){.udp-cek{left:auto;right:18px;bottom:18px;width:420px;border:2px solid #2a2018;border-radius:14px}}" +
    "@media (prefers-reduced-motion:reduce){.udp-cek,.udp-ort{transition:none}}" +
    "@media print{.udp-fab,.udp-ort,.udp-cek,.udp-yeni{display:none!important}}";

  function el(etiket, sinif, metin) { var e = document.createElement(etiket); if (sinif) e.className = sinif; if (metin != null) e.textContent = metin; return e; }

  function kur(veri) {
    var sayilar = (veri.sayilar || []).slice().sort(function (a, b) { return b.sayi - a.sayi; });
    if (!sayilar.length) return;
    var buDosya = location.pathname.split("/").pop();
    var simdiki = null;
    sayilar.forEach(function (s) { if (s.html.split("/").pop() === buDosya) simdiki = s; });

    var st = el("style"); st.textContent = css; document.head.appendChild(st);
    var fab = el("button", "udp-fab", "☰ Arşiv"); fab.type = "button"; fab.setAttribute("aria-haspopup", "dialog");
    var ort = el("div", "udp-ort");
    var cek = el("div", "udp-cek"); cek.setAttribute("role", "dialog"); cek.setAttribute("aria-modal", "true"); cek.setAttribute("aria-label", "Geçmiş sayılar");
    var bas = el("div", "udp-bas"); bas.appendChild(el("h2", null, "Geçmiş Sayılar"));
    var kapat = el("button", "udp-kapat", "✕"); kapat.type = "button"; kapat.setAttribute("aria-label", "Kapat"); bas.appendChild(kapat);
    var lis = el("ul", "udp-lis");
    sayilar.forEach(function (s, i) {
      var li = el("li"); if (simdiki && s.sayi === simdiki.sayi) li.className = "simdi";
      var a = el("a", "udp-s"); a.href = KOK + s.html;
      a.appendChild(el("span", "udp-no", "Sayı " + s.sayi + " · " + (s.tarih_yazi || s.tarih || "") + (i === 0 ? " · son sayı" : "")));
      a.appendChild(el("span", "udp-m", s.manset || "Uyku Denizi Postası"));
      var k = [];
      if (s.konu) k.push("Konu: " + s.konu);
      if (s.yogun_bakim) k.push("YB: " + s.yogun_bakim);
      if (s.algoloji) k.push("Ağrı: " + s.algoloji);
      if (k.length) a.appendChild(el("span", "udp-k", k.join(" · ")));
      li.appendChild(a);
      if (s.pdf) { var p = el("a", "udp-pdf", "PDF"); p.href = KOK + s.pdf; p.target = "_blank"; p.rel = "noopener"; p.setAttribute("aria-label", "Sayı " + s.sayi + " PDF"); li.appendChild(p); }
      lis.appendChild(li);
    });
    cek.appendChild(bas); cek.appendChild(lis);
    document.body.appendChild(fab); document.body.appendChild(ort); document.body.appendChild(cek);

    function ac() { ort.classList.add("acik"); cek.classList.add("acik"); kapat.focus(); }
    function kapa() { ort.classList.remove("acik"); cek.classList.remove("acik"); fab.focus(); }
    fab.addEventListener("click", ac); kapat.addEventListener("click", kapa); ort.addEventListener("click", kapa);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") kapa(); });

    if (simdiki && sayilar[0].sayi > simdiki.sayi && !/[?&]arsiv=1/.test(location.search) && document.referrer.indexOf(KOK) !== 0) {
      var y = el("a", "udp-yeni", "Yeni sayı çıktı: Sayı " + sayilar[0].sayi + " →"); y.href = KOK + sayilar[0].html; document.body.appendChild(y);
    }
  }

  function basla() {
    fetch(KOK + "sayilar.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(kur)
      .catch(function () { fetch(KOK + "sayilar.json").then(function (r) { return r.json(); }).then(kur).catch(function () {}); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", basla); else basla();
})();
