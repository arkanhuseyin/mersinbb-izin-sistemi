const pool = require('../config/db');
const { logKaydet } = require('../utils/logger');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// YARDIMCI: Boş alanları NULL yap (Veritabanı hatasını önler)
const formatNull = (val) => (val === '' || val === undefined || val === 'null' ? null : val);

// YARDIMCI: Yıllık İzin Hakediş Hesaplama Motoru
const izinHakedisHesapla = (iseGirisTarihi) => {
    if (!iseGirisTarihi) return { yil: 0, hak: 0 };
    
    const giris = new Date(iseGirisTarihi);
    const bugun = new Date();
    // Farkı milisaniye cinsinden alıp yıla çevir
    const fark = bugun - giris;
    const kidemYili = Math.floor(fark / (1000 * 60 * 60 * 24 * 365.25));

    // 1 yıldan az ise hak yok
    if (kidemYili < 1) return { yil: kidemYili, hak: 0 };

    let toplamHak = 0;
    // Her yıl için hak edişi topla
    for (let i = 1; i <= kidemYili; i++) {
        if (i <= 5) toplamHak += 14;       // 1-5 yıl arası: 14 gün
        else if (i < 15) toplamHak += 20;  // 5-15 yıl arası: 20 gün
        else toplamHak += 26;              // 15 yıl ve üzeri: 26 gün
    }
    return { yil: kidemYili, hak: toplamHak };
};

// ============================================================
// 1. LİSTELEME VE DETAY İŞLEMLERİ
// ============================================================

// TÜM PERSONEL LİSTESİ (DETAYLI)
exports.personelListesi = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, b.birim_adi 
            FROM personeller p 
            LEFT JOIN birimler b ON p.birim_id = b.birim_id 
            ORDER BY p.ad ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ mesaj: 'Personel listesi alınamadı.' });
    }
};

// PERSONELİN İZİN GEÇMİŞİNİ GETİR (CANLI VERİ İÇİN)
exports.personelIzinGecmisi = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT * FROM izin_talepleri 
            WHERE personel_id = $1 
            ORDER BY baslangic_tarihi DESC
        `, [id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ mesaj: 'İzin geçmişi alınamadı.' });
    }
};

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
// 2. YENİ PERSONEL EKLE (TÜM ALANLAR DAHİL)
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
        
        const islemYapanId = req.user ? req.user.id : result.rows[0].personel_id;
        await logKaydet(islemYapanId, 'PERSONEL_EKLEME', `${ad} ${soyad} (TC: ${tc_no}) eklendi.`, req);

        await client.query('COMMIT');
        res.json({ mesaj: 'Personel başarıyla oluşturuldu.', personel: result.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Personel Ekleme Hatası:', err);
        if (err.code === '23505') return res.status(400).json({ mesaj: 'Bu TC/Sicil ile kayıt zaten var.' });
        res.status(500).json({ mesaj: 'Veritabanı hatası.', detay: err.message });
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

        // Rol isminden ID bulma (Otomatik rol ataması Frontend'den 'rol' stringi olarak gelir)
        let rolId = null;
        if(body.rol) {
            const rolRes = await client.query("SELECT rol_id FROM roller WHERE LOWER(rol_adi) = LOWER($1)", [body.rol]);
            if(rolRes.rows.length > 0) rolId = rolRes.rows[0].rol_id;
        }

        // Aktiflik Durumu: Ayrılma tarihi varsa PASİF yap
        let aktiflikDurumu = body.aktif; 
        if (body.ayrilma_tarihi && body.ayrilma_tarihi.length > 5) {
            aktiflikDurumu = false;
        }

        let query = `
            UPDATE personellers SET 
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
        
        const yapanId = req.user ? req.user.id : 0; // Hata önleyici
        await logKaydet(yapanId, 'GUNCELLEME', `Personel (${id}) güncellendi.`, req);

        await client.query('COMMIT');
        res.json({ mesaj: 'Personel başarıyla güncellendi.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ mesaj: 'Güncelleme hatası', detay: err.message });
    } finally {
        client.release();
    }
};

// ============================================================
// 4. KURUMSAL PDF (2 SAYFA + TR FONT + FOTOĞRAF)
// ============================================================
exports.personelKartiPdf = async (req, res) => {
    const { id } = req.params;
    try {
        const client = await pool.connect();
        
        // 1. Personel Bilgisini Çek
        const pRes = await client.query(`SELECT p.*, b.birim_adi FROM personeller p LEFT JOIN birimler b ON p.birim_id = b.birim_id WHERE p.personel_id = $1`, [id]);
        
        // 2. Onaylanmış İzinleri Çek
        const izinRes = await client.query(`SELECT * FROM izin_talepleri WHERE personel_id = $1 AND durum = 'ONAYLANDI' ORDER BY baslangic_tarihi DESC`, [id]);
        
        client.release();

        if (pRes.rows.length === 0) return res.status(404).send('Personel bulunamadı');
        const p = pRes.rows[0];

        // İzin Hesaplama
        const hakedis = izinHakedisHesapla(p.ise_giris_tarihi);
        let kullanilan = 0;
        izinRes.rows.forEach(i => { if(i.izin_turu === 'Yıllık İzin') kullanilan += i.gun_sayisi; });
        const kalan = hakedis.hak - kullanilan;

        const doc = new PDFDocument({ margin: 0, size: 'A4' });
        
        // --- ÖZEL FONT AYARLARI (TR KARAKTER İÇİN ZORUNLU) ---
        const fontPath = path.join(__dirname, '../../templates/font.ttf'); // Senin klasör yapına göre
        let currentFont = 'Helvetica'; // Yedek font

        if (fs.existsSync(fontPath)) {
            doc.registerFont('TrFont', fontPath);
            currentFont = 'TrFont'; 
        } else {
            console.error("KRİTİK UYARI: Font dosyası bulunamadı! Türkçe karakterler bozuk çıkabilir.");
        }

        const safeFilename = `${p.ad.replace(/[^a-zA-Z0-9]/g, '')}_Dosya.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        doc.pipe(res);

        // Header Çizme Yardımcısı
        const addHeader = () => {
            const headerPath = path.join(__dirname, '../../templates/pdf1.png');
            if (fs.existsSync(headerPath)) {
                doc.image(headerPath, 0, 0, { width: 595.28, height: 100, fit: [595.28, 150] });
            }
        };

        // ************** SAYFA 1: PERSONEL BİLGİLERİ **************
        addHeader();
        let yPos = 160; 

        // Başlık
        doc.fillColor('#000000').font(currentFont).fontSize(16).text('PERSONEL KİMLİK BİLGİ FORMU', 0, yPos, { align: 'center', width: 595.28 });
        doc.moveTo(40, yPos + 25).lineTo(555, yPos + 25).strokeColor('#cccccc').lineWidth(2).stroke();
        yPos += 40; 

        // Fotoğraf (Sağ Taraf)
        if (p.fotograf_yolu && fs.existsSync(p.fotograf_yolu)) {
            try {
                doc.rect(430, yPos, 110, 130).strokeColor('#333').lineWidth(1).stroke();
                doc.image(p.fotograf_yolu, 431, yPos + 1, { width: 108, height: 128, fit: [108, 128] });
            } catch (e) { }
        } else {
            doc.rect(430, yPos, 110, 130).fillColor('#f0f0f0').fill().strokeColor('#333').stroke();
            doc.fillColor('#999').fontSize(10).text('FOTOĞRAF', 430, yPos + 60, { width: 110, align: 'center' });
        }

        // Tablo Satır Çizme Fonksiyonu
        const leftX = 50;
        const valueX = 180;
        let currentY = yPos;

        const row = (label, value) => {
            const valStr = (value === null || value === undefined || value === '') ? '-' : String(value);
            
            // Satır Arka Planı
            doc.rect(leftX, currentY - 5, 360, 22).fillColor(currentY % 44 === 0 ? '#f5f5f5' : '#ffffff').fill();
            
            // Etiket
            doc.fillColor('#333333').font(currentFont).fontSize(10).text(label + ':', leftX + 10, currentY);
            
            // Değer
            doc.fillColor('#000000').font(currentFont).fontSize(10).text(valStr, valueX, currentY);
            currentY += 24;
        };

        // 1. Bölüm: Kimlik
        doc.fillColor('#d32f2f').font(currentFont).fontSize(12).text('KİMLİK VE İLETİŞİM', leftX, currentY - 30);
        row('TC Kimlik No', p.tc_no);
        row('Adı Soyadı', `${p.ad} ${p.soyad}`);
        row('Sicil No', p.sicil_no);
        row('Telefon', p.telefon);
        row('Doğum Tarihi', p.dogum_tarihi ? new Date(p.dogum_tarihi).toLocaleDateString('tr-TR') : '-');
        row('Kan Grubu', p.kan_grubu);
        
        doc.fillColor('#333333').font(currentFont).text('Adres:', leftX + 10, currentY);
        doc.fillColor('#000000').font(currentFont).text(p.adres || '-', valueX, currentY, { width: 230 });
        currentY += 45; 

        // 2. Bölüm: Kurumsal
        currentY += 10;
        doc.fillColor('#d32f2f').font(currentFont).fontSize(12).text('KURUMSAL BİLGİLER', leftX, currentY - 5);
        currentY += 15;
        row('Birim', p.birim_adi);
        row('Hareket Merkezi', p.hareket_merkezi);
        row('Görevi', p.gorev);
        row('Kadro Tipi', p.kadro_tipi);
        row('İşe Giriş Tarihi', p.ise_giris_tarihi ? new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR') : '-');
        row('ASİS Kart No', p.asis_kart_no);

        // 3. Bölüm: Lojistik ve Beden
        currentY += 10;
        doc.fillColor('#d32f2f').font(currentFont).fontSize(12).text('LOJİSTİK VE BEDEN', leftX, currentY - 5);
        currentY += 15;
        row('Ehliyet No', p.ehliyet_no);
        row('Ehliyet Sınıfı', p.ehliyet_sinifi);
        row('SRC Belge No', p.src_belge_no);
        row('Ayakkabı No', p.ayakkabi_no);
        row('Mont / Gömlek', `${p.mont_beden || '-'} / ${p.gomlek_beden || '-'}`);
        row('Tişört / Süveter', `${p.tisort_beden || '-'} / ${p.suveter_beden || '-'}`);

        // Footer Sayfa 1
        doc.fontSize(8).fillColor('#888888').text('Sayfa 1 / 2', 50, 780, { align: 'right', width: 500 });


        // ************** SAYFA 2: İZİN YÖNETİMİ **************
        doc.addPage();
        addHeader(); // Header tekrar basılır
        yPos = 160;

        doc.fillColor('#000000').font(currentFont).fontSize(16).text('İZİN HAREKETLERİ VE HAKEDİŞ DURUMU', 0, yPos, { align: 'center', width: 595.28 });
        doc.moveTo(40, yPos + 25).lineTo(555, yPos + 25).strokeColor('#cccccc').lineWidth(2).stroke();
        yPos += 50;

        // ÖZET KUTUCUKLARI (RENKLİ)
        const boxW = 150;
        const boxH = 60;
        const startX = 50;
        
        const drawBox = (x, title, value, color) => {
            doc.rect(x, yPos, boxW, boxH).fillColor(color).fill();
            doc.fillColor('#ffffff').font(currentFont).fontSize(12).text(title, x, yPos + 10, { width: boxW, align: 'center' });
            doc.fillColor('#ffffff').font(currentFont).fontSize(20).text(value, x, yPos + 30, { width: boxW, align: 'center' });
        };

        drawBox(startX, 'Toplam Hakediş', `${hakedis.hak} Gün`, '#28a745'); // Yeşil
        drawBox(startX + 170, 'Kullanılan İzin', `${kullanilan} Gün`, '#dc3545'); // Kırmızı
        drawBox(startX + 340, 'Kalan İzin', `${kalan} Gün`, '#007bff'); // Mavi

        yPos += 100;

        // İZİN TABLOSU
        doc.fillColor('#333333').font(currentFont).fontSize(14).text('Geçmiş Onaylı İzin Hareketleri', 50, yPos);
        yPos += 25;
        
        // Tablo Başlığı
        doc.rect(50, yPos, 500, 25).fillColor('#333333').fill();
        doc.fillColor('#ffffff').fontSize(10);
        doc.text('İzin Türü', 60, yPos + 8);
        doc.text('Başlangıç Tarihi', 200, yPos + 8);
        doc.text('Bitiş Tarihi', 320, yPos + 8);
        doc.text('Gün Sayısı', 450, yPos + 8);
        
        yPos += 25;

        // Tablo Satırları
        izinRes.rows.forEach((izin, index) => {
            if (yPos > 750) { doc.addPage(); addHeader(); yPos = 160; } // Sayfa taşarsa yeni sayfa aç
            
            doc.rect(50, yPos, 500, 20).fillColor(index % 2 === 0 ? '#ffffff' : '#f2f2f2').fill();
            doc.fillColor('#000000');
            
            doc.text(izin.izin_turu, 60, yPos + 5);
            doc.text(new Date(izin.baslangic_tarihi).toLocaleDateString('tr-TR'), 200, yPos + 5);
            doc.text(new Date(izin.bitis_tarihi).toLocaleDateString('tr-TR'), 320, yPos + 5);
            doc.text(`${izin.gun_sayisi}`, 450, yPos + 5);
            
            yPos += 20;
        });

        if (izinRes.rows.length === 0) {
            doc.fillColor('#999').text('Kayıtlı izin hareketi bulunmamaktadır.', 60, yPos + 10);
        }

        // Footer Sayfa 2
        doc.fontSize(8).fillColor('#888888').text('Mersin Büyükşehir Belediyesi - Ulaşım Dairesi Başkanlığı', 50, 780, { align: 'center', width: 500 });
        doc.text('Sayfa 2 / 2', 50, 780, { align: 'right', width: 500 });

        doc.end();

    } catch (err) {
        console.error('PDF Hatası:', err);
        res.status(500).send('PDF Oluşturulamadı');
    }
};

// ============================================================
// 5. DURUM YÖNETİMİ
// ============================================================

exports.personelDondur = async (req, res) => {
    try {
        await pool.query("UPDATE personeller SET aktif = FALSE, calisma_durumu = $1 WHERE personel_id = $2", [req.body.sebep, req.body.personel_id]);
        await pool.query("UPDATE izin_talepleri SET durum = 'IPTAL_EDILDI' WHERE personel_id = $1 AND baslangic_tarihi > CURRENT_DATE", [req.body.personel_id]);
        res.json({ mesaj: 'Pasife alındı.' });
    } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};

exports.personelAktifEt = async (req, res) => {
    try {
        await pool.query("UPDATE personeller SET aktif = TRUE, calisma_durumu = 'Çalışıyor' WHERE personel_id = $1", [req.body.personel_id]);
        res.json({ mesaj: 'Aktif edildi.' });
    } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};

exports.personelSil = async (req, res) => {
    const { personel_id } = req.params;
    const client = await pool.connect();
    try {
        const pRes = await client.query("SELECT aktif FROM personeller WHERE personel_id = $1", [personel_id]);
        if (pRes.rows.length > 0 && pRes.rows[0].aktif) return res.status(400).json({ mesaj: 'Aktif personel silinemez.' });

        await client.query('BEGIN');
        const tables = ['bildirimler', 'imzalar', 'profil_degisiklikleri', 'gorevler', 'yetkiler', 'sistem_loglari', 'izin_talepleri'];
        for(let t of tables) await client.query(`DELETE FROM ${t} WHERE personel_id = $1`, [personel_id]);
        await client.query('DELETE FROM personeller WHERE personel_id = $1', [personel_id]);
        await client.query('COMMIT');
        res.json({ mesaj: 'Silindi.' });
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ mesaj: 'Hata' }); } finally { client.release(); }
};

exports.birimGuncelle = async (req, res) => {
    try { await pool.query('UPDATE personeller SET birim_id = $1 WHERE personel_id = $2', [req.body.yeni_birim_id, req.body.personel_id]); res.json({ mesaj: 'Transfer başarılı.' }); } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};