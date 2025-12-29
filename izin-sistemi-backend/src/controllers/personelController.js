const pool = require('../config/db');
const { logKaydet } = require('../utils/logger');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// YARDIMCI: Boş alanları NULL yap (Veritabanı hatasını önler)
const formatNull = (val) => (val === '' || val === undefined || val === 'null' ? null : val);

// YARDIMCI: Türkçe Karakter Düzeltme (PDF standart fontlarında bozulmayı önlemek için)
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
// 2. YENİ PERSONEL EKLE (TÜM ALANLAR)
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
// 3. PERSONEL GÜNCELLE (DÜZENLEME)
// ============================================================
exports.personelGuncelle = async (req, res) => {
    const { id } = req.params;
    // Gelen tüm verileri parçalayalım
    const { 
        ad, soyad, telefon, adres, gorev, kadro_tipi, gorev_yeri,
        ayakkabi_no, tisort_beden, gomlek_beden, suveter_beden, mont_beden,
        tc_no, dogum_tarihi, cinsiyet, medeni_hal, kan_grubu, birim_id, rol
    } = req.body;
    
    const fotograf_yolu = req.file ? req.file.path : undefined;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Rol değişecekse ID bul
        let rolId = null;
        if(rol) {
            const rolRes = await client.query("SELECT rol_id FROM roller WHERE LOWER(rol_adi) = LOWER($1)", [rol]);
            if(rolRes.rows.length > 0) rolId = rolRes.rows[0].rol_id;
        }

        // Dinamik güncelleme sorgusu oluşturuyoruz
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

        let paramIndex = 18; // 17 tane parametre yukarıda eklendi

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

        // WHERE koşulu en son eklenir
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
// 4. KURUMSAL PDF OLUŞTURMA (HEADER RESİMLİ)
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

        // A4 Boyutu
        const doc = new PDFDocument({ margin: 0, size: 'A4' });
        
        const filename = `${trFix(p.ad)}_${trFix(p.soyad)}_Kart.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);

        // --- 1. KURUMSAL HEADER (pdf1.png) ---
        // Path: backend klasörünün bir üstündeki templates klasörü
        const headerPath = path.join(__dirname, '../../templates/pdf1.png');
        
        if (fs.existsSync(headerPath)) {
            // Resmi sayfanın en üstüne, tam genişlikte yerleştir
            doc.image(headerPath, 0, 0, { width: 595.28 }); // A4 Genişliği ~595px
        } else {
            console.log('Header resmi bulunamadı:', headerPath);
        }

        // İçerik başlangıç Y koordinatı (Resmin altından başla)
        let yPos = 160; 

        // --- 2. BAŞLIK ---
        doc.fillColor('#000000');
        doc.font('Helvetica-Bold').fontSize(18).text('PERSONEL BILGI KARTI', 0, yPos, { align: 'center', width: 595.28 });
        
        // Alt çizgi
        doc.moveTo(50, yPos + 25).lineTo(545, yPos + 25).strokeColor('#cccccc').lineWidth(1).stroke();

        yPos += 50; // Aşağı in

        // --- 3. FOTOĞRAF (SAĞ ÜST) ---
        if (p.fotograf_yolu && fs.existsSync(p.fotograf_yolu)) {
            try {
                // Çerçeve
                doc.rect(420, yPos, 100, 120).strokeColor('#333333').lineWidth(1).stroke();
                // Resim
                doc.image(p.fotograf_yolu, 421, yPos + 1, { width: 98, height: 118, fit: [98, 118] });
            } catch (e) { console.log('Personel resmi yüklenemedi:', e); }
        } else {
            // Resim yoksa gri kutu
            doc.rect(420, yPos, 100, 120).fillColor('#f0f0f0').fill().strokeColor('#333333').stroke();
            doc.fillColor('#999999').fontSize(10).text('FOTOGRAF', 420, yPos + 55, { width: 100, align: 'center' });
        }

        // --- 4. BİLGİ TABLOSU ---
        const leftX = 50;
        const valueX = 180;
        let currentY = yPos;

        // Satır Yazdırma Fonksiyonu
        const row = (label, value) => {
            // Arka plan şeridi (Sırayla gri/beyaz)
            doc.rect(leftX, currentY - 5, 350, 20).fillColor(currentY % 40 === 0 ? '#f9f9f9' : '#ffffff').fill();
            
            // Etiket
            doc.fillColor('#333333').font('Helvetica-Bold').fontSize(10).text(label + ':', leftX + 5, currentY);
            
            // Değer
            doc.fillColor('#000000').font('Helvetica').fontSize(10).text(trFix(value), valueX, currentY);
            
            currentY += 22;
        };

        // BÖLÜM: KİMLİK
        doc.fillColor('#d32f2f').font('Helvetica-Bold').fontSize(12).text('KIMLIK VE ILETISIM', leftX, currentY - 30);
        
        row('TC Kimlik No', p.tc_no);
        row('Ad Soyad', `${p.ad} ${p.soyad}`);
        row('Telefon', p.telefon);
        row('Dogum Tarihi', p.dogum_tarihi ? new Date(p.dogum_tarihi).toLocaleDateString('tr-TR') : '-');
        
        // Adres (Uzun olabileceği için özel işlem)
        doc.fillColor('#333333').font('Helvetica-Bold').text('Adres:', leftX + 5, currentY);
        doc.fillColor('#000000').font('Helvetica').text(trFix(p.adres), valueX, currentY, { width: 220 });
        currentY += 40; 

        // BÖLÜM: KURUMSAL
        currentY += 10;
        doc.fillColor('#d32f2f').font('Helvetica-Bold').fontSize(12).text('KURUMSAL BILGILER', leftX, currentY - 5);
        currentY += 15;
        row('Sicil No', p.personel_id);
        row('Birim', p.birim_adi);
        row('Gorev', p.gorev);
        row('Kadro Tipi', p.kadro_tipi);
        row('Gorev Yeri', p.gorev_yeri);
        row('Ise Giris', p.ise_giris_tarihi ? new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR') : '-');

        // BÖLÜM: BEDEN
        currentY += 10;
        doc.fillColor('#d32f2f').font('Helvetica-Bold').fontSize(12).text('BEDEN VE KIYAFET', leftX, currentY - 5);
        currentY += 15;
        row('Ayakkabi No', p.ayakkabi_no);
        row('Mont Bedeni', p.mont_beden);
        row('Gomlek', p.gomlek_beden);
        row('Tisort', p.tisort_beden);

        // Alt Bilgi
        doc.fontSize(8).fillColor('#888888').text('Bu belge Mersin Buyuksehir Belediyesi Personel Yonetim Sistemi tarafindan uretilmistir.', 50, 780, { align: 'center', width: 500 });

        doc.end();

    } catch (err) {
        console.error('PDF Hatası:', err);
        res.status(500).send('PDF Olusturulamadi');
    }
};

// ============================================================
// 5. DURUM YÖNETİMİ (DONDUR - AKTİF ET - SİL)
// ============================================================

// DONDURMA (PASİFE ALMA)
exports.personelDondur = async (req, res) => {
    const { personel_id, sebep } = req.body;
    try {
        const client = await pool.connect();
        await client.query('BEGIN');
        
        // Aktif=FALSE yap
        await client.query("UPDATE personeller SET aktif = FALSE, calisma_durumu = $1 WHERE personel_id = $2", [sebep, personel_id]);
        
        // İleri tarihli izinleri iptal et
        await client.query("UPDATE izin_talepleri SET durum = 'IPTAL_EDILDI' WHERE personel_id = $1 AND baslangic_tarihi > CURRENT_DATE", [personel_id]);
        
        await logKaydet(req.user.id, 'PASIFE_ALMA', `Personel (${personel_id}) pasife alındı. Sebep: ${sebep}`, req);
        
        await client.query('COMMIT');
        client.release();
        res.json({ mesaj: 'Personel başarıyla donduruldu (Pasife alındı).' });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ mesaj: 'Hata oluştu' }); 
    }
};

// AKTİF ETME (GERİ ALMA)
exports.personelAktifEt = async (req, res) => {
    const { personel_id } = req.body;
    
    if (!req.user || !['admin', 'ik'].includes(req.user.rol)) {
        return res.status(403).json({ mesaj: 'Yetkisiz işlem.' });
    }

    try {
        await pool.query("UPDATE personeller SET aktif = TRUE, calisma_durumu = 'Çalışıyor' WHERE personel_id = $1", [personel_id]);
        await logKaydet(req.user.id, 'AKTIF_ETME', `Personel (${personel_id}) tekrar aktif edildi.`, req);
        res.json({ mesaj: 'Personel başarıyla aktif edildi.' });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ mesaj: 'Hata oluştu' }); 
    }
};

// KALICI SİLME (Sadece Pasifse Silinir)
exports.personelSil = async (req, res) => {
    if (!req.user || !['admin', 'ik'].includes(req.user.rol)) {
        return res.status(403).json({ mesaj: 'Yetkisiz işlem.' });
    }
    
    const { personel_id } = req.params;
    const client = await pool.connect();

    try {
        // Önce kontrol et: Aktif mi?
        const pRes = await client.query("SELECT aktif FROM personeller WHERE personel_id = $1", [personel_id]);
        if (pRes.rows.length === 0) return res.status(404).json({ mesaj: 'Personel bulunamadı.' });
        
        if (pRes.rows[0].aktif) {
            return res.status(400).json({ mesaj: 'DİKKAT: Aktif personel silinemez! Önce "Dondur" işlemi yapmalısınız.' });
        }

        await client.query('BEGIN');

        // Bağlı tüm verileri sil (Foreign Key hatası almamak için)
        // Sırası önemlidir.
        await client.query('DELETE FROM bildirimler WHERE personel_id = $1', [personel_id]);
        await client.query('DELETE FROM imzalar WHERE personel_id = $1', [personel_id]);
        await client.query('DELETE FROM profil_degisiklikleri WHERE personel_id = $1', [personel_id]);
        await client.query('DELETE FROM gorevler WHERE personel_id = $1', [personel_id]);
        await client.query('DELETE FROM yetkiler WHERE personel_id = $1', [personel_id]);
        await client.query('DELETE FROM sistem_loglari WHERE personel_id = $1', [personel_id]); // Logları da siliyoruz
        await client.query('DELETE FROM izin_talepleri WHERE personel_id = $1', [personel_id]);
        
        // En son personeli sil
        await client.query('DELETE FROM personeller WHERE personel_id = $1', [personel_id]);

        await client.query('COMMIT');
        res.json({ mesaj: 'Personel ve tüm geçmiş verileri başarıyla silindi.' });

    } catch (err) { 
        await client.query('ROLLBACK');
        console.error('Silme hatası:', err);
        res.status(500).json({ mesaj: 'Silme işlemi başarısız.', detay: err.message });
    } finally {
        client.release();
    }
};

// TRANSFER İŞLEMİ
exports.birimGuncelle = async (req, res) => {
    if (!req.user || !['admin', 'ik', 'yazici', 'filo'].includes(req.user.rol)) {
        return res.status(403).json({ mesaj: 'Yetkisiz' });
    }

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

    } catch (err) { 
        console.error(err);
        res.status(500).json({ mesaj: 'Hata oluştu' }); 
    }
};