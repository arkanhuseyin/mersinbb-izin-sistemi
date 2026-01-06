const pool = require('../config/db');

// Kullanıcının yetkilerini getir
exports.getYetkiler = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM yetkiler WHERE personel_id = $1', [id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ mesaj: 'Yetkiler alınamadı' });
    }
};

// Yetkileri Kaydet / Güncelle
exports.saveYetkiler = async (req, res) => {
    const { personel_id, yetkiler } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Gelen her bir modül yetkisi için döngü
        for (const yetki of yetkiler) {
            // Önce bu personelin bu modül için kaydı var mı bakalım
            const check = await client.query(
                'SELECT * FROM yetkiler WHERE personel_id = $1 AND modul_adi = $2',
                [personel_id, yetki.modul_adi]
            );

            if (check.rows.length > 0) {
                // Kayıt varsa GÜNCELLE
                await client.query(
                    `UPDATE yetkiler SET 
                     goruntule = $1, 
                     ekle_duzenle = $2, 
                     sil = $3 
                     WHERE personel_id = $4 AND modul_adi = $5`,
                    [yetki.goruntule, yetki.ekle_duzenle, yetki.sil, personel_id, yetki.modul_adi]
                );
            } else {
                // Kayıt yoksa EKLE
                await client.query(
                    `INSERT INTO yetkiler (personel_id, modul_adi, goruntule, ekle_duzenle, sil)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [personel_id, yetki.modul_adi, yetki.goruntule, yetki.ekle_duzenle, yetki.sil]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ mesaj: 'Yetkiler başarıyla güncellendi.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ mesaj: 'Kaydetme başarısız.' });
    } finally {
        client.release();
    }
};