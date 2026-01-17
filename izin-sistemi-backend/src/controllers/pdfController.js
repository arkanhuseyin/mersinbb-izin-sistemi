const pool = require('../config/db');
const pdf = require('html-pdf-node');
const fs = require('fs');
const path = require('path');
// ✅ MERKEZİ HESAPLAMA MOTORU (Bakiye hesabı için gerekli)
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

// --- YARDIMCI: Tarih Formatla (DD.MM.YYYY) ---
const fmt = (t) => {
    if (!t) return '-';
    try {
        const d = new Date(t);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('tr-TR');
    } catch { return '-'; }
};

// --- YARDIMCI: İzin Sonrası Kalan Bakiye Hesapla ---
const hesaplaKalanBakiye = async (personel_id, talep_id, talep_gun_sayisi, talep_durumu) => {
    try {
        // 1. Personel Bilgileri
        const pRes = await pool.query("SELECT ise_giris_tarihi, dogum_tarihi, ayrilma_tarihi, aktif FROM personeller WHERE personel_id = $1", [personel_id]);
        if (pRes.rows.length === 0) return 0;
        const p = pRes.rows[0];

        // 2. Kümülatif Hak (Merkezi Sistem)
        const kumulatifHak = await hesaplaKumulatif(p.ise_giris_tarihi, p.dogum_tarihi, p.ayrilma_tarihi, p.aktif);

        // 3. Manuel Devreden
        const gRes = await pool.query("SELECT COALESCE(SUM(gun_sayisi), 0) as toplam FROM izin_gecmis_bakiyeler WHERE personel_id = $1", [personel_id]);
        const devreden = parseInt(gRes.rows[0].toplam) || 0;

        // 4. Onaylanmış İzinler
        const uRes = await pool.query(`
            SELECT COALESCE(SUM(kac_gun), 0) as used 
            FROM izin_talepleri 
            WHERE personel_id = $1 AND durum IN ('IK_ONAYLADI', 'TAMAMLANDI') AND izin_turu = 'YILLIK İZİN'
        `, [personel_id]);
        let toplamKullanilan = parseInt(uRes.rows[0].used) || 0;

        // 5. Mantık: Eğer bu talep henüz onaylanmadıysa, "kullanılacak" gibi düşünüp düşüyoruz.
        // Eğer zaten onaylıysa, yukarıdaki sorguda zaten sayılmıştır, tekrar düşmeye gerek yok.
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
        // 1. Verileri Çek
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

        // 2. İmzaları Hazırla (Sadece Form 1 için gerekli)
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

        // 3. Kalan İzin Hesabı (Sadece Form 2'de gösterilecek)
        let kalanIzinMetni = "...";
        if (veri.izin_turu === 'YILLIK İZİN') {
            const kalan = await hesaplaKalanBakiye(veri.personel_id, veri.talep_id, veri.kac_gun, veri.durum);
            kalanIzinMetni = kalan.toString();
        }

        // 4. Logolar
        const logoMBB = resimOku('logo1.png'); 
        const logoTSE = resimOku('logo2.png'); 
        const logo100 = resimOku('logo3.png');

        // Dinamik İsimler (Form 2 İçin)
        const hrName = query.hrName || '................................';
        const managerName = query.managerName || 'Bayram DEMİR';
        const managerTitle = query.managerTitle || 'Toplu Taşıma Şube Müdürü';
        const headName = query.headName || 'Ersan TOPÇUOĞLU';
        const headTitle = query.headTitle || 'Ulaşım Dairesi Başkanı';

        // --- ORTAK CSS ---
        const commonCSS = `
            body { font-family: 'Times New Roman', serif; padding: 0; margin: 0; color: #000; }
            .no-border td { border: none; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .imza-img { height: 40px; max-width: 120px; display: block; margin: 0 auto; }
            .logo-img { height: 60px; width: auto; }
            table { width: 100%; border-collapse: collapse; }
        `;

        let htmlContent = '';

        if (form_tipi === 'form1') {
            // ============================================================
            // FORM 1: AMİR/YAZICI ONAY FORMU (DİJİTAL İMZALI)
            // ============================================================
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
                    <table class="no-border" style="margin-bottom:10px;">
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
                        <tr><td class="label">Adı Soyadı</td><td class="val">${veri.ad} ${veri.soyad}</td><td class="label">Ev Adresi</td><td rowspan="3" class="adres-kutu">${veri.adres || '-'}</td></tr>
                        <tr><td class="label">TC Kimlik No</td><td>${veri.tc_no}</td><td class="label">İzin Adresi</td></tr>
                        <tr><td class="label">Kadrosu</td><td>${veri.kadro_tipi || 'İŞÇİ'}</td><td rowspan="3" class="adres-kutu">${veri.izin_adresi || veri.adres || '-'}</td></tr>
                        <tr><td class="label">Sicil No</td><td>${veri.sicil_no || '-'}</td><td class="label">Cep Tel</td></tr>
                        <tr><td class="label">Görevi</td><td>${veri.gorev || 'ŞOFÖR'}</td><td>${veri.telefon || '-'}</td></tr>
                        <tr><td class="label">Amirlik</td><td>${veri.birim_adi || '-'}</td><td class="label">Hafta Tatili</td><td>${veri.haftalik_izin_gunu || '-'}</td></tr>
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
                        <tr>
                            <td class="label">İzin Türü</td>
                            <td colspan="3">
                                [${isType('YILLIK İZİN')}] Yıllık &nbsp; [${isType('MAZERET İZNİ')}] Mazeret &nbsp; [${isType('ÜCRETSİZ İZİN')}] Ücretsiz &nbsp; 
                                [${isType('RAPOR')}] Rapor &nbsp; [${isType('EVLİLİK İZNİ')}] Evlilik &nbsp; [${isType('ÖLÜM İZNİ')}] Ölüm
                            </td>
                        </tr>
                        <tr><td class="label">Açıklama</td> <td colspan="3">${veri.aciklama || '-'}</td></tr>
                    </table>

                    <div class="section-title">III. İZİN ONAY KISMI</div>
                    <table>
                        <tr>
                            <td width="50%" class="center bold" style="background-color:#f0f0f0;">AMİR GÖRÜŞÜ (OLUMLU)</td>
                            <td width="50%" class="center bold" style="background-color:#f0f0f0;">YAZICI KONTROLÜ</td>
                        </tr>
                        <tr>
                            <td height="80" class="center" style="vertical-align:top;">
                                <div style="margin-bottom:5px;">Uygun Görüşle Arz Ederim</div>
                                ${amirImza ? `<img src="${amirImza}" class="imza-img">` : ''}
                                <div style="margin-top:5px;"><strong>${fmt(new Date())}</strong></div>
                                <div>Birim Amiri</div>
                            </td>
                            <td height="80" class="center" style="vertical-align:top;">
                                <div style="margin-bottom:5px;">Kontrol Edilmiştir</div>
                                ${yaziciImza ? `<img src="${yaziciImza}" class="imza-img">` : ''}
                                <div style="margin-top:5px;"><strong>${fmt(new Date())}</strong></div>
                                <div>Amirlik Yazıcısı</div>
                            </td>
                        </tr>
                    </table>
                    <div style="position:absolute; bottom:10px; left:30px; font-size:8px;">Doküman No: 23.ULS.02</div>
                </div>
            </body>
            </html>`;

        } else {
            // ============================================================
            // FORM 2: İK İÇİN ISLAK İMZA FORMU (YENİ TASARIM)
            // ============================================================
            htmlContent = `
            <html>
            <head>
                <style>
                    ${commonCSS}
                    .cerceve { border: 2px solid black; padding: 20px 40px; height: 98vh; box-sizing: border-box; position: relative; }
                    .header-tbl td { vertical-align: middle; border: 1px solid #000; padding: 5px; }
                    .f2-table { margin-top: 20px; width: 100%; border: 1px solid #000; }
                    .f2-table td { padding: 6px; font-size: 11px; border: 1px solid #000; vertical-align: middle; }
                    .f2-label { font-weight: bold; width: 35%; background-color: #f0f0f0; }
                    .f2-val { width: 65%; }
                    
                    .footer-container { margin-top: 40px; width: 100%; } 
                    .imza-blok { text-align: center; font-size: 11px; vertical-align: top; }
                    .unvan { font-size: 10px; margin-top: 2px; font-weight:bold; }
                    .isim { font-weight: bold; font-size: 11px; margin-top: 40px; }
                    
                    .kvkk-box { margin-top: 30px; border: 1px solid #000; padding: 5px; font-size: 8px; text-align: justify; }
                    .kvkk-row { display: flex; justify-content: space-between; margin-top: 5px; }
                </style>
            </head>
            <body>
                <div class="cerceve">
                    
                    <table class="header-tbl">
                        <tr>
                            <td width="20%" class="center" rowspan="3"><img src="${logoMBB}" class="logo-img"></td>
                            <td width="60%" class="center bold" style="font-size:14px;">
                                T.C.<br>MERSİN BÜYÜKŞEHİR BELEDİYESİ<br>ULAŞIM DAİRESİ BAŞKANLIĞI
                            </td>
                            <td width="20%" class="center" rowspan="3"><img src="${logo100}" class="logo-img"></td>
                        </tr>
                        <tr>
                            <td class="center bold" style="font-size:12px;">
                                MERSİN BÜYÜKŞEHİR KÜLTÜR SANAT BİLİM ULŞ.TİC. ve SAN. A.Ş.
                            </td>
                        </tr>
                        <tr>
                            <td class="center bold" style="font-size:16px;">İŞÇİ İZİN FORMU</td>
                        </tr>
                    </table>

                    <table class="f2-table">
                        <tr><td class="f2-label">ADI SOYADI ve T.C.NO</td><td class="f2-val">${veri.ad} ${veri.soyad} / ${veri.tc_no}</td></tr>
                        <tr><td class="f2-label">İŞE GİRİŞ TARİHİ</td><td class="f2-val">${fmt(veri.ise_giris_tarihi)}</td></tr>
                        <tr><td class="f2-label">POZİSYONU</td><td class="f2-val">${veri.kadro_tipi || 'Sürekli İşçi'}</td></tr>
                        <tr><td class="f2-label">BAĞLI OLDUĞU BİRİM</td><td class="f2-val">${veri.birim_adi}</td></tr>
                        <tr><td class="f2-label">İZİN TÜRÜ</td><td class="f2-val">${veri.izin_turu}</td></tr>
                        <tr><td class="f2-label">İZNİN AİT OLDUĞU YIL</td><td class="f2-val">${new Date().getFullYear()}</td></tr>
                        <tr><td class="f2-label">DİLEKÇE TARİHİ</td><td class="f2-val">${fmt(veri.olusturma_tarihi)}</td></tr>
                        <tr><td class="f2-label">İZİNİ KULLANACAĞI TARİH</td><td class="f2-val">${fmt(veri.baslangic_tarihi)}</td></tr>
                        <tr><td class="f2-label">İZİN BİTİŞ TARİHİ</td><td class="f2-val">${fmt(veri.bitis_tarihi)}</td></tr>
                        <tr><td class="f2-label">İŞ BAŞI TARİHİ</td><td class="f2-val">${fmt(veri.ise_baslama_tarihi)}</td></tr>
                        <tr><td class="f2-label">İKAMETGAH ADRESİ VE TELEFON</td><td class="f2-val">${veri.adres} / ${veri.telefon}</td></tr>
                        <tr><td class="f2-label">İZNİNİ GEÇİRECEĞİ ADRES</td><td class="f2-val">${veri.izin_adresi || veri.adres}</td></tr>
                        <tr>
                            <td class="f2-label" style="height:40px; vertical-align:middle;">İŞÇİNİN İMZASI</td>
                            <td class="f2-val" style="vertical-align:bottom;">...................................................... (İmza)</td>
                        </tr>
                    </table>

                    <div style="font-size:11px; margin-top:15px; line-height: 1.6;">
                        Belediyemiz personeli <strong>${veri.ad} ${veri.soyad}</strong>'ın izine ayrılmasında sakınca bulunmamaktadır.<br>
                        Adı geçen personel <strong>(${veri.kac_gun})</strong> iş günü ${veri.izin_turu.toLowerCase()} kullanacaktır.<br>
                        ${veri.izin_turu === 'YILLIK İZİN' ? `İzin kullanım sonrası <strong>(${kalanIzinMetni})</strong> gün izni kalacaktır.<br>` : ''}
                        Gereğini arz ederim.
                    </div>

                    <div class="footer-container">
                        <table class="no-border" style="width:100%;">
                            <tr>
                                <td class="imza-blok">
                                    <div class="unvan">Hazırlayan</div>
                                    <div class="isim">${hrName}</div>
                                </td>
                                <td class="imza-blok">
                                    <div class="unvan">Şube Müdürü</div>
                                    <div class="isim">${managerName}</div>
                                </td>
                                <td class="imza-blok">
                                    <div class="unvan">Daire Başkanı</div>
                                    <div class="isim">${headName}</div>
                                </td>
                            </tr>
                        </table>
                    </div>

                    <div class="kvkk-box">
                        <strong>6698 Sayılı Kişisel Verilerin Korunması Kanunu</strong> hakkındaki bilgilendirme www.mersin.bel.tr adresinde KVK Kapsamında Aydınlatma Beyanı ile gerçekleştirilmiştir.<br>
                        İşbu Formda Mersin Büyükşehir Belediyesi ile paylaştığım kişisel ve özel nitelikli kişisel verilerimin sadece bu işlem ile sınırlı olmak üzere Mersin Büyükşehir Belediyesi ve İştirakleri tarafından işlenmesine, kanunen gerekli görülen yerlere aktarılmasına, kişisel verileri saklama ve imha politikasına uygun olarak saklanmasına açık rıza gösterdiğimi ve bu hususta tarafıma gerekli aydınlatmanın yapıldığını, işbu metni okuduğumu ve anladığımı beyan ediyorum.<br><br>
                        
                        <table class="no-border" style="width:100%">
                            <tr>
                                <td width="30%">[  ] Onay Veriyorum</td>
                                <td width="30%">[  ] Onay Vermiyorum</td>
                                <td width="40%" style="text-align:right;">
                                    Kişisel Veri Sahibi'nin:<br>
                                    Adı Soyadı: ${veri.ad} ${veri.soyad}<br>
                                    Tarih: ${fmt(new Date())}<br>
                                    İmza: ........................
                                </td>
                            </tr>
                        </table>
                    </div>
                
                </div>
            </body>
            </html>
            `;
        }

        const options = { format: 'A4', margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" } };
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