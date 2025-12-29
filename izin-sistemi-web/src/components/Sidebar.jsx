import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, UserCog, Settings, LogOut, PlusCircle, FileBarChart, ShieldCheck, BusFront } from 'lucide-react';

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    
    let user = null;
    try {
        user = JSON.parse(localStorage.getItem('user'));
    } catch (e) { console.error("Kullanıcı verisi okunamadı"); }

    const isActive = (path) => location.pathname === path ? 'bg-primary text-white shadow' : 'text-secondary hover-bg-light';

   // --- YETKİ KONTROLÜ ---
    const checkPermission = (modulKey) => {
        // 1. Admin ise her yeri görsün
        if (user?.rol_adi === 'admin') return true;

        // 2. Kullanıcının yetkilerine bak
        const userPermissions = user?.yetkiler || [];
        const permission = userPermissions.find(p => p.modul_adi === modulKey);

        // 3. Hiç kayıt yoksa varsayılan olarak göster
        if (!permission) return true;

        // 4. Kayıt varsa veritabanındaki değere bak
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
            show: checkPermission('ayarlar') || true // Ayarlar (Profil) herkese açık
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
        <div className="bg-white border-end h-100 d-flex flex-column p-3" style={{width: '260px', minWidth:'260px'}}>
            <div className="mb-4 px-2 d-flex align-items-center gap-2">
                <div className="bg-primary rounded p-1"><BusFront size={24} className="text-white"/></div>
                <h5 className="m-0 fw-bold text-primary">Mersin BB</h5>
            </div>

            <div className="flex-grow-1 overflow-auto">
                <div className="d-flex flex-column gap-2">
                    {menuItems.map((item, index) => item.show && (
                        <button 
                            key={index}
                            onClick={() => navigate(item.path)}
                            className={`btn text-start d-flex align-items-center gap-3 py-2 border-0 ${isActive(item.path)}`} 
                            style={{borderRadius: '10px', transition: 'all 0.2s'}}
                        >
                            {item.icon}
                            <span className="fw-medium">{item.title}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-auto border-top pt-3">
                <div className="d-flex align-items-center gap-2 mb-3 px-2">
                    <div className="bg-light rounded-circle d-flex align-items-center justify-content-center fw-bold text-primary border" style={{width:40, height:40}}>
                        {user?.ad ? user.ad[0] : '?'}
                    </div>
                    <div style={{lineHeight: '1.2', overflow: 'hidden'}}>
                        <div className="fw-bold text-dark small text-truncate">{user?.ad} {user?.soyad}</div>
                        <div className="text-muted small" style={{fontSize:'10px'}}>{user?.rol_adi ? user.rol_adi.toUpperCase() : 'PERSONEL'}</div>
                    </div>
                </div>
                <button onClick={handleLogout} className="btn btn-light w-100 text-danger d-flex align-items-center justify-content-center gap-2 btn-sm border-0 hover-shadow">
                    <LogOut size={16}/> Çıkış Yap
                </button>
            </div>
        </div>
    );
}