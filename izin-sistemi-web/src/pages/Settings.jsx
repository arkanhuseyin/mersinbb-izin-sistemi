import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    User, Search, Plus, Save, Truck, FileText, 
    Briefcase, Ban, Ruler, Shirt, Image as ImageIcon,
    Edit, FileDown, X
} from 'lucide-react';

export default function Settings() {
    const [activeTab, setActiveTab] = useState('profile');
    const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } });
    
    const [usersList, setUsersList] = useState([]);
    const [birimler, setBirimler] = useState([]);
    const [arama, setArama] = useState('');
    const [yukleniyor, setYukleniyor] = useState(false);
    
    // Modallar
    const [showAddModal, setShowAddModal] = useState(false);
    const [dondurmaModal, setDondurmaModal] = useState(null);
    const [transferModal, setTransferModal] = useState(null);
    const [editModal, setEditModal] = useState(null); // YENİ

    // Yeni Personel Formu
    const [formStep, setFormStep] = useState(1); 
    const [fotograf, setFotograf] = useState(null); // Dosya State
    const [newPersonel, setNewPersonel] = useState({
        tc_no: '', ad: '', soyad: '', sifre: '123456', telefon: '', adres: '', // Adres
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

    // KAYIT (FormData ile)
    const personelKaydet = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            
            Object.keys(newPersonel).forEach(key => {
                formData.append(key, newPersonel[key] || '');
            });
            if (fotograf) formData.append('fotograf', fotograf);

            await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/personel/ekle', formData, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
            alert('Personel başarıyla oluşturuldu!');
            setShowAddModal(false);
            fetchUsers();
            setFormStep(1);
            setFotograf(null);
            setNewPersonel({...newPersonel, tc_no: '', ad: '', soyad: ''}); // Sıfırla
        } catch (error) {
            console.error(error);
            const mesaj = error.response?.data?.mesaj || 'Hata oluştu.';
            const detay = error.response?.data?.detay || '';
            alert(`Hata: ${mesaj}\n${detay}`);
        }
    };

    // DÜZENLEME (UPDATE)
    const personelGuncelle = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            
            const fields = ['ad', 'soyad', 'telefon', 'adres', 'gorev', 'kadro_tipi', 'gorev_yeri', 
                            'ayakkabi_no', 'tisort_beden', 'gomlek_beden', 'suveter_beden', 'mont_beden'];
            
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

    // PDF İNDİRME
    const downloadPdf = (id, ad) => {
        const token = localStorage.getItem('token');
        axios.get(`https://mersinbb-izin-sistemi.onrender.com/api/personel/pdf/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'blob'
        }).then((response) => {
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${ad}_Kart.pdf`);
            document.body.appendChild(link);
            link.click();
        });
    };

    const filteredUsers = usersList.filter(u => 
        u.ad?.toLowerCase().includes(arama.toLowerCase()) || 
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
                                            <tr key={u.personel_id} style={{cursor:'pointer'}}>
                                                <td><div className="fw-bold text-dark">{u.ad} {u.soyad}</div><small className="text-muted font-monospace">{u.tc_no}</small></td>
                                                <td><span className="badge bg-light text-dark border fw-normal">{u.birim_adi}</span></td>
                                                <td className="small text-muted">{new Date(u.ise_giris_tarihi).toLocaleDateString('tr-TR')}</td>
                                                <td className="text-center">{u.aktif === false ? <span className="badge bg-danger">Pasif</span> : <span className="badge bg-success">Aktif</span>}</td>
                                                <td className="text-end">
                                                    {/* YENİ BUTONLAR */}
                                                    <button className="btn btn-sm btn-light text-danger me-2" title="PDF İndir" onClick={() => downloadPdf(u.personel_id, u.ad)}><FileDown size={18}/></button>
                                                    <button className="btn btn-sm btn-light text-primary me-2" title="Düzenle" onClick={() => setEditModal(u)}><Edit size={18}/></button>
                                                    <button className="btn btn-sm btn-light me-2" onClick={() => setTransferModal(u)}><Briefcase size={18}/></button>
                                                    <button className="btn btn-sm btn-light text-danger" onClick={() => setDondurmaModal(u)}><Ban size={18}/></button>
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
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', overflowY: 'auto' }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered my-4">
                        <div className="modal-content shadow-lg rounded-4 border-0">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title fw-bold d-flex align-items-center gap-2"><Plus size={24} /> Personel Kayıt Formu</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddModal(false)}></button>
                            </div>
                            <div className="modal-body p-4 bg-light">
                                <div className="d-flex justify-content-center mb-4">
                                    <div className="btn-group shadow-sm w-100 bg-white rounded-3 p-1">
                                        <button className={`btn btn-sm fw-bold rounded-2 py-2 ${formStep === 1 ? 'btn-primary' : 'btn-light text-muted'}`} onClick={() => setFormStep(1)}>1. Kimlik</button>
                                        <button className={`btn btn-sm fw-bold rounded-2 py-2 ${formStep === 2 ? 'btn-primary' : 'btn-light text-muted'}`} onClick={() => setFormStep(2)}>2. Kurumsal</button>
                                        <button className={`btn btn-sm fw-bold rounded-2 py-2 ${formStep === 3 ? 'btn-primary' : 'btn-light text-muted'}`} onClick={() => setFormStep(3)}>3. Lojistik</button>
                                        <button className={`btn btn-sm fw-bold rounded-2 py-2 ${formStep === 4 ? 'btn-primary' : 'btn-light text-muted'}`} onClick={() => setFormStep(4)}>4. Kıyafet</button>
                                    </div>
                                </div>
                                <form onSubmit={personelKaydet}>
                                    <div className="card border-0 shadow-sm">
                                        <div className="card-body">
                                            {formStep === 1 && (
                                                <div className="row g-3">
                                                    <div className="col-12"><h6 className="text-primary border-bottom pb-2">Kişisel Bilgiler</h6></div>
                                                    
                                                    <div className="col-12">
                                                        <label className="form-label small fw-bold text-muted">Profil Fotoğrafı</label>
                                                        <div className="input-group">
                                                            <span className="input-group-text"><ImageIcon size={18}/></span>
                                                            <input type="file" className="form-control" accept="image/*" onChange={handleFileChange} />
                                                        </div>
                                                    </div>

                                                    <div className="col-md-6"><label className="small fw-bold text-muted">TC Kimlik No</label><input type="text" name="tc_no" maxLength="11" className="form-control" required value={newPersonel.tc_no} onChange={handleFormChange}/></div>
                                                    <div className="col-md-3"><label className="small fw-bold text-muted">Ad</label><input type="text" name="ad" className="form-control" required value={newPersonel.ad} onChange={handleFormChange}/></div>
                                                    <div className="col-md-3"><label className="small fw-bold text-muted">Soyad</label><input type="text" name="soyad" className="form-control" required value={newPersonel.soyad} onChange={handleFormChange}/></div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Telefon</label><input type="tel" name="telefon" className="form-control" value={newPersonel.telefon} onChange={handleFormChange}/></div>
                                                    <div className="col-md-12"><label className="small fw-bold text-muted">Adres</label><textarea name="adres" className="form-control" rows="2" value={newPersonel.adres} onChange={handleFormChange} placeholder="Tam adres giriniz..."></textarea></div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Doğum Tarihi</label><input type="date" name="dogum_tarihi" className="form-control" value={newPersonel.dogum_tarihi} onChange={handleFormChange}/></div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Şifre</label><input type="text" name="sifre" className="form-control bg-light" value={newPersonel.sifre} onChange={handleFormChange}/></div>
                                                </div>
                                            )}
                                            {formStep === 2 && (
                                                <div className="row g-3">
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Birim</label><select name="birim_id" className="form-select" value={newPersonel.birim_id} onChange={handleFormChange}>{birimler.map(b => (<option key={b.birim_id} value={b.birim_id}>{b.birim_adi}</option>))}</select></div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Görev Yeri</label><input type="text" name="gorev_yeri" className="form-control" value={newPersonel.gorev_yeri} onChange={handleFormChange}/></div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Ünvan / Görevi</label><input type="text" name="gorev" className="form-control" value={newPersonel.gorev} onChange={handleFormChange}/></div>
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Kadro Tipi</label><select name="kadro_tipi" className="form-select" value={newPersonel.kadro_tipi} onChange={handleFormChange}><option>Sürekli İşçi</option><option>Memur</option><option>Sözleşmeli</option><option>Şirket Personeli</option></select></div>
                                                </div>
                                            )}
                                            {formStep === 3 && (
                                                <div className="row g-3">
                                                    <div className="col-md-6"><label className="small fw-bold text-muted">Ehliyet No</label><input type="text" name="ehliyet_no" className="form-control" value={newPersonel.ehliyet_no} onChange={handleFormChange}/></div>
                                                </div>
                                            )}
                                            {formStep === 4 && (
                                                <div className="row g-3">
                                                    <div className="col-md-6"><label className="form-label small fw-bold text-muted">Ayakkabı No</label><input type="text" name="ayakkabi_no" className="form-control" value={newPersonel.ayakkabi_no} onChange={handleFormChange}/></div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="d-flex justify-content-between mt-4">
                                        <button type="button" className="btn btn-secondary px-4" onClick={()=>{if(formStep>1)setFormStep(formStep-1); else setShowAddModal(false)}}>{formStep === 1 ? 'İptal' : 'Geri'}</button>
                                        {formStep < 4 ? <button type="button" className="btn btn-primary px-4 fw-bold" onClick={()=>setFormStep(formStep+1)}>İleri</button> : <button type="submit" className="btn btn-success px-5 fw-bold shadow-sm"><Save size={18} className="me-2"/> Kaydet</button>}
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* DÜZENLEME MODALI */}
            {editModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', overflowY:'auto' }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content shadow rounded-4 border-0">
                            <div className="modal-header bg-warning-subtle text-dark">
                                <h5 className="fw-bold mb-0">Personel Düzenle: {editModal.ad} {editModal.soyad}</h5>
                                <button className="btn-close" onClick={()=>setEditModal(null)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <form onSubmit={personelGuncelle}>
                                    <div className="row g-3">
                                        <div className="col-12"><label className="form-label small fw-bold">Fotoğraf Güncelle</label><input type="file" className="form-control" accept="image/*" onChange={handleFileChange} /></div>
                                        <div className="col-md-6"><label className="small">Ad</label><input className="form-control" value={editModal.ad} onChange={e=>setEditModal({...editModal, ad:e.target.value})}/></div>
                                        <div className="col-md-6"><label className="small">Soyad</label><input className="form-control" value={editModal.soyad} onChange={e=>setEditModal({...editModal, soyad:e.target.value})}/></div>
                                        <div className="col-md-6"><label className="small">Telefon</label><input className="form-control" value={editModal.telefon || ''} onChange={e=>setEditModal({...editModal, telefon:e.target.value})}/></div>
                                        <div className="col-12"><label className="small">Adres</label><textarea className="form-control" rows="2" value={editModal.adres || ''} onChange={e=>setEditModal({...editModal, adres:e.target.value})}/></div>
                                        <div className="col-md-6"><label className="small">Görevi</label><input className="form-control" value={editModal.gorev || ''} onChange={e=>setEditModal({...editModal, gorev:e.target.value})}/></div>
                                        <div className="col-md-6"><label className="small">Görev Yeri</label><input className="form-control" value={editModal.gorev_yeri || ''} onChange={e=>setEditModal({...editModal, gorev_yeri:e.target.value})}/></div>
                                        <div className="col-12 border-top pt-2 mt-2"><h6 className="small text-muted">Beden Bilgileri</h6></div>
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
            
            {dondurmaModal && (<div className="modal show d-block" style={{backgroundColor:'rgba(0,0,0,0.5)'}}><div className="modal-dialog modal-dialog-centered"><div className="modal-content p-4"><h5 className="text-danger">İşlem Seçiniz</h5><button className="btn btn-danger mt-2" onClick={()=>alert('Backendde bağlı')}>İlişik Kes</button><button className="btn btn-secondary mt-2" onClick={()=>setDondurmaModal(null)}>İptal</button></div></div></div>)}
        </div>
    );
}