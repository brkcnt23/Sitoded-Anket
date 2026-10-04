// ===== RAPOR MERKEZİ + DERBİS + BEYANNAME =====
// Her rapor: (a) Excel indirme, (b) `?format=html` ile sitede tablo görüntüleme.
// Yapı: rapor verisi önce "sheets" dizisi olarak kurulur, ortak renderer xlsx veya HTML üretir.
const express = require('express');
const path = require('path');
const pool = require('../database');
const { isAdmin } = require('./auth');
const { xl, newWorkbook, styleHeader, autoWidth, sendWorkbook } = require('./excel');

const router = express.Router();

function toDateStr(d) {
  if (!d) return '—';
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ===== ORTAK RENDERER =====
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function renderHtml(res, report) {
  const sheetsHtml = report.sheets.map(sheet => {
    const head = sheet.rows[0];
    const body = sheet.rows.slice(1);
    return '<section class="sheet">' +
      '<h3>' + escapeHtml(sheet.name) + '</h3>' +
      '<div class="table-wrap"><table>' +
      '<thead><tr>' + head.map(c => '<th>' + escapeHtml(c) + '</th>').join('') + '</tr></thead>' +
      '<tbody>' + body.map(r => '<tr>' + r.map(c => '<td>' + escapeHtml(c) + '</td>').join('') + '</tr>').join('') + '</tbody>' +
      '</table></div></section>';
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(report.title)} — Sitoded</title>
<script src="/js/theme.js?v=20260921"></script>
<link rel="icon" href="/img/site/favicon.ico" type="image/x-icon">

<link rel="stylesheet" href="/vendor/fonts.css">
<link rel="stylesheet" href="/css/theme.css?v=20260921">
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family:'DM Sans',sans-serif; background:var(--bg); color:var(--text); min-height:100vh; padding:0 0 60px; }
  .topbar { height:56px; background:var(--surface); border-bottom:1px solid var(--border); display:flex; align-items:center; gap:12px; padding:0 16px; position:sticky; top:0; z-index:100; }
  .back-btn { display:flex; align-items:center; gap:6px; padding:7px 12px; border-radius:7px; border:1px solid var(--border2); color:var(--muted); font-size:13px; font-weight:500; text-decoration:none; }
  .back-btn:hover { background:var(--surface2); color:var(--text); }
  .dl-btn { margin-left:auto; padding:8px 14px; border-radius:7px; background:var(--accent); color:var(--on-accent); font-size:13px; font-weight:600; text-decoration:none; }
  .page { width:100%; max-width:1100px; margin:0 auto; padding:24px 16px; }
  .page h1 { font-size:21px; font-weight:700; margin-bottom:4px; letter-spacing:-.3px; }
  .page .sub { font-size:12px; color:var(--muted); margin-bottom:22px; font-family:'DM Mono',monospace; }
  .sheet { background:var(--surface); border:1px solid var(--border); border-radius:12px; margin-bottom:18px; overflow:hidden; }
  .sheet h3 { padding:13px 16px; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; color:var(--muted); border-bottom:1px solid var(--border); }
  .table-wrap { overflow-x:auto; }
  table { width:100%; border-collapse:collapse; font-size:13px; white-space:nowrap; }
  th { text-align:left; padding:10px 14px; background:var(--surface2); color:var(--accent2); font-size:11px; text-transform:uppercase; letter-spacing:.4px; border-bottom:1px solid var(--border2); }
  td { padding:9px 14px; border-bottom:1px solid var(--border); }
  tr:last-child td { border-bottom:none; }
  tbody tr:hover { background:var(--surface2); }
</style>
<link rel="stylesheet" href="/css/platform.css?v=20260921">
<link rel="stylesheet" href="/css/workspace.css?v=20260921">
</head>
<body class="workspace ws-report" data-theme="light">
<div class="topbar">
  <a href="/admin?panel=reports" class="back-btn">← Raporlar</a>
  <a href="/" class="workspace-brand brand-lockup" aria-label="SİTODED ana sayfa"><img src="/img/site/brand-emblem.webp" alt="" width="44" height="44"><strong>SİTODED</strong></a>
  <a class="dl-btn" href="${escapeHtml(report.download_url)}">Excel indir ↓</a>
</div>
<div class="page">
  <span class="workspace-eyebrow">SİTODED / RAPOR MERKEZİ</span>
  <h1>${escapeHtml(report.title)}</h1>
  <div class="sub">${report.sheets.length} sayfa · tabloyu yatay kaydırarak tüm sütunları görebilirsiniz</div>
  ${sheetsHtml}
</div>
</body>
</html>`;
  res.send(html);
}

function buildXlsx(report) {
  const wb = newWorkbook();
  for (const sheet of report.sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31));
    sheet.rows.forEach((r, i) => ws.addRow(r.map(c => (i === 0 ? c : xl(c)))));
    styleHeader(ws);
    autoWidth(ws);
  }
  return wb;
}

async function renderReport(req, res, report) {
  const downloadUrl = new URL(req.originalUrl, 'http://localhost');
  downloadUrl.searchParams.delete('format');
  report.download_url = downloadUrl.pathname + downloadUrl.search;
  if (req.query.format === 'html') {
    return renderHtml(res, report);
  }
  await sendWorkbook(res, buildXlsx(report), report.filename);
}

// ===== 1) AYLIK ETKİNLİK RAPORU =====
router.get('/api/admin/reports/events-monthly', isAdmin, async (req, res) => {
  try {
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : null;
    if (!month) return res.status(400).render('errors/500', { message: 'Geçerli bir ay seçin (YYYY-MM)' });

    const [y, m] = month.split('-').map(Number);
    const start = `${month}-01`;
    const end = new Date(y, m, 0).getDate();

    const eventsResult = await pool.query(
      `SELECT e.id, e.title, e.event_date, e.start_time, e.end_time, e.location, e.capacity, e.status,
              t.name as team_name, u.full_name as leader_name,
              (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.status = 'CONFIRMED') as confirmed_count
       FROM events e
       JOIN teams t ON e.team_id = t.id
       JOIN users u ON e.leader_id = u.id
       WHERE e.event_date >= $1 AND e.event_date <= $2
       ORDER BY e.event_date ASC, e.start_time ASC`,
      [start, `${month}-${end}`]
    );

    const report = { title: `Aylık Etkinlik Raporu — ${month}`, filename: `etkinlik-raporu-${month}.xlsx`, sheets: [] };
    report.sheets.push({
      name: 'Etkinlikler',
      rows: [
        ['Tarih', 'Etkinlik', 'Saat', 'Konum', 'Ekip', 'Lider', 'Kapasite', 'Onaylı Katılım', 'Durum'],
        ...eventsResult.rows.map(e => [
          toDateStr(e.event_date), e.title, `${String(e.start_time || '').substring(0, 5)} - ${String(e.end_time || '').substring(0, 5)}`,
          e.location, e.team_name, e.leader_name, e.capacity, e.confirmed_count,
          e.status === 'CANCELLED' ? 'İptal' : 'Aktif'
        ])
      ]
    });

    for (const e of eventsResult.rows) {
      const parts = await pool.query(
        `SELECT u.full_name, er.status, ea.attended
         FROM event_registrations er
         JOIN users u ON er.user_id = u.id
         LEFT JOIN event_attendance ea ON ea.event_id = er.event_id AND ea.user_id = er.user_id
         WHERE er.event_id = $1 AND er.status IN ('CONFIRMED','REGISTERED')
         ORDER BY er.registered_at ASC`,
        [e.id]
      );
      report.sheets.push({
        name: `${toDateStr(e.event_date)} ${String(e.title).slice(0, 18)}`,
        rows: [
          ['Katılımcı', 'Kayıt Durumu', 'Katılım'],
          ...parts.rows.map(p => [
            p.full_name,
            p.status === 'CONFIRMED' ? 'Onaylı' : 'Bekleme',
            p.attended === true ? 'Geldi' : p.attended === false ? 'Gelmedi' : 'İşaretlenmedi'
          ])
        ]
      });
    }

    await renderReport(req, res, report);
  } catch (err) {
    console.error('Aylık rapor hatası:', err);
    res.status(500).render('errors/500', { message: 'Rapor oluşturulurken bir hata oluştu' });
  }
});

// ===== 2) GÖNÜLLÜ KARNESİ =====
router.get('/api/admin/reports/volunteer', isAdmin, async (req, res) => {
  try {
    const userId = req.query.user_id ? parseInt(req.query.user_id) : null;

    const usersResult = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.hierarchy_level, u.points, u.member_since, u.resigned_at,
              RANK() OVER (ORDER BY u.points DESC) as siralama,
              COALESCE(string_agg(DISTINCT t.name, ', '), '') as teams
       FROM users u
       LEFT JOIN user_teams ut ON ut.user_id = u.id
       LEFT JOIN teams t ON t.id = ut.team_id
       ${userId ? 'WHERE u.id = $1' : ''}
       GROUP BY u.id
       ORDER BY u.points DESC`,
      userId ? [userId] : []
    );
    if (userId && usersResult.rows.length === 0) {
      return res.status(404).render('errors/404');
    }

    const report = { title: userId ? 'Gönüllü Karnesi' : 'Gönüllü Karneleri', filename: userId ? `karnesi-${usersResult.rows[0].username}.xlsx` : 'gonullu-karneleri.xlsx', sheets: [] };

    const summaryRows = [['Sıralama', 'Ad Soyad', 'Kullanıcı', 'Ekip(ler)', 'Seviye', 'Puan', 'Üye/Gönüllü', 'Katıldığı Etkinlik', 'Katılım Oranı']];
    for (const u of usersResult.rows) {
      const stats = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM event_attendance ea WHERE ea.user_id = $1 AND ea.attended = TRUE) as attended,
           (SELECT COUNT(*) FROM event_registrations er WHERE er.user_id = $1 AND er.status = 'CONFIRMED') as confirmed
        `, [u.id]
      );
      const attended = parseInt(stats.rows[0].attended);
      const confirmed = parseInt(stats.rows[0].confirmed);
      const rate = confirmed > 0 ? Math.round((attended / confirmed) * 100) + '%' : '—';
      summaryRows.push([u.siralama, u.full_name, u.username, u.teams, u.hierarchy_level, u.points, toDateStr(u.member_since), attended, rate]);
    }
    report.sheets.push({ name: 'Karneler', rows: summaryRows });

    if (userId) {
      const u = usersResult.rows[0];
      const hist = await pool.query(
        `SELECT e.title, e.event_date, er.status, ea.attended
         FROM event_registrations er
         JOIN events e ON e.id = er.event_id
         LEFT JOIN event_attendance ea ON ea.event_id = er.event_id AND ea.user_id = er.user_id
         WHERE er.user_id = $1
         ORDER BY e.event_date DESC`,
        [userId]
      );
      report.sheets.push({
        name: 'Etkinlik Geçmişi',
        rows: [
          ['Etkinlik', 'Tarih', 'Kayıt', 'Katılım'],
          ...hist.rows.map(h => [
            h.title, toDateStr(h.event_date),
            h.status === 'CONFIRMED' ? 'Onaylı' : h.status === 'CANCELLED' ? 'İptal' : h.status,
            h.attended === true ? 'Geldi' : h.attended === false ? 'Gelmedi' : '—'
          ])
        ]
      });

      const pts = await pool.query(
        `SELECT pt.points_change, pt.reason, pt.created_at, e.title as event_title
         FROM point_transactions pt
         LEFT JOIN events e ON e.id = pt.event_id
         WHERE pt.user_id = $1 ORDER BY pt.created_at DESC`,
        [userId]
      );
      const reasons = { ATTENDANCE: 'Katılım', NO_SHOW: 'Gelmedi', MANUAL_EDIT: 'Manuel', LATE_CANCEL: 'Geç İptal' };
      report.sheets.push({
        name: 'Puan Geçmişi',
        rows: [
          ['Tarih', 'Puan', 'Sebep', 'Etkinlik'],
          ...pts.rows.map(p => [new Date(p.created_at).toLocaleString('tr-TR'), p.points_change, reasons[p.reason] || p.reason, p.event_title])
        ]
      });
    }

    await renderReport(req, res, report);
  } catch (err) {
    console.error('Gönüllü karnesi hatası:', err);
    res.status(500).render('errors/500', { message: 'Rapor oluşturulurken bir hata oluştu' });
  }
});

// ===== 3) EKİP RAPORU =====
router.get('/api/admin/reports/teams', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.name,
             (SELECT COUNT(*) FROM user_teams ut WHERE ut.team_id = t.id) as member_count,
             (SELECT u.full_name FROM users u WHERE u.id = t.leader_id) as leader_name,
             (SELECT COUNT(*) FROM events e WHERE e.team_id = t.id) as event_count,
             (SELECT COUNT(*) FROM events e WHERE e.team_id = t.id AND e.status = 'CANCELLED') as cancelled_count,
             (SELECT COUNT(*) FROM event_attendance ea
                JOIN events e ON e.id = ea.event_id
                WHERE e.team_id = t.id AND ea.attended = TRUE) as total_attendance
      FROM teams t
      ORDER BY t.name
    `);
    const report = {
      title: 'Ekip Raporu', filename: 'ekip-raporu.xlsx',
      sheets: [{
        name: 'Ekipler',
        rows: [
          ['Ekip', 'Üye Sayısı', 'Lider', 'Etkinlik', 'İptal', 'Toplam Katılım'],
          ...result.rows.map(r => [r.name, r.member_count, r.leader_name, r.event_count, r.cancelled_count, r.total_attendance])
        ]
      }]
    };
    await renderReport(req, res, report);
  } catch (err) {
    console.error('Ekip raporu hatası:', err);
    res.status(500).render('errors/500', { message: 'Rapor oluşturulurken bir hata oluştu' });
  }
});

// ===== 4) DERBİS: ÜYE HAREKETLERİ =====
router.get('/api/admin/reports/derbis/movements', isAdmin, async (req, res) => {
  try {
    const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : null;
    const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : null;

    const joined = await pool.query(
      `SELECT full_name, username, member_since FROM users
       WHERE member_since IS NOT NULL
         AND (${from ? 'member_since >= $1' : 'TRUE'})
         AND (${to ? 'member_since <= $2' : 'TRUE'})
       ORDER BY member_since DESC`,
      [from, to].filter(x => x !== null)
    );
    const left = await pool.query(
      `SELECT full_name, username, resigned_at FROM users
       WHERE resigned_at IS NOT NULL
         AND (${from ? 'resigned_at >= $1' : 'TRUE'})
         AND (${to ? 'resigned_at <= $2' : 'TRUE'})
       ORDER BY resigned_at DESC`,
      [from, to].filter(x => x !== null)
    );
    const recent = await pool.query(
      `SELECT full_name, username, member_since, resigned_at FROM users
       WHERE (member_since IS NOT NULL AND member_since >= CURRENT_DATE - INTERVAL '45 days')
          OR (resigned_at IS NOT NULL AND resigned_at >= CURRENT_DATE - INTERVAL '45 days')
       ORDER BY member_since DESC NULLS LAST`
    );

    const report = {
      title: 'DERBİS — Üye Hareketleri', filename: `derbis-uye-hareketleri${from ? '-' + from : ''}.xlsx`,
      sheets: [
        {
          name: 'Katılanlar',
          rows: [
            ['Ad Soyad', 'Kullanıcı', 'Üyelik Tarihi'],
            ...joined.rows.map(r => [r.full_name, r.username, toDateStr(r.member_since)])
          ]
        },
        {
          name: 'Ayrılanlar',
          rows: [
            ['Ad Soyad', 'Kullanıcı', 'Ayrılış Tarihi'],
            ...left.rows.map(r => [r.full_name, r.username, toDateStr(r.resigned_at)])
          ]
        },
        {
          name: '45 Gün Bildirim Listesi',
          rows: [
            ['Ad Soyad', 'Kullanıcı', 'Katıldı', 'Ayrıldı'],
            ...recent.rows.map(r => [r.full_name, r.username, toDateStr(r.member_since), toDateStr(r.resigned_at)])
          ]
        }
      ]
    };
    await renderReport(req, res, report);
  } catch (err) {
    console.error('DERBİS hareket hatası:', err);
    res.status(500).render('errors/500', { message: 'Rapor oluşturulurken bir hata oluştu' });
  }
});

// ===== 5) DERBİS: PASAPORT / VİZE UYARILARI =====
router.get('/api/admin/reports/derbis/warnings', isAdmin, async (req, res) => {
  try {
    const soon = await pool.query(
      `SELECT full_name, username, passport_no, passport_expiry, visa_status, phone
       FROM users
       WHERE passport_expiry IS NOT NULL
         AND passport_expiry <= CURRENT_DATE + INTERVAL '6 months'
         AND resigned_at IS NULL
       ORDER BY passport_expiry ASC`
    );
    const report = {
      title: 'Pasaport / Vize Uyarıları (6 ay kuralı)', filename: 'pasaport-uyarilari.xlsx',
      sheets: [{
        name: 'Uyarılar',
        rows: [
          ['Ad Soyad', 'Kullanıcı', 'Pasaport No', 'Bitiş Tarihi', 'Kalan Gün', 'Vize Durumu', 'Telefon'],
          ...soon.rows.map(r => {
            const days = Math.round((new Date(r.passport_expiry) - new Date()) / 86400000);
            return [r.full_name, r.username, r.passport_no, toDateStr(r.passport_expiry), days, r.visa_status, r.phone];
          })
        ]
      }]
    };
    await renderReport(req, res, report);
  } catch (err) {
    console.error('Pasaport uyarı hatası:', err);
    res.status(500).render('errors/500', { message: 'Rapor oluşturulurken bir hata oluştu' });
  }
});

// ===== 6) HİBE İSTATİSTİKLERİ =====
router.get('/api/admin/reports/derbis/grant-stats', isAdmin, async (req, res) => {
  try {
    const total = await pool.query(`SELECT COUNT(*) FROM users WHERE resigned_at IS NULL`);
    const disadvantaged = await pool.query(`SELECT COUNT(*) FROM users WHERE disadvantaged = TRUE AND resigned_at IS NULL`);
    const gender = await pool.query(
      `SELECT COALESCE(gender,'belirtmedi') as g, COUNT(*) FROM users WHERE resigned_at IS NULL GROUP BY g`
    );
    const ages = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE birth_date IS NOT NULL AND birth_date > CURRENT_DATE - INTERVAL '18 years') as under18,
         COUNT(*) FILTER (WHERE birth_date IS NOT NULL AND birth_date <= CURRENT_DATE - INTERVAL '18 years' AND birth_date >= CURRENT_DATE - INTERVAL '30 years') as between1830,
         COUNT(*) FILTER (WHERE birth_date IS NOT NULL AND birth_date < CURRENT_DATE - INTERVAL '30 years' AND birth_date >= CURRENT_DATE - INTERVAL '41 years') as between3140,
         COUNT(*) FILTER (WHERE birth_date IS NOT NULL AND birth_date < CURRENT_DATE - INTERVAL '41 years') as over41,
         COUNT(*) FILTER (WHERE birth_date IS NULL) as unknown
       FROM users WHERE resigned_at IS NULL`
    );
    const escOut = await pool.query(
      `SELECT full_name, username, birth_date
       FROM users
       WHERE birth_date IS NOT NULL AND resigned_at IS NULL
         AND (birth_date > CURRENT_DATE - INTERVAL '18 years' OR birth_date < CURRENT_DATE - INTERVAL '30 years')
       ORDER BY birth_date ASC`
    );

    const a = ages.rows[0];
    const report = {
      title: 'Hibe Başvuru İstatistikleri', filename: 'hibe-istatistikleri.xlsx',
      sheets: [
        {
          name: 'Özet',
          rows: [
            ['Metrik', 'Değer'],
            ['Toplam Aktif Üye', total.rows[0].count],
            ['Dezavantajlı Katılımcı (fewer opportunities)', disadvantaged.rows[0].count],
            ...gender.rows.map(g => ['Cinsiyet: ' + g.g, g.count]),
            ['18 yaş altı', a.under18],
            ['18-30 (ESC/Erasmus+ uygun)', a.between1830],
            ['31-40', a.between3140],
            ['41+', a.over41],
            ['Doğum tarihi bilinmeyen', a.unknown]
          ]
        },
        {
          name: 'ESC Yaş Aralığı Dışı',
          rows: [
            ['Ad Soyad', 'Kullanıcı', 'Doğum Tarihi'],
            ...escOut.rows.map(r => [r.full_name, r.username, toDateStr(r.birth_date)])
          ]
        }
      ]
    };
    await renderReport(req, res, report);
  } catch (err) {
    console.error('Hibe istatistik hatası:', err);
    res.status(500).render('errors/500', { message: 'Rapor oluşturulurken bir hata oluştu' });
  }
});

// ===== 7) YILLIK BEYANNAME PAKETİ =====
router.get('/api/admin/reports/derbis/annual', isAdmin, async (req, res) => {
  try {
    const year = /^\d{4}$/.test(req.query.year || '') ? parseInt(req.query.year) : new Date().getFullYear();
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    const activities = await pool.query(
      `SELECT e.title, e.event_date, e.location, t.name as team_name,
              (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.status = 'CONFIRMED') as participants
       FROM events e JOIN teams t ON e.team_id = t.id
       WHERE e.event_date >= $1 AND e.event_date <= $2 AND e.status <> 'CANCELLED'
       ORDER BY e.event_date ASC`,
      [start, end]
    );
    const joined = await pool.query(
      `SELECT full_name, username, member_since FROM users WHERE member_since >= $1 AND member_since <= $2 ORDER BY member_since`,
      [start, end]
    );
    const left = await pool.query(
      `SELECT full_name, username, resigned_at FROM users WHERE resigned_at >= $1 AND resigned_at <= $2 ORDER BY resigned_at`,
      [start, end]
    );
    const totalMembers = await pool.query(`SELECT COUNT(*) FROM users WHERE resigned_at IS NULL`);

    const report = {
      title: `Yıllık Beyanname Paketi — ${year}`, filename: `derbis-beyanname-${year}.xlsx`,
      sheets: [
        {
          name: 'Faaliyetler',
          rows: [
            ['Tarih', 'Etkinlik', 'Konum', 'Ekip', 'Katılımcı'],
            ...activities.rows.map(a => [toDateStr(a.event_date), a.title, a.location, a.team_name, a.participants])
          ]
        },
        {
          name: 'Üye Hareketleri',
          rows: [
            ['Tür', 'Ad Soyad', 'Kullanıcı', 'Tarih'],
            ...joined.rows.map(r => ['Katılan', r.full_name, r.username, toDateStr(r.member_since)]),
            ...left.rows.map(r => ['Ayrılan', r.full_name, r.username, toDateStr(r.resigned_at)]),
            ['ÖZET', `Katılan: ${joined.rows.length}`, `Ayrılan: ${left.rows.length}`, '']
          ]
        },
        {
          name: 'Özet',
          rows: [
            ['Metrik', 'Değer'],
            ['Yıl', year],
            ['Faaliyet Sayısı', activities.rows.length],
            ['Katılan Üye', joined.rows.length],
            ['Ayrılan Üye', left.rows.length],
            ['Aktif Üye (yıl sonu)', totalMembers.rows[0].count]
          ]
        }
      ]
    };
    await renderReport(req, res, report);
  } catch (err) {
    console.error('Beyanname hatası:', err);
    res.status(500).render('errors/500', { message: 'Rapor oluşturulurken bir hata oluştu' });
  }
});

// ===== ETKİNLİK RAPORU — BÜLTEN (PDF) =====
// Bültencilere verilecek düzgün PDF: logo + "RAPOR" + dönem özeti + etkinlik listesi.
// UTF-8: pdfkit + DroidSans TTF gömülü (Türkçe karakter desteği için şart).
const PDFDocument = require('pdfkit');
const PDF_FONT_REGULAR = path.join(__dirname, '..', 'public', 'fonts', 'DroidSans.ttf');
const PDF_FONT_BOLD = path.join(__dirname, '..', 'public', 'fonts', 'DroidSans-Bold.ttf');
const PDF_LOGO = path.join(__dirname, '..', 'public', 'img', 'site', 'pwa-512.png');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get('/api/admin/reports/events-newsletter', isAdmin, async (req, res) => {
  try {
    const { from, to } = req.query;
    let start = DATE_RE.test(from || '') ? from : null;
    let end = DATE_RE.test(to || '') ? to : null;
    if (!start || !end) {
      // Varsayılan: son 30 gün
      const t = new Date();
      const d = (x) => x.toISOString().substring(0, 10);
      end = d(t);
      start = d(new Date(t.getTime() - 30 * 24 * 60 * 60 * 1000));
    }
    if (start > end) [start, end] = [end, start];

    const eventsResult = await pool.query(
      `SELECT e.id, e.title, e.event_date, e.start_time, e.end_time, e.location, e.status,
              t.name as team_name, u.full_name as leader_name,
              (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.status = 'CONFIRMED') as confirmed_count,
              (SELECT COUNT(*) FROM event_attendance ea WHERE ea.event_id = e.id AND ea.attended = TRUE) as attended_count
       FROM events e
       JOIN teams t ON e.team_id = t.id
       JOIN users u ON e.leader_id = u.id
       WHERE e.event_date >= $1 AND e.event_date <= $2
       ORDER BY e.event_date ASC, e.start_time ASC`,
      [start, end]
    );
    const evs = eventsResult.rows;

    const stats = evs.reduce((a, e) => {
      a.events++;
      a.confirmed += Number(e.confirmed_count);
      a.attended += Number(e.attended_count);
      if (!a.teams.has(e.team_name)) a.teams.add(e.team_name);
      return a;
    }, { events: 0, confirmed: 0, attended: 0, teams: new Set() });

    const doc = new PDFDocument({ size: 'A4', margins: { top: 55, bottom: 55, left: 55, right: 55 } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="etkinlik-raporu-${start}-${end}.pdf"`);
    doc.pipe(res);

    doc.registerFont('Regular', PDF_FONT_REGULAR);
    doc.registerFont('Bold', PDF_FONT_BOLD);

    const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Alt bilgi: her sayfanın dibine (pipe modunda eski sayfalar buffer'da
    // kalmaz, bu yüzden switchToPage YOK — ilk sayfa burada, sonrakiler
    // pageAdded olayıyla çizilir)
    const footer = () => {
      // Kullanılabilir alanın İÇİNDE olmalı (satır yüksekliği dahil) — yoksa
      // pdfkit taşma sanıp yeni sayfa açar ve pageAdded ile sonsuz döngüye girer.
      const y = doc.page.height - doc.page.margins.bottom - 16;
      doc.font('Regular').fontSize(8.5).fillColor('#94a3b8')
         .text('SİTODED — Sivil Toplum Destekleme Derneği · Erzurum', doc.page.margins.left, y, { width: pageW, align: 'center' });
    };
    footer(); // 1. sayfa
    doc.on('pageAdded', footer);

    // Logo + "RAPOR"
    doc.image(PDF_LOGO, (doc.page.width - 84) / 2, doc.page.margins.top, { width: 84 });
    doc.y = doc.page.margins.top + 92;
    doc.font('Bold').fontSize(13).fillColor('#1e293b')
       .text('RAPOR', { align: 'center', characterSpacing: 4 });
    doc.moveDown(0.4);
    doc.font('Bold').fontSize(17).fillColor('#0f172a')
       .text('Etkinlik Raporu', { align: 'center' });
    doc.font('Regular').fontSize(10.5).fillColor('#64748b')
       .text(`${start} — ${end}`, { align: 'center' });
    doc.moveDown(1.2);

    // Özet kutusu
    const boxY = doc.y;
    const boxH = 52;
    doc.roundedRect(doc.page.margins.left, boxY, pageW, boxH, 8).fill('#f1f5f9');
    doc.fillColor('#0f172a');
    const colW = pageW / 3;
    const ozet = [
      ['Etkinlik', String(stats.events)],
      ['Onaylı Katılım', String(stats.confirmed)],
      ['Fiili Katılım', String(stats.attended)],
    ];
    ozet.forEach((o, i) => {
      const x = doc.page.margins.left + i * colW;
      doc.font('Bold').fontSize(19).text(o[1], x, boxY + 8, { width: colW, align: 'center' });
      doc.font('Regular').fontSize(9.5).fillColor('#64748b').text(o[0], x, boxY + 32, { width: colW, align: 'center' });
      doc.fillColor('#0f172a');
    });
    doc.y = boxY + boxH + 18;

    // Etkinlik listesi
    doc.font('Bold').fontSize(12).fillColor('#0f172a').text('Dönem Etkinlikleri');
    doc.moveDown(0.6);

    if (evs.length === 0) {
      doc.font('Regular').fontSize(10.5).fillColor('#64748b').text('Bu dönemde etkinlik bulunmuyor.');
    }

    evs.forEach((e) => {
      const canceled = e.status === 'CANCELLED';
      const title = (canceled ? '(İptal) ' : '') + e.title;
      const time = [String(e.start_time || '').substring(0, 5), String(e.end_time || '').substring(0, 5)]
        .filter(Boolean).join(' – ');
      const yBas = doc.y;
      if (yBas + 70 > doc.page.height - doc.page.margins.bottom) doc.addPage();

      doc.font('Bold').fontSize(11.5).fillColor('#0f172a').text(title);
      doc.font('Regular').fontSize(9.5).fillColor('#475569')
         .text(`${toDateStr(e.event_date)}${time ? ' · ' + time : ''}${e.location ? ' · ' + e.location : ''}`);
      doc.font('Regular').fontSize(9.5).fillColor('#64748b')
         .text(`${e.team_name} · Lider: ${e.leader_name} · Onaylı: ${e.confirmed_count} · Katılan: ${e.attended_count}`);
      doc.moveDown(0.75);
    });

    doc.end();
  } catch (err) {
    console.error('Etkinlik bülten raporu hatası:', err);
    res.status(500).render('errors/500', { message: 'Rapor oluşturulurken bir hata oluştu' });
  }
});

module.exports = router;
