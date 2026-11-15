/* Uyku Denizi Postası - Kaptanın Defteri: arşivde arama, soru karnesi, inci destesi, alet çantası.
   Sayıların içeriği sayfaların kendisinden okunur (DOMParser); veriler yalnızca bu cihazda tutulur. */
(function () {
  "use strict";
  var U = window.UDP;
  var el = U.el, GUN = U.GUN;
  function $(id) { return document.getElementById(id); }
  function sayi(v) { var x = parseFloat(String(v == null ? "" : v).replace(",", ".")); return isFinite(x) ? x : NaN; }
  function yuvarla(x, h) { var k = Math.pow(10, h == null ? 1 : h); return Math.round(x * k) / k; }
  function tr(x, h) { if (!isFinite(x)) return "—"; return yuvarla(x, h).toLocaleString("tr-TR", { maximumFractionDigits: h == null ? 1 : h }); }

  // =========================================================
  // HESAPLAR (saf fonksiyonlar; tarayıcı konsolundan UDP_HESAP ile sınanabilir)
  // =========================================================
  var LA = {
    lidokain:       { ad: "Lidokain",       mgkg: [4.5, 7],  blok: [350, 500], epidural: [350, 500], infiltrasyon: [300, 500] },
    prilokain:      { ad: "Prilokain",      mgkg: [6, 8],    blok: [400, 600], epidural: [350, 500], infiltrasyon: [350, 550] },
    mepivakain:     { ad: "Mepivakain",     mgkg: null,      blok: [350, 500], epidural: [350, 500], infiltrasyon: [300, 500] },
    bupivakain:     { ad: "Bupivakain",     mgkg: [2.5, 3],  blok: [175, 225], epidural: [175, 225], infiltrasyon: [175, 200] },
    levobupivakain: { ad: "Levobupivakain", mgkg: null,      blok: [200, 225], epidural: [200, 250], infiltrasyon: null },
    ropivakain:     { ad: "Ropivakain",     mgkg: [3, 3],    blok: [200, 250], epidural: [200, 250], infiltrasyon: [200, 250] },
    kloroprokain:   { ad: "Kloroprokain",   mgkg: [11, 14],  blok: null,       epidural: [700, 900], infiltrasyon: [800, 1000] }
  };
  var TIP_AD = { blok: "büyük sinir bloğu (Tablo 29.6)", epidural: "epidural (Tablo 29.7)", infiltrasyon: "infiltrasyon (Tablo 29.4)" };

  // Morgan & Mikhail 7. baskı, Bölüm 42. [ad, alt mg|mcg/kg, üst, birim, tavan (birim cinsinden) ya da null]
  var COCUK_DOZ = [
    ["Propofol IV (indüksiyon)", 2, 3, "mg", null],
    ["Süksinilkolin IV, süt çocuğu", 2, 3, "mg", null],
    ["Süksinilkolin IV, büyük çocuk", 1, 1.5, "mg", null],
    ["Süksinilkolin IM (damar yolu yokken)", 4, 6, "mg", 150],
    ["Rokuronyum IV (rutin entübasyon)", 0.6, 0.6, "mg", null],
    ["Rokuronyum IV (hızlı ardışık indüksiyon)", 0.9, 1.2, "mg", null],
    ["Atropin IV", 0.01, 0.02, "mg", null],
    ["Atropin IM", 0.02, 0.02, "mg", 0.4],
    ["Glikopirolat IV", 0.01, 0.01, "mg", null],
    ["Neostigmin IV (antikolinerjikle)", 0.03, 0.07, "mg", null],
    ["Fentanil IV", 1, 2, "mcg", null],
    ["Morfin IV", 0.05, 0.1, "mg", null],
    ["Ketorolak IV", 0.5, 0.75, "mg", null],
    ["Midazolam oral (premedikasyon)", 0.3, 0.5, "mg", 15],
    ["Midazolam IV (sedasyon)", 0.1, 0.15, "mg", null],
    ["Ketamin IM (uyumsuz çocukta premedikasyon)", 2, 3, "mg", null],
    ["Deksmedetomidin intranazal", 1, 2, "mcg", null],
    ["Lidokain IV (laringospazm)", 1, 1.5, "mg", null],
    ["Deksametazon IV (havayolu ödemi)", 0.25, 0.5, "mg", null]
  ];

  var H = {
    kilo: function (o) {
      var boy = o.boy, kg = o.kg, kadin = o.cins === "K";
      if (!(boy > 0) || !(kg > 0)) return null;
      var m = boy / 100, bmi = kg / (m * m);
      var pbw = (kadin ? 45.5 : 50) + 0.91 * (boy - 152.4);
      var lbw = kadin ? 9270 * kg / (8780 + 244 * bmi) : 9270 * kg / (6680 + 216 * bmi);
      var duz = kg > pbw ? pbw + 0.4 * (kg - pbw) : kg;
      return { bmi: bmi, pbw: pbw, vt6: pbw * 6, vt8: pbw * 8, vt4: pbw * 4, lbw: lbw, duzeltilmis: duz, bsa: Math.sqrt(boy * kg / 3600), kisa: boy < 152.4 };
    },
    la: function (o) {
      var ilac = LA[o.ilac]; if (!ilac) return null;
      var tablo = ilac[o.tip], epi = o.epi ? 1 : 0;
      var tavan = tablo ? tablo[epi] : null;
      var kiloya = ilac.mgkg && o.kg > 0 ? ilac.mgkg[epi] * o.kg : null;
      var sinir = tavan != null && kiloya != null ? Math.min(tavan, kiloya) : (tavan != null ? tavan : kiloya);
      var mgml = o.yuzde > 0 ? o.yuzde * 10 : null;
      return { ad: ilac.ad, tavan: tavan, mgkg: ilac.mgkg ? ilac.mgkg[epi] : null, kiloya: kiloya, sinir: sinir,
               mgml: mgml, ml: sinir != null && mgml ? sinir / mgml : null, kisitlayan: (tavan != null && kiloya != null) ? (kiloya < tavan ? "kilo" : "tavan") : null };
    },
    cocuk: function (o) {
      var yas = o.yas, kg = o.kg, pre = !!o.prematur;
      if (!(kg > 0) || !(yas >= 0)) return null;
      var ett, ettNot;
      if (pre) { ett = "2,5–3 mm"; ettNot = "Prematüre yenidoğan (kitaptaki istisna)."; }
      else if (yas < 1 / 12) { ett = "3–3,5 mm"; ettNot = "Term yenidoğan (kitaptaki istisna)."; }
      else {
        var f = 4 + yas / 4, r = Math.round(f * 2) / 2;
        ett = tr(r, 1) + " mm"; ettNot = "Kafsız tüp, 4 + yaş/4 = " + tr(f, 2) + " mm. Kaba bir kılavuzdur; 0,5 mm büyüğü ve küçüğü hazır olsun." + (yas < 1 ? " Bir yaş altında formül kitapta ayrıca doğrulanmamıştır." : "");
      }
      var sivi = kg <= 10 ? 4 * kg : (kg <= 20 ? 40 + 2 * (kg - 10) : 60 + (kg - 20));
      var hacim;
      if (pre) hacim = { alt: 100 * kg, ust: 100 * kg, not: "prematüre yenidoğan 100 mL/kg" };
      else if (yas < 1 / 12) hacim = { alt: 85 * kg, ust: 90 * kg, not: "term yenidoğan 85–90 mL/kg" };
      else if (yas < 1) hacim = { alt: 80 * kg, ust: 80 * kg, not: "süt çocuğu 80 mL/kg" };
      else hacim = { alt: 65 * kg, ust: 80 * kg, not: "bir yaş üstü için kitap ayrı değer vermiyor; süt çocuğu (80) ile erişkin (65–75 mL/kg) aralığı gösterildi" };
      var glukoz = yas <= 8 ? (pre ? { alt: 6 * kg, ust: 8 * kg } : { alt: 6 * kg, ust: 6 * kg }) : null;
      var ilaclar = COCUK_DOZ.map(function (d) {
        var alt = d[1] * kg, ust = d[2] * kg, tavan = d[4], kirpildi = false;
        if (tavan != null) { if (ust > tavan) { ust = tavan; kirpildi = true; } if (alt > tavan) alt = tavan; }
        return { ad: d[0], doz: d[1] === d[2] ? tr(d[1], 3) : tr(d[1], 3) + "–" + tr(d[2], 3), birim: d[3], alt: alt, ust: ust, tavan: tavan, kirpildi: kirpildi };
      });
      return { ett: ett, ettNot: ettNot, sivi: sivi, hacim: hacim, glukoz: glukoz, ilaclar: ilaclar };
    },
    // saatlik mcg cinsinden doz
    saatlikMcg: function (doz, birim, kg) {
      switch (birim) {
        case "mcg/kg/dk": return doz * kg * 60;
        case "mcg/kg/sa": return doz * kg;
        case "mg/kg/sa": return doz * kg * 1000;
        case "mcg/dk": return doz * 60;
        case "mg/sa": return doz * 1000;
      }
      return NaN;
    },
    kiloGerekir: function (birim) { return /\/kg\//.test(birim); },
    infuzyon: function (o) {   // o: mg, ml, kg, birim, doz | hiz
      if (!(o.mg > 0) || !(o.ml > 0)) return null;
      var kons = o.mg * 1000 / o.ml;   // mcg/mL
      var kgLazim = H.kiloGerekir(o.birim);
      if (kgLazim && !(o.kg > 0)) return { kons: kons, eksik: "kilo" };
      var kg = o.kg > 0 ? o.kg : 1;
      if (o.doz != null && isFinite(o.doz)) return { kons: kons, hiz: H.saatlikMcg(o.doz, o.birim, kg) / kons };
      if (o.hiz != null && isFinite(o.hiz)) return { kons: kons, doz: o.hiz * kons / H.saatlikMcg(1, o.birim, kg) };
      return { kons: kons };
    }
  };
  window.UDP_HESAP = H;

  // =========================================================
  // SAYILARI YÜKLE
  // =========================================================
  var sayilar = null, yuklenen = {}, hepsiSoz = null;
  function belgeGetir(url) {
    var c = window.caches ? caches.match(url).catch(function () { return null; }) : Promise.resolve(null);
    return c.then(function (r) { return r || fetch(url); })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) { return new DOMParser().parseFromString(t, "text/html"); });
  }
  var BIRIM = "P,LI,TD,TH,H4,H5,FIGCAPTION";
  function sayiCoz(s, doc) {
    var sorular = U.sorulariBul(doc).map(function (x, i) { return { id: "s" + s.sayi + "-" + (i + 1), s: s.sayi, i: i + 1, q: x.q, o: x.o, d: x.d, a: x.a, b: x.b }; });
    var inciler = U.incileriBul(doc).map(function (x, i) { x.id = "s" + s.sayi + "-p" + (i + 1); x.s = s.sayi; return x; });
    var kok = doc.querySelector(".sheet") || doc.body, birimler = [];
    var yur = doc.createTreeWalker(kok, NodeFilter.SHOW_ELEMENT, null), bolum = "", alt = "";
    while (yur.nextNode()) {
      var n = yur.currentNode, ad = n.tagName;
      if (ad === "SCRIPT" || ad === "STYLE") continue;
      if (ad === "H2" || ad === "H3") { bolum = n.textContent.replace(/\s+/g, " ").trim(); alt = ""; }
      if (ad === "H4" || ad === "H5") alt = n.textContent.replace(/\s+/g, " ").trim();
      if (BIRIM.indexOf(ad) < 0 && !(n.classList && n.classList.contains("formula"))) continue;
      if (ad === "LI" && n.querySelector("p")) continue;
      var t = n.textContent.replace(/\s+/g, " ").trim();
      if (t.length < 3) continue;
      birimler.push({ h: bolum + (alt && alt !== t ? " › " + alt : ""), t: t, n: U.norm(t) });
    }
    return { s: s, sorular: sorular, inciler: inciler, birimler: birimler };
  }
  function sayilariAl() {
    if (sayilar) return Promise.resolve(sayilar);
    return U.sayilariGetir().then(function (v) { sayilar = (v.sayilar || []).slice().sort(function (a, b) { return b.sayi - a.sayi; }); return sayilar; });
  }
  function hepsiniYukle(ilerleme) {
    if (hepsiSoz) return hepsiSoz;
    hepsiSoz = sayilariAl().then(function (liste) {
      var bitti = 0, hatali = [];
      if (ilerleme) ilerleme(0, liste.length);
      return Promise.all(liste.map(function (s) {
        return belgeGetir(U.KOK + s.html).then(function (doc) { yuklenen[s.sayi] = sayiCoz(s, doc); })
          .catch(function () { hatali.push(s.sayi); })
          .then(function () { bitti++; if (ilerleme) ilerleme(bitti, liste.length); });
      })).then(function () {
        return { liste: liste.filter(function (s) { return yuklenen[s.sayi]; }).map(function (s) { return yuklenen[s.sayi]; }), hatali: hatali };
      });
    });
    return hepsiSoz;
  }

  // =========================================================
  // SEKMELER
  // =========================================================
  var SEKMELER = ["ara", "karne", "deste", "alet"], hazir = {};
  function sekmeAc(ad, hashYaz) {
    if (SEKMELER.indexOf(ad) < 0) ad = "ara";
    SEKMELER.forEach(function (x) {
      $("t-" + x).setAttribute("aria-selected", x === ad ? "true" : "false");
      $("p-" + x).classList.toggle("gizli", x !== ad);
    });
    if (hashYaz && location.hash !== "#" + ad) history.replaceState(null, "", "#" + ad);
    if (!hazir[ad]) { hazir[ad] = true; ({ ara: araKur, karne: karneKur, deste: desteKur, alet: aletKur })[ad](); }
    else if (ad === "karne") karneCiz();
    else if (ad === "deste") desteCiz();
  }
  SEKMELER.forEach(function (x) { $("t-" + x).addEventListener("click", function () { sekmeAc(x, true); }); });
  window.addEventListener("hashchange", function () { sekmeAc(location.hash.slice(1), false); });

  function ilerlemeYaz(hedef, onEk) { return function (b, t) { $(hedef).textContent = t ? (onEk || "Sayılar okunuyor") + ": " + b + "/" + t : ""; }; }

  // =========================================================
  // ARA
  // =========================================================
  function vurguluMetin(t, n, tokenlar) {
    var ilk = -1;
    tokenlar.forEach(function (tk) { var y = n.indexOf(tk); if (y >= 0 && (ilk < 0 || y < ilk)) ilk = y; });
    var bas = Math.max(0, ilk - 70), son = Math.min(t.length, ilk + 170);
    var parca = t.slice(bas, son), pn = n.slice(bas, son), frag = document.createDocumentFragment(), i = 0;
    var araliklar = [];
    tokenlar.forEach(function (tk) { var y = pn.indexOf(tk); while (y >= 0) { araliklar.push([y, y + tk.length]); y = pn.indexOf(tk, y + tk.length); } });
    araliklar.sort(function (a, b) { return a[0] - b[0]; });
    if (bas > 0) frag.appendChild(document.createTextNode("… "));
    araliklar.forEach(function (r) {
      if (r[0] < i) return;
      frag.appendChild(document.createTextNode(parca.slice(i, r[0])));
      frag.appendChild(el("mark", null, parca.slice(r[0], r[1])));
      i = r[1];
    });
    frag.appendChild(document.createTextNode(parca.slice(i)));
    if (son < t.length) frag.appendChild(document.createTextNode(" …"));
    return frag;
  }
  function araKur() {
    var kutu = $("araKutu"), zam = null;
    hepsiniYukle(ilerlemeYaz("araDurum")).then(function (r) {
      $("araDurum").textContent = r.liste.length + " sayı hazır" + (r.hatali.length ? " (okunamayan: " + r.hatali.join(", ") + ")" : "") + ".";
      if (kutu.value) ara();
    });
    function ara() {
      var q = kutu.value.trim(), ul = $("araSonuc");
      ul.textContent = "";
      if (q.length < 2) { return; }
      var tok = U.norm(q).split(/\s+/).filter(function (x) { return x.length > 0; });
      hepsiniYukle().then(function (r) {
        var bulunan = 0, SINIR = 80;
        r.liste.forEach(function (sy) {
          sy.birimler.forEach(function (b) {
            if (bulunan >= SINIR) return;
            for (var i = 0; i < tok.length; i++) if (b.n.indexOf(tok[i]) < 0) return;
            bulunan++;
            var li = el("li"), a = el("a");
            a.href = U.KOK + sy.s.html + "#ara=" + encodeURIComponent(q);
            a.appendChild(el("span", "yer", "Sayı " + sy.s.sayi + (b.h ? " · " + b.h : "")));
            var p = el("span", "par"); p.appendChild(vurguluMetin(b.t, b.n, tok)); a.appendChild(p);
            li.appendChild(a); ul.appendChild(li);
          });
        });
        $("araDurum").textContent = bulunan ? (bulunan >= SINIR ? "İlk " + SINIR + " sonuç gösteriliyor; aramayı daraltın." : bulunan + " sonuç.") : "Sonuç yok. Daha kısa ya da farklı bir sözcük deneyin.";
      });
    }
    kutu.addEventListener("input", function () { clearTimeout(zam); zam = setTimeout(ara, 220); });
    var m = /[?&]q=([^&]+)/.exec(location.search); if (m) { kutu.value = decodeURIComponent(m[1]); }
    setTimeout(function () { try { kutu.focus({ preventScroll: true }); } catch (e) {} }, 50);
  }

  // =========================================================
  // KARNE
  // =========================================================
  var BOLUM_SIRA = ["Ana gazete", "Farmakoloji", "Yoğun bakım", "Algoloji", "YDUS"];
  function karneKur() {
    $("karneSifirla").addEventListener("click", function () {
      if (!confirm("Bütün soru karnesi ve tekrar listesi bu cihazdan silinsin mi? Bu geri alınamaz.")) return;
      U.karneKaydet({}); karneCiz();
    });
    karneCiz();
  }
  function karneCiz() {
    var k = U.karne(), ids = Object.keys(k), simdi = Date.now();
    var dogru = 0, ogrenilen = 0, ileride = 0, bolum = {};
    ids.forEach(function (id) {
      var r = k[id]; if (r.ok) dogru++;
      if (!r.ok && r.ogrenildi) ogrenilen++;
      if (!r.ok && !r.ogrenildi && (r.n || 0) > simdi) ileride++;
      var b = r.b || "Ana gazete"; bolum[b] = bolum[b] || { c: 0, d: 0 }; bolum[b].c++; if (r.ok) bolum[b].d++;
    });
    var oz = $("karneOzet"); oz.textContent = "";
    [[ids.length, "çözülen"], [ids.length ? Math.round(100 * dogru / ids.length) + "%" : "—", "ilk denemede doğru"], [U.tekrarListesi().length, "tekrar bekleyen"]].forEach(function (x) {
      var d = el("div"); d.appendChild(el("b", null, String(x[0]))); d.appendChild(el("span", null, x[1])); oz.appendChild(d);
    });
    var bb = $("karneBolum"); bb.textContent = "";
    var adlar = Object.keys(bolum).sort(function (a, b) { var x = BOLUM_SIRA.indexOf(a), y = BOLUM_SIRA.indexOf(b); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
    if (!adlar.length) bb.appendChild(el("p", "durum", "Henüz soru çözmedin. Sayılardaki sorularda bir şıkka dokunman yeterli."));
    adlar.forEach(function (a) {
      var v = bolum[a], yz = Math.round(100 * v.d / v.c), sat = el("div", "cubuk");
      sat.appendChild(el("span", null, a));
      var bar = el("div", "bar"), i = el("i"); i.style.width = yz + "%"; bar.appendChild(i); sat.appendChild(bar);
      sat.appendChild(el("span", "yuzde", v.d + "/" + v.c + " · %" + yz));
      bb.appendChild(sat);
    });
    // tekrar
    var tk = $("karneTekrar"); tk.textContent = "";
    var bekleyen = U.tekrarListesi();
    $("karneTekrarBaslik").textContent = bekleyen.length ? "Tekrar zamanı gelenler (" + bekleyen.length + ")" : "Tekrar zamanı gelen soru yok";
    if (!bekleyen.length) tk.appendChild(el("p", "durum", (ileride ? ileride + " soru ileri bir tarihte tekrar edilecek. " : "") + (ogrenilen ? ogrenilen + " yanlış soruyu tekrarlarla öğrendin." : "")));
    bekleyen.slice(0, 10).forEach(function (r) { tk.appendChild(U.soruCiz(r, function () { setTimeout(karneOzetTazele, 0); })); });
    if (bekleyen.length > 10) tk.appendChild(el("p", "durum", "Kalan " + (bekleyen.length - 10) + " soru bu bitince gelecek."));
    // sayılara göre
    hepsiniYukle(ilerlemeYaz("karneSayiDurum")).then(function (r) {
      $("karneSayiDurum").textContent = "";
      var ul = $("karneSayi"); ul.textContent = "";
      var kk = U.karne();
      r.liste.forEach(function (sy) {
        var top = sy.sorular.length, coz = 0, dg = 0;
        sy.sorular.forEach(function (q) { var x = kk[q.id]; if (x) { coz++; if (x.ok) dg++; } });
        var li = el("li"), a = el("a", null, "Sayı " + sy.s.sayi + (sy.s.konu ? " · " + sy.s.konu : "")); a.href = U.KOK + sy.s.html;
        li.appendChild(a);
        li.appendChild(el("span", null, top ? (coz === top ? "tamamı çözüldü · " + dg + " doğru" : coz + "/" + top + " çözüldü" + (coz ? " · " + dg + " doğru" : "")) : "soru yok"));
        ul.appendChild(li);
      });
    });
  }
  function karneOzetTazele() {
    var ozet = $("karneOzet").children; if (!ozet.length) return;
    var k = U.karne(), ids = Object.keys(k), d = 0; ids.forEach(function (i) { if (k[i].ok) d++; });
    ozet[2].querySelector("b").textContent = String(U.tekrarListesi().length);
  }

  // =========================================================
  // DESTE (aralıklı tekrar)
  // =========================================================
  var DESTE = "udp-deste-v1", DESTE_GUN = "udp-deste-gun", DESTE_LIMIT = "udp-deste-limit";
  var ARALIK = [1, 3, 7, 14, 30, 60];
  var desteFiltre = "Tümü", kuyruk = null, kartlar = [];
  function bugun() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function gunDurum() { var g = U.oku(DESTE_GUN, null); if (!g || g.g !== bugun()) g = { g: bugun(), yeni: 0 }; return g; }
  function desteKur() {
    var lim = $("desteLimit"); lim.value = String(U.oku(DESTE_LIMIT, 10));
    lim.addEventListener("change", function () { U.yaz(DESTE_LIMIT, parseInt(lim.value, 10)); kuyruk = null; desteCiz(); });
    hepsiniYukle(ilerlemeYaz("desteDurum", "Kartlar toplanıyor")).then(function (r) {
      kartlar = [];
      r.liste.slice().reverse().forEach(function (sy) { sy.inciler.forEach(function (x) { kartlar.push(x); }); });  // eskiden yeniye
      var bolumler = ["Tümü"];
      kartlar.forEach(function (x) { if (bolumler.indexOf(x.b) < 0) bolumler.push(x.b); });
      var f = $("desteFiltre"); f.textContent = "";
      bolumler.forEach(function (b) {
        var bt = el("button", null, b); bt.type = "button"; bt.setAttribute("aria-pressed", b === desteFiltre ? "true" : "false");
        bt.addEventListener("click", function () { desteFiltre = b; Array.prototype.forEach.call(f.children, function (c) { c.setAttribute("aria-pressed", c === bt ? "true" : "false"); }); kuyruk = null; desteCiz(); });
        f.appendChild(bt);
      });
      desteCiz();
    });
  }
  function kuyrukKur() {
    var dur = U.oku(DESTE, {}), simdi = Date.now(), g = gunDurum(), limit = U.oku(DESTE_LIMIT, 10);
    var uygun = kartlar.filter(function (x) { return desteFiltre === "Tümü" || x.b === desteFiltre; });
    var vadeli = uygun.filter(function (x) { return dur[x.id] && dur[x.id].n <= simdi; }).sort(function (a, b) { return dur[a.id].n - dur[b.id].n; });
    var yeniler = uygun.filter(function (x) { return !dur[x.id]; }).slice(0, Math.max(0, limit - g.yeni));
    kuyruk = vadeli.concat(yeniler);
  }
  function desteCiz() {
    if (!kartlar.length) { if (hazir.deste) { $("desteKart").textContent = ""; } return; }
    if (!kuyruk) kuyrukKur();
    var dur = U.oku(DESTE, {}), toplam = kartlar.length, ezber = 0, gorulmemis = 0;
    kartlar.forEach(function (x) { var d = dur[x.id]; if (!d) gorulmemis++; else if (d.k >= 4) ezber++; });
    $("desteDurum").textContent = "Bugün kalan: " + kuyruk.length + " · Toplam " + toplam + " kart · Oturmuş (14+ gün): " + ezber + " · Hiç görülmemiş: " + gorulmemis;
    var kap = $("desteKart"); kap.textContent = "";
    if (!kuyruk.length) {
      var bos = el("div", "kart");
      bos.appendChild(el("div", "on", "Bugünlük bu kadar."));
      bos.appendChild(el("div", null, gorulmemis ? "Yarın yeni kartlar açılacak. İstersen günlük yeni kart sayısını artır." : "Bütün kartları en az bir kez gördün; vadesi gelenler gününde dönecek."));
      kap.appendChild(bos); return;
    }
    var x = kuyruk[0], k = el("div", "kart");
    k.appendChild(el("div", "yer", "Sayı " + x.s + " · " + x.b + (x.baslik ? " · " + x.baslik : "")));
    k.appendChild(el("div", "on", x.on));
    var arka = el("div", "arka", x.arka); arka.hidden = true; k.appendChild(arka);
    var dg = el("div", "dugmeler");
    var goster = el("button", "btn", "Açıklamayı göster"); goster.type = "button";
    var tekrar = el("button", "btn kirmizi", "Tekrar sor"); tekrar.type = "button";
    var bil = el("button", "btn ana", "Biliyordum"); bil.type = "button";
    if (x.arka) { dg.appendChild(goster); tekrar.hidden = true; bil.hidden = true; }
    dg.appendChild(tekrar); dg.appendChild(bil); k.appendChild(dg);
    goster.addEventListener("click", function () { arka.hidden = false; goster.hidden = true; tekrar.hidden = false; bil.hidden = false; bil.focus(); });
    function puanla(bildi) {
      var d = U.oku(DESTE, {}), simdi = Date.now(), eski = d[x.id];
      if (!eski) { var g = gunDurum(); g.yeni++; U.yaz(DESTE_GUN, g); }
      var kut = bildi ? ((eski && eski.k) || 0) + 1 : 0;
      d[x.id] = { k: kut, n: bildi ? simdi + ARALIK[Math.min(kut, ARALIK.length) - 1] * GUN : simdi, t: simdi };
      U.yaz(DESTE, d);
      kuyruk.shift();
      if (!bildi) kuyruk.push(x);
      desteCiz();
    }
    tekrar.addEventListener("click", function () { puanla(false); });
    bil.addEventListener("click", function () { puanla(true); });
    kap.appendChild(k);
  }

  // =========================================================
  // ALET ÇANTASI
  // =========================================================
  function tablo(basliklar, satirlar) {
    var w = el("div", "tbl"), t = el("table"), th = el("tr");
    basliklar.forEach(function (b) { th.appendChild(el("th", null, b)); });
    var thead = el("thead"); thead.appendChild(th); t.appendChild(thead);
    var tb = el("tbody");
    satirlar.forEach(function (s) { var tr_ = el("tr"); s.forEach(function (h) { tr_.appendChild(el("td", null, h)); }); tb.appendChild(tr_); });
    t.appendChild(tb); w.appendChild(t); return w;
  }
  function satir(kap, etiket, deger, buyuk) { var p = el("p"); p.style.margin = "3px 0"; p.appendChild(el("span", null, etiket + ": ")); p.appendChild(el(buyuk ? "span" : "b", buyuk ? "buyuk" : null, deger)); kap.appendChild(p); }
  function aletKur() {
    sayilariAl().then(function (l) { if (l.length) $("abgLink").href = U.KOK + l[0].html + "#yogun-bakim"; });
    // boy-kilo
    function kHesap() {
      var o = H.kilo({ cins: $("kCins").value, boy: sayi($("kBoy").value), kg: sayi($("kKg").value) }), c = $("kCikti");
      c.textContent = "";
      if (!o) { c.textContent = "Boy ve kilo girin."; return; }
      satir(c, "Öngörülen (ideal) kilo, PBW", tr(o.pbw, 1) + " kg", true);
      satir(c, "Tidal volüm 6 mL/kg PBW", tr(o.vt6, 0) + " mL");
      satir(c, "8 mL/kg (başlangıç) / 4 mL/kg (alt sınır)", tr(o.vt8, 0) + " / " + tr(o.vt4, 0) + " mL");
      satir(c, "Vücut kitle indeksi", tr(o.bmi, 1) + " kg/m²");
      satir(c, "Yağsız kilo (LBW)", tr(o.lbw, 1) + " kg");
      satir(c, "Düzeltilmiş kilo", tr(o.duzeltilmis, 1) + " kg");
      satir(c, "Vücut yüzey alanı", tr(o.bsa, 2) + " m²");
      if (o.kisa) c.appendChild(el("p", "uyari", "Boy 152,4 cm'nin altında: PBW formülü bu boyda çok düşük değer verir, sonucu dikkatle yorumlayın."));
    }
    ["kCins", "kBoy", "kKg"].forEach(function (i) { $(i).addEventListener("input", kHesap); });
    // lokal anestezik
    var sel = $("laIlac");
    Object.keys(LA).forEach(function (k) { var o = el("option", null, LA[k].ad); o.value = k; sel.appendChild(o); });
    sel.value = "bupivakain";
    function laHesap() {
      var o = H.la({ ilac: sel.value, tip: $("laTip").value, epi: $("laEpi").value === "1", kg: sayi($("laKg").value), yuzde: sayi($("laYuzde").value) }), c = $("laCikti");
      c.textContent = "";
      if (!o) return;
      if (o.tavan == null) c.appendChild(el("p", "uyari", o.ad + " için " + TIP_AD[$("laTip").value] + " kitabın tablosunda yok."));
      else satir(c, "Tablodaki mutlak tavan (" + TIP_AD[$("laTip").value] + ")", tr(o.tavan, 0) + " mg");
      if (o.mgkg != null) satir(c, "Kiloya göre (" + tr(o.mgkg, 1) + " mg/kg)", o.kiloya != null ? tr(o.kiloya, 0) + " mg" : "kilo girin");
      else c.appendChild(el("p", "durum", o.ad + " için mg/kg sınırı verilmedi; yalnızca tablo tavanı kullanılır."));
      if (o.sinir != null) {
        satir(c, "Bu hasta için üst sınır", tr(o.sinir, 0) + " mg" + (o.kisitlayan === "kilo" ? " (kilo sınırlıyor)" : o.kisitlayan === "tavan" ? " (tavan sınırlıyor)" : ""), true);
        if (o.ml != null) satir(c, "%" + tr(sayi($("laYuzde").value), 3) + " (" + tr(o.mgml, 2) + " mg/mL) ile en çok", tr(o.ml, 1) + " mL", true);
        else c.appendChild(el("p", "durum", "Hacim için konsantrasyonu (%) girin."));
      }
      c.appendChild(el("p", "uyari", "İki lokal anestezik birlikte verilirse toksisite toplanır (Miller). Birden çok blokta dozların toplamı tavanı geçmemeli. Yaşlı, kalp/karaciğer/böbrek yetmezliği, gebelik ve interskalen gibi bölgelerde doz azaltılır."));
      if (sayi($("laKg").value) < 20) c.appendChild(el("p", "uyari", "Yenidoğan ve küçük süt çocuğu (Hadzic): bupivakain ve ropivakain için genellikle en çok 2–2,5 mg/kg, lidokain için 5–7 mg/kg. Sürekli infüzyonda bupivakain büyük çocukta 0,4, yenidoğanda 0,2 mg/kg/sa'i geçmemeli."));
    }
    ["laIlac", "laTip", "laEpi", "laKg", "laYuzde"].forEach(function (i) { $(i).addEventListener("input", laHesap); $(i).addEventListener("change", laHesap); });
    laHesap();
    // çocuk
    function cHesap() {
      var o = H.cocuk({ yas: sayi($("cYas").value), kg: sayi($("cKg").value), prematur: $("cPre").value === "1" }), c = $("cCikti");
      c.textContent = "";
      if (!o) { c.textContent = "Yaş ve kilo girin."; return; }
      satir(c, "Endotrakeal tüp (iç çap)", o.ett, true);
      c.appendChild(el("p", "durum", o.ettNot));
      satir(c, "İdame sıvı (4-2-1)", tr(o.sivi, 0) + " mL/sa");
      satir(c, "Tahmini kan hacmi", (o.hacim.alt === o.hacim.ust ? tr(o.hacim.alt, 0) : tr(o.hacim.alt, 0) + "–" + tr(o.hacim.ust, 0)) + " mL");
      c.appendChild(el("p", "durum", "Kan hacmi: " + o.hacim.not + "."));
      if (o.glukoz) satir(c, "Glukoz ihtiyacı (≤ 8 yaş)", (o.glukoz.alt === o.glukoz.ust ? tr(o.glukoz.alt, 0) : tr(o.glukoz.alt, 0) + "–" + tr(o.glukoz.ust, 0)) + " mg/dk");
      var kg = sayi($("cKg").value);
      c.appendChild(tablo(["İlaç · kg başına doz", "Bu çocuk için"], o.ilaclar.map(function (d) {
        var h = (d.alt === d.ust ? tr(d.alt, 2) : tr(d.alt, 2) + "–" + tr(d.ust, 2)) + " " + d.birim + (d.kirpildi ? " (tavana kırpıldı)" : "");
        return [d.ad + " · " + d.doz + " " + d.birim + "/kg" + (d.tavan != null ? ", en çok " + tr(d.tavan, 2) + " " + d.birim : ""), h];
      })));
      if (kg > 40) c.appendChild(el("p", "uyari", "40 kg üstünde erişkin dozlarını ve tavanlarını aşmayın."));
    }
    ["cYas", "cKg", "cPre"].forEach(function (i) { $(i).addEventListener("input", cHesap); $(i).addEventListener("change", cHesap); });
    // infüzyon
    var son = "doz";
    function iHesap(kaynak) {
      if (kaynak) son = kaynak;
      var birim = $("iBirim").value;
      var o = H.infuzyon({ mg: sayi($("iMg").value), ml: sayi($("iMl").value), kg: sayi($("iKg").value), birim: birim,
                           doz: son === "doz" ? sayi($("iDoz").value) : null, hiz: son === "hiz" ? sayi($("iHiz").value) : null });
      var c = $("iCikti"); c.textContent = "";
      if (!o) { c.textContent = "Torbadaki ilaç miktarını ve hacmi girin."; return; }
      satir(c, "Konsantrasyon", tr(o.kons, 1) + " mcg/mL (" + tr(o.kons / 1000, 3) + " mg/mL)");
      if (o.eksik) { c.appendChild(el("p", "uyari", "Bu doz birimi için kilo gerekir.")); return; }
      if (o.hiz != null && isFinite(o.hiz)) { $("iHiz").value = String(yuvarla(o.hiz, 2)); satir(c, "Hız", tr(o.hiz, 2) + " mL/sa", true); }
      else if (o.doz != null && isFinite(o.doz)) { $("iDoz").value = String(yuvarla(o.doz, 3)); satir(c, "Doz", tr(o.doz, 3) + " " + birim, true); }
      else c.appendChild(el("p", "durum", "Doz ya da hız alanından birini doldurun."));
    }
    ["iMg", "iMl", "iKg", "iBirim"].forEach(function (i) { $(i).addEventListener("input", function () { iHesap(); }); $(i).addEventListener("change", function () { iHesap(); }); });
    $("iDoz").addEventListener("input", function () { iHesap("doz"); });
    $("iHiz").addEventListener("input", function () { iHesap("hiz"); });
  }

  sekmeAc(location.hash.slice(1) || "ara", false);
})();
