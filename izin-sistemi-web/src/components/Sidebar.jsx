import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, UserCog, Settings, LogOut, PlusCircle, FileBarChart, ShieldCheck } from 'lucide-react';
import logoMbb from '../assets/logombb.png'; // ✅ Logo import edildi

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    
    let user = null;
    try {
        user = JSON.parse(localStorage.getItem('user'));
    } catch (e) { console.error("Kullanıcı verisi okunamadı"); }

    // Dashboard ile aynı renk paleti
    const activeStyle = {
        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
        color: '#fff',
        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
    };

    const inactiveStyle = {
        color: '#64748b',
        background: 'transparent'
    };

   // --- YETKİ KONTROLÜ ---
    const checkPermission = (modulKey) => {
        if (user?.rol_adi === 'admin') return true;
        const userPermissions = user?.yetkiler || [];
        const permission = userPermissions.find(p => p.modul_adi === modulKey);
        if (!permission) return true;
        return permission.goruntule === true;
    };

    // --- MENÜ ELEMANLARI ---
    const menuItems = [
        { 
            title: 'Genel Bakış', 
            path: '/dashboard/home', 
            icon: <LayoutDashboard size={20}/>, 
            show: checkPermission('dashboard') || user?.rol_adi === 'personel'
        },
        { 
            title: 'Yeni İzin Talebi', 
            path: '/dashboard/create-leave', 
            icon: <PlusCircle size={20}/>, 
            show: checkPermission('izin_talep') || user?.rol_adi === 'personel'
        },
        { 
            title: 'İzin Talepleri', 
            path: '/dashboard/leaves', 
            icon: <FileText size={20}/>, 
            show: checkPermission('izin_onay')
        },
        { 
            title: 'İzin Takip Raporu', 
            path: '/dashboard/reports', 
            icon: <FileBarChart size={20}/>, 
            show: checkPermission('izin_onay') || checkPermission('rapor')
        },
        { 
            title: 'Ayarlar', 
            path: '/dashboard/settings', 
            icon: <Settings size={20}/>, 
            show: checkPermission('ayarlar') || true 
        },
        { 
            title: 'Profil Onayları', 
            path: '/dashboard/profile-requests', 
            icon: <UserCog size={20}/>, 
            show: (user && ['admin', 'ik', 'filo'].includes(user.rol)) 
        },
        { 
            title: 'Yetkilendirme', 
            path: '/dashboard/yetkilendirme', 
            icon: <ShieldCheck size={20}/>, 
            show: checkPermission('yetkilendirme')
        }
    ];

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    return (
        <div className="d-flex flex-column h-100 bg-white border-end shadow-sm" 
             style={{width: '280px', minWidth:'280px', transition: 'all 0.3s ease', fontFamily: "'Inter', sans-serif"}}>
            
            {/* Hover efektleri için stil */}
            <style>{`
                .sidebar-btn:hover { background-color: #f1f5f9 !important; color: #1e293b !important; transform: translateX(5px); }
                .sidebar-active:hover { transform: none !important; }
            `}</style>

            {/* --- HEADER: LOGO VE KURUMSAL İSİM --- */}
            <div className="p-4 pb-2 text-center border-bottom border-light bg-light bg-opacity-25">
                <div className="mb-3 d-inline-block p-2 rounded-circle bg-white shadow-sm border">
                    <img src={logoMbb} alt="MBB Logo" style={{width: '70px', height: '70px', objectFit:'contain'}} />
                </div>
                <div>
                    <h6 className="fw-bold text-dark m-0" style={{letterSpacing:'-0.5px'}}>Mersin Büyükşehir Belediyesi</h6>
                    <div className="my-1" style={{height:'2px', width:'40px', background:'#3b82f6', margin:'0 auto'}}></div>
                    <p className="fw-semibold text-secondary m-0" style={{fontSize:'12px'}}>Ulaşım Dairesi Başkanlığı</p>
                    <p className="text-muted m-0 small opacity-75" style={{fontSize:'11px'}}>Toplu Taşıma Şube Müdürlüğü</p>
                </div>
            </div>

            {/* --- MENÜ LİSTESİ --- */}
            <div className="flex-grow-1 overflow-auto p-3 custom-scroll">
                <div className="d-flex flex-column gap-2">
                    <small className="text-uppercase fw-bold text-muted ps-3 mb-1" style={{fontSize:'10px', letterSpacing:'1px'}}>Menü</small>
                    {menuItems.map((item, index) => item.show && (
                        <button 
                            key={index}
                            onClick={() => navigate(item.path)}
                            className={`btn text-start d-flex align-items-center gap-3 py-3 px-3 border-0 fw-medium ${location.pathname === item.path ? 'sidebar-active' : 'sidebar-btn'}`} 
                            style={{
                                borderRadius: '12px', 
                                transition: 'all 0.2s ease',
                                fontSize: '14px',
                                ...(location.pathname === item.path ? activeStyle : inactiveStyle)
                            }}
                        >
                            {item.icon}
                            <span>{item.title}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* --- FOOTER: KULLANICI KARTI --- */}
            <div className="p-3 mt-auto bg-light bg-opacity-50">
                <div className="bg-white p-3 rounded-4 shadow-sm border d-flex align-items-center gap-3 mb-3">
                    <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm flex-shrink-0" 
                         style={{width:'42px', height:'42px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', fontSize:'14px'}}>
                        {user?.ad ? user.ad[0] : '?'}
                    </div>
                    <div style={{lineHeight: '1.2', overflow: 'hidden'}}>
                        <div className="fw-bold text-dark text-truncate" style={{fontSize:'14px'}}>{user?.ad} {user?.soyad}</div>
                        <div className="text-muted small text-uppercase" style={{fontSize:'10px', letterSpacing:'0.5px'}}>{user?.rol_adi || 'PERSONEL'}</div>
                    </div>
                </div>
                
                <button onClick={handleLogout} 
                        className="btn btn-danger w-100 d-flex align-items-center justify-content-center gap-2 py-2 rounded-3 border-0 bg-opacity-10 text-danger fw-bold hover-shadow"
                        style={{fontSize:'13px', backgroundColor: '#fee2e2'}}>
                    <LogOut size={16}/> Çıkış Yap
                </button>
            </div>
        </div>
    );
}