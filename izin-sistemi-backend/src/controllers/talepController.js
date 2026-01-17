const pool = require('../config/db');

// 1. Talepleri Listele (Maskeleme Burada Yapılıyor)
exports.talepleriGetir = async (req, res) => {
    try {
        const { rol, personel_id } = req.user;
        let query = '';
        let params = [];

        // Eğer Admin, İK veya Filo ise -> HEPSİNİ GÖRÜR ama İsimler Maskelenir
        if (['admin', 'ik', 'filo'].includes(rol)) {
            query = `
                SELECT t.*, 
                p.ad as gercek_ad, p.soyad as gercek_soyad 
                FROM talep_destek t
                JOIN personeller p ON t.personel_id = p.personel_id
                ORDER BY t.son_guncelleme DESC`;
        } 
        // Eğer Personel ise -> SADECE KENDİSİNİ GÖRÜR
        else {
            query = `
                SELECT t.*, 
                p.ad as gercek_ad, p.soyad as gercek_soyad 
                FROM talep_destek t
                JOIN personeller p ON t.personel_id = p.personel_id
                WHERE t.personel_id = $1
                ORDER BY t.son_guncelleme DESC`;
            params = [personel_id];
        }

        const result = await pool.query(query, params);

        // 🔥 ANONİMLİK MANIPÜLASYONU 🔥
        const maskelenmisVeri = result.rows.map(item => {
            // Eğer bakan kişi talebin sahibiyse -> Gerçek ismini görsün
            if (item.personel_id === personel_id) {
                return { ...item, gorunen_ad: `${item.gercek_ad} ${item.gercek_soyad} (Siz)` };
            }
            // Eğer bakan kişi başkasıysa (Admin/İK) -> "Personel" görsün
            else {
                return { ...item, gorunen_ad: 'Personel (Anonim)', gercek_ad: null, gercek_soyad: null };
            }
        });

        res.json(maskelenmisVeri);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Listeleme hatası' });
    }
};

// 2. Yeni Talep Oluştur
exports.talepOlustur = async (req, res) => {
    const client = await pool.connect();
    try {
        const { tur, konu, mesaj, kvkk } = req.body;
        if(!kvkk) return res.status(400).json({mesaj: 'KVKK onayı zorunludur.'});

        await client.query('BEGIN');

        // Ana başlığı oluştur
        const talepRes = await client.query(
            `INSERT INTO talep_destek (personel_id, tur, konu, kvkk_onay) VALUES ($1, $2, $3, $4) RETURNING id`,
            [req.user.personel_id, tur, konu, true]
        );
        const talepId = talepRes.rows[0].id;

        // İlk mesajı ekle
        await client.query(
            `INSERT INTO talep_mesajlar (talep_id, gonderen_id, mesaj) VALUES ($1, $2, $3)`,
            [talepId, req.user.personel_id, mesaj]
        );

        await client.query('COMMIT');
        res.json({ mesaj: 'Talebiniz başarıyla iletildi.' });

    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Kayıt hatası' });
    } finally { client.release(); }
};

// 3. Detay ve Mesajları Getir
exports.talepDetay = async (req, res) => {
    try {
        const { id } = req.params;
        const msjRes = await pool.query(
            `SELECT tm.*, p.ad, p.soyad, p.rol 
             FROM talep_mesajlar tm
             JOIN personeller p ON tm.gonderen_id = p.personel_id
             WHERE tm.talep_id = $1
             ORDER BY tm.gonderim_tarihi ASC`, [id]
        );

        // Mesajlarda da isim gizleme yapılmalı
        const mesajlar = msjRes.rows.map(m => {
            if (m.gonderen_id === req.user.personel_id) {
                return { ...m, ad_soyad: 'Siz' };
            } else if (['admin','ik','filo','amir'].includes(m.rol)) {
                return { ...m, ad_soyad: 'Yetkili' }; // Cevaplayan yetkili
            } else {
                return { ...m, ad_soyad: 'Personel' }; // Karşı taraf personel ise
            }
        });

        res.json(mesajlar);
    } catch (error) { res.status(500).json({ error: 'Detay hatası' }); }
};

// 4. Cevap Yaz
exports.cevapYaz = async (req, res) => {
    try {
        const { talep_id, mesaj, yeni_durum } = req.body;
        
        await pool.query(
            `INSERT INTO talep_mesajlar (talep_id, gonderen_id, mesaj) VALUES ($1, $2, $3)`,
            [talep_id, req.user.personel_id, mesaj]
        );

        // Durumu güncelle (Örn: 'AÇIK' -> 'YANITLANDI')
        if (yeni_durum) {
            await pool.query(`UPDATE talep_destek SET durum = $1, son_guncelleme = NOW() WHERE id = $2`, [yeni_durum, talep_id]);
        } else {
            await pool.query(`UPDATE talep_destek SET son_guncelleme = NOW() WHERE id = $1`, [talep_id]);
        }

        res.json({ mesaj: 'Cevap gönderildi.' });
    } catch (error) { res.status(500).json({ error: 'Cevap hatası' }); }
};