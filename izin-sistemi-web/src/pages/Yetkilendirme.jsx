import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Search, ShieldCheck, User } from 'lucide-react';

export default function Yetkilendirme() {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [search, setSearch] = useState('');
    
    // SİSTEMDEKİ MODÜLLER (Sidebar'daki linklerinle ve veritabanı ile uyumlu anahtarlar)
    const moduller = [
        { key: 'dashboard', ad: 'Ana Sayfa / Dashboard' },
        { key: 'izin_talep', ad: 'İzin Talebi Oluşturma' },
        { key: 'izin_onay', ad: 'İzin Onay Ekranı' },
        { key: 'personel_yonetim', ad: 'Personel Yönetimi' },
        { key: 'ayarlar', ad: 'Ayarlar' },
        { key: 'yetkilendirme', ad: 'Yetkilendirme Paneli' }
    ];

    // Checkbox durumlarını tutan state
    const [permissions, setPermissions] = useState({});

    // Sayfa açılınca personelleri getir
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
            
            // --- DEĞİŞİKLİK BURADA: Varsayılan olarak HEPSİNİ TRUE (AÇIK) YAP ---
            moduller.forEach(m => {
                loadedPerms[m.key] = { goruntule: true, ekle_duzenle: true, sil: true };
            });
            
            // Veritabanında özel bir ayar varsa onunla değiştir (Örn: kapatılmışsa kapat)
            res.data.forEach(p => {
                loadedPerms[p.modul_adi] = {
                    goruntule: p.goruntule,
                    ekle_duzenle: p.ekle_duzenle,
                    sil: p.sil
                };
            });
            setPermissions(loadedPerms);
        } catch (error) {
            console.error(error);
        }
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
        
        // Veriyi API formatına çevir
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
            alert(`✅ ${selectedUser.ad} ${selectedUser.soyad} yetkileri güncellendi!`);
        } catch (error) {
            alert('Hata oluştu.');
        }
    };

    const filteredUsers = users.filter(u => u.ad.toLowerCase().includes(search.toLowerCase()) || u.soyad.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="container-fluid p-4" style={{ backgroundColor: '#f4f7fe', minHeight: '100vh' }}>
            <h3 className="fw-bold text-dark mb-4"><ShieldCheck size={28} className="me-2"/>Yetkilendirme İşlemleri</h3>
            
            <div className="row g-4">
                {/* SOL TARAFA: PERSONEL LİSTESİ */}
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm h-100 rounded-4">
                        <div className="card-header bg-white border-0 pt-4 px-4">
                            <div className="input-group">
                                <span className="input-group-text bg-light border-0"><Search size={18}/></span>
                                <input type="text" className="form-control bg-light border-0" placeholder="Personel ara..." value={search} onChange={e=>setSearch(e.target.value)}/>
                            </div>
                        </div>
                        <div className="card-body p-0 overflow-auto" style={{maxHeight: '600px'}}>
                            <div className="list-group list-group-flush">
                                {filteredUsers.map(u => (
                                    <button 
                                        key={u.personel_id} 
                                        className={`list-group-item list-group-item-action border-0 px-4 py-3 d-flex align-items-center ${selectedUser?.personel_id === u.personel_id ? 'bg-primary text-white' : ''}`}
                                        onClick={() => handleUserSelect(u)}
                                    >
                                        <div className={`rounded-circle d-flex align-items-center justify-content-center me-3 ${selectedUser?.personel_id === u.personel_id ? 'bg-white text-primary' : 'bg-light text-dark'}`} style={{width:'40px', height:'40px'}}>
                                            <User size={20}/>
                                        </div>
                                        <div>
                                            <div className="fw-bold">{u.ad} {u.soyad}</div>
                                            <div className="small opacity-75">{u.rol_adi.toUpperCase()}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* SAĞ TARAF: YETKİ TABLOSU */}
                <div className="col-md-8">
                    {selectedUser ? (
                        <div className="card border-0 shadow-sm h-100 rounded-4">
                            <div className="card-header bg-primary text-white border-0 py-3 px-4 d-flex justify-content-between align-items-center rounded-top-4">
                                <h5 className="m-0 fw-bold">{selectedUser.ad} {selectedUser.soyad}</h5>
                                <button className="btn btn-light text-primary fw-bold btn-sm shadow-sm" onClick={savePermissions}>
                                    <Save size={18} className="me-2"/>Değişiklikleri Kaydet
                                </button>
                            </div>
                            <div className="card-body p-4">
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle">
                                        <thead className="table-light">
                                            <tr>
                                                <th style={{width: '40%'}} className="ps-3">Modül Adı</th>
                                                <th className="text-center">Görüntüle</th>
                                                <th className="text-center">Ekle / Düzenle</th>
                                                <th className="text-center">Sil</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {moduller.map(m => (
                                                <tr key={m.key}>
                                                    <td className="fw-bold text-secondary ps-3">{m.ad}</td>
                                                    <td className="text-center">
                                                        <div className="form-check d-flex justify-content-center">
                                                            <input className="form-check-input" type="checkbox" style={{transform: 'scale(1.3)', cursor:'pointer'}}
                                                                checked={permissions[m.key]?.goruntule || false} 
                                                                onChange={() => handleCheck(m.key, 'goruntule')} 
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="text-center">
                                                        <div className="form-check d-flex justify-content-center">
                                                            <input className="form-check-input" type="checkbox" style={{transform: 'scale(1.3)', cursor:'pointer'}}
                                                                checked={permissions[m.key]?.ekle_duzenle || false} 
                                                                onChange={() => handleCheck(m.key, 'ekle_duzenle')}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="text-center">
                                                        <div className="form-check d-flex justify-content-center">
                                                            <input className="form-check-input" type="checkbox" style={{transform: 'scale(1.3)', cursor:'pointer'}}
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
                                <div className="alert alert-warning small mt-3">
                                    <ShieldCheck size={16} className="me-2"/>
                                    <strong>Not:</strong> "Görüntüle" yetkisi kaldırılan modüller, kullanıcının menüsünden tamamen silinir.
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-100 d-flex align-items-center justify-content-center text-muted flex-column">
                            <div className="bg-white p-5 rounded-circle shadow-sm mb-3"><Search size={48} className="text-primary opacity-50"/></div>
                            <h5>Yetkilerini düzenlemek için soldan bir personel seçiniz.</h5>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}