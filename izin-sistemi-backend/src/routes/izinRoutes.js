const express = require('express');
const router = express.Router();
const izinController = require('../controllers/izinController');
const pdfController = require('../controllers/pdfController'); // PDF Motoru
const auth = require('../middleware/auth'); // Güvenlik
const pool = require('../config/db'); 
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- DOSYA YÜKLEME AYARLARI (Rapor vb. İçin) ---
const uploadDir = path.join(__dirname, '../../uploads/izinler');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'rapor-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });


// ============================================================
// 📅 İZİN İŞLEMLERİ
// ============================================================

// 1. İzin Talebi Oluştur
router.post('/olustur', auth, upload.single('belge'), izinController.talepOlustur);

// 2. İzinleri Listele
router.get('/listele', auth, izinController.izinleriGetir);

// 3. Talebi Onayla / Reddet
router.post('/onayla', auth, izinController.talepOnayla);

// 4. İzin İptal Et
router.delete('/iptal/:id', auth, async (req, res) => {
    try {
        const kontrol = await pool.query(
            'SELECT durum, baslangic_tarihi, personel_id FROM izin_talepleri WHERE talep_id = $1',
            [req.params.id]
        );

        if (kontrol.rows.length === 0) {
            return res.status(404).json({ mesaj: 'Talep bulunamadı' });
        }

        const talep = kontrol.rows[0];

        // Yetki Kontrolü
        if (
            req.user.rol !== 'admin' &&
            req.user.rol !== 'ik' &&
            req.user.id !== talep.personel_id
        ) {
            return res.status(403).json({ mesaj: 'Bu işlem için yetkiniz yok.' });
        }

        if (talep.durum === 'IK_ONAYLADI') {
            return res.status(400).json({ mesaj: 'Onaylanmış izin iptal edilemez.' });
        }

        if (req.user.rol !== 'admin' && req.user.rol !== 'ik') {
            const bugun = new Date();
            const baslangic = new Date(talep.baslangic_tarihi);
            const farkGun = Math.ceil(
                (baslangic.getTime() - bugun.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (farkGun < 1) {
                return res.status(400).json({
                    mesaj: 'İzin başlangıcına 1 günden az kaldığı için iptal edilemez.'
                });
            }
        }

        await pool.query('DELETE FROM izin_talepleri WHERE talep_id = $1', [req.params.id]);
        res.json({ mesaj: 'İzin talebi iptal edildi.' });

    } catch (err) {
        console.error(err);
        res.status(500).send('Hata oluştu.');
    }
});


// ============================================================
// 🛠️ YARDIMCI VE RAPORLAMA
// ============================================================

// 5. PDF İNDİRME (Form1 / Form2)
// 🔒 Form2 SADECE admin ve ik
router.get(
    '/pdf/:form_tipi/:talep_id',
    auth,
    (req, res, next) => {
        const { form_tipi } = req.params;
        const { rol } = req.user;

        if (form_tipi === 'form2') {
            if (rol !== 'admin' && rol !== 'ik') {
                return res.status(403).json({
                    mesaj: 'Form-2 yalnızca İK ve Admin tarafından görüntülenebilir.'
                });
            }
        }

        next();
    },
    pdfController.pdfOlustur
);

// 6. Bildirimleri Listele
router.get('/bildirim/listele', auth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM bildirimler WHERE personel_id = $1 ORDER BY tarih DESC',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).send('Hata');
    }
});

// 7. Resmi Tatilleri Getir
router.get('/resmi-tatiller', auth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM resmi_tatiller');
        res.json(result.rows);
    } catch (err) {
        res.status(500).send('Hata');
    }
});

// 8. Yıllık İzin Durum Raporu
router.get('/rapor/durum', auth, izinController.izinDurumRaporu);

// 9. İzin Hareketleri (Timeline)
router.get('/timeline/:talep_id', auth, izinController.getTimeline);

// 10. Sistem Logları (Admin)
router.get('/system-logs', auth, izinController.getSystemLogs);

// 11. Islak İmza Durumu
router.post('/islak-imza-durumu', auth, izinController.islakImzaDurumu);

module.exports = router;
