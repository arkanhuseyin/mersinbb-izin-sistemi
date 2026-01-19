const pool = require('../config/db');

// ============================================================
// 1. İŞÇİ HAKEDİŞ KURALLARI (SENİN SENARYONA GÖRE GÜNCELLENDİ)
// ============================================================
const getHakForYear = (hesapYili, kidemYili, yas, kurallar = []) => {
    
    // ✅ 1 YIL ŞARTI
    // 1 yıl dolmadan izin hakkı doğmaz (09.02.2015 girişli biri 2015'te 0 alır).
    if (kidemYili < 1) return 0;

    // 1. Veritabanı Kuralı (Varsa veritabanındaki önceliklidir)
    const uygunKural = kurallar.find(k => 
        hesapYili >= parseInt(k.baslangic_yili) && 
        hesapYili <= parseInt(k.bitis_yili) && 
        kidemYili >= parseInt(k.kidem_alt) && 
        kidemYili <= parseInt(k.kidem_ust)
    );
    if (uygunKural) return parseInt(uygunKural.gun_sayisi);

    let hak = 0;

    // -------------------------------------------------------------
    // DÖNEM 1: 2018 ve ÖNCESİ (Eski Kurallar)
    // -------------------------------------------------------------
    // 1-5 yıl: 14 | 6-15 yıl: 20 | 15+ yıl: 25
    if (hesapYili <= 2018) {
        if (kidemYili <= 5) hak = 14;      
        else if (kidemYili < 16) hak = 20; // 6-15 yıl (15 dahil değil mi? Genelde 15. yıl dolunca artar, senin örneğinde 6-15 arası 20 demişsin)
        else hak = 25; // 16. yıl ve sonrası (Kıdem > 15)
    } 
    
    // -------------------------------------------------------------
    // DÖNEM 2: 2019 - 2024 ARASI (Ara Dönem)
    // -------------------------------------------------------------
    // 1-3 yıl: 16 | 4-5 yıl: 18 | 6-15 yıl: 25 | 15+ yıl: 30
    // Not: Senin hesabında 2024 yılında 9 yıllık kıdeme 25 gün verdin. 
    // Demek ki 2024 yılı hala bu gruba dahil.
    else if (hesapYili <= 2024) {
        if (kidemYili <= 3) hak = 16;
        else if (kidemYili <= 5) hak = 18; 
        else if (kidemYili < 16) hak = 25; // 6-15 yıl arası
        else hak = 30; // 15 yıldan fazla
    } 
    
    // -------------------------------------------------------------
    // DÖNEM 3: 2025 ve SONRASI (Yeni TİS)
    // -------------------------------------------------------------
    // 1-3 yıl: 18 | 4-5 yıl: 20 | 6-15 yıl: 27 | 15+ yıl: 32
    else {
        if (kidemYili <= 3) hak = 18;      
        else if (kidemYili <= 5) hak = 20; 
        else if (kidemYili < 16) hak = 27; // 6-15 yıl arası
        else hak = 32; // 15 yıldan fazla
    }

    // --- İŞ 50 YAŞ KURALI (Yasal Zorunluluk) ---
    // Eğer personel 50 yaş üstündeyse en az 20 gün almalı.
    // (Senin kuralların zaten yüksek ama yine de yasal alt sınır dursun)
    if (yas >= 50 && hak < 20) hak = 20;

    return hak;
};

// ============================================================
// 2. DETAYLI HESAPLAMA (LİSTE DÖNDÜRÜR)
// ============================================================
const hesaplaKumulatifDetayli = async (girisTarihi, dogumTarihi = null, ayrilmaTarihi = null, aktif = true) => {
    if (!girisTarihi) return { toplam: 0, liste: [] };
    
    const giris = new Date(girisTarihi);
    const dogum = dogumTarihi ? new Date(dogumTarihi) : null;
    let bitisTarihi = new Date(); 
    if (!aktif && ayrilmaTarihi) bitisTarihi = new Date(ayrilmaTarihi);

    let toplamHak = 0;
    let hakedisListesi = []; 

    const kuralRes = await pool.query("SELECT * FROM hakedis_kurallari");
    const kurallar = kuralRes.rows;

    let hakedisTarihi = new Date(giris);

    // Döngüye girmeden önce, işe girdiği ilk yıl için hak ediş hesaplanmaz (0. yıl).
    // Döngü her yılın "yıl dönümünde" çalışır.
    
    while (hakedisTarihi <= bitisTarihi) {
        const hesapYili = hakedisTarihi.getFullYear();
        const oAnkiKidem = hesapYili - giris.getFullYear();
        
        let oAnkiYas = 0;
        if(dogum) oAnkiYas = hesapYili - dogum.getFullYear();

        // Kıdem 0 ise (işe giriş yılı) 0 döner, listeye eklenmez veya 0 olarak eklenir.
        if (oAnkiKidem >= 0) {
            const buYilHak = getHakForYear(hesapYili, oAnkiKidem, oAnkiYas, kurallar);
            
            if (buYilHak > 0) {
                toplamHak += buYilHak;
                hakedisListesi.push({
                    yil: hesapYili,
                    kidem: oAnkiKidem,
                    yas: oAnkiYas > 0 ? oAnkiYas : '-',
                    hak: buYilHak
                });
            }
        }
        hakedisTarihi.setFullYear(hakedisTarihi.getFullYear() + 1);
    }
    
    return { toplam: toplamHak, liste: hakedisListesi.reverse() };
};

const hesaplaKumulatif = async (giris, dogum, ayrilma, aktif) => {
    const sonuc = await hesaplaKumulatifDetayli(giris, dogum, ayrilma, aktif);
    return sonuc.toplam;
};

const hesaplaBuYil = async (personel_id) => {
    try {
        const pRes = await pool.query("SELECT ise_giris_tarihi, dogum_tarihi, ayrilma_tarihi, aktif FROM personeller WHERE personel_id = $1", [personel_id]);
        if (pRes.rows.length === 0) return 0;
        const p = pRes.rows[0];
        
        if (!p.aktif && p.ayrilma_tarihi) return 0;

        const giris = new Date(p.ise_giris_tarihi);
        const bugun = new Date();
        const hesapYili = bugun.getFullYear();
        
        let kidem = hesapYili - giris.getFullYear();
        const buYilDonum = new Date(hesapYili, giris.getMonth(), giris.getDate());
        if (bugun < buYilDonum) kidem--; 

        if (kidem < 0) return 0;

        let yas = 0;
        if(p.dogum_tarihi) yas = hesapYili - new Date(p.dogum_tarihi).getFullYear();

        const kuralRes = await pool.query("SELECT * FROM hakedis_kurallari");
        return getHakForYear(hesapYili, kidem, yas, kuralRes.rows);
    } catch (e) { return 0; }
};

module.exports = {
    hesaplaBuYil,
    hesaplaKumulatif,
    hesaplaKumulatifDetayli
};