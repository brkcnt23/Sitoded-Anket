# 🚀 Sitoded Anket - Sunucuya Deployment Talimatı

Server IP: **185.72.9.232**  
Port: **5000**  
URL: http://185.72.9.232:5000

---

## 📋 1. Sunucuya Bağlan (SSH)

```bash
ssh user@185.72.9.232
# Şifreni gir
```

---

## 🔧 2. Proje Dosyalarını Sunucuya Yükle

### Option A: Git ile (Recommended)
```bash
# Sunucuda:
cd /home/user/projects  # veya başka bir path
git clone <repository-url> sitoded-anket
cd sitoded-anket
```

### Option B: SCP ile (Dosya kopyala)
Windows PowerShell'de:
```powershell
scp -r "C:\Users\brkcn\Desktop\Sitoded Anket" user@185.72.9.232:/home/user/projects/
```

---

## 💾 3. PostgreSQL Kurulumu (Sunucuda)

### a) PostgreSQL Servisini Kontrol Et
```bash
sudo systemctl status postgresql
# Eğer çalışmıyorsa:
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### b) Database ve User Oluştur
```bash
sudo -u postgres psql

# PostgreSQL konsol içinde:
CREATE USER burakcan_sitoped WITH PASSWORD 'Sitoded25Ikbal';
CREATE DATABASE burakcan_sitoded_db OWNER burakcan_sitoded;
GRANT ALL PRIVILEGES ON DATABASE burakcan_sitoded_db TO burakcan_sitoded;
\q
```

### c) Tabloları Oluştur
```bash
cd /home/user/projects/sitoded-anket
psql -U burakcan_sitoded -d burakcan_sitoded_db -f database.sql
```

---

## 📦 4. Node.js Paketleri Yükle

```bash
cd /home/user/projects/sitoded-anket
npm install --production
```

---

## 🌱 5. Seed Data (Test Verileri) Ekle

```bash
npm run seed

# Beklenen Output:
# 🌱 Seeding database...
# 📚 Creating teams...
# ✓ teams created...
# ✅ Database seeding completed successfully!
```

**Seed Data ile oluşturulanlar:**
- 10 adet Ekip
- 11 kullanıcı (Başkan, Koordinatör, 2 Senior, 4 Junior, 4 Gönüllü)
- 4 adet örnek etkinlik

**Test Login Bilgileri:**
```
Başkan: nuriye_memisoglu / Sitoded2026!
Koordinatör: kadir_ergun / Sitoded2026!
Senior #1: ayberk_oksuz / Sitoded2026!
Senior #2: bugrahann_enes / Sitoded2026!
```

---

## ▶️ 6. PM2 ile Başlat

### a) PM2 Kurulu mu? Kontrol Et
```bash
pm2 --version
# Kurulu değilse:
sudo npm install -g pm2
pm2 completion install
```

### b) Uygulamayı Başlat
```bash
cd /home/user/projects/sitoded-anket

# PM2 ile başlat
pm2 start ecosystem.config.js

# Status kontrol et
pm2 status

# Logları gör
pm2 logs sitoded-anket
```

### c) Boot'a Ekle (Server restart sonrası otomatik başlasın)
```bash
pm2 startup
pm2 save
```

---

## 🔄 7. Reverse Proxy Ayarla (Nginx)

Eğer sunucuda Nginx var ve başka siteler de host ediyorsan:

```bash
sudo nano /etc/nginx/sites-available/sitoded

# Aşağıdaki kodu ekle:
```

```nginx
server {
    listen 80;
    server_name sitoded.example.com;  # Domain'i değiştir

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable sitesi
sudo ln -s /etc/nginx/sites-available/sitoded /etc/nginx/sites-enabled/

# Nginx test et
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

---

## 🧪 8. Test Et

Tarayıcıda aç:
```
http://185.72.9.232:5000
```

Login yap:
- Kullanıcı: `ayberk_oksuz`
- Şifre: `Sitoded2026!`

---

## 📊 PM2 Komutları (Günlük Kullanım)

```bash
# Status görüntüle
pm2 status

# Logları gerçek zamanlıda izle
pm2 logs sitoded-anket -f

# Uygulamayı durdur
pm2 stop sitosed-anket

# Uygulamayı yeniden başlat
pm2 restart sitoded-anket

# Tüm PM2 uygulamalarını sil
pm2 delete all
```

---

## 🔐 Güvenlik Notları

1. **SSL/TLS:** Production'da HTTPS zorunludur. Let's Encrypt ile sertifika al:
```bash
sudo certbot certonly --standalone -d yourdomain.com
```

2. **Firewall:** 
```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 5000  # Sadece gerekirse
```

3. **.env Dosyası:** Production şifreleri değiştir
```bash
nano .env
# SESSION_SECRET ve database passwords'ü güncelle
```

---

## 🐛 Sorun Giderin

### Server başlamıyor
```bash
pm2 logs sitoded-anket
# Hataları kontrol et
```

### Database bağlantısı başarısız
```bash
psql -U burakcan_sitoded -d burakcan_sitoded_db
# Test et
```

### Port 5000 zaten kullanımda
```bash
lsof -i :5000
kill -9 <PID>
```

---

## 📞 Sorular?

Herhangibir sorun olursa kontrol listesini takip et ve logları kontrol et.

**Son Kontrol Listesi:**
- [ ] Git clone / files uploaded
- [ ] PostgreSQL başlıyor
- [ ] Database oluşturuldu
- [ ] Seed data yüklendi  
- [ ] npm packages installed
- [ ] PM2 çalışıyor
- [ ] Server erişilebilir (185.72.9.232:5000)
- [ ] Login çalışıyor
