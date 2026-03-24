# Local Development Setup Guide

## Prerequisites
- Docker & Docker Compose
- Node.js 18+

## Quick Start

### 1. Start PostgreSQL Database

```bash
docker-compose up -d
```

Bu komut bir PostgreSQL 15 container'ı başlatır. Container hazır olması 10-15 saniye sürebilir.

**Kontrol etmek için:**
```bash
docker-compose ps
```

### 2. NPM Dependencies Yükle

```bash
npm install
```

### 3. Database Seed (İsteğe Bağlı - Test Verileri)

```bash
npm run seed
```

Bu komut test kullanıcıları, takımları ve etkinlikleri veritabanına ekler.

### 4. Uygulamayı Başlat

Development mode (auto-reload ile):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Uygulama şu adreste açılacak: **http://localhost:3075**

## Docker Commands

### PostgreSQL konteynerini durdur
```bash
docker-compose down
```

### PostgreSQL konteynerini durdur ve verileri sil
```bash
docker-compose down -v
```

### PostgreSQL logsunu görmek
```bash
docker-compose logs postgres
```

### PostgreSQL'e bağlan (psql)
```bash
docker-compose exec postgres psql -U burakcan_sitoded -d burakcan_sitoded_db
```

## Default Credentials

**Database:**
- Host: localhost
- Port: 5432
- User: `burakcan_sitoded`
- Password: `Sitoded25Ikbal`
- Database: `burakcan_sitoded_db`

**Test Users (seed.js sonrasında):**
- Admin: `burakcan` / `asd123`
- Diğer test hesapları seed.js dosyasında tanımlıdır

## Troubleshooting

### "Connection refused" hatası
```bash
# Docker container'ının çalışıp çalışmadığını kontrol et
docker-compose ps

# Eğer ayakta değilse başlat
docker-compose up -d
```

### Database şeması yok
```bash
# Veritabanını temizle ve yeniden başlat
docker-compose down -v
docker-compose up -d

# Seed çalıştır
npm run seed
```

### Port 5432 zaten kullanılıyor
`docker-compose.yml` içinde port numarasını değiştir:
```yaml
ports:
  - "5433:5432"  # Yeni port
```

## Development Workflow

1. **Database değişiklikleri:**
   - Şema değişiklikleri → `database.sql` güncelle
   - Sonra: `docker-compose down -v && docker-compose up -d`

2. **Yeni seed verileri:**
   - `seed.js` güncelle
   - Sonra: `npm run seed`

3. **Migration yapılmışsa:**
   - `migration.sql` dosyasını kontrol et
   - Gerekirse docker-compose ile birlikte çalıştır
