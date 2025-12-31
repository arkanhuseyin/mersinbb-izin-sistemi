const pool = require('../config/db');
const { logKaydet } = require('../utils/logger');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const formatNull = (val) => (val === '' || val === undefined || val === 'null' ? null : val);

// ============================================================
// 🛠️ YARDIMCI: İzin Hakediş Hesapla (PDF İÇİN - MATRİS TABANLI)
// ============================================================

// A. HAKEDİŞ MATRİSİ (Tablo Verileri)
const HAKEDIS_MATRISI = {
    // --- GRUP 1: 2007 - 2015 ARASI VE ÖNCESİ (Tablo 1) ---
    "2007": { 2020: 25, 2021: 25, 2022: 30, 2023: 30, 2024: 32, 2025: 32 },
    "2008": { 2020: 25, 2021: 25, 2022: 25, 2023: 30, 2024: 32, 2025: 32 },
    "2009": { 2020: 25, 2021: 25, 2022: 25, 2023: 25, 2024: 32, 2025: 32 },
    "2010": { 2020: 25, 2021: 25, 2022: 25, 2023: 25, 2024: 27, 2025: 32 },
    "2011": { 2020: 25, 2021: 25, 2022: 25, 2023: 25, 2024: 27, 2025: 27 },
    "2012": { 2020: 25, 2021: 25, 2022: 25, 2023: 25, 2024: 27, 2025: 27 },
    "2013": { 2020: 25, 2021: 25, 2022: 25, 2023: 25, 2024: 27, 2025: 27 },
    "2014": { 2020: 25, 2021: 25, 2022: 25, 2023: 25, 2024: 27, 2025: 27 },
    "2015": { 2020: 25, 2021: 25, 2022: 25, 2023: 25, 2024: 27, 2025: 27 },

    // --- GRUP 2: 2016 VE SONRASI (Tablo 2) ---
    "2016": { 2020: 16, 2021: 16, 2022: 16, 2023: 16, 2024: 18, 2025: 18 },
    "2017": { 2020: 16, 2021: 16, 2022: 16, 2023: 16, 2024: 18, 2025: 18 },
    "2018": { 2020: 16, 2021: 16, 2022: 16, 2023: 16, 2024: 18, 2025: 18 },
    "2019": { 2020: 18, 2021: 18, 2022: 18, 2023: 18, 2024: 20, 2025: 20 },
    "2020": { 2020: 18, 2021: 18, 2022: 18, 2023: 18, 2024: 20, 2025: 20 },
    "2021": { 2021: 25, 2022: 25, 2023: 25, 2024: 27, 2025: 27 },
    "2022": { 2022: 25, 2023: 25, 2024: 27, 2025: 27 },
    "2023": { 2023: 25, 2024: 27, 2025: 27 },
    "2024": { 2024: 27, 2025: 27 },
    "2025": { 2025: 27 }
};

// B. İzin Hakediş Hesapla (Güncellenmiş Fonksiyon)
const izinHakedisHesapla = (iseGirisTarihi) => {
    if (!iseGirisTarihi) return { yil: 0, hak: 0 };

    const giris = new Date(iseGirisTarihi);
    const girisYili = giris.getFullYear(); 
    const buYil = new Date().getFullYear();

    // Kıdem Yılı Hesabı (Bilgi amaçlı)
    const fark = new Date() - giris;
    const kidemYili = Math.floor(fark / (1000 * 60 * 60 * 24 * 365.25));

    // Kural: Giriş yılı 2007'den küçükse 2007 satırını kullan
    let arananGirisYili = girisYili;
    if (girisYili < 2007) arananGirisYili = 2007;

    let hak = 0;

    // A. Özel Tabloda Veri Var mı?
    if (HAKEDIS_MATRISI[arananGirisYili] && HAKEDIS_MATRISI[arananGirisYili][buYil]) {
        hak = HAKEDIS_MATRISI[arananGirisYili][buYil];
    } else {
        // B. Standart Hesaplama (Yedek Plan - Tabloda yoksa)
        if (kidemYili < 1) hak = 0;
        else if (kidemYili <= 5) hak = 14;
        else if (kidemYili < 15) hak = 20;
        else hak = 26;
    }

    return { yil: kidemYili, hak: hak };
};

// ============================================================
// 1. PERSONEL LİSTESİ
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
// 2. PERSONEL EKLE
// ============================================================
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

// ============================================================
// 3. PERSONEL GÜNCELLE
// ============================================================
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

// ============================================================
// 4. PDF OLUŞTURMA
// ============================================================
exports.personelKartiPdf = async (req, res) => {
    const { id } = req.params;
    try {
        const client = await pool.connect();
        
        // 1. Personel Detaylı Bilgisi
        const pRes = await client.query(`
            SELECT p.*, b.birim_adi, r.rol_adi 
            FROM personeller p 
            LEFT JOIN birimler b ON p.birim_id = b.birim_id 
            LEFT JOIN roller r ON p.rol_id = r.rol_id
            WHERE p.personel_id = $1
        `, [id]);
        
        // 2. İzin Geçmişi (Son 10 Hareket)
        const izinRes = await client.query(`
            SELECT * FROM izin_talepleri 
            WHERE personel_id = $1 AND durum = 'IK_ONAYLADI' 
            ORDER BY baslangic_tarihi DESC LIMIT 15
        `, [id]);
        
        client.release();

        if (pRes.rows.length === 0) return res.status(404).send('Personel bulunamadı');
        const p = pRes.rows[0];

        // İzin Hesaplama (GÜNCELLENMİŞ FONKSİYON KULLANILIYOR)
        const hakedis = izinHakedisHesapla(p.ise_giris_tarihi);
        
        // PDF Oluşturma Başlangıcı
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        
        // Font Ayarları
        const fontPath = path.join(__dirname, '../../templates/font.ttf'); 
        const headerPath = path.join(__dirname, '../../templates/pdf1.png');

        if (fs.existsSync(fontPath)) {
            doc.registerFont('TrFont', fontPath);
            doc.font('TrFont');
        } else {
            doc.font('Helvetica'); // Yedek
        }

        const safeFilename = `${p.ad.replace(/[^a-zA-Z0-9]/g, '')}_PersonelKarti.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        doc.pipe(res);

        // --- 1. BAŞLIK VE LOGO ---
        if (fs.existsSync(headerPath)) {
            doc.image(headerPath, 0, 0, { width: 595.28, height: 100 });
        } else {
            doc.fontSize(18).text('MERSİN BÜYÜKŞEHİR BELEDİYESİ', 0, 40, { align: 'center' });
            doc.fontSize(12).text('ULAŞIM DAİRESİ BAŞKANLIĞI', { align: 'center' });
        }

        let y = 130; 

        // Başlık
        doc.fontSize(16).fillColor('#000000').text('PERSONEL KİMLİK BİLGİ FORMU', 0, y, { align: 'center' });
        doc.rect(30, y + 20, 535, 2).fill('#cc0000'); 
        y += 40;

        // --- 2. FOTOĞRAF ALANI ---
        const photoX = 430;
        const photoY = y;
        const photoW = 110;
        const photoH = 130;

        doc.rect(photoX, photoY, photoW, photoH).strokeColor('#333').lineWidth(1).stroke();

        if (p.fotograf_yolu && fs.existsSync(p.fotograf_yolu)) {
            try {
                doc.image(p.fotograf_yolu, photoX + 1, photoY + 1, { width: photoW - 2, height: photoH - 2, fit: [photoW-2, photoH-2] });
            } catch (e) {
                console.error("Fotoğraf yüklenemedi", e);
            }
        } else {
            doc.fontSize(10).fillColor('#999').text('FOTOĞRAF', photoX, photoY + 60, { width: photoW, align: 'center' });
        }

        // --- 3. BİLGİ TABLOLARI ---
        const labelX = 30;
        const valueX = 160;
        const rowH = 20;
        
        const drawRow = (label, value) => {
            if (((y - 170) / 20) % 2 === 1) {
                doc.rect(labelX, y - 2, 380, rowH).fillColor('#f9f9f9').fill();
            }
            doc.fillColor('#333333').fontSize(9).font(fs.existsSync(fontPath) ? 'TrFont' : 'Helvetica-Bold').text(label, labelX + 5, y + 4);
            const valStr = (value === null || value === undefined || value === '') ? '-' : String(value);
            doc.fillColor('#000000').fontSize(9).font(fs.existsSync(fontPath) ? 'TrFont' : 'Helvetica').text(valStr, valueX, y + 4);
            y += rowH;
        };

        // BÖLÜM 1: KİMLİK VE İLETİŞİM
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

        // BÖLÜM 2: KURUMSAL BİLGİLER
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

        // BÖLÜM 3: EHLİYET VE BELGELER
        const fullWidth = 535;
        doc.fillColor('#cc0000').fontSize(11).text('EHLİYET VE BELGELER', labelX, y - 5);
        y += 10;

        const col2X = 300;
        
        // Satır 1
        doc.rect(labelX, y - 2, fullWidth, rowH).fillColor('#f0f0f0').fill();
        doc.fillColor('#333').text('Ehliyet No:', labelX + 5, y + 4);
        doc.fillColor('#000').text(p.ehliyet_no || '-', valueX, y + 4);
        doc.fillColor('#333').text('Sınıfı:', col2X, y + 4);
        doc.fillColor('#000').text(p.ehliyet_sinifi || '-', col2X + 50, y + 4);
        y += rowH;

        // Satır 2
        doc.rect(labelX, y - 2, fullWidth, rowH).fillColor('#fff').fill();
        doc.fillColor('#333').text('SRC Belge No:', labelX + 5, y + 4);
        doc.fillColor('#000').text(p.src_belge_no || '-', valueX, y + 4);
        doc.fillColor('#333').text('Psikoteknik:', col2X, y + 4);
        doc.fillColor('#000').text(p.psikoteknik_tarihi ? new Date(p.psikoteknik_tarihi).toLocaleDateString('tr-TR') : '-', col2X + 50, y + 4);
        y += rowH;

        y += 10;

        // BÖLÜM 4: BEDEN BİLGİLERİ (KIYAFET)
        doc.fillColor('#cc0000').fontSize(11).text('LOJİSTİK - BEDEN ÖLÇÜLERİ', labelX, y - 5);
        y += 10;

        const sizes = [
            { l: 'Ayakkabı', v: p.ayakkabi_no },
            { l: 'Tişört', v: p.tisort_beden },
            { l: 'Gömlek', v: p.gomlek_beden },
            { l: 'Mont', v: p.mont_beden },
            { l: 'Süveter', v: p.suveter_beden },
        ];

        let xOffset = labelX;
        sizes.forEach(s => {
            doc.rect(xOffset, y, 90, 35).fillColor('#eef2f3').strokeColor('#ccc').fillAndStroke();
            doc.fillColor('#666').fontSize(8).text(s.l, xOffset, y + 5, { width: 90, align: 'center' });
            doc.fillColor('#000').fontSize(12).text(s.v || '-', xOffset, y + 18, { width: 90, align: 'center' });
            xOffset += 100;
        });
        
        y += 50;

        // --- SAYFA 2: İZİN GEÇMİŞİ TABLOSU ---
        if (y > 650) {
            doc.addPage();
            y = 50;
        } else {
            y += 20;
        }

        doc.fillColor('#000').fontSize(14).text('SON ONAYLANAN İZİN HAREKETLERİ', labelX, y);
        doc.rect(labelX, y + 20, fullWidth, 2).fill('#333');
        y += 30;

        // Tablo Başlığı
        doc.rect(labelX, y, fullWidth, 20).fillColor('#333').fill();
        doc.fillColor('#fff').fontSize(9);
        doc.text('İzin Türü', labelX + 10, y + 5);
        doc.text('Başlangıç', labelX + 150, y + 5);
        doc.text('Bitiş', labelX + 250, y + 5);
        doc.text('Gün', labelX + 350, y + 5);
        doc.text('Durum', labelX + 420, y + 5);
        y += 20;

        // Tablo Verileri
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
        } else {
            doc.rect(labelX, y, fullWidth, 20).fillColor('#fff').fill();
            doc.fillColor('#999').text('Kayıtlı izin geçmişi bulunmamaktadır.', labelX + 10, y + 5);
        }

        // Footer
        const pageHeight = 841.89;
        doc.fontSize(8).fillColor('#888').text('Mersin Büyükşehir Belediyesi - Bilgi İşlem Dairesi Başkanlığı © 2025', 30, pageHeight - 30, { align: 'center', width: 535 });

        doc.end();

    } catch (err) {
        console.error('PDF Hatası:', err);
        res.status(500).send('PDF Oluşturulamadı');
    }
};

// ============================================================
// 5. DİĞER İŞLEMLER
// ============================================================
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

// ============================================================
// 6. KIYAFET TALEP SİSTEMİ (YENİ)
// ============================================================

// 1. Dönem Açık mı? (Mobil soracak)
exports.getKiyafetDonemiDurumu = async (req, res) => {
    try {
        const result = await pool.query("SELECT deger_bool FROM sistem_ayarlari WHERE ayar_adi = 'kiyafet_talep_donemi'");
        const aktif = result.rows.length > 0 ? result.rows[0].deger_bool : false;
        res.json({ aktif });
    } catch (err) { res.json({ aktif: false }); }
};

// 2. Dönemi Aç/Kapa (Sadece Admin)
exports.toggleKiyafetDonemi = async (req, res) => {
    if (req.user.rol !== 'admin' && req.user.rol !== 'filo') return res.status(403).json({ mesaj: 'Yetkisiz' });
    const { durum } = req.body; 
    try {
        await pool.query("UPDATE sistem_ayarlari SET deger_bool = $1 WHERE ayar_adi = 'kiyafet_talep_donemi'", [durum]);
        res.json({ mesaj: `Dönem ${durum ? 'AÇILDI' : 'KAPATILDI'}.` });
    } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};

// 3. Beden Kaydet (Personel)
exports.bedenGuncelle = async (req, res) => {
    // 🔴 ESKİ HATALI SATIR: const { personel_id } = req.user;
    // 🟢 YENİ DOĞRU SATIR:
    const personel_id = req.user.id; 
    
    const { ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden } = req.body;

    // Önce Kontrol: Dönem açık mı?
    const ayarRes = await pool.query("SELECT deger_bool FROM sistem_ayarlari WHERE ayar_adi = 'kiyafet_talep_donemi'");
    if (ayarRes.rows.length === 0 || !ayarRes.rows[0].deger_bool) {
        return res.status(400).json({ mesaj: 'Şu an güncelleme dönemi KAPALIDIR.' });
    }

    try {
        const result = await pool.query(
            `UPDATE personeller SET 
             ayakkabi_no=$1, tisort_beden=$2, gomlek_beden=$3, suveter_beden=$4, mont_beden=$5 
             WHERE personel_id=$6`,
            [ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden, personel_id]
        );

        // Ekstra Güvenlik: Eğer kimse güncellenmediyse hata verelim
        if (result.rowCount === 0) {
            return res.status(404).json({ mesaj: 'Kullanıcı bulunamadı, işlem başarısız.' });
        }

        res.json({ mesaj: 'Beden bilgileriniz başarıyla kaydedildi.' });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ mesaj: 'Hata oluştu.' }); 
    }
};