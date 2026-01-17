const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Veritabanı bağlantısı
const auth = require('../middleware/auth'); // Token doğrulama middleware

// ============================================================
// 1. PERSONELİN YETKİLERİNİ GETİR
// ============================================================
router.get('/:personel_id', auth, async (req, res) => {
    try {
        const { personel_id } = req.params;

        // Yetkiler tablosundan o kişiye ait tüm satırları çek
        const result = await pool.query(
            'SELECT * FROM yetkiler WHERE personel_id = $1', 
            [personel_id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Yetki Getirme Hatası:', error);
        res.status(500).json({ error: 'Yetkiler alınamadı' });
    }
});

// ============================================================
// 2. YETKİLERİ KAYDET / GÜNCELLE (TRANSACTION YAPISI)
// ============================================================
router.post('/kaydet', auth, async (req, res) => {
    // Güvenlik Kontrolü: Sadece Admin veya İK yetki verebilir
    if (!['admin', 'ik'].includes(req.user.rol)) {
        return res.status(403).json({ mesaj: 'Bu işlemi yapmaya yetkiniz yok.' });
    }

    const { personel_id, yetkiler } = req.body; 
    
    // Transaction başlatmak için client alıyoruz
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN'); // 🚩 İşlemi başlat

        // ADIM 1: Önce bu personelin eski yetkilerinin tamamını temizle (Sıfırla)
        await client.query('DELETE FROM yetkiler WHERE personel_id = $1', [personel_id]);

        // ADIM 2: Gelen listedeki yeni yetkileri tek tek ekle
        for (const yetki of yetkiler) {
            // Sadece en az bir yetkisi (Görüntüle/Düzenle/Sil) açık olanları kaydet
            // (Veritabanını gereksiz şişirmemek için hepsi false ise kaydetmeye gerek yok)
            if (yetki.goruntule || yetki.ekle_duzenle || yetki.sil) {
                await client.query(
                    `INSERT INTO yetkiler (personel_id, modul_adi, goruntule, ekle_duzenle, sil) 
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        personel_id, 
                        yetki.modul_adi, 
                        yetki.goruntule || false, 
                        yetki.ekle_duzenle || false, 
                        yetki.sil || false
                    ]
                );
            }
        }

        await client.query('COMMIT'); // ✅ İşlemi onayla ve kaydet
        res.json({ mesaj: 'Yetkiler başarıyla güncellendi!' });

    } catch (error) {
        await client.query('ROLLBACK'); // ❌ Hata olursa her şeyi geri al
        console.error("Yetki Kayıt Hatası:", error);
        res.status(500).json({ error: 'Yetkiler kaydedilemedi.' });
    } finally {
        client.release(); // Bağlantıyı havuza geri bırak
    }
});

module.exports = router;