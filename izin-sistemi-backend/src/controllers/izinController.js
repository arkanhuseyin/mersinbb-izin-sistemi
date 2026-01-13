const pool = require('../config/db');
const { logKaydet, hareketKaydet } = require('../utils/logger');
const dinamikHakedisHesapla = require('../utils/hakedisHesapla'); 
const PDFDocument = require('pdfkit'); 
const fs = require('fs'); 
const path = require('path'); 

// ============================================================
// 🛠️ YARDIMCI FONKSİYONLAR
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

const hesaplaBakiye = async (personel_id) => {
    const gecmisRes = await pool.query("SELECT COALESCE(SUM(gun_sayisi), 0) as toplam_gecmis FROM izin_gecmis_bakiyeler WHERE personel_id = $1", [personel_id]);
    const devredenToplam = parseInt(gecmisRes.rows[0].toplam_gecmis) || 0;

    const buYilHakedis = await dinamikHakedisHesapla(personel_id);

    const uRes = await pool.query(`
        SELECT COALESCE(SUM(kac_gun), 0) as used 
        FROM izin_talepleri 
        WHERE personel_id = $1 
        AND izin_turu = 'YILLIK İZİN' 
        AND durum IN ('IK_ONAYLADI', 'TAMAMLANDI') 
    `, [personel_id]); 

    const toplamKullanilan = parseInt(uRes.rows[0].used) || 0;
    const totalBalance = (devredenToplam + buYilHakedis) - toplamKullanilan;
    return totalBalance;
};

// ============================================================
// 🚀 GEÇMİŞ BAKİYE YÖNETİMİ
// ============================================================

exports.gecmisBakiyeEkle = async (req, res) => {
    const { personel_id, yil, gun_sayisi } = req.body;
    try {
        await pool.query('BEGIN');
        await pool.query("INSERT INTO izin_gecmis_bakiyeler (personel_id, yil, gun_sayisi) VALUES ($1, $2, $3)", [personel_id, yil, gun_sayisi]);
        const sumRes = await pool.query("SELECT COALESCE(SUM(gun_sayisi), 0) as toplam FROM izin_gecmis_bakiyeler WHERE personel_id = $1", [personel_id]);
        const yeniDevreden = parseInt(sumRes.rows[0].toplam);
        await pool.query("UPDATE personeller SET devreden_izin = $1 WHERE personel_id = $2", [yeniDevreden, personel_id]);
        await pool.query('COMMIT');
        res.json({ mesaj: 'Geçmiş bakiye başarıyla eklendi.' });
    } catch (e) {
        await pool.query('ROLLBACK');
        res.status(500).json({ mesaj: 'Hata oluştu.' });
    }
};

exports.gecmisBakiyeleriGetir = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query("SELECT * FROM izin_gecmis_bakiyeler WHERE personel_id = $1 ORDER BY yil ASC", [id]);
        res.json(result.rows);
    } catch (e) { res.status(500).json({ mesaj: 'Hata.' }); }
};

exports.gecmisBakiyeSil = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('BEGIN');
        const kayitRes = await pool.query("SELECT personel_id FROM izin_gecmis_bakiyeler WHERE id = $1", [id]);
        if(kayitRes.rows.length === 0) { await pool.query('ROLLBACK'); return res.status(404).json({mesaj:'Bulunamadı'}); }
        const pid = kayitRes.rows[0].personel_id;
        await pool.query("DELETE FROM izin_gecmis_bakiyeler WHERE id = $1", [id]);
        const sumRes = await pool.query("SELECT COALESCE(SUM(gun_sayisi), 0) as toplam FROM izin_gecmis_bakiyeler WHERE personel_id = $1", [pid]);
        const yeniDevreden = parseInt(sumRes.rows[0].toplam);
        await pool.query("UPDATE personeller SET devreden_izin = $1 WHERE personel_id = $2", [yeniDevreden, pid]);
        await pool.query('COMMIT');
        res.json({ mesaj: 'Silindi.' });
    } catch (e) { 
        await pool.query('ROLLBACK');
        res.status(500).json({ mesaj: 'Hata.' }); 
    }
};

// ============================================================
// 🚀 TEMEL İŞLEVLER
// ============================================================

exports.personelListesi = async (req, res) => {
    try {
        const result = await pool.query(`SELECT p.*, b.birim_adi, r.rol_adi FROM personeller p LEFT JOIN birimler b ON p.birim_id = b.birim_id LEFT JOIN roller r ON p.rol_id = r.rol_id ORDER BY p.ad ASC`);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};

exports.talepOlustur = async (req, res) => {
    let { baslangic_tarihi, bitis_tarihi, kac_gun, izin_turu, aciklama, haftalik_izin, ise_baslama, izin_adresi, personel_imza } = req.body;
    const belge_yolu = req.file ? req.file.path : null;
    const personel_id = req.user.id; 
    
    try {
        const pRes = await pool.query("SELECT ad, soyad, rol_id, gorev FROM personeller WHERE personel_id = $1", [personel_id]);
        const { ad, soyad, rol_id, gorev } = pRes.rows[0];
        const userRoleInfo = await pool.query("SELECT rol_adi FROM roller WHERE rol_id = $1", [rol_id]);
        const userRole = userRoleInfo.rows[0].rol_adi.toLowerCase();
        const userGorev = gorev || '';

        if (izin_turu === 'YILLIK İZİN') {
            const kalanHak = await hesaplaBakiye(personel_id);
            const istenen = parseInt(kac_gun);
            if (istenen > kalanHak) {
                return res.status(400).json({ mesaj: `Sayın ${ad} ${soyad}, Kullanmak istediğiniz izin (${istenen} Gün), Mevcut hakkınızdan (${kalanHak} Gün) fazladır.` });
            }
        }

        baslangic_tarihi = tarihFormatla(baslangic_tarihi);
        bitis_tarihi = tarihFormatla(bitis_tarihi);
        ise_baslama = tarihFormatla(ise_baslama);

        let baslangicDurumu = 'ONAY_BEKLIYOR'; 
        if (userRole === 'amir') baslangicDurumu = 'AMIR_ONAYLADI';
        else if (userRole === 'yazici' || userRole === 'ik') baslangicDurumu = 'YAZICI_ONAYLADI';

        const ofisGorevleri = ['Memur', 'Büro Personeli', 'Genel Evrak', 'Muhasebe', 'Bilgisayar Mühendisi', 'Makine Mühendisi', 'Ulaştırma Mühendisi', 'Bilgisayar Teknikeri', 'Harita Teknikeri', 'Elektrik Teknikeri', 'Makine Teknikeri', 'Ulaştırma Teknikeri', 'Mersin 33 Kart', 'Lojistik', 'Saha Tespit ve İnceleme', 'Araç Takip Sistemleri', 'Yazı İşleri', 'İnspektör', 'Hareket Görevlisi', 'Hareket Memuru', 'Dış Görev', 'İdari İzinli', 'Santral Operatörü', 'Eğitim ve Disiplin İşleri', 'Saha Görevlisi', 'Düz İşçi (KHK)', 'Yol Kontrol Ekibi', 'Kaza Ekibi', 'Yardımcı Hizmetler', 'Çıkış Görevlisi', 'Geçici İşçi', 'Usta', 'Kadrolu İşçi', 'Sürekli İşçi'];
        if (ofisGorevleri.some(g => userGorev.includes(g)) || userGorev.includes('Şef') || userGorev.includes('Şube Müdürü')) {
            baslangicDurumu = 'YAZICI_ONAYLADI'; 
        }

        const yeniTalep = await pool.query(
            `INSERT INTO izin_talepleri (personel_id, baslangic_tarihi, bitis_tarihi, kac_gun, izin_turu, aciklama, haftalik_izin_gunu, ise_baslama_tarihi, izin_adresi, personel_imza, durum, belge_yolu) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [personel_id, baslangic_tarihi, bitis_tarihi, kac_gun, izin_turu, aciklama, haftalik_izin, ise_baslama, izin_adresi, personel_imza, baslangicDurumu, belge_yolu]
        );
        
        await hareketKaydet(yeniTalep.rows[0].talep_id, personel_id, 'BAŞVURU', 'İzin talebi oluşturuldu.');
        await logKaydet(personel_id, 'İZİN_TALEBİ', `Yeni talep ID: ${yeniTalep.rows[0].talep_id}`, req);
        res.json({ mesaj: 'İzin talebi oluşturuldu', talep: yeniTalep.rows[0] });

    } catch (err) { console.error(err); res.status(500).json({ mesaj: 'Hata oluştu.' }); }
};

exports.izinleriGetir = async (req, res) => {
    try {
        let query = `SELECT t.*, p.ad, p.soyad, p.tc_no, p.birim_id, p.gorev FROM izin_talepleri t JOIN personeller p ON t.personel_id = p.personel_id`;
        let params = [];
        if (['admin', 'ik', 'filo'].includes(req.user.rol)) { } 
        else if (['amir', 'yazici'].includes(req.user.rol)) { query += ` WHERE p.birim_id = $1`; params.push(req.user.birim); } 
        else { query += ` WHERE t.personel_id = $1`; params.push(req.user.id); }
        query += ` ORDER BY t.olusturma_tarihi DESC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ mesaj: 'Veri çekilemedi' }); }
};

exports.talepOnayla = async (req, res) => {
    const { talep_id, imza_data, yeni_durum } = req.body;
    const onaylayan_id = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (imza_data) await client.query(`INSERT INTO imzalar (personel_id, imza_data, talep_id) VALUES ($1, $2, $3)`, [onaylayan_id, imza_data, talep_id]);
        await client.query(`UPDATE izin_talepleri SET durum = $1 WHERE talep_id = $2`, [yeni_durum, talep_id]);

        let islemBaslik = 'İŞLEM';
        if (yeni_durum === 'AMIR_ONAYLADI') islemBaslik = 'AMİR ONAYI';
        else if (yeni_durum === 'YAZICI_ONAYLADI') islemBaslik = 'YAZICI ONAYI';
        else if (yeni_durum === 'IK_ONAYLADI') islemBaslik = 'İK ONAYI';
        else if (yeni_durum === 'REDDEDILDI') islemBaslik = 'RED';

        await hareketKaydet(talep_id, onaylayan_id, islemBaslik, `Durum: ${yeni_durum}`);
        await logKaydet(onaylayan_id, 'İZİN_İŞLEMİ', `Talep ${talep_id} durumu: ${yeni_durum}`, req);

        const talepBilgi = await client.query("SELECT p.personel_id, p.ad, p.soyad, i.baslangic_tarihi FROM izin_talepleri i JOIN personeller p ON i.personel_id = p.personel_id WHERE i.talep_id = $1", [talep_id]);
        if (talepBilgi.rows.length > 0) {
            const p = talepBilgi.rows[0];
            const baslangicTarihi = new Date(p.baslangic_tarihi).toLocaleDateString('tr-TR');
            if (yeni_durum === 'IK_ONAYLADI') {
                const mesaj = `Sayın ${p.ad} ${p.soyad}, ${baslangicTarihi} tarihli izniniz onaylanmıştır. İzninizden 1 gün önce İK'ya gelip ıslak imza atınız.`;
                await client.query(`INSERT INTO bildirimler (personel_id, baslik, mesaj) VALUES ($1, $2, $3)`, [p.personel_id, '✅ Onaylandı (Islak İmza Gerekli)', mesaj]);
            } else if (yeni_durum === 'REDDEDILDI') {
                await client.query(`INSERT INTO bildirimler (personel_id, baslik, mesaj) VALUES ($1, $2, $3)`, [p.personel_id, '❌ Reddedildi', 'İzin talebiniz reddedildi.']);
            }
        }
        await client.query('COMMIT');
        res.json({ mesaj: 'İşlem tamamlandı.' });
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ mesaj: 'Hata oluştu.' }); } finally { client.release(); }
};

exports.izinDurumRaporu = async (req, res) => {
    if (!['admin', 'ik'].includes(req.user.rol)) return res.status(403).json({ mesaj: 'Yetkisiz' });
    try {
        const query = `SELECT p.personel_id, p.ad, p.soyad, p.tc_no, p.ise_giris_tarihi, p.devreden_izin, b.birim_adi, COALESCE(SUM(it.kac_gun), 0) as bu_yil_kullanilan FROM personeller p LEFT JOIN birimler b ON p.birim_id = b.birim_id LEFT JOIN izin_talepleri it ON p.personel_id = it.personel_id AND it.durum IN ('IK_ONAYLADI', 'TAMAMLANDI') AND it.izin_turu = 'YILLIK İZİN' AND it.baslangic_tarihi >= date_trunc('year', CURRENT_DATE) WHERE p.aktif = TRUE GROUP BY p.personel_id, b.birim_adi, p.ad, p.soyad, p.tc_no, p.ise_giris_tarihi, p.devreden_izin ORDER BY p.ad ASC`;
        const result = await pool.query(query);
        const rapor = await Promise.all(result.rows.map(async (p) => {
            const netKalan = await hesaplaBakiye(p.personel_id);
            const gRes = await pool.query("SELECT COALESCE(SUM(gun_sayisi), 0) as top FROM izin_gecmis_bakiyeler WHERE personel_id = $1", [p.personel_id]);
            const devreden = parseInt(gRes.rows[0].top);
            const buYilHak = await dinamikHakedisHesapla(p.personel_id);
            return { ...p, devreden_izin: devreden, bu_yil_hakedis: buYilHak, kalan: netKalan, uyari: netKalan > 40 };
        }));
        res.json(rapor);
    } catch (err) { res.status(500).send('Rapor hatası'); }
};

exports.getPersonelIzinDetay = async (req, res) => {
    const { id } = req.params; 
    try {
        const pRes = await pool.query(`SELECT p.*, b.birim_adi, r.rol_adi FROM personeller p LEFT JOIN birimler b ON p.birim_id = b.birim_id LEFT JOIN roller r ON p.rol_id = r.rol_id WHERE p.personel_id = $1`, [id]);
        if (pRes.rows.length === 0) return res.status(404).json({ mesaj: 'Personel bulunamadı' });
        const gecmisRes = await pool.query(`SELECT * FROM izin_gecmis_bakiyeler WHERE personel_id = $1 ORDER BY yil ASC`, [id]);
        const izinRes = await pool.query(`SELECT * FROM izin_talepleri WHERE personel_id = $1 AND durum IN ('IK_ONAYLADI', 'TAMAMLANDI') ORDER BY baslangic_tarihi ASC`, [id]);
        let toplamKullanilan = 0;
        izinRes.rows.forEach(izin => { if (izin.izin_turu === 'YILLIK İZİN') toplamKullanilan += parseInt(izin.kac_gun); });
        const netKalan = await hesaplaBakiye(id);
        const buYilHak = await dinamikHakedisHesapla(id);
        const personelVerisi = { ...pRes.rows[0], kullanilan: toplamKullanilan, kalan: netKalan, bu_yil_hak: buYilHak };
        res.json({ personel: personelVerisi, gecmisBakiyeler: gecmisRes.rows, izinler: izinRes.rows });
    } catch (e) { res.status(500).json({ mesaj: 'Veri çekilemedi.' }); }
};

exports.tumPersonelDetayliVeri = async (req, res) => {
    if (!['admin', 'ik', 'filo'].includes(req.user.rol)) return res.status(403).json({ mesaj: 'Yetkisiz işlem' });
    try {
        const pRes = await pool.query(`SELECT p.personel_id, p.tc_no, p.ad, p.soyad, p.sicil_no, p.ise_giris_tarihi, p.kadro_tipi, b.birim_adi FROM personeller p LEFT JOIN birimler b ON p.birim_id = b.birim_id WHERE p.aktif = TRUE ORDER BY p.ad ASC`);
        const gRes = await pool.query(`SELECT * FROM izin_gecmis_bakiyeler ORDER BY yil ASC`);
        const iRes = await pool.query(`SELECT * FROM izin_talepleri WHERE durum IN ('IK_ONAYLADI', 'TAMAMLANDI') AND izin_turu = 'YILLIK İZİN'`);
        res.json({ personeller: pRes.rows, gecmisBakiyeler: gRes.rows, izinler: iRes.rows });
    } catch (e) { res.status(500).json({ mesaj: 'Veri çekilemedi.' }); }
};

exports.islakImzaDurumu = async (req, res) => {
    if (!['admin', 'ik'].includes(req.user.rol)) return res.status(403).json({ mesaj: 'Yetkisiz' });
    const { talep_id, durum } = req.body; 
    const client = await pool.connect(); 
    try {
        await client.query('BEGIN');
        const talepRes = await client.query('SELECT t.personel_id, t.baslangic_tarihi, p.ad, p.soyad FROM izin_talepleri t JOIN personeller p ON t.personel_id = p.personel_id WHERE t.talep_id = $1', [talep_id]);
        if(talepRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({mesaj: 'Bulunamadı'}); }
        const p = talepRes.rows[0];
        if (durum === 'GELDI') {
            await client.query("UPDATE izin_talepleri SET durum = 'TAMAMLANDI' WHERE talep_id = $1", [talep_id]);
            await client.query(`INSERT INTO bildirimler (personel_id, baslik, mesaj) VALUES ($1, $2, $3)`, [p.personel_id, '🎉 İyi Tatiller', 'İzin talebiniz tamamlanmıştır.']);
            await client.query('COMMIT'); res.json({ mesaj: 'Personel izne ayrıldı.' });
        } else if (durum === 'GELMEDI') {
            await client.query("UPDATE izin_talepleri SET durum = 'IPTAL_EDILDI' WHERE talep_id = $1", [talep_id]);
            await client.query(`INSERT INTO bildirimler (personel_id, baslik, mesaj) VALUES ($1, $2, $3)`, [p.personel_id, '⚠️ İPTAL', 'Islak imzaya gelinmediği için izin talebiniz iptal edilmiştir.']);
            await client.query('COMMIT'); res.json({ mesaj: 'İzin iptal edildi.' });
        }
    } catch (e) { await client.query('ROLLBACK'); res.status(500).send('Hata'); } finally { client.release(); }
};

exports.getTimeline = async (req, res) => {
    try {
        const result = await pool.query(`SELECT h.*, p.ad, p.soyad, r.rol_adi FROM izin_hareketleri h JOIN personeller p ON h.islem_yapan_id = p.personel_id JOIN roller r ON p.rol_id = r.rol_id WHERE h.talep_id = $1 ORDER BY h.tarih ASC`, [req.params.talep_id]);
        res.json(result.rows);
    } catch (e) { res.status(500).send('Hata'); }
};

exports.getSystemLogs = async (req, res) => {
    try {
        const result = await pool.query(`SELECT l.*, p.ad, p.soyad, p.tc_no FROM sistem_loglari l LEFT JOIN personeller p ON l.personel_id = p.personel_id ORDER BY l.tarih DESC LIMIT 100`);
        res.json(result.rows);
    } catch (e) { res.status(500).send('Hata'); }
};

// ============================================================
// 📄 1. TOPLU PDF RAPORU
// ============================================================
exports.topluPdfRaporu = async (req, res) => {
    if (!['admin', 'ik', 'filo'].includes(req.user.rol)) return res.status(403).send('Yetkisiz işlem');

    try {
        const pRes = await pool.query(`SELECT p.*, b.birim_adi FROM personeller p LEFT JOIN birimler b ON p.birim_id = b.birim_id WHERE p.aktif = TRUE ORDER BY p.ad ASC`);
        const gRes = await pool.query(`SELECT * FROM izin_gecmis_bakiyeler`);
        const iRes = await pool.query(`SELECT * FROM izin_talepleri WHERE durum IN ('IK_ONAYLADI', 'TAMAMLANDI') AND izin_turu = 'YILLIK İZİN'`);

        const personeller = pRes.rows;
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
        
        const fontPath = path.join(__dirname, '../../templates/font.ttf');
        if (fs.existsSync(fontPath)) doc.registerFont('TrFont', fontPath);
        doc.font(fs.existsSync(fontPath) ? 'TrFont' : 'Helvetica');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Genel_Izin_Raporu.pdf`);
        doc.pipe(res);

        doc.fontSize(16).fillColor('#1a3c6e').text('MERSİN BÜYÜKŞEHİR BELEDİYESİ', { align: 'center' });
        doc.fontSize(12).fillColor('#555').text('TOPLU TAŞIMA ŞUBE MÜDÜRLÜĞÜ - GENEL İZİN RAPORU', { align: 'center' });
        doc.moveDown(1);

        let y = doc.y;
        const startX = 20;
        const colWidths = [30, 80, 100, 70, 70, 60, 60, 60, 60, 60, 80];
        const headers = ["Sıra", "TC No", "Ad Soyad", "Birim", "Giriş Tar.", "Kıdem", "Devr.", "Bu Yıl", "Toplam", "Kln.", "Durum"];

        doc.rect(startX, y, 770, 20).fill('#eee');
        doc.fillColor('#000').fontSize(9);
        let currentX = startX;
        headers.forEach((h, i) => { doc.text(h, currentX + 5, y + 6, { width: colWidths[i] }); currentX += colWidths[i]; });
        y += 25;

        for (let i = 0; i < personeller.length; i++) {
            const p = personeller[i];
            const pGecmis = gRes.rows.filter(g => g.personel_id === p.personel_id);
            const pIzinler = iRes.rows.filter(iz => iz.personel_id === p.personel_id);
            
            let devreden = 0; 
            pGecmis.forEach(g => devreden += parseInt(g.gun_sayisi) || 0); // ✅ parseInt eklendi
            
            const buYilHak = await dinamikHakedisHesapla(p.personel_id);
            const toplamHavuz = devreden + buYilHak;
            
            let kullanilan = 0; 
            pIzinler.forEach(iz => kullanilan += parseInt(iz.kac_gun) || 0); // ✅ parseInt eklendi
            
            const kalan = toplamHavuz - kullanilan;
            const giris = new Date(p.ise_giris_tarihi);
            const kidem = Math.floor((new Date() - giris) / (1000 * 60 * 60 * 24 * 365.25));

            let durumMetni = "NORMAL";
            let durumRenk = "#2ecc71"; 
            if(kalan < 0) { durumMetni = "LİMİT AŞIMI"; durumRenk = "#e74c3c"; }
            else if(kalan < 5) { durumMetni = "AZALDI"; durumRenk = "#f39c12"; }

            if (y > 500) { doc.addPage({ layout: 'landscape' }); y = 30; }
            if (i % 2 === 0) doc.rect(startX, y - 5, 770, 20).fill('#f9f9f9');
            
            doc.fillColor('#333').fontSize(8);
            let rowX = startX;
            const rowData = [(i + 1).toString(), p.tc_no, `${p.ad} ${p.soyad}`, p.birim_adi || '-', giris.toLocaleDateString('tr-TR'), `${kidem} Yıl`, devreden.toString(), buYilHak.toString(), toplamHavuz.toString(), kalan.toString(), durumMetni];

            rowData.forEach((data, index) => {
                if (index === 10) doc.fillColor(durumRenk).font(fs.existsSync(fontPath) ? 'TrFont' : 'Helvetica-Bold');
                else doc.fillColor('#333').font(fs.existsSync(fontPath) ? 'TrFont' : 'Helvetica');
                doc.text(String(data || '-'), rowX + 5, y, { width: colWidths[index] }); // ✅ String çevrimi ve null check
                rowX += colWidths[index];
            });
            y += 20;
        }
        doc.end();
    } catch (err) { console.error(err); res.status(500).send("PDF Hatası"); }
};

// ============================================================
// 📄 2. KİŞİYE ÖZEL DETAYLI PDF RAPORU
// ============================================================
exports.kisiOzelPdfRaporu = async (req, res) => {
    const { id } = req.params;
    try {
        const pRes = await pool.query(`SELECT p.*, b.birim_adi FROM personeller p LEFT JOIN birimler b ON p.birim_id = b.birim_id WHERE p.personel_id = $1`, [id]);
        if(pRes.rows.length === 0) return res.status(404).send('Personel bulunamadı');
        const p = pRes.rows[0];

        const gRes = await pool.query(`SELECT * FROM izin_gecmis_bakiyeler WHERE personel_id = $1`, [id]);
        const iRes = await pool.query(`SELECT * FROM izin_talepleri WHERE personel_id = $1 AND durum IN ('IK_ONAYLADI', 'TAMAMLANDI') ORDER BY baslangic_tarihi DESC`, [id]);

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const fontPath = path.join(__dirname, '../../templates/font.ttf');
        if (fs.existsSync(fontPath)) doc.registerFont('TrFont', fontPath);
        doc.font(fs.existsSync(fontPath) ? 'TrFont' : 'Helvetica');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${p.ad.replace(/ /g, '_')}_Detayli_Rapor.pdf`);
        doc.pipe(res);

        doc.fontSize(16).fillColor('#1a3c6e').text('MERSİN BÜYÜKŞEHİR BELEDİYESİ', { align: 'center' });
        doc.fontSize(12).fillColor('#555').text('TOPLU TAŞIMA ŞUBE MÜDÜRLÜĞÜ - PERSONEL İZİN DETAYI', { align: 'center' });
        doc.moveDown(2);

        doc.rect(40, doc.y, 515, 80).fill('#f8f9fa').stroke('#ddd');
        doc.fillColor('#000').fontSize(10);
        let y = doc.y + 15;
        doc.text(`Adı Soyadı: ${p.ad} ${p.soyad}`, 50, y); doc.text(`TC Kimlik No: ${p.tc_no}`, 300, y); y+=20;
        doc.text(`Sicil No: ${p.sicil_no || '-'}`, 50, y); doc.text(`Birim: ${p.birim_adi || '-'}`, 300, y); y+=20;
        doc.text(`Kadro: ${p.kadro_tipi || '-'}`, 50, y); 
        
        const girisTarihi = p.ise_giris_tarihi ? new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR') : '-';
        doc.text(`İşe Giriş: ${girisTarihi}`, 300, y);
        doc.moveDown(4);

        let devreden = 0; 
        gRes.rows.forEach(g => devreden += parseInt(g.gun_sayisi) || 0); // ✅ parseInt
        
        const buYilHak = await dinamikHakedisHesapla(id);
        
        let kullanilan = 0; 
        iRes.rows.forEach(iz => { if(iz.izin_turu === 'YILLIK İZİN') kullanilan += parseInt(iz.kac_gun) || 0; }); // ✅ parseInt
        
        const toplamHavuz = devreden + buYilHak;
        const kalan = toplamHavuz - kullanilan;

        doc.fontSize(12).text('BAKİYE ÖZETİ', { underline: true });
        doc.fontSize(10).moveDown(0.5);
        doc.text(`• Geçmişten Devreden: +${devreden} Gün`);
        doc.text(`• Bu Yıl Hakediş: +${buYilHak} Gün`);
        doc.text(`• Toplam Kullanılan: -${kullanilan} Gün`);
        doc.fillColor(kalan < 0 ? '#e74c3c' : '#2ecc71').fontSize(12).text(`• GÜNCEL KALAN BAKİYE: ${kalan} Gün`, { indent: 20 });
        doc.moveDown(2);

        doc.fillColor('#000').fontSize(12).text('İZİN HAREKETLERİ');
        doc.moveDown(0.5);
        let tableY = doc.y;
        
        doc.rect(40, tableY, 515, 20).fill('#333');
        doc.fillColor('#fff').fontSize(9);
        doc.text("İzin Türü", 50, tableY + 6); doc.text("Başlangıç", 200, tableY + 6); doc.text("Bitiş", 300, tableY + 6);
        doc.text("Gün", 400, tableY + 6); doc.text("Durum", 480, tableY + 6);
        tableY += 20; doc.fillColor('#333');

        iRes.rows.forEach((iz, i) => {
            if (tableY > 750) { doc.addPage(); tableY = 40; }
            if (i % 2 === 0) doc.rect(40, tableY, 515, 20).fill('#eee');
            
            const baslangic = iz.baslangic_tarihi ? new Date(iz.baslangic_tarihi).toLocaleDateString('tr-TR') : '-';
            const bitis = iz.bitis_tarihi ? new Date(iz.bitis_tarihi).toLocaleDateString('tr-TR') : '-';

            doc.text(String(iz.izin_turu || '-'), 50, tableY + 6);
            doc.text(baslangic, 200, tableY + 6);
            doc.text(bitis, 300, tableY + 6);
            doc.text(String(iz.kac_gun || 0) + ' Gün', 400, tableY + 6);
            doc.text('ONAYLI', 480, tableY + 6);
            tableY += 20;
        });

        doc.end();

    } catch (err) { console.error("PDF Hatası:", err); res.status(500).send("PDF Hatası"); }
};