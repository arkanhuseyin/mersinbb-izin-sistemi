const pool = require('../config/db');
const { logKaydet, hareketKaydet } = require('../utils/logger');

// ✅ YENİ: Dinamik Hakediş Hesaplama Modülünü Çağır
const dinamikHakedisHesapla = require('../utils/hakedisHesapla'); 

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

// ❌ ESKİ MATRİS VE HESAPLAMA FONKSİYONLARI SİLİNDİ
// (HAKEDIS_MATRISI ve getYillikHakedis artık yok, hakedisHesapla.js kullanılıyor)

// 4. Yıllık İzin Bakiyesi Hesapla (GÜNCELLENDİ)
const hesaplaBakiye = async (personel_id) => {
    // A. Manuel Eklenen Geçmiş Yılların Toplamını Çek
    const gecmisRes = await pool.query("SELECT COALESCE(SUM(gun_sayisi), 0) as toplam_gecmis FROM izin_gecmis_bakiyeler WHERE personel_id = $1", [personel_id]);
    const devredenToplam = parseInt(gecmisRes.rows[0].toplam_gecmis);

    // B. Bu Yıl Hakediş (✅ ARTIK BURASI DİNAMİK - VERİTABANINDAN)
    const buYilHakedis = await dinamikHakedisHesapla(personel_id);

    // C. Bu Yıl Kullanılan (Onaylı) İzinler
    const uRes = await pool.query(`
        SELECT COALESCE(SUM(kac_gun), 0) as used 
        FROM izin_talepleri 
        WHERE personel_id = $1 
        AND izin_turu = 'YILLIK İZİN' 
        AND durum IN ('IK_ONAYLADI', 'TAMAMLANDI') 
    `, [personel_id]); 

    const toplamKullanilan = parseInt(uRes.rows[0].used);
    
    // D. Sonuç
    const totalBalance = (devredenToplam + buYilHakedis) - toplamKullanilan;
    return totalBalance;
};

// ============================================================
// 🚀 GEÇMİŞ BAKİYE YÖNETİMİ
// ============================================================

// A. Geçmiş Bakiye Ekle
exports.gecmisBakiyeEkle = async (req, res) => {
    const { personel_id, yil, gun_sayisi } = req.body;
    try {
        await pool.query('BEGIN');
        
        await pool.query(
            "INSERT INTO izin_gecmis_bakiyeler (personel_id, yil, gun_sayisi) VALUES ($1, $2, $3)",
            [personel_id, yil, gun_sayisi]
        );

        // Personel Tablosunu Güncelle (Cache mantığı)
        const sumRes = await pool.query("SELECT COALESCE(SUM(gun_sayisi), 0) as toplam FROM izin_gecmis_bakiyeler WHERE personel_id = $1", [personel_id]);
        const yeniDevreden = parseInt(sumRes.rows[0].toplam);
        await pool.query("UPDATE personeller SET devreden_izin = $1 WHERE personel_id = $2", [yeniDevreden, personel_id]);

        await pool.query('COMMIT');
        res.json({ mesaj: 'Geçmiş bakiye başarıyla eklendi.' });
    } catch (e) {
        await pool.query('ROLLBACK');
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

// 1. PERSONEL LİSTESİ
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

// 2. YENİ İZİN TALEBİ OLUŞTUR (BAKİYE KONTROLLÜ)
exports.talepOlustur = async (req, res) => {
    let { 
        baslangic_tarihi, bitis_tarihi, kac_gun, izin_turu, aciklama, 
        haftalik_izin, ise_baslama, izin_adresi, personel_imza 
    } = req.body;
    
    const belge_yolu = req.file ? req.file.path : null;
    const personel_id = req.user.id; 
    
    try {
        const pRes = await pool.query("SELECT ad, soyad, rol_id, gorev FROM personeller WHERE personel_id = $1", [personel_id]);
        const { ad, soyad, rol_id, gorev } = pRes.rows[0];
        const userRoleInfo = await pool.query("SELECT rol_adi FROM roller WHERE rol_id = $1", [rol_id]);
        const userRole = userRoleInfo.rows[0].rol_adi.toLowerCase();
        const userGorev = gorev || '';

        // Bakiye Kontrolü
        if (izin_turu === 'YILLIK İZİN') {
            const kalanHak = await hesaplaBakiye(personel_id);
            const istenen = parseInt(kac_gun);
            if (istenen > kalanHak) {
                return res.status(400).json({ 
                    mesaj: `Sayın Personelimiz ${ad} ${soyad}, Kullanmak istediğiniz izin (${istenen} Gün), Mevcut izin (${kalanHak} Gün) hakkınızdan fazladır.` 
                });
            }
        }

        baslangic_tarihi = tarihFormatla(baslangic_tarihi);
        bitis_tarihi = tarihFormatla(bitis_tarihi);
        ise_baslama = tarihFormatla(ise_baslama);

        let baslangicDurumu = 'ONAY_BEKLIYOR'; 
        if (userRole === 'amir') baslangicDurumu = 'AMIR_ONAYLADI';
        else if (userRole === 'yazici') baslangicDurumu = 'YAZICI_ONAYLADI';
        if (userRole === 'ik') baslangicDurumu = 'YAZICI_ONAYLADI';

        // Yazıcı onayı gerektiren görevler
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

// 3. İZİNLERİ LİSTELE
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

// 4. TALEBİ ONAYLA
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

        let islemBaslik = 'İŞLEM';
        if (yeni_durum === 'AMIR_ONAYLADI') islemBaslik = 'AMİR ONAYI';
        else if (yeni_durum === 'YAZICI_ONAYLADI') islemBaslik = 'YAZICI ONAYI';
        else if (yeni_durum === 'IK_ONAYLADI') islemBaslik = 'İK ONAYI';
        else if (yeni_durum === 'REDDEDILDI') islemBaslik = 'RED';

        await hareketKaydet(talep_id, onaylayan_id, islemBaslik, `Durum: ${yeni_durum}`);
        await logKaydet(onaylayan_id, 'İZİN_İŞLEMİ', `Talep ${talep_id} durumu: ${yeni_durum}`, req);

        // Bildirim
        const talepBilgi = await client.query(
            "SELECT p.personel_id, p.ad, p.soyad, i.baslangic_tarihi FROM izin_talepleri i JOIN personeller p ON i.personel_id = p.personel_id WHERE i.talep_id = $1", 
            [talep_id]
        );
        
        if (talepBilgi.rows.length > 0) {
            const p = talepBilgi.rows[0];
            const baslangicTarihi = new Date(p.baslangic_tarihi).toLocaleDateString('tr-TR');

            if (yeni_durum === 'IK_ONAYLADI') {
                const mesaj = `Sayın Personelimiz ${p.ad} ${p.soyad}, ${baslangicTarihi} başlangıç tarihli izin talebiniz onaylanmıştır.\n\nDikkat : Yasal Prosedür gereği , izninizin başlayacağı tarihten 1 gün önce Personel İşleri (İK) birimine gelerek ISLAK İMZA atmanız gerekmektedir. ISLAK İMZAYA gelmediğiniz takdirde izin talebiniz iptal olacaktır.`;
                await client.query(`INSERT INTO bildirimler (personel_id, baslik, mesaj) VALUES ($1, $2, $3)`, [p.personel_id, '✅ Onaylandı (Islak İmza Gerekli)', mesaj]);
            }
            else if (yeni_durum === 'REDDEDILDI') {
                await client.query(`INSERT INTO bildirimler (personel_id, baslik, mesaj) VALUES ($1, $2, $3)`, [p.personel_id, '❌ Reddedildi', 'İzin talebiniz reddedildi.']);
            }
        }

        await client.query('COMMIT');
        res.json({ mesaj: 'İşlem tamamlandı.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ mesaj: 'Hata oluştu.' });
    } finally { client.release(); }
};

// 5. RAPORLAMA (GÜNCELLENDİ: Yeni Hesaplama Motoruyla)
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
            
            // Gerçek Devreden İzni Hesapla (Tablodan)
            const gRes = await pool.query("SELECT COALESCE(SUM(gun_sayisi), 0) as top FROM izin_gecmis_bakiyeler WHERE personel_id = $1", [p.personel_id]);
            const devreden = parseInt(gRes.rows[0].top);

            // ✅ YENİ: Dinamik Hakedişi Çek
            const buYilHak = await dinamikHakedisHesapla(p.personel_id);

            return { 
                ...p, 
                devreden_izin: devreden, // Doğru devreden izni göster
                bu_yil_hakedis: buYilHak, 
                kalan: netKalan, 
                uyari: netKalan > 40 
            };
        }));
        res.json(rapor);
    } catch (err) { res.status(500).send('Rapor hatası'); }
};

// 6. PERSONEL DETAYLI İZİN BİLGİSİ (Modal ve Rapor İçin - GÜNCELLENMİŞ)
exports.getPersonelIzinDetay = async (req, res) => {
    const { id } = req.params; 
    try {
        // A. Personel Temel Bilgileri
        const pRes = await pool.query(`
            SELECT p.*, b.birim_adi, r.rol_adi 
            FROM personeller p 
            LEFT JOIN birimler b ON p.birim_id = b.birim_id 
            LEFT JOIN roller r ON p.rol_id = r.rol_id
            WHERE p.personel_id = $1
        `, [id]);

        if (pRes.rows.length === 0) return res.status(404).json({ mesaj: 'Personel bulunamadı' });

        // B. Manuel Girilen Geçmiş Yıl Bakiyeleri
        const gecmisRes = await pool.query(`
            SELECT * FROM izin_gecmis_bakiyeler 
            WHERE personel_id = $1 
            ORDER BY yil ASC
        `, [id]);

        // C. Onaylanmış İzin Talepleri
        const izinRes = await pool.query(`
            SELECT * FROM izin_talepleri 
            WHERE personel_id = $1 
            AND durum IN ('IK_ONAYLADI', 'TAMAMLANDI')
            ORDER BY baslangic_tarihi ASC
        `, [id]);

        // --- HESAPLAMA KISMI ---
        let toplamKullanilan = 0;
        izinRes.rows.forEach(izin => {
            if (izin.izin_turu === 'YILLIK İZİN') {
                toplamKullanilan += parseInt(izin.kac_gun);
            }
        });

        // 2. Kalan Bakiyeyi Hesapla
        const netKalan = await hesaplaBakiye(id);
        
        const personelVerisi = {
            ...pRes.rows[0],
            kullanilan: toplamKullanilan, 
            kalan: netKalan
        };

        res.json({
            personel: personelVerisi,
            gecmisBakiyeler: gecmisRes.rows,
            izinler: izinRes.rows
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ mesaj: 'Veri çekilemedi.' });
    }
};

// 7. TOPLU VERİ (Excel Raporu İçin)
exports.tumPersonelDetayliVeri = async (req, res) => {
    if (!['admin', 'ik', 'filo'].includes(req.user.rol)) return res.status(403).json({ mesaj: 'Yetkisiz işlem' });

    try {
        const pRes = await pool.query(`SELECT p.personel_id, p.tc_no, p.ad, p.soyad, p.sicil_no, p.ise_giris_tarihi, p.kadro_tipi, b.birim_adi FROM personeller p LEFT JOIN birimler b ON p.birim_id = b.birim_id WHERE p.aktif = TRUE ORDER BY p.ad ASC`);
        const gRes = await pool.query(`SELECT * FROM izin_gecmis_bakiyeler ORDER BY yil ASC`);
        const iRes = await pool.query(`SELECT * FROM izin_talepleri WHERE durum IN ('IK_ONAYLADI', 'TAMAMLANDI') AND izin_turu = 'YILLIK İZİN'`);

        res.json({
            personeller: pRes.rows,
            gecmisBakiyeler: gRes.rows,
            izinler: iRes.rows
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ mesaj: 'Toplu veri çekilemedi.' });
    }
};

// --- ISLAK İMZA, TIMELINE, LOG vb. fonksiyonlar aynen kalabilir ---
exports.islakImzaDurumu = async (req, res) => {
    if (!['admin', 'ik'].includes(req.user.rol)) return res.status(403).json({ mesaj: 'Yetkisiz' });
    const { talep_id, durum } = req.body; 
    
    const client = await pool.connect(); 

    try {
        await client.query('BEGIN');

        const talepRes = await client.query(
            'SELECT t.personel_id, t.baslangic_tarihi, p.ad, p.soyad FROM izin_talepleri t JOIN personeller p ON t.personel_id = p.personel_id WHERE t.talep_id = $1', 
            [talep_id]
        );
        
        if(talepRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({mesaj: 'Bulunamadı'});
        }
        
        const p = talepRes.rows[0];
        const baslangicTarihi = new Date(p.baslangic_tarihi).toLocaleDateString('tr-TR');

        if (durum === 'GELDI') {
            await client.query("UPDATE izin_talepleri SET durum = 'TAMAMLANDI' WHERE talep_id = $1", [talep_id]);
            const mesaj = `Sayın Personelimiz ${p.ad} ${p.soyad}, ${baslangicTarihi} başlangıç tarihli izin talebiniz onaylanmıştır. İyi Tatiller.`;
            await client.query(`INSERT INTO bildirimler (personel_id, baslik, mesaj) VALUES ($1, $2, $3)`, [p.personel_id, '🎉 İyi Tatiller', mesaj]);
            await client.query('COMMIT');
            res.json({ mesaj: 'Personel izne ayrıldı.' });

        } else if (durum === 'GELMEDI') {
            await client.query("UPDATE izin_talepleri SET durum = 'IPTAL_EDILDI' WHERE talep_id = $1", [talep_id]);
            await client.query(`INSERT INTO bildirimler (personel_id, baslik, mesaj) VALUES ($1, $2, $3)`, [p.personel_id, '⚠️ İPTAL', 'Islak imzaya gelinmediği için izin talebiniz iptal edilmiştir.']);
            await client.query('COMMIT');
            res.json({ mesaj: 'İzin iptal edildi.' });
        }
    } catch (e) { 
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).send('Hata'); 
    } finally { client.release(); }
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