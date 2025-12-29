const pool = require('../config/db');
const { logKaydet } = require('../utils/logger');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// YARDIMCI: Boş alan kontrolü
const formatNull = (val) => (val === '' || val === undefined || val === 'null' ? null : val);

// ============================================================
// 1. TÜM BİRİMLERİ GETİR
// ============================================================
exports.birimleriGetir = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM birimler ORDER BY birim_id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ mesaj: 'Birim listesi alınamadı.' });
    }
};

// ============================================================
// 2. YENİ PERSONEL EKLE (Resim + Adres + Tüm Detaylar)
// ============================================================
exports.personelEkle = async (req, res) => {
    const { 
        tc_no, ad, soyad, sifre, telefon, dogum_tarihi, adres, 
        cinsiyet, medeni_hal, kan_grubu, egitim_durumu,
        birim_id, rol, gorev, kadro_tipi, gorev_yeri, calisma_durumu,
        ehliyet_no, src_belge_no, psikoteknik_tarihi, surucu_no,
        ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden
    } = req.body;

    const fotograf_yolu = req.file ? req.file.path : null;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Şifre Hashleme
        const hamSifre = sifre || '123456'; 
        const hashedPassword = await bcrypt.hash(hamSifre, 10);

        // Rol ID Bulma
        let rolId = 1;
        const rolAdi = rol || 'personel'; 
        const rolRes = await client.query("SELECT rol_id FROM roller WHERE LOWER(rol_adi) = LOWER($1)", [rolAdi]);
        if (rolRes.rows.length > 0) rolId = rolRes.rows[0].rol_id;

        const query = `
            INSERT INTO personeller (
                tc_no, ad, soyad, sifre_hash, birim_id, rol_id,
                gorev, kadro_tipi, telefon, adres, kan_grubu, 
                egitim_durumu, dogum_tarihi, medeni_hal, cinsiyet, calisma_durumu,
                ehliyet_no, src_belge_no, psikoteknik_tarihi, surucu_no, gorev_yeri,
                ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden,
                fotograf_yolu
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11,
                $12, $13, $14, $15, $16,
                $17, $18, $19, $20, $21,
                $22, $23, $24, $25, $26,
                $27
            ) RETURNING *
        `;

        const values = [
            tc_no, ad, soyad, hashedPassword, birim_id, rolId,
            gorev, kadro_tipi, telefon, adres, kan_grubu,
            egitim_durumu, formatNull(dogum_tarihi), medeni_hal, cinsiyet, calisma_durumu || 'Çalışıyor',
            ehliyet_no, src_belge_no, formatNull(psikoteknik_tarihi), surucu_no, gorev_yeri,
            ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden,
            fotograf_yolu
        ];

        const result = await client.query(query, values);
        
        const islemYapanId = req.user ? req.user.id : result.rows[0].personel_id;
        await logKaydet(islemYapanId, 'PERSONEL_EKLEME', `${ad} ${soyad} (TC: ${tc_no}) eklendi.`, req);

        await client.query('COMMIT');
        res.json({ mesaj: 'Personel başarıyla oluşturuldu.', personel: result.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Personel Ekleme Hatası:', err);
        if (err.code === '23505') return res.status(400).json({ mesaj: 'Bu TC Kimlik No ile kayıt zaten var.' });
        res.status(500).json({ mesaj: 'Veritabanı hatası.', detay: err.message });
    } finally { client.release(); }
};

// ============================================================
// 3. PERSONEL GÜNCELLE (DÜZENLEME)
// ============================================================
exports.personelGuncelle = async (req, res) => {
    const { id } = req.params;
    const { 
        ad, soyad, telefon, adres, gorev, kadro_tipi, gorev_yeri,
        ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden
    } = req.body;
    
    // Yeni fotoğraf varsa al
    const fotograf_yolu = req.file ? req.file.path : undefined;

    try {
        let query = `
            UPDATE personeller SET 
            ad = $1, soyad = $2, telefon = $3, adres = $4,
            gorev = $5, kadro_tipi = $6, gorev_yeri = $7,
            ayakkabi_no = $8, tisort_beden = $9, gomlek_beden = $10, suveter_beden = $11, mont_beden = $12
        `;
        
        const values = [
            ad, soyad, telefon, adres,
            gorev, kadro_tipi, gorev_yeri,
            ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden
        ];

        // Fotoğraf geldiyse onu da güncelle, gelmediyse eskisini koru
        if (fotograf_yolu) {
            query += `, fotograf_yolu = $13 WHERE personel_id = $14`;
            values.push(fotograf_yolu, id);
        } else {
            query += ` WHERE personel_id = $13`;
            values.push(id);
        }

        await pool.query(query, values);
        await logKaydet(req.user.id, 'GUNCELLEME', `Personel (${id}) bilgileri güncellendi.`, req);

        res.json({ mesaj: 'Personel bilgileri güncellendi.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ mesaj: 'Güncelleme hatası', detay: err.message });
    }
};

// ============================================================
// 4. PERSONEL KARTI PDF OLUŞTURMA
// ============================================================
exports.personelKartiPdf = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT p.*, b.birim_adi 
            FROM personeller p 
            LEFT JOIN birimler b ON p.birim_id = b.birim_id 
            WHERE p.personel_id = $1`, [id]);
        
        if (result.rows.length === 0) return res.status(404).send('Personel bulunamadı');
        const p = result.rows[0];

        const doc = new PDFDocument({ margin: 50 });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${p.ad}_${p.soyad}_Kart.pdf`);
        doc.pipe(res);

        // --- PDF TASARIMI ---
        doc.fontSize(20).text('MERSİN BÜYÜKŞEHİR BELEDİYESİ', { align: 'center' });
        doc.fontSize(14).text('PERSONEL BİLGİ KARTI', { align: 'center' });
        doc.moveDown(2);

        // Fotoğrafı yerleştir
        if (p.fotograf_yolu && fs.existsSync(p.fotograf_yolu)) {
            try {
                // Sayfanın sağ üst köşesine
                doc.image(p.fotograf_yolu, 450, 80, { width: 100, height: 120, fit: [100, 120] });
            } catch(e) { console.log('Resim yüklenemedi:', e); }
        }

        const satirYaz = (baslik, deger) => {
            doc.fontSize(10).font('Helvetica-Bold').text(baslik + ':', { continued: true });
            doc.font('Helvetica').text(`  ${deger || '-'}`);
            doc.moveDown(0.5);
        };

        // BÖLÜM 1: KİMLİK
        doc.fontSize(12).font('Helvetica-Bold').text('KİMLİK VE İLETİŞİM', { underline: true });
        doc.moveDown(0.5);
        satirYaz('TC Kimlik No', p.tc_no);
        satirYaz('Adı Soyadı', `${p.ad} ${p.soyad}`);
        satirYaz('Telefon', p.telefon);
        satirYaz('Adres', p.adres); 
        satirYaz('Doğum Tarihi', p.dogum_tarihi ? new Date(p.dogum_tarihi).toLocaleDateString('tr-TR') : '-');

        doc.moveDown(1);
        
        // BÖLÜM 2: KURUMSAL
        doc.fontSize(12).font('Helvetica-Bold').text('KURUMSAL BİLGİLER', { underline: true });
        doc.moveDown(0.5);
        satirYaz('Sicil No', p.personel_id);
        satirYaz('Birim', p.birim_adi);
        satirYaz('Görevi', p.gorev);
        satirYaz('Kadro Tipi', p.kadro_tipi);
        satirYaz('Görev Yeri', p.gorev_yeri);

        doc.moveDown(1);

        // BÖLÜM 3: BEDEN VE KIYAFET
        doc.fontSize(12).font('Helvetica-Bold').text('BEDEN VE KIYAFET', { underline: true });
        doc.moveDown(0.5);
        satirYaz('Ayakkabı No', p.ayakkabi_no);
        satirYaz('Mont Bedeni', p.mont_beden);
        satirYaz('Gömlek', p.gomlek_beden);
        satirYaz('Tişört', p.tisort_beden);

        doc.end();

    } catch (err) {
        console.error('PDF Hatası:', err);
        res.status(500).send('PDF Oluşturulamadı');
    }
};

// ============================================================
// 5. PERSONEL TRANSFER ET
// ============================================================
exports.birimGuncelle = async (req, res) => {
    if (!req.user || !['admin', 'ik', 'yazici', 'filo'].includes(req.user.rol)) return res.status(403).json({ mesaj: 'Yetkisiz' });
    const { personel_id, yeni_birim_id, yeni_rol } = req.body;
    try {
        await pool.query('UPDATE personeller SET birim_id = $1 WHERE personel_id = $2', [yeni_birim_id, personel_id]);
        if (yeni_rol) {
            const rolRes = await pool.query("SELECT rol_id FROM roller WHERE LOWER(rol_adi) = LOWER($1)", [yeni_rol]);
            if (rolRes.rows.length > 0) {
                await pool.query('UPDATE personeller SET rol_id = $1 WHERE personel_id = $2', [rolRes.rows[0].rol_id, personel_id]);
            }
        }
        await logKaydet(req.user.id, 'TRANSFER', `Personel (${personel_id}) transfer edildi.`, req);
        res.json({ mesaj: 'Transfer başarılı.' });
    } catch (err) { console.error(err); res.status(500).json({ mesaj: 'Hata oluştu' }); }
};

// ============================================================
// 6. PERSONEL DONDUR / SİL
// ============================================================
exports.personelDondur = async (req, res) => {
    if (!req.user || !['admin', 'ik'].includes(req.user.rol)) return res.status(403).json({ mesaj: 'Yetkisiz' });
    const { personel_id, sebep } = req.body;
    try {
        await pool.query("UPDATE personeller SET aktif = FALSE, calisma_durumu = $1 WHERE personel_id = $2", [sebep, personel_id]);
        await pool.query("UPDATE izin_talepleri SET durum = 'IPTAL_EDILDI' WHERE personel_id = $1 AND baslangic_tarihi > CURRENT_DATE", [personel_id]);
        await logKaydet(req.user.id, 'PERSONEL_CIKARMA', `Personel (${personel_id}) pasife alındı. Sebep: ${sebep}`, req);
        res.json({ mesaj: 'Personel pasife alındı.' });
    } catch (err) { console.error(err); res.status(500).json({ mesaj: 'Hata oluştu' }); }
};