# Mobil Header Düzeltmeleri — sitoded.jamcontest.com

**Tarih:** 2026-06-05

## Yapılan Değişiklikler

### 1. Dashboard Header (`views/dashboard.ejs`) — Kritik

| Sorun | Düzeltme |
|---|---|
| Logo 128px yükseklik — mobilde devasa | 44px (mobilde 30px) |
| `d-md-none` / `d-md-inline` Bootstrap class'ları çalışmıyordu (Bootstrap CSS yüklenmemiş!), butonlarda ikon+metin aynı anda görünüyordu | Custom `.show-mobile` / `.show-desktop` class'ları yazıldı. Mobilde sadece ikon, masaüstünde ikon+metin |
| Topbar 60px — mobil için fazla | 48px mobil |
| Buton padding'leri mobilde büyük | Küçültüldü |

### 2. Layout Navbar (`views/layout.ejs`)

- Mobil medya sorgusu **yoktu** → `@media (max-width: 576px)` eklendi
- `px-4` padding → `0.75rem` mobilde
- `navbar-brand` font-size: `1.4rem` → `1.15rem` mobilde
- `nav-link` font-size ve padding mobil için optimize edildi

### 3. Etkinlik Oluşturma (`views/events/create.ejs`)

- Topbar için mobil responsive yoktu → `@media (max-width: 720px)` içine topbar stilleri eklendi
- Topbar padding, title font-size, back-btn boyutu mobil için küçültüldü

## Sunucu

- Docker container `sitoded_app` içine yeni view dosyaları kopyalandı
- Container restart edildi, sorunsuz çalışıyor
- Port: `3075`, Nginx proxy: `https://sitoded.jamcontest.com`

## Mimari

```
sitoded.jamcontest.com (Nginx SSL)
  └─ proxy_pass → 127.0.0.1:3075 (Docker sitoded_app)
       ├─ Node.js + Express + EJS
       └─ PostgreSQL 15 (Docker sitoded_postgres, port 5433)
```

Diğer jamcontest.com alt alan adlarından tamamen izole: kendi Docker network'ü, kendi container'ları.
