const pool = require('../config/db');

// --- 🧠 ANA HESAPLAMA MOTORU ---
const dinamikHakedisHesapla = async (personel_id) => {
    try {
        // 1. Personel Bilgisini Çek
        const pRes = await pool.query("SELECT ise_giris_tarihi FROM personeller WHERE personel_id = $1", [personel_id]);
        if (pRes.rows.length === 0) return 0;
        
        const iseGiris = new Date(pRes.rows[0].ise_giris_tarihi);
        const bugun = new Date();
        const girisYili = iseGiris.getFullYear();
        const suankiYil = bugun.getFullYear();

        // Kıdem Yılı Hesabı (Tam yıl)
        // Örn: 15.01.2015 girişli biri, 14.01.2026'da henüz 10 yılını doldurmamıştır.
        let kidemYili = suankiYil - girisYili;
        const buYilDonum = new Date(suankiYil, iseGiris.getMonth(), iseGiris.getDate());
        if (bugun < buYilDonum) {
            kidemYili--; 
        }

        // 1 Yılını doldurmamışsa izin yok
        if (kidemYili < 1) return 0;

        // ---------------------------------------------------------
        // 🚀 2. VERİTABANI KONTROLÜ (ÖNCELİKLİ)
        // ---------------------------------------------------------
        // Yönetim panelinden eklenen özel bir kural var mı?
        const kuralRes = await pool.query(`
            SELECT gun_sayisi FROM hakedis_kurallari 
            WHERE 
                ($1 BETWEEN baslangic_yili AND bitis_yili) -- Giriş Yılı Aralığı
                AND 
                ($2 BETWEEN kidem_alt AND kidem_ust) -- Kıdem Aralığı
        `, [girisYili, kidemYili]);

        if (kuralRes.rows.length > 0) {
            return kuralRes.rows[0].gun_sayisi;
        }

        // ---------------------------------------------------------
        // 📜 3. EXCEL / METİN BELGESİ MANTIĞI (YEDEK SİSTEM)
        // ---------------------------------------------------------
        // Attığın "yıllık izin hakediş.txt" dosyasındaki mantık buraya işlendi.
        
        let hak = 0;

        // GRUP 1: ESKİ GİRİŞLİLER (2018 Öncesi Girişler - Senin tablodaki 2007-2015 ve öncesi)
        // Not: Tabloda 2007 öncesi de aynı mantık denildiği için < 2018 dedik.
        if (girisYili < 2018) {
            // Yıla göre değişen tarife (Enflasyon gibi artış var)
            if (suankiYil < 2018) { 
                // 2017 ve öncesi standart tarife
                if (kidemYili <= 5) hak = 14;
                else if (kidemYili <= 15) hak = 19;
                else hak = 25;
            } 
            else if (suankiYil < 2024) { 
                // 2018 - 2023 Arası (Tablonda artış var)
                if (suankiYil < 2019) { // 2018 yılı özel
                     if (kidemYili <= 5) hak = 14; 
                     else if (kidemYili <= 15) hak = 19; 
                     else hak = 25;
                } else { // 2019 ve sonrası (Tablondaki 22, 25 günleri)
                    if (kidemYili <= 3) hak = 16;
                    else if (kidemYili <= 5) hak = 18;
                    else if (kidemYili <= 15) hak = 25;
                    else hak = 30; // 15 yıl üstü 30 olmuş
                }
            } 
            else { 
                // 2024 ve Sonrası (Tablonun en sağı - En yüksek oranlar)
                if (girisYili < 2025) { // 2024 hesaplaması
                    if (kidemYili <= 3) hak = 16;
                    else if (kidemYili <= 5) hak = 18;
                    else if (kidemYili <= 15) hak = 25;
                    else hak = 30;
                } else {
                    // 2025 ve sonrası için tahmin/standart (Tabloya göre artıyor)
                    if (kidemYili <= 3) hak = 18;
                    else if (kidemYili <= 5) hak = 20;
                    else if (kidemYili <= 15) hak = 27;
                    else hak = 32; // 15 yıl üstü 32 olmuş
                }
            }
        }
        
        // GRUP 2: YENİ GİRİŞLİLER (2018 ve Sonrası)
        else {
            // Bunlar direkt yüksekten başlıyor (Tablodaki 2. kısım)
            if (kidemYili <= 3) hak = 16; 
            else if (kidemYili <= 5) hak = 18;
            else if (kidemYili <= 15) hak = 26;
            else hak = 30;
        }

        return hak;

    } catch (err) {
        console.error("Hakediş Hatası:", err);
        return 0;
    }
};

module.exports = dinamikHakedisHesapla;