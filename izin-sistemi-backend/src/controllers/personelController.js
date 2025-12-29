const pool = require('../config/db');
const { logKaydet } = require('../utils/logger');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const formatNull = (val) => (val === '' || val === undefined || val === 'null' ? null : val);

// YARDIMCI: İzin Hakediş
const izinHakedisHesapla = (iseGirisTarihi) => {
    if (!iseGirisTarihi) return { yil: 0, hak: 0 };
    const giris = new Date(iseGirisTarihi);
    const fark = new Date() - giris;
    const kidemYili = Math.floor(fark / (1000 * 60 * 60 * 24 * 365.25));
    if (kidemYili < 1) return { yil: kidemYili, hak: 0 };
    let toplamHak = 0;
    for (let i = 1; i <= kidemYili; i++) {
        if (i <= 5) toplamHak += 14; else if (i < 15) toplamHak += 20; else toplamHak += 26;
    }
    return { yil: kidemYili, hak: toplamHak };
};

// 1. PERSONEL LİSTESİ
exports.personelListesi = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, b.birim_adi, r.rol_adi 
            FROM personeller p 
            LEFT JOIN birimler b ON p.birim_id = b.birim_id 
            LEFT JOIN roller r ON p.rol_id = r.rol_id
            ORDER BY p.ad ASC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};

exports.personelIzinGecmisi = async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM izin_talepleri WHERE personel_id = $1 ORDER BY baslangic_tarihi DESC`, [req.params.id]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};

exports.birimleriGetir = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM birimler ORDER BY birim_id ASC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};

// 2. PERSONEL EKLE
exports.personelEkle = async (req, res) => {
    const { 
        tc_no, ad, soyad, sifre, telefon, telefon2, dogum_tarihi, adres, 
        cinsiyet, medeni_hal, kan_grubu, egitim_durumu,
        birim_id, rol, gorev, kadro_tipi, gorev_yeri, calisma_durumu,
        ehliyet_no, ehliyet_sinifi, ehliyet_bitis_tarihi, src_belge_no, psikoteknik_tarihi, surucu_no,
        ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden,
        sicil_no, asis_kart_no, hareket_merkezi, ise_giris_tarihi
    } = req.body;

    const fotograf_yolu = req.file ? req.file.path : null;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const hashedPassword = await bcrypt.hash(sifre || '123456', 10);

        let rolId = 1;
        if (rol) {
            const rolRes = await client.query("SELECT rol_id FROM roller WHERE LOWER(rol_adi) = LOWER($1)", [rol]);
            if (rolRes.rows.length > 0) rolId = rolRes.rows[0].rol_id;
        }

        const query = `
            INSERT INTO personeller (
                tc_no, ad, soyad, sifre_hash, birim_id, rol_id,
                gorev, kadro_tipi, telefon, adres, kan_grubu, 
                egitim_durumu, dogum_tarihi, medeni_hal, cinsiyet, calisma_durumu,
                ehliyet_no, src_belge_no, psikoteknik_tarihi, surucu_no, gorev_yeri,
                ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden,
                fotograf_yolu, aktif,
                telefon2, ehliyet_sinifi, ehliyet_bitis_tarihi, sicil_no, asis_kart_no, hareket_merkezi, ise_giris_tarihi
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11,
                $12, $13, $14, $15, $16,
                $17, $18, $19, $20, $21,
                $22, $23, $24, $25, $26,
                $27, TRUE,
                $28, $29, $30, $31, $32, $33, $34
            ) RETURNING *
        `;

        const values = [
            tc_no, ad, soyad, hashedPassword, birim_id, rolId,
            gorev, kadro_tipi, telefon, adres, kan_grubu,
            egitim_durumu, formatNull(dogum_tarihi), medeni_hal, cinsiyet, calisma_durumu || 'Çalışıyor',
            ehliyet_no, src_belge_no, formatNull(psikoteknik_tarihi), surucu_no, gorev_yeri,
            ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden,
            fotograf_yolu,
            formatNull(telefon2), ehliyet_sinifi, formatNull(ehliyet_bitis_tarihi), sicil_no, asis_kart_no, hareket_merkezi, formatNull(ise_giris_tarihi)
        ];

        const result = await client.query(query, values);
        await logKaydet(req.user ? req.user.id : result.rows[0].personel_id, 'PERSONEL_EKLEME', `${ad} ${soyad} eklendi.`, req);
        await client.query('COMMIT');
        res.json({ mesaj: 'Personel oluşturuldu.', personel: result.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') return res.status(400).json({ mesaj: 'TC/Sicil zaten var.' });
        res.status(500).json({ mesaj: 'Hata', detay: err.message });
    } finally { client.release(); }
};

// 3. PERSONEL GÜNCELLE
exports.personelGuncelle = async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    const fotograf_yolu = req.file ? req.file.path : undefined;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        let rolId = null;
        if(body.rol) {
            const rolRes = await client.query("SELECT rol_id FROM roller WHERE LOWER(rol_adi) = LOWER($1)", [body.rol]);
            if(rolRes.rows.length > 0) rolId = rolRes.rows[0].rol_id;
        }

        let aktiflikDurumu = body.aktif; 
        if (body.ayrilma_tarihi && body.ayrilma_tarihi.length > 5) aktiflikDurumu = false;

        let query = `
            UPDATE personeller SET 
            ad=$1, soyad=$2, telefon=$3, adres=$4, gorev=$5, kadro_tipi=$6, gorev_yeri=$7,
            ayakkabi_no=$8, tisort_beden=$9, gomlek_beden=$10, suveter_beden=$11, mont_beden=$12,
            tc_no=COALESCE($13, tc_no), 
            dogum_tarihi=COALESCE($14, dogum_tarihi), 
            cinsiyet=COALESCE($15, cinsiyet), 
            medeni_hal=COALESCE($16, medeni_hal), 
            kan_grubu=COALESCE($17, kan_grubu),
            telefon2=$18, 
            ehliyet_no=$19, 
            ehliyet_sinifi=$20, 
            ehliyet_bitis_tarihi=COALESCE($21, ehliyet_bitis_tarihi),
            src_belge_no=$22, 
            psikoteknik_tarihi=COALESCE($23, psikoteknik_tarihi),
            sicil_no=$24, 
            asis_kart_no=$25, 
            hareket_merkezi=$26, 
            ise_giris_tarihi=COALESCE($27, ise_giris_tarihi),
            calisma_durumu=$28,
            ayrilma_tarihi=$29,
            aktif=COALESCE($30, aktif)
        `;
        
        const values = [
            body.ad, body.soyad, body.telefon, body.adres, body.gorev, body.kadro_tipi, body.gorev_yeri,
            body.ayakkabi_no, body.tisort_beden, body.gomlek_beden, body.suveter_beden, body.mont_beden,
            body.tc_no, formatNull(body.dogum_tarihi), body.cinsiyet, body.medeni_hal, body.kan_grubu,
            body.telefon2, body.ehliyet_no, body.ehliyet_sinifi, formatNull(body.ehliyet_bitis_tarihi),
            body.src_belge_no, formatNull(body.psikoteknik_tarihi),
            body.sicil_no, body.asis_kart_no, body.hareket_merkezi, formatNull(body.ise_giris_tarihi),
            body.calisma_durumu,
            formatNull(body.ayrilma_tarihi),
            aktiflikDurumu
        ];

        let pIdx = 31; 
        if (body.birim_id) { query += `, birim_id=$${pIdx++}`; values.push(body.birim_id); }
        if (rolId) { query += `, rol_id=$${pIdx++}`; values.push(rolId); }
        if (fotograf_yolu) { query += `, fotograf_yolu=$${pIdx++}`; values.push(fotograf_yolu); }

        query += ` WHERE personel_id=$${pIdx}`;
        values.push(id);

        await client.query(query, values);
        await logKaydet(req.user ? req.user.id : 0, 'GUNCELLEME', `Personel (${id}) güncellendi.`, req);
        await client.query('COMMIT');
        res.json({ mesaj: 'Güncellendi.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ mesaj: 'Hata', detay: err.message });
    } finally { client.release(); }
};

// 4. PDF OLUŞTURMA
exports.personelKartiPdf = async (req, res) => {
    const { id } = req.params;
    try {
        const client = await pool.connect();
        const pRes = await client.query(`SELECT p.*, b.birim_adi FROM personeller p LEFT JOIN birimler b ON p.birim_id = b.birim_id WHERE p.personel_id = $1`, [id]);
        const izinRes = await client.query(`SELECT * FROM izin_talepleri WHERE personel_id = $1 AND durum = 'ONAYLANDI' ORDER BY baslangic_tarihi DESC`, [id]);
        client.release();

        if (pRes.rows.length === 0) return res.status(404).send('Bulunamadı');
        const p = pRes.rows[0];
        const hakedis = izinHakedisHesapla(p.ise_giris_tarihi);
        let kullanilan = 0;
        izinRes.rows.forEach(i => { if(i.izin_turu === 'Yıllık İzin') kullanilan += i.gun_sayisi; });
        const kalan = hakedis.hak - kullanilan;

        const doc = new PDFDocument({ margin: 0, size: 'A4' });
        const fontPath = path.join(__dirname, '../../templates/font.ttf');
        if (fs.existsSync(fontPath)) doc.registerFont('TrFont', fontPath);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${p.ad}_Dosya.pdf"`);
        doc.pipe(res);

        // Header
        const headerPath = path.join(__dirname, '../../templates/pdf1.png');
        if (fs.existsSync(headerPath)) doc.image(headerPath, 0, 0, { width: 595.28, height: 100 });

        let yPos = 160;
        let font = fs.existsSync(fontPath) ? 'TrFont' : 'Helvetica';

        doc.font(font).fontSize(16).text('PERSONEL KİMLİK BİLGİ FORMU', 0, yPos, { align: 'center' });
        yPos += 40;

        // Fotoğraf
        if (p.fotograf_yolu && fs.existsSync(p.fotograf_yolu)) {
            try { doc.image(p.fotograf_yolu, 430, yPos, { width: 100, height: 120 }); } catch (e) {}
        }

        const row = (lbl, val) => {
            doc.fontSize(10).text(lbl + ':', 50, yPos).text(val || '-', 180, yPos);
            yPos += 20;
        };

        row('TC No', p.tc_no);
        row('Ad Soyad', `${p.ad} ${p.soyad}`);
        row('Birim', p.birim_adi);
        row('Görev', p.gorev);
        row('Giriş Tarihi', p.ise_giris_tarihi ? new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR') : '-');
        row('Kalan İzin', `${kalan} Gün`);

        doc.end();
    } catch (err) { res.status(500).send('Hata'); }
};

// 5. DİĞER İŞLEMLER
exports.personelDondur = async (req, res) => {
    try { await pool.query("UPDATE personeller SET aktif = FALSE, calisma_durumu = $1 WHERE personel_id = $2", [req.body.sebep, req.body.personel_id]); res.json({ mesaj: 'Pasif' }); } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};
exports.personelAktifEt = async (req, res) => {
    try { await pool.query("UPDATE personeller SET aktif = TRUE, calisma_durumu = 'Çalışıyor' WHERE personel_id = $1", [req.body.personel_id]); res.json({ mesaj: 'Aktif' }); } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};
exports.personelSil = async (req, res) => {
    try { await pool.query('DELETE FROM personeller WHERE personel_id = $1', [req.params.personel_id]); res.json({ mesaj: 'Silindi' }); } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};
exports.birimGuncelle = async (req, res) => {
    try { await pool.query('UPDATE personeller SET birim_id = $1 WHERE personel_id = $2', [req.body.yeni_birim_id, req.body.personel_id]); res.json({ mesaj: 'Transfer' }); } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};