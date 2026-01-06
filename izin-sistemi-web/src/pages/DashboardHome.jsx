import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area 
} from 'recharts';
import { 
    FileCheck, Clock, FileX, Users, Calendar, TrendingUp, 
    Activity, ArrowUpRight, Moon, Sun, Globe, BellRing, Sparkles, LayoutDashboard 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoMbb from '../assets/logombb.png'; 

export default function DashboardHome() {
    // --- STATE ---
    const [stats, setStats] = useState({ toplam: 0, onayli: 0, bekleyen: 0, reddedilen: 0 });
    const [izinTurleri, setIzinTurleri] = useState([]);
    const [aylikData, setAylikData] = useState([]);
    const [sonHareketler, setSonHareketler] = useState([]);
    const [kullanici, setKullanici] = useState({ ad: 'Misafir', soyad: '' });
    const [darkMode, setDarkMode] = useState(false);
    const [lang, setLang] = useState('tr');
    const [loaded, setLoaded] = useState(false); 
    const navigate = useNavigate();

    // --- DİL AYARLARI ---
    const TEXT = {
        tr: {
            greeting: { morning: 'Günaydın', afternoon: 'Tünaydın', evening: 'İyi Geceler' },
            welcome: 'Sisteme Hoş Geldiniz',
            role: 'Sistem Yöneticisi',
            department: 'Toplu Taşıma Şube Müdürlüğü',
            municipality: 'Mersin Büyükşehir Belediyesi',
            developer: 'Hüseyin Arkan',
            today: 'BUGÜN',
            cards: { total: 'Toplam Başvuru', approved: 'Onaylanan İzin', pending: 'Bekleyen Talep', rejected: 'Reddedilen' },
            charts: { trend: 'Başvuru Analizi', type: 'İzin Türü Dağılımı', status: 'Genel Durum', total: 'TOPLAM' },
            activity: { title: 'Son Aktiviteler', all: 'Tümünü Gör', empty: 'Henüz işlem yok.' },
            status: { approved: 'ONAYLANDI', rejected: 'REDDEDİLDİ', pending: 'BEKLİYOR' }
        },
        en: {
            greeting: { morning: 'Good Morning', afternoon: 'Good Afternoon', evening: 'Good Evening' },
            welcome: 'Welcome Back',
            role: 'System Administrator',
            department: 'Public Transportation Branch',
            municipality: 'Mersin Metropolitan Municipality',
            developer: 'Huseyin Arkan',
            today: 'TODAY',
            cards: { total: 'Total Applications', approved: 'Approved Leaves', pending: 'Pending Requests', rejected: 'Rejected' },
            charts: { trend: 'Application Analytics', type: 'Leave Type Dist.', status: 'General Status', total: 'TOTAL' },
            activity: { title: 'Recent Activities', all: 'View All', empty: 'No recent activity.' },
            status: { approved: 'APPROVED', rejected: 'REJECTED', pending: 'PENDING' }
        }
    };

    // --- TEMA MOTORU ---
    const THEME = {
        light: { 
            bg: '#f3f4f6', 
            cardBg: 'rgba(255, 255, 255, 0.85)', 
            glass: 'rgba(255, 255, 255, 0.6)',
            text: '#111827', 
            subText: '#6b7280', 
            border: '#e5e7eb',
            shadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.01)',
            chartGrid: '#e5e7eb',
            // Mavi Banner Rengi (Daha koyu ve okunaklı ton)
            accentGradient: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', 
        },
        dark: { 
            bg: '#0f172a', 
            cardBg: 'rgba(30, 41, 59, 0.7)', 
            glass: 'rgba(30, 41, 59, 0.4)',
            text: '#f3f4f6', 
            subText: '#9ca3af', 
            border: 'rgba(255,255,255,0.08)',
            shadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            chartGrid: '#374151',
            accentGradient: 'linear-gradient(135deg, #312e81 0%, #4f46e5 100%)',
        }
    };
    
    const current = darkMode ? THEME.dark : THEME.light;
    const COLORS = { primary: '#3b82f6', success: '#10b981', warning: '#f59e0b', danger: '#ef4444' };

    useEffect(() => {
        setLoaded(true); 
        const storedUser = localStorage.getItem('user');
        if (storedUser) { 
            try { 
                const u = JSON.parse(storedUser);
                // Eğer isim yoksa varsayılan ata
                if(!u.ad) u.ad = 'Personel';
                setKullanici(u); 
            } catch (e) {} 
        }

        const token = localStorage.getItem('token');
        axios.get('https://mersinbb-izin-sistemi.onrender.com/api/izin/listele', { headers: { Authorization: `Bearer ${token}` } })
            .then(res => {
                const data = res.data;
                
                // İstatistik Mantığı (TAMAMLANDI Dahil)
                setStats({
                    toplam: data.length,
                    onayli: data.filter(x => x.durum === 'IK_ONAYLADI' || x.durum === 'TAMAMLANDI').length,
                    bekleyen: data.filter(x => x.durum.includes('BEK') || x.durum.includes('AMIR') || x.durum.includes('YAZICI')).length,
                    reddedilen: data.filter(x => x.durum === 'REDDEDILDI' || x.durum === 'IPTAL_EDILDI').length
                });

                const turMap = {};
                data.forEach(d => { turMap[d.izin_turu] = (turMap[d.izin_turu] || 0) + 1; });
                setIzinTurleri(Object.keys(turMap).map(key => ({ name: key, value: turMap[key] })));
                setSonHareketler([...data].reverse().slice(0, 5));
                setAylikData([
                    { name: lang === 'tr' ? 'Oca' : 'Jan', talep: 4 }, { name: lang === 'tr' ? 'Şub' : 'Feb', talep: 8 },
                    { name: lang === 'tr' ? 'Mar' : 'Mar', talep: 6 }, { name: lang === 'tr' ? 'Nis' : 'Apr', talep: 15 },
                    { name: lang === 'tr' ? 'May' : 'May', talep: 12 }, { name: lang === 'tr' ? 'Haz' : 'Jun', talep: data.length }
                ]);
            });
    }, [lang]);

    // Selamlama Fonksiyonu (Düzeltildi)
    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'morning';
        if (h < 18) return 'afternoon';
        return 'evening';
    };

    const StatCard = ({ title, value, icon: Icon, color, delay }) => (
        <div className={`col-md-6 col-xl-3 fade-in-up`} style={{animationDelay: delay}}>
            <div className="card h-100 rounded-4 position-relative overflow-hidden border-0 hover-glass"
                 style={{ backgroundColor: current.cardBg, backdropFilter: 'blur(12px)', boxShadow: current.shadow, border: `1px solid ${current.border}` }}>
                
                <div className="position-absolute end-0 bottom-0 opacity-10" style={{transform: 'translate(20%, 20%)'}}>
                    <Icon size={100} color={color} />
                </div>

                <div className="card-body p-4 position-relative z-1">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                        <div className={`p-3 rounded-3 shadow-sm d-flex align-items-center justify-content-center`} 
                             style={{ background: `linear-gradient(135deg, ${color}20 0%, ${color}10 100%)`, color: color, width:50, height:50 }}>
                            <Icon size={24} strokeWidth={2.5} />
                        </div>
                        <div style={{width: 60, height: 30}}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={[{v:5}, {v:12}, {v:8}, {v:15}, {v:10}, {v:20}]}>
                                    <defs>
                                        <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={color} stopOpacity={0.4}/>
                                            <stop offset="100%" stopColor={color} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#grad-${title})`} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div>
                        <h2 className="fw-bolder m-0 display-6" style={{color: current.text}}>{value}</h2>
                        <p className="fw-bold small text-uppercase m-0 mt-1 opacity-60" style={{color: current.text, letterSpacing: '0.5px', fontSize:'11px'}}>{title}</p>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="container-fluid p-4 p-lg-5" style={{backgroundColor: current.bg, minHeight: '100vh', transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)', fontFamily: "'Inter', sans-serif"}}>
            
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
                .fade-in-up { opacity: 0; animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
                .hover-glass { transition: transform 0.3s ease, box-shadow 0.3s ease; }
                .hover-glass:hover { transform: translateY(-5px); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.15) !important; }
                .glass-panel { background: ${current.glass}; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid ${current.border}; }
            `}</style>

            {/* TOP BAR */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-5 fade-in-up" style={{animationDelay: '0ms'}}>
                <div className="d-flex align-items-center gap-3 mb-3 mb-md-0">
                    <div className="p-2 rounded-circle bg-primary bg-opacity-10 text-primary">
                        <LayoutDashboard size={24} />
                    </div>
                    <div>
                        <h4 className="fw-bold m-0" style={{color: current.text}}>Dashboard</h4>
                        <p className="m-0 small opacity-60" style={{color: current.text}}>{TEXT[lang].department}</p>
                    </div>
                </div>

                <div className="d-flex align-items-center gap-2 p-1 rounded-pill shadow-sm glass-panel">
                    <button onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')} 
                            className="btn rounded-pill d-flex align-items-center gap-2 px-3 fw-bold"
                            style={{ color: current.text, fontSize: '13px', transition: '0.2s' }}>
                        <Globe size={16} /> {lang === 'tr' ? 'TR' : 'EN'}
                    </button>
                    <div style={{width:1, height: 20, background: current.border}}></div>
                    <button onClick={() => setDarkMode(!darkMode)} 
                            className="btn rounded-pill d-flex align-items-center gap-2 px-3"
                            style={{ color: current.text }}>
                        {darkMode ? <Sun size={18} className="text-warning"/> : <Moon size={18} className="text-primary"/>}
                    </button>
                </div>
            </div>

            {/* 🔥 HERO SECTION (BANNER) */}
            <div className="card border-0 shadow-lg rounded-5 mb-5 overflow-hidden fade-in-up position-relative" 
                 style={{ 
                     background: current.accentGradient,
                     color: '#fff',
                     animationDelay: '100ms'
                 }}>
                
                {/* Arka Plan Süslemeleri */}
                <div className="position-absolute top-0 end-0 p-5 opacity-10">
                    <Sparkles size={250} strokeWidth={0.5} />
                </div>
                <div className="position-absolute bottom-0 start-0 w-100 opacity-25" style={{lineHeight:0}}>
                    <svg viewBox="0 0 1440 320" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" fillOpacity="1" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,250.7C960,235,1056,181,1152,165.3C1248,149,1344,171,1392,181.3L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path></svg>
                </div>

                <div className="card-body p-4 p-lg-5 d-flex flex-column flex-md-row align-items-center justify-content-between gap-4 position-relative z-1">
                    <div className="d-flex align-items-center gap-4">
                        <div className="p-1 rounded-circle bg-white shadow-lg" style={{width: 90, height: 90}}>
                            <img src={logoMbb} alt="MBB" className="rounded-circle p-1" style={{width: '100%', height: '100%', objectFit:'contain'}} />
                        </div>
                        <div>
                            {/* 🚀 DÜZELTME BURADA: BEYAZ ZEMİN, MAVİ YAZI */}
                            <div className="d-flex align-items-center gap-2 mb-2">
                                <span className="badge bg-white text-primary px-3 py-2 rounded-pill shadow-sm fw-bold border-0" style={{fontSize:'12px', letterSpacing:'0.5px'}}>
                                    {TEXT[lang].municipality.toUpperCase()}
                                </span>
                            </div>
                            <h1 className="fw-bolder m-0 display-6 text-white text-shadow">
                                {TEXT[lang].greeting[getGreeting()]}, {kullanici.ad}!
                            </h1>
                            <p className="m-0 text-white text-opacity-90 fs-6 mt-1">{TEXT[lang].department}</p>
                        </div>
                    </div>

                    <div className="text-md-end text-center bg-white bg-opacity-20 p-3 rounded-4 border border-white border-opacity-20 backdrop-blur shadow-sm">
                        <div className="display-5 fw-bold text-white">{new Date().getDate()}</div>
                        <div className="text-uppercase fw-bold text-white text-opacity-90 small" style={{letterSpacing:'1px'}}>
                            {new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', weekday: 'long' })}
                        </div>
                    </div>
                </div>
            </div>

            {/* İSTATİSTİK KARTLARI */}
            <div className="row g-4 mb-5">
                <StatCard title={TEXT[lang].cards.total} value={stats.toplam} icon={Users} color={COLORS.primary} delay="200ms" />
                <StatCard title={TEXT[lang].cards.approved} value={stats.onayli} icon={FileCheck} color={COLORS.success} delay="300ms" />
                <StatCard title={TEXT[lang].cards.pending} value={stats.bekleyen} icon={Clock} color={COLORS.warning} delay="400ms" />
                <StatCard title={TEXT[lang].cards.rejected} value={stats.reddedilen} icon={FileX} color={COLORS.danger} delay="500ms" />
            </div>

            {/* ANA İÇERİK */}
            <div className="row g-4">
                <div className="col-xl-8 col-lg-7 fade-in-up" style={{animationDelay: '600ms'}}>
                    {/* ALAN GRAFİĞİ */}
                    <div className="card border-0 shadow-sm h-100 rounded-5 mb-4 glass-panel" style={{ backgroundColor: current.cardBg }}>
                        <div className="card-header border-0 pt-4 ps-4 bg-transparent d-flex justify-content-between align-items-center">
                            <div>
                                <h5 className="fw-bold m-0" style={{color: current.text}}>{TEXT[lang].charts.trend}</h5>
                                <p className="small m-0 opacity-50" style={{color: current.text}}>Aylık veri analizi</p>
                            </div>
                            <button className="btn btn-sm btn-icon rounded-circle" style={{background: current.bg}}><ArrowUpRight size={18} color={current.subText}/></button>
                        </div>
                        <div className="card-body" style={{height: 350}}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={aylikData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorTalep" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.5}/>
                                            <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={current.chartGrid} strokeOpacity={0.5} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: current.subText, fontSize:12}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: current.subText, fontSize:12}} />
                                    <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', backgroundColor: current.cardBg, color: current.text }} />
                                    <Area type="monotone" dataKey="talep" stroke={COLORS.primary} strokeWidth={4} fill="url(#colorTalep)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* BAR GRAFİĞİ */}
                    <div className="card border-0 shadow-sm rounded-5 overflow-hidden glass-panel" style={{ backgroundColor: current.cardBg }}>
                        <div className="card-header border-0 pt-4 ps-4 bg-transparent">
                            <h5 className="fw-bold m-0" style={{color: current.text}}>{TEXT[lang].charts.type}</h5>
                        </div>
                        <div className="card-body" style={{height: 300}}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={izinTurleri} barSize={50}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={current.chartGrid} strokeOpacity={0.5} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: current.subText, fontSize:12}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: current.subText}} />
                                    <Tooltip cursor={{fill: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'}} contentStyle={{ borderRadius: '10px', border: 'none', backgroundColor: current.cardBg, color: current.text }}/>
                                    <Bar dataKey="value" fill={COLORS.primary} radius={[12, 12, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="col-xl-4 col-lg-5 fade-in-up" style={{animationDelay: '700ms'}}>
                    
                    {/* DONUT CHART */}
                    <div className="card border-0 shadow-sm rounded-5 mb-4 glass-panel" style={{ backgroundColor: current.cardBg }}>
                        <div className="card-header border-0 pt-4 ps-4 bg-transparent">
                            <h5 className="fw-bold m-0" style={{color: current.text}}>{TEXT[lang].charts.status}</h5>
                        </div>
                        <div className="card-body position-relative" style={{height: 300}}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={[
                                            {name: TEXT[lang].status.approved, value: stats.onayli}, 
                                            {name: TEXT[lang].status.pending, value: stats.bekleyen}, 
                                            {name: TEXT[lang].status.rejected, value: stats.reddedilen}
                                        ]} 
                                        innerRadius={80} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none"
                                    >
                                        <Cell fill={COLORS.success} /> <Cell fill={COLORS.warning} /> <Cell fill={COLORS.danger} />
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', backgroundColor: current.cardBg, color: current.text }}/>
                                    <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="position-absolute top-50 start-50 translate-middle text-center" style={{marginTop:'-10px'}}>
                                <h2 className="fw-bolder m-0 display-5" style={{color: current.text}}>{stats.toplam}</h2>
                                <p className="small fw-bold text-uppercase m-0 opacity-50" style={{color: current.text}}>{TEXT[lang].charts.total}</p>
                            </div>
                        </div>
                    </div>

                    {/* SON İŞLEMLER */}
                    <div className="card border-0 shadow-sm rounded-5 h-100 glass-panel" style={{ backgroundColor: current.cardBg }}>
                        <div className="card-header border-0 pt-4 ps-4 pb-2 bg-transparent d-flex justify-content-between align-items-center">
                            <h5 className="fw-bold m-0 d-flex align-items-center gap-2" style={{color: current.text}}>
                                <BellRing size={20} className="text-warning" /> {TEXT[lang].activity.title}
                            </h5>
                            <button onClick={() => navigate('/dashboard/leaves')} className="btn btn-sm btn-light rounded-pill px-3 fw-bold text-primary">
                                {TEXT[lang].activity.all}
                            </button>
                        </div>
                        <div className="card-body p-3">
                            <div className="d-flex flex-column gap-3">
                                {sonHareketler.map((item, index) => {
                                    // Durum kontrolü (TAMAMLANDI da eklendi)
                                    const isApproved = item.durum === 'IK_ONAYLADI' || item.durum === 'TAMAMLANDI';
                                    const isRejected = item.durum === 'REDDEDILDI' || item.durum === 'IPTAL_EDILDI';
                                    
                                    return (
                                        <div key={index} className="d-flex align-items-center p-3 rounded-4 hover-glass border"
                                             style={{ 
                                                 backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : '#fff', 
                                                 borderColor: current.border 
                                             }}>
                                            <div className="rounded-circle d-flex align-items-center justify-content-center me-3 text-white fw-bold shadow-sm flex-shrink-0" 
                                                 style={{width:'48px', height:'48px', background: `linear-gradient(135deg, ${COLORS.primary}, #8b5cf6)`}}>
                                                {item.ad[0]}{item.soyad[0]}
                                            </div>
                                            <div className="flex-grow-1">
                                                <div className="fw-bold" style={{color: current.text}}>{item.ad} {item.soyad}</div>
                                                <div className="small opacity-75" style={{color: current.text}}>{item.izin_turu}</div>
                                            </div>
                                            <span className={`badge rounded-pill px-3 py-2 fw-bold ${isApproved ? 'bg-success bg-opacity-10 text-success' : isRejected ? 'bg-danger bg-opacity-10 text-danger' : 'bg-warning bg-opacity-10 text-warning'}`}>
                                                {isApproved ? TEXT[lang].status.approved : isRejected ? TEXT[lang].status.rejected : TEXT[lang].status.pending}
                                            </span>
                                        </div>
                                    );
                                })}
                                {sonHareketler.length === 0 && <div className="text-center py-5 opacity-50" style={{color: current.text}}>{TEXT[lang].activity.empty}</div>}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
            
            <div className="text-center mt-5 mb-4 opacity-50 fade-in-up" style={{animationDelay: '900ms', color: current.subText, fontSize: '12px'}}>
                <p className="m-0 fw-bold">{TEXT[lang].municipality}</p>
                <p className="m-0">{TEXT[lang].department} - Developed by {TEXT[lang].developer} © 2026</p>
            </div>
        </div>
    );
}