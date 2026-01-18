const pool = require('../config/db');

// 1. Talepleri Listele
exports.talepleriGetir = async (req, res) => {
    try {
        const user = req.user || {};
        const personel_id = user.personel_id || user.id;
        const rol = user.rol ? user.rol.toLowerCase().trim() : 'personel';

        console.log(`📡 LİSTE İSTEĞİ -> ID: ${personel_id}, Rol: ${rol}`);

        let query = '';
        let params = [];

        // 🛑 YETKİLİLER (Admin, İK, Filo) -> HER ŞEYİ GÖRÜR
        if (['admin', 'ik', 'filo'].includes(rol)) {
            // HATA ÇÖZÜMÜ: p.rol veya p.rol_adi kaldırıldı. Sadece ad, soyad çekiyoruz.
            query = `
                SELECT t.*, 
                COALESCE(p.ad, 'Bilinmeyen') as gercek_ad, 
                COALESCE(p.soyad, '') as gercek_soyad
                FROM talep_destek t
                LEFT JOIN personeller p ON t.personel_id = p.personel_id
                ORDER BY 
                    CASE WHEN t.durum = 'AÇIK' THEN 1 
                         WHEN t.durum = 'YANITLANDI' THEN 2 
                         ELSE 3 END, 
                    t.son_guncelleme DESC`;
        } 
        // 👤 PERSONEL -> SADECE KENDİSİNİ GÖRÜR
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

        // 🔥 GÖRÜNÜM AYARLAMA 🔥
        const maskelenmisVeri = result.rows.map(item => {
            // Kendi talebimse
            if (item.personel_id == personel_id) {
                return { ...item, gorunen_ad: `${item.gercek_ad} ${item.gercek_soyad} (Siz)` };
            }
            // Adminsem -> Açık Gör
            if (rol === 'admin') {
                return { ...item, gorunen_ad: `${item.gercek_ad} ${item.gercek_soyad}` };
            }
            // İK/Filo isem -> Anonim Gör
            if (['ik', 'filo'].includes(rol)) {
                return { 
                    ...item, 
                    gorunen_ad: 'Personel (Anonim)',
                    gercek_ad: '***', 
                    gercek_soyad: '***' 
                };
            }
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
        // ID GARANTİSİ
        const gonderen_id = req.user.personel_id || req.user.id;

        if(!gonderen_id) return res.status(401).json({mesaj: 'Kimlik hatası: ID bulunamadı.'});
        if(!kvkk) return res.status(400).json({mesaj: 'KVKK onayı zorunludur.'});

        await client.query('BEGIN');

        const talepRes = await client.query(
            `INSERT INTO talep_destek (personel_id, tur, konu, kvkk_onay) VALUES ($1, $2, $3, $4) RETURNING id`,
            [gonderen_id, tur, konu, true]
        );
        const talepId = talepRes.rows[0].id;

        await client.query(
            `INSERT INTO talep_mesajlar (talep_id, gonderen_id, mesaj) VALUES ($1, $2, $3)`,
            [talepId, gonderen_id, mesaj]
        );

        await client.query('COMMIT');
        res.json({ mesaj: 'Talep oluşturuldu.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("KAYIT HATASI:", error);
        res.status(500).json({ error: 'Kayıt hatası' });
    } finally { client.release(); }
};

// 3. Detay ve Mesajları Getir (CHAT HİZALAMA BURADA DÜZELİR)
exports.talepDetay = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user || {};
        const myId = user.personel_id || user.id;
        const myRol = user.rol ? user.rol.toLowerCase().trim() : 'personel';

        // HATA ÇÖZÜMÜ: p.rol_adi sorgudan kaldırıldı.
        const msjRes = await pool.query(
            `SELECT tm.*, p.ad, p.soyad 
             FROM talep_mesajlar tm
             LEFT JOIN personeller p ON tm.gonderen_id = p.personel_id
             WHERE tm.talep_id = $1
             ORDER BY tm.gonderim_tarihi ASC`, [id]
        );

        const mesajlar = msjRes.rows.map(m => {
            // 🛠️ HİZALAMA DÜZELTMESİ: == kullanıldı (String '4' ile Number 4 eşit sayılır)
            if (m.gonderen_id == myId) {
                return { ...m, taraf: 'me', gorunen_isim: 'Siz' };
            }
            
            // Karşı tarafın kim olduğunu rolden anlayamayız (sütun yok), o yüzden mantık yürütüyoruz:
            // Eğer ben Personelsem -> Karşı taraf Yetkilidir.
            if (myRol === 'personel') {
                return { ...m, taraf: 'other', gorunen_isim: 'Yetkili' };
            }
            
            // Eğer ben Yetkiliysem (Admin/İK) -> Karşı taraf Personeldir.
            // Admin isem adını gör, değilsem Anonim.
            if (myRol === 'admin') {
                return { ...m, taraf: 'other', gorunen_isim: `${m.ad || ''} ${m.soyad || ''}` };
            } else {
                return { ...m, taraf: 'other', gorunen_isim: 'Personel (Anonim)' };
            }
        });

        res.json(mesajlar);
    } catch (error) { 
        console.error("DETAY HATASI:", error);
        res.status(500).json({ error: 'Detay hatası' }); 
    }
};

// 4. Cevap Yaz
exports.cevapYaz = async (req, res) => {
    try {
        const { talep_id, mesaj, yeni_durum } = req.body;
        const gonderen_id = req.user.personel_id || req.user.id;

        if (!gonderen_id) return res.status(401).json({mesaj: 'Oturum hatası.'});

        await pool.query(
            `INSERT INTO talep_mesajlar (talep_id, gonderen_id, mesaj) VALUES ($1, $2, $3)`,
            [talep_id, gonderen_id, mesaj]
        );

        if (yeni_durum) {
            await pool.query(`UPDATE talep_destek SET durum = $1, son_guncelleme = NOW() WHERE id = $2`, [yeni_durum, talep_id]);
        } else {
            await pool.query(`UPDATE talep_destek SET son_guncelleme = NOW() WHERE id = $1`, [talep_id]);
        }
        res.json({ mesaj: 'Gönderildi' });
    } catch (error) { 
        console.error("CEVAP HATASI:", error);
        res.status(500).json({ error: 'Hata' }); 
    }
};