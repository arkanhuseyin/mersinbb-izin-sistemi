const pool = require('../config/db');

// --- ?? ?K KURALLARI (NETLE?T?R?LM??) ---
const getHakForYear = (hesapYili, kidemYili, yas, kurallar = []) => {
    // 1. Veritaban? Kural?
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
        if (kidemYili < 5) hak = 14;      
        else if (kidemYili < 15) hak = 20; // 5. y?l dahil 20
        else hak = 26;
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
        // D?KKAT: 15. y?l?n? dolduran (kidem 15) art?k 30 almal?
        else hak = 30; 
    }
    // --- DONEM 5: 2024 ve SONRASI ---
    else {
        if (kidemYili <= 3) hak = 18;      
        else if (kidemYili < 15) hak = 27; 
        else hak = 32;
    }

    // --- ?? 50 YA? KURALI ---
    if (yas >= 50 && hak < 20) hak = 20;

    return hak;
};

// --- OMUR BOYU HAK HESAPLAMA (MATEMAT?K DUZELT?LD?) ---
const hesaplaKumulatif = async (girisTarihi, dogumTarihi = null, ayrilmaTarihi = null, aktif = true) => {
    if (!girisTarihi) return 0;
    
    const giris = new Date(girisTarihi);
    const dogum = dogumTarihi ? new Date(dogumTarihi) : null;
    let bitisTarihi = new Date(); 
    if (!aktif && ayrilmaTarihi) bitisTarihi = new Date(ayrilmaTarihi);

    let toplamHak = 0;
    const kuralRes = await pool.query("SELECT * FROM hakedis_kurallari");
    const kurallar = kuralRes.rows;

    // Dongu: Giri? tarihinden ba?lar (?K Modu: 0. y?lda da hak verilir)
    let hakedisTarihi = new Date(giris);

    while (hakedisTarihi <= bitisTarihi) {
        const hesapYili = hakedisTarihi.getFullYear();
        
        // ?? DUZELTME BURADA: Millisaniye bolmesi yerine YIL FARKI kullan?yoruz.
        // Art?k 2012 - 2007 = 5 (Kesin Sonuc)
        const oAnkiKidem = hesapYili - giris.getFullYear();
        
        let oAnkiYas = 0;
        if(dogum) oAnkiYas = hesapYili - dogum.getFullYear();

        if (oAnkiKidem >= 0) {
            toplamHak += getHakForYear(hesapYili, oAnkiKidem, oAnkiYas, kurallar);
        }
        
        // Bir sonraki y?la gec
        hakedisTarihi.setFullYear(hakedisTarihi.getFullYear() + 1);
    }
    
    return toplamHak;
};

// --- BU YILIN HAKKI ---
const hesaplaBuYil = async (personel_id) => {
    try {
        const pRes = await pool.query("SELECT ise_giris_tarihi, dogum_tarihi, ayrilma_tarihi, aktif FROM personeller WHERE personel_id = $1", [personel_id]);
        if (pRes.rows.length === 0) return 0;
        const p = pRes.rows[0];
        
        if (!p.aktif && p.ayrilma_tarihi) return 0;

        const giris = new Date(p.ise_giris_tarihi);
        const bugun = new Date();
        const hesapYili = bugun.getFullYear();
        
        // ?? DUZELTME: K?dem hesab? burada da YIL FARKI ile
        let kidem = hesapYili - giris.getFullYear();
        
        // Ancak "Bu Y?l" gosterimi icin henuz gunu gelmediyse k?demi 1 du?ururuz
        // (Kumulatifte buna gerek yok cunku dongu zaten gunu gelince cal???yor)
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
    hesaplaKumulatif
};