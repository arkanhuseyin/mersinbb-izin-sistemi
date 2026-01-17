const pool = require('../config/db');

/**
 * ?? YILLIK HAK HESAPLAMA MOTORU (?K KURALLARI + 50 YA?)
 */
const getHakForYear = (hesapYili, kidemYili, yas, kurallar = []) => {
    // 1. Veritaban? Kural? (Varsa)
    const uygunKural = kurallar.find(k => 
        hesapYili >= parseInt(k.baslangic_yili) && 
        hesapYili <= parseInt(k.bitis_yili) && 
        kidemYili >= parseInt(k.kidem_alt) && 
        kidemYili <= parseInt(k.kidem_ust)
    );
    if (uygunKural) return parseInt(uygunKural.gun_sayisi);

    // 2. ?K TABLOSU (376 GUNU TUTTURAN NET MANTIK)
    let hak = 0;

    // --- DONEM 1: 2017 ve ONCES? (Eski Sistem) ---
    if (hesapYili <= 2017) {
        if (kidemYili <= 5) hak = 14; 
        else if (kidemYili <= 15) hak = 20; 
        else hak = 26;
    } 
    // --- DONEM 2: 2018 ve 2019 (Ara Donem) ---
    else if (hesapYili <= 2019) {
        if (kidemYili <= 5) hak = 16;
        else if (kidemYili <= 15) hak = 22; 
        else hak = 26; 
    } 
    // --- DONEM 3: 2020 ve 2021 (?yile?tirme) ---
    else if (hesapYili <= 2021) {
        if (kidemYili <= 5) hak = 18; 
        else if (kidemYili <= 15) hak = 25; 
        else hak = 30; 
    }
    // --- DONEM 4: 2022 ve 2023 (Sonraki ?yile?tirme) ---
    else if (hesapYili <= 2023) {
        if (kidemYili <= 5) hak = 18; 
        else if (kidemYili <= 15) hak = 25; 
        else hak = 30; // 15 y?l ustu 30 (Senin hesab?n burada 30 al?yordu)
    }
    // --- DONEM 5: 2024 ve SONRASI (En Yuksek - Son Durum) ---
    else {
        if (kidemYili <= 3) hak = 18;      // ?lk 3 y?l
        else if (kidemYili <= 5) hak = 20; // 4-5 y?l
        else if (kidemYili <= 15) hak = 27; // Orta kademe
        else hak = 32;                     // K?demliler (32 gun)
    }

    // --- ?? 50 YA? KURALI ---
    // Kural: "50 ya? ustu en az 20 gun al?r."
    // Yani hesaplanan hak 20'den kucukse (14, 16, 18) -> 20 yap.
    // Ama zaten 22, 25, 30, 32 al?yorsa -> DOKUNMA.
    if (yas >= 50 && hak < 20) {
        hak = 20;
    }

    return hak;
};

// --- OMUR BOYU HAK HESAPLAMA (GUN/AY KONTROLLU) ---
// Bu fonksiyon donguyu bugunun tarihine (veya ayr?lma tarihine) kadar cal??t?r?r.
const hesaplaKumulatif = async (girisTarihi, dogumTarihi = null, ayrilmaTarihi = null, aktif = true) => {
    if (!girisTarihi) return 0;
    
    const giris = new Date(girisTarihi);
    const dogum = dogumTarihi ? new Date(dogumTarihi) : null;
    
    // Biti? Tarihi: E?er cal???yorsa BUGUN, ayr?ld?ysa AYRILMA TAR?H?
    let bitisTarihi = new Date(); 
    if (!aktif && ayrilmaTarihi) {
        bitisTarihi = new Date(ayrilmaTarihi);
    }

    let toplamHak = 0;
    const kuralRes = await pool.query("SELECT * FROM hakedis_kurallari");
    const kurallar = kuralRes.rows;

    // Dongu Ba?lang?c?: Giri? tarihinden tam 1 y?l sonras? (?lk hakedi? gunu)
    // Orn: Giri? 07.02.2007 ise ilk hakedi? 07.02.2008
    let hakedisTarihi = new Date(giris);
    hakedisTarihi.setFullYear(hakedisTarihi.getFullYear() + 1);

    // DONGU: Hakedi? tarihi, referans tarihini (bugun/ayr?lma) gecmedi?i surece cal???r.
    // Yani 07.02.2025 tarihi bugunden ilerdeyse o donguye girmez ve 32 gunu eklemez.
    while (hakedisTarihi <= bitisTarihi) {
        const hesapYili = hakedisTarihi.getFullYear();
        
        // K?dem (Tam Y?l)
        const oAnkiKidem = Math.floor((hakedisTarihi - giris) / (1000 * 60 * 60 * 24 * 365.25));
        
        // O tarihteki ya??
        let oAnkiYas = 0;
        if(dogum) oAnkiYas = hesapYili - dogum.getFullYear();

        if (oAnkiKidem >= 1) {
            const hak = getHakForYear(hesapYili, oAnkiKidem, oAnkiYas, kurallar);
            toplamHak += hak;
        }
        
        // Bir sonraki y?la gec (Tam 1 y?l ekle)
        hakedisTarihi.setFullYear(hakedisTarihi.getFullYear() + 1);
    }
    
    return toplamHak;
};

// --- BU YILIN HAKKINI GET?R (GOSTER?M ?C?N) ---
const hesaplaBuYil = async (personel_id) => {
    try {
        const pRes = await pool.query("SELECT ise_giris_tarihi, dogum_tarihi FROM personeller WHERE personel_id = $1", [personel_id]);
        if (pRes.rows.length === 0) return 0;
        const p = pRes.rows[0];
        
        const giris = new Date(p.ise_giris_tarihi);
        const bugun = new Date();
        const hesapYili = bugun.getFullYear();
        let kidem = hesapYili - giris.getFullYear();
        const buYilDonum = new Date(hesapYili, giris.getMonth(), giris.getDate());
        if (bugun < buYilDonum) kidem--; // Henuz gun gelmediyse du?

        if (kidem < 1) return 0;

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