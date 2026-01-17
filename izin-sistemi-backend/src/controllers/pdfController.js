const pool = require('../config/db');
const pdf = require('html-pdf-node');
const fs = require('fs');
const path = require('path');
// ✅ MERKEZİ HESAPLAMA MOTORU
const { hesaplaKumulatif } = require('../utils/hakedisHesapla');

// --- YARDIMCI: Resmi Base64'e Çevir ---
const resimOku = (dosyaAdi) => {
    try {
        const yol = path.join(__dirname, '../../templates', dosyaAdi);
        if (!fs.existsSync(yol)) return ''; 
        const bitmap = fs.readFileSync(yol);
        return `data:image/png;base64,${bitmap.toString('base64')}`;
    } catch (e) { return ''; }
};

// --- YARDIMCI: Tarih Formatla ---
const fmt = (t) => {
    if (!t) return '-';
    try {
        const d = new Date(t);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('tr-TR');
    } catch { return '-'; }
};

// ============================================================
// 🧠 FIFO MANTIĞI İLE İZNİN AİT OLDUĞU YILI BULMA
// ============================================================
const getIzninAitOlduguYilFIFO = async (personel_id, current_talep_id) => {
    try {
        const pRes = await pool.query("SELECT ise_giris_tarihi, dogum_tarihi, ayrilma_tarihi, aktif FROM personeller WHERE personel_id = $1", [personel_id]);
        if (pRes.rows.length === 0) return new Date().getFullYear();
        const p = pRes.rows[0];
        const giris = new Date(p.ise_giris_tarihi);
        const dogum = p.dogum_tarihi ? new Date(p.dogum_tarihi) : null;

        const uRes = await pool.query(`
            SELECT COALESCE(SUM(kac_gun), 0) as used 
            FROM izin_talepleri 
            WHERE personel_id = $1 
            AND durum IN ('IK_ONAYLADI', 'TAMAMLANDI') 
            AND izin_turu = 'YILLIK İZİN'
            AND talep_id != $2 
        `, [personel_id, current_talep_id]);
        
        let toplamKullanilan = parseInt(uRes.rows[0].used) || 0;

        const kuralRes = await pool.query("SELECT * FROM hakedis_kurallari");
        const kurallar = kuralRes.rows;
        
        let hakedisListesi = [];
        let bitisTarihi = new Date(); 
        if (!p.aktif && p.ayrilma_tarihi) bitisTarihi = new Date(p.ayrilma_tarihi);

        let iterasyonTarihi = new Date(giris);
        
        while (iterasyonTarihi <= bitisTarihi) {
            const hesapYili = iterasyonTarihi.getFullYear();
            const oAnkiKidem = Math.floor((iterasyonTarihi - giris) / (1000 * 60 * 60 * 24 * 365.25));
            let oAnkiYas = 0;
            if(dogum) oAnkiYas = hesapYili - dogum.getFullYear();

            let hak = 0;
            const uygunKural = kurallar.find(k => hesapYili >= parseInt(k.baslangic_yili) && hesapYili <= parseInt(k.bitis_yili) && oAnkiKidem >= parseInt(k.kidem_alt) && oAnkiKidem <= parseInt(k.kidem_ust));
            
            if (uygunKural) hak = parseInt(uygunKural.gun_sayisi);
            else {
                if (hesapYili <= 2017) { if (oAnkiKidem < 5) hak = 14; else if (oAnkiKidem < 15) hak = 20; else hak = 26; } 
                else if (hesapYili <= 2019) { if (oAnkiKidem < 5) hak = 16; else if (oAnkiKidem < 15) hak = 22; else hak = 26; } 
                else if (hesapYili <= 2021) { if (oAnkiKidem < 5) hak = 18; else if (oAnkiKidem < 15) hak = 25; else hak = 30; }
                else if (hesapYili <= 2023) { if (oAnkiKidem < 5) hak = 18; else if (oAnkiKidem < 15) hak = 25; else hak = 30; }
                else { if (oAnkiKidem <= 3) hak = 18; else if (oAnkiKidem < 15) hak = 27; else hak = 32; }
            }
            if (oAnkiYas >= 50 && hak < 20) hak = 20;

            if (oAnkiKidem >= 0) hakedisListesi.push({ yil: hesapYili, hak: hak });
            
            iterasyonTarihi.setFullYear(iterasyonTarihi.getFullYear() + 1);
        }

        let sonucYili = new Date().getFullYear();
        for (let i = 0; i < hakedisListesi.length; i++) {
            const hakedis = hakedisListesi[i];
            if (toplamKullanilan >= hakedis.hak) {
                toplamKullanilan -= hakedis.hak;
            } else {
                sonucYili = hakedis.yil;
                break;
            }
        }
        return sonucYili;
    } catch (e) { return new Date().getFullYear(); }
};

// --- YARDIMCI: İzin Sonrası Kalan Bakiye Hesapla ---
const hesaplaKalanBakiye = async (personel_id, talep_id, talep_gun_sayisi, talep_durumu) => {
    try {
        const pRes = await pool.query("SELECT ise_giris_tarihi, dogum_tarihi, ayrilma_tarihi, aktif FROM personeller WHERE personel_id = $1", [personel_id]);
        if (pRes.rows.length === 0) return 0;
        const p = pRes.rows[0];

        const kumulatifHak = await hesaplaKumulatif(p.ise_giris_tarihi, p.dogum_tarihi, p.ayrilma_tarihi, p.aktif);
        const gRes = await pool.query("SELECT COALESCE(SUM(gun_sayisi), 0) as toplam FROM izin_gecmis_bakiyeler WHERE personel_id = $1", [personel_id]);
        const devreden = parseInt(gRes.rows[0].toplam) || 0;

        const uRes = await pool.query(`
            SELECT COALESCE(SUM(kac_gun), 0) as used 
            FROM izin_talepleri 
            WHERE personel_id = $1 AND durum IN ('IK_ONAYLADI', 'TAMAMLANDI') AND izin_turu = 'YILLIK İZİN'
        `, [personel_id]);
        let toplamKullanilan = parseInt(uRes.rows[0].used) || 0;

        let buTalepDahilKullanilan = toplamKullanilan;
        if (talep_durumu !== 'IK_ONAYLADI' && talep_durumu !== 'TAMAMLANDI') {
            buTalepDahilKullanilan += parseInt(talep_gun_sayisi);
        }

        return (kumulatifHak + devreden) - buTalepDahilKullanilan;
    } catch (e) { return 0; }
};

exports.pdfOlustur = async (req, res) => {
    const { talep_id, form_tipi } = req.params; 
    const query = req.query || {};

    try {
        const result = await pool.query(`
            SELECT t.*, p.ad, p.soyad, p.tc_no, p.birim_id, p.adres, p.telefon, p.ise_giris_tarihi, 
            p.sicil_no, p.gorev, p.kadro_tipi, b.birim_adi
            FROM izin_talepleri t
            JOIN personeller p ON t.personel_id = p.personel_id
            LEFT JOIN birimler b ON p.birim_id = b.birim_id
            WHERE t.talep_id = $1
        `, [talep_id]);

        if (result.rows.length === 0) return res.status(404).send('Talep bulunamadı');
        const veri = result.rows[0];

        // İmzalar (Sadece Form 1 İçin)
        let amirImza = '', yaziciImza = '', personelImza = '';
        if (veri.personel_imza) personelImza = veri.personel_imza;

        if (form_tipi === 'form1') {
            const imzalarRes = await pool.query(`
                SELECT i.imza_data, r.rol_adi FROM imzalar i
                JOIN personeller p ON i.personel_id = p.personel_id
                JOIN roller r ON p.rol_id = r.rol_id WHERE i.talep_id = $1
            `, [talep_id]);
            imzalarRes.rows.forEach(img => {
                if (img.rol_adi === 'amir') amirImza = img.imza_data;
                if (img.rol_adi === 'yazici') yaziciImza = img.imza_data;
            });
        }

        // --- HESAPLAMALAR ---
        let kalanIzinMetni = "...";
        let aitOlduguYil = new Date().getFullYear();

        if (veri.izin_turu === 'YILLIK İZİN') {
            const kalan = await hesaplaKalanBakiye(veri.personel_id, veri.talep_id, veri.kac_gun, veri.durum);
            kalanIzinMetni = kalan.toString();
            aitOlduguYil = await getIzninAitOlduguYilFIFO(veri.personel_id, veri.talep_id);
        }

        const logoMBB = resimOku('logo1.png'); 
        const logoTSE = resimOku('logo3.png'); // Form 2 Sağ Logo Değiştirildi

        // Dinamik İsimler ve Unvanlar (Vekalet Desteği)
        const hrName = query.hrName || '................................'; 
        const managerName = query.managerName || 'Bayram DEMİR';
        const managerTitle = query.managerTitle || 'Toplu Taşıma Şube Müdürü'; 
        const headName = query.headName || 'Ersan TOPÇUOĞLU';
        const headTitle = query.headTitle || 'Ulaşım Dairesi Başkanı';

        const commonCSS = `
            body { font-family: 'Times New Roman', serif; padding: 0; margin: 0; color: #000; line-height: 1.4; } /* Satır aralığı açıldı */
            .no-border td { border: none; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .imza-img { height: 35px; max-width: 90px; display: block; margin: 0 auto; }
            .logo-img { height: 60px; width: auto; }
            table { width: 100%; border-collapse: collapse; }
        `;

        let htmlContent = '';

        if (form_tipi === 'form1') {
            // ================= FORM 1 (DİJİTAL SÜREÇ) =================
            const isType = (tur) => veri.izin_turu === tur ? 'X' : ' ';
            let formBasligi = "İZİN TALEP FORMU";
            if (veri.izin_turu) formBasligi = `${veri.izin_turu} TALEP FORMU`.toUpperCase();

            htmlContent = `
            <html>
            <head>
                <style>
                    ${commonCSS}
                    .cerceve { border: 3px solid black; padding: 15px; height: 98vh; box-sizing: border-box; }
                    td { border: 1px solid black; padding: 4px; font-size: 10px; vertical-align: middle; }
                    .section-title { background-color: #e0e0e0; font-weight: bold; text-align: center; font-size: 11px; padding: 4px; border: 1px solid black; margin-top: 10px; }
                    .label { font-weight: bold; background-color: #f9f9f9; width: 25%; }
                    .adres-kutu { vertical-align: top; height: 40px; }
                </style>
            </head>
            <body>
                <div class="cerceve">
                    <table class="no-border">
                        <tr>
                            <td width="20%" class="center"><img src="${logoMBB}" class="logo-img"></td>
                            <td width="60%" class="center">
                                <div style="font-weight:bold; font-size:12px;">Ulaşım Dairesi Başkanlığı</div>
                                <div style="font-size:12px;">Toplu Taşıma Şube Müdürlüğü</div>
                                <div style="margin-top:5px; text-decoration:underline; font-weight:bold; font-size:14px;">${formBasligi}</div>
                            </td>
                            <td width="20%" class="center"><img src="${logoTSE}" class="logo-img"></td>
                        </tr>
                    </table>
                    <div class="section-title">I. İZİN TALEBİNDE BULUNANIN</div>
                    <table>
                        <tr><td colspan="2" class="center bold">(1) KİMLİK BİLGİLERİ</td><td colspan="2" class="center bold">(2) ADRES BİLGİLERİ</td></tr>
                        <tr><td class="label">Adı Soyadı</td><td class="val">${veri.ad} ${veri.soyad}</td><td class="label">Ev Adresi</td><td rowspan="3" class="adres-kutu">${veri.adres}</td></tr>
                        <tr><td class="label">TC Kimlik No</td><td>${veri.tc_no}</td><td class="label">İzin Adresi</td></tr>
                        <tr><td class="label">Kadrosu</td><td>${veri.kadro_tipi || 'İŞÇİ'}</td><td rowspan="3" class="adres-kutu">${veri.izin_adresi || veri.adres}</td></tr>
                        <tr><td class="label">Sicil No</td><td>${veri.sicil_no || '-'}</td><td class="label">Cep Tel</td></tr>
                        <tr><td class="label">Görevi</td><td>${veri.gorev}</td><td>${veri.telefon}</td></tr>
                        <tr><td class="label">Amirlik</td><td>${veri.birim_adi}</td><td class="label">Hafta Tatili</td><td>${veri.haftalik_izin_gunu}</td></tr>
                    </table>
                    <div class="section-title">II. İZİN TALEP BEYANI</div>
                    <table>
                        <tr>
                            <td colspan="2" class="label">İşe Giriş Tarihi: ${fmt(veri.ise_giris_tarihi)}</td>
                            <td colspan="2" class="center bold" style="height:50px; vertical-align:bottom;">
                                İMZA<br>${personelImza ? `<img src="${personelImza}" class="imza-img">` : ''}
                            </td>
                        </tr>
                        <tr><td class="label">Başlama</td><td>${fmt(veri.baslangic_tarihi)}</td><td class="label">Bitiş</td><td>${fmt(veri.bitis_tarihi)}</td></tr>
                        <tr><td class="label">İşe Başlama</td><td>${fmt(veri.ise_baslama_tarihi)}</td><td class="label">Gün Sayısı</td><td>${veri.kac_gun}</td></tr>
                        <tr><td class="label">İzin Türü</td><td colspan="3">${veri.izin_turu}</td></tr>
                        <tr><td class="label">Açıklama</td> <td colspan="3">${veri.aciklama}</td></tr>
                    </table>
                    <div class="section-title">III. İZİN ONAY KISMI</div>
                    <table>
                        <tr><td width="50%" class="center bold">AMİR GÖRÜŞÜ</td><td width="50%" class="center bold">YAZICI KONTROLÜ</td></tr>
                        <tr>
                            <td height="80" class="center" style="vertical-align:top;">
                                <div style="margin-bottom:5px;">Uygun Görüşle Arz Ederim</div>
                                ${amirImza ? `<img src="${amirImza}" class="imza-img">` : ''}
                                <div>Birim Amiri</div>
                            </td>
                            <td height="80" class="center" style="vertical-align:top;">
                                <div style="margin-bottom:5px;">Kontrol Edilmiştir</div>
                                ${yaziciImza ? `<img src="${yaziciImza}" class="imza-img">` : ''}
                                <div>Amirlik Yazıcısı</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </body>
            </html>`;

        } else {
            // ============================================================
            // FORM 2: KÜLTÜR A.Ş. FORMATI (DAHA FERAH & 11px)
            // ============================================================
            htmlContent = `
            <html>
            <head>
                <style>
                    ${commonCSS}
                    .page-container { padding: 15px 30px; height: 98vh; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; }
                    .header-tbl td { text-align: center; vertical-align: middle; padding: 2px; }
                    
                    /* Form Tablosu - Ferahlatıldı */
                    .form-tbl { width: 100%; margin-top: 25px; font-size: 11px; }
                    .form-tbl td { padding: 6px 0; vertical-align: top; } /* Boşluklar arttı */
                    .lbl { font-weight: bold; width: 30%; }
                    .sep { width: 2%; text-align: center; }
                    .val { width: 68%; border-bottom: 1px dotted #999; } 

                    /* İmzalar */
                    .imza-row { margin-top: 35px; width: 100%; font-size:11px; }
                    .imza-row td { vertical-align: top; text-align:center; padding: 0 5px; }
                    
                    /* KVKK */
                    .kvkk-area { margin-top: 25px; font-size: 9px; text-align: justify; border-top: 1px solid #000; padding-top: 5px; line-height: 1.3; }
                    .kvkk-table { width:100%; margin-top:10px; font-size:10px; }
                    .kvkk-table td { vertical-align: top; }

                    /* ALT BİLGİ TABLOSU (EN ALT) */
                    .footer-box { 
                        margin-top: 20px; 
                        width: 100%; 
                        border: 1px solid #000; 
                        font-size: 10px;
                        border-collapse: collapse;
                    }
                    .footer-box td { 
                        border: 1px solid #000; 
                        padding: 6px; 
                        vertical-align: middle;
                        text-align: center;
                    }
                    .footer-left { text-align: left !important; }
                </style>
            </head>
            <body>
                <div class="page-container">
                    <div>
                        <table class="header-tbl no-border">
                            <tr>
                                <td width="18%"><img src="${logoMBB}" class="logo-img"></td>
                                <td width="64%">
                                    <div class="bold" style="font-size:14px;">T.C.<br>MERSİN BÜYÜKŞEHİR BELEDİYESİ<br>ULAŞIM DAİRESİ BAŞKANLIĞI</div>
                                </td>
                                <td width="18%"><img src="${logoTSE}" class="logo-img"></td>
                            </tr>
                            <tr>
                                <td colspan="3" class="bold" style="font-size:12px; padding-top:10px;">
                                    MERSİN BÜYÜKŞEHİR KÜLTÜR SANAT BİLİM ULŞ.TİC. ve SAN. A.Ş.
                                </td>
                            </tr>
                            <tr>
                                <td colspan="3" class="bold" style="font-size:16px; text-decoration: underline; padding-top:10px;">
                                    İŞÇİ İZİN FORMU
                                </td>
                            </tr>
                        </table>

                        <table class="form-tbl">
                            <tr><td class="lbl">ADI SOYADI ve T.C.NO</td><td class="sep">:</td><td class="val">${veri.ad} ${veri.soyad} / ${veri.tc_no}</td></tr>
                            <tr><td class="lbl">İŞE GİRİŞ TARİHİ</td><td class="sep">:</td><td class="val">${fmt(veri.ise_giris_tarihi)}</td></tr>
                            <tr><td class="lbl">POZİSYONU</td><td class="sep">:</td><td class="val">${veri.kadro_tipi || 'Sürekli İşçi'}</td></tr>
                            <tr><td class="lbl">BAĞLI OLDUĞU BİRİM</td><td class="sep">:</td><td class="val">${veri.birim_adi}</td></tr>
                            <tr><td class="lbl">İZİN TÜRÜ</td><td class="sep">:</td><td class="val">${veri.izin_turu}</td></tr>
                            <tr><td class="lbl">İZNİN AİT OLDUĞU YIL</td><td class="sep">:</td><td class="val">${aitOlduguYil}</td></tr>
                            <tr><td class="lbl">DİLEKÇE TARİHİ</td><td class="sep">:</td><td class="val">${fmt(veri.olusturma_tarihi)}</td></tr>
                            <tr><td class="lbl">İZİNİ KULLANACAĞI TARİH</td><td class="sep">:</td><td class="val">${fmt(veri.baslangic_tarihi)}</td></tr>
                            <tr><td class="lbl">İZİN BİTİŞ TARİHİ</td><td class="sep">:</td><td class="val">${fmt(veri.bitis_tarihi)}</td></tr>
                            <tr><td class="lbl">İŞ BAŞI TARİHİ</td><td class="sep">:</td><td class="val">${fmt(veri.ise_baslama_tarihi)}</td></tr>
                            <tr><td class="lbl">İKAMETGAH ADRESİ VE TELEFON</td><td class="sep">:</td><td class="val">${veri.adres} / ${veri.telefon}</td></tr>
                            <tr><td class="lbl">İZNİNİ GEÇİRECEĞİ ADRES</td><td class="sep">:</td><td class="val">${veri.izin_adresi || veri.adres}</td></tr>
                            <tr><td class="lbl" style="padding-top:15px;">İŞÇİNİN İMZASI</td><td class="sep" style="padding-top:15px;">:</td><td class="val" style="height:35px; padding-top:15px;">............................................. (İmza)</td></tr>
                        </table>

                        <div style="font-size:11px; margin-top:20px; line-height: 1.6; text-align: justify;">
                            Belediyemiz personeli <strong>${veri.ad} ${veri.soyad}</strong>'ın izine ayrılmasında sakınca bulunmamaktadır.
                            Adı geçen personel <strong>(${veri.kac_gun})</strong> iş günü ücretli ${veri.izin_turu.toLowerCase()} kullanacaktır.
                            ${veri.izin_turu === 'YILLIK İZİN' ? `İzin kullanım sonrası <strong>(${kalanIzinMetni})</strong> gün izni kalacaktır.` : ''}
                            <br>Gereğini arz ederim.
                        </div>

                        <table class="no-border imza-row">
                            <tr>
                                <td width="33%">
                                    <div class="bold">${headTitle}</div>
                                    <div style="margin-top:2px;">${headName}</div>
                                    <div style="margin-top:35px;">.........................</div>
                                </td>
                                <td width="33%">
                                    <div class="bold">${managerTitle}</div>
                                    <div style="margin-top:2px;">${managerName}</div>
                                    <div style="margin-top:35px;">.........................</div>
                                </td>
                                <td width="33%">
                                    <div class="bold">Hazırlayan</div>
                                    <div style="margin-top:2px;">${hrName}</div>
                                    <div style="margin-top:35px;">.........................</div>
                                </td>
                            </tr>
                        </table>

                        <div class="kvkk-area">
                            <strong>6698 Sayılı Kişisel Verilerin Korunması Kanunu</strong> hakkındaki bilgilendirme www.mersin.bel.tr adresinde KVK Kapsamında Aydınlatma Beyanı ile gerçekleştirilmiştir.<br>
                            İşbu Formda Mersin Büyükşehir Belediyesi ile paylaştığım kişisel ve özel nitelikli kişisel verilerimin sadece bu işlem ile sınırlı olmak üzere Mersin Büyükşehir Belediyesi ve İştirakleri tarafından işlenmesine, kanunen gerekli görülen yerlere aktarılmasına, kişisel verileri saklama ve imha politikasına uygun olarak saklanmasına açık rıza gösterdiğimi ve bu hususta tarafıma gerekli aydınlatmanın yapıldığını, işbu metni okuduğumu ve anladığımı beyan ediyorum.
                            
                            <table class="no-border kvkk-table">
                                <tr>
                                    <td width="55%" style="padding-top:10px;">
                                        [  ] Onay Veriyorum &nbsp;&nbsp;&nbsp;&nbsp; [  ] Onay Vermiyorum
                                    </td>
                                    <td width="45%" style="padding-left:10px;">
                                        <strong>Kişisel Veri Sahibi'nin:</strong><br>
                                        Adı Soyadı: ${veri.ad} ${veri.soyad}<br>
                                        Tarih: ${fmt(new Date())}<br>
                                        İmza: .......................................
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </div>

                    <table class="footer-box">
                        <tr>
                            <td width="20%" class="footer-left"><strong>Doküman No</strong><br>İNK.02.FR.06</td>
                            <td width="20%" class="footer-left"><strong>Yayın Tarihi</strong><br>25.03.2015</td>
                            <td width="30%" class="footer-left"><strong>Rev. No ve Tarihi</strong><br>00 / --</td>
                            <td width="20%" class="footer-left"><strong>Sayfa No</strong><br>1</td>
                        </tr>
                    </table>

                </div>
            </body>
            </html>
            `;
        }

        const options = { format: 'A4', margin: { top: "8mm", bottom: "8mm", left: "10mm", right: "10mm" } };
        const file = { content: htmlContent };

        pdf.generatePdf(file, options).then(pdfBuffer => {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=izin_formu_${form_tipi}_${talep_id}.pdf`);
            res.send(pdfBuffer);
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('PDF Hatası: ' + err.message);
    }
};