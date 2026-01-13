const pool = require('../config/db');

// 1. Kuralları Listele
exports.getHakedisKurallari = async (req, res) => {
    try {
        // Sıralama: Önce Yıl (Yeniden eskiye), Sonra Kıdem Aralığı (Küçükten büyüğe)
        const result = await pool.query('SELECT * FROM hakedis_kurallari ORDER BY baslangic_yili DESC, kidem_alt ASC');
        res.json(result.rows);
    } catch (err) {
        console.error("Kurallar listelenirken hata:", err);
        res.status(500).json({ mesaj: 'Kurallar çekilemedi.' });
    }
};

// 2. Yeni Kural Ekle
exports.addHakedisKurali = async (req, res) => {
    const { yil, kidem_alt, kidem_ust, gun } = req.body;
    
    // Validasyon: Boş veri gelmesini engelle
    if (!yil || kidem_alt === undefined || kidem_ust === undefined || gun === undefined) {
        return res.status(400).json({ mesaj: 'Lütfen tüm alanları doldurunuz.' });
    }

    // Mantıksal Validasyon: Min kıdem, Max kıdemden büyük olamaz
    if (Number(kidem_alt) > Number(kidem_ust)) {
        return res.status(400).json({ mesaj: 'Başlangıç kıdemi, bitiş kıdeminden büyük olamaz.' });
    }

    try {
        // Veritabanına kaydet
        // bitis_yili sütununa da aynı yılı yazıyoruz (Tek yıl kuralı için)
        await pool.query(
            'INSERT INTO hakedis_kurallari (baslangic_yili, bitis_yili, kidem_alt, kidem_ust, gun_sayisi) VALUES ($1, $2, $3, $4, $5)',
            [yil, yil, kidem_alt, kidem_ust, gun]
        );
        res.json({ mesaj: 'Kural başarıyla eklendi.' });
    } catch (err) {
        console.error("Kural eklenirken hata:", err);
        res.status(500).json({ mesaj: 'Kayıt sırasında veritabanı hatası oluştu.' });
    }
};

// 3. Kural Sil
exports.deleteHakedisKurali = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM hakedis_kurallari WHERE id = $1', [id]);
        res.json({ mesaj: 'Kural başarıyla silindi.' });
    } catch (err) {
        console.error("Kural silinirken hata:", err);
        res.status(500).json({ mesaj: 'Silme işlemi başarısız.' });
    }
};