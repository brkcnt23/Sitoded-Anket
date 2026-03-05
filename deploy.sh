#!/bin/bash

# Sitoded Erzurum - Deploment Script
# Sunucuda çalıştırılacak: bash deploy.sh

echo "🚀 Sitoded Anket Deployment Başlıyor..."

# 1. Git Repository güncelle
echo "📦 Repository güncelleniyor..."
git pull origin main 2>/dev/null || echo "Git repo bulunamadı (ilk kurulum)"

# 2. Node paketleri yükle
echo "📚 Dependencies yükleniyor..."
npm install --production

# 3. Database'i düzenle (ilk kurulum için)
if [ ! -f ".db-initialized" ]; then
    echo "🗄️  Database başlatılıyor..."
    
    # PostgreSQL'de veritabanı ve user oluştur
    sudo -u postgres psql -c "CREATE USER burakcan_sitoded WITH PASSWORD 'Sitoded25Ikbal';" 2>/dev/null || echo "User zaten var"
    sudo -u postgres psql -c "CREATE DATABASE burakcan_sitoded_db OWNER burakcan_sitoded;" 2>/dev/null || echo "Database zaten var"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE burakcan_sitoded_db TO burakcan_sitoded;" 2>/dev/null
    
    # Tabloları oluştur
    psql -U burakcan_sitoded -d burakcan_sitoded_db -f database.sql
    
    # Seed data'yı ekle
    npm run seed
    
    touch .db-initialized
    echo "✅ Database initialized"
fi

# 4. PM2 ile başlat
echo "▶️  PM2 ile başlatılıyor..."
pm2 delete sitoded-anket 2>/dev/null || true
pm2 start ecosystem.config.js

# 5. Boot'a ekle
echo "🔄 Boot startup'a ekleniyor..."
pm2 startup
pm2 save

echo "✅ Deployment tamamlandı!"
echo "🌐 Server: http://185.72.9.232:5000"
