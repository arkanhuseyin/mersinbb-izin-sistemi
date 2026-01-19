import { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, FileBarChart, CheckCircle, History, Calculator, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx'; 

const DEFAULT_PHOTO = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
const API_URL = 'https://mersinbb-izin-sistemi.onrender.com';

export default function LeaveReports() {
    const [rapor, setRapor] = useState([]);
    const [arama, setArama] = useState('');
    const [yukleniyor, setYukleniyor] = useState(true);
    
    // Modal States
    const [secilenPersonel, setSecilenPersonel] = useState(null);
    const [detayYukleniyor, setDetayYukleniyor] = useState(false);
    const [personelDetay, setPersonelDetay] = useState(null);
    
    // ✅ YENİ: Tab Kontrolü
    const [activeTab, setActiveTab] = useState('ozet'); // 'ozet', 'hakedis', 'gecmis'

    useEffect(() => {
        verileriGetir();
    }, []);

    const verileriGetir = () => {
        const token = localStorage.getItem('token');
        if(!token) { window.location.href = '/login'; return; }

        axios.get(`${API_URL}/api/izin/rapor/durum`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => { 
                setRapor(res.data); 
                setYukleniyor(false); 
            })
            .catch(err => { 
                console.error("Veri çekme hatası:", err); 
                setYukleniyor(false); 
            });
    };

    const getPhotoUrl = (path) => {
        if (!path) return DEFAULT_PHOTO;
        if (path.startsWith('http')) return path;
        let cleanPath = path.replace(/\\/g, '/');
        if (cleanPath.includes('uploads/')) {
            const relativePath = cleanPath.substring(cleanPath.indexOf('uploads/'));
            return `${API_URL}/${relativePath}`;
        }
        return `${API_URL}/uploads/${cleanPath.split('/').pop()}`;
    };

    const handlePersonelClick = async (personel) => {
        setSecilenPersonel(personel); 
        setActiveTab('ozet'); // Modal açılınca varsayılan tab
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

    // --- 📄 EXCEL ÇIKTILARI ---
    const generateDetailExcel = () => {
        if (!personelDetay || !secilenPersonel) return;
        const p = personelDetay.personel;
        
        const kumulatifHak = parseInt(secilenPersonel.kumulatif_hak) || 0;
        const devredenHak = parseInt(secilenPersonel.devreden_izin) || 0;
        const buYilHak = parseInt(secilenPersonel.bu_yil_hakedis) || 0;

        const wsData = [
            ["MERSİN BÜYÜKŞEHİR BELEDİYESİ - PERSONEL İZİN DETAY RAPORU"], [" "],
            ["TC No", p.tc_no, "Ad Soyad", `${p.ad} ${p.soyad}`, "Giriş", new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR')],
            [" "], ["BAKİYE ÖZETİ"],
            ["Kümülatif Hak", kumulatifHak],
            ["Geçmişten Devreden", devredenHak],
            ["Bu Yıl Hakediş", buYilHak],
            ["Toplam Kullanılan", personelDetay.personel.kullanilan], 
            ["Kalan", personelDetay.personel.kalan],
            [" "], ["İZİN HAREKETLERİ"], ["Tür", "Başlangıç", "Bitiş", "Gün", "Durum"],
            ...personelDetay.izinler.map(iz => [
                iz.izin_turu, 
                new Date(iz.baslangic_tarihi).toLocaleDateString('tr-TR'), 
                new Date(iz.bitis_tarihi).toLocaleDateString('tr-TR'), 
                iz.kac_gun, 
                "ONAYLI"
            ])
        ];
        const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{wch:15}, {wch:15}, {wch:20}, {wch:10}, {wch:15}];
        ws['!merges'] = [{ s: {r:0, c:0}, e: {r:0, c:4} }];
        XLSX.utils.book_append_sheet(wb, ws, "Rapor"); XLSX.writeFile(wb, `${p.ad}_${p.soyad}.xlsx`);
    };

    const downloadBulkExcel = async () => {
        if(!confirm("Toplu Excel indirilsin mi?")) return; 
        try {
            const excelRows = [
                ["MERSİN BÜYÜKŞEHİR BELEDİYESİ"], ["GENEL İZİN RAPORU"], [" "],
                ["TC", "Ad Soyad", "Birim", "Giriş", "Kıdem", "Ömür Boyu Hak", "Devreden", "Bu Yıl", "TOPLAM HAVUZ", "KULLANILAN", "KALAN", "DURUM"]
            ];
            
            rapor.forEach((p) => {
                const kumulatifHak = parseInt(p.kumulatif_hak) || 0;
                const devreden = parseInt(p.devreden_izin) || 0;
                const buYilHak = parseInt(p.bu_yil_hakedis) || 0;
                const kalan = parseInt(p.kalan) || 0;
                const toplamHavuz = kumulatifHak + devreden;
                const kullanilan = toplamHavuz - kalan;
                const kidem = Math.floor((new Date() - new Date(p.ise_giris_tarihi)) / (1000 * 60 * 60 * 24 * 365.25));
                
                excelRows.push([
                    p.tc_no, `${p.ad} ${p.soyad}`, p.birim_adi, new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR'), kidem, 
                    kumulatifHak, devreden, buYilHak, toplamHavuz, kullanilan, kalan, 
                    kalan < 0 ? "LİMİT AŞIMI" : (kalan < 5 ? "AZALDI" : "NORMAL")
                ]);
            });

            const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(excelRows);
            ws['!cols'] = [{wch:12}, {wch:25}, {wch:20}, {wch:12}, {wch:8}, {wch:15}, {wch:10}, {wch:10}, {wch:12}, {wch:12}, {wch:10}, {wch:15}];
            ws['!merges'] = [{s:{r:0,c:0},e:{r:0,c:11}}, {s:{r:1,c:0},e:{r:1,c:11}}];
            XLSX.utils.book_append_sheet(wb, ws, "Genel Rapor"); 
            XLSX.writeFile(wb, `Genel_Rapor_${new Date().toISOString().slice(0,10)}.xlsx`);
        } catch (e) { alert("Excel oluşturulurken hata oluştu."); }
    };

    const downloadDetailPDF = async () => {
        if (!personelDetay) return;
        const p = personelDetay.personel;
        const token = localStorage.getItem('token');
        try {
            const response = await axios.get(`${API_URL}/api/izin/rapor/pdf-detay/${p.personel_id}`, { 
                headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' 
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a'); link.href = url;
            link.setAttribute('download', `Personel_Izin_Detay_${p.tc_no}.pdf`);
            document.body.appendChild(link); link.click(); link.remove();
        } catch (e) { alert("PDF indirilemedi."); }
    };

    const downloadBulkPDF = async () => {
        if(!confirm("Toplu PDF raporu oluşturulsun mu?")) return; 
        setYukleniyor(true); const token = localStorage.getItem('token');
        try {
            const response = await axios.get(`${API_URL}/api/izin/rapor/pdf-toplu`, { 
                headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' 
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a'); link.href = url;
            link.setAttribute('download', `Genel_Izin_Raporu_${new Date().toISOString().slice(0,10)}.pdf`);
            document.body.appendChild(link); link.click(); link.remove();
        } catch (e) { alert("Rapor oluşturulamadı."); } finally { setYukleniyor(false); }
    };

    const filtered = rapor.filter(p => p.ad.toLowerCase().includes(arama.toLowerCase()) || p.tc_no.includes(arama));

    return (
        <div className="container-fluid p-4 p-lg-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="fw-bold text-dark m-0"><FileBarChart size={28} className="me-2 text-primary"/> İzin Takip Raporu</h2>
                <div className="d-flex gap-2">
                    <button className="btn btn-success shadow-sm d-flex align-items-center gap-2" onClick={downloadBulkExcel} disabled={yukleniyor}>
                        <FileSpreadsheet size={20}/> <span className="d-none d-md-inline">Tüm Liste (Excel)</span>
                    </button>
                    <button className="btn btn-danger shadow-sm d-flex align-items-center gap-2" onClick={downloadBulkPDF} disabled={yukleniyor}>
                        <FileText size={20}/> <span className="d-none d-md-inline">Tüm Liste (PDF)</span>
                    </button>
                </div>
            </div>
            
            <div className="card border-0 shadow-sm mb-4 rounded-4"><div className="card-body p-3">
                <div className="input-group" style={{maxWidth: '400px'}}><span className="input-group-text bg-white border-end-0"><Search size={18} className="text-muted"/></span><input type="text" className="form-control border-start-0" placeholder="Ara..." value={arama} onChange={e=>setArama(e.target.value)}/></div>
            </div></div>

            {/* ANA LİSTE TABLOSU */}
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
                            const kumulatif = parseInt(p.kumulatif_hak) || 0;
                            const devreden = parseInt(p.devreden_izin) || 0;
                            const buYilHak = parseInt(p.bu_yil_hakedis) || 0;
                            const toplamHavuz = kumulatif + devreden;
                            const kalan = parseInt(p.kalan) || 0;
                            const toplamKullanilan = toplamHavuz - kalan;
                            
                            return (
                                <tr key={i} onClick={() => handlePersonelClick(p)} style={{cursor: 'pointer'}}>
                                    <td className="ps-4 fw-bold">{p.ad} {p.soyad}<br/><small className="fw-normal text-muted">{p.tc_no}</small></td>
                                    <td className="text-muted small">{new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR')}</td>
                                    <td className="text-center bg-secondary-subtle text-dark fw-bold border-start border-end fs-6">{kumulatif}</td>
                                    <td className="text-center bg-warning-subtle text-dark fw-bold">{devreden > 0 ? `+${devreden}` : '-'}</td>
                                    <td className="text-center bg-info-subtle text-dark">{buYilHak}</td>
                                    <td className="text-center fw-bold fs-6">{toplamHavuz}</td>
                                    <td className="text-center text-muted">{toplamKullanilan}</td>
                                    <td className="text-center"><span className={`badge ${kalan < 5 ? 'bg-danger' : 'bg-primary'} rounded-pill`}>{kalan}</span></td>
                                    <td className="text-end pe-4">{kalan < 0 ? <span className="badge bg-danger">LİMİT AŞIMI</span> : <CheckCircle size={16} className="text-success"/>}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div></div></div>

            {/* ✅ GÜNCELLENEN MODAL DETAY KISMI */}
            {secilenPersonel && (
                <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content shadow-lg border-0 rounded-4" style={{maxHeight:'90vh'}}>
                            
                            {/* Modal Header */}
                            <div className="modal-header bg-primary text-white p-4 align-items-center">
                                <div className="d-flex align-items-center gap-3">
                                    <img 
                                        src={getPhotoUrl(secilenPersonel.fotograf_yolu)} 
                                        alt={secilenPersonel.ad}
                                        className="rounded-circle border border-3 border-white shadow-sm"
                                        style={{width: '64px', height: '64px', objectFit: 'cover'}}
                                        onError={(e) => {e.target.src = DEFAULT_PHOTO}} 
                                    />
                                    <div>
                                        <h5 className="modal-title fw-bold mb-1">{secilenPersonel.ad} {secilenPersonel.soyad}</h5>
                                        <p className="m-0 opacity-75 small">{secilenPersonel.birim_adi} | {secilenPersonel.kadro_tipi}</p>
                                    </div>
                                </div>
                                <button className="btn-close btn-close-white align-self-start" onClick={() => setSecilenPersonel(null)}></button>
                            </div>
                            
                            {/* Modal Body */}
                            <div className="modal-body bg-light p-0">
                                {detayYukleniyor ? <div className="text-center py-5">Yükleniyor...</div> : personelDetay && (
                                    <div className="d-flex flex-column h-100">
                                        
                                        {/* TAB MENÜSÜ */}
                                        <div className="bg-white border-bottom px-4 pt-3 sticky-top">
                                            <ul className="nav nav-tabs border-0 gap-3">
                                                <li className="nav-item">
                                                    <button className={`nav-link border-0 fw-bold ${activeTab==='ozet'?'active border-bottom border-3 border-primary text-primary':'text-muted'}`} 
                                                        onClick={()=>setActiveTab('ozet')}>📊 Bakiye Özeti</button>
                                                </li>
                                                <li className="nav-item">
                                                    <button className={`nav-link border-0 fw-bold ${activeTab==='hakedis'?'active border-bottom border-3 border-primary text-primary':'text-muted'}`} 
                                                        onClick={()=>setActiveTab('hakedis')}>📅 Yıllık Hakedişler</button>
                                                </li>
                                                <li className="nav-item">
                                                    <button className={`nav-link border-0 fw-bold ${activeTab==='gecmis'?'active border-bottom border-3 border-primary text-primary':'text-muted'}`} 
                                                        onClick={()=>setActiveTab('gecmis')}>history İzin Geçmişi</button>
                                                </li>
                                            </ul>
                                        </div>

                                        {/* TAB İÇERİKLERİ */}
                                        <div className="p-4">
                                            
                                            {/* TAB 1: ÖZET */}
                                            {activeTab === 'ozet' && (
                                                <div className="row justify-content-center">
                                                    <div className="col-md-8">
                                                        <div className="card border-0 shadow-sm">
                                                            <div className="card-body p-4 text-center">
                                                                <h6 className="text-muted fw-bold mb-4">GÜNCEL DURUM</h6>
                                                                
                                                                <div className="row g-3 mb-4">
                                                                    <div className="col-6">
                                                                        <div className="p-3 bg-light rounded-3 border">
                                                                            <div className="small text-muted mb-1">Toplam Havuz</div>
                                                                            <div className="fs-4 fw-bold text-dark">
                                                                                {(parseInt(secilenPersonel.kumulatif_hak) || 0) + (parseInt(secilenPersonel.devreden_izin) || 0)}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="col-6">
                                                                        <div className="p-3 bg-light rounded-3 border">
                                                                            <div className="small text-muted mb-1">Kullanılan</div>
                                                                            <div className="fs-4 fw-bold text-danger">
                                                                                {personelDetay.personel.kullanilan}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className={`p-4 rounded-4 ${personelDetay.personel.kalan < 0 ? 'bg-danger bg-opacity-10 text-danger' : 'bg-success bg-opacity-10 text-success'}`}>
                                                                    <div className="small fw-bold opacity-75 mb-1">KALAN BAKİYE</div>
                                                                    <div className="display-4 fw-bold">{personelDetay.personel.kalan} Gün</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* TAB 2: HAKEDİŞ LİSTESİ (YENİ TABLO) */}
                                            {activeTab === 'hakedis' && (
                                                <div className="card border-0 shadow-sm">
                                                    <div className="table-responsive">
                                                        <table className="table table-hover mb-0 align-middle">
                                                            <thead className="bg-light">
                                                                <tr>
                                                                    <th className="ps-4">Hakediş Yılı</th>
                                                                    <th className="text-center">Kıdem (Yıl)</th>
                                                                    <th className="text-center">Yaş</th>
                                                                    <th className="text-end pe-4">Hak Edilen (Gün)</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {personelDetay.hakedisListesi && personelDetay.hakedisListesi.length > 0 ? (
                                                                    personelDetay.hakedisListesi.map((h, idx) => (
                                                                        <tr key={idx}>
                                                                            <td className="ps-4 fw-bold text-primary">{h.yil}</td>
                                                                            <td className="text-center">{h.kidem}</td>
                                                                            <td className="text-center text-muted">{h.yas > 0 ? h.yas : '-'}</td>
                                                                            <td className="text-end pe-4 fw-bold text-success">+{h.hak}</td>
                                                                        </tr>
                                                                    ))
                                                                ) : (
                                                                    <tr><td colSpan="4" className="text-center py-4 text-muted">Hakediş verisi bulunamadı.</td></tr>
                                                                )}
                                                            </tbody>
                                                            <tfoot className="bg-light fw-bold">
                                                                <tr>
                                                                    <td colSpan="3" className="ps-4 text-end">TOPLAM OTOMATİK HAKEDİŞ:</td>
                                                                    <td className="text-end pe-4 text-primary fs-6">
                                                                        {parseInt(secilenPersonel.kumulatif_hak) || 0} Gün
                                                                    </td>
                                                                </tr>
                                                            </tfoot>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {/* TAB 3: İZİN GEÇMİŞİ */}
                                            {activeTab === 'gecmis' && (
                                                <div className="card border-0 shadow-sm">
                                                    <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                                                        <h6 className="m-0 fw-bold text-dark">Onaylanan İzinler</h6>
                                                        <div className="d-flex gap-2">
                                                            <button className="btn btn-sm btn-outline-success d-flex align-items-center gap-1" onClick={generateDetailExcel}><FileSpreadsheet size={14}/> Excel</button>
                                                        </div>
                                                    </div>
                                                    <div className="table-responsive">
                                                        <table className="table table-hover mb-0 small">
                                                            <thead className="table-light"><tr><th className="ps-3">Tür</th><th>Başlangıç</th><th>Bitiş</th><th>Gün</th><th>Durum</th></tr></thead>
                                                            <tbody>{personelDetay.izinler.map((iz, idx) => (<tr key={idx}><td className="ps-3">{iz.izin_turu}</td><td>{new Date(iz.baslangic_tarihi).toLocaleDateString('tr-TR')}</td><td>{new Date(iz.bitis_tarihi).toLocaleDateString('tr-TR')}</td><td className="fw-bold">{iz.kac_gun}</td><td><span className="badge bg-success">Onaylı</span></td></tr>))}</tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

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