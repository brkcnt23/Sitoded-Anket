# 📋 SITODED ERZURUM - ANKET SISTEMI
## Proje Özeti

### ✅ Tamamlanan Özellikler:

**1. Kimlik Doğrulama**
- ✓ Login/Logout sistemi
- ✓ Passport.js + bcrypt entegrasyonu
- ✓ Session yönetimi (24 saat)

**2. Rol Tabanlı Erişim**
- ✓ 5 hiyerarşi seviyesi (VOLUNTEER, JUNIOR, SENIOR, COORDINATOR, PRESIDENT)
- ✓ 4 rol seviyesi (VOLUNTEER, JUNIOR, SENIOR, ADMIN)
- ✓ Dinamik menü (rolüne göre farklı seçenekler)

**3. Yönetim Paneli (Admin)**
- ✓ Yeni hesap oluşturma (manual)
- ✓ Kullanıcı görüntüleme ve yönetimi
- ✓ Ekip ve hiyerarşi atama
- ✓ Body (body) atama (junior'lardan)

**4. Ekip Sistemi**
- ✓ 10 ekip (hazır tanımlanmış)
- ✓ Ekip liderleri
- ✓ Kullanıcı-Ekip ilişkilendirmesi (M2M)

**5. Etkinlik Yönetimi (Senior tarafından)**
- ✓ Etkinlik oluşturma
- ✓ Başlık, açıklama, yer, zaman, kontenjan
- ✓ Etkinlik iptal (sadece leader veya admin)

**6. Katılım Sistemi (Gönüllüler)**
- ✓ Etkinliklere katılma ("Katılıyorum" butonu)
- ✓ İlk tıklayan kazanır (first-come-first-serve)
- ✓ Kontenjan yönetimi
- ✓ Sıra sistemi (queue)
- ✓ Kontenjan boşalınca otomatik sıradakini al

**7. Pazar Gece 12:00 Sistemi**
- ✓ Otomatik deadline hesaplama
- ✓ Kayıt süresi sona erince:
  - Katılmaktan vazgeçerse: -1 puan
  - Tercihini değiştirmek isterse: -1 puan

**8. Katılımcı Listesi**
- ✓ Onaylı katılımcılar görüntüleme
- ✓ Sıradaki katılımcılar
- ✓ İptal edilenler
- ✓ Sadece event leader/admin erişim

**9. Veritabanı**
- ✓ PostgreSQL (5 tablo + M2M ilişkileri)
- ✓ Proper indexing
- ✓ Foreign keys ve constraints

**10. Kodu Gizleme**
- ✓ Compiled/transpiled değil (binary)
- ✓ Environment variables (.env)
- ✓ PM2 process manager
- ✓ Helmet.js + security headers

---

## 🗂️ Proje Yapısı

```
sitoded-anket/
├── server.js                 # Express server (main)
├── database.js               # PostgreSQL pool
├── database.sql              # Schema oluşturma
├── seed.js                   # Test verisi
├── ecosystem.config.js       # PM2 konfigurasyonu
├── package.json              # Dependencies
├── .env                       # Ortam değişkenleri
├── DEPLOYMENT.md             # Sunucuya kurulum
├── README.md                 # Dokümantasyon
├── views/                    # EJS Templates
│   ├── login.ejs
│   ├── dashboard.ejs
│   ├── layout.ejs
│   ├── admin/
│   │   ├── panel.ejs
│   │   └── create_user.ejs
│   ├── events/
│   │   ├── create.ejs
│   │   └── registrations.ejs
│   └── errors/
│       ├── 404.ejs
│       ├── 403.ejs
│       └── 500.ejs
└── public/
    ├── css/
    │   └── style.css
    └── img/
        └── sitoded-logo.png
```

---

## 🚀 Quickstart (Lokal)

```bash
# 1. Paketleri yükle
npm install

# 2. .env dosyasını ayarla (zaten ayarlı)
cat .env

# 3. PostgreSQL database'i hazırla (sunucuda)
psql -U postgres
CREATE USER burakcan_sitoded WITH PASSWORD 'Sitoded25Ikbal';
CREATE DATABASE burakcan_sitoded_db OWNER burakcan_sitoded;
\q

# 4. Tabloları oluştur
psql -U burakcan_sitoded -d burakcan_sitoded_db -f database.sql

# 5. Seed data load et
npm run seed

# 6. Development'ta çalıştır
npm run dev

# Veya production'da PM2 ile
pm2 start ecosystem.config.js
```

---

## 👥 Test Kullanıcıları (Seed'den sonra)

| Kullanıcı | Şifre | Rol | Ekipler |
|-----------|-------|-----|---------|
| nuriye_memisoglu | Sitoded2026! | ADMIN | - |
| kadir_ergun | Sitoded2026! | SENIOR | Organizasyon |
| ayberk_oksuz | Sitoded2026! | SENIOR | Türkçe Eğitim, Kültür Sanat |
| bugrahann_enes | Sitoded2026! | SENIOR | İngilizce Eğitim, Sosyal Medya |
| mehmet_junior_1 | Sitoded2026! | JUNIOR | Türkçe Eğitim |
| Can_volunteer | Sitoded2026! | VOLUNTEER | Türkçe Eğitim |

---

## 🔐 Güvenlik Özellikleri

✓ HTTPS ready (production'da)  
✓ Password hashing (bcrypt)  
✓ SQL injection protection (parameterized queries)  
✓ Session security  
✓ CSRF tokens  
✓ Helmet.js headers  
✓ CORS konfigürasyonu  
✓ Environment variable isolation  

---

## 📊 Veritabanı Şeması

### users
- id, username, email, password_hash, full_name
- hierarchy_level, role, body_for, points
- timestamps

### teams
- id, name, description, leader_id

### user_teams (M2M)
- user_id, team_id

### events
- id, title, description, location, event_date, capacity
- leader_id, team_id, status
- registration_deadline, timestamps

### event_registrations
- id, event_id, user_id, status
- registered_at, cancelled_at, queue_position

---

## 🌐 Deployment

Sunucuya deploy etmek için:
```bash
# DEPLOYMENT.md dosyasını oku ve takip et
cat DEPLOYMENT.md
```

**Server:** http://185.72.9.232:5000

---

## 📝 Sonraki Aşamalar (V2)

- [ ] Body sistemi otomatizasyonu
- [ ] Email bildirimleri
- [ ] Dashboard analytics
- [ ] API documentation (Swagger)
- [ ] Mobile responsive iyileştirme
- [ ] Multi-language support (EN/KU)
- [ ] Risk almayan kullanıcıları otomatik test

---

## 🆘 Sorun Giderme

**Evet** — Logları kontrol edin:
```bash
pm2 logs sitoded-anket
```

Herhangi soru varsa DEPLOYMENT.md'yi kontrol edin.

---

**Sitosed Erzurum 2026**
