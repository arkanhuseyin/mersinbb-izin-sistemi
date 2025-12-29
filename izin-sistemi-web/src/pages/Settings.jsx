import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    User, Search, Plus, Save, Truck, FileText, 
    Briefcase, Ban, Ruler, Shirt, Image as ImageIcon,
    Edit, FileDown, Lock, KeyRound, Filter, Trash2, CheckCircle
} from 'lucide-react';

export default function Settings() {
    const [activeTab, setActiveTab] = useState('profile');
    const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } });
    
    const [usersList, setUsersList] = useState([]);
    const [birimler, setBirimler] = useState([]);
    const [arama, setArama] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [yukleniyor, setYukleniyor] = useState(false);
    
    // Modallar
    const [showAddModal, setShowAddModal] = useState(false);
    const [dondurmaModal, setDondurmaModal] = useState(null);
    const [transferModal, setTransferModal] = useState(null);
    const [editModal, setEditModal] = useState(null); 

    const [yeniSifre, setYeniSifre] = useState('');

    // Form Durumları
    const [formStep, setFormStep] = useState(1); 
    const [fotograf, setFotograf] = useState(null);
    const [newPersonel, setNewPersonel] = useState({
        tc_no: '', ad: '', soyad: '', sifre: '123456', telefon: '', adres: '',
        dogum_tarihi: '', cinsiyet: 'Erkek', medeni_hal: 'Bekar', kan_grubu: '', egitim_durumu: 'Lise',
        birim_id: '1', gorev: '', kadro_tipi: 'Sürekli İşçi', gorev_yeri: '', calisma_durumu: 'Çalışıyor', rol: 'personel',
        ehliyet_no: '', src_belge_no: '', surucu_no: '', psikoteknik_tarihi: '',
        ayakkabi_no: '', tisort_beden: '', gomlek_beden: '', suveter_beden: '', mont_beden: ''
    });

    const isYetkili = user && ['admin', 'ik', 'filo'].includes(user.rol);

    useEffect(() => {
        if (activeTab === 'users' && isYetkili) { fetchUsers(); fetchBirimler(); }
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
            const token = localStorage.getItem('token');
            const res = await axios.get('https://mersinbb-izin-sistemi.onrender.com/api/personel/birimler', { headers: { Authorization: `Bearer ${token}` } });
            setBirimler(res.data);
        } catch (error) { console.error(error); }
    };

    const handleFormChange = (e) => {
        setNewPersonel({ ...newPersonel, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        setFotograf(e.target.files[0]);
    };

    // --- PERSONEL KAYIT ---
    const personelKaydet = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            Object.keys(newPersonel).forEach(key => { formData.append(key, newPersonel[key] || ''); });
            if (fotograf) formData.append('fotograf', fotograf);

            await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/personel/ekle', formData, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
            alert('Personel başarıyla oluşturuldu!');
            setShowAddModal(false);
            fetchUsers();
            setFormStep(1);
            setFotograf(null);
            setNewPersonel({...newPersonel, tc_no: '', ad: '', soyad: ''});
        } catch (error) {
            const mesaj = error.response?.data?.mesaj || 'Hata oluştu.';
            alert(`Hata: ${mesaj}`);
        }
    };

    // --- PERSONEL GÜNCELLEME ---
    const personelGuncelle = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            
            const fields = [
                'ad', 'soyad', 'telefon', 'adres', 'gorev', 'kadro_tipi', 'gorev_yeri', 
                'ayakkabi_no', 'tisort_beden', 'gomlek_beden', 'suveter_beden', 'mont_beden',
                'tc_no', 'dogum_tarihi', 'cinsiyet', 'medeni_hal', 'kan_grubu', 'birim_id', 'rol'
            ];
            
            fields.forEach(key => formData.append(key, editModal[key] || ''));
            if (fotograf) formData.append('fotograf', fotograf);

            await axios.put(`https://mersinbb-izin-sistemi.onrender.com/api/personel/guncelle/${editModal.personel_id}`, formData, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });

            alert('Güncelleme başarılı!');
            setEditModal(null);
            setFotograf(null);
            fetchUsers();
        } catch (error) { alert('Güncelleme hatası'); }
    };

    // --- DONDURMA (PASİF) ---
    const personelDondur = async (sebep) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/personel/dondur', {
                personel_id: dondurmaModal.personel_id,
                sebep: sebep
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            alert('Personel pasife alındı.');
            setDondurmaModal(null);
            fetchUsers();
        } catch (error) { alert('Hata oluştu'); }
    };

    // --- AKTİF ETME (GERİ ALMA) ---
    const personelAktifEt = async (personel_id) => {
        if(!window.confirm('Bu personeli tekrar AKTİF hale getirmek istiyor musunuz?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/personel/aktif-et', { personel_id }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Personel başarıyla aktif edildi.');
            fetchUsers();
        } catch (error) { alert('Hata oluştu'); }
    };

    // --- SİLME (TAMAMEN) ---
    const personelSil = async (personel_id) => {
        if(!window.confirm('DİKKAT: Bu personeli ve tüm verilerini KALICI olarak silmek istiyor musunuz? Bu işlem geri alınamaz!')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`https://mersinbb-izin-sistemi.onrender.com/api/personel/sil/${personel_id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Personel silindi.');
            fetchUsers();
        } catch (error) {
            alert('Hata: ' + (error.response?.data?.mesaj || 'Silinemedi'));
        }
    };

    // --- PDF ---
    const downloadPdf = (id, ad) => {
        const token = localStorage.getItem('token');
        axios.get(`https://mersinbb-izin-sistemi.onrender.com/api/personel/pdf/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'blob'
        }).then((response) => {
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${ad}_Kimlik_Karti.pdf`);
            document.body.appendChild(link);
            link.click();
        });
    };

    // --- ŞİFRE ---
    const profilGuncelle = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/personel/guncelle', {
                yeni_sifre: yeniSifre
            }, { headers: { Authorization: `Bearer ${token}` } });
            alert('Şifreniz başarıyla güncellendi.');
            setYeniSifre('');
        } catch (error) { alert('Hata oluştu'); }
    };

    // --- FİLTRELEME ---
    const filteredUsers = usersList.filter(u => {
        const matchesSearch = u.ad?.toLowerCase().includes(arama.toLowerCase()) || 
                              u.tc_no?.includes(arama);
        
        // Aktiflik kontrolü (Boolean veya 1/0 gelebilir)
        const isActive = u.aktif === true || u.aktif === 'true' || u.aktif === 1;
        
        if (filterStatus === 'all') return matchesSearch;
        if (filterStatus === 'active') return matchesSearch && isActive;
        if (filterStatus === 'passive') return matchesSearch && !isActive;
        return matchesSearch;
    });

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
                    
                    {/* TAB 1: PROFİLİM */}
                    {activeTab === 'profile' && (
                        <div className="row justify-content-center">
                            <div className="col-md-6 text-center">
                                <div className="bg-light d-inline-block p-4 rounded-circle mb-3"><User size={64} className="text-primary"/></div>
                                <h3>{user?.ad} {user?.soyad}</h3>
                                <p className="text-muted">{user?.unvan || 'Kullanıcı'}</p>
                                
                                <div className="card mt-4 border shadow-sm">
                                    <div className="card-body text-start">
                                        <h5 className="fw-bold mb-3 d-flex align-items-center gap-2"><Lock size={18}/> Şifre Değiştir</h5>
                                        <form onSubmit={profilGuncelle}>
                                            <label className="form-label small text-muted">Yeni Şifre</label>
                                            <div className="input-group mb-3">
                                                <span className="input-group-text bg-white"><KeyRound size={16}/></span>
                                                <input type="password" className="form-control" placeholder="******" 
                                                    value={yeniSifre} onChange={e=>setYeniSifre(e.target.value)} required minLength="6"/>
                                            </div>
                                            <button type="submit" className="btn btn-primary w-100">Güncelle</button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: PERSONEL YÖNETİMİ */}
                    {activeTab === 'users' && isYetkili && (
                        <>
                            <div className="d-flex justify-content-between align-items-end mb-4">
                                <div className="w-50">
                                    <div className="input-group w-100 shadow-sm rounded-3 mb-2">
                                        <span className="input-group-text bg-white border-end-0"><Search size={18} className="text-muted"/></span>
                                        <input type="text" className="form-control border-start-0" placeholder="Personel ara (TC, Ad)..." value={arama} onChange={e => setArama(e.target.value)}/>
                                    </div>
                                    
                                    <div className="d-flex align-items-center gap-2">
                                        <Filter size={16} className="text-muted"/>
                                        <select className="form-select form-select-sm w-auto border-0 bg-light fw-bold text-muted" 
                                            value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                                            <option value="all">Tümü (Hepsi)</option>
                                            <option value="active">🟢 Sadece Aktif Personel</option>
                                            <option value="passive">🔴 Pasif / Ayrılanlar</option>
                                        </select>
                                    </div>
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
                                         filteredUsers.map(u => {
                                            const isActive = u.aktif === true || u.aktif === 'true' || u.aktif === 1;
                                            return (
                                                <tr key={u.personel_id} className={!isActive ? 'table-light text-muted' : ''}>
                                                    <td><div className="fw-bold">{u.ad} {u.soyad}</div><small className="text-muted font-monospace">{u.tc_no}</small></td>
                                                    <td><span className="badge bg-light text-dark border fw-normal">{u.birim_adi}</span></td>
                                                    <td className="small">{new Date(u.ise_giris_tarihi).toLocaleDateString('tr-TR')}</td>
                                                    <td className="text-center">{!isActive ? <span className="badge bg-secondary">Pasif ({u.calisma_durumu})</span> : <span className="badge bg-success">Aktif</span>}</td>
                                                    <td className="text-end">
                                                        <button className="btn btn-sm btn-light text-primary me-1" title="PDF İndir" onClick={() => downloadPdf(u.personel_id, u.ad)}><FileDown size={18}/></button>
                                                        <button className="btn btn-sm btn-light text-dark me-1" title="Düzenle" onClick={() => setEditModal(u)}><Edit size={18}/></button>
                                                        
                                                        {isActive ? (
                                                            // AKTİFSE: SADECE DONDURMA
                                                            <button className="btn btn-sm btn-light text-warning" title="Pasife Al (Dondur)" onClick={() => setDondurmaModal(u)}><Ban size={18}/></button>
                                                        ) : (
                                                            // PASİFSE: AKTİF ET VEYA SİL
                                                            <>
                                                                <button className="btn btn-sm btn-light text-success me-1" title="Aktif Et" onClick={() => personelAktifEt(u.personel_id)}><CheckCircle size={18}/></button>
                                                                <button className="btn btn-sm btn-light text-danger" title="Tamamen Sil" onClick={() => personelSil(u.personel_id)}><Trash2 size={18}/></button>
                                                            </>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* --- YENİ PERSONEL MODALI (4 ADIM) --- */}
            {showAddModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', overflowY: 'auto' }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered my-4">
                        <div className="modal-content shadow-lg rounded-4 border-0">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title fw-bold"><Plus size={24} /> Yeni Personel Ekle</h5>
                                <button className="btn-close btn-close-white" onClick={() => setShowAddModal(false)}></button>
                            </div>
                            <div className="modal-body p-4 bg-light">
                                <div className="btn-group w-100 mb-4 bg-white shadow-sm">
                                    <button className={`btn btn-sm fw-bold ${formStep===1?'btn-primary':'btn-light'}`} onClick={()=>setFormStep(1)}>1. Kimlik</button>
                                    <button className={`btn btn-sm fw-bold ${formStep===2?'btn-primary':'btn-light'}`} onClick={()=>setFormStep(2)}>2. Kurumsal</button>
                                    <button className={`btn btn-sm fw-bold ${formStep===3?'btn-primary':'btn-light'}`} onClick={()=>setFormStep(3)}>3. Lojistik</button>
                                    <button className={`btn btn-sm fw-bold ${formStep===4?'btn-primary':'btn-light'}`} onClick={()=>setFormStep(4)}>4. Kıyafet</button>
                                </div>
                                <form onSubmit={personelKaydet}>
                                    <div className="card border-0 shadow-sm p-3">
                                        {/* ADIM 1 */}
                                        {formStep === 1 && (
                                            <div className="row g-2">
                                                <div className="col-12"><label className="small fw-bold">Fotoğraf</label><input type="file" className="form-control" onChange={handleFileChange}/></div>
                                                <div className="col-6"><label className="small">TC No</label><input className="form-control" required value={newPersonel.tc_no} onChange={handleFormChange} name="tc_no"/></div>
                                                <div className="col-6"><label className="small">Ad</label><input className="form-control" required value={newPersonel.ad} onChange={handleFormChange} name="ad"/></div>
                                                <div className="col-6"><label className="small">Soyad</label><input className="form-control" required value={newPersonel.soyad} onChange={handleFormChange} name="soyad"/></div>
                                                <div className="col-6"><label className="small">Telefon</label><input className="form-control" value={newPersonel.telefon} onChange={handleFormChange} name="telefon"/></div>
                                                <div className="col-12"><label className="small">Adres</label><textarea className="form-control" rows="2" value={newPersonel.adres} onChange={handleFormChange} name="adres"></textarea></div>
                                                <div className="col-6"><label className="small">Doğum Tarihi</label><input type="date" className="form-control" value={newPersonel.dogum_tarihi} onChange={handleFormChange} name="dogum_tarihi"/></div>
                                                <div className="col-6"><label className="small">Şifre</label><input className="form-control" value={newPersonel.sifre} onChange={handleFormChange} name="sifre"/></div>
                                                <div className="col-4"><label className="small">Cinsiyet</label><select className="form-select" name="cinsiyet" value={newPersonel.cinsiyet} onChange={handleFormChange}><option>Erkek</option><option>Kadın</option></select></div>
                                                <div className="col-4"><label className="small">Medeni Hal</label><select className="form-select" name="medeni_hal" value={newPersonel.medeni_hal} onChange={handleFormChange}><option>Bekar</option><option>Evli</option></select></div>
                                                <div className="col-4"><label className="small">Kan Grubu</label><select className="form-select" name="kan_grubu" value={newPersonel.kan_grubu} onChange={handleFormChange}><option value="">Seçiniz</option><option>A Rh+</option><option>A Rh-</option><option>B Rh+</option><option>B Rh-</option><option>0 Rh+</option><option>0 Rh-</option><option>AB Rh+</option><option>AB Rh-</option></select></div>
                                            </div>
                                        )}
                                        {/* ADIM 2 */}
                                        {formStep === 2 && (
                                            <div className="row g-2">
                                                <div className="col-6"><label className="small">Birim</label><select name="birim_id" className="form-select" value={newPersonel.birim_id} onChange={handleFormChange}>{birimler.map(b => (<option key={b.birim_id} value={b.birim_id}>{b.birim_adi}</option>))}</select></div>
                                                <div className="col-6"><label className="small">Görev Yeri</label><input className="form-control" value={newPersonel.gorev_yeri} onChange={handleFormChange} name="gorev_yeri"/></div>
                                                <div className="col-6"><label className="small">Ünvan/Görev</label><input className="form-control" value={newPersonel.gorev} onChange={handleFormChange} name="gorev"/></div>
                                                <div className="col-6"><label className="small">Kadro Tipi</label><select name="kadro_tipi" className="form-select" value={newPersonel.kadro_tipi} onChange={handleFormChange}><option>Sürekli İşçi</option><option>Memur</option><option>Sözleşmeli</option><option>Şirket Personeli</option></select></div>
                                                <div className="col-6"><label className="small">Çalışma Durumu</label><select name="calisma_durumu" className="form-select" value={newPersonel.calisma_durumu} onChange={handleFormChange}><option>Çalışıyor</option><option>Emekli</option><option>İş Akdi Fesih</option></select></div>
                                                <div className="col-6"><label className="small">Yetki Rolü</label><select name="rol" className="form-select" value={newPersonel.rol} onChange={handleFormChange}><option value="personel">Standart Personel</option><option value="amir">Birim Amiri</option><option value="filo">Filo Yöneticisi</option><option value="ik">İnsan Kaynakları</option></select></div>
                                            </div>
                                        )}
                                        {/* ADIM 3 */}
                                        {formStep === 3 && (
                                            <div className="row g-2">
                                                <div className="col-6"><label className="small">Ehliyet No</label><input className="form-control" value={newPersonel.ehliyet_no} onChange={handleFormChange} name="ehliyet_no"/></div>
                                                <div className="col-6"><label className="small">SRC Belge No</label><input className="form-control" value={newPersonel.src_belge_no} onChange={handleFormChange} name="src_belge_no"/></div>
                                                <div className="col-6"><label className="small">Psikoteknik Bitiş</label><input type="date" className="form-control" value={newPersonel.psikoteknik_tarihi} onChange={handleFormChange} name="psikoteknik_tarihi"/></div>
                                                <div className="col-6"><label className="small">Sürücü Kart No</label><input className="form-control" value={newPersonel.surucu_no} onChange={handleFormChange} name="surucu_no"/></div>
                                            </div>
                                        )}
                                        {/* ADIM 4 */}
                                        {formStep === 4 && (
                                            <div className="row g-2">
                                                <div className="col-6"><label className="small">Ayakkabı No</label><input className="form-control" value={newPersonel.ayakkabi_no} onChange={handleFormChange} name="ayakkabi_no"/></div>
                                                <div className="col-6"><label className="small">Tişört Beden</label><select className="form-select" name="tisort_beden" value={newPersonel.tisort_beden} onChange={handleFormChange}><option value="">Seçiniz</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option></select></div>
                                                <div className="col-6"><label className="small">Gömlek Beden</label><select className="form-select" name="gomlek_beden" value={newPersonel.gomlek_beden} onChange={handleFormChange}><option value="">Seçiniz</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option></select></div>
                                                <div className="col-6"><label className="small">Mont Beden</label><select className="form-select" name="mont_beden" value={newPersonel.mont_beden} onChange={handleFormChange}><option value="">Seçiniz</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option></select></div>
                                                <div className="col-6"><label className="small">Süveter Beden</label><select className="form-select" name="suveter_beden" value={newPersonel.suveter_beden} onChange={handleFormChange}><option value="">Seçiniz</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option></select></div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-3 text-end">
                                        {formStep > 1 && <button type="button" className="btn btn-secondary me-2" onClick={()=>setFormStep(formStep-1)}>Geri</button>}
                                        {formStep < 4 ? <button type="button" className="btn btn-primary" onClick={()=>setFormStep(formStep+1)}>İleri</button> : <button type="submit" className="btn btn-success fw-bold px-4">Kaydet</button>}
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* --- DÜZENLEME MODALI (TÜM ALANLAR) --- */}
            {editModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', overflowY:'auto' }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content shadow rounded-4 border-0">
                            <div className="modal-header bg-warning-subtle text-dark">
                                <h5 className="fw-bold mb-0">Düzenle: {editModal.ad} {editModal.soyad}</h5>
                                <button className="btn-close" onClick={()=>setEditModal(null)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <form onSubmit={personelGuncelle}>
                                    <div className="row g-3">
                                        <div className="col-12"><h6 className="border-bottom pb-1 text-primary">Kişisel Bilgiler</h6></div>
                                        <div className="col-12"><label className="form-label small fw-bold">Fotoğraf Güncelle</label><input type="file" className="form-control" accept="image/*" onChange={handleFileChange} /></div>
                                        <div className="col-md-6"><label className="small">TC No</label><input className="form-control" value={editModal.tc_no} onChange={e=>setEditModal({...editModal, tc_no:e.target.value})}/></div>
                                        <div className="col-md-6"><label className="small">Ad</label><input className="form-control" value={editModal.ad} onChange={e=>setEditModal({...editModal, ad:e.target.value})}/></div>
                                        <div className="col-md-6"><label className="small">Soyad</label><input className="form-control" value={editModal.soyad} onChange={e=>setEditModal({...editModal, soyad:e.target.value})}/></div>
                                        <div className="col-md-6"><label className="small">Telefon</label><input className="form-control" value={editModal.telefon || ''} onChange={e=>setEditModal({...editModal, telefon:e.target.value})}/></div>
                                        <div className="col-12"><label className="small">Adres</label><textarea className="form-control" rows="2" value={editModal.adres || ''} onChange={e=>setEditModal({...editModal, adres:e.target.value})}/></div>
                                        
                                        <div className="col-md-4"><label className="small">Cinsiyet</label><select className="form-select" value={editModal.cinsiyet} onChange={e=>setEditModal({...editModal, cinsiyet:e.target.value})}><option>Erkek</option><option>Kadın</option></select></div>
                                        <div className="col-md-4"><label className="small">Medeni Hal</label><select className="form-select" value={editModal.medeni_hal} onChange={e=>setEditModal({...editModal, medeni_hal:e.target.value})}><option>Bekar</option><option>Evli</option></select></div>
                                        <div className="col-md-4"><label className="small">Kan Grubu</label><select className="form-select" value={editModal.kan_grubu} onChange={e=>setEditModal({...editModal, kan_grubu:e.target.value})}><option value="">Seçiniz</option><option>A Rh+</option><option>A Rh-</option><option>B Rh+</option><option>B Rh-</option><option>0 Rh+</option><option>0 Rh-</option><option>AB Rh+</option><option>AB Rh-</option></select></div>

                                        <div className="col-12 mt-3"><h6 className="border-bottom pb-1 text-primary">Kurumsal Bilgiler</h6></div>
                                        <div className="col-md-6"><label className="small">Birim</label><select className="form-select" value={editModal.birim_id} onChange={e=>setEditModal({...editModal, birim_id:e.target.value})}>{birimler.map(b => (<option key={b.birim_id} value={b.birim_id}>{b.birim_adi}</option>))}</select></div>
                                        <div className="col-md-6"><label className="small">Görevi</label><input className="form-control" value={editModal.gorev || ''} onChange={e=>setEditModal({...editModal, gorev:e.target.value})}/></div>
                                        <div className="col-md-6"><label className="small">Görev Yeri</label><input className="form-control" value={editModal.gorev_yeri || ''} onChange={e=>setEditModal({...editModal, gorev_yeri:e.target.value})}/></div>
                                        <div className="col-md-6"><label className="small">Kadro Tipi</label><select className="form-select" value={editModal.kadro_tipi} onChange={e=>setEditModal({...editModal, kadro_tipi:e.target.value})}><option>Sürekli İşçi</option><option>Memur</option><option>Sözleşmeli</option><option>Şirket Personeli</option></select></div>

                                        <div className="col-12 mt-3"><h6 className="border-bottom pb-1 text-primary">Beden Bilgileri</h6></div>
                                        <div className="col-md-3"><label className="small">Ayakkabı</label><input className="form-control" value={editModal.ayakkabi_no || ''} onChange={e=>setEditModal({...editModal, ayakkabi_no:e.target.value})}/></div>
                                        <div className="col-md-3"><label className="small">Tişört</label><input className="form-control" value={editModal.tisort_beden || ''} onChange={e=>setEditModal({...editModal, tisort_beden:e.target.value})}/></div>
                                        <div className="col-md-3"><label className="small">Gömlek</label><input className="form-control" value={editModal.gomlek_beden || ''} onChange={e=>setEditModal({...editModal, gomlek_beden:e.target.value})}/></div>
                                        <div className="col-md-3"><label className="small">Mont</label><input className="form-control" value={editModal.mont_beden || ''} onChange={e=>setEditModal({...editModal, mont_beden:e.target.value})}/></div>
                                    </div>
                                    <div className="mt-4 text-end"><button type="button" className="btn btn-secondary me-2" onClick={()=>setEditModal(null)}>İptal</button><button type="submit" className="btn btn-warning fw-bold px-4">Güncelle</button></div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* --- DONDURMA MODALI --- */}
            {dondurmaModal && (
                <div className="modal show d-block" style={{backgroundColor:'rgba(0,0,0,0.5)'}}>
                   <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content shadow rounded-4 p-3 text-center">
                            <h5 className="fw-bold text-danger mb-3">Personel Pasife Al</h5>
                            <p><strong>{dondurmaModal.ad} {dondurmaModal.soyad}</strong> personeli için işlem seçiniz:</p>
                            <div className="d-grid gap-2">
                                <button className="btn btn-outline-danger fw-bold" onClick={()=>personelDondur('EMEKLİLİK')}>Emeklilik</button>
                                <button className="btn btn-outline-danger fw-bold" onClick={()=>personelDondur('İŞ AKDİ FESHİ')}>İş Akdi Fesih</button>
                                <button className="btn btn-outline-danger fw-bold" onClick={()=>personelDondur('VEFAT')}>Vefat</button>
                                <button className="btn btn-outline-danger fw-bold" onClick={()=>personelDondur('İSTİFA')}>İstifa</button>
                                <button className="btn btn-secondary mt-2" onClick={()=>setDondurmaModal(null)}>İptal</button>
                            </div>
                        </div>
                   </div>
                </div>
            )}
        </div>
    );
}