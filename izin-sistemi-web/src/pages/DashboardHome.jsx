import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area 
} from 'recharts';
import { 
    FileCheck, Clock, FileX, Users, Calendar, TrendingUp, 
    Activity, ArrowUpRight, Moon, Sun, Globe 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ✅ LOGOYU İMPORT EDİYORUZ
import logoMbb from '../assets/logombb.png'; 

export default function DashboardHome() {
    // --- STATE YÖNETİMİ ---
    const [stats, setStats] = useState({ toplam: 0, onayli: 0, bekleyen: 0, reddedilen: 0 });
    const [izinTurleri, setIzinTurleri] = useState([]);
    const [aylikData, setAylikData] = useState([]);
    const [sonHareketler, setSonHareketler] = useState([]);
    const [kullanici, setKullanici] = useState({ ad: 'Misafir', soyad: '' }); // Dinamik Kullanıcı
    const [darkMode, setDarkMode] = useState(false); // Dark Mode
    const [lang, setLang] = useState('tr'); // Dil Seçeneği ('tr' | 'en')
    const [selamlama, setSelamlama] = useState('');
    
    const navigate = useNavigate();

    // --- DİL SÖZLÜĞÜ (TRANSLATIONS) ---
    const TEXT = {
        tr: {
            greeting: { morning: 'Günaydın', afternoon: 'Tünaydın', evening: 'İyi Akşamlar' },
            welcome: 'Hoş Geldiniz',
            department: 'Toplu Taşıma Şube Müdürlüğü',
            municipality: 'Mersin Büyükşehir Belediyesi',
            today: 'BUGÜN',
            cards: { total: 'TOPLAM BAŞVURU', approved: 'ONAYLANAN İZİNLER', pending: 'BEKLEYEN TALEPLER', rejected: 'REDDEDİLENLER' },
            charts: { trendTitle: 'Başvuru Yoğunluğu', trendSub: 'Aylık talep trend analizi', typeDist: 'İzin Türüne Göre Dağılım', statusTitle: 'Genel Durum', total: 'TOPLAM' },
            activity: { title: 'Son Aktiviteler', all: 'Tümü', empty: 'Henüz işlem yok.' },
            status: { approved: 'ONAYLANDI', rejected: 'REDDEDİLDİ', pending: 'BEKLİYOR' }
        },
        en: {
            greeting: { morning: 'Good Morning', afternoon: 'Good Afternoon', evening: 'Good Evening' },
            welcome: 'Welcome',
            department: 'Public Transportation Branch',
            municipality: 'Mersin Metropolitan Municipality',
            today: 'TODAY',
            cards: { total: 'TOTAL APPLICATIONS', approved: 'APPROVED LEAVES', pending: 'PENDING REQUESTS', rejected: 'REJECTED' },
            charts: { trendTitle: 'Application Density', trendSub: 'Monthly demand trend analysis', typeDist: 'Distribution by Leave Type', statusTitle: 'General Status', total: 'TOTAL' },
            activity: { title: 'Recent Activities', all: 'View All', empty: 'No recent activity.' },
            status: { approved: 'APPROVED', rejected: 'REJECTED', pending: 'PENDING' }
        }
    };

    // --- TEMA RENKLERİ ---
    const THEME = {
        light: { bg: '#f8f9fa', cardBg: '#ffffff', text: '#2b2d42', subText: '#8d99ae', border: '#e9ecef', grid: '#f1f5f9' },
        dark:  { bg: '#0f172a', cardBg: '#1e293b', text: '#f8fafc', subText: '#94a3b8', border: '#334155', grid: '#334155' }
    };
    
    const currentTheme = darkMode ? THEME.dark : THEME.light;

    // Sabit Grafik Renkleri
    const COLORS = {
        primary: '#4361ee', success: '#2ec4b6', warning: '#ff9f1c', danger: '#e71d36'
    };

    useEffect(() => {
        // 1. Kullanıcıyı LocalStorage'dan Çek
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                setKullanici(JSON.parse(storedUser));
            } catch (e) { console.error("Kullanıcı verisi okunamadı"); }
        }

        // 2. Saate Göre Selamlama
        const hour = new Date().getHours();
        if (hour < 12) setSelamlama('morning');
        else if (hour < 18) setSelamlama('afternoon');
        else setSelamlama('evening');

        // 3. Verileri Çek
        const token = localStorage.getItem('token');
        axios.get('https://mersinbb-izin-sistemi.onrender.com/api/izin/listele', { headers: { Authorization: `Bearer ${token}` } })
            .then(res => {
                const data = res.data;
                setStats({
                    toplam: data.length,
                    onayli: data.filter(x => x.durum === 'IK_ONAYLADI').length,
                    bekleyen: data.filter(x => x.durum.includes('BEK') || x.durum.includes('AMIR') || x.durum.includes('YAZICI')).length,
                    reddedilen: data.filter(x => x.durum === 'REDDEDILDI').length
                });

                const turMap = {};
                data.forEach(d => { turMap[d.izin_turu] = (turMap[d.izin_turu] || 0) + 1; });
                setIzinTurleri(Object.keys(turMap).map(key => ({ name: key, value: turMap[key] })));
                setSonHareketler([...data].reverse().slice(0, 5));
                setAylikData([
                    { name: lang === 'tr' ? 'Oca' : 'Jan', talep: 4 }, 
                    { name: lang === 'tr' ? 'Şub' : 'Feb', talep: 8 },
                    { name: lang === 'tr' ? 'Mar' : 'Mar', talep: 6 }, 
                    { name: lang === 'tr' ? 'Nis' : 'Apr', talep: 15 },
                    { name: lang === 'tr' ? 'May' : 'May', talep: 12 }, 
                    { name: lang === 'tr' ? 'Haz' : 'Jun', talep: data.length }
                ]);
            });
    }, [lang]); // Dil değişince verileri (ay isimlerini) yenile

    // --- BİLEŞENLER ---

    // Grafik Tooltip
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div style={{ backgroundColor: currentTheme.cardBg, color: currentTheme.text, border: `1px solid ${currentTheme.border}` }} className="p-3 rounded-3 shadow">
                    <p className="m-0 fw-bold mb-1">{label}</p>
                    <p className="m-0 text-primary fw-bold" style={{fontSize:'14px'}}>{payload[0].value} Adet</p>
                </div>
            );
        }
        return null;
    };

    // İstatistik Kartı
    const StatCard = ({ title, value, icon: Icon, bgGradient }) => (
        <div className="col-md-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100 rounded-4 overflow-hidden position-relative hover-scale" 
                 style={{ backgroundColor: currentTheme.cardBg, transition: 'all 0.3s ease' }}>
                <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-start">
                        <div>
                            <p className="text-uppercase fw-bold small mb-2" style={{letterSpacing:'0.5px', fontSize:'11px', color: currentTheme.subText}}>{title}</p>
                            <h2 className="fw-bolder m-0 display-6" style={{color: currentTheme.text}}>{value}</h2>
                        </div>
                        <div className={`p-3 rounded-4 shadow-sm text-white`} 
                             style={{ background: bgGradient, width: '54px', height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon size={26} strokeWidth={2.5} />
                        </div>
                    </div>
                    <div className="mt-3 rounded-pill" style={{height:'4px', width:'40%', background: bgGradient, opacity:0.7}}></div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="container-fluid p-4 p-lg-5" style={{backgroundColor: currentTheme.bg, minHeight: '100vh', transition: 'background-color 0.3s'}}>
            
            {/* Hover Efekti için CSS */}
            <style>{`
                .hover-scale:hover { transform: translateY(-5px); box-shadow: 0 15px 30px rgba(0,0,0,0.15) !important; }
                .list-hover:hover { transform: translateX(5px); }
            `}</style>

            {/* --- TOP BAR (Theme & Lang Toggles) --- */}
            <div className="d-flex justify-content-end mb-3 gap-3">
                
                {/* Dil Değiştirici */}
                <button 
                    onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')}
                    className="btn d-flex align-items-center gap-2 px-3 py-2 rounded-pill border-0 shadow-sm"
                    style={{ backgroundColor: currentTheme.cardBg, color: currentTheme.text }}
                >
                    <Globe size={18} />
                    <span className="fw-bold small">{lang === 'tr' ? 'TR' : 'EN'}</span>
                    <span style={{fontSize:'16px'}}>{lang === 'tr' ? '🇹🇷' : '🇬🇧'}</span>
                </button>

                {/* Dark Mode Toggle */}
                <button 
                    onClick={() => setDarkMode(!darkMode)}
                    className="btn d-flex align-items-center gap-2 px-3 py-2 rounded-pill border-0 shadow-sm"
                    style={{ backgroundColor: currentTheme.cardBg, color: currentTheme.text }}
                >
                    {darkMode ? <Sun size={18} className="text-warning"/> : <Moon size={18} className="text-primary"/>}
                    <span className="fw-bold small d-none d-md-block">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
            </div>


            {/* 🔥 1. HERO SECTION (Kişiselleştirilmiş Kartvizit) */}
            <div className="card border-0 shadow-sm rounded-4 mb-5 overflow-hidden" 
                 style={{ 
                     background: darkMode 
                        ? 'linear-gradient(120deg, #1e293b 0%, #0f172a 100%)' 
                        : 'linear-gradient(120deg, #ffffff 0%, #e0e7ff 100%)',
                     color: currentTheme.text
                 }}>
                <div className="card-body p-4 p-lg-5 d-flex flex-column flex-md-row align-items-center justify-content-between gap-4">
                    
                    {/* Sol: Logo ve Metin */}
                    <div className="d-flex align-items-center gap-4">
                        <div className="p-3 rounded-circle shadow-sm d-flex align-items-center justify-content-center" 
                             style={{width:'100px', height:'100px', backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : '#fff'}}>
                            <img src={logoMbb} alt="MBB Logo" style={{width:'80%', height:'auto'}} />
                        </div>
                        <div>
                            <h5 className="fw-bold text-uppercase mb-1" style={{color: COLORS.primary, letterSpacing:'1px'}}>{TEXT[lang].municipality}</h5>
                            <h2 className="fw-bolder mb-1">{TEXT[lang].department}</h2>
                            <p className="m-0 fs-5 opacity-75">
                                {TEXT[lang].greeting[selamlama]}, <strong className="text-primary">{kullanici.ad} {kullanici.soyad}</strong>
                            </p>
                        </div>
                    </div>

                    {/* Sağ: Tarih */}
                    <div className="d-flex flex-column align-items-md-end gap-3">
                        <div className="px-4 py-3 rounded-4 shadow-sm border d-flex align-items-center gap-3"
                             style={{ backgroundColor: currentTheme.cardBg, borderColor: currentTheme.border }}>
                            <div className="bg-primary bg-opacity-10 p-2 rounded-circle">
                                <Calendar size={20} className="text-primary"/>
                            </div>
                            <div>
                                <div className="small fw-bold text-uppercase opacity-75" style={{fontSize:'10px'}}>{TEXT[lang].today}</div>
                                <div className="fw-bold fs-6">
                                    {new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
            
            {/* 2. İSTATİSTİK KARTLARI (Çoklu Dil) */}
            <div className="row g-4 mb-5">
                <StatCard title={TEXT[lang].cards.total} value={stats.toplam} icon={Users} bgGradient="linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)" />
                <StatCard title={TEXT[lang].cards.approved} value={stats.onayli} icon={FileCheck} bgGradient="linear-gradient(135deg, #2ec4b6 0%, #20a4f3 100%)" />
                <StatCard title={TEXT[lang].cards.pending} value={stats.bekleyen} icon={Clock} bgGradient="linear-gradient(135deg, #ff9f1c 0%, #ffbf69 100%)" />
                <StatCard title={TEXT[lang].cards.rejected} value={stats.reddedilen} icon={FileX} bgGradient="linear-gradient(135deg, #e71d36 0%, #d90429 100%)" />
            </div>

            <div className="row g-4">
                
                {/* 3. GRAFİKLER (Sol Taraf) */}
                <div className="col-xl-8 col-lg-7">
                    
                    {/* Alan Grafiği */}
                    <div className="card border-0 shadow-sm h-100 rounded-4 mb-4" style={{ backgroundColor: currentTheme.cardBg }}>
                        <div className="card-header border-0 pt-4 ps-4 d-flex justify-content-between align-items-center" style={{ backgroundColor: 'transparent' }}>
                            <div>
                                <h5 className="fw-bold m-0" style={{color: currentTheme.text}}>{TEXT[lang].charts.trendTitle}</h5>
                                <p className="small m-0" style={{color: currentTheme.subText}}>{TEXT[lang].charts.trendSub}</p>
                            </div>
                            <div className="p-2 rounded-circle" style={{backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : '#f8f9fa'}}><TrendingUp size={20} className="text-primary"/></div>
                        </div>
                        <div className="card-body" style={{height: 350}}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={aylikData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorTalep" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={currentTheme.grid}/>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: currentTheme.subText, fontSize:12}} dy={10}/>
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: currentTheme.subText, fontSize:12}}/>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="talep" stroke={COLORS.primary} strokeWidth={4} fill="url(#colorTalep)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* İzin Türü Dağılımı */}
                    <div className="card border-0 shadow-sm rounded-4 overflow-hidden" style={{ backgroundColor: currentTheme.cardBg }}>
                        <div className="card-header border-0 pt-4 ps-4 pb-0" style={{ backgroundColor: 'transparent' }}>
                            <h5 className="fw-bold m-0" style={{color: currentTheme.text}}>{TEXT[lang].charts.typeDist}</h5>
                        </div>
                        <div className="card-body" style={{height: 300}}>
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={izinTurleri} barSize={40}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={currentTheme.grid} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: currentTheme.subText, fontSize:11}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: currentTheme.subText}}/>
                                    <Tooltip content={<CustomTooltip />} cursor={{fill: darkMode ? 'rgba(255,255,255,0.05)' : '#f8f9fa'}}/>
                                    <Bar dataKey="value" fill={COLORS.primary} radius={[10, 10, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>

                {/* 4. DURUM VE LİSTE (Sağ Taraf) */}
                <div className="col-xl-4 col-lg-5">
                    
                    {/* Donut Chart */}
                    <div className="card border-0 shadow-sm rounded-4 mb-4" style={{ backgroundColor: currentTheme.cardBg }}>
                        <div className="card-header border-0 pt-4 ps-4" style={{ backgroundColor: 'transparent' }}>
                            <h5 className="fw-bold m-0" style={{color: currentTheme.text}}>{TEXT[lang].charts.statusTitle}</h5>
                        </div>
                        <div className="card-body" style={{height: 300}}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={[
                                            {name: TEXT[lang].status.approved, value: stats.onayli}, 
                                            {name: TEXT[lang].status.pending, value: stats.bekleyen}, 
                                            {name: TEXT[lang].status.rejected, value: stats.reddedilen}
                                        ]} 
                                        innerRadius={80} 
                                        outerRadius={100} 
                                        paddingAngle={5} 
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        <Cell fill={COLORS.success} />
                                        <Cell fill={COLORS.warning} />
                                        <Cell fill={COLORS.danger} />
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="position-absolute top-50 start-50 translate-middle text-center" style={{marginTop:'-10px'}}>
                                <h1 className="fw-bolder m-0 display-6" style={{color: currentTheme.text}}>{stats.toplam}</h1>
                                <small className="fw-bold text-uppercase" style={{fontSize:'11px', color: currentTheme.subText}}>{TEXT[lang].charts.total}</small>
                            </div>
                        </div>
                    </div>

                    {/* Son İşlemler Listesi */}
                    <div className="card border-0 shadow-sm rounded-4 h-100" style={{ backgroundColor: currentTheme.cardBg }}>
                        <div className="card-header border-0 pt-4 ps-4 pb-2 d-flex justify-content-between align-items-center" style={{ backgroundColor: 'transparent' }}>
                            <h5 className="fw-bold m-0 d-flex align-items-center gap-2" style={{color: currentTheme.text}}><Activity size={20} className="text-warning"/> {TEXT[lang].activity.title}</h5>
                            <button className="btn btn-sm rounded-pill px-3 fw-bold d-flex align-items-center gap-1" 
                                    style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9', color: COLORS.primary }}
                                    onClick={() => navigate('/dashboard/leaves')}>
                                {TEXT[lang].activity.all} <ArrowUpRight size={14}/>
                            </button>
                        </div>
                        <div className="card-body p-2">
                            <div className="d-flex flex-column gap-2">
                                {sonHareketler.map((item, index) => (
                                    <div key={index} className="p-3 rounded-4 list-hover border d-flex align-items-center justify-content-between" 
                                         style={{
                                             backgroundColor: darkMode ? '#1e293b' : '#ffffff', 
                                             borderColor: currentTheme.border, 
                                             transition:'all 0.2s ease'
                                         }}>
                                        <div className="d-flex align-items-center">
                                            <div className="rounded-circle d-flex align-items-center justify-content-center me-3 text-white fw-bold shadow-sm" 
                                                 style={{width:'42px', height:'42px', background: `linear-gradient(135deg, ${COLORS.primary}, #a0c4ff)`}}>
                                                {item.ad[0]}{item.soyad[0]}
                                            </div>
                                            <div>
                                                <div className="fw-bold" style={{color: currentTheme.text}}>{item.ad} {item.soyad}</div>
                                                <div className="small" style={{color: currentTheme.subText}}>{item.izin_turu}</div>
                                            </div>
                                        </div>
                                        <span className={`badge rounded-pill px-3 py-2 fw-bold ${item.durum === 'IK_ONAYLADI' ? 'bg-success bg-opacity-10 text-success' : item.durum === 'REDDEDILDI' ? 'bg-danger bg-opacity-10 text-danger' : 'bg-warning bg-opacity-10 text-warning'}`} style={{fontSize:'11px'}}>
                                            {item.durum === 'IK_ONAYLADI' ? TEXT[lang].status.approved : item.durum === 'REDDEDILDI' ? TEXT[lang].status.rejected : TEXT[lang].status.pending}
                                        </span>
                                    </div>
                                ))}
                                {sonHareketler.length === 0 && <div className="text-center py-5" style={{color: currentTheme.subText}}>{TEXT[lang].activity.empty}</div>}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}