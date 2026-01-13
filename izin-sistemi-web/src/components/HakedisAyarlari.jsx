import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Calendar, List, AlertTriangle, Info } from 'lucide-react';

export default function HakedisAyarlari() {
    const [kurallar, setKurallar] = useState([]);
    
    // Yeni kural ekleme formu için state
    const [yeniKural, setYeniKural] = useState({ 
        yil: new Date().getFullYear(), 
        kidem_alt: 1, 
        kidem_ust: 5, 
        gun: 14 
    });

    // API URL
    const API_URL = 'https://mersinbb-izin-sistemi.onrender.com';

    useEffect(() => {
        fetchKurallar();
    }, []);

    const fetchKurallar = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_URL}/api/ayar/hakedis-listele`, { headers: { Authorization: `Bearer ${token}` } });
            setKurallar(res.data);
        } catch (error) { console.error("Veri çekme hatası:", error); }
    };

    const handleEkle = async () => {
        const token = localStorage.getItem('token');
        
        // Basit ön kontrol
        if (parseInt(yeniKural.kidem_alt) > parseInt(yeniKural.kidem_ust)) {
            alert("Hata: Kıdem başlangıcı (Min), bitişinden (Max) büyük olamaz!");
            return;
        }

        try {
            await axios.post(`${API_URL}/api/ayar/hakedis-ekle`, yeniKural, { headers: { Authorization: `Bearer ${token}` } });
            fetchKurallar(); // Listeyi yenile
            alert('✅ Kural başarıyla eklendi! Hesaplamalar güncellendi.');
        } catch (error) {
            alert('Hata: ' + (error.response?.data?.mesaj || 'Eklenemedi'));
        }
    };

    const handleSil = async (id) => {
        if(!confirm('Bu kuralı silmek istediğinize emin misiniz?')) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`${API_URL}/api/ayar/hakedis-sil/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchKurallar(); // Listeyi yenile
        } catch (error) { console.error(error); alert("Silinemedi."); }
    };

    return (
        <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-header bg-white border-bottom border-light pt-4 ps-4">
                <h5 className="fw-bold text-primary d-flex align-items-center gap-2">
                    <Calendar size={22}/> İzin Hakediş Motoru (Hibrit Sistem)
                </h5>
                <p className="text-muted small">
                    Sistem önce <strong>aşağıda eklediğiniz özel kurallara</strong> bakar. Eğer personele uygun bir kural bulamazsa, en alttaki <strong>Standart Tabloyu</strong> kullanır.
                </p>
            </div>
            
            <div className="card-body p-4">
                
                {/* --- 1. DİNAMİK KURAL EKLEME FORMU --- */}
                <div className="bg-primary bg-opacity-10 p-4 rounded-4 border border-primary border-opacity-25 mb-5">
                    <h6 className="fw-bold mb-3 d-flex align-items-center gap-2 text-primary">
                        <Plus size={18}/> Yeni Dönem Kuralı Ekle
                    </h6>
                    <div className="row g-3 align-items-end">
                        <div className="col-md-3">
                            <label className="small fw-bold text-muted mb-1">Hangi Yıl Girişliler?</label>
                            <input type="number" className="form-control border-0 shadow-sm" placeholder="Örn: 2026"
                                value={yeniKural.yil} onChange={e => setYeniKural({...yeniKural, yil: parseInt(e.target.value) || ''})} />
                        </div>
                        <div className="col-md-4">
                            <label className="small fw-bold text-muted mb-1">Kıdem Aralığı (Yıl)</label>
                            <div className="input-group shadow-sm">
                                <input type="number" className="form-control border-0" placeholder="Min (1)" 
                                    value={yeniKural.kidem_alt} onChange={e => setYeniKural({...yeniKural, kidem_alt: parseInt(e.target.value) || 0})} />
                                <span className="input-group-text border-0 bg-white text-muted">-</span>
                                <input type="number" className="form-control border-0" placeholder="Max (5)" 
                                    value={yeniKural.kidem_ust} onChange={e => setYeniKural({...yeniKural, kidem_ust: parseInt(e.target.value) || 0})} />
                            </div>
                        </div>
                        <div className="col-md-3">
                            <label className="small fw-bold text-muted mb-1">Hakediş (Gün)</label>
                            <input type="number" className="form-control border-0 shadow-sm fw-bold text-primary" placeholder="18"
                                value={yeniKural.gun} onChange={e => setYeniKural({...yeniKural, gun: parseInt(e.target.value) || 0})} />
                        </div>
                        <div className="col-md-2">
                            <button className="btn btn-primary w-100 shadow-sm fw-bold" onClick={handleEkle}>
                                Kaydet
                            </button>
                        </div>
                    </div>
                    <div className="mt-2 text-primary text-opacity-75 small fst-italic d-flex align-items-center gap-1">
                        <AlertTriangle size={14}/>
                        Örnek: "01.01.2026" sonrası girenlerin "1 ile 5 yıl" arası "18 gün" izni olsun.
                    </div>
                </div>

                {/* --- 2. AKTİF KURALLAR LİSTESİ --- */}
                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2 text-dark"><List size={18}/> Tanımlı Özel Kurallar (Veritabanı)</h6>
                <div className="table-responsive rounded-4 border mb-5">
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
                                    <td colSpan="4" className="text-center text-muted py-4">
                                        Henüz özel bir kural eklenmedi.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* --- 3. SABİT REFERANS TABLOSU --- */}
                <div className="border-top pt-4">
                    <h6 className="fw-bold mb-3 text-secondary d-flex align-items-center gap-2">
                        <Info size={18}/> Varsayılan / Eski Dönem Hakediş Tablosu (Otomatik Uygulanır)
                    </h6>
                    <div className="alert alert-light border shadow-sm rounded-3 p-0 overflow-hidden">
                        <div className="table-responsive">
                            <table className="table table-sm table-borderless mb-0 small text-muted text-center">
                                <thead className="bg-light border-bottom text-dark">
                                    <tr>
                                        <th className="text-start ps-3 py-2">Giriş Yılı Grubu</th>
                                        <th className="py-2">1 - 5 Yıl</th>
                                        <th className="py-2">6 - 15 Yıl</th>
                                        <th className="py-2">16+ Yıl</th>
                                        <th className="text-end pe-3 py-2">Not</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-bottom">
                                        <td className="text-start ps-3 fw-bold text-dark">2007 ve Öncesi</td>
                                        <td>-</td>
                                        <td>-</td>
                                        <td className="fw-bold text-success">30 - 32 Gün</td>
                                        <td className="text-end pe-3">Eski Personel</td>
                                    </tr>
                                    <tr className="border-bottom">
                                        <td className="text-start ps-3 fw-bold">2008 - 2017</td>
                                        <td>14 Gün</td>
                                        <td>19 Gün</td>
                                        <td>25 Gün</td>
                                        <td className="text-end pe-3">Eski Kadro</td>
                                    </tr>
                                    <tr className="border-bottom">
                                        <td className="text-start ps-3 fw-bold">2018 - 2023</td>
                                        <td>16 - 18 Gün</td>
                                        <td>25 Gün</td>
                                        <td>30 Gün</td>
                                        <td className="text-end pe-3">Geçiş Dönemi</td>
                                    </tr>
                                    <tr>
                                        <td className="text-start ps-3 fw-bold">2024 - 2025</td>
                                        <td>16 - 18 Gün</td>
                                        <td>25 Gün</td>
                                        <td>30 - 32 Gün</td>
                                        <td className="text-end pe-3">Güncel</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="p-2 bg-light border-top text-center text-danger small fst-italic">
                            * Bu tablo sistemin kodunda gömülüdür. Eğer yukarıdan "Özel Kural" eklerseniz, o kural bu tablodaki değeri ezer.
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}