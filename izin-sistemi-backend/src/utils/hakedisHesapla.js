const pool = require('../config/db');

// --- İŞÇİ HAKEDİŞ KURALLARI (NETLEŞTİRİLMİŞ) ---
const getHakForYear = (hesapYili, kidemYili, yas, kurallar = []) => {
    
    // ✅ YENİ EKLENEN KURAL: 1 Yıl Şartı
    // Eğer personel 1 yılını doldurmamışsa (Kıdem < 1) kesinlikle hak kazanmaz.
    // Bu satır "Avans İzin" mantığını kapatır ve Excel formülüyle birebir eşleşir.
    if (kidemYili < 1) return 0;

    // 1. Veritabanı Kuralı (Varsa öncelikli)
    const uygunKural = kurallar.find(k => 
        hesapYili >= parseInt(k.baslangic_yili) && 
        hesapYili <= parseInt(k.bitis_yili) && 
        kidemYili >= parseInt(k.kidem_alt) && 
        kidemYili <= parseInt(k.kidem_ust)
    );
    if (uygunKural) return parseInt(uygunKural.gun_sayisi);

    let hak = 0;

    // --- DÖNEM 1: 2017 ve ÖNCESİ ---
    if (hesapYili <= 2017) {
        if (kidemYili < 5) hak = 14;      
        else if (kidemYili < 15) hak = 20; // 5. yıl dahil 20
        else hak = 26;
    } 
    // --- DÖNEM 2: 2018 ve 2019 ---
    else if (hesapYili <= 2019) {
        if (kidemYili < 5) hak = 16;
        else if (kidemYili < 15) hak = 22; 
        else hak = 26; 
    } 
    // --- DÖNEM 3: 2020 ve 2021 ---
    else if (hesapYili <= 2021) {
        if (kidemYili < 5) hak = 18; 
        else if (kidemYili < 15) hak = 25; 
        else hak = 30; 
    }
    // --- DÖNEM 4: 2022 ve 2023 ---
    else if (hesapYili <= 2023) {
        if (kidemYili < 5) hak = 18; 
        else if (kidemYili < 15) hak = 25; 
        // DİKKAT: 15. yılını dolduran (kidem 15) artık 30 almalı
        else hak = 30; 
    }
    // --- DÖNEM 5: 2024 ve SONRASI ---
    else {
        if (kidemYili <= 3) hak = 18;      
        else if (kidemYili < 15) hak = 27; 
        else hak = 32;
    }

    // --- İŞ 50 YAŞ KURALI ---
    // 50 yaş ve üstü çalışanların yıllık izni 20 günden az olamaz.
    if (yas >= 50 && hak < 20) hak = 20;

    return hak;
};

// --- ÖMÜR BOYU HAK HESAPLAMA (MATEMATİK DÜZELTİLDİ) ---
const hesaplaKumulatif = async (girisTarihi, dogumTarihi = null, ayrilmaTarihi = null, aktif = true) => {
    if (!girisTarihi) return 0;
    
    const giris = new Date(girisTarihi);
    const dogum = dogumTarihi ? new Date(dogumTarihi) : null;
    let bitisTarihi = new Date(); 
    if (!aktif && ayrilmaTarihi) bitisTarihi = new Date(ayrilmaTarihi);

    let toplamHak = 0;
    const kuralRes = await pool.query("SELECT * FROM hakedis_kurallari");
    const kurallar = kuralRes.rows;

    // Döngü: Giriş tarihinden başlar
    let hakedisTarihi = new Date(giris);

    while (hakedisTarihi <= bitisTarihi) {
        const hesapYili = hakedisTarihi.getFullYear();
        
        // 🛠️ DÜZELTME: Kıdem hesabı YIL FARKI ile yapılır.
        // Örn: Giriş 2024, Hesap Yılı 2024 -> Kıdem 0 -> Hak 0 (Yeni kural gereği)
        // Örn: Giriş 2024, Hesap Yılı 2025 -> Kıdem 1 -> Hak Var
        const oAnkiKidem = hesapYili - giris.getFullYear();
        
        let oAnkiYas = 0;
        if(dogum) oAnkiYas = hesapYili - dogum.getFullYear();

        // Kıdem negatif olamaz (Giriş yılından önceki yıllar hesaplanmaz)
        if (oAnkiKidem >= 0) {
            toplamHak += getHakForYear(hesapYili, oAnkiKidem, oAnkiYas, kurallar);
        }
        
        // Bir sonraki yıla geç
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
        
        let kidem = hesapYili - giris.getFullYear();
        
        // Bu yılki hak ediş gününü (yıldönümünü) henüz doldurmadıysa kıdemi 1 düşür
        const buYilDonum = new Date(hesapYili, giris.getMonth(), giris.getDate());
        if (bugun < buYilDonum) kidem--; 

        // Eğer henüz 1 yılını doldurmadıysa (Kidem < 1) -> 0 döner.
        if (kidem < 0) return 0;

        let yas = 0;
        if(p.dogum_tarihi) yas = hesapYili - new Date(p.dogum_tarihi).getFullYear();

        const kuralRes = await pool.query("SELECT * FROM hakedis_kurallari");
        
        // getHakForYear fonksiyonu artık (kidem < 1) kontrolünü içeriyor.
        return getHakForYear(hesapYili, kidem, yas, kuralRes.rows);
    } catch (e) { return 0; }
};

module.exports = {
    hesaplaBuYil,
    hesaplaKumulatif
};