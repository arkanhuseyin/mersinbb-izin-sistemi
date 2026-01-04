const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const personelController = require('../controllers/personelController'); // ✅ EKLENDI: Mantık burada
const auth = require('../middleware/auth'); 
const multer = require('multer'); // ✅ EKLENDI: Dosya yükleme için şart
const path = require('path');
const fs = require('fs');

// --- MULTER VE KLASÖR AYARLARI (PersonelRoutes ile aynı mantık) ---
const uploadsBase = path.join(__dirname, '../../uploads');
const belgerDir = path.join(uploadsBase, 'belgeler');

// Klasör yoksa oluştur
if (!fs.existsSync(belgerDir)) fs.mkdirSync(belgerDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, belgerDir); // Kimlik fotoğrafları belgeler klasörüne gitsin
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // Giriş yapmadığı için TC'yi body'den almaya çalışalım, yoksa 'guest' diyelim
        const prefix = req.body.tc_no ? req.body.tc_no : 'guest';
        cb(null, prefix + '-kimlik-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// ============================================================
// 🔓 HERKESİN ERİŞEBİLECEĞİ ROTALAR (Token Gerektirmez)
// ============================================================

// 1. Giriş Yapma
router.post('/login', authController.login);

// 2. Şifre Sıfırlama Talebi (Giriş yapamayan personel için - ESKİ FONKSİYON)
// Eğer bunu kullanmıyorsanız silebilirsiniz ama şimdilik kalsın.
router.post('/sifremi-unuttum', authController.sifreUnuttum);

// ✅ 3. YENİ EKLENEN: FOTOĞRAFLI ŞİFRE TALEBİ
// Mobil uygulama buraya istek atıyor. 'kimlik_foto' ismini mobildeki FormData ile aynı yaptık.
router.post('/sifre-talep', upload.single('kimlik_foto'), personelController.sifreSifirlamaTalep);


// ============================================================
// 🔒 SADECE GİRİŞ YAPMIŞ YETKİLİLERİN ERİŞEBİLECEĞİ ROTALAR
// ============================================================

// 4. Admin Tarafından Şifre Sıfırlama (Web Panelinden)
router.post('/admin-sifirla', auth, authController.adminSifirla);

// 5. Yeni Personel Ekleme / Üyelik Açma
router.post('/register', auth, authController.register);

// 6. Tüm Personelleri Listeleme
router.get('/users', auth, authController.getUsers);

module.exports = router;