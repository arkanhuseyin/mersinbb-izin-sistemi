import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Download, AlertTriangle, Search, FileBarChart, CheckCircle, User, X, FileText } from 'lucide-react';
import * as XLSX from 'xlsx'; 

export default function LeaveReports() {
    const [rapor, setRapor] = useState([]);
    const [arama, setArama] = useState('');
    const [yukleniyor, setYukleniyor] = useState(true);

    // 🔥 DİNAMİK KURALLAR STATE'İ (Veritabanından gelecek)
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
        
        // Hem Raporu Hem Kuralları Çek
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

    // --- 🔥 DİNAMİK HESAPLAMA MOTORU (BACKEND İLE BİREBİR AYNI) 🔥 ---
    const hesaplaDinamikHakedis = useCallback((iseGirisTarihi) => {
        if (!iseGirisTarihi) return 0;
        
        const giris = new Date(iseGirisTarihi);
        const girisYili = giris.getFullYear();
        const bugun = new Date();
        const farkMs = bugun - giris;
        const kidemYili = Math.floor(farkMs / (1000 * 60 * 60 * 24 * 365.25));

        // 🛑 KURAL: 1 Yılını Doldurmayan İzin Alamaz
        if (kidemYili < 1) return 0;

        // 1. ÖNCE VERİTABANINA BAK (Yeni Kurallar)
        const uygunKural = hakedisKurallari.find(k => 
            girisYili >= k.baslangic_yili && 
            girisYili <= k.bitis_yili && 
            kidemYili >= k.kidem_alt && 
            kidemYili <= k.kidem_ust
        );

        if (uygunKural) {
            return uygunKural.gun_sayisi;
        }

        // 2. KURAL YOKSA: ESKİ SİSTEM (EXCEL MANTIĞI - YEDEK)
        let hak = 0;
        
        // 2018'den önce işe başlayanlar
        if (girisYili < 2018) {
            if (kidemYili <= 5) hak = 14;
            else if (kidemYili <= 15) hak = 19;
            else hak = 25;
        }
        // 2018-2023 arası işe başlayanlar
        else if (girisYili < 2024) {
            if (girisYili < 2019) { // 2018
                if (kidemYili <= 5) hak = 14;
                else if (kidemYili <= 15) hak = 19;
                else hak = 25;
            } else { // 2019-2023
                if (kidemYili <= 3) hak = 16;
                else if (kidemYili <= 5) hak = 18;
                else if (kidemYili <= 15) hak = 25;
                else hak = 30;
            }
        }
        // 2024 ve sonrası
        else {
            if (girisYili < 2025) { // 2024
                if (kidemYili <= 3) hak = 16;
                else if (kidemYili <= 5) hak = 18;
                else if (kidemYili <= 15) hak = 25;
                else hak = 30;
            } else { // 2025 ve sonrası
                if (kidemYili <= 3) hak = 18;
                else if (kidemYili <= 5) hak = 20;
                else if (kidemYili <= 15) hak = 27;
                else hak = 32;
            }
        }
        return hak;

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
        } catch (e) {
            alert("Detaylar çekilemedi.");
        }
        setDetayYukleniyor(false);
    };

    // --- 🚀 AKILLI EXCEL RAPORU OLUŞTURMA (TEK KİŞİ) ---
    const generateDetailExcel = () => {
        if (!personelDetay) return;

        const p = personelDetay.personel;
        const gecmis = [...personelDetay.gecmisBakiyeler]; 
        const izinler = personelDetay.izinler;

        // 1. Havuz Oluştur
        let izinHavuzu = [];
        gecmis.forEach(g => {
            izinHavuzu.push({ yil: g.yil, hak: g.gun_sayisi, kalan: g.gun_sayisi });
        });

        // ✅ DİNAMİK HESAPLAMA ÇAĞRISI (Yeni Sisteme Göre)
        const buYilHak = hesaplaDinamikHakedis(p.ise_giris_tarihi);
        const buYil = new Date().getFullYear();
        
        izinHavuzu.push({ yil: buYil, hak: buYilHak, kalan: buYilHak });

        // 2. İzinleri Düş (FIFO Mantığı)
        const islenenIzinler = izinler.map(izin => {
            if (izin.izin_turu !== 'YILLIK İZİN') {
                return { ...izin, dusumAciklamasi: 'Yıllık izin bakiyesinden düşülmez.' };
            }

            let dusulecekGun = izin.kac_gun;
            let dusumKaydi = [];

            for (let h of izinHavuzu) {
                if (dusulecekGun <= 0) break;
                if (h.kalan > 0) {
                    let alinan = Math.min(h.kalan, dusulecekGun);
                    h.kalan -= alinan;
                    dusulecekGun -= alinan;
                    dusumKaydi.push(`${h.yil} yılı bakiyesinden ${alinan} gün`);
                }
            }

            let sonucYazisi = dusumKaydi.length > 0 
                ? `${dusumKaydi.join(', ')} kullanıldı.` 
                : 'Yetersiz bakiye veya eksiye düşüldü.';
            
            return { ...izin, dusumAciklamasi: sonucYazisi };
        });

        // 3. Excel Verisini Hazırla
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["MERSİN BÜYÜKŞEHİR BELEDİYESİ - ULAŞIM DAİRESİ BAŞKANLIĞI"],
            ["PERSONEL DETAYLI İZİN HAREKET VE BAKİYE RAPORU"],
            [""],
            ["PERSONEL BİLGİLERİ", "", "", ""],
            ["TC Kimlik No", p.tc_no, "Adı Soyadı", `${p.ad} ${p.soyad}`],
            ["Sicil No", p.sicil_no || '-', "Birim", p.birim_adi],
            ["İşe Giriş Tarihi", new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR'), "Kadro", p.kadro_tipi],
            [""],
            ["İZİN HAKEDİŞ DURUMU (YILLARA GÖRE)", "", "", ""],
            ["Yıl", "Hakediş Miktarı", "Kalan Bakiye", "Durum"]
        ];

        izinHavuzu.forEach(h => {
            wsData.push([h.yil, `${h.hak} Gün`, `${h.kalan} Gün`, h.kalan === 0 ? "Tükendi" : "Mevcut"]);
        });

        wsData.push([""]);
        wsData.push(["KULLANILAN İZİN GEÇMİŞİ VE DÜŞÜM DETAYLARI"]);
        wsData.push(["İzin Türü", "Başlangıç", "Bitiş", "Gün", "Hakedişten Düşüm Açıklaması (Sistem Analizi)"]);

        islenenIzinler.forEach(iz => {
            wsData.push([
                iz.izin_turu,
                new Date(iz.baslangic_tarihi).toLocaleDateString('tr-TR'),
                new Date(iz.bitis_tarihi).toLocaleDateString('tr-TR'),
                iz.kac_gun,
                iz.dusumAciklamasi
            ]);
        });
        
        wsData.push([""]);
        wsData.push(["Not: Bu rapor sistem verilerine dayanarak otomatik oluşturulmuştur."]);

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 60 }];
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
            { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } },
            { s: { r: 8, c: 0 }, e: { r: 8, c: 4 } },
            { s: { r: 10 + izinHavuzu.length + 1, c: 0 }, e: { r: 10 + izinHavuzu.length + 1, c: 4 } }
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Detaylı Rapor");
        XLSX.writeFile(wb, `${p.ad}_${p.soyad}_Detayli_Izin_Raporu.xlsx`);
    };

    // --- 🌍 TOPLU EXCEL RAPORU (TÜM PERSONEL - GÜNCELLENMİŞ HESAPLAMA) ---
    const downloadBulkExcel = async () => {
        const confirm = window.confirm("Tüm aktif personelin detaylı raporu oluşturulacak. Bu işlem birkaç saniye sürebilir. Onaylıyor musunuz?");
        if (!confirm) return;

        setYukleniyor(true); 

        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/izin/rapor/tum-personel-detay`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const { personeller, gecmisBakiyeler, izinler } = res.data;
            const excelRows = [];

            // Başlık Satırları
            excelRows.push(["MERSİN BÜYÜKŞEHİR BELEDİYESİ - ULAŞIM DAİRESİ BAŞKANLIĞI"]);
            excelRows.push(["GENEL İZİN DURUM VE BAKİYE RAPORU (" + new Date().toLocaleDateString('tr-TR') + ")"]);
            excelRows.push([""]);
            excelRows.push([
                "Sıra", "TC No", "Ad Soyad", "Sicil No", "Birim", "Kadro", "İşe Giriş", 
                "Kıdem (Yıl)", "Devreden (Geçmiş)", "Bu Yıl Hak", "TOPLAM HAVUZ", 
                "KULLANILAN", "KALAN BAKİYE", "DURUM"
            ]);

            // Her Personel İçin Hesaplama
            personeller.forEach((p, index) => {
                // A. Kişiye ait verileri filtrele
                const pGecmis = gecmisBakiyeler.filter(g => g.personel_id === p.personel_id);
                const pIzinler = izinler.filter(iz => iz.personel_id === p.personel_id);

                // B. Havuz Hesabı
                let toplamGecmis = 0;
                pGecmis.forEach(g => toplamGecmis += g.gun_sayisi);

                const giris = new Date(p.ise_giris_tarihi);
                const bugun = new Date();
                const farkMs = bugun - giris;
                const kidemYili = Math.floor(farkMs / (1000 * 60 * 60 * 24 * 365.25));
                
                // ✅ DİNAMİK HAKEDİŞ ÇAĞRISI (Hibrit Sistem)
                const buYilHak = hesaplaDinamikHakedis(p.ise_giris_tarihi);
                const toplamHavuz = toplamGecmis + buYilHak;

                // C. Kullanılan Hesabı (Sadece Yıllık İzin)
                let toplamKullanilan = 0;
                pIzinler.forEach(iz => toplamKullanilan += iz.kac_gun);

                // D. Sonuç
                const kalan = toplamHavuz - toplamKullanilan;
                const durum = kalan < 0 ? "EKSİ BAKİYE" : (kalan < 5 ? "KRİTİK" : "NORMAL");

                // E. Excel Satırını Ekle
                excelRows.push([
                    index + 1,
                    p.tc_no,
                    `${p.ad} ${p.soyad}`,
                    p.sicil_no || '-',
                    p.birim_adi,
                    p.kadro_tipi,
                    new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR'),
                    kidemYili,
                    toplamGecmis,      // Devreden
                    buYilHak,          // Bu Yıl (Dinamik)
                    toplamHavuz,       // Toplam
                    toplamKullanilan,  // Kullanılan
                    kalan,             // Kalan
                    durum
                ]);
            });

            // Dosyayı Oluştur ve İndir
            const ws = XLSX.utils.aoa_to_sheet(excelRows);
            const wb = XLSX.utils.book_new();

            // Sütun Genişlikleri
            ws['!cols'] = [
                { wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 10 }, { wch: 20 }, 
                { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, 
                { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }
            ];

            XLSX.utils.book_append_sheet(wb, ws, "Genel Rapor");
            XLSX.writeFile(wb, `Tum_Personel_Izin_Raporu_${new Date().toISOString().slice(0,10)}.xlsx`);

        } catch (error) {
            console.error(error);
            alert("Rapor oluşturulurken hata çıktı.");
        } finally {
            verileriGetir(); 
        }
    };

    // Arama Filtresi
    const filtered = rapor.filter(p => 
        p.ad.toLowerCase().includes(arama.toLowerCase()) || 
        p.soyad.toLowerCase().includes(arama.toLowerCase()) ||
        p.tc_no.includes(arama)
    );

    return (
        <div className="container-fluid p-4 p-lg-5">
            
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="fw-bold text-dark m-0 d-flex align-items-center gap-2">
                        <FileBarChart size={28} className="text-primary"/> İzin Takip Raporu
                    </h2>
                    <p className="text-muted m-0">Personele tıklayarak detaylı geçmiş ve bakiye analizi yapabilirsiniz.</p>
                </div>
                <div>
                    <button 
                        className="btn btn-success d-flex align-items-center gap-2 shadow-sm" 
                        onClick={downloadBulkExcel}
                        disabled={yukleniyor}
                    >
                        <Download size={18} /> 
                        {yukleniyor ? 'İşleniyor...' : 'Tüm Listeyi İndir (Excel)'}
                    </button>
                </div>
            </div>
            
            <div className="card border-0 shadow-sm mb-4 rounded-4">
                <div className="card-body p-3">
                    <div className="input-group" style={{maxWidth: '400px'}}>
                        <span className="input-group-text bg-white border-end-0 ps-3"><Search size={18} className="text-muted"/></span>
                        <input 
                            type="text" 
                            className="form-control border-start-0 ps-0" 
                            placeholder="Personel adı veya TC ile ara..." 
                            value={arama}
                            onChange={e=>setArama(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="bg-light text-uppercase small text-muted">
                                <tr>
                                    <th className="ps-4 py-3">Personel</th>
                                    <th>Birim</th>
                                    <th>İşe Giriş</th>
                                    <th className="text-center bg-warning-subtle text-warning-emphasis">Devreden</th>
                                    <th className="text-center bg-info-subtle text-info-emphasis">Bu Yıl</th>
                                    <th className="text-center fw-bold">Toplam Havuz</th>
                                    <th className="text-center">Kullanılan</th>
                                    <th className="text-center">Kalan</th>
                                    <th className="text-end pe-4">Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                {yukleniyor ? (
                                    <tr><td colSpan="9" className="text-center py-5">Yükleniyor...</td></tr>
                                ) : filtered.map((p, i) => (
                                    <tr key={i} className={p.uyari ? 'table-danger cursor-pointer' : 'cursor-pointer'} onClick={() => handlePersonelClick(p)} style={{cursor: 'pointer'}}>
                                        <td className="ps-4">
                                            <div className="fw-bold text-dark">{p.ad} {p.soyad}</div>
                                            <small className="text-muted font-monospace">{p.tc_no}</small>
                                        </td>
                                        <td><span className="badge bg-light text-dark border fw-normal">{p.birim_adi}</span></td>
                                        <td className="text-muted small">{new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR')}</td>
                                        
                                        <td className="text-center bg-warning-subtle text-dark font-monospace">
                                            {p.devreden_izin > 0 ? `+${p.devreden_izin}` : '-'}
                                        </td>
                                        {/* ✅ RAPOR EKRANINDAKİ DEĞERLER (BACKEND'DEN GELDİ) */}
                                        <td className="text-center bg-info-subtle text-dark font-monospace">
                                            {p.bu_yil_hakedis}
                                        </td>
                                        <td className="text-center fw-bold fs-6">
                                            {p.devreden_izin + p.bu_yil_hakedis}
                                        </td>

                                        <td className="text-center text-muted">{p.bu_yil_kullanilan}</td>
                                        
                                        <td className="text-center">
                                            <span className={`badge ${p.kalan < 5 ? 'bg-danger' : 'bg-primary'} fs-6 rounded-pill px-3`}>
                                                {p.kalan} Gün
                                            </span>
                                        </td>
                                        
                                        <td className="text-end pe-4">
                                            {p.uyari ? (
                                                <span className="badge bg-danger text-white px-3 py-2 rounded-pill">
                                                    <AlertTriangle size={14} className="me-1"/> BİRİKEN
                                                </span>
                                            ) : (
                                                <span className="badge bg-success-subtle text-success px-3 py-2 rounded-pill">
                                                    <CheckCircle size={14} className="me-1"/> Normal
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* DETAY MODALI */}
            {secilenPersonel && (
                <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content shadow-lg border-0 rounded-4">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                                    <User size={20}/> {secilenPersonel.ad} {secilenPersonel.soyad} - İzin Detayları
                                </h5>
                                <button className="btn-close btn-close-white" onClick={() => setSecilenPersonel(null)}></button>
                            </div>
                            <div className="modal-body bg-light">
                                {detayYukleniyor ? (
                                    <div className="text-center py-5"><div className="spinner-border text-primary"></div><p className="mt-2">Hesaplamalar yapılıyor...</p></div>
                                ) : personelDetay && (
                                    <div className="row g-4">
                                        {/* Sol Taraf: Özet Kartları */}
                                        <div className="col-md-4">
                                            <div className="card border-0 shadow-sm mb-3">
                                                <div className="card-body">
                                                    <h6 className="text-muted small fw-bold mb-3">BAKİYE DURUMU</h6>
                                                    <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                                                        <span>Geçmişten Devreden:</span>
                                                        <span className="fw-bold text-warning">+{secilenPersonel.devreden_izin}</span>
                                                    </div>
                                                    <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                                                        <span>Bu Yıl Hakediş:</span>
                                                        <span className="fw-bold text-info">+{secilenPersonel.bu_yil_hakedis}</span>
                                                    </div>
                                                    <div className="d-flex justify-content-between border-bottom pb-2 mb-2">
                                                        <span>Toplam Kullanılan:</span>
                                                        <span className="fw-bold text-danger">
                                                            {personelDetay.personel.kullanilan > 0 ? `-${personelDetay.personel.kullanilan}` : '0'}
                                                        </span>
                                                    </div>
                                                    <div className="alert alert-primary mb-0 text-center fw-bold fs-5">
                                                        Net Kalan: {personelDetay.personel.kalan} Gün
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Geçmiş Yıl Dökümü */}
                                            <div className="card border-0 shadow-sm">
                                                <div className="card-body">
                                                    <h6 className="text-muted small fw-bold mb-3">GEÇMİŞ YIL KAYITLARI</h6>
                                                    {personelDetay.gecmisBakiyeler.length > 0 ? (
                                                        <ul className="list-group list-group-flush small">
                                                            {personelDetay.gecmisBakiyeler.map((g, i) => (
                                                                <li key={i} className="list-group-item d-flex justify-content-between px-0">
                                                                    <span>{g.yil} Yılından:</span>
                                                                    <strong>{g.gun_sayisi} Gün</strong>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="text-muted small">Geçmiş yıl kaydı bulunamadı.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Sağ Taraf: Hareket Listesi */}
                                        <div className="col-md-8">
                                            <div className="card border-0 shadow-sm h-100">
                                                <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                                                    <h6 className="m-0 fw-bold text-primary">Onaylı İzin Hareketleri</h6>
                                                    <button className="btn btn-sm btn-success fw-bold" onClick={generateDetailExcel}>
                                                        <FileText size={16} className="me-2"/> Detaylı Rapor İndir (.xlsx)
                                                    </button>
                                                </div>
                                                <div className="table-responsive">
                                                    <table className="table table-hover align-middle mb-0 small">
                                                        <thead className="table-light">
                                                            <tr>
                                                                <th>Tür</th>
                                                                <th>Başlangıç</th>
                                                                <th>Bitiş</th>
                                                                <th>Gün</th>
                                                                <th>Durum</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {personelDetay.izinler.length > 0 ? (
                                                                personelDetay.izinler.map((iz, idx) => (
                                                                    <tr key={idx}>
                                                                        <td>{iz.izin_turu}</td>
                                                                        <td>{new Date(iz.baslangic_tarihi).toLocaleDateString('tr-TR')}</td>
                                                                        <td>{new Date(iz.bitis_tarihi).toLocaleDateString('tr-TR')}</td>
                                                                        <td className="fw-bold">{iz.kac_gun}</td>
                                                                        <td><span className="badge bg-success">Onaylı</span></td>
                                                                    </tr>
                                                                ))
                                                            ) : (
                                                                <tr><td colSpan="5" className="text-center py-4 text-muted">Kayıt yok.</td></tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
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