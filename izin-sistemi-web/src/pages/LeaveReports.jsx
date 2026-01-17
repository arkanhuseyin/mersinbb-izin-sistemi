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

    useEffect(() => {
        verileriGetir();
    }, []);

    const verileriGetir = () => {
        const token = localStorage.getItem('token');
        if(!token) { window.location.href = '/login'; return; }

        // Artık sadece rapor durumunu çekiyoruz, hesaplama backend'de yapılıyor
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

    // --- 📄 EXCEL ÇIKTILARI (BACKEND VERİSİ İLE) ---
    
    const generateDetailExcel = () => {
        if (!personelDetay || !secilenPersonel) return;
        const p = personelDetay.personel;
        
        // Verileri rapordan veya detaydan alıyoruz
        const kumulatifHak = secilenPersonel.kumulatif_hak || 0;
        const buYilHak = secilenPersonel.bu_yil_hakedis || 0;

        const wsData = [
            ["MERSİN BÜYÜKŞEHİR BELEDİYESİ - PERSONEL İZİN DETAY RAPORU"], [" "],
            ["TC No", p.tc_no, "Ad Soyad", `${p.ad} ${p.soyad}`, "Giriş", new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR')],
            [" "], ["BAKİYE ÖZETİ"],
            ["Kümülatif Hak", kumulatifHak],
            ["Sisteme Devreden", p.devreden_izin], 
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
            
            // Backend'den gelen hazır hesaplanmış veriyi kullanıyoruz
            rapor.forEach((p) => {
                const kumulatifHak = p.kumulatif_hak || 0;
                const devreden = p.devreden_izin || 0;
                const buYilHak = p.bu_yil_hakedis || 0;
                const kalan = p.kalan || 0;
                
                // Formül: Toplam Havuz = Kumulatif + Devreden
                const toplamHavuz = kumulatifHak + devreden;
                // Kullanılan = Toplam Havuz - Kalan
                const kullanilan = toplamHavuz - kalan;
                
                const kidem = Math.floor((new Date() - new Date(p.ise_giris_tarihi)) / (1000 * 60 * 60 * 24 * 365.25));
                
                excelRows.push([
                    p.tc_no, 
                    `${p.ad} ${p.soyad}`, 
                    p.birim_adi, 
                    new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR'), 
                    kidem, 
                    kumulatifHak, 
                    devreden, 
                    buYilHak, 
                    toplamHavuz, 
                    kullanilan, 
                    kalan, 
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

    // --- 🎨 PDF ÇIKTILARI ---
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
                            // Backend'den gelen hazır değerler
                            const kumulatif = p.kumulatif_hak || 0;
                            const devreden = p.devreden_izin || 0;
                            const toplamHavuz = kumulatif + devreden;
                            const kalan = p.kalan || 0;
                            const toplamKullanilan = toplamHavuz - kalan;
                            
                            return (
                                <tr key={i} onClick={() => handlePersonelClick(p)} style={{cursor: 'pointer'}}>
                                    <td className="ps-4 fw-bold">{p.ad} {p.soyad}<br/><small className="fw-normal text-muted">{p.tc_no}</small></td>
                                    <td className="text-muted small">{new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR')}</td>
                                    <td className="text-center bg-secondary-subtle text-dark fw-bold border-start border-end fs-6">{kumulatif}</td>
                                    <td className="text-center bg-warning-subtle text-dark">{devreden}</td>
                                    <td className="text-center bg-info-subtle text-dark">{p.bu_yil_hakedis}</td>
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

            {secilenPersonel && (
                <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content shadow-lg border-0 rounded-4">
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
                            
                            <div className="modal-body bg-light p-4">
                                {detayYukleniyor ? <div className="text-center py-5">Yükleniyor...</div> : personelDetay && (
                                    <div className="row g-4">
                                        <div className="col-md-4">
                                            <div className="card border-0 shadow-sm h-100"><div className="card-body">
                                                <h6 className="text-muted small fw-bold mb-4 d-flex align-items-center gap-2"><Calculator size={18} className="text-primary"/> BAKİYE ÖZETİ</h6>
                                                
                                                <div className="p-3 bg-primary bg-opacity-10 rounded-3 mb-3 border border-primary border-opacity-25 text-center">
                                                    <small className="text-primary fw-bold">Ömür Boyu Toplam Hak</small>
                                                    {/* Kümülatif hak, modalda "secilenPersonel" üzerinden okunur çünkü o ana listeden gelir */}
                                                    <div className="fs-2 fw-bold text-primary">{secilenPersonel.kumulatif_hak || 0} Gün</div>
                                                </div>

                                                <ul className="list-group list-group-flush small mb-4">
                                                    <li className="list-group-item d-flex justify-content-between px-0 bg-transparent"><span>Sisteme Devreden:</span><strong className="text-warning">+{secilenPersonel.devreden_izin || 0}</strong></li>
                                                    <li className="list-group-item d-flex justify-content-between px-0 bg-transparent"><span>Bu Yıl Hakediş:</span><strong className="text-info">+{secilenPersonel.bu_yil_hakedis || 0}</strong></li>
                                                    <li className="list-group-item d-flex justify-content-between px-0 bg-transparent fw-bold"><span>Toplam Havuz:</span><strong className="text-dark fs-6">{(secilenPersonel.kumulatif_hak || 0) + (secilenPersonel.devreden_izin || 0)}</strong></li>
                                                    {/* Toplam Kullanılan = Toplam Havuz - Kalan */}
                                                    <li className="list-group-item d-flex justify-content-between px-0 bg-transparent text-danger"><span>Toplam Kullanılan:</span><strong>-{((secilenPersonel.kumulatif_hak || 0) + (secilenPersonel.devreden_izin || 0)) - personelDetay.personel.kalan}</strong></li>
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
                                                    
                                                    <div className="d-flex gap-2">
                                                        <button className="btn btn-sm btn-outline-success d-flex align-items-center gap-1 fw-bold" onClick={generateDetailExcel}>
                                                            <FileSpreadsheet size={16}/> Excel
                                                        </button>
                                                        <button className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1 fw-bold" onClick={downloadDetailPDF}>
                                                            <FileText size={16}/> PDF Rapor
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