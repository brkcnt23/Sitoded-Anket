const fs = require('fs');
const path = require('path');

// Logo dosyasını public klasörüne kopyala (eğer varsa)
const logoPath = path.join(__dirname, 'public', 'img');
if (!fs.existsSync(logoPath)) {
  fs.mkdirSync(logoPath, { recursive: true });
  console.log('✓ Logo klasörü oluşturuldu');
}

console.log('✓ Proje başlatmaya hazır!');
