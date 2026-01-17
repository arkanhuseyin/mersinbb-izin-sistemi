const pool = require('../config/db');

/**
 * ?? ?K TABLOSUNA GORE YILLIK ?Z?N HESAPLAMA MOTORU
 * * Bu fonksiyon, personelin o y?lki k?demine ve o y?l gecerli olan T?S (Toplu ?? Sozle?mesi) 
 * kurallar?na gore kac gun izin hak etti?ini bulur.
 * * @param {number} hesapYili - ?zin hakk?n?n kazan?ld??? y?l (Orn: 2024)
 * @param {number} kidemYili - Personelin o tarihteki k?dem y?l? (Orn: 5)
 * @param {number} yas - Personelin o tarihteki ya?? (50 ya? kural? icin)
 * @param {Array} kurallar - Veritaban?ndan gelen ozel kurallar (Opsiyonel)
 */
const getHakForYear = (hesapYili, kidemYili, yas, kurallar = []) => {
    // 1. Veritaban?ndaki Ozel Kural Var m?? (Admin panelinden eklenen)
    const uygunKural = kurallar.find(k => 
        hesapYili >= parseInt(k.baslangic_yili) && 
        hesapYili <= parseInt(k.bitis_yili) && 
        kidemYili >= parseInt(k.kidem_alt) && 
        kidemYili <= parseInt(k.kidem_ust)
    );
    if (uygunKural) return parseInt(uygunKural.gun_sayisi);

    // 2. ?K TABLOSU MANTI?I (HARDCODED RULES)
    let hak = 0;

    // --- DONEM 1: 2018 ONCES? (Eski Standart) ---
    if (hesapYili < 2018) {
        if (kidemYili <= 5) hak = 14; 
        else if (kidemYili <= 15) hak = 20; 
        else hak = 26;
    } 
    // --- DONEM 2: 2018 YILI (Geci? Y?l?) ---
    else if (hesapYili === 2018) {
        if (kidemYili <= 5) hak = 16;      // ?yile?tirme ba?lad?
        else if (kidemYili <= 15) hak = 22; 
        else hak = 26; // 15 y?l ustu sabit kald?
    }
    // --- DONEM 3: 2019 - 2021 ARASI ---
    else if (hesapYili < 2022) {
        if (kidemYili <= 3) hak = 16;      // ?lk 3 y?l
        else if (kidemYili <= 5) hak = 18; 
        else if (kidemYili <= 15) {
            // 2020 ve 2021'de 5-15 y?l aras? 25 gune c?kt? (Tabloda 2020 sutununa bak)
            if(hesapYili >= 2020) hak = 25; 
            else hak = 22; // 2019'da 22 idi
        }
        else hak = 30; // 15 y?l ustu art?k 30 gun
    } 
    // --- DONEM 4: 2022 ve 2023 ---
    else if (hesapYili < 2024) {
        // Tablonda 2022 sutununda 15 y?l ustu 30 gun olarak devam ediyor
        if (kidemYili <= 3) hak = 16;
        else if (kidemYili <= 5) hak = 18;
        else if (kidemYili <= 15) hak = 25;
        else hak = 30;
    }
    // --- DONEM 5: 2024 ve SONRASI (SON T?S) ---
    else {
        // 2024 Sutununa gore:
        if (kidemYili <= 3) hak = 18;      // Giri? seviyesi artt?
        else if (kidemYili <= 5) hak = 20;
        else if (kidemYili <= 15) hak = 27; // Orta kademe 27 oldu
        else hak = 32;                     // K?demliler 32 oldu
    }

    // --- ?? 50 YA? KURALI ---
    // ?? Kanunu: "50 ya? ve ustu cal??anlar?n y?ll?k izni 20 gunden az olamaz."
    if (yas >= 50 && hak < 20) {
        hak = 20;
    }

    return hak;
};

// --- BU YILIN HAKKINI HESAPLA ---
const hesaplaBuYil = async (personel_id) => {
    try {
        const pRes = await pool.query("SELECT ise_giris_tarihi, dogum_tarihi FROM personeller WHERE personel_id = $1", [personel_id]);
        if (pRes.rows.length === 0) return 0;
        
        const personel = pRes.rows[0];
        const giris = new Date(personel.ise_giris_tarihi);
        const dogum = personel.dogum_tarihi ? new Date(personel.dogum_tarihi) : null;
        
        const bugun = new Date();
        const hesapYili = bugun.getFullYear();
        
        // K?dem (Y?l Donumu Kontrolu ile)
        let kidem = hesapYili - giris.getFullYear();
        const buYilDonum = new Date(hesapYili, giris.getMonth(), giris.getDate());
        if (bugun < buYilDonum) kidem--; // Henuz y?l?n? doldurmad?

        if (kidem < 1) return 0;

        // Ya? Hesab?
        let yas = 0;
        if(dogum) {
            yas = hesapYili - dogum.getFullYear();
        }

        const kuralRes = await pool.query("SELECT * FROM hakedis_kurallari");
        return getHakForYear(hesapYili, kidem, yas, kuralRes.rows);

    } catch (e) { return 0; }
};

// --- OMUR BOYU HAK HESAPLA (Kumulatif) ---
// 2007 giri?li personel orne?inde 376 gunu bulacak olan fonksiyon budur.
const hesaplaKumulatif = async (girisTarihi, dogumTarihi = null) => {
    if (!girisTarihi) return 0;
    
    const giris = new Date(girisTarihi);
    const dogum = dogumTarihi ? new Date(dogumTarihi) : null;
    const bugun = new Date();
    
    let toplamHak = 0;

    // Veritaban? kurallar?n? bir kere cek
    const kuralRes = await pool.query("SELECT * FROM hakedis_kurallari");
    const kurallar = kuralRes.rows;

    // Dongu: ??e giri? tarihinden ba?la, her y?l donumunde hak ekle
    let currentCalcDate = new Date(giris);
    currentCalcDate.setFullYear(currentCalcDate.getFullYear() + 1); // 1. y?l doldu?unda hak kazan?l?r

    while (currentCalcDate <= bugun) {
        const hesapYili = currentCalcDate.getFullYear();
        
        // O tarihteki k?demi
        const oAnkiKidem = Math.floor((currentCalcDate - giris) / (1000 * 60 * 60 * 24 * 365.25));
        
        // O tarihteki ya??
        let oAnkiYas = 0;
        if(dogum) {
            oAnkiYas = hesapYili - dogum.getFullYear();
        }

        if (oAnkiKidem >= 1) {
            const hak = getHakForYear(hesapYili, oAnkiKidem, oAnkiYas, kurallar);
            toplamHak += hak;
        }
        
        // Bir sonraki y?la gec
        currentCalcDate.setFullYear(currentCalcDate.getFullYear() + 1);
    }
    return toplamHak;
};

// Geriye donuk uyumluluk
const dinamikHakedisHesapla = hesaplaBuYil;

module.exports = {
    hesaplaBuYil,
    hesaplaKumulatif,
    dinamikHakedisHesapla
};