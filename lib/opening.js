// Pazar açılış sistemi — ortak zaman hesapları (server.js ve seed.js kullanır)
// Tüm hesaplar yerel (Europe/Istanbul) duvar saatiyle çalışır.

const SLOT_HOURS = [12, 19]; // Başvurular bu saatlerden birinde açılır
const WINDOW_HOURS = 5; // Başvuru penceresi 5 saat sürer

// Yerel tarih -> 'YYYY-MM-DD'
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// 'YYYY-MM-DD' tarihinden kesinlikle önceki son Pazar (yerel saat)
function lastSundayStrictlyBefore(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`); // öğlen — gün sınırı kayması olmaz
  const back = (d.getDay() + 7) % 7; // getDay(): 0=Pazar
  d.setDate(d.getDate() - (back === 0 ? 7 : back)); // Pazar ise 7 gün geri (kesin önce)
  d.setHours(0, 0, 0, 0);
  return d;
}

// Verilen Pazar günü için henüz geçmemiş aday slotlar (12:00, 19:00)
function candidateSlots(sunday, now = new Date()) {
  return SLOT_HOURS
    .map((h) => {
      const d = new Date(sunday);
      d.setHours(h, 0, 0, 0);
      return d;
    })
    .filter((d) => d.getTime() > now.getTime());
}

// Açılış + 5 saat = kapanış
function closeTime(open) {
  return new Date(open.getTime() + WINDOW_HOURS * 3600 * 1000);
}

// Dashboard geri sayımı için sonraki açılış zamanı.
// existingOpenTime: o Pazar için weekly_openings'e yazılmış slot (yoksa null).
function nextOpeningTime(existingOpenTime, now = new Date()) {
  const day = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + (day === 0 ? 0 : 7 - day)); // bu Pazar (bugün Pazar ise bugün)
  sunday.setHours(0, 0, 0, 0);

  if (existingOpenTime) {
    const t = new Date(existingOpenTime);
    if (t.getTime() > now.getTime()) return t; // bu Pazarın slotu hâlâ ileride
    sunday.setDate(sunday.getDate() + 7); // o slot açıldı/geçti → sonraki Pazar
  }

  const slots = candidateSlots(sunday, now);
  if (slots.length) return slots[0]; // en erken geçmemiş slot
  sunday.setDate(sunday.getDate() + 7);
  sunday.setHours(SLOT_HOURS[0], 0, 0, 0);
  return sunday;
}

module.exports = {
  SLOT_HOURS,
  WINDOW_HOURS,
  toDateStr,
  lastSundayStrictlyBefore,
  candidateSlots,
  closeTime,
  nextOpeningTime
};
