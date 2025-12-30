const pool = require('../config/db');
const pdf = require('html-pdf-node');
const fs = require('fs');
const path = require('path');

// --- YARDIMCI: Resmi Base64'e Çevir ---
const resimOku = (dosyaAdi) => {
    try {
        const yol = path.join(__dirname, '../../templates', dosyaAdi);
        const bitmap = fs.readFileSync(yol);
        return `data:image/png;base64,${bitmap.toString('base64')}`;
    } catch (e) { return ''; }
};

exports.pdfOlustur = async (req, res) => {
    const { talep_id, form_tipi } = req.params; 
    const query = req.query || {};

    try {
        // 1. Verileri Çek (GÜNCELLENDİ: p.ise_giris_tarihi eklendi)
        const result = await pool.query(`
            SELECT t.*, p.ad, p.soyad, p.tc_no, p.birim_id, p.adres, p.telefon, p.ise_giris_tarihi, b.birim_adi
            FROM izin_talepleri t
            JOIN personeller p ON t.personel_id = p.personel_id
            LEFT JOIN birimler b ON p.birim_id = b.birim_id
            WHERE t.talep_id = $1
        `, [talep_id]);

        if (result.rows.length === 0) return res.status(404).send('Talep bulunamadı');
        const veri = result.rows[0];

        // 2. İmzaları Hazırla
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

        // 3. Logolar
        const logoMBB = resimOku('logo1.png'); 
        const logoTSE = resimOku('logo2.png'); 
        const logo100 = resimOku('logo3.png');
        const fmt = (t) => t ? new Date(t).toLocaleDateString('tr-TR') : '-';

        // Dinamik İsimler (Form 2 İçin)
        const hrName = query.hrName || 'İK Personeli';
        const managerName = query.managerName || 'Bayram DEMİR';
        const managerTitle = query.managerTitle || 'Toplu Taşıma Şube Müdürü';
        const headName = query.headName || 'Ersan TOPÇUOĞLU';
        const headTitle = query.headTitle || 'Ulaşım Dairesi Başkanı';

        // --- ORTAK CSS ---
        const commonCSS = `
            body { font-family: 'Times New Roman', serif; padding: 0; margin: 0; }
            .no-border td { border: none; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .imza-img { height: 40px; max-width: 100px; display: block; margin: 0 auto; }
            .logo-img { height: 60px; width: auto; }
        `;

        let htmlContent = '';

        if (form_tipi === 'form1') {
            // ================= FORM 1 (AMİR/YAZICI - DİJİTAL İMZALI) =================
            const isType = (tur) => veri.izin_turu === tur ? 'X' : ' ';
            let formBasligi = "İZİN TALEP FORMU";
            if (veri.izin_turu) formBasligi = `${veri.izin_turu} TALEP FORMU`.toUpperCase();

            htmlContent = `
            <html>
            <head>
                <style>
                    ${commonCSS}
                    .cerceve { border: 3px solid black; padding: 15px; height: 98vh; box-sizing: border-box; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
                    td { border: 1px solid black; padding: 4px; font-size: 10px; vertical-align: middle; }
                    .section-title { background-color: #e0e0e0; font-weight: bold; text-align: center; font-size: 11px; padding: 4px; border: 1px solid black; margin-top: 10px; }
                    .label { font-weight: bold; background-color: #f9f9f9; width: 25%; }
                    .val { width: 25%; }
                    .check-box { font-weight: bold; font-size: 12px; padding: 0 5px; }
                    .adres-kutu { vertical-align: top; }
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
                        <tr><td class="label">Kadrosu</td><td>ŞOFÖR / İŞÇİ</td><td rowspan="3" class="adres-kutu">${veri.izin_adresi || veri.adres}</td></tr>
                        <tr><td class="label">Sicil No</td><td>-</td><td class="label">Cep Tel</td></tr>
                        <tr><td class="label">Görevi</td><td>ŞOFÖR</td><td>${veri.telefon}</td></tr>
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
                        <tr>
                            <td class="label">İzin Türü</td>
                            <td colspan="3">
                                <table style="border:none; width:100%">
                                    <tr>
                                        <td style="border:none">Yıllık [<span class="check-box">${isType('YILLIK İZİN')}</span>]</td>
                                        <td style="border:none">Mazeret [<span class="check-box">${isType('MAZERET İZNİ')}</span>]</td>
                                        <td style="border:none">Ücretsiz [<span class="check-box">${isType('ÜCRETSİZ İZİN')}</span>]</td>
                                    </tr>
                                    <tr>
                                        <td style="border:none">Rapor [<span class="check-box">${isType('RAPOR')}</span>]</td>
                                        <td style="border:none">Evlilik [<span class="check-box">${isType('EVLİLİK İZNİ')}</span>]</td>
                                        <td style="border:none">Ölüm [<span class="check-box">${isType('ÖLÜM İZNİ')}</span>]</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr><td class="label">Açıklama</td> <td colspan="3">${veri.aciklama}</td></tr>
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
            // ================= FORM 2 (İK - ISLAK İMZA - DÜZELTİLDİ: İşe Giriş Tarihi) =================
            htmlContent = `
            <html>
            <head>
                <style>
                    ${commonCSS}
                    .cerceve { border: 3px solid black; padding: 15px 30px; height: 98vh; box-sizing: border-box; position: relative; }
                    .f2-table { width: 100%; border: none; margin-top: 10px; border-collapse: collapse; }
                    /* ÇİZGİLERİ KALDIRDIK */
                    .f2-table td { padding: 4px 2px; font-size: 13px; border: none; vertical-align: top; } 
                    .f2-label { font-weight: bold; width: 32%; }
                    .f2-val { width: 68%; }
                    .header-box { border: 2px solid black; padding: 5px; margin-bottom: 10px; }
                    
                    /* 4 PARMAK BOŞLUK */
                    .footer-container { margin-top: 120px; width: 100%; } 
                    
                    .imza-blok { text-align: center; font-size: 12px; vertical-align: top; }
                    .unvan { font-size: 11px; margin-top: 2px; }
                    .isim { font-weight: bold; font-size: 12px; margin-top: 15px; }
                </style>
            </head>
            <body>
                <div class="cerceve">
                    
                    <div class="header-box">
                        <table class="no-border" style="width:100%">
                            <tr>
                                <td width="25%" class="center"><img src="${logoMBB}" class="logo-img"></td>
                                <td width="50%" class="center">
                                    <div style="font-size:12px;">T.C.</div>
                                    <div style="font-size:15px; font-weight:bold;">MERSİN BÜYÜKŞEHİR<br>ULAŞIM DAİRESİ BAŞKANLIĞI</div>
                                </td>
                                <td width="25%" class="center"><img src="${logo100}" class="logo-img"></td>
                            </tr>
                        </table>
                    </div>

                    <div class="center bold" style="font-size:14px; margin-bottom:10px;">
                        MERSİN BÜYÜKŞEHİR<br>KÜLTÜR SANAT BİLİM ULŞ.TİC.VE SANAYİ A.Ş
                    </div>

                    <div style="text-decoration:underline; font-weight:bold; font-size:14px; margin-bottom:15px; text-align:center;">
                        İŞÇİ İZİN TALEP FORMU
                    </div>

                    <table class="f2-table">
                        <tr><td class="f2-label">ADI SOYADI</td><td class="f2-val">: ${veri.ad} ${veri.soyad}</td></tr>
                        <tr><td class="f2-label">T.C. NO</td><td class="f2-val">: ${veri.tc_no}</td></tr>
                        <tr><td class="f2-label">İŞE GİRİŞ TARİHİ</td><td class="f2-val">: ${fmt(veri.ise_giris_tarihi)}</td></tr>
                        <tr><td class="f2-label">POZİSYONU</td><td class="f2-val">: ŞOFÖR / İŞÇİ</td></tr>
                        <tr><td class="f2-label">FİİLEN YAPTIĞI GÖREV</td><td class="f2-val">: ŞOFÖR</td></tr>
                        <tr><td class="f2-label">BAĞLI OLDUĞU BİRİM</td><td class="f2-val">: ${veri.birim_adi}</td></tr>
                        <tr><td class="f2-label">İZİN TÜRÜ</td><td class="f2-val">: ${veri.izin_turu}</td></tr>
                        <tr><td class="f2-label">İZNİN AİT OLDUĞU YIL</td><td class="f2-val">: ${new Date().getFullYear()}</td></tr>
                        <tr><td class="f2-label">ÇALIŞMA GRUBU</td><td class="f2-val">: -</td></tr>
                        <tr><td class="f2-label">HAFTA TATİLİ</td><td class="f2-val">: ${veri.haftalik_izin_gunu}</td></tr>
                        <tr><td class="f2-label">DİLEKÇE TARİHİ</td><td class="f2-val">: ${fmt(veri.olusturma_tarihi)}</td></tr>
                        
                        <tr><td colspan="2" style="height:10px;"></td></tr>

                        <tr><td class="f2-label">İZİN TARİHLERİ</td><td class="f2-val">: ${fmt(veri.baslangic_tarihi)} - ${fmt(veri.bitis_tarihi)} (${veri.kac_gun} Gün)</td></tr>
                        <tr><td class="f2-label">İŞE BAŞLAMA TARİHİ</td><td class="f2-val">: ${fmt(veri.ise_baslama_tarihi)}</td></tr>
                        <tr><td class="f2-label">İKAMETGAH ADRESİ</td><td class="f2-val">: ${veri.adres}</td></tr>
                        <tr><td class="f2-label">TELEFON</td><td class="f2-val">: ${veri.telefon}</td></tr>
                        <tr><td class="f2-label">İZNİNİ GEÇİRECEĞİ ADRES</td><td class="f2-val">: ${veri.izin_adresi || veri.adres}</td></tr>
                        
                        <tr>
                            <td class="f2-label" style="padding-top: 20px;">İŞÇİNİN İMZASI</td>
                            <td class="f2-val" style="padding-top: 20px;">: ...................................................... (İmza)</td>
                        </tr>
                    </table>

                    <div style="font-size:12px; text-align:justify; margin-top:15px; line-height: 1.5;">
                        Belediyemiz personeli <strong>${veri.ad} ${veri.soyad}</strong>'in yıllık iznine ayrılmasında sakınca bulunmamaktadır.<br>
                        Adı geçen personel <strong>(${veri.kac_gun})</strong> gün yıllık izin kullanacaktır.
                        Gereğini arz ederim.
                    </div>

                    <div class="footer-container">
                        <table class="no-border" style="width:100%;">
                            <tr>
                                <td class="imza-blok" style="width:33%;">
                                    <div class="isim">${hrName}</div>
                                    <div class="unvan">İdari İşler Görevlisi</div>
                                    <div style="height:30px;"></div>
                                    <div class="unvan">(İmza)</div>
                                </td>
                                <td class="imza-blok" style="width:33%;">
                                    <div class="isim">${managerName}</div>
                                    <div class="unvan">${managerTitle}</div>
                                    <div style="height:30px;"></div>
                                    <div class="unvan">(İmza)</div>
                                </td>
                                <td class="imza-blok" style="width:33%;">
                                    <div class="isim">${headName}</div>
                                    <div class="unvan">${headTitle}</div>
                                    <div style="height:30px;"></div>
                                    <div class="unvan">(Onay)</div>
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