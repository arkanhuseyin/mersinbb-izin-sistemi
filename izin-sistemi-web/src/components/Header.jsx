import { useState } from 'react';
import { useModule } from '../context/ModuleContext';
import { 
    Grid, LogOut, User, FileText, Shirt, MessageSquare, ChevronDown, Bell 
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
        if(confirm('Çıkış yapmak istediğinize emin misiniz?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    };

    const modules = [
        { key: 'IZIN', title: 'İzin Yönetimi', icon: <FileText size={24}/>, color: 'text-primary', bg: 'bg-primary' },
        { key: 'TALEP', title: 'Talep & Öneri', icon: <MessageSquare size={24}/>, color: 'text-success', bg: 'bg-success' },
        { key: 'KIYAFET', title: 'Kıyafet Depo', icon: <Shirt size={24}/>, color: 'text-warning', bg: 'bg-warning' },
        // İleride eklenecekler buraya...
    ];

    // Modül değiştirince Dashboard home'a atalım
    const handleModuleClick = (key) => {
        changeModule(key);
        setShowApps(false);
        navigate('/dashboard/home');
    };

    return (
        <header className="bg-white border-bottom py-2 px-4 d-flex justify-content-between align-items-center sticky-top" style={{height: '70px', zIndex: 1050}}>
            
            {/* SOL TARAFTAKİ AKTİF MODÜL İSMİ */}
            <div className="d-flex align-items-center gap-3">
                <h5 className="m-0 fw-bold text-dark">
                    {modules.find(m => m.key === activeModule)?.title || 'Yönetim Paneli'}
                </h5>
            </div>

            {/* SAĞ TARAF: APP LAUNCHER & PROFİL */}
            <div className="d-flex align-items-center gap-3">
                
                {/* 1. APP LAUNCHER (MODÜL SEÇİCİ) */}
                <div className="position-relative">
                    <button 
                        className="btn btn-light rounded-circle p-2 d-flex align-items-center justify-content-center border-0 hover-bg-gray"
                        onClick={() => { setShowApps(!showApps); setShowProfile(false); }}
                        title="Uygulamalar"
                    >
                        <Grid size={24} className="text-secondary"/>
                    </button>

                    {showApps && (
                        <div className="position-absolute end-0 mt-3 bg-white shadow-lg rounded-4 border p-3" style={{width: '320px', zIndex: 2000}}>
                            <h6 className="fw-bold mb-3 px-2 text-muted small">UYGULAMALAR</h6>
                            <div className="row g-2">
                                {modules.map(m => (
                                    <div className="col-4" key={m.key}>
                                        <button 
                                            onClick={() => handleModuleClick(m.key)}
                                            className={`btn w-100 h-100 p-3 d-flex flex-column align-items-center justify-content-center rounded-3 border-0 ${activeModule === m.key ? 'bg-light border border-primary' : 'hover-bg-light'}`}
                                        >
                                            <div className={`${m.bg} bg-opacity-10 p-3 rounded-circle mb-2`}>
                                                <div className={m.color}>{m.icon}</div>
                                            </div>
                                            <span className="small fw-bold text-dark text-center" style={{fontSize: '11px'}}>{m.title}</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="vr mx-1"></div>

                {/* 2. PROFİL MENÜSÜ */}
                <div className="position-relative">
                    <button 
                        className="btn d-flex align-items-center gap-2 border-0 p-1 pe-3 rounded-pill hover-bg-gray"
                        onClick={() => { setShowProfile(!showProfile); setShowApps(false); }}
                        style={{backgroundColor: '#f8f9fa'}}
                    >
                        <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{width: '36px', height: '36px'}}>
                            {user?.ad?.[0] || 'U'}
                        </div>
                        <div className="text-start d-none d-md-block" style={{lineHeight: '14px'}}>
                            <div className="fw-bold text-dark small">{user?.ad} {user?.soyad}</div>
                            <div className="text-muted" style={{fontSize: '10px'}}>{user?.rol_adi || 'Personel'}</div>
                        </div>
                        <ChevronDown size={14} className="text-muted ms-1"/>
                    </button>

                    {showProfile && (
                        <div className="position-absolute end-0 mt-2 bg-white shadow-lg rounded-4 border overflow-hidden" style={{width: '240px', zIndex: 2000}}>
                            <div className="p-3 bg-light border-bottom text-center">
                                <div className="bg-white p-3 rounded-circle shadow-sm d-inline-block mb-2">
                                    <User size={32} className="text-primary"/>
                                </div>
                                <h6 className="m-0 fw-bold">{user?.ad} {user?.soyad}</h6>
                                <small className="text-muted">{user?.birim_adi}</small>
                            </div>
                            <div className="list-group list-group-flush">
                                <button className="list-group-item list-group-item-action py-3 small" onClick={() => navigate('/dashboard/settings')}>
                                    ⚙️ Ayarlar & Profil
                                </button>
                                <button className="list-group-item list-group-item-action py-3 small text-danger fw-bold" onClick={handleLogout}>
                                    <LogOut size={14} className="me-2"/> Güvenli Çıkış
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </header>
    );
}