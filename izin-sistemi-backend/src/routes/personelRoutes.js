const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const auth = require('../middleware/auth');
const personelController = require('../controllers/personelController');

// --- MULTER VE KLASÖR AYARLARI ---
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
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const prefix = req.user && req.user.tc_no ? req.user.tc_no : 'new';
        cb(null, prefix + '-' + file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Yardımcı Fonksiyon
const tarihDuzelt = (tarih) => {
    if (!tarih || tarih === '') return null;
    return tarih;
};

// ============================================================
// 🟢 YÖNETİM İŞLEMLERİ (Admin/İK/Filo)
// ============================================================

// 1. Personel Listesi (Tam Detaylı)
router.get('/liste', auth, personelController.personelListesi);

// 2. Birimleri Getir
router.get('/birimler', auth, personelController.birimleriGetir);

// 3. Personel İzin Geçmişi (YENİ EKLENDİ - 2. Sekme İçin Zorunlu)
router.get('/izin-gecmisi/:id', auth, personelController.personelIzinGecmisi);

// 4. Yeni Personel Ekle (Admin)
router.post('/ekle', auth, upload.single('fotograf'), personelController.personelEkle);

// 5. Personel Güncelle (Admin)
router.put('/guncelle/:id', auth, upload.single('fotograf'), personelController.personelGuncelle);

// 6. Transfer Et
router.post('/transfer', auth, personelController.birimGuncelle);

// --- DURUM YÖNETİMİ ---
router.post('/dondur', auth, personelController.personelDondur);
router.post('/aktif-et', auth, personelController.personelAktifEt);
router.delete('/sil/:personel_id', auth, personelController.personelSil);

// 7. PDF İndir (Kurumsal 2 Sayfa)
router.get('/pdf/:id', auth, personelController.personelKartiPdf);

// 8. BEDEN İŞLEMLERİ 
router.get('/kiyafet-donemi', auth, personelController.getKiyafetDonemiDurumu);
router.post('/kiyafet-donemi-ayar', auth, personelController.toggleKiyafetDonemi);
router.post('/beden-kaydet', auth, personelController.bedenGuncelle);


// ============================================================
// 🔵 PROFİL İŞLEMLERİ (Personelin Kendisi)
// ============================================================

// Profil Bilgilerini Getir
router.get('/bilgi', auth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM personeller WHERE personel_id = $1', [req.user.id]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            delete user.sifre_hash; // Şifreyi gönderme
            res.json(user);
        } else {
            res.status(404).send('Kullanıcı bulunamadı');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Sunucu hatası');
    }
});

// Profil Güncelleme (Personel İsteği - Şifre, Belge vb.)
router.post('/guncelle', auth, upload.fields([
    { name: 'adres_belgesi', maxCount: 1 },
    { name: 'src_belgesi', maxCount: 1 },
    { name: 'psiko_belgesi', maxCount: 1 },
    { name: 'ehliyet_belgesi', maxCount: 1 }
]), async (req, res) => {
    try {
        const { email, telefon, adres, src_tarih, psiko_tarih, ehliyet_tarih, yeni_sifre } = req.body;
        const pid = req.user.id;

        // A) ŞİFRE GÜNCELLEME
        if (yeni_sifre && yeni_sifre.length >= 6) {
             const hash = await bcrypt.hash(yeni_sifre, 10);
             await pool.query('UPDATE personeller SET sifre_hash = $1 WHERE personel_id = $2', [hash, pid]);
            
            if (!email && !telefon && !adres && !src_tarih && !req.files) {
                return res.json({ mesaj: 'Şifreniz başarıyla güncellendi.' });
            }
        }

        // B) PROFİL DEĞİŞİKLİK TALEBİ
        if (email || telefon || adres || src_tarih || req.files) {
            const yeniVeri = { email, telefon, adres, src_tarih, psiko_tarih, ehliyet_tarih };
            const dosyaYollari = {};
            
            if (req.files) {
                if (req.files.adres_belgesi) dosyaYollari.adres_belgesi_yol = req.files.adres_belgesi[0].path;
                if (req.files.src_belgesi) dosyaYollari.src_belgesi_yol = req.files.src_belgesi[0].path;
                if (req.files.psiko_belgesi) dosyaYollari.psiko_belgesi_yol = req.files.psiko_belgesi[0].path;
                if (req.files.ehliyet_belgesi) dosyaYollari.ehliyet_belgesi_yol = req.files.ehliyet_belgesi[0].path;
            }

            await pool.query(
                `INSERT INTO profil_degisiklikleri (personel_id, yeni_veri, dosya_yollari) VALUES ($1, $2, $3)`,
                [pid, yeniVeri, dosyaYollari]
            );
            return res.json({ mesaj: 'Değişiklik talebiniz yönetici onayına gönderildi.' });
        }

        res.json({ mesaj: 'İşlem tamamlandı.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ mesaj: 'Hata oluştu.' });
    }
});

// Admin/İK İçin Bekleyen Talepler
router.get('/talepler', auth, async (req, res) => {
    try {
        if (!['admin', 'ik', 'filo'].includes(req.user.rol)) return res.status(403).json({ mesaj: 'Yetkisiz' });
        
        const result = await pool.query(`
            SELECT pd.*, p.ad, p.soyad, p.tc_no 
            FROM profil_degisiklikleri pd
            JOIN personeller p ON pd.personel_id = p.personel_id
            WHERE pd.durum = 'BEKLIYOR'
            ORDER BY pd.talep_tarihi ASC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).send('Hata'); }
});

// Talep Onayla/Reddet
router.post('/talep-islem', auth, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id, islem } = req.body; 
        if (!['admin', 'ik', 'filo'].includes(req.user.rol)) return res.status(403).json({ mesaj: 'Yetkisiz' });

        await client.query('BEGIN');
        const talepRes = await client.query('SELECT * FROM profil_degisiklikleri WHERE id = $1', [id]);
        if (talepRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ mesaj: 'Bulunamadı' }); }
        const talep = talepRes.rows[0];

        if (islem === 'ONAYLA') {
            const veri = talep.yeni_veri; 
            const dosyalar = talep.dosya_yollari || {};
            
            await client.query(`
                UPDATE personeller SET 
                email = COALESCE($1, email), telefon = COALESCE($2, telefon), adres = COALESCE($3, adres),
                src_tarih = COALESCE($4, src_tarih), psiko_tarih = COALESCE($5, psiko_tarih), ehliyet_tarih = COALESCE($6, ehliyet_tarih),
                adres_belgesi_yol = COALESCE($7, adres_belgesi_yol), src_belgesi_yol = COALESCE($8, src_belgesi_yol),
                psiko_belgesi_yol = COALESCE($9, psiko_belgesi_yol), ehliyet_belgesi_yol = COALESCE($10, ehliyet_belgesi_yol)
                WHERE personel_id = $11
            `, [
                veri.email || null, veri.telefon || null, veri.adres || null, 
                tarihDuzelt(veri.src_tarih), tarihDuzelt(veri.psiko_tarih), tarihDuzelt(veri.ehliyet_tarih),
                dosyalar.adres_belgesi_yol || null, dosyalar.src_belgesi_yol || null, 
                dosyalar.psiko_belgesi_yol || null, dosyalar.ehliyet_belgesi_yol || null, 
                talep.personel_id
            ]);

            await client.query("UPDATE profil_degisiklikleri SET durum = 'ONAYLANDI' WHERE id = $1", [id]);
            await client.query("INSERT INTO bildirimler (personel_id, baslik, mesaj) VALUES ($1, $2, $3)", [talep.personel_id, '✅ Profil Onaylandı', 'Bilgileriniz güncellendi.']);
        } else {
            await client.query("UPDATE profil_degisiklikleri SET durum = 'REDDEDILDI' WHERE id = $1", [id]);
            await client.query("INSERT INTO bildirimler (personel_id, baslik, mesaj) VALUES ($1, $2, $3)", [talep.personel_id, '❌ Profil Reddedildi', 'Değişiklik talebiniz uygun görülmedi.']);
        }
        await client.query('COMMIT');
        res.json({ mesaj: 'İşlem tamamlandı.' });
    } catch (err) { await client.query('ROLLBACK'); console.error(err); res.status(500).send('Hata'); } finally { client.release(); }
});

module.exports = router;