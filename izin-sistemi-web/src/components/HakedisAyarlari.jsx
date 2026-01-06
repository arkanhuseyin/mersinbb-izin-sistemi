import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Calendar, Save, List } from 'lucide-react';

export default function HakedisAyarlari() {
    const [kurallar, setKurallar] = useState([]);
    // Varsayılan değerler
    const [yeniKural, setYeniKural] = useState({ 
        yil: new Date().getFullYear(), 
        kidem_alt: 0, 
        kidem_ust: 1, 
        gun: 0 
    });

    useEffect(() => {
        fetchKurallar();
    }, []);

    const fetchKurallar = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get('https://mersinbb-izin-sistemi.onrender.com/api/ayar/hakedis-listele', { headers: { Authorization: `Bearer ${token}` } });
            setKurallar(res.data);
        } catch (error) { console.error(error); }
    };

    const handleEkle = async () => {
        const token = localStorage.getItem('token');
        try {
            await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/ayar/hakedis-ekle', yeniKural, { headers: { Authorization: `Bearer ${token}` } });
            fetchKurallar();
            alert('Kural eklendi!');
        } catch (error) {
            alert('Hata: ' + (error.response?.data?.mesaj || 'Eklenemedi'));
        }
    };

    const handleSil = async (id) => {
        if(!confirm('Bu kuralı silmek istediğinize emin misiniz?')) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`https://mersinbb-izin-sistemi.onrender.com/api/ayar/hakedis-sil/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchKurallar();
        } catch (error) { console.error(error); }
    };

    return (
        <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-header bg-white border-bottom border-light pt-4 ps-4">
                <h5 className="fw-bold text-primary d-flex align-items-center gap-2">
                    <Calendar size={22}/> İzin Hakediş Motoru
                </h5>
                <p className="text-muted small">İşe giriş yılına ve kıdeme göre izin günlerini buradan tanımlayabilirsiniz.</p>
            </div>
            
            <div className="card-body p-4">
                
                {/* --- KURAL EKLEME FORMU --- */}
                <div className="bg-light p-4 rounded-4 border mb-4">
                    <h6 className="fw-bold mb-3 d-flex align-items-center gap-2 text-dark"><Plus size={18}/> Yeni Kural Tanımla</h6>
                    <div className="row g-3 align-items-end">
                        <div className="col-md-3">
                            <label className="small fw-bold text-muted mb-1">İşe Giriş Yılı</label>
                            <input type="number" className="form-control border-0 shadow-sm" placeholder="Örn: 2024"
                                value={yeniKural.yil} onChange={e => setYeniKural({...yeniKural, yil: e.target.value})} />
                        </div>
                        <div className="col-md-4">
                            <label className="small fw-bold text-muted mb-1">Kıdem Aralığı (Yıl)</label>
                            <div className="input-group shadow-sm">
                                <input type="number" className="form-control border-0" placeholder="Min (0)" 
                                    value={yeniKural.kidem_alt} onChange={e => setYeniKural({...yeniKural, kidem_alt: e.target.value})} />
                                <span className="input-group-text border-0 bg-white text-muted">-</span>
                                <input type="number" className="form-control border-0" placeholder="Max (1)" 
                                    value={yeniKural.kidem_ust} onChange={e => setYeniKural({...yeniKural, kidem_ust: e.target.value})} />
                            </div>
                        </div>
                        <div className="col-md-3">
                            <label className="small fw-bold text-muted mb-1">Verilecek İzin (Gün)</label>
                            <input type="number" className="form-control border-0 shadow-sm fw-bold text-primary" placeholder="0"
                                value={yeniKural.gun} onChange={e => setYeniKural({...yeniKural, gun: e.target.value})} />
                        </div>
                        <div className="col-md-2">
                            <button className="btn btn-primary w-100 shadow-sm fw-bold" onClick={handleEkle}>
                                Ekle
                            </button>
                        </div>
                    </div>
                    <div className="mt-2 text-muted small fst-italic">
                        * Örnek: "0 - 1" arası "0" gün veya "1 - 3" arası "15" gün şeklinde girebilirsiniz.
                    </div>
                </div>

                {/* --- KURAL LİSTESİ --- */}
                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2 text-dark"><List size={18}/> Tanımlı Kurallar</h6>
                <div className="table-responsive rounded-4 border">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="bg-light">
                            <tr>
                                <th className="ps-4">Giriş Yılı</th>
                                <th className="text-center">Kıdem Aralığı</th>
                                <th className="text-center">Hakediş</th>
                                <th className="text-end pe-4">İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {kurallar.map((k) => (
                                <tr key={k.id}>
                                    <td className="ps-4 fw-bold text-dark">{k.baslangic_yili} Girişliler</td>
                                    <td className="text-center">
                                        <span className="badge bg-light text-dark border px-3 py-2 rounded-pill">
                                            {k.kidem_alt} - {k.kidem_ust} Yıl
                                        </span>
                                    </td>
                                    <td className="text-center">
                                        <span className={`badge px-3 py-2 rounded-pill ${k.gun_sayisi > 0 ? 'bg-success bg-opacity-10 text-success' : 'bg-secondary bg-opacity-10 text-secondary'}`}>
                                            {k.gun_sayisi} Gün
                                        </span>
                                    </td>
                                    <td className="text-end pe-4">
                                        <button className="btn btn-sm btn-light text-danger rounded-circle p-2 hover-shadow" onClick={() => handleSil(k.id)}>
                                            <Trash2 size={16}/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {kurallar.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="text-center text-muted py-5">
                                        Henüz kural eklenmedi.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
}