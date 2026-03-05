# Sitoded Erzurum - Anket Sistemi

Sitoded Erzurum dernegi için gönüllü yönetimi ve etkinlik katılım sistemi.

## 🚀 Teknik Stack

- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **View Engine**: EJS
- **Process Manager**: PM2
- **Authentication**: Passport.js

## 📋 Ön Koşullar

- Node.js (v14+)
- PostgreSQL (v12+)
- PM2 (for production)

## 🔧 Kurulum

### 1. Repository Klonla
```bash
cd /path/to/Sitoded Anket
```

### 2. Paketleri Yükle
```bash
npm install
```

### 3. Veritabanını Oluştur
```bash
# PostgreSQL'e bağlan ve şu komutları çalıştır:
psql -U postgres

# Konsol içinde:
CREATE USER burakcan_sitoded WITH PASSWORD 'Sitoded25Ikbal';
CREATE DATABASE burakcan_sitoded_db OWNER burakcan_sitoded;
GRANT ALL PRIVILEGES ON DATABASE burakcan_sitoded_db TO burakcan_sitoded;
\q

# Sonra tabloları oluştur:
psql -U burakcan_sitoded -d burakcan_sitoped_db -f database.sql

# Seed data'yı ekle (development/setup):
npm run seed
```

### 4. Environment Değişkenlerini Ayarla
`.env` dosyasını düzenle:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sitoded_anket
DB_USER=sitoded_user
DB_PASSWORD=sitoded_password

SESSION_SECRET=your-secret-key-here

PORT=5000
NODE_ENV=production
```

## 🏃 Çalıştırma

### Development Modu
```bash
npm run dev
```

### Production Modu (PM2)

#### PM2 Kurulumu
```bash
npm install -g pm2
pm2 completion install
```

#### Başlatma
```bash
pm2 start ecosystem.config.js
```

#### PM2 Komutları
```bash
# Status görüntü
pm2 status

# Logları görüntü
pm2 logs

# Uygulamayı durdur
pm2 stop sitoded-anket

# Uygulamayı yeniden başlat
pm2 restart sitoded-anket

# Uygulamayı sil
pm2 delete sitoded-anket

# Boot'unkle başlatmak için (server restart sonrası otomatik başlasın)
pm2 startup
pm2 save
```

## 📁 Klasör Yapısı

```
.
├── server.js              # Main Express app
├── database.js            # PostgreSQL bağlantı
├── database.sql           # SQL schemas
├── ecosystem.config.js    # PM2 configuration
├── .env                   # Environment variables
├── package.json           # Dependencies
├── views/                 # EJS templates
│   ├── login.ejs
│   ├── dashboard.ejs
│   ├── admin/
│   │   ├── panel.ejs
│   │   └── create_user.ejs
│   ├── events/
│   │   ├── create.ejs
│   │   └── registrations.ejs
│   ├── errors/
│   │   ├── 404.ejs
│   │   ├── 403.ejs
│   │   └── 500.ejs
│   └── layout.ejs
└── public/                # Static files
    └── css/
        └── style.css
```

## 🔐 Security

- HTTPS zorunlu (production'da)
- Session cookies secure flag'i (production'da)
- Password hashing (bcrypt)
- CSRF protection
- SQL injection proteksiyonu (parameterized queries)

## 📊 Veritabanı Schema

### users
- id (PRIMARY KEY)
- username (UNIQUE)
- email (UNIQUE)
- password_hash
- full_name
- hierarchy_level (VOLUNTEER, JUNIOR, SENIOR, COORDINATOR, PRESIDENT)
- role (ADMIN, SENIOR, JUNIOR, VOLUNTEER)
- body_for (FK to users.id)
- points
- created_at, updated_at

### teams
- id (PRIMARY KEY)
- name (UNIQUE)
- description
- leader_id (FK to users.id)

### user_teams (M2M)
- user_id
- team_id

### events
- id (PRIMARY KEY)
- title
- description
- location
- event_date
- capacity
- leader_id (FK to users.id)
- team_id (FK to teams.id)
- status (ACTIVE, CANCELLED, COMPLETED)
- registration_deadline

### event_registrations
- id (PRIMARY KEY)
- event_id (FK to events.id)
- user_id (FK to users.id)
- status (REGISTERED, CANCELLED, NO_SHOW, CONFIRMED)
- registered_at
- cancelled_at
- queue_position

## 🎯 Özellikler

- ✅ Kullanıcı kimlik doğrulaması (Login/Logout)
- ✅ Rol tabanlı erişim kontrolü
- ✅ Admin paneli (hesap oluşturma)
- ✅ Etkinlik oluşturma ve yönetimi
- ✅ Etkinlyere katılım (first-come-first-serve)
- ✅ Sıra sistemi (queue management)
- ✅ Puan sistemi
- ✅ Katılımcı listesi görüntüleme

## 🐛 Troubleshooting

### Database Bağlantı Hatası
```bash
# PostgreSQL servisini kontrol et
sudo systemctl status postgresql

# Veya MacOS için
brew services list
```

### Port Zaten Kullanımda
```bash
# Port 5000'i kullanan süreci bulup kapat
lsof -i :5000
kill -9 <PID>
```

### PM2 Sorunları
```bash
# PM2 loglarını kontrol et
pm2 logs sitoded-anket

# PM2'yi sıfırla
pm2 kill
pm2 start ecosystem.config.js
```

## 📞 İletişim

Sorunlar veya öneriler için lütfen yöneticiye başvurunuz.

## 📄 Lisans

Sitoded Erzurum 2026
