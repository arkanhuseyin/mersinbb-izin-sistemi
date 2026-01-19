import { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Search, CheckCircle, AlertTriangle, FileText, Calendar, MapPin, FileSignature } from 'lucide-react';

const API_URL = 'https://mersinbb-izin-sistemi.onrender.com';

export default function HrLeaveEntry() {
    const [personeller, setPersoneller] = useState([]);
    const [arama, setArama] = useState('');
    const [secilenPersonel, setSecilenPersonel] = useState(null);
    const [bakiyeBilgisi, setBakiyeBilgisi] = useState(null);
    const [loading, setLoading] = useState(false);

    // Form State (Varsayılan değerler boşaltıldı)
    const [formData, setFormData] = useState({
        baslangic_tarihi: '',
        bitis_tarihi: '',
        kac_gun: '',
        izin_turu: 'YILLIK İZİN',
        aciklama: '',
        haftalik_izin: 'Pazar',
        ise_baslama: '',
        izin_adresi: '',
        personel_imza: 'İK GİRİŞİ' 
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
        setBakiyeBilgisi('Yükleniyor...');
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
            await axios.post(`${API_URL}/api/izin/olustur`, {
                ...formData,
                hedef_personel_id: secilenPersonel.personel_id 
            }, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            
            alert("İzin başarıyla tanımlandı!");
            // Formu sıfırla ama bazı defaultlar kalsın
            setFormData({
                baslangic_tarihi: '', bitis_tarihi: '', kac_gun: '', 
                izin_turu: 'YILLIK İZİN', aciklama: '', haftalik_izin: 'Pazar', 
                ise_baslama: '', izin_adresi: '', personel_imza: 'İK GİRİŞİ'
            });
            selectPersonel(secilenPersonel); // Bakiyeyi güncelle

        } catch (error) {
            alert("Hata: " + (error.response?.data?.mesaj || error.message));
        } finally {
            setLoading(false);
        }
    };

    // Basit arama filtresi
    const filtered = personeller.filter(p => 
        p.ad.toLowerCase().includes(arama.toLowerCase()) || 
        p.tc_no.includes(arama) ||
        p.soyad.toLowerCase().includes(arama.toLowerCase())
    );

    return (
        <div className="container-fluid p-4 p-lg-5">
            <div className="d-flex align-items-center justify-content-between mb-5">
                <div>
                    <h2 className="fw-bold text-dark m-0 d-flex align-items-center gap-3">
                        <div className="bg-primary bg-opacity-10 p-2 rounded-3 text-primary">
                            <FileText size={32}/>
                        </div>
                        İK Hızlı İzin Girişi
                    </h2>
                    <p className="text-muted mt-2 mb-0">Personel adına doğrudan onaylı izin girişi yapın.</p>
                </div>
            </div>

            <div className="row g-4">
                {/* SOL KOLON: PERSONEL LİSTESİ */}
                <div className="col-lg-4 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 h-100 overflow-hidden">
                        <div className="card-header bg-white p-3 border-bottom-0">
                            <div className="input-group shadow-sm rounded-3">
                                <span className="input-group-text bg-white border-end-0"><Search size={18} className="text-muted"/></span>
                                <input 
                                    type="text" 
                                    className="form-control border-start-0 ps-0" 
                                    placeholder="Personel Ara..." 
                                    value={arama} 
                                    onChange={e=>setArama(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="card-body p-0 overflow-auto custom-scrollbar" style={{height: '650px'}}>
                            <div className="list-group list-group-flush">
                                {filtered.map(p => (
                                    <button 
                                        key={p.personel_id} 
                                        className={`list-group-item list-group-item-action d-flex align-items-center gap-3 py-3 px-3 border-0 border-bottom ${secilenPersonel?.personel_id === p.personel_id ? 'bg-primary bg-opacity-10 text-primary border-start border-4 border-primary' : ''}`}
                                        onClick={() => selectPersonel(p)}
                                        style={{transition: 'all 0.2s'}}
                                    >
                                        <div className={`rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0 ${secilenPersonel?.personel_id === p.personel_id ? 'bg-primary text-white' : 'bg-light text-secondary'}`} style={{width:'42px', height:'42px'}}>
                                            {p.ad.charAt(0)}
                                        </div>
                                        <div className="overflow-hidden">
                                            <div className="fw-bold text-truncate">{p.ad} {p.soyad}</div>
                                            <div className="small opacity-75 text-truncate">{p.birim_adi}</div>
                                        </div>
                                    </button>
                                ))}
                                {filtered.length === 0 && <div className="text-center p-4 text-muted small">Sonuç bulunamadı.</div>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* SAĞ KOLON: İZİN FORMU */}
                <div className="col-lg-8 col-xl-9">
                    {secilenPersonel ? (
                        <div className="card border-0 shadow-lg rounded-4 h-100">
                            {/* Başlık ve Bilgi */}
                            <div className="card-header bg-gradient-primary text-white p-4 border-0" style={{background: 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)'}}>
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h4 className="m-0 fw-bold">{secilenPersonel.ad} {secilenPersonel.soyad}</h4>
                                        <div className="opacity-75 mt-1 small d-flex gap-3">
                                            <span>TC: {secilenPersonel.tc_no}</span>
                                            <span>•</span>
                                            <span>{secilenPersonel.gorev}</span>
                                        </div>
                                    </div>
                                    <div className="bg-white text-primary px-4 py-2 rounded-pill fw-bold shadow-sm">
                                        Kalan Bakiye: <span className="fs-5 ms-1">{bakiyeBilgisi}</span> Gün
                                    </div>
                                </div>
                            </div>

                            {/* Form Alanı */}
                            <div className="card-body p-4 p-lg-5">
                                <div className="alert alert-warning border-0 bg-warning bg-opacity-10 d-flex align-items-center gap-3 mb-4 rounded-3 p-3">
                                    <div className="bg-warning text-white rounded-circle p-2 flex-shrink-0"><AlertTriangle size={20}/></div>
                                    <div>
                                        <h6 className="fw-bold m-0 text-warning-emphasis">Yönetici Modu</h6>
                                        <small className="text-muted">Bu ekrandan girilen izinler, onay mekanizmasına takılmadan <strong>doğrudan onaylanır</strong> ve sisteme işlenir.</small>
                                    </div>
                                </div>

                                <form onSubmit={handleSubmit}>
                                    <div className="row g-4">
                                        {/* 1. SATIR */}
                                        <div className="col-md-6">
                                            <label className="form-label text-muted small fw-bold text-uppercase ps-1">İzin Türü</label>
                                            <select className="form-select form-select-lg bg-light border-0" value={formData.izin_turu} onChange={e=>setFormData({...formData, izin_turu:e.target.value})}>
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
                                            <label className="form-label text-muted small fw-bold text-uppercase ps-1">Haftalık İzin Günü</label>
                                            <select className="form-select form-select-lg bg-light border-0" value={formData.haftalik_izin} onChange={e=>setFormData({...formData, haftalik_izin:e.target.value})}>
                                                <option>Pazar</option>
                                                <option>Cumartesi</option>
                                                <option>Cuma</option>
                                                <option>Perşembe</option>
                                                <option>Çarşamba</option>
                                                <option>Salı</option>
                                                <option>Pazartesi</option>
                                            </select>
                                        </div>

                                        {/* 2. SATIR */}
                                        <div className="col-md-4">
                                            <label className="form-label text-muted small fw-bold text-uppercase ps-1">Başlangıç Tarihi</label>
                                            <div className="input-group">
                                                <span className="input-group-text bg-light border-0"><Calendar size={18} className="text-muted"/></span>
                                                <input type="date" className="form-control form-control-lg bg-light border-0" required value={formData.baslangic_tarihi} onChange={e=>setFormData({...formData, baslangic_tarihi:e.target.value})}/>
                                            </div>
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label text-muted small fw-bold text-uppercase ps-1">Bitiş Tarihi</label>
                                            <div className="input-group">
                                                <span className="input-group-text bg-light border-0"><Calendar size={18} className="text-muted"/></span>
                                                <input type="date" className="form-control form-control-lg bg-light border-0" required value={formData.bitis_tarihi} onChange={e=>setFormData({...formData, bitis_tarihi:e.target.value})}/>
                                            </div>
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label text-muted small fw-bold text-uppercase ps-1">Gün Sayısı</label>
                                            <input type="number" className="form-control form-control-lg bg-light border-0 fw-bold text-primary" placeholder="0" required value={formData.kac_gun} onChange={e=>setFormData({...formData, kac_gun:e.target.value})}/>
                                        </div>

                                        {/* 3. SATIR */}
                                        <div className="col-md-6">
                                            <label className="form-label text-muted small fw-bold text-uppercase ps-1">İşe Başlama Tarihi</label>
                                            <input type="date" className="form-control form-control-lg bg-light border-0" required value={formData.ise_baslama} onChange={e=>setFormData({...formData, ise_baslama:e.target.value})}/>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label text-muted small fw-bold text-uppercase ps-1">İzin Adresi</label>
                                            <div className="input-group">
                                                <span className="input-group-text bg-light border-0"><MapPin size={18} className="text-muted"/></span>
                                                <input type="text" className="form-control form-control-lg bg-light border-0" placeholder="İl/İlçe" value={formData.izin_adresi} onChange={e=>setFormData({...formData, izin_adresi:e.target.value})}/>
                                            </div>
                                        </div>

                                        {/* 4. SATIR */}
                                        <div className="col-12">
                                            <label className="form-label text-muted small fw-bold text-uppercase ps-1">Açıklama / Not</label>
                                            <textarea className="form-control bg-light border-0 rounded-3" rows="3" placeholder="İzin hakkında not..." value={formData.aciklama} onChange={e=>setFormData({...formData, aciklama:e.target.value})}></textarea>
                                        </div>
                                    </div>

                                    <div className="d-flex justify-content-end align-items-center mt-5 pt-3 border-top">
                                        <div className="me-3 text-muted small d-flex align-items-center">
                                            <FileSignature size={16} className="me-1"/>
                                            İmzalayan: <strong>{formData.personel_imza}</strong>
                                        </div>
                                        <button type="submit" className="btn btn-primary btn-lg fw-bold px-5 rounded-3 shadow-sm d-flex align-items-center gap-2" disabled={loading}>
                                            {loading ? 'İşleniyor...' : <><CheckCircle size={20}/> Onayla ve Kaydet</>}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    ) : (
                        <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted border border-2 border-dashed rounded-4 bg-light p-5" style={{minHeight: '650px'}}>
                            <div className="bg-white p-4 rounded-circle shadow-sm mb-3">
                                <User size={48} className="text-secondary opacity-50"/>
                            </div>
                            <h5 className="fw-bold text-dark">Personel Seçimi Yapın</h5>
                            <p className="mb-0 text-center" style={{maxWidth: '300px'}}>
                                İzin girişi yapmak istediğiniz personeli sol taraftaki listeden arayın ve seçin.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}