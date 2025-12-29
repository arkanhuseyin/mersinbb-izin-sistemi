import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    User, Search, Plus, Save, Truck, FileText, 
    Briefcase, Ban, Ruler, Shirt // İkonları ekledik
} from 'lucide-react';

export default function Settings() {
    const [activeTab, setActiveTab] = useState('profile');
    const [user, setUser] = useState(() => { 
        try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } 
    });
    
    const [usersList, setUsersList] = useState([]);
    const [birimler, setBirimler] = useState([]);
    const [arama, setArama] = useState('');
    const [yukleniyor, setYukleniyor] = useState(false);
    
    const [showAddModal, setShowAddModal] = useState(false);
    const [dondurmaModal, setDondurmaModal] = useState(null);
    const [transferModal, setTransferModal] = useState(null);

    // FORM DURUMU: Adım sayısı 4'e çıktı
    const [formStep, setFormStep] = useState(1); 
    const [newPersonel, setNewPersonel] = useState({
        // 1. Kimlik
        tc_no: '', ad: '', soyad: '', sifre: '123456', telefon: '',
        dogum_tarihi: '', cinsiyet: 'Erkek', medeni_hal: 'Bekar', kan_grubu: '', egitim_durumu: 'Lise',
        // 2. Kurumsal
        birim_id: '1', gorev: '', kadro_tipi: 'Sürekli İşçi', gorev_yeri: '', calisma_durumu: 'Çalışıyor', rol: 'personel',
        // 3. Lojistik
        ehliyet_no: '', src_belge_no: '', surucu_no: '', psikoteknik_tarihi: '',
        // 4. Kıyafet (YENİ)
        ayakkabi_no: '', tisort_beden: '', gomlek_beden: '', suveter_beden: '', mont_beden: ''
    });

    const isYetkili = user && ['admin', 'ik', 'filo'].includes(user.rol);

    useEffect(() => {
        if (activeTab === 'users' && isYetkili) {
            fetchUsers();
            fetchBirimler();
        }
    }, [activeTab]);

    const fetchUsers = async () => {
        setYukleniyor(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('https://mersinbb-izin-sistemi.onrender.com/api/izin/rapor/durum', { headers: { Authorization: `Bearer ${token}` } });
            setUsersList(res.data);
        } catch (error) { console.error(error); }
        setYukleniyor(false);
    };

    const fetchBirimler = async () => {
        try {
            const res = await axios.get('https://mersinbb-izin-sistemi.onrender.com/api/personel/birimler');
            setBirimler(res.data);
        } catch (error) { console.error(error); }
    };

    const handleFormChange = (e) => {
        setNewPersonel({ ...newPersonel, [e.target.name]: e.target.value });
    };

    const personelKaydet = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/personel/ekle', newPersonel, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Personel başarıyla oluşturuldu!');
            setShowAddModal(false);
            fetchUsers();
            setNewPersonel({ ...newPersonel, tc_no: '', ad: '', soyad: '' });
            setFormStep(1);
        } catch (error) {
            alert('Hata: ' + (error.response?.data?.mesaj || 'Kaydedilemedi'));
        }
    };

    const filteredUsers = usersList.filter(u => 
        u.ad?.toLowerCase().includes(arama.toLowerCase()) || 
        u.soyad?.toLowerCase().includes(arama.toLowerCase()) ||
        u.tc_no?.includes(arama)
    );

    return (
        <div className="container-fluid p-4">
            <h2 className="fw-bold mb-4 text-dark flex items-center gap-2">
                <User size={28}/> Ayarlar ve Yönetim
            </h2>

            <ul className="nav nav-tabs mb-4 border-bottom-0">
                <li className="nav-item"><button className={`nav-link px-4 fw-bold ${activeTab === 'profile' ? 'active shadow-sm border-0' : 'text-muted border-0 bg-transparent'}`} onClick={() => setActiveTab('profile')}>Profilim</button></li>
                {isYetkili && <li className="nav-item"><button className={`nav-link px-4 fw-bold ${activeTab === 'users' ? 'active shadow-sm border-0' : 'text-muted border-0 bg-transparent'}`} onClick={() => setActiveTab('users')}>Personel Yönetimi</button></li>}
            </ul>

            <div className="card shadow-sm border-0 rounded-4" style={{minHeight: '600px'}}>
                <div className="card-body p-4">
                    {activeTab === 'profile' && (
                        <div className="text-center py-5">
                            <div className="bg-light d-inline-block p-4 rounded-circle mb-3"><User size={64} className="text-primary"/></div>
                            <h3>{user?.ad} {user?.soyad}</h3>
                            <p className="text-muted">{user?.unvan || 'Kullanıcı'}</p>
                        </div>
                    )}

                    {activeTab === 'users' && isYetkili && (
                        <>
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <div className="input-group w-50 shadow-sm rounded-3">
                                    <span className="input-group-text bg-white border-end-0"><Search size={18} className="text-muted"/></span>
                                    <input type="text" className="form-control border-start-0" placeholder="Personel ara..." value={arama} onChange={e => setArama(e.target.value)}/>
                                </div>
                                <button className="btn btn-primary fw-bold shadow-sm px-4 py-2" onClick={() => setShowAddModal(true)}><Plus size={18} className="me-2"/> Yeni Personel</button>
                            </div>
                            <div className="table-responsive">
                                <table className="table table-hover align-middle">
                                    <thead className="bg-light text-muted small text-uppercase">
                                        <tr><th>TC / Ad Soyad</th><th>Birim</th><th>Giriş Tarihi</th><th className="text-center">Durum</th><th className="text-end">İşlemler</th></tr>
                                    </thead>
                                    <tbody>
                                        {yukleniyor ? <tr><td colSpan="5" className="text-center py-4">Yükleniyor...</td></tr> : 
                                         filteredUsers.map(u => (
                                            <tr key={u.personel_id}>
                                                <td><div className="fw-bold text-dark">{u.ad} {u.soyad}</div><small className="text-muted font-monospace">{u.tc_no}</small></td>
                                                <td><span className="badge bg-light text-dark border fw-normal">{u.birim_adi}</span></td>
                                                <td className="small text-muted">{new Date(u.ise_giris_tarihi).toLocaleDateString('tr-TR')}</td>
                                                <td className="text-center">{u.aktif === false ? <span className="badge bg-danger">Pasif</span> : <span className="badge bg-success">Aktif</span>}</td>
                                                <td className="text-end">
                                                    <button className="btn btn-sm btn-light me-2" onClick={() => setTransferModal(u)}><Briefcase size={16} className="text-primary"/></button>
                                                    <button className="btn btn-sm btn-light text-danger" onClick={() => setDondurmaModal(u)}><Ban size={16}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* YENİ PERSONEL MODALI */}
            {showAddModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content shadow-lg rounded-4 border-0">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title fw-bold d-flex align-items-center gap-2"><Plus size={24} /> Personel Kayıt Formu</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddModal(false)}></button>
                            </div>
                            <div className="modal-body p-4 bg-light">
                                
                                {/* ADIM BUTONLARI */}
                                <div className="d-flex justify-content-center mb-4">
                                    <div className="btn-group shadow-sm w-100 bg-white rounded-3 p-1">
                                        <button className={`btn btn-sm fw-bold rounded-2 py-2 ${formStep === 1 ? 'btn-primary' : 'btn-light text-muted'}`} onClick={() => setFormStep(1)}><User size={16} className="me-2"/> 1. Kimlik</button>
                                        <button className={`btn btn-sm fw-bold rounded-2 py-2 ${formStep === 2 ? 'btn-primary' : 'btn-light text-muted'}`} onClick={() => setFormStep(2)}><FileText size={16} className="me-2"/> 2. Kurumsal</button>
                                        <button className={`btn btn-sm fw-bold rounded-2 py-2 ${formStep === 3 ? 'btn-primary' : 'btn-light text-muted'}`} onClick={() => setFormStep(3)}><Truck size={16} className="me-2"/> 3. Lojistik</button>
                                        <button className={`btn btn-sm fw-bold rounded-2 py-2 ${formStep === 4 ? 'btn-primary' : 'btn-light text-muted'}`} onClick={() => setFormStep(4)}><Shirt size={16} className="me-2"/> 4. Kıyafet</button>
                                    </div>
                                </div>

                                <form onSubmit={personelKaydet}>
                                    <div className="card border-0 shadow-sm">
                                        <div className="card-body">
                                            {/* ADIM 1: KİMLİK */}
                                            {formStep === 1 && (
                                                <div className="row g-3">
                                                    <div className="col-12"><h6 className="text-primary border-bottom pb-2">Kişisel Bilgiler</h6></div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">TC Kimlik No</label><input type="text" name="tc_no" maxLength="11" className="form-control" required value={newPersonel.tc_no} onChange={handleFormChange}/></div>
                                                    <div className="col-md-3"><label className="small fw-bold text-muted">Ad</label><input type="text" name="ad" className="form-control" required value={newPersonel.ad} onChange={handleFormChange}/></div>
                                                    <div className="col-md-3"><label className="small fw-bold text-muted">Soyad</label><input type="text" name="soyad" className="form-control" required value={newPersonel.soyad} onChange={handleFormChange}/></div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Telefon</label><input type="tel" name="telefon" className="form-control" value={newPersonel.telefon} onChange={handleFormChange}/></div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Doğum Tarihi</label><input type="date" name="dogum_tarihi" className="form-control" value={newPersonel.dogum_tarihi} onChange={handleFormChange}/></div>
                                                    <div className="col-md-4"><label className="small fw-bold text-muted">Cinsiyet</label><select name="cinsiyet" className="form-select" value={newPersonel.cinsiyet} onChange={handleFormChange}><option>Erkek</option><option>Kadın</option></select></div>
                                                    <div className="col-md-4"><label className="small fw-bold text-muted">Medeni Hal</label><select name="medeni_hal" className="form-select" value={newPersonel.medeni_hal} onChange={handleFormChange}><option>Bekar</option><option>Evli</option></select></div>
                                                    <div className="col-md-4"><label className="small fw-bold text-muted">Kan Grubu</label><select name="kan_grubu" className="form-select" value={newPersonel.kan_grubu} onChange={handleFormChange}><option value="">Seçiniz</option><option>A Rh+</option><option>A Rh-</option><option>B Rh+</option><option>B Rh-</option><option>0 Rh+</option><option>0 Rh-</option><option>AB Rh+</option><option>AB Rh-</option></select></div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Şifre</label><input type="text" name="sifre" className="form-control bg-light" value={newPersonel.sifre} onChange={handleFormChange}/></div>
                                                </div>
                                            )}
                                            {/* ADIM 2: KURUMSAL */}
                                            {formStep === 2 && (
                                                <div className="row g-3">
                                                    <div className="col-12"><h6 className="text-primary border-bottom pb-2">Kurumsal Bilgiler</h6></div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Birim</label><select name="birim_id" className="form-select" value={newPersonel.birim_id} onChange={handleFormChange}>{birimler.map(b => (<option key={b.birim_id} value={b.birim_id}>{b.birim_adi}</option>))}</select></div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Görev Yeri</label><input type="text" name="gorev_yeri" className="form-control" value={newPersonel.gorev_yeri} onChange={handleFormChange}/></div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Ünvan / Görevi</label><input type="text" name="gorev" className="form-control" value={newPersonel.gorev} onChange={handleFormChange}/></div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Kadro Tipi</label><select name="kadro_tipi" className="form-select" value={newPersonel.kadro_tipi} onChange={handleFormChange}><option>Sürekli İşçi</option><option>Memur</option><option>Sözleşmeli</option><option>Şirket Personeli</option></select></div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Çalışma Durumu</label><select name="calisma_durumu" className="form-select" value={newPersonel.calisma_durumu} onChange={handleFormChange}><option>Çalışıyor</option><option>Emekli</option><option>İş Akdi Fesih</option></select></div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Sistem Yetkisi</label><select name="rol" className="form-select" value={newPersonel.rol} onChange={handleFormChange}><option value="personel">Standart Personel</option><option value="amir">Birim Amiri</option><option value="filo">Filo Yöneticisi</option><option value="ik">İnsan Kaynakları</option></select></div>
                                                </div>
                                            )}
                                            {/* ADIM 3: LOJİSTİK */}
                                            {formStep === 3 && (
                                                <div className="row g-3">
                                                    <div className="col-12"><h6 className="text-primary border-bottom pb-2">Sürücü & Belge Bilgileri</h6></div>
                                                    <div className="alert alert-info small d-flex align-items-center"><Truck size={16} className="me-2"/>Şoför olmayan personeller için boş bırakınız.</div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Ehliyet No</label><input type="text" name="ehliyet_no" className="form-control" value={newPersonel.ehliyet_no} onChange={handleFormChange}/></div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">SRC Belge No</label><input type="text" name="src_belge_no" className="form-control" value={newPersonel.src_belge_no} onChange={handleFormChange}/></div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Psikoteknik Bitiş</label><input type="date" name="psikoteknik_tarihi" className="form-control" value={newPersonel.psikoteknik_tarihi} onChange={handleFormChange}/></div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Sürücü Kart No</label><input type="text" name="surucu_no" className="form-control" value={newPersonel.surucu_no} onChange={handleFormChange}/></div>
                                                </div>
                                            )}
                                            {/* ADIM 4: KIYAFET (YENİ) */}
                                            {formStep === 4 && (
                                                <div className="row g-3">
                                                    <div className="col-12"><h6 className="text-primary border-bottom pb-2">Kıyafet ve Beden Bilgileri</h6></div>
                                                    <div className="alert alert-light border small d-flex align-items-center"><Ruler size={16} className="me-2 text-warning"/>Zorunlu değildir, boş bırakılabilir.</div>
                                                    
                                                    <div className="col-md-6">
                                                        <label className="form-label small fw-bold text-muted">Ayakkabı Numarası</label>
                                                        <input type="text" name="ayakkabi_no" className="form-control" placeholder="Örn: 42" value={newPersonel.ayakkabi_no} onChange={handleFormChange}/>
                                                    </div>
                                                    <div className="col-md-6">
                                                        <label className="form-label small fw-bold text-muted">Tişört Bedeni</label>
                                                        <select name="tisort_beden" className="form-select" value={newPersonel.tisort_beden} onChange={handleFormChange}>
                                                            <option value="">Seçiniz</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option><option>3XL</option>
                                                        </select>
                                                    </div>
                                                    <div className="col-md-6">
                                                        <label className="form-label small fw-bold text-muted">Gömlek Bedeni</label>
                                                        <select name="gomlek_beden" className="form-select" value={newPersonel.gomlek_beden} onChange={handleFormChange}>
                                                            <option value="">Seçiniz</option><option>S (37-38)</option><option>M (39-40)</option><option>L (41-42)</option><option>XL (43-44)</option><option>XXL (45-46)</option>
                                                        </select>
                                                    </div>
                                                    <div className="col-md-6">
                                                        <label className="form-label small fw-bold text-muted">Süveter Bedeni</label>
                                                        <select name="suveter_beden" className="form-select" value={newPersonel.suveter_beden} onChange={handleFormChange}>
                                                            <option value="">Seçiniz</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option>
                                                        </select>
                                                    </div>
                                                    <div className="col-md-6">
                                                        <label className="form-label small fw-bold text-muted">Mont Bedeni</label>
                                                        <select name="mont_beden" className="form-select" value={newPersonel.mont_beden} onChange={handleFormChange}>
                                                            <option value="">Seçiniz</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option><option>3XL</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* FOOTER BUTONLAR */}
                                    <div className="d-flex justify-content-between mt-4">
                                        <button type="button" className="btn btn-secondary px-4" onClick={()=>{if(formStep>1)setFormStep(formStep-1); else setShowAddModal(false)}}>{formStep === 1 ? 'İptal' : 'Geri'}</button>
                                        {formStep < 4 ? (
                                            <button type="button" className="btn btn-primary px-4 fw-bold" onClick={()=>setFormStep(formStep+1)}>İleri</button>
                                        ) : (
                                            <button type="submit" className="btn btn-success px-5 fw-bold shadow-sm"><Save size={18} className="me-2"/> Kaydı Tamamla</button>
                                        )}
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* DONDURMA MODALI */}
            {dondurmaModal && (
                <div className="modal show d-block" style={{backgroundColor:'rgba(0,0,0,0.5)'}}>
                   <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content shadow rounded-4 p-3 text-center">
                            <h5 className="fw-bold text-danger mb-3">Personel İlişiğini Kes</h5>
                            <p><strong>{dondurmaModal.ad} {dondurmaModal.soyad}</strong> personeli için işlem seçiniz:</p>
                            <div className="d-grid gap-2">
                                <button className="btn btn-outline-danger fw-bold" onClick={()=>alert('Backendde bu fonksiyonu bağla')}>Emeklilik</button>
                                <button className="btn btn-secondary mt-2" onClick={()=>setDondurmaModal(null)}>İptal</button>
                            </div>
                        </div>
                   </div>
                </div>
            )}
        </div>
    );
}