const pool = require('../config/db');

// 1. Talepleri Listele
exports.talepleriGetir = async (req, res) => {
    try {
        // Kullanıcı bilgilerini güvenli al (ID sorunu çözümü)
        const user = req.user || {};
        const personel_id = user.personel_id || user.id; // ID veya personel_id hangisi varsa
        const rol = user.rol || 'personel';
        
        // Rolü güvenli hale getir
        const userRol = rol ? rol.toLowerCase().trim() : 'personel';

        console.log(`📡 TALEP LİSTESİ İSTENİYOR -> İsteyen ID: ${personel_id}, Rol: ${userRol}`);

        if (!personel_id) {
            console.error("❌ HATA: Kullanıcı ID'si (personel_id) bulunamadı! Token hatalı olabilir.");
            return res.status(401).json({ error: "Kimlik doğrulama hatası. ID bulunamadı." });
        }

        let query = '';
        let params = [];

        // 🛑 YETKİLİ KONTROLÜ (Admin, İK, Filo)
        if (['admin', 'ik', 'filo'].includes(userRol)) {
            // DÜZELTME: p.rol yerine p.rol_adi kullanıldı
            query = `
                SELECT t.*, 
                COALESCE(p.ad, 'Bilinmeyen') as gercek_ad, 
                COALESCE(p.soyad, 'Kullanıcı') as gercek_soyad, 
                p.rol_adi as gonderen_rol 
                FROM talep_destek t
                LEFT JOIN personeller p ON t.personel_id = p.personel_id
                ORDER BY t.son_guncelleme DESC`;
        } 
        // 👤 PERSONEL KONTROLÜ (Sadece Kendi Talepleri)
        else {
            query = `
                SELECT t.*, 
                p.ad as gercek_ad, p.soyad as gercek_soyad 
                FROM talep_destek t
                LEFT JOIN personeller p ON t.personel_id = p.personel_id
                WHERE t.personel_id = $1
                ORDER BY t.son_guncelleme DESC`;
            params = [personel_id];
        }

        const result = await pool.query(query, params);
        console.log(`✅ Veritabanından ${result.rows.length} adet talep çekildi.`);

        // 🔥 GÖRÜNÜM AYARLAMA (Anonimlik)
        const maskelenmisVeri = result.rows.map(item => {
            if (!item.personel_id) {
                return { ...item, gorunen_ad: 'Sistem Kaydı (No ID)' };
            }

            // Talebi oluşturan kişi kendisiyse
            if (item.personel_id === personel_id) {
                return { 
                    ...item, 
                    gorunen_ad: `${item.gercek_ad} ${item.gercek_soyad} (Siz)` 
                };
            }
            // Yetkili bakıyorsa
            else {
                return { 
                    ...item, 
                    gorunen_ad: 'Personel (Anonim)', 
                    gercek_ad: null, 
                    gercek_soyad: null 
                };
            }
        });

        res.json(maskelenmisVeri);

    } catch (error) {
        console.error("❌ LİSTELEME HATASI DETAYI:", error);
        // Hata column does not exist ise daha açıklayıcı ol
        if (error.code === '42703') {
             console.error("💡 İPUCU: Veritabanında 'rol' veya 'rol_adi' sütun isimlerini kontrol et.");
        }
        res.status(500).json({ error: 'Listeleme hatası' });
    }
};

// 2. Yeni Talep Oluştur
exports.talepOlustur = async (req, res) => {
    const client = await pool.connect();
    try {
        const { tur, konu, mesaj, kvkk } = req.body;
        
        // ID Çözümü
        const user = req.user || {};
        const gonderen_id = user.personel_id || user.id;

        console.log("📝 YENİ TALEP GELDİ:", { tur, konu, gonderen_id });

        if (!gonderen_id) {
            return res.status(401).json({ mesaj: 'Kullanıcı kimliği doğrulanamadı.' });
        }
        if(!kvkk) return res.status(400).json({mesaj: 'KVKK onayı zorunludur.'});
        if(!konu || !mesaj) return res.status(400).json({mesaj: 'Konu ve mesaj zorunludur.'});

        await client.query('BEGIN');

        // Ana Talep Kaydı
        const talepRes = await client.query(
            `INSERT INTO talep_destek (personel_id, tur, konu, kvkk_onay) VALUES ($1, $2, $3, $4) RETURNING id`,
            [gonderen_id, tur, konu, true]
        );
        const talepId = talepRes.rows[0].id;

        // İlk Mesaj Kaydı
        await client.query(
            `INSERT INTO talep_mesajlar (talep_id, gonderen_id, mesaj) VALUES ($1, $2, $3)`,
            [talepId, gonderen_id, mesaj]
        );

        await client.query('COMMIT');
        console.log(`✅ Talep oluşturuldu. ID: ${talepId}`);
        res.json({ mesaj: 'Talebiniz başarıyla iletildi.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ OLUŞTURMA HATASI:", error);
        res.status(500).json({ error: 'Kayıt sırasında hata oluştu.' });
    } finally { client.release(); }
};

// 3. Detay ve Mesajları Getir
exports.talepDetay = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user || {};
        const requestingUserId = user.personel_id || user.id;

        // DÜZELTME: p.rol yerine p.rol_adi
        const msjRes = await pool.query(
            `SELECT tm.*, p.ad, p.soyad, p.rol_adi as rol 
             FROM talep_mesajlar tm
             LEFT JOIN personeller p ON tm.gonderen_id = p.personel_id
             WHERE tm.talep_id = $1
             ORDER BY tm.gonderim_tarihi ASC`, [id]
        );

        const mesajlar = msjRes.rows.map(m => {
            if (m.gonderen_id === requestingUserId) {
                return { ...m, ad_soyad: 'Siz' };
            } else if (['admin','ik','filo'].includes(m.rol)) {
                return { ...m, ad_soyad: 'Yetkili' }; 
            } else {
                return { ...m, ad_soyad: 'Personel' }; 
            }
        });

        res.json(mesajlar);
    } catch (error) { 
        console.error("❌ DETAY HATASI:", error);
        res.status(500).json({ error: 'Detay hatası' }); 
    }
};

// 4. Cevap Yaz
exports.cevapYaz = async (req, res) => {
    try {
        const { talep_id, mesaj, yeni_durum } = req.body;
        const user = req.user || {};
        const gonderen_id = user.personel_id || user.id;
        
        if (!gonderen_id) return res.status(401).json({mesaj: 'Kimlik hatası'});

        await pool.query(
            `INSERT INTO talep_mesajlar (talep_id, gonderen_id, mesaj) VALUES ($1, $2, $3)`,
            [talep_id, gonderen_id, mesaj]
        );

        if (yeni_durum) {
            await pool.query(`UPDATE talep_destek SET durum = $1, son_guncelleme = NOW() WHERE id = $2`, [yeni_durum, talep_id]);
        } else {
            await pool.query(`UPDATE talep_destek SET son_guncelleme = NOW() WHERE id = $1`, [talep_id]);
        }

        console.log(`✉️ Cevap yazıldı. Talep ID: ${talep_id}`);
        res.json({ mesaj: 'Cevap gönderildi.' });
    } catch (error) { 
        console.error("❌ CEVAP HATASI:", error);
        res.status(500).json({ error: 'Cevap hatası' }); 
    }
};