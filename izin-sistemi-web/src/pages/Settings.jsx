import { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Search, Plus, Save, Lock, KeyRound, Pencil, Briefcase, Ban, CheckCircle, Trash2, ShieldAlert } from 'lucide-react';

export default function Settings() {
    const [activeTab, setActiveTab] = useState('profile');
    const [user, setUser] = useState(() => { 
        try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } 
    });
    
    const [usersList, setUsersList] = useState([]);
    const [birimler, setBirimler] = useState([]);
    const [arama, setArama] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); 
    
    const [newUser, setNewUser] = useState({ tc_no:'', ad:'', soyad:'', sifre:'', rol_adi:'personel', birim_id: '' });
    const [yeniSifre, setYeniSifre] = useState('');

    const [editingUser, setEditingUser] = useState(null);
    const [selectedBirim, setSelectedBirim] = useState('');
    const [selectedRol, setSelectedRol] = useState('');
    const [dondurmaModal, setDondurmaModal] = useState(null);

    // YETKİ KONTROLÜ
    const isYetkili = user && ['admin', 'ik', 'filo'].includes(user.rol);

    useEffect(() => {
        if(isYetkili) {
            fetchUsers();
            fetchBirimler();
        }
    }, [user]);

    const fetchUsers = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get('https://mersinbb-izin-sistemi.onrender.com/api/auth/users', { headers: { Authorization: `Bearer ${token}` } });
            setUsersList(res.data || []);
        } catch(e) { console.error(e); }
    };

    const fetchBirimler = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get('https://mersinbb-izin-sistemi.onrender.com/api/personel/birimler', { headers: { Authorization: `Bearer ${token}` } });
            if (Array.isArray(res.data)) {
                setBirimler(res.data);
                if(res.data.length > 0 && !newUser.birim_id) {
                    setNewUser(prev => ({...prev, birim_id: res.data[0].birim_id}));
                }
            }
        } catch(e) { console.error(e); }
    };

    const createUser = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            if(!newUser.birim_id) { alert("Lütfen bir amirlik seçiniz!"); return; }
            await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/auth/register', newUser, { headers: { Authorization: `Bearer ${token}` } });
            alert("✅ Personel başarıyla eklendi!");
            fetchUsers();
            setNewUser(prev => ({ ...prev, tc_no:'', ad:'', soyad:'', sifre:'' })); 
        } catch(e) { alert("Hata: " + (e.response?.data?.mesaj || "İşlem başarısız")); }
    };

    const transferEt = async () => {
        if(!selectedBirim) return;
        const token = localStorage.getItem('token');
        try {
            await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/personel/transfer', {
                personel_id: editingUser.personel_id,
                yeni_birim_id: selectedBirim
            }, { headers: { Authorization: `Bearer ${token}` } });

            if (selectedRol && selectedRol !== editingUser.rol_adi && user.rol === 'admin') {
                await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/personel/rol-degistir', {
                    personel_id: editingUser.personel_id,
                    yeni_rol_adi: selectedRol
                }, { headers: { Authorization: `Bearer ${token}` } });
            }
            alert("✅ Güncelleme Başarılı!");
            setEditingUser(null); fetchUsers();
        } catch(e) { alert("Hata: " + (e.response?.data?.mesaj || "İşlem başarısız")); }
    };

    const personelDondur = async (neden) => {
        const token = localStorage.getItem('token');
        try {
            await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/personel/dondur', {
                personel_id: dondurmaModal.personel_id,
                neden: neden
            }, { headers: { Authorization: `Bearer ${token}` } });
            alert("⛔ Personel pasife alındı.");
            setDondurmaModal(null); fetchUsers();
        } catch(e) { alert("Hata: " + (e.response?.data?.mesaj || "Yetkisiz işlem veya hata")); }
    };

    const personelAktifEt = async (id) => {
        if(!window.confirm("Personeli tekrar aktif etmek istiyor musunuz?")) return;
        const token = localStorage.getItem('token');
        try {
            await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/personel/aktif-et', { personel_id: id }, { headers: { Authorization: `Bearer ${token}` } });
            alert("✅ Personel aktif edildi.");
            fetchUsers();
        } catch(e) { alert("Hata: " + (e.response?.data?.mesaj || "Aktif edilemedi")); }
    };

    const personelSil = async (id) => {
        if(!window.confirm("DİKKAT: Bu personeli kalıcı olarak silmek üzeresiniz. Emin misiniz?")) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`https://mersinbb-izin-sistemi.onrender.com/api/personel/sil/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            alert("🗑️ Personel silindi."); 
            fetchUsers();
        } catch(e) { alert("❌ " + (e.response?.data?.mesaj || "Silme işlemi başarısız.")); }
    };

    const updatePassword = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/personel/guncelle', { yeni_sifre: yeniSifre }, { headers: { Authorization: `Bearer ${token}` } });
            alert("✅ Şifreniz güncellendi!"); setYeniSifre('');
        } catch(e) { alert("Hata."); }
    };

    const sortedUsers = [...usersList].sort((a, b) => Number(b.aktif) - Number(a.aktif));
    const filteredUsers = sortedUsers.filter(u => {
        const matchSearch = u.ad.toLowerCase().includes(arama.toLowerCase()) || u.soyad.toLowerCase().includes(arama.toLowerCase()) || u.tc_no.includes(arama);
        if (filterStatus === 'active') return matchSearch && u.aktif;
        if (filterStatus === 'passive') return matchSearch && !u.aktif;
        return matchSearch; 
    });

    const getRoleBadge = (rol) => {
        const colors = { admin: 'bg-danger', amir: 'bg-warning text-dark', yazici: 'bg-info text-dark', ik: 'bg-success', personel: 'bg-secondary', filo: 'bg-primary' };
        return <span className={`badge ${colors[rol] || 'bg-light text-dark'} px-3 py-2 rounded-pill fw-normal`}>{rol.toUpperCase()}</span>;
    };

    if (!user) return <div className="p-5 text-center">Lütfen giriş yapınız...</div>;

    return (
        <div className="container-fluid p-4 p-lg-5" style={{backgroundColor: '#f4f7fe', minHeight: '100vh'}}>
            <h2 className="fw-bold text-dark mb-1">Ayarlar ve Yönetim</h2>
            <ul className="nav nav-tabs mb-4 border-bottom-0">
                <li className="nav-item"><button className={`nav-link border-0 rounded-top px-4 ${activeTab==='profile'?'active bg-white shadow-sm fw-bold text-primary':'text-secondary'}`} onClick={()=>setActiveTab('profile')}>👤 Profilim</button></li>
                {isYetkili && <li className="nav-item ms-2"><button className={`nav-link border-0 rounded-top px-4 ${activeTab==='admin'?'active bg-danger text-white shadow-sm fw-bold':'text-danger bg-danger-subtle'}`} onClick={()=>setActiveTab('admin')}>🛡️ Personel Yönetimi</button></li>}
            </ul>

            {activeTab === 'profile' && (
                <div className="card shadow-sm border-0" style={{maxWidth: '600px'}}>
                    <div className="card-body p-4">
                        <h5 className="fw-bold mb-4 text-primary">Şifre Değiştir</h5>
                        <form onSubmit={updatePassword}>
                            <div className="mb-3"><label className="form-label small">Yeni Şifre</label><input type="password" class="form-control" value={yeniSifre} onChange={e=>setYeniSifre(e.target.value)} required/></div>
                            <button type="submit" className="btn btn-primary w-100 fw-bold">Güncelle</button>
                        </form>
                    </div>
                </div>
            )}

            {activeTab === 'admin' && (
                <div className="row g-4">
                    <div className="col-lg-4">
                        <div className="card border-0 shadow-sm h-100 rounded-4">
                            <div className="card-header bg-primary text-white border-0 pt-4 ps-4"><h5 className="fw-bold m-0"><Plus size={20} className="me-2"/> Yeni Personel</h5></div>
                            <div className="card-body p-4">
                                <form onSubmit={createUser}>
                                    <div className="mb-2"><label className="small fw-bold">TC</label><input className="form-control" value={newUser.tc_no} onChange={e=>setNewUser({...newUser, tc_no:e.target.value})} required maxLength="11"/></div>
                                    <div className="row g-2 mb-2"><div className="col"><label className="small fw-bold">Ad</label><input className="form-control" value={newUser.ad} onChange={e=>setNewUser({...newUser, ad:e.target.value})} required/></div><div className="col"><label className="small fw-bold">Soyad</label><input className="form-control" value={newUser.soyad} onChange={e=>setNewUser({...newUser, soyad:e.target.value})} required/></div></div>
                                    <div className="mb-2"><label className="small fw-bold">Şifre</label><input className="form-control" value={newUser.sifre} onChange={e=>setNewUser({...newUser, sifre:e.target.value})} required/></div>
                                    <div className="mb-2"><label className="small fw-bold">Rol</label><select className="form-select" value={newUser.rol_adi} onChange={e=>setNewUser({...newUser, rol_adi:e.target.value})}><option value="personel">Personel</option><option value="amir">Amir</option><option value="yazici">Yazıcı</option><option value="ik">İK</option><option value="filo">Filo</option>{user.rol === 'admin' && <option value="admin">Admin</option>}</select></div>
                                    <div className="mb-3"><label className="small fw-bold">Birim</label><select className="form-select" value={newUser.birim_id} onChange={e=>setNewUser({...newUser, birim_id:e.target.value})}>{birimler.length === 0 && <option value="">Yükleniyor...</option>}{birimler.map(b => <option key={b.birim_id} value={b.birim_id}>{b.birim_adi}</option>)}</select></div>
                                    <button type="submit" className="btn btn-success w-100 fw-bold">Personeli Kaydet</button>
                                </form>
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-8">
                        <div className="card border-0 shadow-sm h-100 rounded-4">
                            <div className="card-header bg-white border-0 pt-4 ps-4 pb-0">
                                <div className="d-flex justify-content-between align-items-center mb-3"><h5 className="fw-bold m-0 text-dark">👥 Personel Listesi</h5><input type="text" className="form-control form-control-sm" style={{maxWidth:'200px'}} placeholder="Ara..." value={arama} onChange={e=>setArama(e.target.value)}/></div>
                                <div className="nav nav-pills nav-fill bg-light p-1 rounded mb-2" style={{fontSize: '14px'}}>
                                    <button className={`nav-link py-1 fw-bold ${filterStatus==='all'?'active bg-white shadow-sm text-dark':'text-muted'}`} onClick={()=>setFilterStatus('all')}>Tümü</button>
                                    <button className={`nav-link py-1 fw-bold ${filterStatus==='active'?'active bg-success text-white shadow-sm':'text-success'}`} onClick={()=>setFilterStatus('active')}>Aktif</button>
                                    <button className={`nav-link py-1 fw-bold ${filterStatus==='passive'?'active bg-danger text-white shadow-sm':'text-danger'}`} onClick={()=>setFilterStatus('passive')}>Dondurulmuş</button>
                                </div>
                            </div>
                            <div className="card-body p-0"><div className="table-responsive p-3" style={{maxHeight: '600px'}}>
                                <table className="table table-hover align-middle"><thead className="text-muted small text-uppercase"><tr><th className="ps-3">Personel</th><th>Durum</th><th>Rol</th><th>Birim</th><th className="text-end pe-3">İşlem</th></tr></thead><tbody>
                                    {filteredUsers.map(u => (
                                        <tr key={u.personel_id} className={!u.aktif ? 'table-secondary opacity-75' : ''}>
                                            <td className="ps-3 fw-bold">{u.ad} {u.soyad} <br/><small className="text-muted fw-normal">{u.tc_no}</small></td>
                                            <td>{u.aktif ? <span className="badge bg-success-subtle text-success border border-success-subtle">ÇALIŞIYOR</span> : <span className="badge bg-danger-subtle text-danger border border-danger-subtle" title={u.ayrilma_nedeni}>PASİF</span>}</td>
                                            <td>{getRoleBadge(u.rol_adi)}</td>
                                            <td className="small text-muted">{u.birim_adi || '-'}</td>
                                            <td className="text-end pe-3">
                                                {u.aktif ? (
                                                    <div className="d-flex justify-content-end gap-1">
                                                        <button className="btn btn-light btn-sm border text-primary" onClick={() => {
                                                            setEditingUser(u);
                                                            setSelectedRol(u.rol_adi || 'personel');
                                                            // GÜVENLİ BİRİM SEÇİMİ
                                                            const current = birimler.find(b => b.birim_adi === u.birim_adi);
                                                            setSelectedBirim(current ? current.birim_id : (birimler[0]?.birim_id || ''));
                                                        }} title="Düzenle / Transfer"><Pencil size={14}/></button>
                                                        <button className="btn btn-light btn-sm border text-warning" onClick={() => setDondurmaModal(u)} title="Dondur"><Ban size={14}/></button>
                                                    </div>
                                                ) : (
                                                    <div className="d-flex justify-content-end gap-1">
                                                        <button className="btn btn-success btn-sm px-2" onClick={() => personelAktifEt(u.personel_id)} title="Aktif Et"><CheckCircle size={14}/></button>
                                                        {user.rol === 'admin' && <button className="btn btn-danger btn-sm px-2" onClick={() => personelSil(u.personel_id)} title="Sil"><Trash2 size={14}/></button>}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody></table>
                            </div></div>
                        </div>
                    </div>
                </div>
            )}

            {editingUser && (<div className="modal d-block" style={{backgroundColor:'rgba(0,0,0,0.5)'}}><div className="modal-dialog modal-dialog-centered"><div className="modal-content shadow rounded-4"><div className="modal-header bg-warning text-dark border-0"><h5 className="modal-title fw-bold">Düzenle / Transfer</h5><button className="btn-close" onClick={()=>setEditingUser(null)}></button></div><div className="modal-body p-4"><p className="text-center mb-4 fs-5"><strong>{editingUser.ad} {editingUser.soyad}</strong></p><label className="form-label small fw-bold">Birim</label><select className="form-select mb-3" value={selectedBirim} onChange={e=>setSelectedBirim(e.target.value)}>{birimler.map(b=><option key={b.birim_id} value={b.birim_id}>{b.birim_adi}</option>)}</select>
            
            {user.rol === 'admin' && (<><label className="form-label small fw-bold">Yetki Rolü</label><select className="form-select" value={selectedRol} onChange={e=>setSelectedRol(e.target.value)}><option value="personel">Personel</option><option value="amir">Amir</option><option value="yazici">Yazıcı</option><option value="ik">İK</option><option value="filo">Filo</option><option value="admin">Admin</option></select></>)}
            </div><div className="modal-footer border-0"><button className="btn btn-secondary" onClick={()=>setEditingUser(null)}>İptal</button><button className="btn btn-primary fw-bold px-4" onClick={transferEt}>Kaydet</button></div></div></div></div>)}
            
            {dondurmaModal && (<div className="modal d-block" style={{backgroundColor:'rgba(0,0,0,0.5)'}}><div className="modal-dialog modal-dialog-centered"><div className="modal-content shadow border-0 rounded-4"><div className="modal-header bg-danger text-white border-0"><h5 className="modal-title fw-bold">Dondurma</h5><button className="btn-close" onClick={()=>setDondurmaModal(null)}></button></div><div className="modal-body text-center"><p className="mb-3">Sebep seçiniz:</p><div className="d-grid gap-2"><button className="btn btn-outline-danger fw-bold" onClick={()=>personelDondur('EMEKLİLİK')}>Emeklilik</button><button className="btn btn-outline-danger fw-bold" onClick={()=>personelDondur('İŞ AKDİ FESHİ')}>Fesih</button><button className="btn btn-outline-danger fw-bold" onClick={()=>personelDondur('VEFAT')}>Vefat</button><button className="btn btn-outline-danger fw-bold" onClick={()=>personelDondur('DİĞER')}>Diğer</button></div></div></div></div></div>)}
        </div>
    );
}