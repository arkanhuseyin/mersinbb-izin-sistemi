const pool = require('../config/db');
const { logKaydet, hareketKaydet } = require('../utils/logger');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ✅ YENİ: Merkezi Hakediş Hesaplama Modülü
const { hesaplaKumulatif, hesaplaBuYil } = require('../utils/hakedisHesapla');

// ============================================================
// 🛠️ YARDIMCI FONKSİYONLAR (Fix İçin Gerekli)
// ============================================================

// 1. Boş gelen tarihleri NULL yapar (Hata almanı engeller)
const cleanDate = (dateStr) => {
    if (!dateStr || dateStr === '' || dateStr === 'null' || dateStr === 'undefined') return null;
    return dateStr;
};

// 2. String/Null kontrolü
const formatNull = (val) => (val === '' || val === undefined || val === 'null' ? null : val);

// 3. Tarih Formatla (DD.MM.YYYY -> YYYY-MM-DD)
const tarihFormatla = (tarihStr) => {
    if (!tarihStr) return null;
    const str = String(tarihStr).trim();
    if (str.includes('.')) {
        const parts = str.split('.');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    if (str.includes('T')) return str.split('T')[0];
    return str;
};

// 4. Bakiye Hesaplama Yardımcısı
const hesaplaBakiye = async (personel_id) => {
    const pRes = await pool.query("SELECT ise_giris_tarihi, dogum_tarihi, ayrilma_tarihi, aktif FROM personeller WHERE personel_id = $1", [personel_id]);
    if (pRes.rows.length === 0) return 0;
    const p = pRes.rows[0];

    const gecmisRes = await pool.query("SELECT COALESCE(SUM(gun_sayisi), 0) as toplam FROM izin_gecmis_bakiyeler WHERE personel_id = $1", [personel_id]);
    const devreden = parseInt(gecmisRes.rows[0].toplam) || 0;

    const kumulatifHak = await hesaplaKumulatif(p.ise_giris_tarihi, p.dogum_tarihi, p.ayrilma_tarihi, p.aktif);

    const izinRes = await pool.query(`
        SELECT SUM(kac_gun) as toplam 
        FROM izin_talepleri 
        WHERE personel_id = $1 
        AND durum IN ('IK_ONAYLADI', 'TAMAMLANDI') 
        AND izin_turu = 'YILLIK İZİN'
    `, [personel_id]);
    const kullanilan = parseInt(izinRes.rows[0].toplam) || 0;

    return (kumulatifHak + devreden) - kullanilan;
};

// ============================================================
// 1. LİSTELEME İŞLEMLERİ
// ============================================================
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

// ============================================================
// 2. PDF OLUŞTURMA (SENİN KODUN AYNI KALDI)
// ============================================================
exports.personelKartiPdf = async (req, res) => {
    const { id } = req.params;
    try {
        const client = await pool.connect();
        const pRes = await client.query(`
            SELECT p.*, b.birim_adi, r.rol_adi 
            FROM personeller p 
            LEFT JOIN birimler b ON p.birim_id = b.birim_id 
            LEFT JOIN roller r ON p.rol_id = r.rol_id
            WHERE p.personel_id = $1
        `, [id]);
        
        const izinRes = await client.query(`
            SELECT * FROM izin_talepleri 
            WHERE personel_id = $1 AND durum = 'IK_ONAYLADI' 
            ORDER BY baslangic_tarihi DESC LIMIT 15
        `, [id]);
        
        client.release();

        if (pRes.rows.length === 0) return res.status(404).send('Personel bulunamadı');
        const p = pRes.rows[0];

        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        const fontPath = path.join(__dirname, '../../templates/font.ttf'); 
        const headerPath = path.join(__dirname, '../../templates/pdf1.png');

        if (fs.existsSync(fontPath)) {
            doc.registerFont('TrFont', fontPath);
            doc.font('TrFont');
        } else {
            doc.font('Helvetica');
        }

        const safeFilename = `${p.ad.replace(/[^a-zA-Z0-9]/g, '')}_PersonelKarti.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        doc.pipe(res);

        if (fs.existsSync(headerPath)) {
            doc.image(headerPath, 0, 0, { width: 595.28, height: 100 });
        } else {
            doc.fontSize(18).text('MERSİN BÜYÜKŞEHİR BELEDİYESİ', 0, 40, { align: 'center' });
        }

        let y = 130; 
        doc.fontSize(16).fillColor('#000000').text('PERSONEL KİMLİK BİLGİ FORMU', 0, y, { align: 'center' });
        doc.rect(30, y + 20, 535, 2).fill('#cc0000'); 
        y += 40;

        const photoX = 430; const photoY = y; const photoW = 110; const photoH = 130;
        doc.rect(photoX, photoY, photoW, photoH).strokeColor('#333').lineWidth(1).stroke();
        if (p.fotograf_yolu && fs.existsSync(p.fotograf_yolu)) {
            try { doc.image(p.fotograf_yolu, photoX + 1, photoY + 1, { width: photoW - 2, height: photoH - 2, fit: [photoW-2, photoH-2] }); } catch (e) {}
        }

        const labelX = 30; const valueX = 160; const rowH = 20;
        const drawRow = (label, value) => {
            if (((y - 170) / 20) % 2 === 1) doc.rect(labelX, y - 2, 380, rowH).fillColor('#f9f9f9').fill();
            doc.fillColor('#333333').fontSize(9).font(fs.existsSync(fontPath) ? 'TrFont' : 'Helvetica-Bold').text(label, labelX + 5, y + 4);
            const valStr = (value === null || value === undefined || value === '') ? '-' : String(value);
            doc.fillColor('#000000').fontSize(9).font(fs.existsSync(fontPath) ? 'TrFont' : 'Helvetica').text(valStr, valueX, y + 4);
            y += rowH;
        };

        doc.fillColor('#cc0000').fontSize(11).text('KİMLİK VE İLETİŞİM BİLGİLERİ', labelX, y - 15);
        y += 5;
        drawRow('TC Kimlik No', p.tc_no);
        drawRow('Adı Soyadı', `${p.ad} ${p.soyad}`);
        drawRow('Sicil No', p.sicil_no);
        drawRow('Doğum Tarihi', p.dogum_tarihi ? new Date(p.dogum_tarihi).toLocaleDateString('tr-TR') : '-');
        drawRow('Kan Grubu', p.kan_grubu);
        drawRow('Telefon', p.telefon);
        drawRow('E-Posta', p.email);
        drawRow('Adres', p.adres ? p.adres.substring(0, 45) : '-'); 
        y += 10; 

        doc.fillColor('#cc0000').fontSize(11).text('KURUMSAL BİLGİLER', labelX, y - 5);
        y += 10;
        drawRow('Birim', p.birim_adi);
        drawRow('Hareket Merkezi', p.hareket_merkezi);
        drawRow('Görevi', p.gorev);
        drawRow('Kadro Tipi', p.kadro_tipi);
        drawRow('Sistem Rolü', p.rol_adi ? p.rol_adi.toUpperCase() : '-');
        drawRow('İşe Giriş Tarihi', p.ise_giris_tarihi ? new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR') : '-');
        drawRow('ASİS Kart No', p.asis_kart_no);
        drawRow('Çalışma Durumu', p.calisma_durumu);
        y += 10;

        doc.fillColor('#cc0000').fontSize(11).text('EHLİYET VE BELGELER', labelX, y - 5);
        y += 10;
        const fullWidth = 535; const col2X = 300;
        
        doc.rect(labelX, y - 2, fullWidth, rowH).fillColor('#f0f0f0').fill();
        doc.fillColor('#333').text('Ehliyet No:', labelX + 5, y + 4);
        doc.fillColor('#000').text(p.ehliyet_no || '-', valueX, y + 4);
        doc.fillColor('#333').text('Sınıfı:', col2X, y + 4);
        doc.fillColor('#000').text(p.ehliyet_sinifi || '-', col2X + 50, y + 4);
        y += rowH;

        doc.rect(labelX, y - 2, fullWidth, rowH).fillColor('#fff').fill();
        doc.fillColor('#333').text('SRC Belge No:', labelX + 5, y + 4);
        doc.fillColor('#000').text(p.src_belge_no || '-', valueX, y + 4);
        doc.fillColor('#333').text('Psikoteknik:', col2X, y + 4);
        doc.fillColor('#000').text(p.psiko_tarih ? new Date(p.psiko_tarih).toLocaleDateString('tr-TR') : '-', col2X + 50, y + 4);
        y += rowH;
        y += 10;

        doc.fillColor('#cc0000').fontSize(11).text('LOJİSTİK - BEDEN ÖLÇÜLERİ', labelX, y - 5);
        y += 10;
        const sizes = [{ l: 'Ayakkabı', v: p.ayakkabi_no }, { l: 'T-shirt', v: p.tisort_beden }, { l: 'Gömlek', v: p.gomlek_beden }, { l: 'Mont', v: p.mont_beden }, { l: 'Süveter', v: p.suveter_beden }];
        let xOffset = labelX;
        sizes.forEach(s => {
            doc.rect(xOffset, y, 90, 35).fillColor('#eef2f3').strokeColor('#ccc').fillAndStroke();
            doc.fillColor('#666').fontSize(8).text(s.l, xOffset, y + 5, { width: 90, align: 'center' });
            doc.fillColor('#000').fontSize(12).text(s.v || '-', xOffset, y + 18, { width: 90, align: 'center' });
            xOffset += 100;
        });
        y += 50;

        if (y > 650) { doc.addPage(); y = 50; } else { y += 20; }
        doc.fillColor('#000').fontSize(14).text('SON ONAYLANAN İZİN HAREKETLERİ', labelX, y);
        doc.rect(labelX, y + 20, fullWidth, 2).fill('#333');
        y += 30;
        doc.rect(labelX, y, fullWidth, 20).fillColor('#333').fill();
        doc.fillColor('#fff').fontSize(9);
        doc.text('İzin Türü', labelX + 10, y + 5);
        doc.text('Başlangıç', labelX + 150, y + 5);
        doc.text('Bitiş', labelX + 250, y + 5);
        doc.text('Gün', labelX + 350, y + 5);
        doc.text('Durum', labelX + 420, y + 5);
        y += 20;

        if (izinRes.rows.length > 0) {
            izinRes.rows.forEach((izin, i) => {
                const bg = i % 2 === 0 ? '#fff' : '#f9f9f9';
                doc.rect(labelX, y, fullWidth, 20).fillColor(bg).fill();
                doc.fillColor('#000');
                doc.text(izin.izin_turu, labelX + 10, y + 5);
                doc.text(new Date(izin.baslangic_tarihi).toLocaleDateString('tr-TR'), labelX + 150, y + 5);
                doc.text(new Date(izin.bitis_tarihi).toLocaleDateString('tr-TR'), labelX + 250, y + 5);
                doc.text(izin.kac_gun + ' Gün', labelX + 350, y + 5);
                doc.text('ONAYLI', labelX + 420, y + 5);
                y += 20;
            });
        }
        doc.end();
    } catch (err) { res.status(500).send('PDF Oluşturulamadı'); }
};

// ============================================================
// 3. PERSONEL EKLEME (FIXED)
// ============================================================
exports.personelEkle = async (req, res) => {
    const { 
        tc_no, ad, soyad, sifre, telefon, telefon2, dogum_tarihi, adres, 
        cinsiyet, medeni_hal, kan_grubu, egitim_durumu,
        birim_id, rol, gorev, kadro_tipi, gorev_yeri, calisma_durumu,
        ehliyet_no, ehliyet_sinifi, ehliyet_tarih, src_belge_no, psiko_tarih, surucu_no,
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
                ehliyet_no, src_belge_no, psiko_tarih, surucu_no, gorev_yeri,
                ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden,
                fotograf_yolu, aktif,
                telefon2, ehliyet_sinifi, ehliyet_tarih, sicil_no, asis_kart_no, hareket_merkezi, ise_giris_tarihi
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
            egitim_durumu, cleanDate(dogum_tarihi), medeni_hal, cinsiyet, calisma_durumu || 'Çalışıyor',
            ehliyet_no, src_belge_no, cleanDate(psiko_tarih), surucu_no, gorev_yeri,
            ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden,
            fotograf_yolu,
            formatNull(telefon2), ehliyet_sinifi, cleanDate(ehliyet_tarih), sicil_no, asis_kart_no, hareket_merkezi, cleanDate(ise_giris_tarihi)
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

// ============================================================
// 4. PERSONEL GÜNCELLEME (HEPSİNİ KAPSAYAN DEV GÜNCELLEME)
// ============================================================
exports.personelGuncelle = async (req, res) => {
    const { id } = req.params;
    
    // Frontend'den gelen tüm verileri alıyoruz
    const { 
        tc_no, ad, soyad, telefon, telefon2, adres, 
        dogum_tarihi, cinsiyet, medeni_hal, kan_grubu, egitim_durumu,
        birim_id, gorev, kadro_tipi, gorev_yeri, calisma_durumu,
        ehliyet_no, ehliyet_sinifi, ehliyet_tarih, src_belge_no, psiko_tarih, surucu_no,
        ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden,
        sicil_no, asis_kart_no, hareket_merkezi, ise_giris_tarihi, ayrilma_tarihi,
        rol, sifre // Şifre değiştirilmek istenirse
    } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Mevcut personeli bul
        const currentRes = await client.query("SELECT * FROM personeller WHERE personel_id = $1", [id]);
        if (currentRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ mesaj: 'Personel bulunamadı.' });
        }
        const current = currentRes.rows[0];

        // 2. Rol ID Bulma
        let rol_id = current.rol_id;
        if (rol) {
            const rolRes = await client.query("SELECT rol_id FROM roller WHERE LOWER(rol_adi) = LOWER($1)", [rol]);
            if (rolRes.rows.length > 0) rol_id = rolRes.rows[0].rol_id;
        }

        // 3. Şifre Güncelleme
        let yeniSifreHash = current.sifre_hash;
        if (sifre && sifre.trim() !== '') {
            yeniSifreHash = await bcrypt.hash(sifre, 10);
        }

        // 4. Fotoğraf Güncelleme
        let yeniFotoYolu = current.fotograf_yolu;
        if (req.file) {
            yeniFotoYolu = req.file.path;
        }

        // 5. Aktiflik Durumu
        let aktiflikDurumu = current.aktif; 
        if (ayrilma_tarihi && ayrilma_tarihi.length > 5) {
            aktiflikDurumu = false;
        }
        if (calisma_durumu && calisma_durumu !== 'Çalışıyor') {
            aktiflikDurumu = false;
        } else if (calisma_durumu === 'Çalışıyor') {
            aktiflikDurumu = true;
        }

        // 6. GÜNCELLEME SORGUSU (Tüm Alanlar - cleanDate KULLANILARAK)
        const updateQuery = `
            UPDATE personeller SET
                tc_no = $1, ad = $2, soyad = $3, telefon = $4, telefon2 = $5, adres = $6,
                dogum_tarihi = $7, cinsiyet = $8, medeni_hal = $9, kan_grubu = $10, egitim_durumu = $11,
                birim_id = $12, gorev = $13, kadro_tipi = $14, gorev_yeri = $15, calisma_durumu = $16,
                ehliyet_no = $17, ehliyet_sinifi = $18, ehliyet_tarih = $19, src_belge_no = $20, psiko_tarih = $21, surucu_no = $22,
                ayakkabi_no = $23, tisort_beden = $24, gomlek_beden = $25, suveter_beden = $26, mont_beden = $27,
                sicil_no = $28, asis_kart_no = $29, hareket_merkezi = $30, ise_giris_tarihi = $31, ayrilma_tarihi = $32,
                rol_id = $33, sifre_hash = $34, fotograf_yolu = $35, aktif = $36
            WHERE personel_id = $37
        `;

        const values = [
            tc_no, ad, soyad, telefon, telefon2, adres,
            cleanDate(dogum_tarihi), cinsiyet, medeni_hal, kan_grubu, egitim_durumu,
            birim_id ? parseInt(birim_id) : null, gorev, kadro_tipi, gorev_yeri, calisma_durumu,
            ehliyet_no, ehliyet_sinifi, cleanDate(ehliyet_tarih), src_belge_no, cleanDate(psiko_tarih), surucu_no,
            ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden,
            sicil_no, asis_kart_no, hareket_merkezi, cleanDate(ise_giris_tarihi), cleanDate(ayrilma_tarihi),
            rol_id, yeniSifreHash, yeniFotoYolu, aktiflikDurumu,
            id
        ];

        await client.query(updateQuery, values);
        await logKaydet(req.user ? req.user.id : 0, 'GUNCELLEME', `Personel (${id}) güncellendi.`, req);
        await client.query('COMMIT');
        
        res.json({ mesaj: 'Personel bilgileri başarıyla güncellendi.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("GÜNCELLEME HATASI:", err);
        res.status(500).json({ mesaj: 'Güncelleme sırasında hata oluştu: ' + err.message });
    } finally {
        client.release();
    }
};

// ============================================================
// 7. DİĞER İŞLEMLER (Dondur, Sil vb.)
// ============================================================
exports.personelDondur = async (req, res) => {
    try { await pool.query("UPDATE personeller SET aktif = FALSE, calisma_durumu = $1 WHERE personel_id = $2", [req.body.sebep, req.body.personel_id]); res.json({ mesaj: 'Pasif' }); } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};
exports.personelAktifEt = async (req, res) => {
    try { await pool.query("UPDATE personeller SET aktif = TRUE, calisma_durumu = 'Çalışıyor' WHERE personel_id = $1", [req.body.personel_id]); res.json({ mesaj: 'Aktif' }); } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};
exports.personelSil = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const pid = req.params.id; // Parametreden ID alınıyor
        await client.query('DELETE FROM izin_talepleri WHERE personel_id = $1', [pid]);
        await client.query('DELETE FROM izin_gecmis_bakiyeler WHERE personel_id = $1', [pid]);
        await client.query('DELETE FROM profil_degisiklikleri WHERE personel_id = $1', [pid]);
        await client.query('DELETE FROM imzalar WHERE personel_id = $1', [pid]);
        await client.query('DELETE FROM bildirimler WHERE personel_id = $1', [pid]);
        await client.query('DELETE FROM yetkiler WHERE personel_id = $1', [pid]);
        
        const result = await client.query('DELETE FROM personeller WHERE personel_id = $1', [pid]);
        if (result.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ mesaj: 'Personel bulunamadı.' }); }
        
        await client.query('COMMIT');
        res.json({ mesaj: 'Personel ve tüm verileri silindi.' });
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ mesaj: 'Silme işlemi başarısız.' }); } finally { client.release(); }
};
exports.birimGuncelle = async (req, res) => {
    try { await pool.query('UPDATE personeller SET birim_id = $1 WHERE personel_id = $2', [req.body.yeni_birim_id, req.body.personel_id]); res.json({ mesaj: 'Transfer' }); } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};

// ============================================================
// 8. KIYAFET TALEP SİSTEMİ
// ============================================================
exports.getKiyafetDonemiDurumu = async (req, res) => {
    try {
        const result = await pool.query("SELECT deger FROM sistem_ayarlari WHERE anahtar = 'kiyafet_donemi_aktif'");
        if (result.rows.length === 0) return res.json({ aktif: false });
        res.json({ aktif: result.rows[0].deger === 'true' });
    } catch (err) { res.json({ aktif: false }); }
};
exports.toggleKiyafetDonemi = async (req, res) => {
    if (req.user.rol !== 'admin' && req.user.rol !== 'filo') return res.status(403).json({ mesaj: 'Yetkisiz' });
    try { await pool.query("INSERT INTO sistem_ayarlari (anahtar, deger) VALUES ('kiyafet_donemi_aktif', $1) ON CONFLICT (anahtar) DO UPDATE SET deger = $1", [req.body.durum ? 'true' : 'false']); res.json({ mesaj: 'Güncellendi' }); } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};
exports.bedenGuncelle = async (req, res) => {
    const personel_id = req.user.id; 
    const { ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden } = req.body;
    const ayarRes = await pool.query("SELECT deger FROM sistem_ayarlari WHERE anahtar = 'kiyafet_donemi_aktif'");
    if (ayarRes.rows.length === 0 || ayarRes.rows[0].deger !== 'true') return res.status(400).json({ mesaj: 'Dönem KAPALI.' });
    try {
        await pool.query(`UPDATE personeller SET ayakkabi_no=$1, tisort_beden=$2, gomlek_beden=$3, suveter_beden=$4, mont_beden=$5 WHERE personel_id=$6`, [ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden, personel_id]);
        res.json({ mesaj: 'Kaydedildi.' });
    } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};

// ============================================================
// 9. PROFİL VE TALEP YÖNETİMİ
// ============================================================
exports.sifreDegistir = async (req, res) => {
    const { eski_sifre, yeni_sifre } = req.body;
    const pid = req.user.id; 
    try {
        const client = await pool.connect();
        const userRes = await client.query("SELECT sifre_hash FROM personeller WHERE personel_id = $1", [pid]);
        if (userRes.rows.length === 0) { client.release(); return res.status(404).json({ mesaj: 'Kullanıcı bulunamadı.' }); }
        const match = await bcrypt.compare(eski_sifre, userRes.rows[0].sifre_hash);
        if (!match) { client.release(); return res.status(400).json({ mesaj: 'Eski şifre hatalı.' }); }
        const newHash = await bcrypt.hash(yeni_sifre, 10);
        await client.query("UPDATE personeller SET sifre_hash = $1 WHERE personel_id = $2", [newHash, pid]);
        client.release();
        res.json({ mesaj: 'Şifre değiştirildi.' });
    } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};

exports.profilGuncelleTalep = async (req, res) => {
    try {
        const { email, telefon, adres, src_tarih, psiko_tarih, ehliyet_tarih } = req.body;
        const pid = req.user.id;
        const yeniVeri = {};
        if (email) yeniVeri.email = email;
        if (telefon) yeniVeri.telefon = telefon;
        if (adres) yeniVeri.adres = adres;
        if (src_tarih) yeniVeri.src_tarih = src_tarih;
        if (psiko_tarih) yeniVeri.psiko_tarih = psiko_tarih;
        if (ehliyet_tarih) yeniVeri.ehliyet_tarih = ehliyet_tarih;

        const dosyaYollari = {};
        if (req.files) {
            if (req.files.adres_belgesi) dosyaYollari.adres_belgesi_yol = req.files.adres_belgesi[0].path;
            if (req.files.src_belgesi) dosyaYollari.src_belgesi_yol = req.files.src_belgesi[0].path;
            if (req.files.psiko_belgesi) dosyaYollari.psiko_belgesi_yol = req.files.psiko_belgesi[0].path;
            if (req.files.ehliyet_belgesi) dosyaYollari.ehliyet_belgesi_yol = req.files.ehliyet_belgesi[0].path;
        }

        if (Object.keys(yeniVeri).length === 0 && Object.keys(dosyaYollari).length === 0) return res.status(400).json({ mesaj: 'Veri yok.' });

        await pool.query("INSERT INTO profil_degisiklikleri (personel_id, yeni_veri, dosya_yollari) VALUES ($1, $2, $3)", [pid, yeniVeri, dosyaYollari]);
        res.json({ mesaj: 'Talep iletildi.' });
    } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};

exports.bekleyenTalepler = async (req, res) => {
    try {
        if (!['admin', 'ik', 'filo'].includes(req.user.rol)) return res.status(403).json({ mesaj: 'Yetkisiz' });
        const result = await pool.query(`SELECT pd.*, p.ad, p.soyad, p.tc_no FROM profil_degisiklikleri pd JOIN personeller p ON pd.personel_id = p.personel_id WHERE pd.durum = 'BEKLIYOR' ORDER BY pd.talep_tarihi ASC`);
        res.json(result.rows);
    } catch (err) { res.status(500).send('Hata'); }
};

exports.talepIslem = async (req, res) => {
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
                src_tarih = COALESCE($4, src_tarih), 
                psiko_tarih = COALESCE($5, psiko_tarih), 
                ehliyet_tarih = COALESCE($6, ehliyet_tarih),
                adres_belgesi_yol = COALESCE($7, adres_belgesi_yol), src_belgesi_yol = COALESCE($8, src_belgesi_yol),
                psiko_belgesi_yol = COALESCE($9, psiko_belgesi_yol), ehliyet_belgesi_yol = COALESCE($10, ehliyet_belgesi_yol)
                WHERE personel_id = $11
            `, [
                veri.email || null, veri.telefon || null, veri.adres || null, 
                tarihFormatla(veri.src_tarih), tarihFormatla(veri.psiko_tarih), tarihFormatla(veri.ehliyet_tarih),
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
};

// ============================================================
// 10. BAKİYE SORGULAMA (Mobil ve Web İçin - GÜÇLENDİRİLMİŞ)
// ============================================================
exports.getPersonelBakiye = async (req, res) => {
    const pid = req.user.id;
    try {
        const client = await pool.connect();
        const pRes = await client.query('SELECT ise_giris_tarihi, dogum_tarihi, ayrilma_tarihi, aktif FROM personeller WHERE personel_id = $1', [pid]);
        if (pRes.rows.length === 0) { client.release(); return res.status(404).json({ mesaj: 'Personel yok' }); }
        const p = pRes.rows[0];
        
        const gecmisRes = await client.query('SELECT COALESCE(SUM(gun_sayisi), 0) as toplam FROM izin_gecmis_bakiyeler WHERE personel_id = $1', [pid]);
        const devreden = parseInt(gecmisRes.rows[0].toplam) || 0;

        const kumulatifHak = await hesaplaKumulatif(p.ise_giris_tarihi, p.dogum_tarihi, p.ayrilma_tarihi, p.aktif);
        const buYilHak = await hesaplaBuYil(pid);

        const izinRes = await client.query(`
            SELECT SUM(kac_gun) as toplam 
            FROM izin_talepleri 
            WHERE personel_id = $1 
            AND durum IN ('IK_ONAYLADI', 'TAMAMLANDI') 
            AND izin_turu = 'YILLIK İZİN'
        `, [pid]);

        const kullanilan = parseInt(izinRes.rows[0].toplam) || 0;
        const toplamHak = devreden + kumulatifHak; 
        const kalan = toplamHak - kullanilan;

        client.release();
        res.json({
            kalan_izin: kalan,
            detay: {
                devreden: devreden,
                bu_yil_hak: buYilHak,
                kumulatif_hak: kumulatifHak,
                kullanilan: kullanilan
            }
        });

    } catch (err) {
        console.error('Bakiye Hatası:', err);
        res.status(500).json({ mesaj: 'Hata oluştu' });
    }
};

// ============================================================
// 11. ŞİFRE SIFIRLAMA TALEBİ (Giriş Yapmadan)
// ============================================================
exports.sifreSifirlamaTalep = async (req, res) => {
    const { tc_no, yeni_sifre } = req.body;
    const kimlik_foto = req.file ? req.file.path : null;

    if (!tc_no || !yeni_sifre || !kimlik_foto) {
        return res.status(400).json({ mesaj: 'Eksik bilgi.' });
    }

    try {
        const client = await pool.connect();
        const pRes = await client.query("SELECT personel_id FROM personeller WHERE tc_no = $1", [tc_no.trim()]);
        
        if (pRes.rows.length === 0) {
            client.release();
            return res.status(404).json({ mesaj: 'Bu TC kimlik numarasına ait personel bulunamadı.' });
        }

        const personel_id = pRes.rows[0].personel_id;
        const sifre_hash = await bcrypt.hash(yeni_sifre, 10);

        await client.query(
            "INSERT INTO profil_degisiklikleri (personel_id, yeni_veri, dosya_yollari) VALUES ($1, $2, $3)",
            [personel_id, JSON.stringify({ tip: 'SIFRE_SIFIRLAMA', yeni_sifre_hash: sifre_hash }), JSON.stringify([kimlik_foto])]
        );

        client.release();
        res.json({ mesaj: 'Talebiniz alındı. Yönetici onayından sonra şifreniz güncellenecektir.' });

    } catch (err) {
        console.error("SUNUCU HATASI:", err);
        res.status(500).json({ mesaj: 'Sunucu hatası oluştu.' });
    }
};

exports.tumPersonelGetir = async (req, res) => {
    try {
        const query = `
            SELECT p.*, b.birim_adi, r.rol_adi 
            FROM personeller p 
            LEFT JOIN birimler b ON p.birim_id = b.birim_id 
            LEFT JOIN roller r ON p.rol_id = r.rol_id
            ORDER BY p.ad ASC`;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ mesaj: 'Veri çekilemedi.' }); }
};