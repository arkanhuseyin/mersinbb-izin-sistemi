import { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Search, CheckCircle, AlertTriangle, FileText } from 'lucide-react';

const API_URL = 'https://mersinbb-izin-sistemi.onrender.com';

export default function HrLeaveEntry() {
    const [personeller, setPersoneller] = useState([]);
    const [arama, setArama] = useState('');
    const [secilenPersonel, setSecilenPersonel] = useState(null);
    const [bakiyeBilgisi, setBakiyeBilgisi] = useState(null);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        baslangic_tarihi: '',
        bitis_tarihi: '',
        kac_gun: '',
        izin_turu: 'YILLIK İZİN',
        aciklama: 'Yıllık İzin',
        haftalik_izin: 'Pazar',
        ise_baslama: '',
        izin_adresi: 'Mersin',
        personel_imza: 'İK GİRİŞİ' // Otomatik imza
    });

    useEffect(() => {
        fetchPersoneller();
    }, []);

    const fetchPersoneller = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/personel/liste`, { headers: { Authorization: `Bearer ${token}` } });
            setPersoneller(res.data);
        } catch (e) { alert("Personel listesi çekilemedi."); }
    };

    const selectPersonel = async (p) => {
        setSecilenPersonel(p);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/izin/personel-detay/${p.personel_id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBakiyeBilgisi(res.data.personel.kalan); 
        } catch (e) { setBakiyeBilgisi('?'); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!secilenPersonel) return alert("Lütfen bir personel seçin.");

        if(!confirm(`${secilenPersonel.ad} ${secilenPersonel.soyad} adına ${formData.kac_gun} gün izin girilecek.\n\nBu işlem AMİR onayı beklemeden direkt ONAYLANACAK.\nOnaylıyor musunuz?`)) return;

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            // Backend'e hedef_personel_id gönderiyoruz
            await axios.post(`${API_URL}/api/izin/olustur`, {
                ...formData,
                hedef_personel_id: secilenPersonel.personel_id 
            }, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            
            alert("İzin başarıyla tanımlandı!");
            setFormData({...formData, baslangic_tarihi: '', bitis_tarihi: '', kac_gun: ''});
            selectPersonel(secilenPersonel); // Bakiyeyi güncelle

        } catch (error) {
            alert("Hata: " + (error.response?.data?.mesaj || error.message));
        } finally {
            setLoading(false);
        }
    };

    const filtered = personeller.filter(p => p.ad.toLowerCase().includes(arama.toLowerCase()) || p.tc_no.includes(arama));

    return (
        <div className="container-fluid p-4">
            <h2 className="fw-bold mb-4 text-dark d-flex align-items-center gap-2">
                <FileText className="text-primary"/> İK Hızlı İzin Girişi
            </h2>

            <div className="row g-4">
                {/* SOL KOLON: PERSONEL SEÇİMİ */}
                <div className="col-md-4">
                    <div className="card shadow-sm border-0 rounded-4 h-100">
                        <div className="card-header bg-white p-3">
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0"><Search size={18}/></span>
                                <input type="text" className="form-control border-start-0 bg-light" placeholder="Personel Ara (Ad, TC)..." value={arama} onChange={e=>setArama(e.target.value)}/>
                            </div>
                        </div>
                        <div className="card-body p-0 overflow-auto" style={{maxHeight: '600px'}}>
                            <div className="list-group list-group-flush">
                                {filtered.map(p => (
                                    <button 
                                        key={p.personel_id} 
                                        className={`list-group-item list-group-item-action d-flex align-items-center gap-3 py-3 ${secilenPersonel?.personel_id === p.personel_id ? 'active' : ''}`}
                                        onClick={() => selectPersonel(p)}
                                    >
                                        <div className="bg-light text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{width:'40px', height:'40px'}}>
                                            {p.ad.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="fw-bold">{p.ad} {p.soyad}</div>
                                            <div className="small opacity-75">{p.birim_adi}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* SAĞ KOLON: İZİN FORMU */}
                <div className="col-md-8">
                    {secilenPersonel ? (
                        <div className="card shadow-lg border-0 rounded-4">
                            <div className="card-header bg-primary text-white p-4">
                                <h5 className="m-0 fw-bold">{secilenPersonel.ad} {secilenPersonel.soyad}</h5>
                                <div className="d-flex justify-content-between mt-2 align-items-center">
                                    <span className="opacity-75 small">{secilenPersonel.tc_no} | {secilenPersonel.gorev}</span>
                                    <span className="badge bg-white text-primary fs-6">Kalan Bakiye: {bakiyeBilgisi !== null ? bakiyeBilgisi : '...'} Gün</span>
                                </div>
                            </div>
                            <div className="card-body p-4">
                                <div className="alert alert-warning d-flex align-items-center gap-2 small">
                                    <AlertTriangle size={18}/>
                                    Bu alandan girilen izinler <strong>AMİR ONAYI GEREKTİRMEZ</strong>. Direkt sisteme işlenir.
                                </div>

                                <form onSubmit={handleSubmit}>
                                    <div className="row g-3">
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold">İzin Türü</label>
                                            <select className="form-select" value={formData.izin_turu} onChange={e=>setFormData({...formData, izin_turu:e.target.value})}>
                                                <option>YILLIK İZİN</option>
                                                <option>ÜCRETSİZ İZİN</option>
                                                <option>MAZERET İZNİ</option>
                                                <option>RAPOR</option>
                                                <option>BABALIK İZNİ</option>
                                                <option>EVLİLİK İZNİ</option>
                                                <option>ÖLÜM İZNİ</option>
                                                <option>İDARİ İZİN</option>
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold">Kaç Gün?</label>
                                            <input type="number" className="form-control" required value={formData.kac_gun} onChange={e=>setFormData({...formData, kac_gun:e.target.value})}/>
                                        </div>

                                        <div className="col-md-4">
                                            <label className="form-label small fw-bold">Başlangıç Tarihi</label>
                                            <input type="date" className="form-control" required value={formData.baslangic_tarihi} onChange={e=>setFormData({...formData, baslangic_tarihi:e.target.value})}/>
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label small fw-bold">Bitiş Tarihi</label>
                                            <input type="date" className="form-control" required value={formData.bitis_tarihi} onChange={e=>setFormData({...formData, bitis_tarihi:e.target.value})}/>
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label small fw-bold">İşe Başlama Tarihi</label>
                                            <input type="date" className="form-control" required value={formData.ise_baslama} onChange={e=>setFormData({...formData, ise_baslama:e.target.value})}/>
                                        </div>
                                        
                                        <div className="col-12">
                                            <label className="form-label small fw-bold">Açıklama / Not</label>
                                            <input type="text" className="form-control" value={formData.aciklama} onChange={e=>setFormData({...formData, aciklama:e.target.value})}/>
                                        </div>

                                        <div className="col-12 mt-4 text-end">
                                            <button type="submit" className="btn btn-primary fw-bold px-5 py-2 shadow-sm" disabled={loading}>
                                                {loading ? 'İşleniyor...' : <><CheckCircle size={18} className="me-2"/> İzni Onayla ve Kaydet</>}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    ) : (
                        <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted border rounded-4 bg-light p-5" style={{minHeight: '400px'}}>
                            <User size={64} className="mb-3 opacity-25"/>
                            <h5>Personel Seçiniz</h5>
                            <p>İzin girişi yapmak için soldaki listeden bir personel seçin.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}