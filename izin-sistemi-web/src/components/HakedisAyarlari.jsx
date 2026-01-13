import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Calendar, List, AlertTriangle, Info } from 'lucide-react';

export default function HakedisAyarlari() {
    const [kurallar, setKurallar] = useState([]);
    const [yeniKural, setYeniKural] = useState({ 
        yil: new Date().getFullYear(), 
        kidem_alt: 0, 
        kidem_ust: 1, 
        gun: 0 
    });

    const API_URL = 'https://mersinbb-izin-sistemi.onrender.com';

    useEffect(() => {
        fetchKurallar();
    }, []);

    const fetchKurallar = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_URL}/api/ayar/hakedis-listele`, { headers: { Authorization: `Bearer ${token}` } });
            setKurallar(res.data);
        } catch (error) { console.error("Hata:", error); }
    };

    const handleEkle = async () => {
        const token = localStorage.getItem('token');
        if (parseInt(yeniKural.kidem_alt) > parseInt(yeniKural.kidem_ust)) {
            alert("Hata: Min kıdem, Max kıdemden büyük olamaz!"); return;
        }
        try {
            await axios.post(`${API_URL}/api/ayar/hakedis-ekle`, yeniKural, { headers: { Authorization: `Bearer ${token}` } });
            fetchKurallar();
            alert('✅ Kural eklendi! Hakedişler otomatik güncellendi.');
        } catch (error) { alert('Hata oluştu.'); }
    };

    const handleSil = async (id) => {
        if(!confirm('Silmek istediğinize emin misiniz?')) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`${API_URL}/api/ayar/hakedis-sil/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchKurallar();
        } catch (error) { alert("Hata oluştu."); }
    };

    return (
        <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-header bg-white border-bottom border-light pt-4 ps-4">
                <h5 className="fw-bold text-primary d-flex align-items-center gap-2"><Calendar size={22}/> İzin Hakediş Motoru</h5>
                <p className="text-muted small">Buradan <strong>yeni kurallar</strong> ekleyebilirsin. Sistem önce buradaki kurallara bakar, bulamazsa aşağıdaki standart tabloyu uygular.</p>
            </div>
            
            <div className="card-body p-4">
                {/* 1. DİNAMİK KURAL EKLEME */}
                <div className="bg-primary bg-opacity-10 p-4 rounded-4 border border-primary border-opacity-25 mb-4">
                    <h6 className="fw-bold mb-3 text-primary"><Plus size={18}/> Özel Kural Tanımla (2026 ve Sonrası İçin)</h6>
                    <div className="row g-3 align-items-end">
                        <div className="col-md-3">
                            <label className="small fw-bold text-muted">Giriş Yılı</label>
                            <input type="number" className="form-control border-0 shadow-sm" placeholder="2026"
                                value={yeniKural.yil} onChange={e => setYeniKural({...yeniKural, yil: parseInt(e.target.value) || ''})} />
                        </div>
                        <div className="col-md-4">
                            <label className="small fw-bold text-muted">Kıdem Aralığı (Yıl)</label>
                            <div className="input-group shadow-sm">
                                <input type="number" className="form-control border-0" placeholder="Min (1)" 
                                    value={yeniKural.kidem_alt} onChange={e => setYeniKural({...yeniKural, kidem_alt: parseInt(e.target.value) || 0})} />
                                <span className="input-group-text border-0 bg-white">-</span>
                                <input type="number" className="form-control border-0" placeholder="Max (5)" 
                                    value={yeniKural.kidem_ust} onChange={e => setYeniKural({...yeniKural, kidem_ust: parseInt(e.target.value) || 0})} />
                            </div>
                        </div>
                        <div className="col-md-3">
                            <label className="small fw-bold text-muted">İzin (Gün)</label>
                            <input type="number" className="form-control border-0 shadow-sm fw-bold text-primary" placeholder="18"
                                value={yeniKural.gun} onChange={e => setYeniKural({...yeniKural, gun: parseInt(e.target.value) || 0})} />
                        </div>
                        <div className="col-md-2">
                            <button className="btn btn-primary w-100 shadow-sm fw-bold" onClick={handleEkle}>Ekle</button>
                        </div>
                    </div>
                </div>

                {/* 2. AKTİF ÖZEL KURALLAR LİSTESİ */}
                <h6 className="fw-bold mb-3 text-dark"><List size={18}/> Aktif Özel Kurallar (Veritabanı)</h6>
                <div className="table-responsive rounded-4 border mb-5">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="bg-light"><tr><th className="ps-4">Giriş Yılı</th><th className="text-center">Kıdem Aralığı</th><th className="text-center">Hakediş</th><th className="text-end pe-4">İşlem</th></tr></thead>
                        <tbody>
                            {kurallar.map((k) => (
                                <tr key={k.id}>
                                    <td className="ps-4 fw-bold text-primary">{k.baslangic_yili} Girişliler</td>
                                    <td className="text-center"><span className="badge bg-light text-dark border">{k.kidem_alt} - {k.kidem_ust} Yıl</span></td>
                                    <td className="text-center"><span className="badge bg-success">{k.gun_sayisi} Gün</span></td>
                                    <td className="text-end pe-4"><button className="btn btn-sm btn-light text-danger rounded-circle" onClick={() => handleSil(k.id)}><Trash2 size={16}/></button></td>
                                </tr>
                            ))}
                            {kurallar.length === 0 && <tr><td colSpan="4" className="text-center text-muted py-3">Özel kural yok. Aşağıdaki standart tablo kullanılıyor.</td></tr>}
                        </tbody>
                    </table>
                </div>

                {/* 3. SABİT REFERANS TABLOSU (EXCEL MANTIĞI) */}
                <div className="border-top pt-4">
                    <h6 className="fw-bold mb-3 text-secondary d-flex align-items-center gap-2">
                        <Info size={18}/> Varsayılan / Eski Dönem Hakediş Tablosu (Referans)
                    </h6>
                    <div className="alert alert-light border shadow-sm rounded-3">
                        <div className="table-responsive">
                            <table className="table table-sm table-borderless mb-0 small text-muted">
                                <thead className="border-bottom">
                                    <tr>
                                        <th>Giriş Yılı Grubu</th>
                                        <th>1-5 Yıl Kıdem</th>
                                        <th>6-15 Yıl Kıdem</th>
                                        <th>16+ Yıl Kıdem</th>
                                        <th>Özel Notlar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="fw-bold">2018 Öncesi</td>
                                        <td>14 Gün</td>
                                        <td>19 Gün</td>
                                        <td>25 Gün</td>
                                        <td>Eski kadrolular</td>
                                    </tr>
                                    <tr>
                                        <td className="fw-bold">2018 (Geçiş)</td>
                                        <td>14 Gün</td>
                                        <td>19 Gün</td>
                                        <td>25 Gün</td>
                                        <td>-</td>
                                    </tr>
                                    <tr>
                                        <td className="fw-bold">2019 - 2023</td>
                                        <td>16 Gün (1-3 yıl)<br/>18 Gün (4-5 yıl)</td>
                                        <td>25 Gün</td>
                                        <td>30 Gün</td>
                                        <td>Kademeli geçiş</td>
                                    </tr>
                                    <tr>
                                        <td className="fw-bold">2024</td>
                                        <td>16 Gün (1-3 yıl)<br/>18 Gün (4-5 yıl)</td>
                                        <td>25 Gün</td>
                                        <td>30 Gün</td>
                                        <td>Güncel Sistem</td>
                                    </tr>
                                    <tr>
                                        <td className="fw-bold">2025 ve Sonrası</td>
                                        <td>18 Gün (1-3 yıl)<br/>20 Gün (4-5 yıl)</td>
                                        <td>27 Gün</td>
                                        <td>32 Gün</td>
                                        <td>Yeni Standart</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-2 text-danger small fst-italic">
                            * Bu tablo sistemin kodunda gömülüdür. Eğer yukarıdan "Özel Kural" eklerseniz, o kural bu tablodaki değeri ezer (baskılar).
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}