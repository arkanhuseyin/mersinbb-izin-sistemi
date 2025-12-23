import { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, AlertTriangle, Search, FileBarChart, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx'; 

export default function LeaveReports() {
    const [rapor, setRapor] = useState([]);
    const [arama, setArama] = useState('');
    const [yukleniyor, setYukleniyor] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        axios.get('https://mersinbb-izin-sistemi.onrender.com/api/izin/rapor/durum', { 
            headers: { Authorization: `Bearer ${token}` } 
        })
        .then(res => {
            setRapor(res.data);
            setYukleniyor(false);
        })
        .catch(err => {
            console.error(err);
            setYukleniyor(false);
        });
    }, []);

    // EXCEL İNDİRME FONKSİYONU
    const exportExcel = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rapor.map(p => ({
            "Ad Soyad": `${p.ad} ${p.soyad}`,
            "TC No": p.tc_no,
            "Birim": p.birim_adi,
            "İşe Giriş": new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR'),
            "Hakediş (Yıllık)": p.hakedis,
            "Kullanılan": p.kullanilan_izin,
            "Kalan İzin": p.kalan,
            "Durum": p.uyari ? "KRİTİK (50+)" : "Normal"
        })));

        XLSX.utils.book_append_sheet(wb, ws, "İzin Raporu");
        XLSX.writeFile(wb, `Izin_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
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
                    <p className="text-muted m-0">Personel izin hakedişleri ve kalan gün durumları.</p>
                </div>
                <button className="btn btn-success fw-bold shadow-sm px-4" onClick={exportExcel}>
                    <Download size={18} className="me-2"/> Excel Olarak İndir
                </button>
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
                                    <th>İşe Giriş Tarihi</th>
                                    <th className="text-center">Toplam Hak</th>
                                    <th className="text-center">Kullanılan</th>
                                    <th className="text-center">Kalan</th>
                                    <th className="text-end pe-4">Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                {yukleniyor ? (
                                    <tr><td colspan="7" className="text-center py-5">Yükleniyor...</td></tr>
                                ) : filtered.map((p, i) => (
                                    <tr key={i} className={p.uyari ? 'table-danger' : ''}>
                                        <td className="ps-4">
                                            <div className="fw-bold text-dark">{p.ad} {p.soyad}</div>
                                            <small className="text-muted font-monospace">{p.tc_no}</small>
                                        </td>
                                        <td><span className="badge bg-light text-dark border fw-normal">{p.birim_adi}</span></td>
                                        <td className="text-muted small">{new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR')}</td>
                                        
                                        <td className="text-center fw-bold">{p.hakedis} Gün</td>
                                        <td className="text-center text-muted">{p.kullanilan_izin} Gün</td>
                                        
                                        <td className="text-center">
                                            <span className={`fw-bold fs-6 ${p.kalan < 5 ? 'text-danger' : 'text-primary'}`}>
                                                {p.kalan} Gün
                                            </span>
                                        </td>
                                        
                                        <td className="text-end pe-4">
                                            {p.uyari ? (
                                                <span className="badge bg-danger text-white px-3 py-2 rounded-pill">
                                                    <AlertTriangle size={14} className="me-1"/> KRİTİK (50+)
                                                </span>
                                            ) : p.kullanilan_izin == 0 ? (
                                                <span className="badge bg-warning text-dark px-3 py-2 rounded-pill">
                                                    HİÇ KULLANMADI
                                                </span>
                                            ) : (
                                                <span className="badge bg-success-subtle text-success px-3 py-2 rounded-pill">
                                                    <CheckCircle size={14} className="me-1"/> Normal
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {!yukleniyor && filtered.length === 0 && (
                                    <tr><td colspan="7" className="text-center py-5 text-muted">Kayıt bulunamadı.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}