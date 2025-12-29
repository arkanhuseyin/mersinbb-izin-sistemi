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

// 2. Yıllık İzin Bakiyesi Hesapla (HAFIZALI SİSTEM)
const hesaplaBakiye = async (personel_id) => {
    // Personelin giriş tarihini ve devreden iznini çek
    const pRes = await pool.query("SELECT ise_giris_tarihi, devreden_izin FROM personeller WHERE personel_id = $1", [personel_id]);
    if (pRes.rows.length === 0) return 0;
    
    const giris = new Date(pRes.rows[0].ise_giris_tarihi || '2024-01-01');
    const devreden = pRes.rows[0].devreden_izin || 0; 
    const bugun = new Date();
    
    // Kıdem Hesabı
    const workedYears = Math.floor((bugun - giris) / (1000 * 60 * 60 * 24 * 365));
    const startYear = giris.getFullYear();
    
    // Hakediş Hesabı (Mevzuat Kuralları)
    let buYilHakedis = 0;
    if (startYear < 2018) {
        if (workedYears < 1) buYilHakedis = 0; else if (workedYears <= 5) buYilHakedis = 14; else if (workedYears <= 15) buYilHakedis = 19; else buYilHakedis = 25;
    } else if (startYear < 2024) {
        if (workedYears < 1) buYilHakedis = 0; else if (startYear < 2019) { if (workedYears <= 5) buYilHakedis = 14; else if (workedYears <= 15) buYilHakedis = 19; else buYilHakedis = 25; } else { if (workedYears <= 3) buYilHakedis = 16; else if (workedYears <= 5) buYilHakedis = 18; else if (workedYears <= 15) buYilHakedis = 25; else buYilHakedis = 30; }
    } else { 
        if (workedYears < 1) buYilHakedis = 0; else if (startYear < 2025) { if (workedYears <= 3) buYilHakedis = 16; else if (workedYears <= 5) buYilHakedis = 18; else if (workedYears <= 15) buYilHakedis = 25; else buYilHakedis = 30; } else { if (workedYears <= 3) buYilHakedis = 18; else if (workedYears <= 5) buYilHakedis = 20; else if (workedYears <= 15) buYilHakedis = 27; else buYilHakedis = 32; }
    }

    // Bu Yıl Kullanılan İzinleri Çek
    const uRes = await pool.query(`
        SELECT COALESCE(SUM(kac_gun), 0) as used 
        FROM izin_talepleri 
        WHERE personel_id = $1 
        AND izin_turu = 'YILLIK İZİN' 
        AND durum IN ('IK_ONAYLADI', 'TAMAMLANDI') 
        AND baslangic_tarihi >= date_trunc('year', CURRENT_DATE)
    `, [personel_id]);

    const usedThisYear = parseInt(uRes.rows[0].used);
    
    // Toplam Bakiye = (Devreden + Hakediş) - Kullanılan
    const totalBalance = devreden + buYilHakedis;
    return totalBalance - usedThisYear;
};


// ============================================================
// 🚀 TEMEL İŞLEVLER
// ============================================================

// 1. YENİ İZİN TALEBİ OLUŞTUR (Hiyerarşik Onay Mantığı)
exports.talepOlustur = async (req, res) => {
    let { 
        baslangic_tarihi, bitis_tarihi, kac_gun, izin_turu, aciklama, 
        haftalik_izin, ise_baslama, izin_adresi, personel_imza 
    } = req.body;
    
    const belge_yolu = req.file ? req.file.path : null;
    const personel_id = req.user.id; 
    
    // Kullanıcı bilgilerini taze çek
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

        // --- HİYERARŞİK ONAY BAŞLANGIÇ DURUMU ---
        
        let baslangicDurumu = 'ONAY_BEKLIYOR'; // Varsayılan: En alt kademe (Amir onayı bekler)

        // 1. SENARYO: Saha Amirleri (Baş Şoför vb.) -> Yazıcıya düşer
        if (userRole === 'amir') {
            baslangicDurumu = 'AMIR_ONAYLADI';
        }
        
        // 2. SENARYO: Yazıcılar -> İK'ya düşer
        else if (userRole === 'yazici') {
            baslangicDurumu = 'YAZICI_ONAYLADI';
        }

        // 3. SENARYO: Ofis, Teknik, Şef, Müdür -> Direkt İK'ya düşer
        // Bu kişiler operasyonel amire (Baş Şoför) bağlı değildir.
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
            baslangicDurumu = 'YAZICI_ONAYLADI'; // 'YAZICI_ONAYLADI' statüsü, sistemde "Sıra İK'da" demektir.
        }

        // 4. SENARYO: İK Personeli -> Kendi havuzuna düşer
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

        // Rol bazlı filtreleme
        if (['admin', 'ik', 'filo'].includes(req.user.rol)) { 
            // Hepsini gör
        } else if (['amir', 'yazici'].includes(req.user.rol)) {
            // Sadece kendi birimindekileri gör
            query += ` WHERE p.birim_id = $1`;
            params.push(req.user.birim);
        } else {
            // Sadece kendini gör
            query += ` WHERE t.personel_id = $1`;
            params.push(req.user.id);
        }
        
        query += ` ORDER BY t.olusturma_tarihi DESC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ mesaj: 'Veri çekilemedi' }); }
};

// 3. TALEBİ ONAYLA / REDDET
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

        let islemBaslik = '';
        let aciklama = '';
        if (yeni_durum === 'AMIR_ONAYLADI') { islemBaslik = 'AMİR ONAYI'; aciklama = 'Amir tarafından onaylandı.'; }
        else if (yeni_durum === 'YAZICI_ONAYLADI') { islemBaslik = 'YAZICI ONAYI'; aciklama = 'Yazıcı tarafından onaylandı edildi.'; }
        else if (yeni_durum === 'IK_ONAYLADI') { islemBaslik = 'İK ONAYI'; aciklama = 'İK tarafından onaylandı (Süreç Tamamlandı).'; }
        else if (yeni_durum === 'REDDEDILDI') { islemBaslik = 'RED'; aciklama = 'Talep reddedildi.'; }

        await hareketKaydet(talep_id, onaylayan_id, islemBaslik, aciklama);
        await logKaydet(onaylayan_id, 'İZİN_İŞLEMİ', `Talep ${talep_id} durumu: ${yeni_durum}`, req);

        // Bildirim
        if (yeni_durum === 'IK_ONAYLADI') {
            const talepSonuc = await client.query('SELECT t.personel_id, t.baslangic_tarihi, p.ad, p.soyad FROM izin_talepleri t JOIN personeller p ON t.personel_id = p.personel_id WHERE t.talep_id = $1', [talep_id]);
            const pid = talepSonuc.rows[0].personel_id;
            const adSoyad = `${talepSonuc.rows[0].ad} ${talepSonuc.rows[0].soyad}`;
            const tarih = new Date(talepSonuc.rows[0].baslangic_tarihi).toLocaleDateString('tr-TR');
            const ozelMesaj = `Sayın ${adSoyad}, ${tarih} tarihli izniniz onaylanmıştır. İzninizden 1 gün önce İK'ya gelip ıslak imza atmanız gerekmektedir.`;
            await client.query(`INSERT INTO bildirimler (personel_id, baslik, mesaj) VALUES ($1, $2, $3)`, [pid, '🚨 Onay ve Islak İmza Çağrısı', ozelMesaj]);
        }
        else if (yeni_durum === 'REDDEDILDI') {
            const tRes = await client.query('SELECT personel_id FROM izin_talepleri WHERE talep_id = $1', [talep_id]);
            await client.query(`INSERT INTO bildirimler (personel_id, baslik, mesaj) VALUES ($1, $2, $3)`, [tRes.rows[0].personel_id, '❌ İzin Reddedildi', 'İzin talebiniz reddedilmiştir.']);
        }

        await client.query('COMMIT');
        res.json({ mesaj: 'İşlem tamamlandı.' });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ mesaj: 'Hata oluştu.' });
    } finally { client.release(); }
};

// 4. RAPORLAMA
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
            const giris = p.ise_giris_tarihi ? new Date(p.ise_giris_tarihi) : new Date('2024-01-01');
            const bugun = new Date();
            const workedYears = Math.floor((bugun - giris) / (1000 * 60 * 60 * 24 * 365));
            const startYear = giris.getFullYear();
            
            let buYilHakedis = 0;
            // (Hakediş hesaplama mantığı aynı kalır)
            if (startYear < 2018) {
                if (workedYears < 1) buYilHakedis = 0; else if (workedYears <= 5) buYilHakedis = 14; else if (workedYears <= 15) buYilHakedis = 19; else buYilHakedis = 25;
            } else { 
                if (workedYears < 1) buYilHakedis = 0; else if (startYear < 2025) { if (workedYears <= 3) buYilHakedis = 16; else if (workedYears <= 5) buYilHakedis = 18; else if (workedYears <= 15) buYilHakedis = 25; else buYilHakedis = 30; } else { if (workedYears <= 3) buYilHakedis = 18; else if (workedYears <= 5) buYilHakedis = 20; else if (workedYears <= 15) buYilHakedis = 27; else buYilHakedis = 32; }
            }

            const devreden = parseInt(p.devreden_izin) || 0;
            const kullanilan = parseInt(p.bu_yil_kullanilan) || 0;
            const toplamHavuz = devreden + buYilHakedis;
            const kalanNet = toplamHavuz - kullanilan;

            return { ...p, devreden_izin: devreden, bu_yil_hakedis: buYilHakedis, toplam_havuz: toplamHavuz, kullanilan: kullanilan, kalan: kalanNet, uyari: kalanNet > 40 };
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

// 6. TIMELINE ve LOGLAR
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