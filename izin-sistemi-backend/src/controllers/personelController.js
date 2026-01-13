const pool = require('../config/db');
const { logKaydet, hareketKaydet } = require('../utils/logger');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ✅ YENİ: Dinamik Hakediş Hesaplama Modülünü Çağırıyoruz
const dinamikHakedisHesapla = require('../utils/hakedisHesapla');

const formatNull = (val) => (val === '' || val === undefined || val === 'null' ? null : val);

// ============================================================
// 🛠️ YARDIMCI: Tarih Formatla
// ============================================================
const tarihFormatla = (tarihStr) => {
    if (!tarihStr) return null;
    if (tarihStr.includes('-')) return tarihStr;
    if (tarihStr.includes('.')) {
        const [gun, ay, yil] = tarihStr.split('.');
        return `${yil}-${ay}-${gun}`;
    }
    return tarihStr;
};

// ❌ ESKİ MATRİS VE ESKİ HESAPLAMA FONKSİYONU SİLİNDİ.
// Artık veritabanından ve hakedisHesapla.js'den okuyor.

// ============================================================
// 🛠️ YARDIMCI: Net Bakiye Hesaplama (GÜNCELLENDİ)
// ============================================================
const hesaplaBakiye = async (personel_id) => {
    // 1. Personel var mı kontrolü
    const pRes = await pool.query("SELECT 1 FROM personeller WHERE personel_id = $1", [personel_id]);
    if (pRes.rows.length === 0) return 0;

    // 2. Geçmiş Yılların Toplamı (Tablodan)
    const gecmisRes = await pool.query("SELECT COALESCE(SUM(gun_sayisi), 0) as toplam FROM izin_gecmis_bakiyeler WHERE personel_id = $1", [personel_id]);
    const devreden = parseInt(gecmisRes.rows[0].toplam) || 0;

    // 3. Bu Yıl Hakediş (✅ ARTIK DİNAMİK - backend/utils/hakedisHesapla.js kullanıyor)
    const buYilHak = await dinamikHakedisHesapla(personel_id);

    // 4. Kullanılanlar (İK Onaylı ve Tamamlananlar)
    const izinRes = await pool.query(`
        SELECT SUM(kac_gun) as toplam 
        FROM izin_talepleri 
        WHERE personel_id = $1 
        AND durum IN ('IK_ONAYLADI', 'TAMAMLANDI') 
        AND izin_turu = 'YILLIK İZİN'
    `, [personel_id]);
    const kullanilan = parseInt(izinRes.rows[0].toplam) || 0;

    return (devreden + buYilHak) - kullanilan;
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
// 5. PDF OLUŞTURMA
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
        const sizes = [{ l: 'Ayakkabı', v: p.ayakkabi_no }, { l: 'Tişört', v: p.tisort_beden }, { l: 'Gömlek', v: p.gomlek_beden }, { l: 'Mont', v: p.mont_beden }, { l: 'Süveter', v: p.suveter_beden }];
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
// 6. PERSONEL EKLEME VE GÜNCELLEME
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
            egitim_durumu, formatNull(dogum_tarihi), medeni_hal, cinsiyet, calisma_durumu || 'Çalışıyor',
            ehliyet_no, src_belge_no, formatNull(psiko_tarih), surucu_no, gorev_yeri,
            ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden,
            fotograf_yolu,
            formatNull(telefon2), ehliyet_sinifi, formatNull(ehliyet_tarih), sicil_no, asis_kart_no, hareket_merkezi, formatNull(ise_giris_tarihi)
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
            ehliyet_tarih=COALESCE($21, ehliyet_tarih),
            src_belge_no=$22, 
            psiko_tarih=COALESCE($23, psiko_tarih),
            sicil_no=$24, 
            asis_kart_no=$25, 
            hareket_merkezi=$26, 
            ise_giris_tarihi=COALESCE($27, ise_giris_tarihi),
            calisma_durumu=$28,
            ayrilma_tarihi=$29,
            aktif=COALESCE($30, aktif),
            egitim_durumu=COALESCE($31, egitim_durumu),
            surucu_no=$32
        `;
        
        const values = [
            body.ad, body.soyad, body.telefon, body.adres, body.gorev, body.kadro_tipi, body.gorev_yeri,
            body.ayakkabi_no, body.tisort_beden, body.gomlek_beden, body.suveter_beden, body.mont_beden,
            body.tc_no, formatNull(body.dogum_tarihi), body.cinsiyet, body.medeni_hal, body.kan_grubu,
            body.telefon2, body.ehliyet_no, body.ehliyet_sinifi, formatNull(body.ehliyet_tarih),
            body.src_belge_no, formatNull(body.psiko_tarih),
            body.sicil_no, body.asis_kart_no, body.hareket_merkezi, formatNull(body.ise_giris_tarihi),
            body.calisma_durumu,
            formatNull(body.ayrilma_tarihi),
            aktiflikDurumu,
            body.egitim_durumu,
            body.surucu_no
        ];

        let pIdx = 33; 
        if (body.birim_id) { query += `, birim_id=$${pIdx++}`; values.push(body.birim_id); }
        if (rolId) { query += `, rol_id=$${pIdx++}`; values.push(rolId); }
        if (fotograf_yolu) { query += `, fotograf_yolu=$${pIdx++}`; values.push(fotograf_yolu); }
        
        // Şifre güncelleme isteği varsa
        if (body.sifre && body.sifre.length >= 6) {
            const hash = await bcrypt.hash(body.sifre, 10);
            query += `, sifre_hash=$${pIdx++}`;
            values.push(hash);
        }

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
        const pid = req.params.personel_id;
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
        const result = await pool.query("SELECT deger_bool FROM sistem_ayarlari WHERE ayar_adi = 'kiyafet_talep_donemi'");
        const aktif = result.rows.length > 0 ? result.rows[0].deger_bool : false;
        res.json({ aktif });
    } catch (err) { res.json({ aktif: false }); }
};
exports.toggleKiyafetDonemi = async (req, res) => {
    if (req.user.rol !== 'admin' && req.user.rol !== 'filo') return res.status(403).json({ mesaj: 'Yetkisiz' });
    try { await pool.query("UPDATE sistem_ayarlari SET deger_bool = $1 WHERE ayar_adi = 'kiyafet_talep_donemi'", [req.body.durum]); res.json({ mesaj: 'Güncellendi' }); } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};
exports.bedenGuncelle = async (req, res) => {
    const personel_id = req.user.id; 
    const { ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden } = req.body;
    const ayarRes = await pool.query("SELECT deger_bool FROM sistem_ayarlari WHERE ayar_adi = 'kiyafet_talep_donemi'");
    if (ayarRes.rows.length === 0 || !ayarRes.rows[0].deger_bool) return res.status(400).json({ mesaj: 'Dönem KAPALI.' });
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
        
        // 1. Personel Giriş Tarihini Çek
        const pRes = await client.query('SELECT ise_giris_tarihi FROM personeller WHERE personel_id = $1', [pid]);
        if (pRes.rows.length === 0) { client.release(); return res.status(404).json({ mesaj: 'Personel yok' }); }
        
        // 2. GEÇMİŞ YILLARIN TOPLAMINI DETAYLI TABLODAN ÇEK
        const gecmisRes = await client.query('SELECT COALESCE(SUM(gun_sayisi), 0) as toplam FROM izin_gecmis_bakiyeler WHERE personel_id = $1', [pid]);
        const devreden = parseInt(gecmisRes.rows[0].toplam) || 0;

        // 3. Bu yılki hakedişi hesapla (✅ ARTIK DİNAMİK)
        const buYilHak = await dinamikHakedisHesapla(pid);

        // 4. Kullanılan YILLIK İzinleri Topla (Sadece İK Onaylılar ve Tamamlananlar)
        const izinRes = await client.query(`
            SELECT SUM(kac_gun) as toplam 
            FROM izin_talepleri 
            WHERE personel_id = $1 
            AND durum IN ('IK_ONAYLADI', 'TAMAMLANDI') 
            AND izin_turu = 'YILLIK İZİN'
        `, [pid]);

        const kullanilan = parseInt(izinRes.rows[0].toplam) || 0;
        
        // 5. NET HESAPLAMA
        const toplamHak = devreden + buYilHak;
        const kalan = toplamHak - kullanilan;

        client.release();
        
        res.json({
            kalan_izin: kalan,
            detay: {
                devreden: devreden,
                bu_yil_hak: buYilHak,
                kullanilan: kullanilan
            }
        });

    } catch (err) {
        console.error('Bakiye Hatası:', err);
        res.status(500).json({ mesaj: 'Hata oluştu' });
    }
};

// ============================================================
// 11. ŞİFRE SIFIRLAMA TALEBİ (Giriş Yapmadan - LOGLU VERSİYON)
// ============================================================
exports.sifreSifirlamaTalep = async (req, res) => {
    // ... (Mevcut kod aynen korunabilir)
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
            [personel_id, { sifre_hash: sifre_hash }, { kimlik_belgesi_yol: kimlik_foto }]
        );

        client.release();
        res.json({ mesaj: 'Talebiniz alındı. Yönetici onayından sonra şifreniz güncellenecektir.' });

    } catch (err) {
        console.error("SUNUCU HATASI:", err);
        res.status(500).json({ mesaj: 'Sunucu hatası oluştu.' });
    }
};