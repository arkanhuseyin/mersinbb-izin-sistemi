const pool = require('../config/db');

// --- ?? ?K TABLOSUNA B?REB?R UYUMLU HESAPLAMA MOTORU ---
const getHakForYear = (hesapYili, kidemYili, yas, kurallar = []) => {
    // 1. Veritaban? Kural? (Varsa oncelikli)
    const uygunKural = kurallar.find(k => 
        hesapYili >= parseInt(k.baslangic_yili) && 
        hesapYili <= parseInt(k.bitis_yili) && 
        kidemYili >= parseInt(k.kidem_alt) && 
        kidemYili <= parseInt(k.kidem_ust)
    );
    if (uygunKural) return parseInt(uygunKural.gun_sayisi);

    let hak = 0;

    // --- DONEM 1: 2017 ve ONCES? ---
    if (hesapYili <= 2017) {
        if (kidemYili < 5) hak = 14;      // 0-4 y?l
        else if (kidemYili < 15) hak = 20; // 5-14 y?l (?K: 5. y?l dolunca 20)
        else hak = 26;                    // 15+ y?l
    } 
    // --- DONEM 2: 2018 ve 2019 ---
    else if (hesapYili <= 2019) {
        if (kidemYili < 5) hak = 16;
        else if (kidemYili < 15) hak = 22; 
        else hak = 26; 
    } 
    // --- DONEM 3: 2020 ve 2021 ---
    else if (hesapYili <= 2021) {
        if (kidemYili < 5) hak = 18; 
        else if (kidemYili < 15) hak = 25; 
        else hak = 30; 
    }
    // --- DONEM 4: 2022 ve 2023 ---
    else if (hesapYili <= 2023) {
        if (kidemYili < 5) hak = 18; 
        else if (kidemYili < 15) hak = 25; 
        else hak = 30; // 15 y?l ustu 30
    }
    // --- DONEM 5: 2024 ve SONRASI (HATA BURADAYDI) ---
    else {
        if (kidemYili <= 3) hak = 18;      
        else if (kidemYili < 15) hak = 27; // 4-14 y?l aras? 27
        else hak = 32;                     // 15 y?l ve ustu NET 32
    }

    // --- ?? 50 YA? KURALI ---
    if (yas >= 50 && hak < 20) {
        hak = 20;
    }

    return hak;
};

// --- OMUR BOYU HAK HESAPLAMA (?K MODU: G?R?? YILINDAN BA?LAR) ---
const hesaplaKumulatif = async (girisTarihi, dogumTarihi = null, ayrilmaTarihi = null, aktif = true) => {
    if (!girisTarihi) return 0;
    
    const giris = new Date(girisTarihi);
    const dogum = dogumTarihi ? new Date(dogumTarihi) : null;
    
    // Biti? Tarihi: Cal???yorsa BUGUN, ayr?ld?ysa AYRILMA TAR?H?
    let bitisTarihi = new Date(); 
    if (!aktif && ayrilmaTarihi) {
        bitisTarihi = new Date(ayrilmaTarihi);
    }

    let toplamHak = 0;
    const kuralRes = await pool.query("SELECT * FROM hakedis_kurallari");
    const kurallar = kuralRes.rows;

    // ?? KR?T?K AYAR: Donguyu direkt giri? tarihinden ba?lat?yoruz (?K Modu)
    // Boylece 0. y?lda (2007) da 14 gun veriyor.
    let hakedisTarihi = new Date(giris);

    // Dongu: Hakedi? tarihi bugunu (veya c?k?? tarihini) gecmedi?i surece devam et
    while (hakedisTarihi <= bitisTarihi) {
        const hesapYili = hakedisTarihi.getFullYear();
        
        // K?dem (Tam Y?l)
        const oAnkiKidem = Math.floor((hakedisTarihi - giris) / (1000 * 60 * 60 * 24 * 365.25));
        
        // Ya?
        let oAnkiYas = 0;
        if(dogum) oAnkiYas = hesapYili - dogum.getFullYear();

        // 0. y?ldan itibaren hak ver (?K iste?i)
        if (oAnkiKidem >= 0) {
            const hak = getHakForYear(hesapYili, oAnkiKidem, oAnkiYas, kurallar);
            toplamHak += hak;
        }
        
        // Bir sonraki y?la gec (Tam 1 y?l ekle)
        hakedisTarihi.setFullYear(hakedisTarihi.getFullYear() + 1);
    }
    
    return toplamHak;
};

// --- BU YILIN HAKKI (Arayuzde Gosterim ?cin) ---
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

        if (kidem < 0) return 0; // Negatif k?dem olamaz

        let yas = 0;
        if(p.dogum_tarihi) yas = hesapYili - new Date(p.dogum_tarihi).getFullYear();

        const kuralRes = await pool.query("SELECT * FROM hakedis_kurallari");
        return getHakForYear(hesapYili, kidem, yas, kuralRes.rows);
    } catch (e) { return 0; }
};

module.exports = {
    hesaplaBuYil,
    hesaplaKumulatif
};