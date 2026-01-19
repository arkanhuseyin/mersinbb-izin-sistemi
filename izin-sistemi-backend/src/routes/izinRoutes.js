const express = require('express');
const router = express.Router();
const izinController = require('../controllers/izinController');
const pdfController = require('../controllers/pdfController'); // Varsa
const auth = require('../middleware/auth'); 
const pool = require('../config/db'); 
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- DOSYA YÜKLEME AYARLARI ---
const uploadDir = path.join(__dirname, '../../uploads/izinler');
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir, { recursive: true }); }
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, uploadDir); },
    filename: (req, file, cb) => { cb(null, 'rapor-' + Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage: storage });

// --- İZİN TALEPLERİ ---
router.post('/olustur', auth, upload.single('belge'), izinController.talepOlustur);
router.get('/listele', auth, izinController.izinleriGetir);
router.post('/onayla', auth, izinController.talepOnayla);
router.delete('/iptal/:id', auth, async (req, res) => {
    try {
        const kontrol = await pool.query('SELECT durum, baslangic_tarihi, personel_id FROM izin_talepleri WHERE talep_id = $1', [req.params.id]);
        if(kontrol.rows.length === 0) return res.status(404).json({mesaj: 'Talep bulunamadı'});
        const talep = kontrol.rows[0];
        if (req.user.rol !== 'admin' && req.user.rol !== 'ik' && req.user.id !== talep.personel_id) return res.status(403).json({mesaj: 'Yetkisiz'});
        if(talep.durum === 'IK_ONAYLADI') return res.status(400).json({mesaj: 'Onaylı izin iptal edilemez'});
        await pool.query('DELETE FROM izin_talepleri WHERE talep_id = $1', [req.params.id]);
        res.json({mesaj: 'İzin iptal edildi.'});
    } catch (err) { res.status(500).send('Hata'); }
});

// --- GEÇMİŞ BAKİYE ---
router.post('/gecmis-bakiye-ekle', auth, izinController.gecmisBakiyeEkle);
router.get('/gecmis-bakiyeler/:id', auth, izinController.gecmisBakiyeleriGetir);
router.delete('/gecmis-bakiye-sil/:id', auth, izinController.gecmisBakiyeSil);

// --- RAPORLAMA VE PDF ---
// Mevcut PDF rotası (Formlar için)
if (pdfController && pdfController.pdfOlustur) { router.get('/pdf/:form_tipi/:talep_id', pdfController.pdfOlustur); }

router.get('/bildirim/listele', auth, async (req, res) => { try { const r = await pool.query('SELECT * FROM bildirimler WHERE personel_id=$1 ORDER BY tarih DESC', [req.user.id]); res.json(r.rows); } catch { res.sendStatus(500); } });
router.get('/resmi-tatiller', auth, async (req, res) => { try { const r = await pool.query('SELECT * FROM resmi_tatiller'); res.json(r.rows); } catch { res.sendStatus(500); } });
router.get('/rapor/durum', auth, izinController.izinDurumRaporu);
router.get('/timeline/:talep_id', auth, izinController.getTimeline);
router.get('/system-logs', auth, izinController.getSystemLogs);
router.post('/islak-imza-durumu', auth, izinController.islakImzaDurumu);
router.get('/personel-detay/:id', auth, izinController.getPersonelIzinDetay);
router.get('/rapor/tum-personel-detay', auth, izinController.tumPersonelDetayliVeri);

// ✅ YENİ EKLENEN ROTALAR (Backend PDF İndirme)
router.get('/rapor/pdf-toplu', auth, izinController.topluPdfRaporu);
router.get('/rapor/pdf-detay/:id', auth, izinController.kisiOzelPdfRaporu);
router.delete('/talep-sil/:id', auth, izinController.talepSil);

module.exports = router;