import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useModule } from '../context/ModuleContext';
import { 
    LayoutDashboard, FileText, UserCog, Settings, LogOut, PlusCircle, 
    FileBarChart, ShieldCheck, MessageSquare, Zap, Shirt, Home, ChevronDown, ChevronRight, Menu, Calendar
} from 'lucide-react';
import logoMbb from '../assets/logombb.png'; 

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { activeModule } = useModule();
    
    // ✅ DÜZELTME: Menüler varsayılan olarak AÇIK geliyor
    const [openMenus, setOpenMenus] = useState({
        'İzin İşlemleri': true,
        'Lojistik İşlemleri': true,
        'Yönetim Paneli': true
    });

    let user = null;
    try { user = JSON.parse(localStorage.getItem('user')); } catch (e) {}

    // Modül değişince de açık kalmasını garantilemek için
    useEffect(() => {
        if (activeModule === 'IZIN') setOpenMenus(prev => ({ ...prev, 'İzin İşlemleri': true }));
        if (activeModule === 'KIYAFET') setOpenMenus(prev => ({ ...prev, 'Lojistik İşlemleri': true }));
    }, [activeModule]);

    const checkPermission = (modulKey) => {
        if (user?.rol === 'admin') return true;
        const permission = user?.yetkiler?.find(p => p.modul_adi === modulKey);
        return permission && permission.goruntule === true;
    };

    // --- MENÜ YAPILANDIRMASI ---
    const getMenuItems = () => {
        const items = [];

        // 1. GENEL MENÜLER
        items.push({
            title: 'Ana Sayfa',
            path: '/dashboard/home',
            icon: <Home size={20}/>,
            modules: ['ALL']
        });

        // 2. İZİN MODÜLÜ
        if (activeModule === 'IZIN') {
            items.push({
                title: 'İzin İşlemleri',
                icon: <FileText size={20}/>,
                modules: ['IZIN'],
                subItems: [
                    { title: 'Yeni İzin Talebi', path: '/dashboard/create-leave', icon: <PlusCircle size={16}/>, show: checkPermission('izin_talep') },
                    { title: 'İzin Talepleri', path: '/dashboard/leaves', icon: <FileText size={16}/>, show: checkPermission('izin_onay') },
                    { title: 'İnsan Kaynakları İzin Sistemi', path: '/dashboard/hr-entry', icon: <Zap size={16}/>, show: ['admin', 'ik', 'filo'].includes(user?.rol) },
                    { title: 'İzin Planlama (Gantt)', path: '/dashboard/planning', icon: <Calendar size={16}/>, show: ['admin', 'ik', 'filo', 'amir'].includes(user?.rol) }, 
                    { title: 'İzin Takip Raporu', path: '/dashboard/reports', icon: <FileBarChart size={16}/>, show: checkPermission('raporlar') }
                ]
            });
        }

        // 3. TALEP MODÜLÜ
        if (activeModule === 'TALEP') {
            items.push({
                title: 'Talep Yönetimi',
                path: '/dashboard/requests',
                icon: <MessageSquare size={20}/>,
                modules: ['TALEP'],
                show: checkPermission('talep_yonetim')
            });
        }

        // 4. KIYAFET (LOJİSTİK) MODÜLÜ
        if (activeModule === 'KIYAFET') {
            items.push({
                title: 'Lojistik İşlemleri',
                icon: <Shirt size={20}/>,
                modules: ['KIYAFET'],
                subItems: [
                    { title: 'Beden Ayarları', path: '/dashboard/settings', icon: <Settings size={16}/>, show: true }
                ]
            });
        }

        // 5. YÖNETİM (ORTAK)
        const yonetimSubItems = [];
        if (checkPermission('personel_yonetim')) yonetimSubItems.push({ title: 'Profil Onayları', path: '/dashboard/profile-requests', icon: <UserCog size={16}/> });
        if (user?.rol === 'admin') yonetimSubItems.push({ title: 'Yetkilendirme', path: '/dashboard/yetkilendirme', icon: <ShieldCheck size={16}/> });
        yonetimSubItems.push({ title: 'Sistem Ayarları', path: '/dashboard/settings', icon: <Settings size={16}/> });

        items.push({
            title: 'Yönetim Paneli',
            icon: <Settings size={20}/>,
            modules: ['ALL'],
            subItems: yonetimSubItems
        });

        return items;
    };

    const toggleMenu = (title) => {
        setOpenMenus(prev => ({ ...prev, [title]: !prev[title] }));
    };

    const handleLogout = () => {
        if(confirm("Çıkış yapmak istediğinize emin misiniz?")) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            navigate('/login');
        }
    };

    return (
        <div className="d-flex flex-column h-100 bg-white border-end shadow-sm" style={{width: '280px', minWidth:'280px', fontFamily: "'Inter', sans-serif"}}>
            {/* HEADER */}
            <div className="p-4 pb-2 text-center border-bottom border-light bg-light bg-opacity-25">
                <div className="mb-2 d-inline-block p-2 rounded-circle bg-white shadow-sm border">
                    <img src={logoMbb} alt="MBB Logo" style={{width: '60px', height: '60px', objectFit:'contain'}} />
                </div>
                <h6 className="fw-bold text-dark m-0">ULAŞIM DAİRESİ</h6>
                <p className="text-muted small m-0">Personel Yönetim Sistemi</p>
                <div className="mt-2 badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-3 py-1">
                    {activeModule === 'IZIN' ? 'İZİN MODÜLÜ' : activeModule === 'TALEP' ? 'TALEP & ÖNERİ' : 'LOJİSTİK & DEPO'}
                </div>
            </div>

            {/* MENÜ LİSTESİ */}
            <div className="flex-grow-1 overflow-auto p-3 custom-scrollbar">
                <div className="d-flex flex-column gap-1">
                    {getMenuItems().map((item, index) => {
                        if (item.show === false) return null;

                        if (item.subItems && item.subItems.length > 0) {
                            const isActiveParent = item.subItems.some(sub => sub.path === location.pathname);
                            const isOpen = openMenus[item.title]; // Varsayılan açık

                            return (
                                <div key={index} className="mb-1">
                                    <button 
                                        onClick={() => toggleMenu(item.title)}
                                        className={`btn w-100 d-flex align-items-center justify-content-between p-3 border-0 fw-medium ${isActiveParent ? 'text-primary bg-primary bg-opacity-10' : 'text-dark hover-bg-light'}`}
                                        style={{borderRadius: '12px', transition: 'all 0.2s'}}
                                    >
                                        <div className="d-flex align-items-center gap-3">
                                            {item.icon}
                                            <span>{item.title}</span>
                                        </div>
                                        {isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                                    </button>
                                    
                                    {isOpen && (
                                        <div className="ms-3 ps-3 border-start border-2 mt-1 d-flex flex-column gap-1 animate-slide-down">
                                            {item.subItems.map((sub, subIndex) => sub.show !== false && (
                                                <Link 
                                                    key={subIndex} 
                                                    to={sub.path}
                                                    className={`btn w-100 text-start d-flex align-items-center gap-2 py-2 px-3 border-0 small ${location.pathname === sub.path ? 'text-primary fw-bold bg-white shadow-sm' : 'text-secondary hover-text-dark'}`}
                                                    style={{borderRadius: '8px'}}
                                                >
                                                    {sub.icon}
                                                    {sub.title}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <Link 
                                key={index}
                                to={item.path}
                                className={`btn w-100 text-start d-flex align-items-center gap-3 p-3 border-0 fw-medium mb-1 ${location.pathname === item.path ? 'bg-primary text-white shadow-primary' : 'text-dark hover-bg-light'}`}
                                style={{
                                    borderRadius: '12px', 
                                    background: location.pathname === item.path ? 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)' : 'transparent'
                                }}
                            >
                                {item.icon}
                                <span>{item.title}</span>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* FOOTER (GÜNCELLENDİ: Yazı Beyaz) */}
            <div className="p-3 mt-auto bg-light bg-opacity-50 border-top">
                <button onClick={handleLogout} className="btn btn-danger w-100 d-flex align-items-center justify-content-center gap-2 py-2 rounded-3 border-0 fw-bold shadow-sm text-white">
                    <LogOut size={16}/> Çıkış Yap
                </button>
            </div>
        </div>
    );
}