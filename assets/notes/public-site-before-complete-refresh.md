# Kurumsal önyüz — 20 Eylül 2026

Kullanıcı yönlendirmesi: açık zemin, kurumsal dernek görünümü, ölçülü mevcut görsel kullanımı. Yeni AI görseli üretilmedi. Ana sayfa, /hakkimizda ve /cop31; ?lang=en ile sunucu tarafında İngilizce içerik. Ortak üye/admin teması değiştirilmedi.

Ana dosyalar: views/landing.ejs, views/public/*, public/css/site.css, public/js/site.js, lib/public-site.js. Optimize görseller public/img/site altında; orijinaller assets/gorseller altında korunur. Yapay zekâ ile hazırlanmış dergi kapağı ve kurum logosu taslakları gerçek yayın/logo olarak kullanılmadı.

İçerik kaynakları:
- COP31 tarihi/yer: https://unfccc.int/cop31 — 9–20 Kasım 2026, Antalya.
- Katılım: https://unfccc.int/cop31/ifp — dernek eğitimi ve resmî konferans kaydı ayrı süreçler olarak anlatıldı.
- Türkiye başkanlığı: https://cop31.tr/tr
- Climate Zero: Prof. Dr. Süleyman Toy'un doğrudan eğitmen paylaşımı; arama dizininde ve aynı paylaşımın kullanıcı profillerindeki görünümünde kontrol edildi: https://tr.linkedin.com/posts/profdrs%C3%BCleymantoy58_a-vitally-important-erasmus-project-climate-activity-7449909918721118208-Q2WN
- İki günlük eğitim, sektörel etkiler, uyum/azaltım ve belediyenin yerel desteği bu paylaşımda anlatılıyor. Kesin yeni eğitim tarihi, kontenjan, resmî COP ortaklığı veya konferansa delege gönderme iddiası eklenmedi.
- ETÜ iş birliği: https://erzurum.edu.tr/duyuru/etu-sitoded-isbirligi-protokolu1
- Eurodesk temas noktası: https://eurodesk.ua.gov.tr/information-points?listType=all
- Tarihçe/alanlar: önceki kurumsal metinler ve /home/can/SITODED_ARASTIRMA.md. İletişim adresi mevcut siteden korundu.

Test: 7 yeni gerçek tarayıcı testi başarılı. Tüm paket 16 test; önceki üyelik sorunlarına ait 5 test hâlâ başarısız. Görseller: test-results/b006f39444ac/.

Kod yedeği: /home/can/backups/sitoded-frontend-20260920-195150.
Dağıtım hedefi: docker-compose.prod.yml içindeki yalnız app servisi; veritabanında migration veya veri değişikliği yapılmaz.


## 20 Eylül 2026 — ayrı sayfalar ve ortak açık tema
- Menüde Hakkımızda, Çalışmalarımız, Projeler, Haberler, COP31 ve İletişim ayrı sayfalardır. Ana sayfa giriş yapan üyelerce de ziyaret edilebilir.
- Kaynak site arşivindeki 14 yerel ve 21 uluslararası proje ile dört haber `content/archive.json` içinde tutulur. Sunum sırasında eski siteye istek atılmaz. İçe alma betiği `scripts/import-public-content.py`; kaynak kopyaları `content/source-cache/` (Docker imajına dahil edilmez).
- Haberlerin 22 Mayıs 2026 başvuru son tarihi geçmiştir; arşiv ve kapalı başvuru olarak etiketlidir. Gelecek projelerde doğrulanmamış takvim üretilmedi.
- Ana görsel değiştirildi. Mevcut yüklemelerden 12 farklı illüstrasyon WebP olarak kullanıldı; yeni yapay zekâ görseli üretilmedi. Resmî olmayan logo/dergi taslakları yayımlanmadı.
- `platform.css` ve `theme.css` üye, yönetim, anket ve profil sayfalarında ortak açık paleti uygular. Kayıtlı koyu tema tercihi artık tasarımı değiştirmez.
- Tekli ilgi/yetenek seçimlerinin kaydı, şifre ekranının rozet verisi, etkinlik tarihi ve iptal durumu düzeltildi. Kalıcı regresyon testleri korunur.
- Geri dönüş imajı: `sitoded-anket-app:before-expanded-pages-20260920`; kaynak yedeği: `/home/can/backups/sitoded-pages-20260920/`.

## Görsel çeşitliliği ve gönderilen logo
- Kullanıcının `/home/can/sitoded-logo.png` dosyası gerçek marka kaynağı olarak kullanıldı; `brand-emblem.webp`, ortak `brand.ejs` ve yeni favicon üretildi. Eski kule logosu kullanım dışı.
- 35 projede konuyla eşleştirilmiş 17 farklı görsel; konumlu dünya yalnız ana girişte. Çocuk, çevre, Erzurum, topluluk, eğitim ve kültür görselleri ayrı; 11, 13, 16, 17, 19, 20, 21, 26, 28, 33, 40, 43 numaralı mevcut varlıklar optimize edildi. Yeni AI görseli üretilmedi.
- Kalıcı public E2E, marka kaynağını ve proje görsellerinin çeşitliliğini de doğrular.
