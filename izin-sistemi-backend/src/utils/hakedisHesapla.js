const pool = require('../config/db');

// --- T?S ve YASAL MANTIK MOTORU ---
// Bu fonksiyon belirli bir y?l ve k?deme gore kac gun hak edildi?ini soyler.
const getHakForYear = (hesapYili, kidemYili, kurallar = []) => {
    // 1. Once Veritaban?ndaki Ozel Kurala Bak
    const uygunKural = kurallar.find(k => 
        hesapYili >= parseInt(k.baslangic_yili) && 
        hesapYili <= parseInt(k.bitis_yili) && 
        kidemYili >= parseInt(k.kidem_alt) && 
        kidemYili <= parseInt(k.kidem_ust)
    );
    if (uygunKural) return parseInt(uygunKural.gun_sayisi);

    // 2. Kural Yoksa: T?S TAR?HCES? (TEK GERCEK KAYNAK BURASI)
    let hak = 0;

    // DONEM 1: 2018 ONCES? (Eski Sistem)
    if (hesapYili < 2018) {
        if (kidemYili <= 5) hak = 14; 
        else if (kidemYili <= 15) hak = 20; 
        else hak = 26;
    } 
    // DONEM 2: 2018 - 2023 ARASI (T?S 1 - ?yile?tirme)
    else if (hesapYili < 2024) {
        if (kidemYili <= 3) hak = 16;
        else if (kidemYili <= 5) hak = 18; 
        else if (kidemYili < 15) {
            // Ara donem iyile?tirmesi (2020 sonras? 22'den 25'e c?k?? gibi)
            if(hesapYili >= 2020) hak = 25; else hak = 22;
        }
        else hak = 30;
    } 
    // DONEM 3: 2024 VE SONRASI (T?S 2 - Son Durum)
    else {
        if (kidemYili <= 3) hak = 18;
        else if (kidemYili <= 5) hak = 20;
        else if (kidemYili < 15) hak = 27; 
        else hak = 32;
    }
    return hak;
};

// --- BU YILIN HAKKINI HESAPLA ---
const hesaplaBuYil = async (personel_id) => {
    try {
        const pRes = await pool.query("SELECT ise_giris_tarihi FROM personeller WHERE personel_id = $1", [personel_id]);
        if (pRes.rows.length === 0) return 0;
        
        const kuralRes = await pool.query("SELECT * FROM hakedis_kurallari");
        
        const giris = new Date(pRes.rows[0].ise_giris_tarihi);
        const bugun = new Date();
        const kidem = Math.floor((bugun - giris) / (1000 * 60 * 60 * 24 * 365.25));
        
        if (kidem < 1) return 0;
        
        return getHakForYear(bugun.getFullYear(), kidem, kuralRes.rows);
    } catch (e) { return 0; }
};

// --- OMUR BOYU HAK HESAPLA (Kumulatif) ---
const hesaplaKumulatif = async (girisTarihi) => {
    if (!girisTarihi) return 0;
    const giris = new Date(girisTarihi);
    const bugun = new Date();
    let toplamHak = 0;

    // Veritaban? kurallar?n? bir kere cek
    const kuralRes = await pool.query("SELECT * FROM hakedis_kurallari");
    const kurallar = kuralRes.rows;

    let currentCalcDate = new Date(giris);
    currentCalcDate.setFullYear(currentCalcDate.getFullYear() + 1); // 1. y?l dolunca ba?lar

    while (currentCalcDate <= bugun) {
        const hesapYili = currentCalcDate.getFullYear();
        const oAnkiKidem = Math.floor((currentCalcDate - giris) / (1000 * 60 * 60 * 24 * 365.25));

        if (oAnkiKidem >= 1) {
            toplamHak += getHakForYear(hesapYili, oAnkiKidem, kurallar);
        }
        currentCalcDate.setFullYear(currentCalcDate.getFullYear() + 1);
    }
    return toplamHak;
};

module.exports = {
    hesaplaBuYil,
    hesaplaKumulatif
};