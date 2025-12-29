import { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, AlertTriangle, Search, FileBarChart, CheckCircle, Info } from 'lucide-react';
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

    // --- GÜNCELLENMİŞ EXCEL İNDİRME FONKSİYONU ---
    const exportExcel = () => {
        const wb = XLSX.utils.book_new();
        // Yeni backend verilerine göre sütunları ayırdık
        const ws = XLSX.utils.json_to_sheet(rapor.map(p => ({
            "Ad Soyad": `${p.ad} ${p.soyad}`,
            "TC No": p.tc_no,
            "Birim": p.birim_adi,
            "İşe Giriş": new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR'),
            "Devreden (Eski)": p.devreden_izin,   // YENİ
            "Bu Yıl Hakediş": p.bu_yil_hakedis,   // YENİ
            "Toplam Havuz": p.toplam_havuz,       // YENİ
            "Kullanılan": p.kullanilan,
            "Kalan İzin": p.kalan,
            "Durum": p.uyari ? "KRİTİK (40+)" : "Normal"
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
                    <p className="text-muted m-0">Personel izin hakedişleri, devreden bakiyeler ve kalan gün durumları.</p>
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
                                    <th>İşe Giriş</th>
                                    {/* YENİ SÜTUNLAR */}
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
                                    <tr key={i} className={p.uyari ? 'table-danger' : ''}>
                                        <td className="ps-4">
                                            <div className="fw-bold text-dark">{p.ad} {p.soyad}</div>
                                            <small className="text-muted font-monospace">{p.tc_no}</small>
                                        </td>
                                        <td><span className="badge bg-light text-dark border fw-normal">{p.birim_adi}</span></td>
                                        <td className="text-muted small">{new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR')}</td>
                                        
                                        {/* YENİ VERİLER */}
                                        <td className="text-center bg-warning-subtle text-dark font-monospace">
                                            {p.devreden_izin > 0 ? `+${p.devreden_izin}` : '-'}
                                        </td>
                                        <td className="text-center bg-info-subtle text-dark font-monospace">
                                            {p.bu_yil_hakedis}
                                        </td>
                                        <td className="text-center fw-bold fs-6">
                                            {p.toplam_havuz}
                                        </td>

                                        <td className="text-center text-muted">{p.kullanilan}</td>
                                        
                                        <td className="text-center">
                                            <span className={`badge ${p.kalan < 5 ? 'bg-danger' : 'bg-primary'} fs-6 rounded-pill px-3`}>
                                                {p.kalan} Gün
                                            </span>
                                        </td>
                                        
                                        <td className="text-end pe-4">
                                            {p.uyari ? (
                                                <span className="badge bg-danger text-white px-3 py-2 rounded-pill">
                                                    <AlertTriangle size={14} className="me-1"/> BİRİKEN (40+)
                                                </span>
                                            ) : p.kullanilan === 0 ? (
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
                                    <tr><td colSpan="9" className="text-center py-5 text-muted">Kayıt bulunamadı.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}