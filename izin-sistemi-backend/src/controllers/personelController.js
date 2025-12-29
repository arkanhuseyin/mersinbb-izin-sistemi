const pool = require('../config/db');
const { logKaydet } = require('../utils/logger');

// ============================================================
// 1. TÜM BİRİMLERİ GETİR (Dropdown İçin)
// ============================================================
exports.birimleriGetir = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM birimler ORDER BY birim_id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Birim listesi alınamadı.');
    }
};

// ============================================================
// 2. YENİ PERSONEL EKLE (TAM DETAYLI + KIYAFET)
// ============================================================
exports.personelEkle = async (req, res) => {
    // Frontend'den gelen 25 farklı veriyi alıyoruz
    const { 
        // 1. Kimlik
        tc_no, ad, soyad, sifre, telefon, dogum_tarihi, 
        cinsiyet, medeni_hal, kan_grubu, egitim_durumu,
        
        // 2. Kurumsal
        birim_id, rol, gorev, kadro_tipi, gorev_yeri, calisma_durumu,
        
        // 3. Lojistik / Sürücü
        ehliyet_no, src_belge_no, psikoteknik_tarihi, surucu_no,

        // 4. Kıyafet / Beden (YENİ)
        ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden
    } = req.body;

    // Şifreyi olduğu gibi alıyoruz (İstersen burada bcrypt ile hashleyebilirsin)
    const hashedPassword = sifre; 

    // Boş gelen tarih veya sayısal alanları NULL yapmak için yardımcı fonksiyon
    const formatNull = (val) => (val === '' || val === undefined ? null : val);

    try {
        const query = `
            INSERT INTO personeller (
                tc_no, ad, soyad, sifre, birim_id, rol,
                gorev, kadro_tipi, telefon, kan_grubu,
                egitim_durumu, dogum_tarihi, medeni_hal, cinsiyet, calisma_durumu,
                ehliyet_no, src_belge_no, psikoteknik_tarihi, surucu_no, gorev_yeri,
                ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10,
                $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20,
                $21, $22, $23, $24, $25
            ) RETURNING *
        `;

        const values = [
            tc_no, ad, soyad, hashedPassword, birim_id, rol || 'personel',
            gorev, kadro_tipi, telefon, kan_grubu,
            egitim_durumu, formatNull(dogum_tarihi), medeni_hal, cinsiyet, calisma_durumu || 'Çalışıyor',
            ehliyet_no, src_belge_no, formatNull(psikoteknik_tarihi), surucu_no, gorev_yeri,
            ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden
        ];

        const result = await pool.query(query, values);
        
        // İşlem Logu
        await logKaydet(req.user.id, 'PERSONEL_EKLEME', `${ad} ${soyad} (TC: ${tc_no}) sisteme eklendi.`, req);

        res.json({ mesaj: 'Personel kartı başarıyla oluşturuldu.', personel: result.rows[0] });

    } catch (err) {
        console.error('Personel Ekleme Hatası:', err);
        if (err.code === '23505') { 
            return res.status(400).json({ mesaj: 'Bu TC Kimlik No ile kayıtlı personel zaten var!' });
        }
        res.status(500).json({ mesaj: 'Veritabanı hatası oluştu.' });
    }
};

// ============================================================
// 3. PERSONEL TRANSFER ET (Birim/Rol Değişikliği)
// ============================================================
exports.birimGuncelle = async (req, res) => {
    // Sadece yetkili roller yapabilir
    if (!['admin', 'ik', 'yazici', 'filo'].includes(req.user.rol)) {
        return res.status(403).json({ mesaj: 'Bu işlem için yetkiniz yok.' });
    }

    const { personel_id, yeni_birim_id, yeni_rol } = req.body;
    
    try {
        let query = 'UPDATE personeller SET birim_id = $1';
        let params = [yeni_birim_id, personel_id];
        
        // Eğer rol de değişecekse sorguyu güncelle
        if (yeni_rol) {
            query += ', rol = $3 WHERE personel_id = $2';
            params = [yeni_birim_id, personel_id, yeni_rol];
        } else {
            query += ' WHERE personel_id = $2';
        }

        await pool.query(query, params);
        
        // Log al
        await logKaydet(req.user.id, 'TRANSFER', `Personel (${personel_id}) transfer edildi.`, req);

        res.json({ mesaj: 'Personel transfer işlemi başarılı.' });
    } catch (err) { 
        console.error(err);
        res.status(500).send('Transfer sırasında hata oluştu.'); 
    }
};

// ============================================================
// 4. PERSONEL DONDUR / PASİFE AL / SİL
// ============================================================
exports.personelDondur = async (req, res) => {
    if (!['admin', 'ik'].includes(req.user.rol)) return res.status(403).json({ mesaj: 'Yetkisiz' });
    
    const { personel_id, sebep } = req.body; // Sebep: 'EMEKLİLİK', 'İSTİFA' vb.

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Personeli pasife çek
        await client.query(
            "UPDATE personeller SET aktif = FALSE, calisma_durumu = $1 WHERE personel_id = $2", 
            [sebep, personel_id]
        );

        // 2. Gelecek tarihli izin taleplerini iptal et
        await client.query(
            "UPDATE izin_talepleri SET durum = 'IPTAL_EDILDI' WHERE personel_id = $1 AND baslangic_tarihi > CURRENT_DATE",
            [personel_id]
        );

        // 3. Log kaydı
        await logKaydet(req.user.id, 'PERSONEL_CIKARMA', `Personel (${personel_id}) pasife alındı. Sebep: ${sebep}`, req);
        
        await client.query('COMMIT');
        res.json({ mesaj: `Personel pasife alındı. Sebep: ${sebep}` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ mesaj: 'İşlem sırasında hata oluştu' });
    } finally {
        client.release();
    }
};