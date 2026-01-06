const pool = require('../config/db');

const dinamikHakedisHesapla = async (personelId) => {
    // 1. Personel Giriş Tarihini Bul
    const pRes = await pool.query("SELECT ise_giris_tarihi FROM personeller WHERE personel_id = $1", [personelId]);
    if (pRes.rows.length === 0) return 0; // Personel yoksa 0

    const girisTarihi = new Date(pRes.rows[0].ise_giris_tarihi);
    const girisYili = girisTarihi.getFullYear();
    
    // 2. Kıdem Yılını Hesapla (Tam Yıl)
    const bugun = new Date();
    const farkMs = bugun - girisTarihi;
    const kidemYili = Math.floor(farkMs / (1000 * 60 * 60 * 24 * 365.25));

    console.log(`Personel ID: ${personelId}, Giriş Yılı: ${girisYili}, Kıdem: ${kidemYili} yıl`);

    // 3. Veritabanındaki Kuralları Tara
    // KURAL: Giriş yılı eşleşen VE kıdem yılı aralığa uyan kaydı bul.
    const kuralRes = await pool.query(`
        SELECT gun_sayisi 
        FROM hakedis_kurallari 
        WHERE baslangic_yili = $1 
        AND $2 >= kidem_alt AND $2 <= kidem_ust
        LIMIT 1
    `, [girisYili, kidemYili]);

    // Eğer kural bulunduysa direkt o gün sayısını döndür
    if (kuralRes.rows.length > 0) {
        return kuralRes.rows[0].gun_sayisi;
    }

    // HİÇBİR KURAL YOKSA? (Güvenlik Önlemi)
    // Eğer veritabanında bu personel için bir tanım yoksa, 0 döndürür.
    // İsterseniz buraya standart iş kanunu (14 gün) yedeği ekleyebiliriz ama
    // "0-1 = 0" girebilmek istediğiniz için varsayılanı 0 bırakmak daha güvenli.
    return 0;
};

module.exports = dinamikHakedisHesapla;