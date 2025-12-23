import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, UserCog, Settings, LogOut, PlusCircle, FileBarChart, ShieldCheck } from 'lucide-react';

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    
    let user = null;
    try {
        user = JSON.parse(localStorage.getItem('user'));
    } catch (e) { console.error("Kullanıcı verisi okunamadı"); }

    const isActive = (path) => location.pathname === path ? 'bg-primary text-white shadow' : 'text-secondary hover-bg-light';

   // --- GÜNCELLENMİŞ YETKİ KONTROLÜ (VARSAYILAN: AÇIK) ---
    const checkPermission = (modulKey) => {
        // 1. Admin ise KESİNLİKLE her yeri görsün (Sorgusuz sualsiz)
        if (user?.rol_adi === 'admin') return true;

        // 2. Kullanıcının yetkilerine bak
        const userPermissions = user?.yetkiler || [];
        const permission = userPermissions.find(p => p.modul_adi === modulKey);

        // 3. EĞER HİÇ KAYIT YOKSA -> GÖSTER (Varsayılan Açık)
        if (!permission) return true;

        // 4. KAYIT VARSA -> Veritabanındaki ayara bak (True ise göster, False ise gizle)
        return permission.goruntule === true;
    };

    // --- MENÜ ELEMANLARI ---
    const menuItems = [
        { 
            title: 'Genel Bakış', 
            path: '/dashboard/home', 
            icon: <LayoutDashboard size={20}/>, 
            // Dashboard genelde herkese açıktır ama yetkiye bağladık
            show: checkPermission('dashboard') || user?.rol_adi === 'personel' // Personel varsayılan görsün
        },
        { 
            title: 'Yeni İzin Talebi', 
            path: '/dashboard/create-leave', 
            icon: <PlusCircle size={20}/>, 
            show: checkPermission('izin_talep') || user?.rol_adi === 'personel' // Personel varsayılan görsün
        },
        { 
            title: 'İzin Talepleri', // Onay Ekranı
            path: '/dashboard/leaves', 
            icon: <FileText size={20}/>, 
            show: checkPermission('izin_onay')
        },
        { 
            title: 'İzin Takip Raporu', 
            path: '/dashboard/reports', 
            icon: <FileBarChart size={20}/>, 
            show: checkPermission('izin_onay') || checkPermission('rapor') // Onay yetkisi olan raporu da görsün
        },
        { 
            title: 'Ayarlar', 
            path: '/dashboard/settings', 
            icon: <Settings size={20}/>, 
            show: checkPermission('ayarlar') || true // Ayarlar herkese açık olsun (Profil için), içini kısıtlarız
        },
        { 
            title: 'Yetkilendirme', 
            path: '/dashboard/yetkilendirme', 
            icon: <ShieldCheck size={20}/>, 
            show: checkPermission('yetkilendirme') // Sadece yetkisi olan görsün
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

// İkon eksikse diye ekledim
function BusFront(props) {
    return (
      <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>
    )
}