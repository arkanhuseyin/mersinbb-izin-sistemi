// src/routes/yetkiRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth'); // Sadece adminler yapabilsin diye

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

// 2. Yetkileri Kaydet / Güncelle
router.post('/kaydet', auth, async (req, res) => {
    const { personel_id, yetkiler } = req.body; // yetkiler bir dizi olacak
    
    // Güvenlik: İşlemi yapan admin mi? (Middleware zaten kontrol ediyor ama ekstra kontrol eklenebilir)

    try {
        // Önce bu personelin eski yetkilerini temizle (En temiz yöntem silip tekrar yazmaktır)
        await pool.query('DELETE FROM yetkiler WHERE personel_id = $1', [personel_id]);

        // Seçili yetkileri döngüyle ekle
        for (const yetki of yetkiler) {
            // Eğer hepsi false ise veritabanına eklemeye gerek yok (yer kaplamasın)
            if (yetki.goruntule || yetki.ekle_duzenle || yetki.sil) {
                await pool.query(
                    'INSERT INTO yetkiler (personel_id, modul_adi, goruntule, ekle_duzenle, sil) VALUES ($1, $2, $3, $4, $5)',
                    [personel_id, yetki.modul_adi, yetki.goruntule, yetki.ekle_duzenle, yetki.sil]
                );
            }
        }
        res.json({ mesaj: 'Yetkiler başarıyla güncellendi!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Kaydedilemedi' });
    }
});

module.exports = router;