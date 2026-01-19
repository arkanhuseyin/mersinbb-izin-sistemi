import { useLocation, Link } from 'react-router-dom';
import { useModule } from '../context/ModuleContext'; // ✅ Context Eklendi
import { 
    LayoutDashboard, FileText, UserCog, Settings, PlusCircle, 
    FileBarChart, ShieldCheck, MessageSquare, Zap, Shirt, Home
} from 'lucide-react';
import logoMbb from '../assets/logombb.png'; 

export default function Sidebar() {
    const location = useLocation();
    const { activeModule } = useModule(); // ✅ Aktif Modülü Alıyoruz
    
    let user = null;
    try { user = JSON.parse(localStorage.getItem('user')); } catch (e) {}

    const activeStyle = {
        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
        color: '#fff',
        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
    };

    const inactiveStyle = { color: '#64748b', background: 'transparent' };

    const checkPermission = (modulKey) => {
        if (user?.rol === 'admin') return true;
        const permission = user?.yetkiler?.find(p => p.modul_adi === modulKey);
        return permission && permission.goruntule === true;
    };

    // --- MENÜ YAPILANDIRMASI (Ağaç Yapısı) ---
    // modules: Hangi modüllerde görüneceğini belirler ['IZIN', 'TALEP', 'KIYAFET']
    // Eğer modules: ['ALL'] ise hepsinde görünür.
    
    const allMenuItems = [
        // --- 1. ORTAK MENÜLER ---
        { 
            title: 'Genel Bakış', 
            path: '/dashboard/home', 
            icon: <Home size={20}/>, 
            show: true,
            modules: ['ALL'] 
        },

        // --- 2. İZİN MODÜLÜ MENÜLERİ ---
        { 
            title: 'Yeni İzin Talebi', 
            path: '/dashboard/create-leave', 
            icon: <PlusCircle size={20}/>, 
            show: checkPermission('izin_talebi'),
            modules: ['IZIN'] 
        },
        { 
            title: 'İzin Onayları', 
            path: '/dashboard/leaves', 
            icon: <FileText size={20}/>, 
            show: checkPermission('izin_onay'),
            modules: ['IZIN']
        },
        {
            title: 'İK İZİN TALEBİ',
            path: '/dashboard/hr-entry',
            icon: <Zap size={20}/>,
            show: ['admin', 'ik', 'filo'].includes(user?.rol),
            modules: ['IZIN']
        },
        { 
            title: 'İzin Takip Raporu', 
            path: '/dashboard/reports', 
            icon: <FileBarChart size={20}/>, 
            show: checkPermission('raporlar'),
            modules: ['IZIN']
        },

        // --- 3. TALEP MODÜLÜ MENÜLERİ ---
        { 
            title: 'Öneri / Şikayet / Talep Ekranı', 
            path: '/dashboard/requests', 
            icon: <MessageSquare size={20}/>, 
            show: checkPermission('talep_yonetim'),
            modules: ['TALEP']
        },

        // --- 4. KIYAFET MODÜLÜ MENÜLERİ ---
        { 
            title: 'Kıyafet Ayarları', 
            path: '/dashboard/settings', // Şimdilik settings içinde
            icon: <Shirt size={20}/>, 
            show: true,
            modules: ['KIYAFET']
        },

        // --- 5. YÖNETİM (Her Modülde Altta Görünsün) ---
        { 
            title: 'Personel Yönetimi', 
            path: '/dashboard/profile-requests', 
            icon: <UserCog size={20}/>, 
            show: checkPermission('personel_yonetim'),
            modules: ['ALL']
        },
        { 
            title: 'Yetkilendirme', 
            path: '/dashboard/yetkilendirme', 
            icon: <ShieldCheck size={20}/>, 
            show: user?.rol === 'admin',
            modules: ['ALL']
        },
        { 
            title: 'Sistem Ayarları', 
            path: '/dashboard/settings', 
            icon: <Settings size={20}/>, 
            show: true,
            modules: ['ALL']
        }
    ];

    return (
        <div className="bg-white h-100 d-flex flex-column shadow border-end" style={{width: '260px', zIndex: 1000}}>
            <div className="p-4 d-flex flex-column align-items-center border-bottom bg-light bg-opacity-25">
                <img src={logoMbb} alt="Mersin BB" className="img-fluid mb-3 drop-shadow" style={{maxWidth: '80px'}} />
                <h5 className="fw-bold text-primary m-0 text-center" style={{fontSize:'16px'}}>ULAŞIM DAİRESİ</h5>
                
                {/* AKTİF MODÜL BADGE */}
                <span className="badge bg-primary bg-opacity-10 text-primary mt-2 border border-primary border-opacity-25">
                    {activeModule === 'IZIN' ? 'İZİN SİSTEMİ' : activeModule === 'TALEP' ? 'TALEP SİSTEMİ' : 'KIYAFET SİSTEMİ'}
                </span>
            </div>

            <div className="flex-grow-1 overflow-auto py-3 px-3 custom-scrollbar">
                <div className="nav flex-column gap-2">
                    {allMenuItems.map((item, index) => {
                        // Filtreleme Mantığı:
                        // 1. Kullanıcı yetkisi var mı? (show)
                        // 2. Modül uyuyor mu? (modules='ALL' veya activeModule listede var mı?)
                        const isModuleMatch = item.modules.includes('ALL') || item.modules.includes(activeModule);
                        
                        if (item.show && isModuleMatch) {
                            return (
                                <Link 
                                    key={index} 
                                    to={item.path} 
                                    className="nav-link d-flex align-items-center gap-3 px-3 py-3 rounded-3 fw-medium transition-all"
                                    style={location.pathname === item.path ? activeStyle : inactiveStyle}
                                >
                                    {item.icon}
                                    <span style={{fontSize:'14px'}}>{item.title}</span>
                                </Link>
                            );
                        }
                        return null;
                    })}
                </div>
            </div>
            
            <div className="p-3 text-center text-muted small border-top bg-light bg-opacity-25">
                v2.0 - Modüler
            </div>
        </div>
    );
}