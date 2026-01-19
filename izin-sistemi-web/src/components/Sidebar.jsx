import { useNavigate, useLocation, Link } from 'react-router-dom';
// ✅ DÜZELTME: 'Zap' ikonunu buraya ekledik
import { LayoutDashboard, FileText, UserCog, Settings, LogOut, PlusCircle, FileBarChart, ShieldCheck, MessageSquare, Zap } from 'lucide-react';
import logoMbb from '../assets/logombb.png'; 

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    
    let user = null;
    try {
        user = JSON.parse(localStorage.getItem('user'));
    } catch (e) { console.error("Kullanıcı verisi okunamadı"); }

    const activeStyle = {
        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
        color: '#fff',
        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
    };

    const inactiveStyle = {
        color: '#64748b',
        background: 'transparent'
    };

   // --- 🔥 YETKİ KONTROLÜ 🔥 ---
    const checkPermission = (modulKey) => {
        // 1. Admin her şeyi görür
        if (user?.rol === 'admin') return true;

        // 2. Kullanıcının yetkilerini al
        const userPermissions = user?.yetkiler || [];
        const permission = userPermissions.find(p => p.modul_adi === modulKey);

        // 3. Eğer modül yetkisi varsa ve görüntüleme izni true ise göster
        return permission && permission.goruntule === true;
    };

    const handleLogout = () => {
        if(confirm('Çıkış yapmak istediğinize emin misiniz?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            navigate('/login');
        }
    };

    const menuItems = [
        { 
            title: 'Genel Bakış', 
            path: '/dashboard/home', 
            icon: <LayoutDashboard size={20}/>, 
            show: checkPermission('dashboard') 
        },
        { 
            title: 'Yeni İzin Talebi', 
            path: '/dashboard/create-leave', 
            icon: <PlusCircle size={20}/>, 
            show: checkPermission('izin_talebi') 
        },
        { 
            title: 'İzin Onayları', 
            path: '/dashboard/leaves', 
            icon: <FileText size={20}/>, 
            show: checkPermission('izin_onay') 
        },
        { 
            title: 'Talep Yönetimi', 
            path: '/dashboard/requests', 
            icon: <MessageSquare size={20}/>, 
            show: checkPermission('talep_yonetim') 
        },
        // ✅ YENİ MENÜ: İK HIZLI GİRİŞ (Sadece Admin/İK/Filo)
        {
            title: 'İK Hızlı Giriş',
            path: '/dashboard/hr-entry',
            icon: <Zap size={20}/>,
            show: ['admin', 'ik', 'filo'].includes(user?.rol)
        },
        { 
            title: 'Personel Yönetimi', 
            path: '/dashboard/profile-requests', 
            icon: <UserCog size={20}/>, 
            show: checkPermission('personel_yonetim') 
        },
        { 
            title: 'Raporlar', 
            path: '/dashboard/reports', 
            icon: <FileBarChart size={20}/>, 
            show: checkPermission('raporlar') 
        },
        { 
            title: 'Yetkilendirme', 
            path: '/dashboard/yetkilendirme', 
            icon: <ShieldCheck size={20}/>, 
            show: user?.rol === 'admin' 
        },
        { 
            title: 'Ayarlar', 
            path: '/dashboard/settings', 
            icon: <Settings size={20}/>, 
            show: true 
        }
    ];

    return (
        <div className="bg-white h-100 d-flex flex-column shadow border-end" style={{width: '260px', zIndex: 1000}}>
            {/* LOGO ALANI */}
            <div className="p-4 d-flex flex-column align-items-center border-bottom bg-light bg-opacity-25">
                <img src={logoMbb} alt="Mersin BB" className="img-fluid mb-3 drop-shadow" style={{maxWidth: '80px'}} />
                <h5 className="fw-bold text-primary m-0 text-center" style={{fontSize:'16px', letterSpacing:'-0.5px'}}>ULAŞIM DAİRESİ</h5>
                <small className="text-muted text-uppercase" style={{fontSize:'10px', letterSpacing:'1px'}}>Personel Yönetim</small>
            </div>

            {/* MENÜ LİSTESİ */}
            <div className="flex-grow-1 overflow-auto py-3 px-3 custom-scrollbar">
                <div className="nav flex-column gap-2">
                    {menuItems.map((item, index) => (
                        item.show && (
                            <Link 
                                key={index} 
                                to={item.path} 
                                className="nav-link d-flex align-items-center gap-3 px-3 py-3 rounded-3 fw-medium transition-all"
                                style={location.pathname === item.path ? activeStyle : inactiveStyle}
                            >
                                {item.icon}
                                <span style={{fontSize:'14px'}}>{item.title}</span>
                            </Link>
                        )
                    ))}
                </div>
            </div>

            {/* FOOTER */}
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
                    <LogOut size={16} />
                    Güvenli Çıkış
                </button>
            </div>
        </div>
    );
}