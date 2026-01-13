import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Search, FileBarChart, CheckCircle, User, FileText, History, Calculator, FileSpreadsheet, FileTypePdf } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Varsayılan Profil Resmi (Eğer veritabanında yoksa bu çıkar)
const DEFAULT_PHOTO = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

export default function LeaveReports() {
    const [rapor, setRapor] = useState([]);
    const [arama, setArama] = useState('');
    const [yukleniyor, setYukleniyor] = useState(true);
    const [hakedisKurallari, setHakedisKurallari] = useState([]);

    // Modal States
    const [secilenPersonel, setSecilenPersonel] = useState(null);
    const [detayYukleniyor, setDetayYukleniyor] = useState(false);
    const [personelDetay, setPersonelDetay] = useState(null);

    const API_URL = 'https://mersinbb-izin-sistemi.onrender.com';

    useEffect(() => {
        verileriGetir();
    }, []);

    const verileriGetir = () => {
        const token = localStorage.getItem('token');
        Promise.all([
            axios.get(`${API_URL}/api/izin/rapor/durum`, { headers: { Authorization: `Bearer ${token}` } }),
            axios.get(`${API_URL}/api/ayar/hakedis-listele`, { headers: { Authorization: `Bearer ${token}` } })
        ]).then(([raporRes, kuralRes]) => {
            setRapor(raporRes.data);
            setHakedisKurallari(kuralRes.data);
            setYukleniyor(false);
        }).catch(err => {
            console.error(err);
            setYukleniyor(false);
        });
    };

    // --- 🧮 HESAPLAMA MOTORLARI (Aynı kalıyor) ---
    const getSingleYearRights = (girisYili, hesaplanacakYil, kidemYili) => {
        const uygunKural = hakedisKurallari.find(k => hesaplanacakYil >= k.baslangic_yili && hesaplanacakYil <= k.bitis_yili && kidemYili >= k.kidem_alt && kidemYili <= k.kidem_ust);
        if (uygunKural) return uygunKural.gun_sayisi;
        let hak = 0; if (kidemYili < 1) return 0;
        let bazYil = girisYili < 2007 ? 2007 : girisYili;
        if (bazYil < 2018) { if (kidemYili <= 5) hak = 14; else if (kidemYili <= 15) hak = 19; else hak = 25; }
        else if (bazYil < 2024) { if (bazYil < 2019) { if (kidemYili <= 5) hak = 14; else if (kidemYili <= 15) hak = 19; else hak = 25; } else { if (kidemYili <= 3) hak = 16; else if (kidemYili <= 5) hak = 18; else if (kidemYili <= 15) hak = 25; else hak = 30; } }
        else { if (bazYil < 2025) { if (kidemYili <= 3) hak = 16; else if (kidemYili <= 5) hak = 18; else if (kidemYili <= 15) hak = 25; else hak = 30; } else { if (kidemYili <= 3) hak = 18; else if (kidemYili <= 5) hak = 20; else if (kidemYili <= 15) hak = 27; else hak = 32; } }
        return hak;
    };

    const hesaplaDinamikHakedis = useCallback((iseGirisTarihi) => {
        if (!iseGirisTarihi) return 0;
        const giris = new Date(iseGirisTarihi); const bugun = new Date();
        const kidemYili = Math.floor((bugun - giris) / (1000 * 60 * 60 * 24 * 365.25));
        if (kidemYili < 1) return 0;
        return getSingleYearRights(giris.getFullYear(), bugun.getFullYear(), kidemYili);
    }, [hakedisKurallari]);

    const hesaplaKumulatifHakedis = useCallback((iseGirisTarihi) => {
        if (!iseGirisTarihi) return 0;
        const giris = new Date(iseGirisTarihi); const bugun = new Date(); const girisYili = giris.getFullYear();
        let toplamHak = 0; let currentCalcDate = new Date(giris);
        currentCalcDate.setFullYear(currentCalcDate.getFullYear() + 1);
        while (currentCalcDate <= bugun) {
            const hesapYili = currentCalcDate.getFullYear();
            const oAnkiKidem = Math.floor((currentCalcDate - giris) / (1000 * 60 * 60 * 24 * 365.25));
            if (oAnkiKidem >= 1) toplamHak += getSingleYearRights(girisYili, hesapYili, oAnkiKidem);
            currentCalcDate.setFullYear(currentCalcDate.getFullYear() + 1);
        }
        return toplamHak;
    }, [hakedisKurallari]);


    const handlePersonelClick = async (personel) => {
        setSecilenPersonel(personel);
        setDetayYukleniyor(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/izin/personel-detay/${personel.personel_id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPersonelDetay(res.data);
        } catch (e) { alert("Detaylar çekilemedi."); }
        setDetayYukleniyor(false);
    };

    // --- 📄 EXCEL ÇIKTILARI (Veri Odaklı) ---
    const generateDetailExcel = () => {
        if (!personelDetay) return;
        const p = personelDetay.personel;
        const buYilHak = hesaplaDinamikHakedis(p.ise_giris_tarihi);
        
        const wsData = [
            ["MERSİN BÜYÜKŞEHİR BELEDİYESİ - PERSONEL İZİN DETAY RAPORU"], [" "],
            ["TC No", p.tc_no, "Ad Soyad", `${p.ad} ${p.soyad}`, "Giriş", new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR')],
            [" "], ["BAKİYE ÖZETİ"],
            ["Kümülatif Hak", hesaplaKumulatifHakedis(p.ise_giris_tarihi)],
            ["Sisteme Devreden", p.devreden_izin], ["Bu Yıl Hakediş", buYilHak],
            ["Toplam Kullanılan", personelDetay.personel.kullanilan], ["Kalan", personelDetay.personel.kalan],
            [" "], ["İZİN HAREKETLERİ"], ["Tür", "Başlangıç", "Bitiş", "Gün", "Durum"],
            ...personelDetay.izinler.map(iz => [iz.izin_turu, new Date(iz.baslangic_tarihi).toLocaleDateString('tr-TR'), new Date(iz.bitis_tarihi).toLocaleDateString('tr-TR'), iz.kac_gun, "ONAYLI"])
        ];
        const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{wch:15}, {wch:15}, {wch:20}, {wch:10}, {wch:15}];
        ws['!merges'] = [{ s: {r:0, c:0}, e: {r:0, c:4} }];
        XLSX.utils.book_append_sheet(wb, ws, "Rapor"); XLSX.writeFile(wb, `${p.ad}_${p.soyad}.xlsx`);
    };

    const downloadBulkExcel = async () => {
        if(!confirm("Toplu Excel indirilsin mi?")) return; setYukleniyor(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/izin/rapor/tum-personel-detay`, { headers: { Authorization: `Bearer ${token}` } });
            const { personeller, gecmisBakiyeler, izinler } = res.data;
            const excelRows = [["MERSİN BÜYÜKŞEHİR BELEDİYESİ"], ["GENEL İZİN RAPORU"], [" "],
                ["TC", "Ad Soyad", "Birim", "Giriş", "Kıdem", "Ömür Boyu Hak", "Devreden", "Bu Yıl", "TOPLAM HAVUZ", "KULLANILAN", "KALAN", "DURUM"]];
            personeller.forEach((p) => {
                const pGecmis = gecmisBakiyeler.filter(g => g.personel_id === p.personel_id);
                const pIzinler = izinler.filter(iz => iz.personel_id === p.personel_id);
                let devreden = 0; pGecmis.forEach(g => devreden += g.gun_sayisi);
                const buYilHak = hesaplaDinamikHakedis(p.ise_giris_tarihi);
                const kumulatifHak = hesaplaKumulatifHakedis(p.ise_giris_tarihi);
                const toplamHavuz = devreden + buYilHak;
                let kullanilan = 0; pIzinler.forEach(iz => kullanilan += iz.kac_gun);
                const kalan = toplamHavuz - kullanilan;
                const kidem = Math.floor((new Date() - new Date(p.ise_giris_tarihi)) / (1000 * 60 * 60 * 24 * 365.25));
                excelRows.push([p.tc_no, `${p.ad} ${p.soyad}`, p.birim_adi, new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR'), kidem, kumulatifHak, devreden, buYilHak, toplamHavuz, kullanilan, kalan, kalan < 0 ? "LİMİT AŞIMI" : (kalan < 5 ? "AZALDI" : "NORMAL")]);
            });
            const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(excelRows);
            ws['!cols'] = [{wch:12}, {wch:25}, {wch:20}, {wch:12}, {wch:8}, {wch:15}, {wch:10}, {wch:10}, {wch:12}, {wch:12}, {wch:10}, {wch:15}];
            ws['!merges'] = [{s:{r:0,c:0},e:{r:0,c:11}}, {s:{r:1,c:0},e:{r:1,c:11}}];
            XLSX.utils.book_append_sheet(wb, ws, "Genel Rapor"); XLSX.writeFile(wb, `Genel_Rapor_${new Date().toISOString().slice(0,10)}.xlsx`);
        } catch (e) { alert("Hata"); } finally { setYukleniyor(false); }
    };

    // --- 🎨 PDF ÇIKTILARI (Renkli ve Resmi) ---
    // 1. KİŞİSEL DETAYLI PDF
    const generateDetailPDF = () => {
        if (!personelDetay) return;
        const p = personelDetay.personel;
        const doc = new jsPDF();

        // Başlık
        doc.setFontSize(16); doc.setTextColor(41, 128, 185); doc.text("ULAŞIM DAİRESİ BAŞKANLIĞI", 105, 20, null, null, "center");
        doc.setFontSize(12); doc.setTextColor(100); doc.text("Toplu Taşıma Şube Müdürlüğü - PERSONEL İZİN DETAY RAPORU", 105, 28, null, null, "center");
        doc.line(14, 32, 196, 32); // Çizgi

        // Personel Bilgileri Tablosu
        doc.autoTable({
            startY: 40,
            head: [['Personel Bilgileri', '']],
            body: [
                ['Adı Soyadı', `${p.ad} ${p.soyad}`], ['TC Kimlik No', p.tc_no],
                ['Sicil No', p.sicil_no || '-'], ['Birim', p.birim_adi],
                ['Kadro', p.kadro_tipi], ['İşe Giriş Tarihi', new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR')]
            ],
            theme: 'plain', styles: { fontSize: 10, cellPadding: 1.5 }, columnStyles: { 0: { fontStyle: 'bold', width: 50 } }
        });

        // Bakiye Özeti Tablosu (Renkli)
        const buYilHak = hesaplaDinamikHakedis(p.ise_giris_tarihi);
        const toplamHavuz = (p.devreden_izin || 0) + (buYilHak || 0);
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 10,
            head: [['Bakiye Özeti', 'Gün Sayısı']],
            body: [
                ['Ömür Boyu Toplam Hakediş', hesaplaKumulatifHakedis(p.ise_giris_tarihi)],
                ['Geçmişten Devreden (+)', p.devreden_izin],
                ['Bu Yıl Hakediş (+)', buYilHak],
                ['Kullanılabilir Toplam Havuz (=)', toplamHavuz],
                ['Toplam Kullanılan İzin (-)', personelDetay.personel.kullanilan],
                ['GÜNCEL KALAN BAKİYE', personelDetay.personel.kalan]
            ],
            theme: 'grid', headStyles: { fillColor: [41, 128, 185] },
            columnStyles: { 0: { width: 100 }, 1: { fontStyle: 'bold', halign: 'center' } },
            didParseCell: function (data) {
                if (data.row.index === 5 && data.column.index === 1) {
                    data.cell.styles.textColor = p.kalan < 0 ? [231, 76, 60] : [39, 174, 96];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        // İzin Hareketleri Tablosu (Şeritli)
        const tableBody = personelDetay.izinler.map(iz => [
            iz.izin_turu, new Date(iz.baslangic_tarihi).toLocaleDateString('tr-TR'), new Date(iz.bitis_tarihi).toLocaleDateString('tr-TR'), iz.kac_gun, "ONAYLI"
        ]);
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 15,
            head: [['İzin Türü', 'Başlangıç', 'Bitiş', 'Gün', 'Durum']],
            body: tableBody,
            theme: 'striped', headStyles: { fillColor: [52, 73, 94] },
            styles: { halign: 'center' }, columnStyles: { 0: { halign: 'left' } }
        });

        // Alt Bilgi
        const today = new Date().toLocaleDateString('tr-TR');
        doc.setFontSize(8); doc.setTextColor(150);
        doc.text(`Bu rapor ${today} tarihinde sistemden otomatik oluşturulmuştur.`, 14, doc.internal.pageSize.height - 10);

        doc.save(`${p.ad}_${p.soyad}_Detayli_Rapor.pdf`);
    };

    // 2. TOPLU PDF (Yatay ve Renkli)
    const downloadBulkPDF = async () => {
        if(!confirm("Toplu PDF raporu oluşturulsun mu?")) return; setYukleniyor(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/izin/rapor/tum-personel-detay`, { headers: { Authorization: `Bearer ${token}` } });
            const { personeller, gecmisBakiyeler, izinler } = res.data;
            
            const doc = new jsPDF('l', 'mm', 'a4'); // Yatay (Landscape)

            doc.setFontSize(18); doc.setTextColor(41, 128, 185); doc.text("TOPLU TAŞIMA ŞUBE MÜDÜRLÜĞÜ", 148.5, 20, null, null, "center");
            doc.setFontSize(12); doc.setTextColor(100); doc.text("GENEL İZİN DURUM RAPORU", 148.5, 28, null, null, "center");

            const tableBody = personeller.map((p, index) => {
                const pGecmis = gecmisBakiyeler.filter(g => g.personel_id === p.personel_id);
                const pIzinler = izinler.filter(iz => iz.personel_id === p.personel_id);
                let devreden = 0; pGecmis.forEach(g => devreden += g.gun_sayisi);
                const buYilHak = hesaplaDinamikHakedis(p.ise_giris_tarihi);
                const toplamHavuz = devreden + buYilHak;
                let kullanilan = 0; pIzinler.forEach(iz => kullanilan += iz.kac_gun);
                const kalan = toplamHavuz - kullanilan;
                let durum = "NORMAL"; if(kalan < 0) durum = "LİMİT AŞIMI"; else if (kalan < 5) durum = "AZALDI";

                return [index + 1, p.tc_no, `${p.ad} ${p.soyad}`, p.birim_adi, new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR'), 
                        hesaplaKumulatifHakedis(p.ise_giris_tarihi), devreden, buYilHak, toplamHavuz, kullanilan, kalan, durum];
            });

            doc.autoTable({
                startY: 35,
                head: [['Sıra', 'TC', 'Ad Soyad', 'Birim', 'Giriş', 'Ömür Boyu', 'Devr.', 'Bu Yıl', 'Havuz', 'Kull.', 'Kalan', 'Durum']],
                body: tableBody,
                theme: 'grid', headStyles: { fillColor: [41, 128, 185], fontSize: 9 },
                styles: { fontSize: 8, halign: 'center', cellPadding: 1 },
                columnStyles: { 2: { halign: 'left' }, 3: { halign: 'left' }, 11: { fontStyle: 'bold' } },
                didParseCell: function(data) {
                    if (data.column.index === 11) {
                        if (data.cell.raw === "LİMİT AŞIMI") data.cell.styles.textColor = [231, 76, 60];
                        else if (data.cell.raw === "AZALDI") data.cell.styles.textColor = [243, 156, 18];
                        else data.cell.styles.textColor = [39, 174, 96];
                    }
                }
            });
            doc.save(`Genel_Rapor_${new Date().toISOString().slice(0,10)}.pdf`);
        } catch (e) { alert("Hata"); } finally { setYukleniyor(false); }
    };


    const filtered = rapor.filter(p => p.ad.toLowerCase().includes(arama.toLowerCase()) || p.tc_no.includes(arama));

    return (
        <div className="container-fluid p-4 p-lg-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="fw-bold text-dark m-0"><FileBarChart size={28} className="me-2 text-primary"/> İzin Takip Raporu</h2>
                <div className="d-flex gap-2">
                    {/* --- YENİ ŞIK BUTONLAR (TOPLU) --- */}
                    <button className="btn btn-success shadow-sm d-flex align-items-center gap-2" onClick={downloadBulkExcel} disabled={yukleniyor}>
                        <FileSpreadsheet size={20}/> <span className="d-none d-md-inline">Tüm Liste (Excel)</span>
                    </button>
                    <button className="btn btn-danger shadow-sm d-flex align-items-center gap-2" onClick={downloadBulkPDF} disabled={yukleniyor}>
                        <FileTypePdf size={20}/> <span className="d-none d-md-inline">Tüm Liste (PDF)</span>
                    </button>
                </div>
            </div>
            
            <div className="card border-0 shadow-sm mb-4 rounded-4"><div className="card-body p-3">
                <div className="input-group" style={{maxWidth: '400px'}}><span className="input-group-text bg-white border-end-0"><Search size={18} className="text-muted"/></span><input type="text" className="form-control border-start-0" placeholder="Ara..." value={arama} onChange={e=>setArama(e.target.value)}/></div>
            </div></div>

            <div className="card shadow-sm border-0 rounded-4 overflow-hidden"><div className="card-body p-0"><div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                    <thead className="bg-light text-muted small text-uppercase">
                        <tr>
                            <th className="ps-4 py-3">Personel</th>
                            <th>İşe Giriş</th>
                            <th className="text-center bg-secondary-subtle text-secondary-emphasis border-start border-end">Kümülatif<br/>(Ömür Boyu)</th>
                            <th className="text-center bg-warning-subtle text-warning-emphasis">Devreden</th>
                            <th className="text-center bg-info-subtle text-info-emphasis">Bu Yıl</th>
                            <th className="text-center fw-bold">Toplam<br/>Havuz</th>
                            <th className="text-center">Kullanılan</th>
                            <th className="text-center">Kalan</th>
                            <th className="text-end pe-4">Durum</th>
                        </tr>
                    </thead>
                    <tbody>
                        {yukleniyor ? <tr><td colSpan="9" className="text-center py-5">Yükleniyor...</td></tr> : filtered.map((p, i) => {
                            const toplamHavuz = (p.devreden_izin || 0) + (p.bu_yil_hakedis || 0);
                            const kumulatif = hesaplaKumulatifHakedis(p.ise_giris_tarihi); 
                            const toplamKullanilan = p.bu_yil_kullanilan || 0; 
                            
                            return (
                                <tr key={i} onClick={() => handlePersonelClick(p)} style={{cursor: 'pointer'}}>
                                    <td className="ps-4 fw-bold">{p.ad} {p.soyad}<br/><small className="fw-normal text-muted">{p.tc_no}</small></td>
                                    <td className="text-muted small">{new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR')}</td>
                                    <td className="text-center bg-secondary-subtle text-dark fw-bold border-start border-end fs-6">{kumulatif}</td>
                                    <td className="text-center bg-warning-subtle text-dark">{p.devreden_izin}</td>
                                    <td className="text-center bg-info-subtle text-dark">{p.bu_yil_hakedis}</td>
                                    <td className="text-center fw-bold fs-6">{toplamHavuz}</td>
                                    <td className="text-center text-muted">{toplamKullanilan}</td>
                                    <td className="text-center"><span className={`badge ${p.kalan < 5 ? 'bg-danger' : 'bg-primary'} rounded-pill`}>{p.kalan}</span></td>
                                    <td className="text-end pe-4">{p.kalan < 0 ? <span className="badge bg-danger">LİMİT AŞIMI</span> : <CheckCircle size={16} className="text-success"/>}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div></div></div>

            {secilenPersonel && (
                <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content shadow-lg border-0 rounded-4">
                            {/* --- YENİ MODAL BAŞLIĞI (FOTOĞRAFLI) --- */}
                            <div className="modal-header bg-primary text-white p-4 align-items-center">
                                <div className="d-flex align-items-center gap-3">
                                    <img 
                                        src={secilenPersonel.fotograf_yolu || DEFAULT_PHOTO} 
                                        alt={secilenPersonel.ad}
                                        className="rounded-circle border border-3 border-white shadow-sm"
                                        style={{width: '64px', height: '64px', objectFit: 'cover'}}
                                        onError={(e) => {e.target.src = DEFAULT_PHOTO}} // Resim yüklenemezse varsayılanı göster
                                    />
                                    <div>
                                        <h5 className="modal-title fw-bold mb-1">{secilenPersonel.ad} {secilenPersonel.soyad}</h5>
                                        <p className="m-0 opacity-75 small">{secilenPersonel.birim_adi} | {secilenPersonel.kadro_tipi}</p>
                                    </div>
                                </div>
                                <button className="btn-close btn-close-white align-self-start" onClick={() => setSecilenPersonel(null)}></button>
                            </div>
                            
                            <div className="modal-body bg-light p-4">
                                {detayYukleniyor ? <div className="text-center py-5">Yükleniyor...</div> : personelDetay && (
                                    <div className="row g-4">
                                        <div className="col-md-4">
                                            <div className="card border-0 shadow-sm h-100"><div className="card-body">
                                                <h6 className="text-muted small fw-bold mb-4 d-flex align-items-center gap-2"><Calculator size={18} className="text-primary"/> BAKİYE ÖZETİ</h6>
                                                
                                                <div className="p-3 bg-primary bg-opacity-10 rounded-3 mb-3 border border-primary border-opacity-25 text-center">
                                                    <small className="text-primary fw-bold">Ömür Boyu Toplam Hak</small>
                                                    <div className="fs-2 fw-bold text-primary">{hesaplaKumulatifHakedis(secilenPersonel.ise_giris_tarihi)} Gün</div>
                                                </div>

                                                <ul className="list-group list-group-flush small mb-4">
                                                    <li className="list-group-item d-flex justify-content-between px-0 bg-transparent"><span>Sisteme Devreden:</span><strong className="text-warning">+{secilenPersonel.devreden_izin}</strong></li>
                                                    <li className="list-group-item d-flex justify-content-between px-0 bg-transparent"><span>Bu Yıl Hakediş:</span><strong className="text-info">+{secilenPersonel.bu_yil_hakedis}</strong></li>
                                                    <li className="list-group-item d-flex justify-content-between px-0 bg-transparent fw-bold"><span>Kullanılabilir Toplam:</span><strong className="text-dark fs-6">{(secilenPersonel.devreden_izin || 0) + (secilenPersonel.bu_yil_hakedis || 0)}</strong></li>
                                                    <li className="list-group-item d-flex justify-content-between px-0 bg-transparent text-danger"><span>Toplam Kullanılan:</span><strong>-{personelDetay.personel.kullanilan}</strong></li>
                                                </ul>
                                                
                                                <div className={`alert ${personelDetay.personel.kalan < 0 ? 'alert-danger' : 'alert-success'} mb-0 text-center`}>
                                                    <small className="d-block fw-bold mb-1">GÜNCEL KALAN BAKİYE</small>
                                                    <span className="fs-3 fw-bold">{personelDetay.personel.kalan} Gün</span>
                                                </div>
                                            </div></div>
                                        </div>
                                        <div className="col-md-8">
                                            <div className="card border-0 shadow-sm h-100">
                                                <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                                                    <h6 className="m-0 fw-bold text-primary d-flex align-items-center gap-2"><History size={18}/> İzin Geçmişi</h6>
                                                    
                                                    {/* --- YENİ ŞIK BUTONLAR (TEKİL) --- */}
                                                    <div className="d-flex gap-2">
                                                        <button className="btn btn-sm btn-outline-success d-flex align-items-center gap-1 fw-bold" onClick={generateDetailExcel}>
                                                            <FileSpreadsheet size={16}/> Excel
                                                        </button>
                                                        <button className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1 fw-bold" onClick={generateDetailPDF}>
                                                            <FileTypePdf size={16}/> PDF Rapor
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="table-responsive h-100"><table className="table table-hover mb-0 small">
                                                    <thead className="table-light"><tr><th>Tür</th><th>Başlangıç</th><th>Bitiş</th><th>Gün</th><th>Durum</th></tr></thead>
                                                    <tbody>{personelDetay.izinler.map((iz, idx) => (<tr key={idx}><td>{iz.izin_turu}</td><td>{new Date(iz.baslangic_tarihi).toLocaleDateString('tr-TR')}</td><td>{new Date(iz.bitis_tarihi).toLocaleDateString('tr-TR')}</td><td className="fw-bold">{iz.kac_gun}</td><td><span className="badge bg-success">Onaylı</span></td></tr>))}</tbody>
                                                </table></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}