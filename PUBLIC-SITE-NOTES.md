# SİTODED — tüm ekranların görsel yenilemesi, 20 Eylül 2026

Kullanıcının son yönlendirmesi: açık ve kurumsal bir tasarım; uyumlu renkli bölümler; doğru logo; konuyla ilişkili ve çeşitli görseller; admin, üye, anket, yoklama ve bütün görünen ekranların aynı tasarımda olması. Görsel üretimi açıkça onaylandı. Mevcut Express/EJS/PostgreSQL altyapısı korundu.

## Tasarım ve dosyalar

- `site.css` + `editorial.css`: halka açık sayfalar. Menüdeki her bağlantı ayrı sayfaya gider; TR/EN sunucu tarafında çalışır.
- `theme.css` + `platform.css` + `workspace.css`: tüm iç ekranlarda ortak açık palet, tipografi, form/tablo/buton/rozet/bildirim dili. Kayıtlı koyu tercih görünümü değiştirmez.
- Dokuz admin bölümü, üye ana sayfası, profil, kullanıcı oluşturma/düzenleme, etkinlik oluşturma/kayıt/yoklama, anket düzenleyicisi/yanıtları/açık form/başarı/kapalı durumları, giriş, QR, 403/404/500 ve HTML raporları güncellendi.
- Admin sekmeleri `?panel=...` ile doğrudan açılır; mobil menü Escape ile kapanır. Geniş tablolar kendi alanında yatay kayar, sayfanın tamamını taşırmaz.
- Admin profil tamamlanma rozeti HTML metni yerine gerçek rozet olarak görünür. Rapor Excel bağlantısı seçili ay/yıl/kullanıcı filtrelerini korur.
- Yazı tipleri, Bootstrap ve Bootstrap Icons `public/vendor` altında yerel sunulur; yazı tipi lisansları yanındadır.

## Görseller

Doğru logo kaynağı: `/home/can/sitoded-logo.png`; kullanılan optimize sürüm `public/img/site/brand-emblem.webp`. Resmî olmayan eski logo taslakları kullanılmaz.

11 son illüstrasyon: hero, sofia, visoko, braga, skopje, climate, children, culture, cycling, inclusion, women. Bunlar belge fotoğrafı değil, temsili editoryal çizimlerdir. Sofya zarf simgesi yerine kent ve medya gönüllülüğü sahnesi kullanır. Dört haberin dört ayrı görseli vardır. Ana sayfada on ayrı konu görseli kullanılır. Projelerde altı öne çıkan kapak ve konu ikonlarıyla okunaklı arşiv listesi bulunur; tüm 35 kayıt kendi ayrıntı sayfasına gider. Arama Türkçe karakterleri destekler.

- Kaynaklar: `assets/editorial-2026/*.png`.
- Üretim aracı: built-in `image_gen`. 11 seçilmiş son görsel; hero için bir düzeltme dahil toplam 12 çağrı.
- Kesin promptlar, çıktı yolları ve mod: `assets/editorial-2026/manifest.json`.
- Sunulan dosyalar: `public/img/editorial/*-{640,1200}.webp` — 22 dosya, toplam yaklaşık 3,2 MB. Responsive srcset ve lazy loading uygulanır.
- Eski 47 kullanıcı yüklemesi `assets/gorseller/orijinaller` altında korunur. Yeni sürümde sorunlu siyah arka planları maskelemek yerine açık ve tam opak görseller kullanıldı.

## İçerik

Arşiv: `content/archive.json` içinde 14 yerel + 21 uluslararası proje ve dört haber. Eski siteye runtime isteği yoktur. Geçmiş haber başvuruları kapalı olarak etiketlenir. Gelecek projelere doğrulanmamış takvim yazılmadı.

İçerik kaynakları:
- COP31 tarihi/yer: https://unfccc.int/cop31 — 9–20 Kasım 2026, Antalya.
- Katılım: https://unfccc.int/cop31/ifp — dernek eğitimi ve resmî konferans kaydı ayrı süreçler olarak anlatıldı.
- Türkiye başkanlığı: https://cop31.tr/tr
- Climate Zero: Prof. Dr. Süleyman Toy'un doğrudan eğitmen paylaşımı; arama dizininde ve aynı paylaşımın kullanıcı profillerindeki görünümünde kontrol edildi: https://tr.linkedin.com/posts/profdrs%C3%BCleymantoy58_a-vitally-important-erasmus-project-climate-activity-7449909918721118208-Q2WN
- İki günlük eğitim, sektörel etkiler, uyum/azaltım ve belediyenin yerel desteği bu paylaşımda anlatılıyor. Kesin yeni eğitim tarihi, kontenjan, resmî COP ortaklığı veya konferansa delege gönderme iddiası eklenmedi.
- ETÜ iş birliği: https://erzurum.edu.tr/duyuru/etu-sitoded-isbirligi-protokolu1
- Eurodesk temas noktası: https://eurodesk.ua.gov.tr/information-points?listType=all
- Tarihçe/alanlar: önceki kurumsal metinler ve /home/can/SITODED_ARASTIRMA.md. İletişim adresi mevcut siteden korundu.


## Kontroller ve yayın

Kalıcı 22 test: üyelik 9, halka açık site 10, tüm yönetim/form/rapor ve anket akışları 3. Ayrı PostgreSQL konteynerlerinde gerçek Chromium kullanılır. Test kapsamı ve komutlar `tests/README.md`; sonuçlar `test-results/` içindedir.

Dağıtım yalnız `docker-compose.prod.yml` içindeki app servisine yapılır. Bu yenilemede üretim verisi veya şema değiştirilmez.

Kaynak yedeği: `/home/can/backups/sitoded-complete-refresh/`.
Geri dönüş imajı: `sitoded-anket-app:before-complete-refresh`.
Önceki değişiklik notları: `assets/notes/public-site-before-complete-refresh.md`.

Son doğrulama: üyelik 9/9 ve public 10/10 `release-tests.log`; yönetim 3/3 `workspace-release.log`. Ağ sessizliğini bekleyen değişken test yerine ilgili API yanıtı ve ekranda verinin görünmesi beklenir. Sonuçların birleşik raporu `test-results/release-junit.xml` (22 başarılı); iki çalıştırmanın ham günlükleri korunur.

Yayın tamamlandı. Canlı 12 açık rota 200 yanıtı verdi; mobil/masaüstü kontrolleri ve görsel yüklenmeleri başarılı, JavaScript hatası yok. `test-results/live-smoke.json`; çalışan konteynerin ana şablon/CSS/rapor/font dosyaları yerel sürümle SHA-256 düzeyinde eşleşiyor.
