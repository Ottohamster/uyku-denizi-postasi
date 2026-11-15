/* Uyku Denizi Postası - uygulama katmanı.
   Her sayı sayfasına (ve defter.html'e) eklenir:
   - sağ altta Menü (geçmiş sayılar + Defter bağlantıları) ve nöbet modu düğmesi
   - çoktan seçmeli soruları tıklanır yapar, cevapları "soru karnesi"ne yazar
   - önceki sayılarda yanlış yapılan soruları "Tekrar Köşesi" olarak sayfaya ekler
   - arama sonucundan gelindiyse (#ara=...) ilgili yeri vurgular
   - daha yeni bir sayı çıktıysa haber şeridi, çevrimdışı destek kaydı
   Tüm kişisel veriler yalnızca bu cihazda (localStorage) tutulur. */
(function () {
  "use strict";
  var KOK = new URL(/\/sayilar\//.test(location.pathname) ? ".." : ".", location.href).href;
  if ("serviceWorker" in navigator) { navigator.serviceWorker.register(KOK + "sw.js", { scope: KOK }).catch(function () {}); }

  // ---------- küçük yardımcılar ----------
  function oku(k, v) { try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : v; } catch (e) { return v; } }
  function yaz(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function el(etiket, sinif, metin) { var e = document.createElement(etiket); if (sinif) e.className = sinif; if (metin != null) e.textContent = metin; return e; }
  var GUN = 86400000;
  var HARF = "ABCDE";
  // Türkçe büyük/küçük harf ve şapka duyarsız, uzunluğu koruyan sadeleştirme (arama ve vurgu için)
  var ESLE = { "ç": "c", "Ç": "c", "ğ": "g", "Ğ": "g", "ı": "i", "I": "i", "İ": "i", "ö": "o", "Ö": "o", "ş": "s", "Ş": "s", "ü": "u", "Ü": "u", "â": "a", "Â": "a", "î": "i", "Î": "i", "û": "u", "Û": "u" };
  function norm(s) {
    var o = "";
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i), m = ESLE[c];
      if (m) { o += m; continue; }
      var l = c.toLowerCase();
      o += l.length === 1 ? l : c;
    }
    return o;
  }
  function sayiNo(yol) { var m = /sayi-(\d+)\.html/.exec(yol || location.pathname); return m ? parseInt(m[1], 10) : 0; }

  // ---------- nöbet modu (gece görünümü) ----------
  var GECE_ANAHTAR = "udp-gece";
  function geceUygula(acik) {
    document.documentElement.classList.toggle("udp-gece", !!acik);
    var tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute("content", acik ? "#0b0907" : "#1f4e5f");
  }
  geceUygula(oku(GECE_ANAHTAR, false));

  var css = "" +
    // menü düğmeleri ve çekmece
    ".udp-dug{position:fixed;right:calc(14px + env(safe-area-inset-right));bottom:calc(14px + env(safe-area-inset-bottom));z-index:9000;display:flex;gap:8px;align-items:center}" +
    ".udp-fab,.udp-ay{display:flex;align-items:center;justify-content:center;gap:8px;border:2px solid #2a2018;border-radius:999px;background:#9b2d20;color:#f6ead0;" +
    "font:700 15px/1 Georgia,'Times New Roman',serif;letter-spacing:.04em;box-shadow:0 4px 14px rgba(42,32,24,.35);cursor:pointer;-webkit-tap-highlight-color:transparent}" +
    ".udp-fab{padding:11px 16px}.udp-ay{width:42px;height:42px;padding:0;background:#1f4e5f;font-size:18px}" +
    ".udp-fab:active,.udp-ay:active{transform:translateY(1px)}" +
    ".udp-ort{position:fixed;inset:0;z-index:9001;background:rgba(42,32,24,.5);opacity:0;pointer-events:none;transition:opacity .25s}" +
    ".udp-ort.acik{opacity:1;pointer-events:auto}" +
    ".udp-cek{position:fixed;left:0;right:0;bottom:0;z-index:9002;max-height:84vh;display:flex;flex-direction:column;background:#e9dcbf;color:#2a2018;" +
    "border-top:3px double #2a2018;border-radius:16px 16px 0 0;box-shadow:0 -8px 30px rgba(42,32,24,.4);transform:translateY(105%);transition:transform .3s ease;" +
    "font-family:Georgia,'Times New Roman',serif;padding-bottom:env(safe-area-inset-bottom)}" +
    ".udp-cek.acik{transform:none}" +
    ".udp-bas{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px 10px;border-bottom:1px solid rgba(42,32,24,.35)}" +
    ".udp-bas h2{margin:0;font:400 1.5rem/1.1 'Pirata One',Georgia,serif}" +
    ".udp-kapat{border:1px solid #2a2018;background:transparent;color:#2a2018;border-radius:999px;width:36px;height:36px;font-size:18px;cursor:pointer}" +
    ".udp-nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:10px 12px;border-bottom:1px solid rgba(42,32,24,.35)}" +
    ".udp-nav a{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 4px;border:1px solid #2a2018;border-radius:8px;color:#2a2018;text-decoration:none;" +
    "font:700 .74rem/1.15 'Special Elite','Courier New',monospace;text-align:center;background:rgba(243,232,207,.7)}" +
    ".udp-nav a span{font-size:1.15rem;line-height:1}" +
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
    "@media (min-width:720px){.udp-cek{left:auto;right:18px;bottom:18px;width:440px;border:2px solid #2a2018;border-radius:14px}}" +
    // tıklanır sorular
    "li.udp-sik{cursor:pointer;border-radius:4px;padding:2px 6px;margin-left:-6px;transition:background .15s}" +
    "li.udp-sik:hover{background:rgba(240,194,122,.35)}" +
    "li.udp-sik.udp-d{background:rgba(110,160,95,.32);font-weight:700}" +
    "li.udp-sik.udp-d::after{content:' ✓'}" +
    "li.udp-sik.udp-y{background:rgba(190,80,60,.28);text-decoration:line-through;text-decoration-color:rgba(155,45,32,.7)}" +
    "li.udp-sik.udp-y::after{content:' ✗'}" +
    "ol.udp-cozuldu li.udp-sik{cursor:default}ol.udp-cozuldu li.udp-sik:hover{background:none}" +
    "ol.udp-cozuldu li.udp-sik.udp-d{background:rgba(110,160,95,.32)}ol.udp-cozuldu li.udp-sik.udp-y{background:rgba(190,80,60,.28)}" +
    ".udp-not{font-family:'Special Elite','Courier New',monospace;font-size:.8rem;color:#5a4a38;margin:-6px 0 10px}" +
    ".udp-ipucu{font-family:'Special Elite','Courier New',monospace;font-size:.78rem;color:#5a4a38;margin:0 0 10px}" +
    ".udp-tekrar{margin-top:34px}.udp-tekrar .udp-soru + .udp-soru{margin-top:16px;padding-top:12px;border-top:1px dashed rgba(42,32,24,.4)}" +
    ".udp-tekrar .udp-kaynak{font-family:'Special Elite','Courier New',monospace;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:#9b2d20}" +
    ".udp-acik{margin-top:8px;padding-top:8px;border-top:1px dashed rgba(42,32,24,.4)}" +
    "mark.udp-mark{background:#f0c27a;color:#2a2018;padding:0 2px;border-radius:2px;box-shadow:0 0 0 3px rgba(240,194,122,.45)}" +
    // nöbet modu: koyu kehribar; şemalar açık kâğıt üzerinde kalır
    "@media screen{" +
    "html.udp-gece{--paper:#1c1712;--paper-2:#241d16;--paper-dark:#2e251c;--ink:#ecc98f;--ink-soft:#b99c74;--sea:#2b6476;--wax:#e0805f;--tape:rgba(120,95,55,.55);color-scheme:dark}" +
    "html.udp-gece body{background:#0b0907!important;background-image:none!important}" +
    "html.udp-gece .sheet{background-image:none!important;background-color:var(--paper)!important;box-shadow:0 30px 60px rgba(0,0,0,.6)!important}" +
    "html.udp-gece a{color:#8cc4d4}" +
    "html.udp-gece h1.name{text-shadow:none!important}" +
    "html.udp-gece .box,html.udp-gece .ek,html.udp-gece .cal li:not(.now),html.udp-gece .ek-cal li:not(.now),html.udp-gece .cyp div,html.udp-gece .stamp{background:rgba(255,215,150,.045)!important}" +
    "html.udp-gece .ek.yb{--ek-acc:#7fb6c9}html.udp-gece .ek.ag{--ek-acc:#e8906f}html.udp-gece .ek.fa{--ek-acc:#a7c06a}html.udp-gece .ek.yd{--ek-acc:#dcb04a}" +
    "html.udp-gece .ek-cal li.now{color:#1c1712!important}html.udp-gece .fa-toks{background:rgba(224,128,95,.08)!important}" +
    "html.udp-gece .cmp th{background:rgba(236,201,143,.13)!important}html.udp-gece .fiber th{background:rgba(224,128,95,.16)!important}" +
    "html.udp-gece .cmp th,html.udp-gece .cmp td,html.udp-gece .fiber th,html.udp-gece .fiber td,html.udp-gece .cal li,html.udp-gece .ek-cal li,html.udp-gece .wire article," +
    "html.udp-gece .clip .journal,html.udp-gece .topic .body h5,html.udp-gece .ek .body h5{border-color:rgba(236,201,143,.3)!important}" +
    "html.udp-gece .lead .cols{column-rule-color:rgba(236,201,143,.3)!important}" +
    "html.udp-gece .cw .cell.hl,html.udp-gece .btn:hover{background:#3a2f22!important}html.udp-gece .cw .cell.ok{background:rgba(120,170,110,.35)!important}" +
    "html.udp-gece .cw .cell.bad{background:rgba(200,90,70,.35)!important}" +
    "html.udp-gece input,html.udp-gece select,html.udp-gece textarea{background:#2a2219!important;color:var(--ink)!important;border-color:#7a6650!important}" +
    "html.udp-gece .chart,html.udp-gece .pathway,html.udp-gece .portrait,html.udp-gece .fa-sema,html.udp-gece .udp-acik-kagit{--paper:#e9dcbf;--paper-2:#f3e8cf;--ink:#2a2018;--ink-soft:#5a4a38;--sea:#1f4e5f;--wax:#9b2d20;" +
    "background:#e9dcbf!important;color:#2a2018;filter:brightness(.86)}" +
    "html.udp-gece .chart a,html.udp-gece .pathway a{color:#1f4e5f}" +
    "html.udp-gece .udp-cek{background:#1c1712;color:#ecc98f;border-color:#ecc98f}html.udp-gece .udp-bas h2,html.udp-gece .udp-kapat{color:#ecc98f;border-color:#ecc98f}" +
    "html.udp-gece .udp-nav a{background:#241d16;color:#ecc98f;border-color:rgba(236,201,143,.5)}" +
    "html.udp-gece .udp-lis .udp-k,html.udp-gece .udp-not,html.udp-gece .udp-ipucu{color:#b99c74}html.udp-gece .udp-lis .udp-no{color:#e0805f}" +
    "html.udp-gece .udp-lis a.udp-pdf{color:#8cc4d4;border-color:#8cc4d4}html.udp-gece .udp-lis li{border-color:rgba(236,201,143,.25)}" +
    "html.udp-gece .udp-ay{background:#3a2f22;color:#f0c27a;border-color:#ecc98f}" +
    "}" +
    "@media (prefers-reduced-motion:reduce){.udp-cek,.udp-ort{transition:none}}" +
    "@media print{.udp-dug,.udp-ort,.udp-cek,.udp-yeni,.udp-tekrar,.udp-not,.udp-ipucu{display:none!important}}";
  var st = el("style"); st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  // ---------- soru karnesi ----------
  var KARNE = "udp-karne-v1";
  function karne() { return oku(KARNE, {}); }
  function karneKaydet(k) { yaz(KARNE, k); }
  var TEKRAR_ARALIK = [1, 3, 7];  // doğru tekrar sonrası bekleme (gün); 3 doğrudan sonra soru "öğrenildi"
  function tekrarBekliyor(r, simdi) { return r && !r.ok && (r.k || 0) < TEKRAR_ARALIK.length && (r.n || 0) <= simdi; }

  function kategori(ol, soruMetni) {
    var ek = ol.closest ? ol.closest(".ek") : null;
    var id = ek && ek.id;
    if (id === "yogun-bakim") return "Yoğun bakım";
    if (id === "algoloji") return "Algoloji";
    if (id === "farmakoloji") return "Farmakoloji";
    if (id === "ydus") return "YDUS";
    if (ek) { var h = ek.querySelector("h2"); if (h) return h.textContent.trim(); }
    if (/^\s*(\d+\.\s*)?\((yoğun bakım|yb)\)/i.test(soruMetni)) return "Yoğun bakım";
    if (/^\s*(\d+\.\s*)?\((algoloji|ağrı)\)/i.test(soruMetni)) return "Algoloji";
    if (/^\s*(\d+\.\s*)?\((farmakoloji|farma)\)/i.test(soruMetni)) return "Farmakoloji";
    return "Ana gazete";
  }

  // Bir belgedeki (canlı sayfa ya da DOMParser çıktısı) çoktan seçmeli soruları bulur.
  // Yapı: .quiz içinde [soru <p>] → <ol type="A"> şıklar → <details> içinde "Doğru cevap: X".
  function sorulariBul(kok) {
    var liste = [];
    var ols = kok.querySelectorAll('.quiz ol[type="A"], .quiz ol[type="a"]');
    for (var i = 0; i < ols.length; i++) {
      var ol = ols[i];
      var det = ol.nextElementSibling;
      while (det && det.tagName !== "DETAILS" && det.tagName !== "OL") det = det.nextElementSibling;
      if (!det || det.tagName !== "DETAILS") continue;
      var m = /Doğru cevap\s*:?\s*([A-E])\b/i.exec(det.textContent || "");
      if (!m) continue;
      var siklar = [];
      for (var j = 0; j < ol.children.length; j++) if (ol.children[j].tagName === "LI") siklar.push(ol.children[j]);
      var d = HARF.indexOf(m[1].toUpperCase());
      if (d < 0 || d >= siklar.length) continue;
      var p = ol.previousElementSibling;
      while (p && !/^(P|H4|H5)$/.test(p.tagName)) p = p.previousElementSibling;
      var q = p ? p.textContent.replace(/\s+/g, " ").trim() : "";
      var ans = det.querySelector(".ans");
      var a;
      if (ans) a = ans.textContent; else { var kl = det.cloneNode(true); var sm = kl.querySelector("summary"); if (sm) sm.remove(); a = kl.textContent; }
      liste.push({ ol: ol, det: det, lis: siklar, q: q, o: siklar.map(function (li) { return li.textContent.replace(/\s+/g, " ").trim(); }),
                   d: d, a: (a || "").replace(/\s+/g, " ").trim(), b: kategori(ol, q) });
    }
    return liste;
  }

  // Klinik inciler: .pearls içindeki maddeler. Kalın kısım ön yüz, kalanı arka yüz.
  function incileriBul(kok) {
    var out = [];
    var lis = kok.querySelectorAll(".pearls li");
    for (var i = 0; i < lis.length; i++) {
      var li = lis[i], b = li.querySelector("b,strong");
      var tum = li.textContent.replace(/\s+/g, " ").trim();
      var on = b ? b.textContent.replace(/\s+/g, " ").trim() : tum;
      var arka = b ? tum.replace(on, "").trim() : "";
      var kutu = li.closest(".pearls"), ek = li.closest(".ek");
      var k = kutu && kutu.querySelector(".kicker");
      out.push({ on: on, arka: arka, b: ek ? kategori(li, "") : "Haftanın Konusu", baslik: k ? k.textContent.trim() : "" });
    }
    return out;
  }

  function siklariIsaretle(s, secilen) {
    s.ol.classList.add("udp-cozuldu");
    s.lis.forEach(function (li, i) {
      li.classList.remove("udp-d", "udp-y");
      if (i === s.d) li.classList.add("udp-d");
      else if (i === secilen) li.classList.add("udp-y");
    });
  }

  function sayfaSorulari() {
    var no = sayiNo();
    if (!no) return;
    var sorular = sorulariBul(document);
    if (!sorular.length) return;
    var k = karne();
    sorular.forEach(function (s, idx) {
      var id = "s" + no + "-" + (idx + 1);
      var notP = el("p", "udp-not");
      s.det.parentNode.insertBefore(notP, s.det);
      var kayit = k[id];
      if (kayit) {
        siklariIsaretle(s, kayit.c);
        notP.textContent = "Karnede: " + (kayit.ok ? "ilk denemede doğru ✓" : "ilk denemede yanlış (" + HARF.charAt(kayit.c) + ") — tekrar listende");
        return;
      }
      notP.textContent = "Bir şıkka dokun; cevabın karnene yazılır.";
      s.lis.forEach(function (li, i) {
        li.classList.add("udp-sik");
        li.setAttribute("role", "button");
        li.setAttribute("tabindex", "0");
        function sec() {
          if (s.ol.classList.contains("udp-cozuldu")) return;
          var kk = karne(), simdi = Date.now(), dogru = i === s.d;
          kk[id] = { s: no, i: idx + 1, q: s.q, o: s.o, d: s.d, a: s.a, b: s.b, c: i, ok: dogru, t: simdi, k: 0, n: simdi };
          karneKaydet(kk);
          siklariIsaretle(s, i);
          s.det.open = true;
          notP.textContent = dogru ? "Doğru ✓ Karnene işlendi." : "Yanlış. Doğru cevap " + HARF.charAt(s.d) + ". Bu soru sonraki sayılarda Tekrar Köşesi'ne gelecek.";
        }
        li.addEventListener("click", sec);
        li.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sec(); } });
      });
    });
  }

  // Karnedeki bir soruyu (tekrar için) çizer. sonuc(dogruMu) çağrılır.
  function soruCiz(r, sonuc) {
    var kap = el("div", "udp-soru");
    kap.appendChild(el("div", "udp-kaynak", "Sayı " + r.s + " · " + (r.b || "") + " · " + ((r.k || 0) > 0 ? (r.k + ". tekrar") : "ilk tekrar")));
    kap.appendChild(el("p", null, r.q));
    var ol = el("ol"); ol.setAttribute("type", "A");
    var lis = r.o.map(function (metin) { var li = el("li", "udp-sik", metin); li.setAttribute("role", "button"); li.setAttribute("tabindex", "0"); ol.appendChild(li); return li; });
    kap.appendChild(ol);
    var acik = el("div", "udp-acik"); acik.hidden = true; kap.appendChild(acik);
    lis.forEach(function (li, i) {
      function sec() {
        if (ol.classList.contains("udp-cozuldu")) return;
        var dogru = i === r.d;
        siklariIsaretle({ ol: ol, lis: lis, d: r.d }, i);
        acik.hidden = false;
        acik.textContent = (dogru ? "Doğru ✓ " : "Yanlış — doğru cevap " + HARF.charAt(r.d) + ". ") + (r.a || "").replace(/^Doğru cevap\s*:?\s*[A-E]\.?\s*/i, "");
        var kk = karne(), kr = kk["s" + r.s + "-" + r.i] || r, simdi = Date.now();
        if (dogru) { kr.k = (kr.k || 0) + 1; kr.n = kr.k < TEKRAR_ARALIK.length ? simdi + TEKRAR_ARALIK[kr.k - 1] * GUN : simdi; kr.ogrenildi = kr.k >= TEKRAR_ARALIK.length; }
        else { kr.k = 0; kr.n = simdi + GUN; }
        kr.son = simdi;
        kk["s" + r.s + "-" + r.i] = kr; karneKaydet(kk);
        if (sonuc) sonuc(dogru, kr);
      }
      li.addEventListener("click", sec);
      li.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sec(); } });
    });
    return kap;
  }

  function tekrarListesi(enCokSayi) {
    var k = karne(), simdi = Date.now(), out = [];
    Object.keys(k).forEach(function (id) { var r = k[id]; if (tekrarBekliyor(r, simdi) && (!enCokSayi || r.s < enCokSayi)) out.push(r); });
    out.sort(function (a, b) { return (a.n || 0) - (b.n || 0) || a.s - b.s || a.i - b.i; });
    return out;
  }

  function tekrarKosesi() {
    var no = sayiNo();
    if (!no) return;
    var bekleyen = tekrarListesi(no);
    if (!bekleyen.length) return;
    var kutular = document.querySelectorAll(".box.quiz");
    var hedef = kutular.length ? kutular[kutular.length - 1] : document.querySelector(".puzzle");
    if (!hedef) return;
    var kutu = el("div", "box quiz udp-tekrar");
    var bant = el("span", "tape"); bant.setAttribute("aria-hidden", "true"); kutu.appendChild(bant);
    kutu.appendChild(el("div", "kicker", "Tekrar Köşesi · önceki sayılarda yanlış yaptıkların"));
    kutu.appendChild(el("h4", null, bekleyen.length === 1 ? "Bir soru seni bekliyor" : bekleyen.length + " soru seni bekliyor"));
    kutu.appendChild(el("p", "udp-ipucu", "Üç kez arka arkaya (1, 3 ve 7 gün arayla) doğru bilince soru listeden çıkar. Tümü: Menü → Karne."));
    bekleyen.slice(0, 3).forEach(function (r) { kutu.appendChild(soruCiz(r)); });
    hedef.parentNode.insertBefore(kutu, hedef.nextSibling);
  }

  // ---------- arama sonucundan gelindiyse vurgula ----------
  function aramaVurgula() {
    var m = /^#ara=(.+)$/.exec(location.hash);
    if (!m) return;
    var sorgu; try { sorgu = decodeURIComponent(m[1]); } catch (e) { return; }
    var adaylar = [norm(sorgu.trim())].concat(norm(sorgu).split(/\s+/).filter(function (t) { return t.length > 1; }));
    var kok = document.querySelector(".sheet") || document.body;
    var yuruyen = document.createTreeWalker(kok, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(p.nodeName) || (p.closest && p.closest(".udp-cek,.udp-dug"))) return NodeFilter.FILTER_REJECT;
        return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var dugumler = []; while (yuruyen.nextNode()) dugumler.push(yuruyen.currentNode);
    for (var a = 0; a < adaylar.length; a++) {
      var aday = adaylar[a]; if (!aday) continue;
      for (var i = 0; i < dugumler.length; i++) {
        var n = dugumler[i], yer = norm(n.nodeValue).indexOf(aday);
        if (yer < 0) continue;
        var r = document.createRange(); r.setStart(n, yer); r.setEnd(n, yer + aday.length);
        var mk = el("mark", "udp-mark");
        try { r.surroundContents(mk); } catch (e) { continue; }
        var d = mk.closest("details"); if (d) d.open = true;
        setTimeout(function () { mk.scrollIntoView({ block: "center" }); }, 300);
        return;
      }
    }
  }

  // ---------- menü ve çekmece ----------
  function kur(veri) {
    var sayilar = (veri.sayilar || []).slice().sort(function (a, b) { return b.sayi - a.sayi; });
    var buDosya = location.pathname.split("/").pop();
    var simdiki = null;
    sayilar.forEach(function (s) { if (s.html.split("/").pop() === buDosya) simdiki = s; });

    var dug = el("div", "udp-dug");
    var ay = el("button", "udp-ay"); ay.type = "button";
    function ayEtiket() { var g = document.documentElement.classList.contains("udp-gece"); ay.textContent = g ? "☀" : "☾"; ay.setAttribute("aria-label", g ? "Gündüz görünümü" : "Nöbet modu (gece görünümü)"); ay.title = ay.getAttribute("aria-label"); }
    ayEtiket();
    ay.addEventListener("click", function () { var g = !document.documentElement.classList.contains("udp-gece"); geceUygula(g); yaz(GECE_ANAHTAR, g); ayEtiket(); });
    var fab = el("button", "udp-fab", "☰ Menü"); fab.type = "button"; fab.setAttribute("aria-haspopup", "dialog");
    dug.appendChild(ay); dug.appendChild(fab);

    var ort = el("div", "udp-ort");
    var cek = el("div", "udp-cek"); cek.setAttribute("role", "dialog"); cek.setAttribute("aria-modal", "true"); cek.setAttribute("aria-label", "Menü");
    var bas = el("div", "udp-bas"); bas.appendChild(el("h2", null, "Uyku Denizi Postası"));
    var kapat = el("button", "udp-kapat", "✕"); kapat.type = "button"; kapat.setAttribute("aria-label", "Kapat"); bas.appendChild(kapat);
    var nav = el("nav", "udp-nav"); nav.setAttribute("aria-label", "Defter");
    [["ara", "⌕", "Ara"], ["karne", "✎", "Karne"], ["deste", "❖", "İnci destesi"], ["alet", "⚓", "Alet çantası"]].forEach(function (x) {
      var a = el("a"); a.href = KOK + "defter.html#" + x[0];
      var i = el("span", null, x[1]); i.setAttribute("aria-hidden", "true"); a.appendChild(i); a.appendChild(document.createTextNode(x[2]));
      nav.appendChild(a);
    });
    var lis = el("ul", "udp-lis"); lis.setAttribute("aria-label", "Geçmiş sayılar");
    sayilar.forEach(function (s, i) {
      var li = el("li"); if (simdiki && s.sayi === simdiki.sayi) li.className = "simdi";
      var a = el("a", "udp-s"); a.href = KOK + s.html;
      a.appendChild(el("span", "udp-no", "Sayı " + s.sayi + " · " + (s.tarih_yazi || s.tarih || "") + (i === 0 ? " · son sayı" : "")));
      a.appendChild(el("span", "udp-m", s.manset || "Uyku Denizi Postası"));
      var k = [];
      if (s.konu) k.push("Konu: " + s.konu);
      if (s.yogun_bakim) k.push("YB: " + s.yogun_bakim);
      if (s.algoloji) k.push("Ağrı: " + s.algoloji);
      if (s.farmakoloji) k.push("Farma: " + s.farmakoloji);
      if (s.ydus) k.push("YDUS: " + s.ydus);
      if (k.length) a.appendChild(el("span", "udp-k", k.join(" · ")));
      li.appendChild(a);
      if (s.pdf) { var p = el("a", "udp-pdf", "PDF"); p.href = KOK + s.pdf; p.target = "_blank"; p.rel = "noopener"; p.setAttribute("aria-label", "Sayı " + s.sayi + " PDF"); li.appendChild(p); }
      lis.appendChild(li);
    });
    cek.appendChild(bas); cek.appendChild(nav); cek.appendChild(lis);
    document.body.appendChild(dug); document.body.appendChild(ort); document.body.appendChild(cek);

    function ac() { ort.classList.add("acik"); cek.classList.add("acik"); kapat.focus(); }
    function kapa() { ort.classList.remove("acik"); cek.classList.remove("acik"); fab.focus(); }
    fab.addEventListener("click", ac); kapat.addEventListener("click", kapa); ort.addEventListener("click", kapa);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && cek.classList.contains("acik")) kapa(); });

    if (simdiki && sayilar.length && sayilar[0].sayi > simdiki.sayi && !/[?&]arsiv=1/.test(location.search) && document.referrer.indexOf(KOK) !== 0) {
      var y = el("a", "udp-yeni", "Yeni sayı çıktı: Sayı " + sayilar[0].sayi + " →"); y.href = KOK + sayilar[0].html; document.body.appendChild(y);
    }
  }

  function sayilariGetir() {
    return fetch(KOK + "sayilar.json", { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function () { return fetch(KOK + "sayilar.json").then(function (r) { return r.json(); }); });
  }

  window.UDP = { KOK: KOK, oku: oku, yaz: yaz, el: el, norm: norm, sayiNo: sayiNo, karne: karne, karneKaydet: karneKaydet,
                 sorulariBul: sorulariBul, incileriBul: incileriBul, soruCiz: soruCiz, tekrarListesi: tekrarListesi,
                 sayilariGetir: sayilariGetir, GUN: GUN, HARF: HARF };

  function basla() {
    try { sayfaSorulari(); } catch (e) { if (window.console) console.warn("udp sorular", e); }
    try { tekrarKosesi(); } catch (e) { if (window.console) console.warn("udp tekrar", e); }
    try { aramaVurgula(); } catch (e) { if (window.console) console.warn("udp ara", e); }
    sayilariGetir().then(kur).catch(function () { kur({ sayilar: [] }); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", basla); else basla();
})();
