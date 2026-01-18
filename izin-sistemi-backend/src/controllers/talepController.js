const pool = require('../config/db');

// 1. Talepleri Listele (Gelişmiş Görünürlük Ayarı)
exports.talepleriGetir = async (req, res) => {
    try {
        const user = req.user || {};
        const personel_id = user.personel_id || user.id;
        // Rol kontrolü: Büyük/küçük harf duyarlılığını kaldır
        const rol = user.rol ? user.rol.toLowerCase().trim() : 'personel';

        console.log(`📡 TALEP LİSTESİ İSTEĞİ -> ID: ${personel_id}, Rol: ${rol}`);

        let query = '';
        let params = [];

        // 🛑 DURUM 1: YETKİLİLER (Admin, İK, Filo)
        // Bunlar HERKESİN talebini görmeli.
        if (['admin', 'ik', 'filo'].includes(rol)) {
            console.log("✅ YETKİLİ GİRİŞİ: Tüm liste çekiliyor...");
            
            // WHERE koşulu YOK, herkesin talebi gelir.
            // p.rol_adi kullanıyoruz (veritabanı yapına göre)
            query = `
                SELECT t.*, 
                COALESCE(p.ad, 'Silinmiş') as gercek_ad, 
                COALESCE(p.soyad, 'Personel') as gercek_soyad,
                COALESCE(p.rol_adi, 'personel') as gonderen_rol
                FROM talep_destek t
                LEFT JOIN personeller p ON t.personel_id = p.personel_id
                ORDER BY 
                    CASE WHEN t.durum = 'AÇIK' THEN 1 
                         WHEN t.durum = 'YANITLANDI' THEN 2 
                         ELSE 3 END, 
                    t.son_guncelleme DESC`;
        } 
        // 👤 DURUM 2: STANDART PERSONEL
        // Sadece KENDİ taleplerini görmeli.
        else {
            console.log("👤 PERSONEL GİRİŞİ: Sadece kendi kayıtları.");
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
        console.log(`📊 Toplam ${result.rows.length} kayıt bulundu.`);

        // 🔥 GİZLİLİK VE MASKELEME MANTIĞI 🔥
        const maskelenmisVeri = result.rows.map(item => {
            
            // 1. Eğer talebi oluşturan BEN isem -> "Siz" olarak gör
            if (item.personel_id === personel_id) {
                return { ...item, gorunen_ad: `${item.gercek_ad} ${item.gercek_soyad} (Siz)` };
            }

            // 2. Eğer ben ADMIN isem -> Her şeyi ŞEFFAF gör
            if (rol === 'admin') {
                return { 
                    ...item, 
                    gorunen_ad: `${item.gercek_ad} ${item.gercek_soyad} (${item.gonderen_rol || 'Personel'})` 
                };
            }

            // 3. Eğer ben İK veya FİLO isem -> ANONİM gör
            if (['ik', 'filo'].includes(rol)) {
                return { 
                    ...item, 
                    gorunen_ad: 'Personel (Anonim)',
                    gercek_ad: '***', // Veriyi gizle
                    gercek_soyad: '***' 
                };
            }

            // Varsayılan
            return item;
        });

        res.json(maskelenmisVeri);

    } catch (error) {
        console.error("LİSTELEME HATASI:", error);
        res.status(500).json({ error: 'Listeleme hatası' });
    }
};

// 2. Yeni Talep Oluştur
exports.talepOlustur = async (req, res) => {
    const client = await pool.connect();
    try {
        const { tur, konu, mesaj, kvkk } = req.body;
        // ID kontrolü
        const gonderen_id = req.user.personel_id || req.user.id;

        if(!gonderen_id) return res.status(401).json({mesaj: 'Kimlik doğrulanamadı.'});
        if(!kvkk) return res.status(400).json({mesaj: 'KVKK onayı zorunludur.'});

        await client.query('BEGIN');

        // Talep Başlığı
        const talepRes = await client.query(
            `INSERT INTO talep_destek (personel_id, tur, konu, kvkk_onay) VALUES ($1, $2, $3, $4) RETURNING id`,
            [gonderen_id, tur, konu, true]
        );
        const talepId = talepRes.rows[0].id;

        // İlk Mesaj
        await client.query(
            `INSERT INTO talep_mesajlar (talep_id, gonderen_id, mesaj) VALUES ($1, $2, $3)`,
            [talepId, gonderen_id, mesaj]
        );

        await client.query('COMMIT');
        res.json({ mesaj: 'Talep başarıyla oluşturuldu.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("KAYIT HATASI:", error);
        res.status(500).json({ error: 'Kayıt hatası' });
    } finally { client.release(); }
};

// 3. Detay ve Mesajları Getir (Chat Geçmişi)
exports.talepDetay = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user || {};
        const myId = user.personel_id || user.id;
        const myRol = user.rol ? user.rol.toLowerCase().trim() : 'personel';

        // Mesajları getiren sorgu
        const msjRes = await pool.query(
            `SELECT tm.*, p.ad, p.soyad, p.rol_adi 
             FROM talep_mesajlar tm
             LEFT JOIN personeller p ON tm.gonderen_id = p.personel_id
             WHERE tm.talep_id = $1
             ORDER BY tm.gonderim_tarihi ASC`, [id]
        );

        const mesajlar = msjRes.rows.map(m => {
            // Mesajı BEN yazdıysam -> "Siz"
            if (m.gonderen_id === myId) {
                return { ...m, taraf: 'me', gorunen_isim: 'Siz' };
            }
            
            // Mesajı karşı taraf yazdıysa:
            
            // 1. Eğer mesajı yazan YETKİLİ (Admin/IK/Filo) ise -> "Yetkili" olarak görünür
            // (Not: Admin admin'i görsün mü? Şimdilik genel "Yetkili" yapalım)
            if (['admin', 'ik', 'filo'].includes(m.rol_adi)) {
                return { ...m, taraf: 'other', gorunen_isim: 'Yetkili' };
            }

            // 2. Eğer mesajı yazan PERSONEL ise:
            // Ben Adminsem -> Gerçek adını görürüm
            if (myRol === 'admin') {
                return { ...m, taraf: 'other', gorunen_isim: `${m.ad} ${m.soyad}` };
            }
            // Ben İK/Filo isem -> Anonim görürüm
            else {
                return { ...m, taraf: 'other', gorunen_isim: 'Personel (Anonim)' };
            }
        });

        res.json(mesajlar);
    } catch (error) { res.status(500).json({ error: 'Detay hatası' }); }
};

// 4. Cevap Yaz
exports.cevapYaz = async (req, res) => {
    try {
        const { talep_id, mesaj, yeni_durum } = req.body;
        const gonderen_id = req.user.personel_id || req.user.id;

        await pool.query(
            `INSERT INTO talep_mesajlar (talep_id, gonderen_id, mesaj) VALUES ($1, $2, $3)`,
            [talep_id, gonderen_id, mesaj]
        );

        // Eğer yetkili cevap yazıyorsa veya durumu değiştiriyorsa güncelle
        if (yeni_durum) {
            await pool.query(`UPDATE talep_destek SET durum = $1, son_guncelleme = NOW() WHERE id = $2`, [yeni_durum, talep_id]);
        } else {
            await pool.query(`UPDATE talep_destek SET son_guncelleme = NOW() WHERE id = $1`, [talep_id]);
        }
        res.json({ mesaj: 'Gönderildi' });
    } catch (error) { res.status(500).json({ error: 'Hata' }); }
};