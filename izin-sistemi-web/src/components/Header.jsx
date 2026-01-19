import { useState } from 'react';
import { useModule } from '../context/ModuleContext';
import { 
    Grid, LogOut, User, FileText, Shirt, MessageSquare, ChevronDown, Bell, Moon, Sun, ArrowRightCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Header() {
    const { activeModule, changeModule } = useModule();
    const navigate = useNavigate();
    const [showApps, setShowApps] = useState(false);
    const [showProfile, setShowProfile] = useState(false);

    let user = null;
    try { user = JSON.parse(localStorage.getItem('user')); } catch {}

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    const modules = [
        { key: 'IZIN', title: 'İzin Sistemi', icon: <FileText size={28}/>, desc: 'Personel izin yönetim', color: '#3b82f6', bg: '#eff6ff' },
        { key: 'TALEP', title: 'Talep & Öneri', icon: <MessageSquare size={28}/>, desc: 'Şikayet ve İstekler', color: '#10b981', bg: '#ecfdf5' },
        { key: 'KIYAFET', title: 'Lojistik Yönetim', icon: <Shirt size={28}/>, desc: 'Kıyafet ve Depo', color: '#f59e0b', bg: '#fffbeb' },
        { key: 'IK', title: 'Kimlik Portal', icon: <User size={28}/>, desc: 'Personel Kartları', color: '#6366f1', bg: '#eef2ff' },
    ];

    const handleModuleClick = (key) => {
        changeModule(key);
        setShowApps(false);
        navigate('/dashboard/home'); // Modül değişince ana sayfaya at
    };

    return (
        <header className="bg-white border-bottom px-4 d-flex justify-content-between align-items-center sticky-top shadow-sm" style={{height: '75px', zIndex: 1050}}>
            
            {/* SOL: BAŞLIK / BREADCRUMB */}
            <div>
                <h5 className="m-0 fw-bold text-dark d-flex align-items-center gap-2">
                    {activeModule === 'IZIN' && <><FileText className="text-primary"/> İzin Yönetimi</>}
                    {activeModule === 'TALEP' && <><MessageSquare className="text-success"/> Talep / Şikayet / Öneri</>}
                    {activeModule === 'KIYAFET' && <><Shirt className="text-warning"/> Lojistik Yönetimi</>}
                </h5>
                <small className="text-muted">Hoş geldiniz, {user?.ad}</small>
            </div>

            {/* SAĞ: ARAÇLAR */}
            <div className="d-flex align-items-center gap-3">
                
                {/* 1. ÜRÜNLER (GRID MENÜ) */}
                <div className="position-relative">
                    <button 
                        className={`btn rounded-circle p-2 d-flex align-items-center justify-content-center border-0 transition-all ${showApps ? 'bg-light text-primary' : 'text-secondary hover-bg-light'}`}
                        onClick={() => { setShowApps(!showApps); setShowProfile(false); }}
                    >
                        <Grid size={22}/>
                    </button>

                    {showApps && (
                        <div className="position-absolute end-0 mt-3 bg-white shadow-lg border rounded-4 p-3 animate-fade-in" style={{width: '340px', zIndex: 2000}}>
                            <div className="d-flex justify-content-between align-items-center mb-3 px-1">
                                <h6 className="fw-bold m-0 text-dark">Ürünlerim</h6>
                                <span className="badge bg-light text-muted border">4 Aktif</span>
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

                {/* 2. PROFİL KARTI (YUVARLAK & MODERN) */}
                <div className="position-relative">
                    <button 
                        className="btn d-flex align-items-center gap-3 border-0 p-1 pe-3 rounded-pill transition-all hover-bg-light"
                        onClick={() => { setShowProfile(!showProfile); setShowApps(false); }}
                        style={{backgroundColor: showProfile ? '#f1f5f9' : 'transparent'}}
                    >
                        <div className="d-flex flex-column align-items-end d-none d-md-flex">
                            <span className="fw-bold text-dark small">{user?.ad} {user?.soyad}</span>
                            <span className="text-muted" style={{fontSize: '10px'}}>{user?.email || 'Personel'}</span>
                        </div>
                        <div className="bg-gradient-primary text-white rounded-circle d-flex align-items-center justify-content-center shadow-sm fw-bold" 
                             style={{width: '42px', height: '42px', background: 'linear-gradient(135deg, #4f46e5, #ec4899)'}}>
                            {user?.ad?.[0] || 'U'}
                        </div>
                        <ChevronDown size={16} className="text-muted"/>
                    </button>

                    {showProfile && (
                        <div className="position-absolute end-0 mt-3 bg-white shadow-lg border rounded-4 overflow-hidden animate-fade-in" style={{width: '280px', zIndex: 2000}}>
                            <div className="p-4 border-bottom bg-light bg-opacity-50 text-center">
                                <div className="mx-auto bg-white p-1 rounded-circle shadow-sm d-inline-block mb-2">
                                    <div className="bg-gradient-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold fs-4" 
                                         style={{width: '64px', height: '64px', background: 'linear-gradient(135deg, #4f46e5, #ec4899)'}}>
                                        {user?.ad?.[0]}
                                    </div>
                                </div>
                                <h6 className="m-0 fw-bold">{user?.ad} {user?.soyad}</h6>
                                <small className="text-muted">{user?.birim_adi}</small>
                            </div>
                            
                            <div className="p-3">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <span className="fw-bold small text-muted">Tema</span>
                                    <div className="d-flex bg-light rounded-pill p-1 border">
                                        <button className="btn btn-sm btn-white rounded-circle shadow-sm text-warning p-1"><Sun size={14}/></button>
                                        <button className="btn btn-sm text-secondary p-1"><Moon size={14}/></button>
                                    </div>
                                </div>
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <span className="fw-bold small text-muted">Dil</span>
                                    <div className="d-flex align-items-center gap-1 bg-light px-2 py-1 rounded-pill border">
                                        <span className="fi fi-tr"></span> <span className="small fw-bold">Türkçe</span>
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