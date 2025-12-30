const pool = require('../config/db');
const { logKaydet, hareketKaydet } = require('../utils/logger');

// ============================================================
// 🛠️ YARDIMCI FONKSİYONLAR
// ============================================================

// 1. Tarih Formatı Düzeltici
const tarihFormatla = (tarihStr) => {
    if (!tarihStr) return null;
    if (tarihStr.includes('-')) return tarihStr;
    if (tarihStr.includes('.')) {
        const [gun, ay, yil] = tarihStr.split('.');
        return `${yil}-${ay}-${gun}`;
    }
    return tarihStr;
};

// 2. Yıllık İzin Hakediş Hesaplama (STANDART KURALLAR)
// 1-5 Yıl: 14 Gün | 6-14 Yıl: 20 Gün | 15 Yıl ve Üzeri: 26 Gün
const getYillikHakedis = (kidemYili) => {
    if (kidemYili < 1) return 0;       // 1 yıldan az
    if (kidemYili <= 5) return 14;     // 1-5 yıl arası
    if (kidemYili < 15) return 20;     // 6-14 yıl arası
    return 26;                         // 15 yıl ve üzeri
};

// 3. Yıllık İzin Bakiyesi Hesapla (HAFIZALI SİSTEM - YENİ)
const hesaplaBakiye = async (personel_id) => {
    // A. Personel bilgilerini çek
    const pRes = await pool.query("SELECT ise_giris_tarihi FROM personeller WHERE personel_id = $1", [personel_id]);
    if (pRes.rows.length === 0) return 0;
    
    const giris = new Date(pRes.rows[0].ise_giris_tarihi || '2024-01-01');
    const bugun = new Date();
    
    // B. Manuel Eklenen Geçmiş Yılların Toplamını Çek
    const gecmisRes = await pool.query("SELECT COALESCE(SUM(gun_sayisi), 0) as toplam_gecmis FROM izin_gecmis_bakiyeler WHERE personel_id = $1", [personel_id]);
    const devredenToplam = parseInt(gecmisRes.rows[0].toplam_gecmis);

    // C. Kıdem (Çalışılan Yıl) Hesabı
    const diffTime = Math.abs(bugun - giris);
    const kidemYili = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365.25)); 
    
    // D. Bu Yıl Hakedişi
    const buYilHakedis = getYillikHakedis(kidemYili);

    // E. Bu Yıl Kullanılan (Onaylı) İzinler
    const uRes = await pool.query(`
        SELECT COALESCE(SUM(kac_gun), 0) as used 
        FROM izin_talepleri 
        WHERE personel_id = $1 
        AND izin_turu = 'YILLIK İZİN' 
        AND durum IN ('IK_ONAYLADI', 'TAMAMLANDI') 
    `, [personel_id]); // Not: Artık tüm zamanların kullanılanını düşüyoruz çünkü devredenToplam kümülatif geliyor.

    const toplamKullanilan = parseInt(uRes.rows[0].used);
    
    // F. Sonuç: (Manuel Geçmişler + Bu Yıl Hakediş) - (Toplam Kullanılan)
    const totalBalance = (devredenToplam + buYilHakedis) - toplamKullanilan;
    return totalBalance;
};

// ============================================================
// 🚀 GEÇMİŞ BAKİYE YÖNETİMİ (YENİ EKLENENLER)
// ============================================================

// A. Geçmiş Bakiye Ekle
exports.gecmisBakiyeEkle = async (req, res) => {
    const { personel_id, yil, gun_sayisi } = req.body;
    try {
        await pool.query(
            "INSERT INTO izin_gecmis_bakiyeler (personel_id, yil, gun_sayisi) VALUES ($1, $2, $3)",
            [personel_id, yil, gun_sayisi]
        );
        res.json({ mesaj: 'Geçmiş bakiye başarıyla eklendi.' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ mesaj: 'Hata oluştu.' });
    }
};

// B. Geçmiş Bakiyeleri Listele
exports.gecmisBakiyeleriGetir = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query("SELECT * FROM izin_gecmis_bakiyeler WHERE personel_id = $1 ORDER BY yil ASC", [id]);
        res.json(result.rows);
    } catch (e) { res.status(500).json({ mesaj: 'Hata.' }); }
};

// C. Geçmiş Bakiye Sil
exports.gecmisBakiyeSil = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query("DELETE FROM izin_gecmis_bakiyeler WHERE id = $1", [id]);
        res.json({ mesaj: 'Silindi.' });
    } catch (e) { res.status(500).json({ mesaj: 'Hata.' }); }
};

// ============================================================
// 🚀 TEMEL İŞLEVLER
// ============================================================

// 1. YENİ İZİN TALEBİ OLUŞTUR
exports.talepOlustur = async (req, res) => {
    let { 
        baslangic_tarihi, bitis_tarihi, kac_gun, izin_turu, aciklama, 
        haftalik_izin, ise_baslama, izin_adresi, personel_imza 
    } = req.body;
    
    const belge_yolu = req.file ? req.file.path : null;
    const personel_id = req.user.id; 
    
    // Rol ve Görev Bilgisi
    const pRes = await pool.query("SELECT rol_id, gorev FROM personeller WHERE personel_id = $1", [personel_id]);
    const userRoleInfo = await pool.query("SELECT rol_adi FROM roller WHERE rol_id = $1", [pRes.rows[0].rol_id]);
    
    const userRole = userRoleInfo.rows[0].rol_adi.toLowerCase();
    const userGorev = pRes.rows[0].gorev || '';

    try {
        // Bakiye Kontrolü
        if (izin_turu === 'YILLIK İZİN') {
            const kalanHak = await hesaplaBakiye(personel_id);
            if (parseInt(kac_gun) > kalanHak) {
                return res.status(400).json({ 
                    mesaj: `Yetersiz Bakiye! Toplam kalan hakkınız: ${kalanHak} gün. Talep edilen: ${kac_gun} gün.` 
                });
            }
        }

        baslangic_tarihi = tarihFormatla(baslangic_tarihi);
        bitis_tarihi = tarihFormatla(bitis_tarihi);
        ise_baslama = tarihFormatla(ise_baslama);

        // --- ONAY MEKANİZMASI ---
        let baslangicDurumu = 'ONAY_BEKLIYOR'; 

        if (userRole === 'amir') {
            baslangicDurumu = 'AMIR_ONAYLADI';
        } else if (userRole === 'yazici') {
            baslangicDurumu = 'YAZICI_ONAYLADI';
        }

        // Ofis ve Üst Düzey Personel (Direkt İK)
        const ofisGorevleri = [
            'Memur', 'Büro Personeli', 'Genel Evrak', 'Muhasebe', 'Bilgisayar Mühendisi', 
            'Makine Mühendisi', 'Ulaştırma Mühendisi', 'Bilgisayar Teknikeri', 'Harita Teknikeri', 
            'Elektrik Teknikeri', 'Makine Teknikeri', 'Ulaştırma Teknikeri', 'Mersin 33 Kart', 
            'Lojistik', 'Saha Tespit ve İnceleme', 'Araç Takip Sistemleri', 'Yazı İşleri',
            'İnspektör', 'Hareket Görevlisi', 'Hareket Memuru', 'Dış Görev', 'İdari İzinli', 'Santral Operatörü',
            'Eğitim ve Disiplin İşleri', 'Saha Görevlisi', 'Düz İşçi (KHK)', 'Yol Kontrol Ekibi', 'Kaza Ekibi',
            'Yardımcı Hizmetler', 'Çıkış Görevlisi', 'Geçici İşçi', 'Usta', 'Kadrolu İşçi', 'Sürekli İşçi'
        ];
        
        if (ofisGorevleri.some(g => userGorev.includes(g)) || userGorev.includes('Şef') || userGorev.includes('Şube Müdürü')) {
            baslangicDurumu = 'YAZICI_ONAYLADI'; 
        }
        
        if (userRole === 'ik') {
            baslangicDurumu = 'YAZICI_ONAYLADI';
        }

        const yeniTalep = await pool.query(
            `INSERT INTO izin_talepleri 
            (personel_id, baslangic_tarihi, bitis_tarihi, kac_gun, izin_turu, aciklama, 
             haftalik_izin_gunu, ise_baslama_tarihi, izin_adresi, personel_imza, durum, belge_yolu) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [personel_id, baslangic_tarihi, bitis_tarihi, kac_gun, izin_turu, aciklama, 
             haftalik_izin, ise_baslama, izin_adresi, personel_imza, baslangicDurumu, belge_yolu]
        );
        
        const talepId = yeniTalep.rows[0].talep_id;

        await hareketKaydet(talepId, personel_id, 'BAŞVURU', 'İzin talebi oluşturuldu.');
        await logKaydet(personel_id, 'İZİN_TALEBİ', `Yeni talep oluşturdu. ID: ${talepId}`, req);

        res.json({ mesaj: 'İzin talebi başarıyla oluşturuldu', talep: yeniTalep.rows[0] });

    } catch (err) {
        console.error('İzin Oluşturma Hatası:', err);
        res.status(500).json({ mesaj: 'İzin oluşturulurken hata çıktı.' });
    }
};

// 2. İZİNLERİ LİSTELE
exports.izinleriGetir = async (req, res) => {
    try {
        let query = `SELECT t.*, p.ad, p.soyad, p.tc_no, p.birim_id, p.gorev FROM izin_talepleri t JOIN personeller p ON t.personel_id = p.personel_id`;
        let params = [];

        if (['admin', 'ik', 'filo'].includes(req.user.rol)) { 
            // Hepsini gör
        } else if (['amir', 'yazici'].includes(req.user.rol)) {
            query += ` WHERE p.birim_id = $1`;
            params.push(req.user.birim);
        } else {
            query += ` WHERE t.personel_id = $1`;
            params.push(req.user.id);
        }
        
        query += ` ORDER BY t.olusturma_tarihi DESC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ mesaj: 'Veri çekilemedi' }); }
};

// 3. TALEBİ ONAYLA
exports.talepOnayla = async (req, res) => {
    const { talep_id, imza_data, yeni_durum } = req.body;
    const onaylayan_id = req.user.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        if (imza_data) {
             await client.query(`INSERT INTO imzalar (personel_id, imza_data, talep_id) VALUES ($1, $2, $3)`, [onaylayan_id, imza_data, talep_id]);
        }

        await client.query(`UPDATE izin_talepleri SET durum = $1 WHERE talep_id = $2`, [yeni_durum, talep_id]);

        // Hareket Kaydı
        let islemBaslik = 'İŞLEM';
        if (yeni_durum === 'AMIR_ONAYLADI') islemBaslik = 'AMİR ONAYI';
        else if (yeni_durum === 'YAZICI_ONAYLADI') islemBaslik = 'YAZICI ONAYI';
        else if (yeni_durum === 'IK_ONAYLADI') islemBaslik = 'İK ONAYI';
        else if (yeni_durum === 'REDDEDILDI') islemBaslik = 'RED';

        await hareketKaydet(talep_id, onaylayan_id, islemBaslik, `Durum: ${yeni_durum}`);
        await logKaydet(onaylayan_id, 'İZİN_İŞLEMİ', `Talep ${talep_id} durumu: ${yeni_durum}`, req);

        // Bildirim
        if (yeni_durum === 'IK_ONAYLADI') {
            const tRes = await client.query('SELECT personel_id FROM izin_talepleri WHERE talep_id = $1', [talep_id]);
            await client.query(`INSERT INTO bildirimler (personel_id, baslik, mesaj) VALUES ($1, $2, $3)`, [tRes.rows[0].personel_id, '🚨 Onaylandı', 'Islak imza için İK\'ya geliniz.']);
        }
        else if (yeni_durum === 'REDDEDILDI') {
            const tRes = await client.query('SELECT personel_id FROM izin_talepleri WHERE talep_id = $1', [talep_id]);
            await client.query(`INSERT INTO bildirimler (personel_id, baslik, mesaj) VALUES ($1, $2, $3)`, [tRes.rows[0].personel_id, '❌ Reddedildi', 'İzin talebiniz reddedildi.']);
        }

        await client.query('COMMIT');
        res.json({ mesaj: 'İşlem tamamlandı.' });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ mesaj: 'Hata oluştu.' });
    } finally { client.release(); }
};

// 4. RAPORLAMA (GÜNCELLENDİ: Yeni Hesaplama Motoruyla)
exports.izinDurumRaporu = async (req, res) => {
    if (!['admin', 'ik'].includes(req.user.rol)) return res.status(403).json({ mesaj: 'Yetkisiz' });

    try {
        const query = `
            SELECT 
                p.personel_id, p.ad, p.soyad, p.tc_no, p.ise_giris_tarihi, p.devreden_izin, b.birim_adi,
                COALESCE(SUM(it.kac_gun), 0) as bu_yil_kullanilan
            FROM personeller p
            LEFT JOIN birimler b ON p.birim_id = b.birim_id
            LEFT JOIN izin_talepleri it ON p.personel_id = it.personel_id 
                AND it.durum IN ('IK_ONAYLADI', 'TAMAMLANDI')
                AND it.izin_turu = 'YILLIK İZİN'
                AND it.baslangic_tarihi >= date_trunc('year', CURRENT_DATE)
            WHERE p.aktif = TRUE
            GROUP BY p.personel_id, b.birim_adi, p.ad, p.soyad, p.tc_no, p.ise_giris_tarihi, p.devreden_izin
            ORDER BY p.ad ASC
        `;
        
        const result = await pool.query(query);
        const rapor = await Promise.all(result.rows.map(async (p) => {
            const netKalan = await hesaplaBakiye(p.personel_id);
            
            const giris = p.ise_giris_tarihi ? new Date(p.ise_giris_tarihi) : new Date();
            const kidem = Math.floor((new Date() - giris) / (1000 * 60 * 60 * 24 * 365.25));
            const buYilHak = getYillikHakedis(kidem);

            // Rapor tablosunda "Devreden" sütununda görünmesi için geçmiş toplamı çek
            const gRes = await pool.query("SELECT COALESCE(SUM(gun_sayisi), 0) as top FROM izin_gecmis_bakiyeler WHERE personel_id = $1", [p.personel_id]);
            const devreden = parseInt(gRes.rows[0].top);

            return { 
                ...p, 
                devreden_izin: devreden, // Veritabanındaki eski sütun yerine artık toplam geçmiş geliyor
                bu_yil_hakedis: buYilHak, 
                kalan: netKalan, 
                uyari: netKalan > 40 
            };
        }));
        res.json(rapor);
    } catch (err) { res.status(500).send('Rapor hatası'); }
};

// 5. ISLAK İMZA DURUMU
exports.islakImzaDurumu = async (req, res) => {
    if (!['admin', 'ik'].includes(req.user.rol)) return res.status(403).json({ mesaj: 'Yetkisiz' });
    const { talep_id, durum } = req.body; 
    try {
        const talepRes = await pool.query('SELECT personel_id FROM izin_talepleri WHERE talep_id = $1', [talep_id]);
        if(talepRes.rows.length === 0) return res.status(404).json({mesaj: 'Bulunamadı'});
        const pid = talepRes.rows[0].personel_id;

        if (durum === 'GELDI') {
            await pool.query("UPDATE izin_talepleri SET durum = 'TAMAMLANDI' WHERE talep_id = $1", [talep_id]);
            await pool.query(`INSERT INTO bildirimler (personel_id, baslik, mesaj) VALUES ($1, $2, $3)`, [pid, '✅ İşlem Tamamlandı', 'İşlemler tamamlandı.']);
            res.json({ mesaj: 'Personel izne ayrıldı.' });
        } else if (durum === 'GELMEDI') {
            await pool.query("UPDATE izin_talepleri SET durum = 'IPTAL_EDILDI' WHERE talep_id = $1", [talep_id]);
            await pool.query(`INSERT INTO bildirimler (personel_id, baslik, mesaj) VALUES ($1, $2, $3)`, [pid, '⚠️ İPTAL', 'Islak imzaya gelinmediği için iptal edildi.']);
            res.json({ mesaj: 'İzin iptal edildi.' });
        }
    } catch (e) { res.status(500).send('Hata'); }
};

// 6. LOG & TIMELINE
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
exports.getPersonelGecmis = async (req, res) => {
    const { tc_no } = req.query;
    try {
        const result = await pool.query(`SELECT t.*, p.ad, p.soyad, p.tc_no FROM izin_talepleri t JOIN personeller p ON t.personel_id = p.personel_id WHERE p.tc_no LIKE $1 ORDER BY t.olusturma_tarihi DESC`, [`%${tc_no}%`]);
        res.json(result.rows);
    } catch(e) { res.status(500).send('Hata'); }
};