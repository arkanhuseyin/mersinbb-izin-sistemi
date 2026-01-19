const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const personelController = require('../controllers/personelController');

// ============================================================
// 📂 DOSYA YÜKLEME AYARLARI (MULTER)
// ============================================================
const uploadsBase = path.join(__dirname, '../../uploads');
const belgerDir = path.join(uploadsBase, 'belgeler');
const fotoDir = path.join(uploadsBase, 'fotograflar');

// Klasörleri oluştur (Yoksa)
[uploadsBase, belgerDir, fotoDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'fotograf') {
            cb(null, fotoDir);
        } else {
            cb(null, belgerDir);
        }
    },
    filename: (req, file, cb) => {
        // Dosya ismini benzersiz yap (TC-Tip-Tarih.uzanti)
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const prefix = req.user && req.user.tc_no ? req.user.tc_no : 'new';
        cb(null, prefix + '-' + file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// ============================================================
// 🟢 YÖNETİM İŞLEMLERİ (Admin/İK/Filo)
// ============================================================

// 1. Personel Listesi
router.get('/liste', auth, personelController.personelListesi);

// 2. Birimleri Getir
router.get('/birimler', auth, personelController.birimleriGetir);

// 3. Personel İzin Geçmişi
router.get('/izin-gecmisi/:id', auth, personelController.personelIzinGecmisi);

// 4. Yeni Personel Ekle (Admin)
// Not: upload.single('fotograf') middleware'i Controller'a dosya verisini hazırlar.
router.post('/ekle', auth, upload.single('fotograf'), personelController.personelEkle);

// 5. Personel Güncelle (Admin - ID ile)
// ✅ Frontend'den gelen FormData'yı okumak için 'upload' şarttır, fotoğraf olmasa bile.
router.put('/guncelle/:id', auth, upload.single('fotograf'), personelController.personelGuncelle);

// 6. Transfer Et (Birim Değiştirme)
router.post('/transfer', auth, personelController.birimGuncelle);

// --- DURUM YÖNETİMİ ---
router.post('/dondur', auth, personelController.personelDondur);
router.post('/aktif-et', auth, personelController.personelAktifEt);
router.delete('/sil/:id', auth, personelController.personelSil);

// 7. PDF İndir
router.get('/pdf/:id', auth, personelController.personelKartiPdf);

// 8. BEDEN VE KIYAFET İŞLEMLERİ 
router.get('/kiyafet-donemi', auth, personelController.getKiyafetDonemiDurumu);
router.post('/kiyafet-donemi-ayar', auth, personelController.toggleKiyafetDonemi);
router.post('/beden-kaydet', auth, personelController.bedenGuncelle);


// ============================================================
// 🔵 PROFİL VE TALEP İŞLEMLERİ (Personelin Kendisi)
// ============================================================

// 1. Profil Bilgilerini Getir (GET /bilgi)
// Bu fonksiyon Controller'da tanımlı değilse, geçici olarak buraya inline yazıyorum ki hata alma.
// Ama doğrusu bunu Controller'a eklemektir. (getKendiProfilim)
router.get('/bilgi', auth, async (req, res) => {
    // Controller'da getKendiProfilim varsa: personelController.getKendiProfilim(req, res);
    // Yoksa (Senin attığın controller'da yoktu), bu inline kod çalışır:
    try {
        const pool = require('../config/db'); // Sadece burası için gerekli
        const result = await pool.query('SELECT * FROM personeller WHERE personel_id = $1', [req.user.id]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            delete user.sifre_hash; 
            res.json(user);
        } else {
            res.status(404).send('Kullanıcı bulunamadı');
        }
    } catch (err) { res.status(500).send('Hata'); }
});

// 2. Profil Güncelleme Talep / Şifre Değiştirme (POST /guncelle)
// Belge yüklemeli talep
const talepUpload = upload.fields([
    { name: 'adres_belgesi', maxCount: 1 },
    { name: 'src_belgesi', maxCount: 1 },
    { name: 'psiko_belgesi', maxCount: 1 },
    { name: 'ehliyet_belgesi', maxCount: 1 }
]);
// Bu rota mobilden veya web profilimden gelen talebi karşılar
router.post('/guncelle', auth, talepUpload, personelController.profilGuncelleTalep);

// 3. Şifre Değiştirme (Sadece şifre)
router.post('/sifre-degistir', auth, personelController.sifreDegistir);

// 4. Admin İçin Bekleyen Talepler
router.get('/talepler', auth, personelController.bekleyenTalepler);

// 5. Talep Onayla / Reddet (Admin)
router.post('/talep-islem', auth, personelController.talepIslem);

// ============================================================
// 🟣 DİĞER (Bakiye, Şifre Sıfırlama)
// ============================================================

// Mobil uygulama için bakiye sorgulama
router.get('/bakiye', auth, personelController.getPersonelBakiye);

// Şifre Sıfırlama Talebi (Giriş Yapmadan - Login Ekranı)
router.post('/sifre-talep', upload.single('kimlik_foto'), personelController.sifreSifirlamaTalep);

// (Eski frontend uyumluluğu için alias rotalar)
router.post('/guncelle-talep', auth, talepUpload, personelController.profilGuncelleTalep);

module.exports = router;