// src/routes/yetkiRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// 1. Bir personelin yetkilerini getir
router.get('/:personel_id', auth, async (req, res) => {
    try {
        const { personel_id } = req.params;
        const result = await pool.query('SELECT * FROM yetkiler WHERE personel_id = $1', [personel_id]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Yetkiler alınamadı' });
    }
});

// 2. Yetkileri Kaydet (SİL VE YENİDEN YAZ MANTIĞI)
router.post('/kaydet', auth, async (req, res) => {
    const { personel_id, yetkiler } = req.body; 
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN'); // İşlemi başlat

        // 1. ADIM: Bu personelin TÜM yetki kayıtlarını sil (Temiz sayfa)
        // Böylece tikini kaldırdıklarınız veritabanından tamamen uçar.
        await client.query('DELETE FROM yetkiler WHERE personel_id = $1', [personel_id]);

        // 2. ADIM: Sadece "açık" olan veya "içi dolu" olan yetkileri ekle
        for (const yetki of yetkiler) {
            // Eğer herhangi bir yetki (Görüntüle, Ekle/İndir, Sil) true ise kaydet
            if (yetki.goruntule === true || yetki.ekle_duzenle === true || yetki.sil === true) {
                await client.query(
                    'INSERT INTO yetkiler (personel_id, modul_adi, goruntule, ekle_duzenle, sil) VALUES ($1, $2, $3, $4, $5)',
                    [personel_id, yetki.modul_adi, yetki.goruntule, yetki.ekle_duzenle, yetki.sil]
                );
            }
        }

        await client.query('COMMIT'); // İşlemi onayla
        res.json({ mesaj: 'Yetkiler başarıyla güncellendi!' });

    } catch (error) {
        await client.query('ROLLBACK'); // Hata varsa geri al
        console.error("Yetki Kayıt Hatası:", error);
        res.status(500).json({ error: 'Kaydedilemedi' });
    } finally {
        client.release();
    }
});

module.exports = router;