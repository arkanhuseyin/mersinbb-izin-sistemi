const pool = require('../config/db');

// 1. Kuralları Listele
exports.getHakedisKurallari = async (req, res) => {
    try {
        // Kuralları Yıl (Yeniden eskiye) ve Kıdem (Azdan çoğa) sıralı getir
        const result = await pool.query('SELECT * FROM hakedis_kurallari ORDER BY baslangic_yili DESC, kidem_alt ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ mesaj: 'Kurallar çekilemedi.' });
    }
};

// 2. Yeni Kural Ekle
exports.addHakedisKurali = async (req, res) => {
    const { yil, kidem_alt, kidem_ust, gun } = req.body;
    
    // Basit Validasyon
    if (kidem_alt === undefined || kidem_ust === undefined || gun === undefined) {
        return res.status(400).json({ mesaj: 'Tüm alanları doldurunuz.' });
    }

    try {
        // bitis_yili'ni şimdilik baslangic_yili ile aynı yapıyoruz (Tek yıl mantığı)
        await pool.query(
            'INSERT INTO hakedis_kurallari (baslangic_yili, bitis_yili, kidem_alt, kidem_ust, gun_sayisi) VALUES ($1, $2, $3, $4, $5)',
            [yil, yil, kidem_alt, kidem_ust, gun]
        );
        res.json({ mesaj: 'Kural başarıyla eklendi.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ mesaj: 'Kayıt hatası.' });
    }
};

// 3. Kural Sil
exports.deleteHakedisKurali = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM hakedis_kurallari WHERE id = $1', [id]);
        res.json({ mesaj: 'Kural silindi.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ mesaj: 'Silme hatası.' });
    }
};