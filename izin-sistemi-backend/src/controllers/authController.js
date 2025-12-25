const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// src/controllers/authController.js

// 1. GİRİŞ YAP (LOGIN)
exports.login = async (req, res) => {
    const { tc_no, sifre } = req.body;

    try {
        // Kullanıcıyı bul ve Rol/Birim bilgilerini getir
        const userResult = await pool.query(
            `SELECT p.*, r.rol_adi, b.birim_adi 
             FROM personeller p 
             JOIN roller r ON p.rol_id = r.rol_id
             LEFT JOIN birimler b ON p.birim_id = b.birim_id
             WHERE p.tc_no = $1`, 
            [tc_no]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ mesaj: 'Kullanıcı bulunamadı!' });
        }

        const user = userResult.rows[0];

        // --- DONDURULMUŞ HESAP KONTROLÜ ---
        if (!user.aktif) {
            return res.status(403).json({ 
                mesaj: `Üyeliğiniz dondurulmuştur. (Sebep: ${user.ayrilma_nedeni || 'Belirtilmemiş'}) Lütfen İK ile iletişime geçiniz.` 
            });
        }

        // Şifre Kontrolü
        const validPassword = await bcrypt.compare(sifre, user.sifre_hash);
        if (!validPassword) {
            return res.status(401).json({ mesaj: 'Hatalı şifre!' });
        }

        // --- YETKİLERİ ÇEK ---
        const yetkiResult = await pool.query('SELECT * FROM yetkiler WHERE personel_id = $1', [user.personel_id]);
        const yetkiler = yetkiResult.rows;

        // 🔥 İŞTE EKSİK OLAN PARÇA BURASIYDI: birim eklendi! 🔥
        const token = jwt.sign(
            { 
                id: user.personel_id, 
                tc: user.tc_no, 
                rol: user.rol_adi.toLowerCase(), // Rolü küçük harf yap
                birim: user.birim_id             // ✅ BU SATIR EKSİKTİ! Artık amir kendi birimini bilecek.
            },
            process.env.JWT_SECRET || 'gizli_anahtar',
            { expiresIn: '12h' }
        );

        // Şifre hash'ini ve hassas bilgileri çıkartıp gönder
        delete user.sifre_hash;

        // Frontend'e gidecek obje
        const userObj = {
            ...user,
            rol: user.rol_adi.toLowerCase(),
            yetkiler: yetkiler
        };

        res.json({
            mesaj: 'Giriş başarılı',
            token,
            user: userObj,       // Yeni Web Sitesi bunu kullanır
            kullanici: userObj   // Eski Mobil Uygulama bunu kullanır
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ mesaj: 'Sunucu hatası' });
    }
};

// 2. ŞİFRE SIFIRLAMA TALEBİ
exports.sifreUnuttum = async (req, res) => {
    res.json({ mesaj: 'Lütfen birim amirinize veya İK departmanına başvurunuz.' });
};

// 3. ADMİN TARAFINDAN ŞİFRE SIFIRLAMA
exports.adminSifirla = async (req, res) => {
    const { personel_id, yeni_sifre } = req.body;

    if (req.user.rol !== 'admin' && req.user.rol !== 'ik') {
        return res.status(403).json({ mesaj: 'Yetkisiz işlem' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(yeni_sifre, salt);

        await pool.query('UPDATE personeller SET sifre_hash = $1 WHERE personel_id = $2', [hash, personel_id]);
        res.json({ mesaj: 'Şifre başarıyla güncellendi.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ mesaj: 'Hata oluştu' });
    }
};

// 4. YENİ PERSONEL EKLEME (REGISTER)
exports.register = async (req, res) => {
    if (req.user.rol !== 'admin' && req.user.rol !== 'ik' && req.user.rol !== 'filo') {
        return res.status(403).json({ mesaj: 'Bu işlemi yapmaya yetkiniz yok.' });
    }

    const { tc_no, ad, soyad, sifre, rol_adi, birim_id } = req.body;

    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(sifre, salt);

        const rolRes = await pool.query('SELECT rol_id FROM roller WHERE rol_adi = $1', [rol_adi || 'personel']);
        if (rolRes.rows.length === 0) return res.status(400).json({ mesaj: 'Geçersiz rol.' });

        await pool.query(
            'INSERT INTO personeller (tc_no, ad, soyad, sifre_hash, rol_id, birim_id) VALUES ($1, $2, $3, $4, $5, $6)',
            [tc_no, ad, soyad, hash, rolRes.rows[0].rol_id, birim_id]
        );

        res.json({ mesaj: 'Yeni personel başarıyla oluşturuldu.' });

    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(400).json({ mesaj: 'Bu TC Kimlik No zaten kayıtlı.' });
        }
        res.status(500).json({ mesaj: 'Kayıt sırasında hata oluştu.' });
    }
};

// 5. TÜM KULLANICILARI LİSTELE
exports.getUsers = async (req, res) => {
    if (!['admin', 'ik', 'yazici', 'filo'].includes(req.user.rol)) {
        return res.status(403).json({ mesaj: 'Yetkisiz işlem' });
    }

    try {
        let query = `
            SELECT p.personel_id, p.tc_no, p.ad, p.soyad, p.aktif, p.ayrilma_nedeni, p.birim_id, r.rol_adi, b.birim_adi 
            FROM personeller p
            JOIN roller r ON p.rol_id = r.rol_id
            LEFT JOIN birimler b ON p.birim_id = b.birim_id
            ORDER BY p.ad ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ mesaj: 'Veriler çekilemedi' });
    }
};