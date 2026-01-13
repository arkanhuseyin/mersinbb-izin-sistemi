const pool = require('../config/db');

const dinamikHakedisHesapla = async (personelId) => {
    // 1. Personel Giriş Tarihini Bul
    const pRes = await pool.query("SELECT ise_giris_tarihi FROM personeller WHERE personel_id = $1", [personelId]);
    if (pRes.rows.length === 0) return 0; 

    const girisTarihi = new Date(pRes.rows[0].ise_giris_tarihi);
    const girisYili = girisTarihi.getFullYear();
    
    // 2. Kıdem Yılını Hesapla (Tam Yıl)
    const bugun = new Date();
    const farkMs = bugun - girisTarihi;
    const kidemYili = Math.floor(farkMs / (1000 * 60 * 60 * 24 * 365.25));

    // 3. Veritabanındaki Kuralları Tara
    // KURAL: Giriş yılı aralığa uyacak VE kıdem yılı aralığa uyacak
    const kuralRes = await pool.query(`
        SELECT gun_sayisi 
        FROM hakedis_kurallari 
        WHERE $1 BETWEEN baslangic_yili AND bitis_yili
        AND $2 BETWEEN kidem_alt AND kidem_ust
        ORDER BY baslangic_yili DESC, kidem_alt ASC
        LIMIT 1
    `, [girisYili, kidemYili]);

    // Eğer veritabanında kural varsa onu döndür
    if (kuralRes.rows.length > 0) {
        return kuralRes.rows[0].gun_sayisi;
    }

    // --- 4. KURAL YOKSA: STANDART (EXCEL) MANTIĞINI UYGULA (YEDEK) ---
    // Burası Frontend'deki Settings.jsx ile BİREBİR AYNI olmalı.
    
    let hak = 0;
    if (kidemYili < 1) return 0;

    // 2018'den önce işe başlayanlar
    if (girisYili < 2018) {
        if (kidemYili <= 5) hak = 14;
        else if (kidemYili <= 15) hak = 19;
        else hak = 25;
    }
    // 2018-2023 arası işe başlayanlar
    else if (girisYili < 2024) {
        if (girisYili < 2019) { // 2018
            if (kidemYili <= 5) hak = 14;
            else if (kidemYili <= 15) hak = 19;
            else hak = 25;
        } else { // 2019-2023
            if (kidemYili <= 3) hak = 16;
            else if (kidemYili <= 5) hak = 18;
            else if (kidemYili <= 15) hak = 25;
            else hak = 30;
        }
    }
    // 2024 ve sonrası
    else {
        if (girisYili < 2025) { // 2024
            if (kidemYili <= 3) hak = 16;
            else if (kidemYili <= 5) hak = 18;
            else if (kidemYili <= 15) hak = 25;
            else hak = 30;
        } else { // 2025 ve sonrası
            if (kidemYili <= 3) hak = 18;
            else if (kidemYili <= 5) hak = 20;
            else if (kidemYili <= 15) hak = 27;
            else hak = 32;
        }
    }
    
    return hak;
};

module.exports = dinamikHakedisHesapla;