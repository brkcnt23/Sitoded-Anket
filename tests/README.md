# Kalıcı uçtan uca testler

```sh
npm ci
npx puppeteer browsers install chrome
docker pull postgres:15-alpine
npm test
```

Node.js 22.12+ ve Docker erişimi gerekir. Mevcut Chrome için `PUPPETEER_EXECUTABLE_PATH` kullanılabilir.

Gerçek Express uygulaması, Chromium ve her dosya için geçici PostgreSQL konteyneri kullanılır. Üretim adresi/veritabanı kabul edilmez. Üye ve etkinlikler test verisidir; işlem sonunda test konteyneri ve verisi silinir. SQL yalnız başlangıç verisi ve kalıcılık kontrolü içindir; kullanıcı akışları gerçek form/API üzerinden yürür.

## Kapsam (22 test)

- `membership.test.cjs` — 9 test: admin üye açar → profil tamamlanır → admin tamamlanma rozetini görür; tek/çoklu/boş ilgi-yetenek seçimleri; başarılı/hatalı şifre değişimi ve yeniden giriş; etkinlik tarihi/katılım/iptal; geri bildirim Yeni/Okundu/Tamamlandı/silme; üye yetkilerinin sınırları.
- `public.test.cjs` — 10 test: 1440/768/390/360 pikselde taşma ve görseller; mobil menü/Escape; JavaScript olmadan TR/EN; COP31 kaynakları; başvuru/giriş; ayrı sayfa navigasyonu, 35 proje ve dört haberin tüm detayları; proje araması; doğru logo ve görsel çeşitliliği; kayıtlı koyu tema tercihinin etkisiz olması.
- `workspace.test.cjs` — 3 kapsamlı akış: dokuz yönetim sekmesinin masaüstü/mobil kullanımı ve doğrudan bağlantıları; kullanıcı, etkinlik, profil, yoklama, kayıt, giriş, hata, QR ve rapor ekranları; anket düzenleme → soru kaydetme → yayına açma → katılımcı yanıtı → adminin yanıtı görmesi → soruların kilitlenmesi → kapatma. Başarı/kapalı durumları, mobil yerleşim, HTML kaçışı ve rapor indirme filtreleri de kontrol edilir.

```sh
npm run test:site
npm run test:workspace
node tests/run-e2e.cjs membership
node tests/live-smoke.cjs
```

Son komut yalnız yayındaki sitenin açık sayfalarını okur; giriş yapmaz, form göndermez, veri değiştirmez. Diğer testler ayrı test veritabanında çalışır.

JUnit: `test-results/junit.xml`; tek paket için `<paket>-junit.xml`. Ekran görüntüleri ve uygulama günlükleri `test-results/<çalıştırma-kodu>/` altındadır. Bu klasör üretim Docker imajına alınmaz.

Testler hataları gizlemez: hata varsa çıkış kodu sıfırdan farklıdır. Kapsam belirtilen akışlardır; tüm olası veri ve yetki birleşimlerinin eksiksiz testi değildir. Zorla durdurma temizliği engellerse yalnız `sitoded.e2e=true` etiketli `sitoded-e2e-` konteynerleri incelenir; canlı servisler silinmez.
