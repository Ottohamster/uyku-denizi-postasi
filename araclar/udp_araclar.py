#!/usr/bin/env python3
"""Uyku Denizi Postası - bulut rutini yardımcı araçları (yalnızca standart kütüphane; pdf için playwright).

  python3 udp_araclar.py coz     <indirme_sonucu> <hedef_dosya>
  python3 udp_araclar.py bolum   <kitaplar_klasoru> <kitap> <ilk_sayfa> <son_sayfa> <cikti.txt>
  python3 udp_araclar.py ara     <kitaplar_klasoru> <kitap> "<aranan metin>"
  python3 udp_araclar.py bulmaca <kelimeler.json> [en_fazla_sutun=13]
  python3 udp_araclar.py pdf     <sayfa.html> <cikti.pdf>
  python3 udp_araclar.py kontrol <sayfa.html> <durum.json>

kitap: marino | morgan | basics | hadzic | miller | barash | stoelting | chestnut | yao | jaffe
Sayfa numaraları 0 tabanlıdır ve kitap-indeksi.json ile aynıdır.
kitaplar_klasoru: manifest.json ile <kitap>-pNN.txt.gz dosyalarının indirildiği klasör.
"""
import sys, os, re, json, gzip, random, subprocess, tempfile

ISARET = re.compile(r"\n\f=== s\.(\d+) ===\n")


def coz(kaynak, hedef):
    """Drive download_file_content sonucunu gerçek dosyaya çevirir.
    Sonuç ya doğrudan dosyadır (blob) ya da {"content": "<base64>", ...} biçiminde JSON metnidir."""
    import base64, shutil, hashlib
    ham = open(kaynak, "rb").read()
    veri = None
    if ham[:1] in (b"{", b"["):
        try:
            j = json.loads(ham.decode("utf-8"))
            if isinstance(j, list):
                j = next((x for x in j if isinstance(x, dict) and "content" in x), j[0])
            if isinstance(j, dict) and "text" in j and "content" not in j:
                j = json.loads(j["text"])
            if isinstance(j, dict) and isinstance(j.get("content"), str) and j.get("id"):
                veri = base64.b64decode(j["content"])
        except Exception:
            veri = None
    os.makedirs(os.path.dirname(os.path.abspath(hedef)), exist_ok=True)
    if veri is None:
        shutil.copyfile(kaynak, hedef)
    else:
        open(hedef, "wb").write(veri)
    b = open(hedef, "rb").read()
    print(f"{hedef} | {len(b)} bayt | sha256 {hashlib.sha256(b).hexdigest()}")


def _parcalar(klasor, kitap):
    m = json.load(open(os.path.join(klasor, "manifest.json"), encoding="utf-8"))
    if kitap not in m:
        sys.exit(f"manifest.json içinde '{kitap}' yok. Olanlar: {', '.join(m)}")
    return m[kitap]


def _sayfalar(klasor, kitap, ilk, son):
    """(sayfa_no, metin) üretir; yalnızca gereken parçaları açar."""
    for p in _parcalar(klasor, kitap)["parcalar"]:
        if p["son_sayfa"] < ilk or p["ilk_sayfa"] > son:
            continue
        yol = os.path.join(klasor, p["dosya"])
        if not os.path.exists(yol):
            sys.exit(f"Eksik parça: {p['dosya']} (Drive 'kitaplar' klasöründen indirip {klasor} içine bu adla koy)")
        t = gzip.open(yol, "rt", encoding="utf-8").read()
        b = ISARET.split(t)  # ['', no, metin, no, metin...]
        for i in range(1, len(b) - 1, 2):
            n = int(b[i])
            if ilk <= n <= son:
                yield n, b[i + 1]


def bolum(klasor, kitap, ilk, son, cikti):
    n = 0
    with open(cikti, "w", encoding="utf-8") as f:
        for no, metin in _sayfalar(klasor, kitap, int(ilk), int(son)):
            f.write(f"\n--- s.{no} ---\n{metin}")
            n += 1
    print(f"yazıldı: {cikti} | {kitap} s.{ilk}-{son} | {n} sayfa | {os.path.getsize(cikti)} bayt")


def ara(klasor, kitap, aranan):
    a = aranan.lower()
    say = 0
    for no, metin in _sayfalar(klasor, kitap, 0, 10 ** 9):
        k = metin.lower().find(a)
        if k >= 0:
            say += 1
            print(f"s.{no}: ...{' '.join(metin[max(0, k - 60):k + 100].split())}...")
            if say >= 40:
                print("(ilk 40 eşleşme)"); break
    if not say:
        print("eşleşme yok")


# ---------------------------------------------------------------- bulmaca
def _tr_buyuk(s):
    return s.replace("i", "İ").replace("ı", "I").upper()


def _yerlestir(kelimeler, maxw, deneme):
    rnd = random.Random(deneme)
    sira = sorted(kelimeler, key=lambda k: -len(k["h"]))
    if deneme:
        bas, kalan = sira[0], sira[1:]
        rnd.shuffle(kalan)
        sira = [bas] + kalan
    izgara, konan = {}, []

    def uygun(h, r, c, d):
        dr, dc = (0, 1) if d == "A" else (1, 0)
        if izgara.get((r - dr, c - dc)) or izgara.get((r + dr * len(h), c + dc * len(h))):
            return -1
        kesisim = 0
        for i, ch in enumerate(h):
            rr, cc = r + dr * i, c + dc * i
            var = izgara.get((rr, cc))
            if var:
                if var[0] != ch or d in var[1]:
                    return -1
                kesisim += 1
            else:
                if izgara.get((rr + dc, cc + dr)) or izgara.get((rr - dc, cc - dr)):
                    return -1
        return kesisim

    def koy(k, r, c, d):
        dr, dc = (0, 1) if d == "A" else (1, 0)
        for i, ch in enumerate(k["h"]):
            x = (r + dr * i, c + dc * i)
            izgara[x] = (ch, izgara[x][1] + d) if x in izgara else (ch, d)
        konan.append({**k, "r": r, "c": c, "d": d})

    koy(sira[0], 0, 0, "A")
    bekleyen = sira[1:]
    for _ in range(4):
        kalan = []
        for k in bekleyen:
            h, adaylar = k["h"], []
            for (r, c), (ch, yon) in list(izgara.items()):
                if len(yon) > 1:
                    continue
                d = "D" if yon == "A" else "A"
                for i, x in enumerate(h):
                    if x != ch:
                        continue
                    r0, c0 = (r - i, c) if d == "D" else (r, c - i)
                    ks = uygun(h, r0, c0, d)
                    if ks < 1:
                        continue
                    cs = [cc for (_, cc) in izgara] + [c0, c0 + (len(h) - 1 if d == "A" else 0)]
                    if max(cs) - min(cs) + 1 > maxw:
                        continue
                    rs = [rr for (rr, _) in izgara] + [r0, r0 + (len(h) - 1 if d == "D" else 0)]
                    adaylar.append((-ks, max(rs) - min(rs), rnd.random(), r0, c0, d))
            if adaylar:
                _, _, _, r0, c0, d = min(adaylar)
                koy(k, r0, c0, d)
            else:
                kalan.append(k)
        if len(kalan) == len(bekleyen):
            break
        bekleyen = kalan
    return konan, bekleyen


def bulmaca(dosya, maxw=13):
    """kelimeler.json: [{"w":"VAPORİZATÖR","q":"ipucu"}, ...]  -> sayfaya yapıştırılacak W, H ve words dizisi."""
    girdi = json.load(open(dosya, encoding="utf-8"))
    kelimeler = []
    for g in girdi:
        w = _tr_buyuk(g["w"]).replace(" ", "").replace("-", "")
        h = list(w)
        if len(h) > maxw:
            print(f"UYARI: '{w}' {maxw} harften uzun, atlandı", file=sys.stderr); continue
        kelimeler.append({"w": w, "h": h, "q": g["q"]})
    en_iyi = None
    for deneme in range(400):
        konan, kalan = _yerlestir(kelimeler, int(maxw), deneme)
        rs = [k["r"] + (len(k["h"]) - 1 if k["d"] == "D" else 0) for k in konan] + [k["r"] for k in konan]
        puan = (len(kalan), max(rs) - min(rs))
        if en_iyi is None or puan < en_iyi[0]:
            en_iyi = (puan, konan, kalan)
        if puan[0] == 0 and deneme > 60:
            break
    _, konan, kalan = en_iyi
    r0 = min(k["r"] for k in konan); c0 = min(k["c"] for k in konan)
    for k in konan:
        k["r"] -= r0; k["c"] -= c0
    W = max(k["c"] + (len(k["h"]) if k["d"] == "A" else 1) for k in konan)
    H = max(k["r"] + (len(k["h"]) if k["d"] == "D" else 1) for k in konan)
    # numaralama: soldan sağa, yukarıdan aşağı; aynı hücreden başlayanlar aynı numarayı alır
    no, n = {}, 0
    for k in sorted(konan, key=lambda k: (k["r"], k["c"])):
        if (k["r"], k["c"]) not in no:
            n += 1; no[(k["r"], k["c"])] = n
        k["n"] = no[(k["r"], k["c"])]
    konan.sort(key=lambda k: (k["n"], k["d"]))
    # doğrulama: her hücrede tek harf, her kelime en az bir kesişim
    hucre = {}
    for k in konan:
        dr, dc = (0, 1) if k["d"] == "A" else (1, 0)
        for i, ch in enumerate(k["h"]):
            x = (k["r"] + dr * i, k["c"] + dc * i)
            assert hucre.setdefault(x, ch) == ch, f"çakışma {x}"
            assert 0 <= x[0] < H and 0 <= x[1] < W
    print(f"// yerleşen {len(konan)} kelime, {W} sütun x {H} satır. .cw için: grid-template-columns:repeat({W},var(--cell))")
    if kalan:
        print("// YERLEŞMEYEN (başka kelime seç ya da çıkar): " + ", ".join(k["w"] for k in kalan))
    print(f"  var W = {W}, H = {H};")
    print("  var words = [")
    print(",\n".join(
        f'    {{n:{k["n"]}, w:{json.dumps(k["w"], ensure_ascii=False)}, r:{k["r"]}, c:{k["c"]}, d:"{k["d"]}", q:{json.dumps(k["q"], ensure_ascii=False)}}}'
        for k in konan))
    print("  ];")
    for r in range(H):
        print("// " + "".join(hucre.get((r, c), "·") for c in range(W)))


# ---------------------------------------------------------------- pdf
def pdf(html, cikti):
    """Etkileşimli sayfayı A4 PDF'e basar (print CSS'i ile). Gerekirse playwright + chromium kurar."""
    import shutil
    # Kâğıt dokusu (feTurbulence) her sayfada rasterleşip PDF'i ~8 MB yapıyor. Yalnızca baskı kopyasında
    # dokuyu kaldır (renk ve gölgeler kalır): PDF ~1,5 MB olur, Drive'a buluttan yüklenebilir.
    t = open(html, encoding="utf-8").read()
    hafif = ("\n<style>@media print{.sheet{background-image:radial-gradient(ellipse at 15% 10%,rgba(255,250,235,.55),"
             "transparent 55%),radial-gradient(ellipse at 90% 95%,rgba(150,110,60,.28),transparent 50%)!important}}</style>\n")
    t = t.replace("</head>", hafif + "</head>", 1) if "</head>" in t else t.replace("</style>", "</style>" + hafif, 1)
    gecici = os.path.join(tempfile.mkdtemp(), "baski.html")
    open(gecici, "w", encoding="utf-8").write(t)
    html = gecici
    os.makedirs(os.path.dirname(os.path.abspath(cikti)) or ".", exist_ok=True)
    for ad in ("google-chrome", "chromium", "chromium-browser", "msedge"):
        exe = shutil.which(ad)
        if not exe:
            continue
        subprocess.run([exe, "--headless=new", "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer",
                        "--virtual-time-budget=10000", f"--print-to-pdf={os.path.abspath(cikti)}",
                        "file:///" + os.path.abspath(html).replace(os.sep, "/").lstrip("/")], capture_output=True, timeout=180)
        if os.path.exists(cikti) and os.path.getsize(cikti) > 20000:
            sayfa = len(re.findall(rb"/Type\s*/Page[^s]", open(cikti, "rb").read()))
            print(f"pdf yazıldı ({ad}): {cikti} | {os.path.getsize(cikti)} bayt | ~{sayfa} sayfa")
            return
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "playwright"])
        from playwright.sync_api import sync_playwright

    def bas():
        with sync_playwright() as p:
            b = p.chromium.launch(args=["--no-sandbox"])
            s = b.new_page()
            s.goto("file://" + os.path.abspath(html), wait_until="load")
            try:
                s.wait_for_load_state("networkidle", timeout=15000)
            except Exception:
                pass
            s.wait_for_timeout(1500)
            s.emulate_media(media="print")
            s.pdf(path=cikti, format="A4", print_background=True,
                  margin={"top": "10mm", "bottom": "10mm", "left": "8mm", "right": "8mm"})
            b.close()
    try:
        bas()
    except Exception as e:
        if "Executable doesn't exist" not in str(e) and "playwright install" not in str(e):
            raise
        subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
        bas()
    print(f"pdf yazıldı: {cikti} | {os.path.getsize(cikti)} bayt")


# ---------------------------------------------------------------- kontrol
def kontrol(html, durum_yolu):
    t = open(html, encoding="utf-8").read()
    durum = json.load(open(durum_yolu, encoding="utf-8"))
    hata, uyari = [], []
    for i, s in enumerate(re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", t, flags=re.S)):
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
            f.write(s)
        r = subprocess.run(["node", "--check", f.name], capture_output=True, text=True)
        if r.returncode:
            hata.append(f"script #{i + 1} sözdizimi hatası: {r.stderr.strip()[:300]}")
    for gerekli in ['class="front"', 'class="clips"', 'class="topic"', 'class="news"', 'id="yogun-bakim"',
                    'id="algoloji"', 'class="puzzle"', "var words = [", "@media print", "<details"]:
        if gerekli not in t:
            hata.append(f"eksik bölüm/işaret: {gerekli}")
    if "abg" not in t:
        hata.append("kan gazı çözücü (abg) bulunamadı")
    linkler = sorted(set(re.findall(r'href="(https?://[^"]+)"', t)))
    eski = set(durum.get("kullanilan_haber_linkleri", []))
    # ana sayfa linkleri (yol yok) tekrar sayılmaz; makale/haber linkleri tekrar edemez
    tekrar = [l for l in linkler if l in eski and re.sub(r"^https?://[^/]+", "", l).strip("/")]
    if tekrar:
        hata.append("önceki sayılarda kullanılmış linkler: " + ", ".join(tekrar))
    if len(linkler) < 12:
        uyari.append(f"yalnızca {len(linkler)} dış link var")
    yeni_no = durum.get("son_sayi", 0) + 1
    if not re.search(rf"Sayı\s*{yeni_no}\b", t):
        uyari.append(f"sayfada 'Sayı {yeni_no}' ifadesi bulunamadı")
    for yasak in ["One Piece", "Luffy", "Mugiwara", "Zoro"]:
        if yasak.lower() in t.lower():
            hata.append(f"yasak marka/karakter adı: {yasak}")
    print(json.dumps({"bayt": len(t.encode("utf-8")), "dis_link_sayisi": len(linkler), "hatalar": hata,
                      "uyarilar": uyari, "linkler": linkler}, ensure_ascii=False, indent=1))
    sys.exit(1 if hata else 0)


if __name__ == "__main__":
    komutlar = {"coz": coz, "bolum": bolum, "ara": ara, "bulmaca": bulmaca, "pdf": pdf, "kontrol": kontrol}
    if len(sys.argv) < 2 or sys.argv[1] not in komutlar:
        sys.exit(__doc__)
    komutlar[sys.argv[1]](*sys.argv[2:])
