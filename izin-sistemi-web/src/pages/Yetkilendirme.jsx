import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Save, Search, ShieldCheck, User, CheckCircle, AlertCircle, LayoutDashboard, 
    FileText, FileBarChart, UserCog, PlusCircle, File, FolderDown, Shirt, Calendar, Lock 
} from 'lucide-react';

const API_URL = 'https://mersinbb-izin-sistemi.onrender.com';

export default function Yetkilendirme() {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    
    // --- 🛠️ MODÜL LİSTESİ ---
    // Bu 'key' değerleri Settings.jsx ve Sidebar.jsx içindeki kontrollerle BİREBİR AYNI olmalıdır.
    const moduller = [
        { key: 'dashboard', ad: 'Dashboard (Genel Bakış)', icon: <LayoutDashboard size={18}/>, group: 'Ana Menü' },
        { key: 'izin_talep', ad: 'Yeni İzin Talebi', icon: <PlusCircle size={18}/>, group: 'Ana Menü' },
        { key: 'izin_onay', ad: 'İzin Talepleri (Onay Ekranı)', icon: <FileText size={18}/>, group: 'Ana Menü' },
        { key: 'rapor', ad: 'İzin Takip Raporu', icon: <FileBarChart size={18}/>, group: 'Ana Menü' },
        
        // AYARLAR ALT MENÜLERİ
        { key: 'ayar_personel', ad: 'Ayarlar > Personel Listesi', icon: <UserCog size={18}/>, group: 'Ayarlar' },
        { key: 'ayar_kiyafet', ad: 'Ayarlar > Kıyafet Yönetimi', icon: <Shirt size={18}/>, group: 'Ayarlar' },
        { key: 'ayar_hakedis', ad: 'Ayarlar > Hakediş Kuralları', icon: <Calendar size={18}/>, group: 'Ayarlar' },
        
        { key: 'yetkilendirme', ad: 'Yetkilendirme Paneli', icon: <ShieldCheck size={18}/>, group: 'Yönetim' },
        
        // FORMLAR
        { key: 'form1', ad: 'Form 1 (İndirme Yetkisi)', icon: <File size={18}/>, group: 'Formlar' }, 
        { key: 'form2', ad: 'Form 2 (İndirme Yetkisi)', icon: <FolderDown size={18}/>, group: 'Formlar' }
    ];

    // Yetki Durumu State'i
    const [permissions, setPermissions] = useState({});

    useEffect(() => { 
        fetchUsers(); 
    }, []);

    // 1. Kullanıcıları Getir
    const fetchUsers = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_URL}/api/personel/liste`, { headers: { Authorization: `Bearer ${token}` } });
            setUsers(res.data || []);
        } catch(e) { console.error("Kullanıcı listesi alınamadı", e); }
    };

    // 2. Kullanıcı Seçilince Yetkilerini Getir
    const handleUserSelect = async (user) => {
        setSelectedUser(user);
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_URL}/api/yetki/${user.personel_id}`, { headers: { Authorization: `Bearer ${token}` } });
            
            const loadedPerms = {};
            // Önce tüm modülleri varsayılan (false) olarak ayarla
            moduller.forEach(m => {
                loadedPerms[m.key] = { goruntule: false, ekle_duzenle: false, sil: false };
            });
            
            // Veritabanından gelen yetkileri işle
            if (res.data && res.data.length > 0) {
                res.data.forEach(p => {
                    loadedPerms[p.modul_adi] = { 
                        goruntule: p.goruntule, 
                        ekle_duzenle: p.ekle_duzenle, 
                        sil: p.sil 
                    };
                });
            }
            setPermissions(loadedPerms);
        } catch (error) { console.error("Yetkiler alınamadı", error); }
    };

    // 3. Checkbox İşlemleri (Mantıksal Bağlılıklar)
    const handleCheck = (modulKey, type) => {
        setPermissions(prev => {
            const newState = { ...prev };
            const currentModule = { ...newState[modulKey] }; // Kopyasını al
            
            let newValue = !currentModule[type];

            // MANTIKSAL KİLİTLER:
            
            // A) Eğer "Görüntüle" kapatılırsa -> Diğer her şey de kapanmalı.
            if (type === 'goruntule' && newValue === false) {
                currentModule.ekle_duzenle = false;
                currentModule.sil = false;
            }

            // B) Eğer "Ekle/Düzenle" veya "Sil" açılırsa -> "Görüntüle" otomatik açılmalı.
            if ((type === 'ekle_duzenle' || type === 'sil') && newValue === true) {
                currentModule.goruntule = true;
            }

            currentModule[type] = newValue;
            return { ...newState, [modulKey]: currentModule };
        });
    };

    // 4. Kaydet
    const savePermissions = async () => {
        if (!selectedUser) return;
        setLoading(true);
        
        // State'i API formatına çevir
        const yetkiListesi = Object.keys(permissions).map(key => ({
            modul_adi: key,
            goruntule: permissions[key]?.goruntule || false,
            ekle_duzenle: permissions[key]?.ekle_duzenle || false,
            sil: permissions[key]?.sil || false
        }));

        const token = localStorage.getItem('token');
        try {
            await axios.post(`${API_URL}/api/yetki/kaydet`, {
                personel_id: selectedUser.personel_id,
                yetkiler: yetkiListesi
            }, { headers: { Authorization: `Bearer ${token}` } });
            alert(`✅ ${selectedUser.ad} ${selectedUser.soyad} kullanıcısının yetkileri güncellendi!`);
        } catch (error) { 
            console.error(error);
            alert('Hata: Yetkiler kaydedilemedi. Yetkinizi kontrol edin.'); 
        } finally { 
            setLoading(false); 
        }
    };

    // Arama Filtresi
    const filteredUsers = users.filter(u => 
        u.ad.toLowerCase().includes(search.toLowerCase()) || 
        u.soyad.toLowerCase().includes(search.toLowerCase()) ||
        u.tc_no.includes(search)
    );

    return (
        <div className="container-fluid p-4" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
            {/* BAŞLIK KARTI */}
            <div className="card border-0 shadow-sm rounded-4 mb-4" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', color: '#fff' }}>
                <div className="card-body p-4 d-flex align-items-center gap-3">
                    <div className="bg-white bg-opacity-25 p-3 rounded-circle text-white">
                        <ShieldCheck size={32} />
                    </div>
                    <div>
                        <h4 className="fw-bold m-0">Yetkilendirme Paneli</h4>
                        <p className="m-0 opacity-75 small">Kullanıcı bazlı modül erişimi ve işlem kısıtlamaları.</p>
                    </div>
                </div>
            </div>
            
            <div className="row g-4">
                {/* SOL: KULLANICI LİSTESİ */}
                <div className="col-lg-4 col-xl-3">
                    <div className="card border-0 shadow-sm h-100 rounded-4 overflow-hidden">
                        <div className="card-header bg-white p-3 border-bottom">
                            <div className="input-group">
                                <span className="input-group-text bg-light border-0"><Search size={18} className="text-muted"/></span>
                                <input type="text" className="form-control border-0 bg-light" placeholder="Personel ara..." value={search} onChange={e=>setSearch(e.target.value)}/>
                            </div>
                        </div>
                        <div className="list-group list-group-flush overflow-auto" style={{maxHeight: '650px'}}>
                            {filteredUsers.map(u => (
                                <button 
                                    key={u.personel_id} 
                                    className={`list-group-item list-group-item-action border-0 px-4 py-3 d-flex align-items-center gap-3 transition-all ${selectedUser?.personel_id === u.personel_id ? 'bg-primary bg-opacity-10 border-start border-4 border-primary' : ''}`} 
                                    onClick={() => handleUserSelect(u)}
                                >
                                    <div className={`rounded-circle d-flex align-items-center justify-content-center fw-bold text-white shadow-sm flex-shrink-0 ${selectedUser?.personel_id === u.personel_id ? 'bg-primary' : 'bg-secondary'}`} style={{width:'40px', height:'40px'}}>
                                        {u.ad[0]}{u.soyad[0]}
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="fw-bold text-truncate">{u.ad} {u.soyad}</div>
                                        <div className="text-muted small text-truncate" style={{fontSize:'11px'}}>{u.rol_adi?.toUpperCase() || 'PERSONEL'} | {u.birim_adi}</div>
                                    </div>
                                    {selectedUser?.personel_id === u.personel_id && <CheckCircle size={18} className="text-primary ms-auto"/>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* SAĞ: YETKİ TABLOSU */}
                <div className="col-lg-8 col-xl-9">
                    {selectedUser ? (
                        <div className="card border-0 shadow-sm h-100 rounded-4 overflow-hidden">
                            <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center border-bottom">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="bg-primary text-white rounded-circle p-2"><User size={20}/></div>
                                    <div>
                                        <h5 className="m-0 fw-bold">{selectedUser.ad} {selectedUser.soyad}</h5>
                                        <span className="badge bg-secondary opacity-75 fw-normal">{selectedUser.rol_adi?.toUpperCase()}</span>
                                    </div>
                                </div>
                                <button className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-2" onClick={savePermissions} disabled={loading}>
                                    {loading ? <span className="spinner-border spinner-border-sm"></span> : <Save size={18}/>} 
                                    {loading ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </div>
                            
                            <div className="table-responsive h-100 bg-light">
                                <table className="table table-hover align-middle mb-0 bg-white shadow-sm m-3 rounded-3 overflow-hidden" style={{width: 'calc(100% - 32px)'}}>
                                    <thead className="bg-light text-secondary text-uppercase small">
                                        <tr>
                                            <th className="ps-4 py-3">Modül Adı</th>
                                            <th className="text-center" style={{width:'120px'}}>Görüntüle</th>
                                            <th className="text-center" style={{width:'120px'}}>Ekle / Düzenle</th>
                                            <th className="text-center" style={{width:'120px'}}>Sil / Dondur</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Modülleri Gruplayarak Gösterelim */}
                                        {['Ana Menü', 'Ayarlar', 'Yönetim', 'Formlar'].map(grup => {
                                            const grupModulleri = moduller.filter(m => m.group === grup);
                                            if (grupModulleri.length === 0) return null;

                                            return (
                                                <>
                                                    <tr key={`group-${grup}`} className="bg-light">
                                                        <td colSpan="4" className="fw-bold text-primary ps-4 py-2 small">{grup.toUpperCase()}</td>
                                                    </tr>
                                                    {grupModulleri.map(m => (
                                                        <tr key={m.key}>
                                                            <td className="ps-4">
                                                                <div className="d-flex align-items-center gap-2 fw-semibold text-dark">
                                                                    <div className="text-muted opacity-50">{m.icon}</div>
                                                                    {m.ad}
                                                                </div>
                                                            </td>
                                                            
                                                            {/* GÖRÜNTÜLE CHECKBOX */}
                                                            <td className="text-center">
                                                                <div className="form-check form-switch d-flex justify-content-center">
                                                                    <input 
                                                                        className="form-check-input" 
                                                                        type="checkbox" 
                                                                        style={{transform: 'scale(1.2)', cursor: 'pointer'}}
                                                                        checked={permissions[m.key]?.goruntule || false} 
                                                                        onChange={() => handleCheck(m.key, 'goruntule')} 
                                                                    />
                                                                </div>
                                                            </td>

                                                            {/* EKLE/DÜZENLE CHECKBOX */}
                                                            <td className="text-center">
                                                                <div className="form-check form-switch d-flex justify-content-center">
                                                                    <input 
                                                                        className={`form-check-input ${!permissions[m.key]?.goruntule ? 'opacity-25' : ''}`}
                                                                        type="checkbox" 
                                                                        style={{transform: 'scale(1.2)', cursor: permissions[m.key]?.goruntule ? 'pointer' : 'not-allowed'}}
                                                                        checked={permissions[m.key]?.ekle_duzenle || false} 
                                                                        onChange={() => handleCheck(m.key, 'ekle_duzenle')}
                                                                        // Eğer görüntüle kapalıysa bunu açamasın
                                                                        // disabled={!permissions[m.key]?.goruntule} 
                                                                        // YUKARIDAKİ DISABLED YERİNE OTOMATİK AÇILMA MANTIĞI KOYDUK (handleCheck içinde)
                                                                    />
                                                                </div>
                                                            </td>

                                                            {/* SİL CHECKBOX */}
                                                            <td className="text-center">
                                                                <div className="form-check form-switch d-flex justify-content-center">
                                                                    <input 
                                                                        className={`form-check-input bg-danger border-danger ${!permissions[m.key]?.goruntule ? 'opacity-25' : ''}`}
                                                                        type="checkbox" 
                                                                        style={{transform: 'scale(1.2)', cursor: 'pointer'}}
                                                                        checked={permissions[m.key]?.sil || false} 
                                                                        onChange={() => handleCheck(m.key, 'sil')} 
                                                                    />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            
                            <div className="card-footer bg-white border-top p-3">
                                <div className="alert alert-info border-0 shadow-sm d-flex align-items-center gap-3 m-0 rounded-3">
                                    <AlertCircle size={24} className="text-info"/>
                                    <div className="small text-dark opacity-75">
                                        <strong>Bilgi:</strong> "Ekle/Düzenle" veya "Sil" yetkisi verildiğinde, "Görüntüle" yetkisi otomatik olarak açılır. Formlar için "Ekle/Düzenle" yetkisi, indirme iznini temsil eder.
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-100 d-flex align-items-center justify-content-center text-muted flex-column bg-white rounded-4 border shadow-sm p-5">
                            <div className="bg-light p-4 rounded-circle mb-3 shadow-inner">
                                <Lock size={48} className="text-secondary opacity-25"/>
                            </div>
                            <h5 className="fw-bold">Personel Seçimi Bekleniyor</h5>
                            <p className="small opacity-75 text-center" style={{maxWidth: '300px'}}>
                                Yetkilerini görüntülemek ve düzenlemek için lütfen sol taraftaki listeden bir personel seçiniz.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}