const pool = require('../config/db');
const { logKaydet, hareketKaydet } = require('../utils/logger');
// 🧠 MERKEZİ HESAPLAMA MOTORU
const { hesaplaBuYil, hesaplaKumulatif, hesaplaKumulatifDetayli } = require('../utils/hakedisHesapla'); 
const PDFDocument = require('pdfkit'); 
const fs = require('fs'); 
const path = require('path'); 

// ============================================================
// 🛠️ YARDIMCI FONKSİYONLAR
// ============================================================

const tarihFormatla = (tarihStr) => {
    if (!tarihStr) return null;
    const str = String(tarihStr).trim();
    // 15.01.2026 -> 2026-01-15
    if (str.includes('.')) {
        const parts = str.split('.');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    // ISO Format
    if (str.includes('T')) return str.split('T')[0];
    return str;
};

const tarihGoster = (tarihStr) => {
    if (!tarihStr) return '-';
    try {
        const d = new Date(tarihStr);
        if(isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('tr-TR');
    } catch { return '-'; }
};

const turkceKarakterTemizle = (str) => {
    if(!str) return "rapor";
    return str.replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
              .replace(/ü/g, 'u').replace(/Ü/g, 'U')
              .replace(/ş/g, 's').replace(/Ş/g, 'S')
              .replace(/ı/g, 'i').replace(/İ/g, 'I')
              .replace(/ö/g, 'o').replace(/Ö/g, 'O')
              .replace(/ç/g, 'c').replace(/Ç/g, 'C')
              .replace(/[^a-zA-Z0-9]/g, '_'); 
};

// ============================================================
// 🧠 ANA BAKİYE HESAPLAMA 
// (Doğum Tarihi, Ayrılma Tarihi ve Aktiflik Durumunu Dikkate Alır)
// ============================================================
const hesaplaBakiye = async (personel_id) => {
    // 1. Personel Kritik Bilgilerini Çek
    const pRes = await pool.query("SELECT ise_giris_tarihi, dogum_tarihi, ayrilma_tarihi, aktif FROM personeller WHERE personel_id = $1", [personel_id]);
    if (pRes.rows.length === 0) return 0;
    
    const p = pRes.rows[0];

    // 2. ÖMÜR BOYU HAKKI MERKEZDEN ÇEK
    const toplamHakedis = await hesaplaKumulatif(p.ise_giris_tarihi, p.dogum_tarihi, p.ayrilma_tarihi, p.aktif);

    // 3. Manuel Eklenenleri Al (Sisteme devredenler)
    const gecmisRes = await pool.query("SELECT COALESCE(SUM(gun_sayisi), 0) as toplam_gecmis FROM izin_gecmis_bakiyeler WHERE personel_id = $1", [personel_id]);
    const manuelEklenen = parseInt(gecmisRes.rows[0].toplam_gecmis) || 0;

    // 4. Kullanılanları Al (Onaylanmış izinler)
    const uRes = await pool.query(`
        SELECT COALESCE(SUM(kac_gun), 0) as used 
        FROM izin_talepleri 
        WHERE personel_id = $1 
        AND izin_turu = 'YILLIK İZİN' 
        AND durum IN ('IK_ONAYLADI', 'TAMAMLANDI') 
    `, [personel_id]); 
    const toplamKullanilan = parseInt(uRes.rows[0].used) || 0;

    // 5. Sonuç: (Hakediş + Manuel) - Kullanılan
    return (toplamHakedis + manuelEklenen) - toplamKullanilan;
};

// ============================================================
// 🚀 CONTROLLER FONKSİYONLARI
// ============================================================

// GEÇMİŞ BAKİYE YÖNETİMİ
exports.gecmisBakiyeEkle = async (req, res) => {
    const { personel_id, yil, gun_sayisi } = req.body;
    try {
        await pool.query('BEGIN');
        await pool.query("INSERT INTO izin_gecmis_bakiyeler (personel_id, yil, gun_sayisi) VALUES ($1, $2, $3)", [personel_id, yil, gun_sayisi]);
        await pool.query('COMMIT');
        res.json({ mesaj: 'Geçmiş bakiye eklendi.' });
    } catch (e) { await pool.query('ROLLBACK'); res.status(500).json({ mesaj: 'Hata oluştu.' }); }
};

exports.gecmisBakiyeleriGetir = async (req, res) => {
    const { id } = req.params;
    try { const result = await pool.query("SELECT * FROM izin_gecmis_bakiyeler WHERE personel_id = $1 ORDER BY yil ASC", [id]); res.json(result.rows); } catch (e) { res.status(500).json({ mesaj: 'Hata.' }); }
};

exports.gecmisBakiyeSil = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM izin_gecmis_bakiyeler WHERE id = $1', [id]);
        res.json({ mesaj: 'Silindi.' });
    } catch (e) { res.status(500).json({ mesaj: 'Hata.' }); }
};

// TALEP OLUŞTURMA (GÜNCELLENDİ: İK BYPASS ÖZELLİĞİ EKLENDİ)
exports.talepOlustur = async (req, res) => {
    let { 
        baslangic_tarihi, bitis_tarihi, kac_gun, izin_turu, 
        aciklama, haftalik_izin, ise_baslama, izin_adresi, 
        personel_imza,
        hedef_personel_id // ✅ Yeni: Eğer İK başkası adına giriyorsa bu dolu gelir
    } = req.body;

    const belge_yolu = req.file ? req.file.path : null;
    
    // İşlemi yapan kişi (Login olan)
    const islemYapanId = req.user.id;
    const islemYapanRol = req.user.rol; // 'admin', 'ik', 'personel' vs.

    try {
        // 1. Hedef Personeli Belirle
        let asilPersonelId = islemYapanId;
        let isIkOverride = false; // İK bypass işlemi mi?

        // Eğer işlem yapan Admin/İK ise ve başka bir ID göndermişse
        if (['admin', 'ik', 'filo'].includes(islemYapanRol) && hedef_personel_id) {
            asilPersonelId = hedef_personel_id;
            isIkOverride = true;
        }

        // 2. Personel Bilgilerini Çek
        const pRes = await pool.query("SELECT ad, soyad, rol_id, gorev, birim_id FROM personeller WHERE personel_id = $1", [asilPersonelId]);
        if (pRes.rows.length === 0) return res.status(404).json({ mesaj: 'Personel bulunamadı.' });
        
        const { ad, soyad, rol_id, gorev, birim_id } = pRes.rows[0];
        const userRoleInfo = await pool.query("SELECT rol_adi FROM roller WHERE rol_id = $1", [rol_id]);
        const personelRolAdi = userRoleInfo.rows[0].rol_adi.toLowerCase();

        // 3. Bakiye Kontrolü (Yıllık İzin ise)
        // İK girse bile bakiye kontrolü yapılmalı, yoksa eksiye düşer.
        if (izin_turu === 'YILLIK İZİN') {
            const kalanHak = await hesaplaBakiye(asilPersonelId);
            const istenen = parseInt(kac_gun);
            if (istenen > kalanHak) {
                // İK giriyorsa belki eksiye düşürmeye izin vermek istersin? Şimdilik uyarı verelim.
                return res.status(400).json({ mesaj: `DİKKAT: ${ad} ${soyad} adlı personelin yeterli bakiyesi yok. (Kalan: ${kalanHak}, İstenen: ${istenen})` });
            }
        }

        const dbBaslangic = tarihFormatla(baslangic_tarihi);
        const dbBitis = tarihFormatla(bitis_tarihi);
        const dbIseBaslama = tarihFormatla(ise_baslama);

        // 4. Durum Belirleme (OTOMATİK ONAY MANTIĞI)
        let baslangicDurumu = 'ONAY_BEKLIYOR'; 

        if (isIkOverride) {
            // ✅ Eğer İK/Admin giriyorsa direkt onaylı başlar (Amir/Yazıcı atlanır)
            baslangicDurumu = 'IK_ONAYLADI'; 
        } else {
            // Normal personel girişi
            if (personelRolAdi === 'amir') baslangicDurumu = 'AMIR_ONAYLADI';
            else if (personelRolAdi === 'yazici' || personelRolAdi === 'ik') baslangicDurumu = 'YAZICI_ONAYLADI';
            
            // Ofis/Beyaz Yaka Kontrolü
            const ofisGorevleri = ['Memur', 'Büro Personeli', 'Genel Evrak', 'Muhasebe', 'Bilgisayar Mühendisi', 'Makine Mühendisi', 'Ulaştırma Mühendisi', 'Bilgisayar Teknikeri', 'Harita Teknikeri', 'Elektrik Teknikeri', 'Makine Teknikeri', 'Ulaştırma Teknikeri', 'Mersin 33 Kart', 'Lojistik', 'Saha Tespit ve İnceleme', 'Araç Takip Sistemleri', 'Yazı İşleri', 'İnspektör', 'Hareket Görevlisi', 'Hareket Memuru', 'Dış Görev', 'İdari İzinli', 'Santral Operatörü', 'Eğitim ve Disiplin İşleri', 'Saha Görevlisi', 'Düz İşçi (KHK)', 'Yol Kontrol Ekibi', 'Kaza Ekibi', 'Yardımcı Hizmetler', 'Çıkış Görevlisi', 'Geçici İşçi', 'Usta', 'Kadrolu İşçi', 'Sürekli İşçi'];
            if (ofisGorevleri.some(g => (gorev || '').includes(g)) || (gorev || '').includes('Şef') || (gorev || '').includes('Şube Müdürü')) {
                baslangicDurumu = 'YAZICI_ONAYLADI'; 
            }
        }

        // 5. Kayıt
        const yeniTalep = await pool.query(
            `INSERT INTO izin_talepleri (personel_id, baslangic_tarihi, bitis_tarihi, kac_gun, izin_turu, aciklama, haftalik_izin_gunu, ise_baslama_tarihi, izin_adresi, personel_imza, durum, belge_yolu) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [asilPersonelId, dbBaslangic, dbBitis, kac_gun, izin_turu, aciklama, haftalik_izin, dbIseBaslama, izin_adresi, personel_imza, baslangicDurumu, belge_yolu]
        );
        
        // 6. Loglama
        const islemNotu = isIkOverride ? 'İK/Admin tarafından personel adına giriş yapıldı (Otomatik Onay).' : 'İzin talebi oluşturuldu.';
        await hareketKaydet(yeniTalep.rows[0].talep_id, islemYapanId, 'BAŞVURU', islemNotu);
        await logKaydet(islemYapanId, 'İZİN_TALEBİ', `Talep ID: ${yeniTalep.rows[0].talep_id} - Personel: ${ad} ${soyad}`, req);
        
        res.json({ mesaj: isIkOverride ? 'İzin başarıyla tanımlandı ve onaylandı.' : 'İzin talebi oluşturuldu', talep: yeniTalep.rows[0] });

    } catch (err) { console.error("HATA:", err); res.status(500).json({ mesaj: 'Hata oluştu: ' + err.message }); }
};

// İZİN LİSTELEME
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

// TALEP ONAYLAMA (GÜNCELLENDİ: RED SEBEBİ EKLENDİ)
exports.talepOnayla = async (req, res) => {
    const { talep_id, imza_data, yeni_durum, red_nedeni } = req.body; // ✅ red_nedeni eklendi
    const onaylayan_id = req.user.id;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // İmza varsa kaydet
        if (imza_data) {
            await client.query(`INSERT INTO imzalar (personel_id, imza_data, talep_id) VALUES ($1, $2, $3)`, [onaylayan_id, imza_data, talep_id]);
        }
        
        // Durumu güncelle
        await client.query(`UPDATE izin_talepleri SET durum = $1 WHERE talep_id = $2`, [yeni_durum, talep_id]);

        // Log Başlığı ve İçeriği Hazırla
        let islemBaslik = 'İŞLEM';
        let islemDetay = `Durum: ${yeni_durum}`;

        if (yeni_durum === 'AMIR_ONAYLADI') islemBaslik = 'AMİR ONAYI';
        else if (yeni_durum === 'YAZICI_ONAYLADI') islemBaslik = 'YAZICI ONAYI';
        else if (yeni_durum === 'IK_ONAYLADI') islemBaslik = 'İK ONAYI';
        else if (yeni_durum === 'REDDEDILDI') {
            islemBaslik = 'RED';
            // ✅ Eğer red nedeni varsa loga ekle
            if (red_nedeni) {
                islemDetay += ` - Açıklama: ${red_nedeni}`;
            }
        }

        // Hareketi (Logu) Kaydet
        await hareketKaydet(talep_id, onaylayan_id, islemBaslik, islemDetay);
        await logKaydet(onaylayan_id, 'İZİN_İŞLEMİ', `Talep ${talep_id} durumu: ${yeni_durum}`, req);

        // Bildirim Gönderimi
        const talepBilgi = await client.query("SELECT p.personel_id, p.ad, p.soyad, i.baslangic_tarihi FROM izin_talepleri i JOIN personeller p ON i.personel_id = p.personel_id WHERE i.talep_id = $1", [talep_id]);
        if (talepBilgi.rows.length > 0) {
            const p = talepBilgi.rows[0];
            const baslangicTarihi = tarihGoster(p.baslangic_tarihi);
            
            if (yeni_durum === 'IK_ONAYLADI') {
                const mesaj = `Sayın ${p.ad} ${p.soyad}, ${baslangicTarihi} tarihli izniniz onaylanmıştır. İzninizden 1 gün önce İK'ya gelip ıslak imza atınız.`;
                await client.query(`INSERT INTO bildirimler (personel_id, baslik, mesaj) VALUES ($1, $2, $3)`, [p.personel_id, '✅ Onaylandı (Islak İmza Gerekli)', mesaj]);
            } else if (yeni_durum === 'REDDEDILDI') {
                // Red mesajına sebebi de ekleyelim
                const redMesaji = red_nedeni ? `İzin talebiniz reddedildi. Sebep: ${red_nedeni}` : 'İzin talebiniz reddedildi.';
                await client.query(`INSERT INTO bildirimler (personel_id, baslik, mesaj) VALUES ($1, $2, $3)`, [p.personel_id, '❌ Reddedildi', redMesaji]);
            }
        }
        
        await client.query('COMMIT');
        res.json({ mesaj: 'İşlem tamamlandı.' });

    } catch (err) { 
        await client.query('ROLLBACK'); 
        console.error(err);
        res.status(500).json({ mesaj: 'Hata oluştu.' }); 
    } finally { 
        client.release(); 
    }
};

// RAPOR VERİSİ (FRONTEND İÇİN)
exports.izinDurumRaporu = async (req, res) => {
    if (!['admin', 'ik'].includes(req.user.rol)) return res.status(403).json({ mesaj: 'Yetkisiz' });
    try {
        const query = `
            SELECT 
                p.personel_id, 
                p.ad, 
                p.soyad, 
                p.tc_no, 
                p.ise_giris_tarihi, 
                p.dogum_tarihi, 
                p.ayrilma_tarihi, 
                p.aktif, 
                b.birim_adi, 
                (
                    SELECT COALESCE(SUM(gun_sayisi), 0) 
                    FROM izin_gecmis_bakiyeler 
                    WHERE personel_id = p.personel_id
                ) as devreden_izin, 
                COALESCE(SUM(it.kac_gun), 0) as bu_yil_kullanilan 
            FROM personeller p 
            LEFT JOIN birimler b ON p.birim_id = b.birim_id 
            LEFT JOIN izin_talepleri it ON p.personel_id = it.personel_id 
                AND it.durum IN ('IK_ONAYLADI', 'TAMAMLANDI') 
                AND it.izin_turu = 'YILLIK İZİN' 
                AND it.baslangic_tarihi >= date_trunc('year', CURRENT_DATE) 
            GROUP BY p.personel_id, b.birim_adi, p.ad, p.soyad, p.tc_no, p.ise_giris_tarihi, p.dogum_tarihi, p.ayrilma_tarihi, p.aktif
            ORDER BY p.ad ASC`;
            
        const result = await pool.query(query);
        
        const rapor = await Promise.all(result.rows.map(async (p) => {
            const netKalan = await hesaplaBakiye(p.personel_id);
            const buYilHak = await hesaplaBuYil(p.personel_id);
            const kumulatif = await hesaplaKumulatif(p.ise_giris_tarihi, p.dogum_tarihi, p.ayrilma_tarihi, p.aktif);
            
            const devredenSayi = parseInt(p.devreden_izin) || 0;

            return { 
                ...p, 
                devreden_izin: devredenSayi,
                bu_yil_hakedis: buYilHak, 
                kalan: netKalan, 
                kumulatif_hak: kumulatif 
            };
        }));
        res.json(rapor);
    } catch (err) { 
        console.error(err);
        res.status(500).send('Rapor hatası'); 
    }
};

// ============================================================
// 🟢 MODAL İÇİN DETAY FONKSİYONU
// ============================================================
exports.getPersonelIzinDetay = async (req, res) => {
    const { id } = req.params; 
    try {
        const pRes = await pool.query(`SELECT p.*, b.birim_adi, r.rol_adi FROM personeller p LEFT JOIN birimler b ON p.birim_id = b.birim_id LEFT JOIN roller r ON p.rol_id = r.rol_id WHERE p.personel_id = $1`, [id]);
        if (pRes.rows.length === 0) return res.status(404).json({ mesaj: 'Personel bulunamadı' });
        
        const p = pRes.rows[0];
        
        // Geçmiş bakiyeler (Manuel eklenenler)
        const gecmisRes = await pool.query(`SELECT * FROM izin_gecmis_bakiyeler WHERE personel_id = $1 ORDER BY yil ASC`, [id]);
        // İzin talepleri
        const izinRes = await pool.query(`SELECT * FROM izin_talepleri WHERE personel_id = $1 AND durum IN ('IK_ONAYLADI', 'TAMAMLANDI') ORDER BY baslangic_tarihi DESC`, [id]);
        
        let toplamKullanilan = 0;
        izinRes.rows.forEach(izin => { if (izin.izin_turu === 'YILLIK İZİN') toplamKullanilan += parseInt(izin.kac_gun); });
        
        // Detaylı hesaplama
        const hakedisDetay = await hesaplaKumulatifDetayli(p.ise_giris_tarihi, p.dogum_tarihi, p.ayrilma_tarihi, p.aktif);
        
        let manuelToplam = 0;
        gecmisRes.rows.forEach(g => manuelToplam += parseInt(g.gun_sayisi));
        
        const netKalan = (hakedisDetay.toplam + manuelToplam) - toplamKullanilan;
        const buYilHak = await hesaplaBuYil(id);
        
        const personelVerisi = { 
            ...p, 
            kullanilan: toplamKullanilan, 
            kalan: netKalan, 
            bu_yil_hak: buYilHak,
            kumulatif_hak: hakedisDetay.toplam 
        };

        res.json({ 
            personel: personelVerisi, 
            gecmisBakiyeler: gecmisRes.rows, 
            izinler: izinRes.rows,
            hakedisListesi: hakedisDetay.liste 
        });

    } catch (e) { 
        console.error(e);
        res.status(500).json({ mesaj: 'Veri çekilemedi.' }); 
    }
};

// ... Diğer basit listeleme fonksiyonları ...
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
    try { const result = await pool.query(`SELECT h.*, p.ad, p.soyad, r.rol_adi FROM izin_hareketleri h JOIN personeller p ON h.islem_yapan_id = p.personel_id JOIN roller r ON p.rol_id = r.rol_id WHERE h.talep_id = $1 ORDER BY h.tarih ASC`, [req.params.talep_id]); res.json(result.rows); } catch (e) { res.status(500).send('Hata'); }
};

exports.getSystemLogs = async (req, res) => {
    try { const result = await pool.query(`SELECT l.*, p.ad, p.soyad, p.tc_no FROM sistem_loglari l LEFT JOIN personeller p ON l.personel_id = p.personel_id ORDER BY l.tarih DESC LIMIT 100`); res.json(result.rows); } catch (e) { res.status(500).send('Hata'); }
};

exports.personelListesi = async (req, res) => {
    try { const result = await pool.query(`SELECT p.*, b.birim_adi, r.rol_adi FROM personeller p LEFT JOIN birimler b ON p.birim_id = b.birim_id LEFT JOIN roller r ON p.rol_id = r.rol_id ORDER BY p.ad ASC`); res.json(result.rows); } catch (err) { res.status(500).json({ mesaj: 'Hata' }); }
};

// ============================================================
// ✅ YENİ: ONAYLI/ONAYSIZ İZİN SİLME (ADMİN/İK/FİLO)
// ============================================================
exports.talepSil = async (req, res) => {
    // 1. Yetki Kontrolü
    if (!['admin', 'ik', 'filo'].includes(req.user.rol)) {
        return res.status(403).json({ mesaj: 'Bu işlem için yetkiniz yok.' });
    }

    const { id } = req.params; // Silinecek talep ID

    try {
        // 2. Silme İşlemi (RETURNING * ile silinen veriyi alıyoruz)
        const result = await pool.query("DELETE FROM izin_talepleri WHERE talep_id = $1 RETURNING *", [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ mesaj: 'Talep bulunamadı.' });
        }

        // 3. Loglama
        const silinen = result.rows[0];
        await hareketKaydet(id, req.user.id, 'SİLME', `İzin silindi. (${silinen.kac_gun} Gün iade edildi)`);
        await logKaydet(req.user.id, 'İZİN_SİLME', `Talep ID: ${id} silindi. Personel ID: ${silinen.personel_id}`, req);

        res.json({ mesaj: 'İzin başarıyla silindi ve bakiye güncellendi.' });

    } catch (err) {
        console.error("Silme Hatası:", err);
        res.status(500).json({ mesaj: 'Silme işlemi sırasında hata oluştu.' });
    }
};

// ============================================================
// 📄 PDF ÇIKTILARI
// ============================================================

// 1. TOPLU PDF
exports.topluPdfRaporu = async (req, res) => {
    if (!['admin', 'ik', 'filo'].includes(req.user.rol)) return res.status(403).send('Yetkisiz işlem');

    try {
        const pRes = await pool.query(`SELECT p.*, b.birim_adi FROM personeller p LEFT JOIN birimler b ON p.birim_id = b.birim_id ORDER BY p.ad ASC`);
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
        const headers = ["Sıra", "TC No", "Ad Soyad", "Birim", "Giriş Tar.", "Kıdem", "Ömür Boyu", "Bu Yıl", "Toplam", "Kln.", "Durum"];

        doc.rect(startX, y, 770, 20).fill('#eee');
        doc.fillColor('#000').fontSize(9);
        let currentX = startX;
        headers.forEach((h, i) => { doc.text(h, currentX + 5, y + 6, { width: colWidths[i] }); currentX += colWidths[i]; });
        y += 25;

        for (let i = 0; i < personeller.length; i++) {
            const p = personeller[i];
            const kalan = await hesaplaBakiye(p.personel_id);
            const buYilHak = await hesaplaBuYil(p.personel_id);
            const omurBoyu = await hesaplaKumulatif(p.ise_giris_tarihi, p.dogum_tarihi, p.ayrilma_tarihi, p.aktif);

            const giris = new Date(p.ise_giris_tarihi);
            const kidem = isNaN(giris.getTime()) ? 0 : Math.floor((new Date() - giris) / (1000 * 60 * 60 * 24 * 365.25));

            let durumMetni = "NORMAL";
            let durumRenk = "#2ecc71"; 
            if(kalan < 0) { durumMetni = "LİMİT AŞIMI"; durumRenk = "#e74c3c"; }
            else if(kalan < 5) { durumMetni = "AZALDI"; durumRenk = "#f39c12"; }

            if (y > 500) { doc.addPage({ layout: 'landscape' }); y = 30; }
            if (i % 2 === 0) doc.rect(startX, y - 5, 770, 20).fill('#f9f9f9');
            
            doc.fillColor('#333').fontSize(8);
            let rowX = startX;
            const rowData = [
                (i + 1).toString(), 
                String(p.tc_no || '-'), 
                `${p.ad} ${p.soyad}`, 
                String(p.birim_adi || '-'), 
                tarihGoster(p.ise_giris_tarihi), 
                `${kidem} Yıl`, 
                omurBoyu.toString(), 
                buYilHak.toString(), 
                omurBoyu.toString(),
                kalan.toString(), 
                durumMetni
            ];

            rowData.forEach((data, index) => {
                if (index === 10) doc.fillColor(durumRenk).font(fs.existsSync(fontPath) ? 'TrFont' : 'Helvetica-Bold');
                else doc.fillColor('#333').font(fs.existsSync(fontPath) ? 'TrFont' : 'Helvetica');
                doc.text(String(data || '-'), rowX + 5, y, { width: colWidths[index] });
                rowX += colWidths[index];
            });
            y += 20;
        }
        doc.end();
    } catch (err) { console.error(err); res.status(500).send("PDF Hatası"); }
};
// ============================================================
// 🔄 İZİN GÜNCELLEME (ERKEN DÖNÜŞ / TARİH DEĞİŞİKLİĞİ)
// ============================================================
exports.talepGuncelle = async (req, res) => {
    // Sadece yetkili kişiler yapabilir
    if (!['admin', 'ik', 'filo'].includes(req.user.rol)) {
        return res.status(403).json({ mesaj: 'Bu işlem için yetkiniz yok.' });
    }

    const { talep_id, yeni_bitis_tarihi, yeni_gun_sayisi } = req.body;

    try {
        // 1. Mevcut izni bul
        const eskiTalepRes = await pool.query("SELECT * FROM izin_talepleri WHERE talep_id = $1", [talep_id]);
        if (eskiTalepRes.rows.length === 0) return res.status(404).json({ mesaj: 'Talep bulunamadı.' });
        
        const eskiTalep = eskiTalepRes.rows[0];
        const eskiGun = parseInt(eskiTalep.kac_gun);
        const yeniGun = parseInt(yeni_gun_sayisi);
        const iadeEdilecekGun = eskiGun - yeniGun;

        // 2. Güncelleme İşlemi
        await pool.query(
            "UPDATE izin_talepleri SET bitis_tarihi = $1, kac_gun = $2 WHERE talep_id = $3",
            [yeni_bitis_tarihi, yeniGun, talep_id]
        );

        // 3. Loglama
        const logMesaji = `İzin güncellendi. Eski: ${eskiGun} gün, Yeni: ${yeniGun} gün. (${iadeEdilecekGun} gün iade edildi)`;
        await hareketKaydet(talep_id, req.user.id, 'DÜZENLEME', logMesaji);
        await logKaydet(req.user.id, 'İZİN_GÜNCELLEME', `Talep ID: ${talep_id} güncellendi. Personel ID: ${eskiTalep.personel_id}`, req);

        res.json({ mesaj: 'İzin başarıyla güncellendi.', iade: iadeEdilecekGun });

    } catch (err) {
        console.error("Güncelleme Hatası:", err);
        res.status(500).json({ mesaj: 'Güncelleme sırasında hata oluştu.' });
    }
};
// 2. GANTT ŞEMASI İÇİN VERİ (PLANLAMA) - TARİH FORMATI FİXLENDİ 🚀
exports.getIzinPlani = async (req, res) => {
    try {
        const query = `
            SELECT 
                p.personel_id, 
                p.ad, 
                p.soyad, 
                p.birim_id, 
                b.birim_adi, 
                p.gorev,
                p.rol_id,
                p.unvan,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'talep_id', t.talep_id,
                            -- 🔥 TARİHLERİ METİN OLARAK ALIYORUZ (Saat farkını önler) 🔥
                            'baslangic_tarihi', TO_CHAR(t.baslangic_tarihi, 'YYYY-MM-DD'),
                            'bitis_tarihi', TO_CHAR(t.bitis_tarihi, 'YYYY-MM-DD'),
                            'durum', t.durum,
                            'izin_turu', t.izin_turu,
                            'gun_sayisi', t.kac_gun
                        )
                    ) FILTER (WHERE t.talep_id IS NOT NULL),
                    '[]'
                ) as izinler
            FROM personeller p
            LEFT JOIN birimler b ON p.birim_id = b.birim_id
            LEFT JOIN izin_talepleri t ON p.personel_id = t.personel_id 
                AND t.durum NOT IN ('REDDEDILDI', 'IPTAL_EDILDI') 
            WHERE p.aktif = TRUE 
              AND p.rol_id != 5  -- Admin Gizleme
            GROUP BY p.personel_id, p.ad, p.soyad, p.birim_id, b.birim_adi, p.gorev, p.rol_id, p.unvan
            ORDER BY b.birim_adi, p.ad ASC
        `;

        const result = await pool.query(query);
        res.json(result.rows);

    } catch (err) {
        console.error("Planlama Hatası:", err);
        res.status(500).json({ mesaj: 'Planlama verisi çekilemedi.' });
    }
};
// 3. KİŞİYE ÖZEL DETAYLI PDF
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

        const safeFilename = turkceKarakterTemizle(p.ad + '_' + p.soyad) + '_Detayli_Rapor.pdf';
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${safeFilename}`);
        doc.pipe(res);

        // --- 1. ÜST BİLGİ ---
        const photoX = 40; const photoY = 40; const photoW = 80; const photoH = 100;
        let photoFound = false;
        if (p.fotograf_yolu) {
            const relativePath = p.fotograf_yolu.replace(/\\/g, '/');
            const absolutePath = path.join(__dirname, '../../', relativePath);
            if (fs.existsSync(absolutePath)) {
                try {
                    doc.image(absolutePath, photoX, photoY, { width: photoW, height: photoH, fit: [photoW, photoH] });
                    doc.rect(photoX, photoY, photoW, photoH).stroke(); 
                    photoFound = true;
                } catch (err) { }
            }
        }
        if (!photoFound) {
            doc.rect(photoX, photoY, photoW, photoH).stroke();
            doc.text("FOTO", photoX + 25, photoY + 45);
        }

        const textStartX = 140;
        doc.fontSize(16).fillColor('#1a3c6e').text('MERSİN BÜYÜKŞEHİR BELEDİYESİ', textStartX, 50);
        doc.fontSize(12).fillColor('#555').text('TOPLU TAŞIMA ŞUBE MÜDÜRLÜĞÜ - PERSONEL İZİN DETAYI', textStartX, 70);
        doc.moveDown(4);

        // --- 2. PERSONEL BİLGİLERİ ---
        let y = doc.y + 20;
        doc.rect(40, y - 10, 515, 65).fill('#f8f9fa').stroke('#ddd');
        doc.fillColor('#000').fontSize(10);
        
        doc.text(`Adı Soyadı: ${p.ad} ${p.soyad}`, 50, y); 
        doc.text(`TC Kimlik No: ${String(p.tc_no || '-')}`, 300, y); y+=20;
        doc.text(`Sicil No: ${String(p.sicil_no || '-')}`, 50, y); 
        doc.text(`Birim: ${String(p.birim_adi || '-')}`, 300, y); y+=20;
        doc.text(`Kadro: ${String(p.kadro_tipi || '-')}`, 50, y); 
        doc.text(`İşe Giriş: ${tarihGoster(p.ise_giris_tarihi)}`, 300, y);
        doc.y = y + 40;

        // --- 3. BAKİYE ÖZETİ ---
        const kumulatifHak = await hesaplaKumulatif(p.ise_giris_tarihi, p.dogum_tarihi, p.ayrilma_tarihi, p.aktif);
        
        let manuelGecmis = 0;
        gRes.rows.forEach(g => manuelGecmis += parseInt(g.gun_sayisi) || 0);

        let toplamKullanilan = 0;
        iRes.rows.forEach(iz => { if(iz.izin_turu === 'YILLIK İZİN') toplamKullanilan += parseInt(iz.kac_gun) || 0; });

        const kalanIzin = (kumulatifHak + manuelGecmis) - toplamKullanilan;

        doc.fontSize(12).fillColor('#1a3c6e').text('BAKİYE ÖZETİ (Ömür Boyu)', { underline: false });
        doc.rect(40, doc.y + 5, 515, 2).fill('#1a3c6e');
        doc.moveDown(1);
        const ozetY = doc.y;
        doc.fontSize(11).fillColor('#000');
        
        doc.text(`• Otomatik Hakediş (Ömür Boyu):`, 50, ozetY);
        doc.font(fs.existsSync(fontPath) ? 'TrFont' : 'Helvetica-Bold').text(`${kumulatifHak} Gün`, 250, ozetY);
        doc.font(fs.existsSync(fontPath) ? 'TrFont' : 'Helvetica');

        if(manuelGecmis !== 0) {
            doc.text(`• Manuel Eklenen / Devreden:`, 50, ozetY + 20);
            doc.fillColor('#f39c12').text(`+ ${manuelGecmis} Gün`, 250, ozetY + 20);
            doc.fillColor('#000');
        }

        doc.text(`• Toplam Kullanılan:`, 50, ozetY + 40);
        doc.fillColor('#c0392b').text(`- ${toplamKullanilan} Gün`, 250, ozetY + 40);

        doc.rect(40, ozetY + 65, 515, 30).fill(kalanIzin < 0 ? '#fadbd8' : '#d4efdf');
        doc.fillColor('#000').fontSize(12).font(fs.existsSync(fontPath) ? 'TrFont' : 'Helvetica-Bold');
        doc.text(`KALAN BAKİYE: ${kalanIzin} Gün`, 50, ozetY + 73, { align: 'center', width: 515 });
        doc.font(fs.existsSync(fontPath) ? 'TrFont' : 'Helvetica');

        doc.moveDown(5);

        // --- 4. İZİN HAREKETLERİ LİSTESİ ---
        doc.fontSize(12).fillColor('#000').text('GEÇMİŞ İZİN HAREKETLERİ', 40, doc.y);
        doc.moveDown(0.5);

        let tableY = doc.y;
        doc.rect(40, tableY, 515, 20).fill('#2c3e50');
        doc.fillColor('#fff').fontSize(9);
        doc.text("İzin Türü", 50, tableY + 6); 
        doc.text("Başlangıç", 200, tableY + 6); 
        doc.text("Bitiş", 300, tableY + 6);
        doc.text("Gün", 400, tableY + 6); 
        doc.text("Durum", 480, tableY + 6);
        
        tableY += 20;
        doc.fillColor('#000');

        iRes.rows.forEach((iz, i) => {
            if (tableY > 750) { 
                doc.addPage(); 
                tableY = 40; 
                doc.rect(40, tableY, 515, 20).fill('#2c3e50');
                doc.fillColor('#fff');
                doc.text("İzin Türü", 50, tableY + 6); 
                doc.text("Başlangıç", 200, tableY + 6); 
                doc.text("Bitiş", 300, tableY + 6);
                doc.text("Gün", 400, tableY + 6); 
                doc.text("Durum", 480, tableY + 6);
                tableY += 20;
                doc.fillColor('#000');
            }

            if (i % 2 === 0) doc.rect(40, tableY, 515, 20).fill('#ecf0f1');
            
            const baslangic = tarihGoster(iz.baslangic_tarihi);
            const bitis = tarihGoster(iz.bitis_tarihi);

            doc.fillColor('#000');
            doc.text(String(iz.izin_turu || '-'), 50, tableY + 6);
            doc.text(baslangic, 200, tableY + 6);
            doc.text(bitis, 300, tableY + 6);
            doc.text(String(iz.kac_gun || 0), 400, tableY + 6);
            
            if(iz.durum === 'IK_ONAYLADI' || iz.durum === 'TAMAMLANDI') {
                doc.fillColor('#27ae60').text('ONAYLI', 480, tableY + 6);
            } else {
                doc.fillColor('#000').text(String(iz.durum), 480, tableY + 6);
            }
            
            tableY += 20;
        });

        doc.end();

    } catch (err) { console.error("PDF Hatası:", err); res.status(500).send("PDF Hatası"); }
};