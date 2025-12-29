const pool = require('../config/db');
const { logKaydet } = require('../utils/logger');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// YARDIMCI: Boş alanları NULL yap
const formatNull = (val) => (val === '' || val === undefined || val === 'null' ? null : val);

// YARDIMCI: Türkçe Karakter Düzeltme
const trFix = (str) => {
    if (!str) return '-';
    return String(str)
        .replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ş/g, 'S').replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
        .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c');
};

// ============================================================
// 1. LİSTELEME İŞLEMLERİ
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
// 2. YENİ PERSONEL EKLE
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

        const hamSifre = sifre || '123456'; 
        const hashedPassword = await bcrypt.hash(hamSifre, 10);

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
                fotograf_yolu, aktif
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11,
                $12, $13, $14, $15, $16,
                $17, $18, $19, $20, $21,
                $22, $23, $24, $25, $26,
                $27, TRUE
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
// 3. PERSONEL GÜNCELLE
// ============================================================
exports.personelGuncelle = async (req, res) => {
    const { id } = req.params;
    const { 
        ad, soyad, telefon, adres, gorev, kadro_tipi, gorev_yeri,
        ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden,
        tc_no, dogum_tarihi, cinsiyet, medeni_hal, kan_grubu, birim_id, rol
    } = req.body;
    
    const fotograf_yolu = req.file ? req.file.path : undefined;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        let rolId = null;
        if(rol) {
            const rolRes = await client.query("SELECT rol_id FROM roller WHERE LOWER(rol_adi) = LOWER($1)", [rol]);
            if(rolRes.rows.length > 0) rolId = rolRes.rows[0].rol_id;
        }

        let query = `
            UPDATE personeller SET 
            ad = $1, soyad = $2, telefon = $3, adres = $4,
            gorev = $5, kadro_tipi = $6, gorev_yeri = $7,
            ayakkabi_no = $8, tisort_beden = $9, gomlek_beden = $10, suveter_beden = $11, mont_beden = $12,
            tc_no = COALESCE($13, tc_no), 
            dogum_tarihi = COALESCE($14, dogum_tarihi), 
            cinsiyet = COALESCE($15, cinsiyet), 
            medeni_hal = COALESCE($16, medeni_hal), 
            kan_grubu = COALESCE($17, kan_grubu)
        `;
        
        const values = [
            ad, soyad, telefon, adres,
            gorev, kadro_tipi, gorev_yeri,
            ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden,
            tc_no, formatNull(dogum_tarihi), cinsiyet, medeni_hal, kan_grubu
        ];

        let paramIndex = 18;

        if (birim_id) {
            query += `, birim_id = $${paramIndex}`;
            values.push(birim_id);
            paramIndex++;
        }

        if (rolId) {
            query += `, rol_id = $${paramIndex}`;
            values.push(rolId);
            paramIndex++;
        }

        if (fotograf_yolu) {
            query += `, fotograf_yolu = $${paramIndex}`;
            values.push(fotograf_yolu);
            paramIndex++;
        }

        query += ` WHERE personel_id = $${paramIndex}`;
        values.push(id);

        await client.query(query, values);
        await logKaydet(req.user.id, 'GUNCELLEME', `Personel (${id}) bilgileri güncellendi.`, req);

        await client.query('COMMIT');
        res.json({ mesaj: 'Personel bilgileri güncellendi.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ mesaj: 'Güncelleme hatası', detay: err.message });
    } finally {
        client.release();
    }
};

// ============================================================
// 4. KURUMSAL PDF (HEADER RESİMLİ)
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

        const doc = new PDFDocument({ margin: 0, size: 'A4' });
        
        const filename = `${trFix(p.ad)}_${trFix(p.soyad)}_Kart.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);

        // --- 1. HEADER (pdf1.png) ---
        // 'templates' klasörü 'src'nin bir üstünde varsayılıyor
        const headerPath = path.join(__dirname, '../../templates/pdf1.png');
        
        if (fs.existsSync(headerPath)) {
            // Resmi en tepeye, tam genişlikte yerleştir
            doc.image(headerPath, 0, 0, { width: 595.28, height: 100, fit: [595.28, 150] });
        }

        // İçerik başlangıcı (Resmin altı)
        let yPos = 160; 

        // Başlık
        doc.fillColor('#000000');
        doc.font('Helvetica-Bold').fontSize(16).text('PERSONEL KİMLİK BİLGİ KARTI', 0, yPos, { align: 'center', width: 595.28 });
        
        // Çizgi
        doc.moveTo(40, yPos + 25).lineTo(555, yPos + 25).strokeColor('#cccccc').lineWidth(2).stroke();

        yPos += 40; // Aşağı in

        // --- FOTOĞRAF (SAĞ TARAF) ---
        if (p.fotograf_yolu && fs.existsSync(p.fotograf_yolu)) {
            try {
                // Çerçeve
                doc.rect(430, yPos, 110, 130).strokeColor('#333333').lineWidth(1).stroke();
                // Resim
                doc.image(p.fotograf_yolu, 431, yPos + 1, { width: 108, height: 128, fit: [108, 128] });
            } catch (e) { console.log('Resim yüklenemedi'); }
        } else {
            doc.rect(430, yPos, 110, 130).fillColor('#f0f0f0').fill().strokeColor('#333333').stroke();
            doc.fillColor('#999').fontSize(10).text('FOTOGRAF', 430, yPos + 60, { width: 110, align: 'center' });
        }

        // --- BİLGİ TABLOSU (SOL TARAF) ---
        const leftX = 50;
        const valueX = 180;
        let currentY = yPos;

        // Satır fonksiyonu
        const row = (label, value) => {
            // Arka plan
            doc.rect(leftX, currentY - 5, 360, 22).fillColor(currentY % 44 === 0 ? '#f5f5f5' : '#ffffff').fill();
            // Etiket
            doc.fillColor('#333333').font('Helvetica-Bold').fontSize(10).text(label + ':', leftX + 10, currentY);
            // Değer
            doc.fillColor('#000000').font('Helvetica').fontSize(10).text(trFix(value), valueX, currentY);
            currentY += 24;
        };

        // KİMLİK
        doc.fillColor('#d32f2f').font('Helvetica-Bold').fontSize(12).text('KİMLİK VE İLETİŞİM', leftX, currentY - 30);
        
        row('TC Kimlik No', p.tc_no);
        row('Adı Soyadı', `${p.ad} ${p.soyad}`);
        row('Telefon', p.telefon);
        row('Doğum Tarihi', p.dogum_tarihi ? new Date(p.dogum_tarihi).toLocaleDateString('tr-TR') : '-');
        
        // Adres (Uzun metin için özel)
        doc.fillColor('#333333').font('Helvetica-Bold').text('Adres:', leftX + 10, currentY);
        doc.fillColor('#000000').font('Helvetica').text(trFix(p.adres), valueX, currentY, { width: 230 });
        currentY += 45; 

        // KURUMSAL
        currentY += 10;
        doc.fillColor('#d32f2f').font('Helvetica-Bold').fontSize(12).text('KURUMSAL BİLGİLER', leftX, currentY - 5);
        currentY += 15;
        row('Sicil No', p.personel_id);
        row('Birim', p.birim_adi);
        row('Görevi', p.gorev);
        row('Kadro Tipi', p.kadro_tipi);
        row('Görev Yeri', p.gorev_yeri);
        row('İşe Giriş', p.ise_giris_tarihi ? new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR') : '-');

        // BEDEN
        currentY += 10;
        doc.fillColor('#d32f2f').font('Helvetica-Bold').fontSize(12).text('BEDEN VE KIYAFET', leftX, currentY - 5);
        currentY += 15;
        row('Ayakkabı No', p.ayakkabi_no);
        row('Mont Bedeni', p.mont_beden);
        row('Gömlek', p.gomlek_beden);
        row('Tişört', p.tisort_beden);

        // Alt Bilgi
        doc.fontSize(8).fillColor('#888888').text('Mersin Büyükşehir Belediyesi - Ulaşım Dairesi Başkanlığı', 50, 780, { align: 'center', width: 500 });

        doc.end();

    } catch (err) {
        console.error('PDF Hatası:', err);
        res.status(500).send('PDF Oluşturulamadı');
    }
};

// ============================================================
// 5. DURUM YÖNETİMİ
// ============================================================

// DONDUR
exports.personelDondur = async (req, res) => {
    const { personel_id, sebep } = req.body;
    try {
        const client = await pool.connect();
        await client.query('BEGIN');
        
        await client.query("UPDATE personeller SET aktif = FALSE, calisma_durumu = $1 WHERE personel_id = $2", [sebep, personel_id]);
        await client.query("UPDATE izin_talepleri SET durum = 'IPTAL_EDILDI' WHERE personel_id = $1 AND baslangic_tarihi > CURRENT_DATE", [personel_id]);
        
        await logKaydet(req.user.id, 'PASIFE_ALMA', `Personel (${personel_id}) pasife alındı. Sebep: ${sebep}`, req);
        
        await client.query('COMMIT');
        client.release();
        res.json({ mesaj: 'Personel pasife alındı.' });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ mesaj: 'Hata oluştu' }); 
    }
};

// AKTİF ET (DÜZELTİLDİ: calisma_durumu Eklendi)
exports.personelAktifEt = async (req, res) => {
    const { personel_id } = req.body;
    
    if (!req.user || !['admin', 'ik'].includes(req.user.rol)) {
        return res.status(403).json({ mesaj: 'Yetkisiz işlem.' });
    }

    try {
        // ÖNEMLİ: Aktif ederken 'calisma_durumu'nu da 'Çalışıyor' yapıyoruz ki 'Pasif ()' görünmesin.
        await pool.query("UPDATE personeller SET aktif = TRUE, calisma_durumu = 'Çalışıyor' WHERE personel_id = $1", [personel_id]);
        
        await logKaydet(req.user.id, 'AKTIF_ETME', `Personel (${personel_id}) tekrar aktif edildi.`, req);
        res.json({ mesaj: 'Personel başarıyla aktif edildi.' });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ mesaj: 'Hata oluştu' }); 
    }
};

// SİL
exports.personelSil = async (req, res) => {
    if (!req.user || !['admin', 'ik'].includes(req.user.rol)) return res.status(403).json({ mesaj: 'Yetkisiz işlem.' });
    
    const { personel_id } = req.params;
    const client = await pool.connect();

    try {
        const pRes = await client.query("SELECT aktif FROM personeller WHERE personel_id = $1", [personel_id]);
        if (pRes.rows.length === 0) return res.status(404).json({ mesaj: 'Personel bulunamadı.' });
        
        if (pRes.rows[0].aktif) {
            return res.status(400).json({ mesaj: 'Aktif personel silinemez! Önce Dondur işlemi yapmalısınız.' });
        }

        await client.query('BEGIN');
        await client.query('DELETE FROM bildirimler WHERE personel_id = $1', [personel_id]);
        await client.query('DELETE FROM imzalar WHERE personel_id = $1', [personel_id]);
        await client.query('DELETE FROM profil_degisiklikleri WHERE personel_id = $1', [personel_id]);
        await client.query('DELETE FROM gorevler WHERE personel_id = $1', [personel_id]);
        await client.query('DELETE FROM yetkiler WHERE personel_id = $1', [personel_id]);
        await client.query('DELETE FROM sistem_loglari WHERE personel_id = $1', [personel_id]);
        await client.query('DELETE FROM izin_talepleri WHERE personel_id = $1', [personel_id]);
        await client.query('DELETE FROM personeller WHERE personel_id = $1', [personel_id]);

        await client.query('COMMIT');
        res.json({ mesaj: 'Personel ve tüm kayıtları silindi.' });

    } catch (err) { 
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ mesaj: 'Silme başarısız.', detay: err.message });
    } finally { client.release(); }
};

// TRANSFER
exports.birimGuncelle = async (req, res) => {
    if (!req.user || !['admin', 'ik', 'yazici', 'filo'].includes(req.user.rol)) return res.status(403).json({ mesaj: 'Yetkisiz' });
    const { personel_id, yeni_birim_id, yeni_rol } = req.body;
    try {
        const client = await pool.connect();
        await client.query('BEGIN');
        await client.query('UPDATE personeller SET birim_id = $1 WHERE personel_id = $2', [yeni_birim_id, personel_id]);
        
        if (yeni_rol) {
            const rolRes = await client.query("SELECT rol_id FROM roller WHERE LOWER(rol_adi) = LOWER($1)", [yeni_rol]);
            if (rolRes.rows.length > 0) {
                await client.query('UPDATE personeller SET rol_id = $1 WHERE personel_id = $2', [rolRes.rows[0].rol_id, personel_id]);
            }
        }
        await logKaydet(req.user.id, 'TRANSFER', `Personel (${personel_id}) transfer edildi.`, req);
        await client.query('COMMIT');
        client.release();
        res.json({ mesaj: 'Transfer başarılı.' });
    } catch (err) { console.error(err); res.status(500).json({ mesaj: 'Hata oluştu' }); }
};