#!/usr/bin/env python3
"""Bir sayıyı uygulamaya (PWA) ekler. Depo kökünden çalıştırılır; yalnızca standart kütüphane.

  python3 araclar/sayi_ekle.py --sayi 3 --tarih 2026-11-13 --html /yol/sayi.html [--pdf /yol/sayi.pdf]
          --manset "..." --konu "..." --yb "..." --agri "..."

Yaptıkları:
  - HTML'i sayilar/sayi-NN.html olarak kopyalar; eksikse doctype/charset/viewport ekler,
    uygulama etiketlerini (manifest, simge, uygulama.js) koyar, PDF bağlantısını düzeltir.
  - PDF verilmişse pdf/Uyku-Denizi-Postasi-Sayi-NN.pdf olarak kopyalar.
  - sayilar.json listesini günceller (aynı sayı varsa üzerine yazar).
Aynı sayı için tekrar çalıştırmak güvenlidir.
"""
import argparse, json, os, re, shutil, datetime

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
ISARET = "<!-- udp-uygulama -->"
BASLIK_EKI = ISARET + """
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#1f4e5f">
<link rel="manifest" href="../manifest.webmanifest">
<link rel="icon" href="../icons/favicon-32.png">
<link rel="apple-touch-icon" href="../icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Uyku Denizi">
<script src="../uygulama.js" defer></script>
"""


def sayfayi_hazirla(t):
    if ISARET in t:
        return t
    t = t.lstrip("﻿")
    # göreli PDF bağlantısı: sayfa sayilar/ altında durduğu için bir üst klasöre bakmalı
    t = re.sub(r'href="(?:\./)?pdf/', 'href="../pdf/', t)
    if re.search(r"<!doctype", t[:300], re.I):
        if re.search(r"</head>", t, re.I):
            return re.sub(r"</head>", lambda m: BASLIK_EKI + m.group(0), t, count=1, flags=re.I)
        return t.replace("<title>", BASLIK_EKI + "<title>", 1)
    # Artifact biçimi: belge iskeleti yok (doğrudan <title>, <style>, içerik)
    m = re.search(r"</style>", t, re.I)
    if m:
        bas, govde = t[:m.end()], t[m.end():]
    else:
        bas, govde = "", t
    return ('<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n' + BASLIK_EKI + bas +
            "\n</head>\n<body>\n" + govde + "\n</body>\n</html>\n")


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--sayi", type=int, required=True)
    a.add_argument("--tarih", required=True, help="YYYY-AA-GG")
    a.add_argument("--html", required=True)
    a.add_argument("--pdf")
    a.add_argument("--manset", default="")
    a.add_argument("--konu", default="")
    a.add_argument("--yb", default="")
    a.add_argument("--agri", default="")
    p = a.parse_args()
    nn = f"{p.sayi:02d}"
    os.makedirs(os.path.join(KOK, "sayilar"), exist_ok=True)
    os.makedirs(os.path.join(KOK, "pdf"), exist_ok=True)

    html_yol = f"sayilar/sayi-{nn}.html"
    t = open(p.html, encoding="utf-8").read()
    with open(os.path.join(KOK, html_yol), "w", encoding="utf-8", newline="\n") as f:
        f.write(sayfayi_hazirla(t))

    pdf_yol = None
    if p.pdf and os.path.exists(p.pdf):
        pdf_yol = f"pdf/Uyku-Denizi-Postasi-Sayi-{nn}.pdf"
        hedef = os.path.join(KOK, pdf_yol)
        if os.path.abspath(p.pdf) != os.path.abspath(hedef):
            shutil.copyfile(p.pdf, hedef)

    liste_yol = os.path.join(KOK, "sayilar.json")
    veri = json.load(open(liste_yol, encoding="utf-8")) if os.path.exists(liste_yol) else {"sayilar": []}
    g = datetime.date.fromisoformat(p.tarih)
    kayit = {"sayi": p.sayi, "tarih": p.tarih, "tarih_yazi": f"{g.day} {AYLAR[g.month - 1]} {g.year}",
             "html": html_yol, "pdf": pdf_yol, "manset": p.manset, "konu": p.konu,
             "yogun_bakim": p.yb, "algoloji": p.agri}
    eski = next((s for s in veri["sayilar"] if s["sayi"] == p.sayi), None)
    if eski and not pdf_yol:
        kayit["pdf"] = eski.get("pdf")
    veri["sayilar"] = sorted([s for s in veri["sayilar"] if s["sayi"] != p.sayi] + [kayit], key=lambda s: s["sayi"])
    veri["guncelleme"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(liste_yol, "w", encoding="utf-8", newline="\n") as f:
        json.dump(veri, f, ensure_ascii=False, indent=1)
    print(f"eklendi: {html_yol}" + (f" + {pdf_yol}" if pdf_yol else " (PDF yok)") + f" | toplam {len(veri['sayilar'])} sayı")


if __name__ == "__main__":
    main()
