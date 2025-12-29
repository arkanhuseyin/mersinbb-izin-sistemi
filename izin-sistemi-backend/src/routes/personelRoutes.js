const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const auth = require('../middleware/auth');
const personelController = require('../controllers/personelController'); 

// --- DOSYA YÜKLEME AYARLARI (Multer) ---
const uploadDir = path.join(__dirname, '../../uploads/belgeler');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // req.user.tc_no undefined olabilir diye kontrol ekledik
        const userPrefix = req.user && req.user.tc_no ? req.user.tc_no : 'user';
        cb(null, userPrefix + '-' + file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// --- YARDIMCI FONKSİYON ---
const tarihDuzelt = (tarih) => {
    if (!tarih || tarih === '') return null;
    return tarih;
};

// ============================================================
// 🟢 ADMİN VE YÖNETİCİ İŞLEMLERİ (CONTROLLER ENTEGRASYONU)
// ============================================================

// 1. Birimleri Listele
router.get('/birimler', auth, personelController.birimleriGetir);

// 2. Yeni Personel Ekle (ÖNEMLİ: Bu eksikti, eklendi)
router.post('/ekle', auth, personelController.personelEkle);

// 3. Personel Transfer Et (Birim Değiştir)
router.post('/transfer', auth, personelController.birimGuncelle);

// 4. Personel Dondur / Pasife Al (Eski 'Sil' işlemi de bunu kullanmalı)
router.post('/dondur', auth, personelController.personelDondur);

// ⚠️ AŞAĞIDAKİLER YENİ CONTROLLER'DA YOKTUR, GEÇİCİ OLARAK KAPATILDI (CRASH ÖNLEMEK İÇİN)
// Eğer bunları kullanacaksanız personelController.js içine bu fonksiyonları yazmanız gerekir.
// router.post('/aktif-et', auth, personelController.personelAktifEt);
// router.post('/rol-degistir', auth, personelController.rolGuncelle);
// router.delete('/sil/:personel_id', auth, personelController.personelSil);


// ============================================================
// 🔵 PROFİL VE GÜNCELLEME İŞLEMLERİ (RAW SQL - MEVCUT YAPI KORUNDU)
// ============================================================

// 5. GÜNCEL BİLGİLERİ GETİR
router.get('/bilgi', auth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM personeller WHERE personel_id = $1', [req.user.id]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            delete user.sifre_hash; // Güvenlik için hash'i sil
            delete user.sifre;      // Düz şifre varsa sil
            res.json(user);
        } else {
            res.status(404).send('Kullanıcı bulunamadı');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Sunucu hatası');
    }
});

// 6. PROFİL GÜNCELLEME TALEBİ (Şifre, Bilgi ve Dosya)
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
            // Şifreyi direkt düz metin kaydediyorsan (hash yoksa):
            // await pool.query('UPDATE personeller SET sifre = $1 WHERE personel_id = $2', [yeni_sifre, pid]);
            
            // Eğer hash kullanıyorsan (Tavsiye edilen):
             const hash = await bcrypt.hash(yeni_sifre, 10);
             // Veritabanında sütun adın 'sifre' ise:
             await pool.query('UPDATE personeller SET sifre = $1 WHERE personel_id = $2', [hash, pid]);
            
            if (!email && !telefon) {
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

// 7. BEKLEYEN TALEPLERİ LİSTELE (ADMİN/İK/FİLO)
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

// 8. TALEBİ ONAYLA/REDDET
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
            
            // COALESCE ile sadece dolu gelen alanları güncelle
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