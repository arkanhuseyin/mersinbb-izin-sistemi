import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Search, ShieldCheck, User, CheckCircle, AlertCircle, LayoutDashboard, FileText, FileBarChart, Settings, UserCog, PlusCircle, File, FolderDown } from 'lucide-react';

export default function Yetkilendirme() {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    
    // --- MODÜL LİSTESİ (Form 1 ve Form 2 Eklendi) ---
    // type: 'general' -> Standart menüler
    // type: 'form' -> Form indirme yetkisi olanlar
    const moduller = [
        { key: 'dashboard', ad: 'Genel Bakış / Dashboard', icon: <LayoutDashboard size={18}/>, type: 'general' },
        { key: 'izin_talep', ad: 'Yeni İzin Talebi', icon: <PlusCircle size={18}/>, type: 'general' },
        { key: 'izin_onay', ad: 'İzin Talepleri (Onay Ekranı)', icon: <FileText size={18}/>, type: 'general' },
        { key: 'rapor', ad: 'İzin Takip Raporu', icon: <FileBarChart size={18}/>, type: 'general' },
        { key: 'ayarlar', ad: 'Ayarlar', icon: <Settings size={18}/>, type: 'general' },
        { key: 'personel_yonetim', ad: 'Personel Yönetimi', icon: <UserCog size={18}/>, type: 'general' },
        { key: 'yetkilendirme', ad: 'Yetkilendirme Paneli', icon: <ShieldCheck size={18}/>, type: 'general' },
        // YENİ EKLENEN FORMLAR
        { key: 'form1', ad: 'Form 1 (Görüntüle/İndir)', icon: <File size={18}/>, type: 'form' }, 
        { key: 'form2', ad: 'Form 2 (Görüntüle/İndir)', icon: <FolderDown size={18}/>, type: 'form' }
    ];

    const [permissions, setPermissions] = useState({});

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get('https://mersinbb-izin-sistemi.onrender.com/api/auth/users', { headers: { Authorization: `Bearer ${token}` } });
            setUsers(res.data || []);
        } catch(e) { console.error(e); }
    };

    const handleUserSelect = async (user) => {
        setSelectedUser(user);
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`https://mersinbb-izin-sistemi.onrender.com/api/yetki/${user.personel_id}`, { headers: { Authorization: `Bearer ${token}` } });
            
            const loadedPerms = {};
            
            // 🔥 KRİTİK DÜZELTME (F5 Sorunu Çözümü) 🔥
            // Eskiden: Her şeyi 'true' yapıyorduk.
            // Şimdi: Her şeyi 'false' (kapalı) başlatıyoruz. Veritabanında kayıt varsa açılacak.
            moduller.forEach(m => {
                // Sadece Dashboard varsayılan olarak açık kalsın, diğerleri kapalı.
                const defaultState = m.key === 'dashboard'; 
                loadedPerms[m.key] = { goruntule: defaultState, ekle_duzenle: false, sil: false };
            });
            
            // Veritabanından gelen yetkileri işle (Varsa 'true' olur)
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
        } catch (error) { console.error(error); }
    };

    const handleCheck = (modulKey, type) => {
        setPermissions(prev => ({
            ...prev,
            [modulKey]: {
                ...prev[modulKey],
                [type]: !prev[modulKey]?.[type]
            }
        }));
    };

    const savePermissions = async () => {
        if (!selectedUser) return;
        setLoading(true);
        
        // Tüm modülleri (işaretli veya işaretsiz) gönderiyoruz ki backend silip yeniden yazsın
        const yetkiListesi = Object.keys(permissions).map(key => ({
            modul_adi: key,
            goruntule: permissions[key]?.goruntule || false,
            ekle_duzenle: permissions[key]?.ekle_duzenle || false,
            sil: permissions[key]?.sil || false
        }));

        const token = localStorage.getItem('token');
        try {
            await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/yetki/kaydet', {
                personel_id: selectedUser.personel_id,
                yetkiler: yetkiListesi
            }, { headers: { Authorization: `Bearer ${token}` } });
            alert(`✅ ${selectedUser.ad} ${selectedUser.soyad} yetkileri başarıyla kaydedildi!`);
        } catch (error) {
            alert('Hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(u => u.ad.toLowerCase().includes(search.toLowerCase()) || u.soyad.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="container-fluid p-4 p-lg-5" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
            
            {/* BAŞLIK KARTI */}
            <div className="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden" 
                 style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', color: '#fff' }}>
                <div className="card-body p-4 d-flex align-items-center gap-3">
                    <div className="bg-white bg-opacity-25 p-3 rounded-circle">
                        <ShieldCheck size={32} color="#fff" />
                    </div>
                    <div>
                        <h4 className="fw-bold m-0">Yetkilendirme Paneli</h4>
                        <p className="m-0 opacity-75 small">Personel bazlı modül ve form erişim izinlerini yönetin.</p>
                    </div>
                </div>
            </div>
            
            <div className="row g-4">
                
                {/* SOL: PERSONEL LİSTESİ */}
                <div className="col-lg-4 col-xl-3">
                    <div className="card border-0 shadow-sm h-100 rounded-4 overflow-hidden">
                        <div className="card-header bg-white border-bottom border-light p-3">
                            <div className="position-relative">
                                <Search size={18} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"/>
                                <input 
                                    type="text" 
                                    className="form-control border-0 bg-light rounded-pill ps-5" 
                                    placeholder="Personel ara..." 
                                    value={search} 
                                    onChange={e=>setSearch(e.target.value)}
                                    style={{fontSize:'14px'}}
                                />
                            </div>
                        </div>
                        <div className="card-body p-0 overflow-auto" style={{maxHeight: '650px'}}>
                            <div className="list-group list-group-flush">
                                {filteredUsers.map(u => (
                                    <button 
                                        key={u.personel_id} 
                                        className={`list-group-item list-group-item-action border-0 px-4 py-3 d-flex align-items-center gap-3 transition-all ${selectedUser?.personel_id === u.personel_id ? 'bg-primary bg-opacity-10 border-start border-4 border-primary' : ''}`}
                                        onClick={() => handleUserSelect(u)}
                                        style={{transition: '0.2s'}}
                                    >
                                        <div className={`rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm ${selectedUser?.personel_id === u.personel_id ? 'bg-primary' : 'bg-secondary bg-opacity-50'}`} 
                                             style={{width:'40px', height:'40px', fontSize:'14px'}}>
                                            {u.ad[0]}{u.soyad[0]}
                                        </div>
                                        <div className="flex-grow-1 text-start">
                                            <div className={`fw-bold ${selectedUser?.personel_id === u.personel_id ? 'text-primary' : 'text-dark'}`} style={{fontSize:'14px'}}>{u.ad} {u.soyad}</div>
                                            <div className="small text-muted" style={{fontSize:'11px'}}>{u.rol_adi.toUpperCase()}</div>
                                        </div>
                                        {selectedUser?.personel_id === u.personel_id && <CheckCircle size={18} className="text-primary"/>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* SAĞ: YETKİ TABLOSU */}
                <div className="col-lg-8 col-xl-9">
                    {selectedUser ? (
                        <div className="card border-0 shadow-sm h-100 rounded-4">
                            <div className="card-header bg-white border-bottom border-light py-3 px-4 d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="rounded-circle bg-primary bg-opacity-10 p-2 text-primary">
                                        <User size={24}/>
                                    </div>
                                    <div>
                                        <h5 className="m-0 fw-bold text-dark">{selectedUser.ad} {selectedUser.soyad}</h5>
                                        <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 rounded-pill fw-normal">
                                            {selectedUser.rol_adi.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                                <button className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-2" onClick={savePermissions} disabled={loading}>
                                    <Save size={18}/> {loading ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                                </button>
                            </div>
                            
                            <div className="card-body p-0">
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle mb-0">
                                        <thead className="bg-light">
                                            <tr>
                                                <th style={{width: '40%'}} className="ps-4 py-3 text-uppercase text-muted small fw-bold">Modül / Form Adı</th>
                                                <th className="text-center text-uppercase text-muted small fw-bold">Görüntüle</th>
                                                {/* Başlığı dinamik yaptık: Form ise "İndir" yazar */}
                                                <th className="text-center text-uppercase text-muted small fw-bold">Ekle/Düz./İndir</th>
                                                <th className="text-center text-uppercase text-muted small fw-bold">Sil</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {moduller.map(m => (
                                                <tr key={m.key} style={{borderBottom: '1px solid #f0f0f0'}}>
                                                    <td className="ps-4 py-3">
                                                        <div className="d-flex align-items-center gap-3">
                                                            {/* Formları farklı renkle ayıralım */}
                                                            <div className={`p-2 rounded-3 ${m.type === 'form' ? 'bg-warning bg-opacity-10 text-warning' : 'bg-light text-primary'}`}>
                                                                {m.icon}
                                                            </div>
                                                            <span className="fw-semibold text-dark">{m.ad}</span>
                                                        </div>
                                                    </td>
                                                    
                                                    {/* GÖRÜNTÜLEME */}
                                                    <td className="text-center">
                                                        <div className="form-check form-switch d-flex justify-content-center">
                                                            <input className="form-check-input" type="checkbox" role="switch" style={{width:'3rem', height:'1.5rem', cursor:'pointer'}}
                                                                checked={permissions[m.key]?.goruntule || false} 
                                                                onChange={() => handleCheck(m.key, 'goruntule')} 
                                                            />
                                                        </div>
                                                    </td>
                                                    
                                                    {/* EKLE/DÜZENLE veya İNDİR */}
                                                    <td className="text-center">
                                                        <div className="form-check form-switch d-flex justify-content-center">
                                                            <input className="form-check-input" type="checkbox" role="switch" style={{width:'3rem', height:'1.5rem', cursor:'pointer'}}
                                                                checked={permissions[m.key]?.ekle_duzenle || false} 
                                                                onChange={() => handleCheck(m.key, 'ekle_duzenle')}
                                                            />
                                                        </div>
                                                        {/* Form ise altına ufak bilgi notu */}
                                                        {m.type === 'form' && <small className="text-muted fw-bold" style={{fontSize:'10px'}}>İndirme Yetkisi</small>}
                                                    </td>

                                                    {/* SİLME (Formlar için gerekmiyorsa disabled bırakılabilir veya açık kalabilir) */}
                                                    <td className="text-center">
                                                        <div className="form-check form-switch d-flex justify-content-center">
                                                            <input className="form-check-input" type="checkbox" role="switch" style={{width:'3rem', height:'1.5rem', cursor:'pointer'}}
                                                                checked={permissions[m.key]?.sil || false} 
                                                                onChange={() => handleCheck(m.key, 'sil')}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            <div className="card-footer bg-light border-0 p-3">
                                <div className="alert alert-primary border-0 shadow-sm d-flex align-items-center gap-3 m-0 rounded-3">
                                    <AlertCircle size={24} className="text-primary"/>
                                    <div className="small text-dark">
                                        <strong>Bilgi:</strong> Formlar satırındaki "Ekle/Düz./İndir" sütunu, kullanıcının o formu <strong>bilgisayarına indirme</strong> yetkisini temsil eder. Kapalıysa buton gizlenir.
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-100 d-flex align-items-center justify-content-center text-muted flex-column bg-white rounded-4 border shadow-sm p-5">
                            <div className="bg-light p-4 rounded-circle mb-3">
                                <Search size={48} className="text-primary opacity-50"/>
                            </div>
                            <h5 className="fw-bold">Personel Seçimi Yapılmadı</h5>
                            <p className="small opacity-75">Yetkilerini düzenlemek için lütfen sol listeden bir personel seçiniz.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}