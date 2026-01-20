import { useState } from 'react';
import { useModule } from '../context/ModuleContext';
import { 
    Grid, LogOut, User, FileText, Shirt, MessageSquare, ChevronDown, 
    Moon, Sun, ShieldCheck, Crown // Crown ve ShieldCheck eklendi
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Header() {
    const { activeModule, changeModule } = useModule();
    const navigate = useNavigate();
    const [showApps, setShowApps] = useState(false);
    const [showProfile, setShowProfile] = useState(false);

    let user = null;
    try { user = JSON.parse(localStorage.getItem('user')); } catch {}

    // Admin Kontrolü
    const isAdmin = user?.rol === 'admin';

    const handleLogout = () => {
        if(confirm("Çıkış yapmak istediğinize emin misiniz?")) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    };

    const modules = [
        { key: 'IZIN', title: 'İzin Sistemi', icon: <FileText size={28}/>, desc: 'Personel izin yönetim', color: '#3b82f6', bg: '#eff6ff' },
        { key: 'TALEP', title: 'Talep & Öneri', icon: <MessageSquare size={28}/>, desc: 'Şikayet ve İstekler', color: '#10b981', bg: '#ecfdf5' },
        { key: 'KIYAFET', title: 'Lojistik Yönetim', icon: <Shirt size={28}/>, desc: 'Kıyafet ve Depo', color: '#f59e0b', bg: '#fffbeb' },
    ];

    // Admin ise modüllere YÖNETİM ekleyelim veya farklılaştıralım (Opsiyonel)
    if(isAdmin) {
        // Admin'e özel modül eklenebilir
    }

    const handleModuleClick = (key) => {
        changeModule(key);
        setShowApps(false);
        navigate('/dashboard/home');
    };

    return (
        <header className="bg-white border-bottom px-4 d-flex justify-content-between align-items-center sticky-top shadow-sm" style={{height: '75px', zIndex: 1050}}>
            
            {/* SOL: BAŞLIK */}
            <div>
                <h5 className="m-0 fw-bold text-dark d-flex align-items-center gap-2">
                    {activeModule === 'IZIN' && <><FileText className="text-primary"/> İzin Yönetimi</>}
                    {activeModule === 'TALEP' && <><MessageSquare className="text-success"/> Talep & Öneri</>}
                    {activeModule === 'KIYAFET' && <><Shirt className="text-warning"/> Lojistik Yönetimi</>}
                </h5>
                <small className="text-muted">
                    {isAdmin ? 'Yönetici Paneli Aktif' : `Hoş geldiniz, ${user?.ad}`}
                </small>
            </div>

            {/* SAĞ: ARAÇLAR */}
            <div className="d-flex align-items-center gap-3">
                
                {/* 1. ÜRÜNLER (APP LAUNCHER) */}
                <div className="position-relative">
                    <button 
                        className={`btn rounded-circle p-2 d-flex align-items-center justify-content-center border-0 transition-all ${showApps ? 'bg-light text-primary' : 'text-secondary hover-bg-light'}`}
                        onClick={() => { setShowApps(!showApps); setShowProfile(false); }}
                        title="Modüller"
                    >
                        <Grid size={22}/>
                    </button>

                    {showApps && (
                        <div className="position-absolute end-0 mt-3 bg-white shadow-lg border rounded-4 p-3 animate-fade-in" style={{width: '340px', zIndex: 2000}}>
                            <div className="d-flex justify-content-between align-items-center mb-3 px-1">
                                <h6 className="fw-bold m-0 text-dark">Modüller</h6>
                                <span className="badge bg-light text-muted border">Aktif</span>
                            </div>
                            <div className="row g-2">
                                {modules.map(m => (
                                    <div className="col-6" key={m.key}>
                                        <button 
                                            onClick={() => handleModuleClick(m.key)}
                                            className={`btn w-100 h-100 p-3 text-start rounded-4 border-0 d-flex flex-column align-items-start gap-2 transition-all ${activeModule === m.key ? 'ring-2 ring-offset-1' : 'hover-scale'}`}
                                            style={{backgroundColor: m.bg, border: activeModule === m.key ? `2px solid ${m.color}` : '1px solid transparent'}}
                                        >
                                            <div style={{color: m.color}}>{m.icon}</div>
                                            <div>
                                                <div className="fw-bold text-dark small">{m.title}</div>
                                                <div className="text-muted" style={{fontSize: '10px'}}>{m.desc}</div>
                                            </div>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="vr mx-1 bg-secondary opacity-25" style={{height: '25px'}}></div>

                {/* 2. PROFİL KARTI (ADMİN ÖZEL TASARIM) */}
                <div className="position-relative">
                    <button 
                        className="btn d-flex align-items-center gap-3 border-0 p-1 pe-3 rounded-pill transition-all hover-bg-light"
                        onClick={() => { setShowProfile(!showProfile); setShowApps(false); }}
                        style={{
                            backgroundColor: showProfile ? '#f1f5f9' : 'transparent',
                            border: isAdmin ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent' // Admin ise altın çerçeve
                        }}
                    >
                        <div className="d-flex flex-column align-items-end d-none d-md-flex">
                            <span className="fw-bold text-dark small">{user?.ad} {user?.soyad}</span>
                            {/* Admin ise özel etiket */}
                            {isAdmin ? (
                                <span className="badge bg-warning text-dark border border-warning px-1" style={{fontSize: '9px', lineHeight:'10px'}}>YÖNETİCİ</span>
                            ) : (
                                <span className="text-muted" style={{fontSize: '10px'}}>{user?.birim_adi || 'Personel'}</span>
                            )}
                        </div>
                        
                        {/* AVATAR: Admin ise farklı renk ve ikon */}
                        <div 
                            className="rounded-circle d-flex align-items-center justify-content-center shadow-sm fw-bold text-white" 
                            style={{
                                width: '42px', 
                                height: '42px', 
                                background: isAdmin 
                                    ? 'linear-gradient(135deg, #d97706, #f59e0b)' // Admin: Altın Sarısı
                                    : 'linear-gradient(135deg, #4f46e5, #ec4899)' // Normal: Mor/Pembe
                            }}
                        >
                            {isAdmin ? <Crown size={20} fill="white" strokeWidth={1.5} /> : (user?.ad?.[0] || 'U')}
                        </div>
                        <ChevronDown size={16} className="text-muted"/>
                    </button>

                    {showProfile && (
                        <div className="position-absolute end-0 mt-3 bg-white shadow-lg border rounded-4 overflow-hidden animate-fade-in" style={{width: '280px', zIndex: 2000}}>
                            {/* Profil Başlık Alanı */}
                            <div className="p-4 border-bottom text-center" 
                                 style={{background: isAdmin ? 'linear-gradient(to bottom, #fffbeb, #ffffff)' : '#f8f9fa'}}>
                                
                                <div className="mx-auto bg-white p-1 rounded-circle shadow-sm d-inline-block mb-2 position-relative">
                                    <div 
                                        className="rounded-circle d-flex align-items-center justify-content-center fw-bold fs-4 text-white" 
                                        style={{
                                            width: '64px', 
                                            height: '64px', 
                                            background: isAdmin ? 'linear-gradient(135deg, #d97706, #f59e0b)' : 'linear-gradient(135deg, #4f46e5, #ec4899)'
                                        }}
                                    >
                                        {isAdmin ? <ShieldCheck size={32}/> : user?.ad?.[0]}
                                    </div>
                                    {isAdmin && (
                                        <span className="position-absolute bottom-0 end-0 bg-success border border-2 border-white rounded-circle p-1"></span>
                                    )}
                                </div>
                                <h6 className="m-0 fw-bold">{user?.ad} {user?.soyad}</h6>
                                <span className={`badge mt-1 ${isAdmin ? 'bg-warning text-dark' : 'bg-light text-muted border'}`}>
                                    {isAdmin ? 'SİSTEM YÖNETİCİSİ' : user?.birim_adi}
                                </span>
                            </div>
                            
                            <div className="p-3">
                                {/* Admin'e Özel Mesaj */}
                                {isAdmin && (
                                    <div className="alert alert-warning py-2 px-3 small border-0 bg-opacity-10 mb-3 d-flex align-items-center gap-2">
                                        <ShieldCheck size={14}/>
                                        <span>Tam yetkili oturum.</span>
                                    </div>
                                )}

                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <span className="fw-bold small text-muted">Tema</span>
                                    <div className="d-flex bg-light rounded-pill p-1 border">
                                        <button className="btn btn-sm btn-white rounded-circle shadow-sm text-warning p-1"><Sun size={14}/></button>
                                        <button className="btn btn-sm text-secondary p-1"><Moon size={14}/></button>
                                    </div>
                                </div>
                                
                                <button className="btn btn-danger w-100 rounded-3 py-2 d-flex align-items-center justify-content-center gap-2 mt-2" onClick={handleLogout}>
                                    <LogOut size={16}/> Çıkış Yap
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </header>
    );
}