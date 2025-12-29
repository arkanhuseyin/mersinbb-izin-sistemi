const pool = require('../config/db');
const { logKaydet } = require('../utils/logger');

// ============================================================
// 1. TÜM BİRİMLERİ GETİR
// ============================================================
exports.birimleriGetir = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM birimler ORDER BY birim_id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Birim getirme hatası:', err);
        res.status(500).json({ mesaj: 'Birim listesi alınamadı.' });
    }
};

// ============================================================
// 2. YENİ PERSONEL EKLE (ŞEMAYA UYGUN DÜZELTİLDİ)
// ============================================================
exports.personelEkle = async (req, res) => {
    const { 
        tc_no, ad, soyad, sifre, telefon, dogum_tarihi, 
        cinsiyet, medeni_hal, kan_grubu, egitim_durumu,
        birim_id, rol, gorev, kadro_tipi, gorev_yeri, calisma_durumu,
        ehliyet_no, src_belge_no, psikoteknik_tarihi, surucu_no,
        ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden
    } = req.body;

    // Boş gelen alanları NULL yap
    const formatNull = (val) => (val === '' || val === undefined ? null : val);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // ADIM 1: ROL İSMİNİ ID'YE ÇEVİRME
        // Frontend 'personel' gönderiyor ama DB 'rol_id' istiyor.
        // Önce rol tablosundan bu ismin ID'sini buluyoruz.
        let rolId = null;
        const rolAdi = rol || 'personel'; // Varsayılan rol

        // Rolleri ara (Küçük harf duyarlılığı için LOWER kullanıyoruz)
        const rolRes = await client.query("SELECT rol_id FROM roller WHERE LOWER(rol_adi) = LOWER($1)", [rolAdi]);
        
        if (rolRes.rows.length > 0) {
            rolId = rolRes.rows[0].rol_id;
        } else {
            // Eğer rol bulunamazsa varsayılan olarak 1 (Genelde Personel) atayalım veya hata verdirelim.
            // Şimdilik güvenli olması için 'personel' rolünü 1 varsayıyoruz.
            // Eğer senin DB'de personel rolünün ID'si farklıysa burayı güncelle!
            rolId = 1; 
        }

        // ADIM 2: KAYIT SORGUSU (Sütun isimleri şemana göre düzeltildi)
        // Düzeltmeler: sifre -> sifre_hash, rol -> rol_id
        const query = `
            INSERT INTO personeller (
                tc_no, ad, soyad, sifre_hash, birim_id, rol_id,
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
            tc_no, ad, soyad, sifre, birim_id, rolId,
            gorev, kadro_tipi, telefon, kan_grubu,
            egitim_durumu, formatNull(dogum_tarihi), medeni_hal, cinsiyet, calisma_durumu || 'Çalışıyor',
            ehliyet_no, src_belge_no, formatNull(psikoteknik_tarihi), surucu_no, gorev_yeri,
            ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden
        ];

        const result = await client.query(query, values);

        // Loglama
        const islemYapanId = req.user ? req.user.id : result.rows[0].personel_id;
        await logKaydet(islemYapanId, 'PERSONEL_EKLEME', `${ad} ${soyad} (TC: ${tc_no}) eklendi.`, req);

        await client.query('COMMIT');
        res.json({ mesaj: 'Personel başarıyla oluşturuldu.', personel: result.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Personel Ekleme Hatası:', err);
        
        if (err.code === '23505') { 
            return res.status(400).json({ mesaj: 'Bu TC Kimlik No ile zaten bir kayıt var.' });
        }
        
        // Hatanın detayını frontend'e gönderiyoruz ki görebilelim
        res.status(500).json({ 
            mesaj: 'Veritabanı hatası oluştu.', 
            detay: err.message 
        });
    } finally {
        client.release();
    }
};

// ============================================================
// 3. PERSONEL TRANSFER ET
// ============================================================
exports.birimGuncelle = async (req, res) => {
    if (!req.user || !['admin', 'ik', 'yazici', 'filo'].includes(req.user.rol)) {
        return res.status(403).json({ mesaj: 'Bu işlem için yetkiniz yok.' });
    }

    const { personel_id, yeni_birim_id, yeni_rol } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        let query = 'UPDATE personeller SET birim_id = $1';
        let params = [yeni_birim_id, personel_id];
        
        // Rol güncelleme varsa ID'sini bulmamız lazım
        if (yeni_rol) {
            // Frontend string gönderiyorsa (örn: 'admin'), ID'sini bul
            const rolRes = await client.query("SELECT rol_id FROM roller WHERE LOWER(rol_adi) = LOWER($1)", [yeni_rol]);
            let yeniRolId = 1; // Varsayılan
            if (rolRes.rows.length > 0) yeniRolId = rolRes.rows[0].rol_id;

            query += ', rol_id = $3 WHERE personel_id = $2';
            params = [yeni_birim_id, personel_id, yeniRolId];
        } else {
            query += ' WHERE personel_id = $2';
        }

        await client.query(query, params);
        await logKaydet(req.user.id, 'TRANSFER', `Personel (${personel_id}) transfer edildi.`, req);
        
        await client.query('COMMIT');
        res.json({ mesaj: 'Transfer işlemi başarılı.' });

    } catch (err) { 
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ mesaj: 'Transfer sırasında hata oluştu.' }); 
    } finally {
        client.release();
    }
};

// ============================================================
// 4. PERSONEL DONDUR / SİL
// ============================================================
exports.personelDondur = async (req, res) => {
    if (!req.user || !['admin', 'ik'].includes(req.user.rol)) {
        return res.status(403).json({ mesaj: 'Yetkisiz işlem.' });
    }

    const { personel_id, sebep } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Pasife al
        await client.query(
            "UPDATE personeller SET aktif = FALSE, calisma_durumu = $1 WHERE personel_id = $2", 
            [sebep, personel_id]
        );

        // İzinleri iptal et
        await client.query(
            "UPDATE izin_talepleri SET durum = 'IPTAL_EDILDI' WHERE personel_id = $1 AND baslangic_tarihi > CURRENT_DATE",
            [personel_id]
        );

        await logKaydet(req.user.id, 'PERSONEL_CIKARMA', `Personel (${personel_id}) pasife alındı. Sebep: ${sebep}`, req);
        
        await client.query('COMMIT');
        res.json({ mesaj: `Personel pasife alındı. Sebep: ${sebep}` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ mesaj: 'İşlem hatası.' });
    } finally {
        client.release();
    }
};