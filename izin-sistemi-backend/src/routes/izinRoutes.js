const express = require('express');
const router = express.Router();
const izinController = require('../controllers/izinController');
const pdfController = require('../controllers/pdfController'); // PDF Motoru (Varsa)
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

// 1. İzin Talebi Oluştur (Fotoğraf Yükleme Destekli)
router.post('/olustur', auth, upload.single('belge'), izinController.talepOlustur);

// 2. İzinleri Listele
router.get('/listele', auth, izinController.izinleriGetir);

// 3. Talebi İmzala / Onayla / Reddet
router.post('/onayla', auth, izinController.talepOnayla);

// 4. İzin İptal Et (1 Gün Kuralı)
router.delete('/iptal/:id', auth, async (req, res) => {
    try {
        const kontrol = await pool.query('SELECT durum, baslangic_tarihi, personel_id FROM izin_talepleri WHERE talep_id = $1', [req.params.id]);
        
        if(kontrol.rows.length === 0) return res.status(404).json({mesaj: 'Talep bulunamadı'});
        
        const talep = kontrol.rows[0];

        // Yetki Kontrolü (Sadece kendi talebi, Admin veya İK silebilir)
        if (req.user.rol !== 'admin' && req.user.rol !== 'ik' && req.user.id !== talep.personel_id) {
            return res.status(403).json({mesaj: 'Bu işlem için yetkiniz yok.'});
        }

        // İK Onayladıysa iptal edilemez
        if(talep.durum === 'IK_ONAYLADI') {
            return res.status(400).json({mesaj: 'Onaylanmış izin iptal edilemez. İK ile görüşün.'});
        }

        // Tarih Kontrolü (1 Günden az kaldıysa iptal yok)
        // Admin ve İK bu kuraldan muaftır.
        if (req.user.rol !== 'admin' && req.user.rol !== 'ik') {
            const bugun = new Date();
            const baslangic = new Date(talep.baslangic_tarihi);
            const farkZaman = baslangic.getTime() - bugun.getTime();
            const farkGun = Math.ceil(farkZaman / (1000 * 60 * 60 * 24));

            if (farkGun < 1) {
                return res.status(400).json({mesaj: 'İzin başlangıcına 1 günden az kaldığı için iptal edilemez.'});
            }
        }

        await pool.query('DELETE FROM izin_talepleri WHERE talep_id = $1', [req.params.id]);
        res.json({mesaj: 'İzin talebi iptal edildi.'});

    } catch (err) {
        console.error(err);
        res.status(500).send('Hata oluştu.');
    }
});


// ============================================================
// 🟢 GEÇMİŞ BAKİYE YÖNETİMİ (YENİ EKLENEN KISIM)
// ============================================================

// 5. Geçmiş Bakiye Ekle (Manuel Giriş)
router.post('/gecmis-bakiye-ekle', auth, izinController.gecmisBakiyeEkle);

// 6. Geçmiş Bakiyeleri Listele
router.get('/gecmis-bakiyeler/:id', auth, izinController.gecmisBakiyeleriGetir);

// 7. Geçmiş Bakiye Sil
router.delete('/gecmis-bakiye-sil/:id', auth, izinController.gecmisBakiyeSil);


// ============================================================
// 🛠️ YARDIMCI VE RAPORLAMA
// ============================================================

// 8. PDF İNDİRME (Form 1 / Form 2)
// :form_tipi -> form1 veya form2
// Eğer pdfController tanımlıysa kullan, yoksa hata vermemesi için kontrol et veya yorum satırı yap.
if (pdfController && pdfController.pdfOlustur) {
    router.get('/pdf/:form_tipi/:talep_id', pdfController.pdfOlustur);
}

// 9. Bildirimleri Listele
router.get('/bildirim/listele', auth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM bildirimler WHERE personel_id = $1 ORDER BY tarih DESC', [req.user.id]);
        res.json(result.rows);
    } catch (err) { res.status(500).send('Hata'); }
});

// 10. Resmi Tatilleri Getir
router.get('/resmi-tatiller', auth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM resmi_tatiller');
        res.json(result.rows);
    } catch (err) { res.status(500).send('Hata'); }
});

// 11. Yıllık İzin Durum Raporu (Admin/İK İçin Excel Verisi)
router.get('/rapor/durum', auth, izinController.izinDurumRaporu);

// 12. İzin Hareketlerini Getir (Timeline)
router.get('/timeline/:talep_id', auth, izinController.getTimeline);

// 13. Sistem Loglarını Getir (Admin)
router.get('/system-logs', auth, izinController.getSystemLogs);

// 14. Islak İmza Durumu (Geldi / Gelmedi)
router.post('/islak-imza-durumu', auth, izinController.islakImzaDurumu);

module.exports = router;