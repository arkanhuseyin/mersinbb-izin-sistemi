import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Download, AlertTriangle, Search, FileBarChart, CheckCircle, User, FileText, History, Calculator } from 'lucide-react';
import * as XLSX from 'xlsx'; 

export default function LeaveReports() {
    const [rapor, setRapor] = useState([]);
    const [arama, setArama] = useState('');
    const [yukleniyor, setYukleniyor] = useState(true);

    // 🔥 DİNAMİK KURALLAR STATE'İ
    const [hakedisKurallari, setHakedisKurallari] = useState([]);

    // Modal ve Detay State'leri
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

    // --- 🧮 YARDIMCI: Tekil Yıl İçin Hakediş Hesapla (Veritabanı + Eski Sistem) ---
    const hakedisBul = (girisYili, hesaplanacakYil, kidemYili) => {
        // 1. Veritabanına Bak (O yıl ve kıdem için kural var mı?)
        const uygunKural = hakedisKurallari.find(k => 
            hesaplanacakYil >= k.baslangic_yili && 
            hesaplanacakYil <= k.bitis_yili && 
            kidemYili >= k.kidem_alt && 
            kidemYili <= k.kidem_ust
        );

        if (uygunKural) return uygunKural.gun_sayisi;

        // 2. Kural Yoksa: Eski Sistem (Yedek)
        let hak = 0;
        
        // 2007 Öncesi Düzeltmesi
        let bazYil = girisYili;
        if (girisYili < 2007) bazYil = 2007;

        if (bazYil < 2018) {
            if (kidemYili <= 5) hak = 14; 
            else if (kidemYili <= 15) hak = 19; 
            else hak = 25;
        } else if (bazYil < 2024) {
            if (bazYil < 2019) {
                if (kidemYili <= 5) hak = 14; else if (kidemYili <= 15) hak = 19; else hak = 25;
            } else {
                if (kidemYili <= 3) hak = 16; else if (kidemYili <= 5) hak = 18; else if (kidemYili <= 15) hak = 25; else hak = 30;
            }
        } else {
            if (bazYil < 2025) {
                if (kidemYili <= 3) hak = 16; else if (kidemYili <= 5) hak = 18; else if (kidemYili <= 15) hak = 25; else hak = 30;
            } else {
                if (kidemYili <= 3) hak = 18; else if (kidemYili <= 5) hak = 20; else if (kidemYili <= 15) hak = 27; else hak = 32;
            }
        }
        return hak;
    };

    // --- 🔥 DİNAMİK HESAPLAMA MOTORU (Bu Yıl İçin) 🔥 ---
    const hesaplaDinamikHakedis = useCallback((iseGirisTarihi) => {
        if (!iseGirisTarihi) return 0;
        const giris = new Date(iseGirisTarihi);
        const girisYili = giris.getFullYear();
        const bugun = new Date();
        const farkMs = bugun - giris;
        const kidemYili = Math.floor(farkMs / (1000 * 60 * 60 * 24 * 365.25));

        if (kidemYili < 1) return 0;
        return hakedisBul(girisYili, bugun.getFullYear(), kidemYili);
    }, [hakedisKurallari]);

    // --- 🗓️ KÜMÜLATİF (ÖMÜR BOYU) HESAPLAMA ---
    const hesaplaKumulatifHakedis = useCallback((iseGirisTarihi) => {
        if (!iseGirisTarihi) return 0;
        
        const giris = new Date(iseGirisTarihi);
        const bugun = new Date();
        let toplamHak = 0;
        
        // Döngü: İşe giriş tarihinden başla, her yıl dönümünde hak ekle
        let currentCalcDate = new Date(giris);
        currentCalcDate.setFullYear(currentCalcDate.getFullYear() + 1); // İlk hak ediş 1. yıl sonunda

        while (currentCalcDate <= bugun) {
            // O tarihteki kıdemi ve yılı bul
            const hesapYili = currentCalcDate.getFullYear();
            const farkMs = currentCalcDate - giris;
            const oAnkiKidem = Math.floor(farkMs / (1000 * 60 * 60 * 24 * 365.25));

            if (oAnkiKidem >= 1) {
                const hak = hakedisBul(giris.getFullYear(), hesapYili, oAnkiKidem);
                toplamHak += hak;
            }
            // Bir sonraki yıla geç
            currentCalcDate.setFullYear(currentCalcDate.getFullYear() + 1);
        }

        return toplamHak;
    }, [hakedisKurallari]);


    // Personel Satırına Tıklanınca
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

    // --- 🚀 KİŞİSEL DETAYLI EXCEL RAPORU ---
    const generateDetailExcel = () => {
        if (!personelDetay) return;
        const p = personelDetay.personel;
        const gecmis = [...personelDetay.gecmisBakiyeler]; 
        const izinler = personelDetay.izinler;

        let izinHavuzu = [];
        gecmis.forEach(g => { izinHavuzu.push({ yil: g.yil, hak: g.gun_sayisi, kalan: g.gun_sayisi }); });

        const buYilHak = hesaplaDinamikHakedis(p.ise_giris_tarihi);
        const buYil = new Date().getFullYear();
        izinHavuzu.push({ yil: buYil, hak: buYilHak, kalan: buYilHak });

        const islenenIzinler = izinler.map(izin => {
            if (izin.izin_turu !== 'YILLIK İZİN') return { ...izin, dusumAciklamasi: 'Yıllık izin bakiyesinden düşülmez.' };
            let dusulecekGun = parseInt(izin.kac_gun);
            let dusumKaydi = [];

            for (let i = 0; i < izinHavuzu.length; i++) {
                let h = izinHavuzu[i];
                if (dusulecekGun <= 0) break;
                if (h.kalan > 0) {
                    let alinan = Math.min(h.kalan, dusulecekGun);
                    h.kalan -= alinan;
                    dusulecekGun -= alinan;
                    dusumKaydi.push(`${h.yil} yılından ${alinan} gün`);
                }
                if (i === izinHavuzu.length - 1 && dusulecekGun > 0) {
                    h.kalan -= dusulecekGun;
                    dusumKaydi.push(`${h.yil} yılından (Avans/Limit Dışı) ${dusulecekGun} gün`);
                    dusulecekGun = 0;
                }
            }
            return { ...izin, dusumAciklamasi: dusumKaydi.join(', ') };
        });

        const wb = XLSX.utils.book_new();
        const wsData = [
            ["MERSİN BÜYÜKŞEHİR BELEDİYESİ"],
            ["ULAŞIM DAİRESİ BAŞKANLIĞI - Toplu Taşıma Şube Müdürlüğü"],
			["PERSONEL İZİN DETAY RAPORU"],
            [""],
            ["PERSONEL KİMLİK BİLGİLERİ"],
            ["TC Kimlik No", p.tc_no, "Adı Soyadı", `${p.ad} ${p.soyad}`],
            ["Sicil No", p.sicil_no || '-', "Birim", p.birim_adi],
            ["Kadro Tipi", p.kadro_tipi, "Görevi", p.gorev],
            ["İşe Giriş Tarihi", new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR'), "Kıdem", `${Math.floor((new Date() - new Date(p.ise_giris_tarihi)) / (1000 * 60 * 60 * 24 * 365.25))} Yıl`],
            [""],
            ["İZİN BAKİYE ÖZETİ"],
            ["AÇIKLAMA", "GÜN SAYISI"],
            ["Kümülatif (Ömür Boyu) Hak", hesaplaKumulatifHakedis(p.ise_giris_tarihi)],
            ["Sisteme Girilen Devreden", p.devreden_izin],
            ["Bu Yıl Hakediş", buYilHak],
            ["Toplam Kullanılabilir", (p.devreden_izin || 0) + (buYilHak || 0)],
            ["TOPLAM KULLANILAN", personelDetay.personel.kullanilan],
            ["GÜNCEL KALAN BAKİYE", personelDetay.personel.kalan],
            [""],
            ["İZİN HAREKET DÖKÜMÜ"],
            ["Sıra", "İzin Türü", "Başlangıç Tarihi", "Bitiş Tarihi", "Gün Sayısı", "Durum", "Düşüm Açıklaması"]
        ];

        islenenIzinler.forEach((iz, index) => {
            wsData.push([
                index + 1,
                iz.izin_turu,
                new Date(iz.baslangic_tarihi).toLocaleDateString('tr-TR'),
                new Date(iz.bitis_tarihi).toLocaleDateString('tr-TR'),
                iz.kac_gun,
                "ONAYLI",
                iz.dusumAciklamasi
            ]);
        });

        wsData.push([""]);
        wsData.push(["Rapor Oluşturma Tarihi:", new Date().toLocaleString('tr-TR')]);

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        // Stil Ayarları (Genişlik)
        ws['!cols'] = [{wch:5}, {wch:25}, {wch:20}, {wch:20}, {wch:15}, {wch:15}, {wch:40}];
        
        // Birleştirme (Header)
        ws['!merges'] = [
            { s: {r:0, c:0}, e: {r:0, c:6} }, 
            { s: {r:1, c:0}, e: {r:1, c:6} }, 
            { s: {r:3, c:0}, e: {r:3, c:6} }, 
            { s: {r:9, c:0}, e: {r:9, c:6} }, 
            { s: {r:17, c:0}, e: {r:17, c:6} } 
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Detaylı Rapor");
        XLSX.writeFile(wb, `${p.ad}_${p.soyad}_Ozel_Rapor.xlsx`);
    };

    // --- 🌍 TOPLU EXCEL RAPORU ---
    const downloadBulkExcel = async () => {
        if(!confirm("Toplu rapor indirilsin mi?")) return;
        setYukleniyor(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/izin/rapor/tum-personel-detay`, { headers: { Authorization: `Bearer ${token}` } });
            const { personeller, gecmisBakiyeler, izinler } = res.data;
            
            const excelRows = [
                ["MERSİN BÜYÜKŞEHİR BELEDİYESİ - ULAŞIM DAİRESİ BAŞKANLIĞI"],
				["Toplu Taşıma Şube Müdürlüğü"],
                ["GENEL İZİN DURUM VE BAKİYE RAPORU"],
                ["Oluşturma Tarihi: " + new Date().toLocaleString('tr-TR')],
                [""],
                // Başlıklar
                [
                    "Sıra", "TC Kimlik", "Ad Soyad", "Birim", "Görevi", "İşe Giriş", "Kıdem (Yıl)", 
                    "ÖMÜR BOYU HAKEDİŞ", "GEÇMİŞTEN DEVREDEN", "BU YIL HAKEDİŞ", 
                    "TOPLAM KULLANILABİLİR", "TOPLAM KULLANILAN", "KALAN BAKİYE", "DURUM"
                ]
            ];

            personeller.forEach((p, index) => {
                const pGecmis = gecmisBakiyeler.filter(g => g.personel_id === p.personel_id);
                const pIzinler = izinler.filter(iz => iz.personel_id === p.personel_id);
                
                let devreden = 0; 
                pGecmis.forEach(g => devreden += g.gun_sayisi);
                
                const buYilHak = hesaplaDinamikHakedis(p.ise_giris_tarihi);
                const kumulatifHak = hesaplaKumulatifHakedis(p.ise_giris_tarihi); 
                
                const toplamHavuz = devreden + buYilHak;
                
                let kullanılan = 0;
                pIzinler.forEach(iz => kullanılan += iz.kac_gun);
                const kalan = toplamHavuz - kullanılan;
                
                const girisTarihi = new Date(p.ise_giris_tarihi);
                const kidem = Math.floor((new Date() - girisTarihi) / (1000 * 60 * 60 * 24 * 365.25));

                let durum = "NORMAL";
                if(kalan < 0) durum = "LİMİT AŞIMI";
                else if (kalan === 0) durum = "TÜKENDİ";
                else if (kalan < 5) durum = "AZALDI";

                excelRows.push([
                    index + 1, p.tc_no, `${p.ad} ${p.soyad}`, p.birim_adi, p.gorev,
                    girisTarihi.toLocaleDateString('tr-TR'), kidem, 
                    kumulatifHak, 
                    devreden, buYilHak, toplamHavuz, kullanılan, kalan, 
                    durum
                ]);
            });

            const ws = XLSX.utils.aoa_to_sheet(excelRows);
            const wb = XLSX.utils.book_new();
            
            ws['!cols'] = [
                {wch:5}, {wch:15}, {wch:25}, {wch:20}, {wch:20}, {wch:12}, {wch:8}, 
                {wch:20}, {wch:15}, {wch:15}, {wch:15}, {wch:15}, {wch:15}, {wch:15}
            ];

            ws['!merges'] = [
                { s: {r:0, c:0}, e: {r:0, c:13} },
                { s: {r:1, c:0}, e: {r:1, c:13} },
                { s: {r:2, c:0}, e: {r:2, c:13} }
            ];

            XLSX.utils.book_append_sheet(wb, ws, "Genel Rapor");
            XLSX.writeFile(wb, `Genel_Rapor_${new Date().toISOString().slice(0,10)}.xlsx`);
        } catch (e) { alert("Hata"); } finally { verileriGetir(); }
    };

    const filtered = rapor.filter(p => p.ad.toLowerCase().includes(arama.toLowerCase()) || p.tc_no.includes(arama));

    return (
        <div className="container-fluid p-4 p-lg-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="fw-bold text-dark m-0"><FileBarChart size={28} className="me-2 text-primary"/> İzin Takip Raporu</h2>
                <button className="btn btn-success shadow-sm" onClick={downloadBulkExcel} disabled={yukleniyor}><Download size={18} className="me-2"/> Toplu Excel İndir</button>
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
                            {/* ✅ YENİ SÜTUN: KÜMÜLATİF */}
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
                            <div className="modal-header bg-primary text-white"><h5 className="modal-title fw-bold">{secilenPersonel.ad} {secilenPersonel.soyad}</h5><button className="btn-close btn-close-white" onClick={() => setSecilenPersonel(null)}></button></div>
                            <div className="modal-body bg-light">
                                {detayYukleniyor ? <div className="text-center py-5">Yükleniyor...</div> : personelDetay && (
                                    <div className="row g-4">
                                        <div className="col-md-4">
                                            <div className="card border-0 shadow-sm mb-3"><div className="card-body">
                                                <h6 className="text-muted small fw-bold mb-3 d-flex align-items-center gap-2"><Calculator size={16}/> BAKİYE DETAYI</h6>
                                                
                                                <div className="d-flex justify-content-between mb-2 p-2 bg-secondary-subtle rounded border border-secondary border-opacity-10">
                                                    <span>Ömür Boyu Hakediş:</span>
                                                    <strong className="text-dark fs-5">{hesaplaKumulatifHakedis(secilenPersonel.ise_giris_tarihi)} Gün</strong>
                                                </div>

                                                <div className="d-flex justify-content-between mb-2"><span>Sisteme Girilen Devreden:</span><strong className="text-warning">+{secilenPersonel.devreden_izin}</strong></div>
                                                <div className="d-flex justify-content-between mb-2"><span>Bu Yıl Hakediş:</span><strong className="text-info">+{secilenPersonel.bu_yil_hakedis}</strong></div>
                                                <div className="d-flex justify-content-between mb-2"><span>Kullanılabilir Toplam:</span><strong className="text-dark">{(secilenPersonel.devreden_izin || 0) + (secilenPersonel.bu_yil_hakedis || 0)}</strong></div>
                                                <hr className="my-2"/>
                                                <div className="d-flex justify-content-between mb-2"><span>Toplam Kullanılan:</span><strong className="text-danger">-{personelDetay.personel.kullanilan}</strong></div>
                                                <div className="alert alert-primary mb-0 text-center fw-bold fs-5">Kalan: {personelDetay.personel.kalan} Gün</div>
                                            </div></div>
                                        </div>
                                        <div className="col-md-8">
                                            <div className="card border-0 shadow-sm h-100">
                                                <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                                                    <h6 className="m-0 fw-bold text-primary d-flex align-items-center gap-2"><History size={18}/> İzin Geçmişi</h6>
                                                    <button className="btn btn-sm btn-success shadow-sm" onClick={generateDetailExcel}><FileText size={14} className="me-1"/> Raporu İndir (.xlsx)</button>
                                                </div>
                                                <div className="table-responsive"><table className="table table-hover mb-0 small">
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