import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, LineChart, Line 
} from 'recharts';
import { 
    FileCheck, Clock, FileX, Users, Activity, Moon, Sun, Globe, BellRing, Sparkles, LayoutDashboard,
    BarChart2, PieChart as IconPie, LineChart as IconLine
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
    // eslint-disable-next-line no-unused-vars
    const [loaded, setLoaded] = useState(false); 
    const navigate = useNavigate();

    // ✅ GRAFİK TÜRÜ STATE'LERİ
    const [trendChartType, setTrendChartType] = useState('area'); 
    const [typeChartType, setTypeChartType] = useState('bar');   

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
            charts: { trend: 'Başvuru Analizi (Bu Yıl)', type: 'İzin Türü Dağılımı', status: 'Genel Durum', total: 'TOPLAM' },
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
            charts: { trend: 'Application Analytics (This Year)', type: 'Leave Type Dist.', status: 'General Status', total: 'TOTAL' },
            activity: { title: 'Recent Activities', all: 'View All', empty: 'No recent activity.' },
            status: { approved: 'APPROVED', rejected: 'REJECTED', pending: 'PENDING' }
        }
    };

    // --- TEMA MOTORU ---
    const THEME = {
        light: { 
            bg: '#f3f4f6', 
            cardBg: 'rgba(255, 255, 255, 0.95)', 
            glass: 'rgba(255, 255, 255, 0.8)',
            text: '#111827', 
            subText: '#6b7280', 
            border: '#e5e7eb',
            shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
            chartGrid: '#e5e7eb',
            accentGradient: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', 
        },
        dark: { 
            bg: '#0f172a', 
            cardBg: 'rgba(30, 41, 59, 0.8)', 
            glass: 'rgba(30, 41, 59, 0.5)',
            text: '#f3f4f6', 
            subText: '#9ca3af', 
            border: 'rgba(255,255,255,0.08)',
            shadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            chartGrid: '#374151',
            accentGradient: 'linear-gradient(135deg, #312e81 0%, #4f46e5 100%)',
        }
    };
    
    const current = darkMode ? THEME.dark : THEME.light;
    const COLORS = { primary: '#3b82f6', success: '#10b981', warning: '#f59e0b', danger: '#ef4444' };
    const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    useEffect(() => {
        setLoaded(true); 
        const storedUser = localStorage.getItem('user');
        if (storedUser) { 
            try { 
                const u = JSON.parse(storedUser);
                if(!u.ad) u.ad = 'Misafir';
                setKullanici(u); 
            } catch (e) {} 
        }

        const token = localStorage.getItem('token');
        // Backend zaten role göre filtrelenmiş veriyi döndürüyor
        axios.get('https://mersinbb-izin-sistemi.onrender.com/api/izin/listele', { headers: { Authorization: `Bearer ${token}` } })
            .then(res => {
                const data = res.data;

                // 1. İSTATİSTİK KARTLARI
                setStats({
                    toplam: data.length,
                    onayli: data.filter(x => x.durum === 'IK_ONAYLADI' || x.durum === 'TAMAMLANDI').length,
                    bekleyen: data.filter(x => x.durum.includes('BEK') || x.durum.includes('AMIR') || x.durum.includes('YAZICI')).length,
                    reddedilen: data.filter(x => x.durum === 'REDDEDILDI' || x.durum === 'IPTAL_EDILDI').length
                });

                // 2. İZİN TÜRÜ DAĞILIMI
                const turMap = {};
                data.forEach(d => { turMap[d.izin_turu] = (turMap[d.izin_turu] || 0) + 1; });
                setIzinTurleri(Object.keys(turMap).map(key => ({ name: key, value: turMap[key] })));

                // 3. SON HAREKETLER (Ters çevirip ilk 5'i al)
                setSonHareketler([...data].reverse().slice(0, 5));

                // 4. ✅ AYLIK VERİ ANALİZİ (GERÇEK VERİYE GÖRE HESAPLAMA)
                const currentYear = new Date().getFullYear();
                const monthCounts = new Array(12).fill(0); // [0, 0, ... 0] 12 aylık sayaç

                data.forEach(item => {
                    // Oluşturma tarihini veya başlangıç tarihini baz alıyoruz
                    const tarihStr = item.olusturma_tarihi || item.baslangic_tarihi;
                    if (tarihStr) {
                        const d = new Date(tarihStr);
                        // Sadece bu yıla ait verileri grafiğe ekle
                        if (d.getFullYear() === currentYear) {
                            const monthIndex = d.getMonth(); // 0 = Ocak, 11 = Aralık
                            monthCounts[monthIndex]++;
                        }
                    }
                });

                const aylarTR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
                const aylarEN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const secilenAylar = lang === 'tr' ? aylarTR : aylarEN;

                // Grafik formatına dönüştür
                const dynamicAylikData = secilenAylar.map((ayAdi, index) => ({
                    name: ayAdi,
                    talep: monthCounts[index]
                }));

                setAylikData(dynamicAylikData);
            })
            .catch(err => console.error("Veri çekme hatası:", err));
    }, [lang]);

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'morning';
        if (h < 18) return 'afternoon';
        return 'evening';
    };

    // İSTATİSTİK KARTI BİLEŞENİ
    // eslint-disable-next-line react/prop-types
    const StatCard = ({ title, value, icon: Icon, color, delay }) => (
        <div className={`col-md-6 col-xl-3 fade-in-up`} style={{animationDelay: delay}}>
            <div className="card rounded-4 position-relative overflow-hidden border-0 hover-glass"
                 style={{ backgroundColor: current.cardBg, backdropFilter: 'blur(12px)', boxShadow: current.shadow, border: `1px solid ${current.border}` }}>
                <div className="position-absolute end-0 bottom-0 opacity-10" style={{transform: 'translate(20%, 20%)'}}>
                    <Icon size={80} color={color} />
                </div>
                <div className="card-body p-3 position-relative z-1">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className={`p-2 rounded-3 shadow-sm d-flex align-items-center justify-content-center`} 
                             style={{ background: `linear-gradient(135deg, ${color}20 0%, ${color}10 100%)`, color: color, width:40, height:40 }}>
                            <Icon size={20} strokeWidth={2.5} />
                        </div>
                        {/* Küçük Sparkline Grafik (Görsel amaçlı rastgele veri) */}
                        <div style={{width: 50, height: 25}}>
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
                        <h3 className="fw-bolder m-0" style={{color: current.text}}>{value}</h3>
                        <p className="fw-bold text-uppercase m-0 opacity-60" style={{color: current.text, fontSize:'10px', letterSpacing:'0.5px'}}>{title}</p>
                    </div>
                </div>
            </div>
        </div>
    );

    // --- YARDIMCI KOMPONENT: BUTON GRUBU ---
    // eslint-disable-next-line react/prop-types
    const ChartToggleBtn = ({ icon: Icon, active, onClick }) => (
        <button onClick={onClick} 
            className={`btn btn-sm p-1 px-2 rounded-3 border-0 transition-all ${active ? 'bg-primary text-white shadow-sm' : 'bg-transparent text-secondary hover-bg-light'}`}
            style={{transition: '0.2s'}}>
            <Icon size={16} />
        </button>
    );

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: current.bg,
            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            fontFamily: "'Inter', sans-serif"
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
                .fade-in-up { opacity: 0; animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
                .hover-glass { transition: transform 0.3s ease, box-shadow 0.3s ease; }
                .hover-glass:hover { transform: translateY(-5px); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.15) !important; }
                .glass-panel { background: ${current.glass}; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid ${current.border}; }
                .hover-bg-light:hover { background-color: rgba(0,0,0,0.05); }
            `}</style>

            <div className="container-fluid p-3 p-lg-4 flex-grow-1">

                {/* TOP BAR */}
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4 fade-in-up" style={{animationDelay: '0ms'}}>
                    <div className="d-flex align-items-center gap-3 mb-3 mb-md-0">
                        <div className="p-2 rounded-circle bg-primary bg-opacity-10 text-primary">
                            <LayoutDashboard size={20} />
                        </div>
                        <div>
                            <h5 className="fw-bold m-0" style={{color: current.text}}>Dashboard</h5>
                            <p className="m-0 small opacity-60" style={{color: current.text, fontSize:'12px'}}>{TEXT[lang].department}</p>
                        </div>
                    </div>

                    <div className="d-flex align-items-center gap-2 p-1 rounded-pill shadow-sm glass-panel">
                        <button onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')} 
                                className="btn rounded-pill d-flex align-items-center gap-2 px-3 fw-bold"
                                style={{ color: current.text, fontSize: '12px', transition: '0.2s' }}>
                            <Globe size={14} /> {lang === 'tr' ? 'TR' : 'EN'}
                        </button>
                        <div style={{width:1, height: 16, background: current.border}}></div>
                        <button onClick={() => setDarkMode(!darkMode)} 
                                className="btn rounded-pill d-flex align-items-center gap-2 px-3"
                                style={{ color: current.text }}>
                            {darkMode ? <Sun size={16} className="text-warning"/> : <Moon size={16} className="text-primary"/>}
                        </button>
                    </div>
                </div>

                {/* BANNER */}
                <div className="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden fade-in-up position-relative" 
                     style={{ background: current.accentGradient, color: '#fff', animationDelay: '100ms' }}>
                    <div className="position-absolute top-0 end-0 p-5 opacity-10"><Sparkles size={200} strokeWidth={0.5} /></div>
                    
                    <div className="card-body p-4 d-flex flex-column flex-md-row align-items-center justify-content-between gap-4 position-relative z-1">
                        <div className="d-flex align-items-center gap-3">
                            <div className="p-1 rounded-circle bg-white shadow-lg" style={{width: 70, height: 70}}>
                                <img src={logoMbb} alt="MBB" className="rounded-circle p-1" style={{width: '100%', height: '100%', objectFit:'contain'}} />
                            </div>
                            <div>
                                <span className="badge bg-white text-primary px-2 py-1 rounded-pill shadow-sm fw-bold border-0 mb-1" style={{fontSize:'10px', letterSpacing:'0.5px'}}>
                                    {TEXT[lang].municipality.toUpperCase()}
                                </span>
                                <h2 className="fw-bolder m-0 text-white text-shadow fs-3">
                                    {TEXT[lang].greeting[getGreeting()]}, {kullanici.ad}!
                                </h2>
                                <p className="m-0 text-white text-opacity-90 small">{TEXT[lang].department}</p>
                            </div>
                        </div>

                        <div className="text-md-end text-center bg-white p-2 rounded-3 shadow-sm border-0" style={{minWidth: '100px'}}>
                            <div className="h4 fw-bold text-primary m-0">{new Date().getDate()}</div>
                            <div className="text-uppercase fw-bold text-dark text-opacity-75" style={{fontSize:'10px'}}>
                                {new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', weekday: 'long' })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* KARTLAR */}
                <div className="row g-3 mb-4">
                    <StatCard title={TEXT[lang].cards.total} value={stats.toplam} icon={Users} color={COLORS.primary} delay="200ms" />
                    <StatCard title={TEXT[lang].cards.approved} value={stats.onayli} icon={FileCheck} color={COLORS.success} delay="300ms" />
                    <StatCard title={TEXT[lang].cards.pending} value={stats.bekleyen} icon={Clock} color={COLORS.warning} delay="400ms" />
                    <StatCard title={TEXT[lang].cards.rejected} value={stats.reddedilen} icon={FileX} color={COLORS.danger} delay="500ms" />
                </div>

                {/* GRAFİKLER BÖLÜMÜ */}
                <div className="row g-3">
                    {/* SOL SÜTUN (TREND GRAFİĞİ) */}
                    <div className="col-xl-8 col-lg-7 fade-in-up" style={{animationDelay: '600ms'}}>
                        <div className="card border-0 shadow-sm rounded-4 mb-3 glass-panel" style={{ backgroundColor: current.cardBg }}>
                            <div className="card-header border-0 pt-3 ps-3 pe-3 bg-transparent d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="fw-bold m-0" style={{color: current.text}}>{TEXT[lang].charts.trend}</h6>
                                    <p className="small m-0 opacity-50" style={{color: current.text, fontSize:'11px'}}>Aylık veri analizi</p>
                                </div>
                                <div className="d-flex bg-light rounded-3 p-1 gap-1 border">
                                    <ChartToggleBtn icon={Activity} active={trendChartType==='area'} onClick={()=>setTrendChartType('area')} />
                                    <ChartToggleBtn icon={BarChart2} active={trendChartType==='bar'} onClick={()=>setTrendChartType('bar')} />
                                    <ChartToggleBtn icon={IconLine} active={trendChartType==='line'} onClick={()=>setTrendChartType('line')} />
                                </div>
                            </div>
                            <div className="card-body p-2" style={{height: 250}}>
                                <ResponsiveContainer width="100%" height="100%">
                                    {trendChartType === 'area' && (
                                        <AreaChart data={aylikData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorTalep" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.5}/>
                                                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={current.chartGrid} strokeOpacity={0.5} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: current.subText, fontSize:11}} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fill: current.subText, fontSize:11}} />
                                            <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', backgroundColor: current.cardBg, color: current.text }} />
                                            <Area type="monotone" dataKey="talep" stroke={COLORS.primary} strokeWidth={3} fill="url(#colorTalep)" />
                                        </AreaChart>
                                    )}
                                    {trendChartType === 'bar' && (
                                        <BarChart data={aylikData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={current.chartGrid} strokeOpacity={0.5} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: current.subText, fontSize:11}} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fill: current.subText, fontSize:11}} />
                                            <Tooltip cursor={{fill: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'}} contentStyle={{ borderRadius: '10px', border: 'none', backgroundColor: current.cardBg, color: current.text }} />
                                            <Bar dataKey="talep" fill={COLORS.primary} radius={[6, 6, 0, 0]} barSize={40} />
                                        </BarChart>
                                    )}
                                    {trendChartType === 'line' && (
                                        <LineChart data={aylikData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={current.chartGrid} strokeOpacity={0.5} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: current.subText, fontSize:11}} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fill: current.subText, fontSize:11}} />
                                            <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', backgroundColor: current.cardBg, color: current.text }} />
                                            <Line type="monotone" dataKey="talep" stroke={COLORS.primary} strokeWidth={4} dot={{r:4, fill:COLORS.primary}} activeDot={{r:6}} />
                                        </LineChart>
                                    )}
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* TÜR DAĞILIMI (Bar / Pie Seçenekli) */}
                        <div className="card border-0 shadow-sm rounded-4 overflow-hidden glass-panel" style={{ backgroundColor: current.cardBg }}>
                            <div className="card-header border-0 pt-3 ps-3 pe-3 bg-transparent d-flex justify-content-between align-items-center">
                                <h6 className="fw-bold m-0" style={{color: current.text}}>{TEXT[lang].charts.type}</h6>
                                <div className="d-flex bg-light rounded-3 p-1 gap-1 border">
                                    <ChartToggleBtn icon={BarChart2} active={typeChartType==='bar'} onClick={()=>setTypeChartType('bar')} />
                                    <ChartToggleBtn icon={IconPie} active={typeChartType==='pie'} onClick={()=>setTypeChartType('pie')} />
                                </div>
                            </div>
                            <div className="card-body p-2" style={{height: 220}}>
                                <ResponsiveContainer width="100%" height="100%">
                                    {typeChartType === 'bar' ? (
                                        <BarChart data={izinTurleri} barSize={40}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={current.chartGrid} strokeOpacity={0.5} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: current.subText, fontSize:11}} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fill: current.subText}} />
                                            <Tooltip cursor={{fill: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'}} contentStyle={{ borderRadius: '10px', border: 'none', backgroundColor: current.cardBg, color: current.text }}/>
                                            <Bar dataKey="value" fill={COLORS.primary} radius={[10, 10, 0, 0]}>
                                                {izinTurleri.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    ) : (
                                        <PieChart>
                                            <Pie 
                                                data={izinTurleri} innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none"
                                            >
                                                {izinTurleri.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', backgroundColor: current.cardBg, color: current.text }}/>
                                            <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle"/>
                                        </PieChart>
                                    )}
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* SAĞ SÜTUN */}
                    <div className="col-xl-4 col-lg-5 fade-in-up" style={{animationDelay: '700ms'}}>
                        
                        {/* Donut Chart (Durum) */}
                        <div className="card border-0 shadow-sm rounded-4 mb-3 glass-panel" style={{ backgroundColor: current.cardBg }}>
                            <div className="card-header border-0 pt-3 ps-3 bg-transparent">
                                <h6 className="fw-bold m-0" style={{color: current.text}}>{TEXT[lang].charts.status}</h6>
                            </div>
                            <div className="card-body position-relative p-2" style={{height: 250}}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie 
                                            data={[
                                                {name: TEXT[lang].status.approved, value: stats.onayli}, 
                                                {name: TEXT[lang].status.pending, value: stats.bekleyen}, 
                                                {name: TEXT[lang].status.rejected, value: stats.reddedilen}
                                            ]} 
                                            innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none"
                                        >
                                            <Cell fill={COLORS.success} /> <Cell fill={COLORS.warning} /> <Cell fill={COLORS.danger} />
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', backgroundColor: current.cardBg, color: current.text }}/>
                                        <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="position-absolute top-50 start-50 translate-middle text-center" style={{marginTop:'-15px'}}>
                                    <h3 className="fw-bolder m-0" style={{color: current.text}}>{stats.toplam}</h3>
                                    <p className="small fw-bold text-uppercase m-0 opacity-50" style={{color: current.text, fontSize:'10px'}}>{TEXT[lang].charts.total}</p>
                                </div>
                            </div>
                        </div>

                        {/* Son İşlemler */}
                        <div className="card border-0 shadow-sm rounded-4 glass-panel" style={{ backgroundColor: current.cardBg }}>
                            <div className="card-header border-0 pt-3 ps-3 pb-2 bg-transparent d-flex justify-content-between align-items-center">
                                <h6 className="fw-bold m-0 d-flex align-items-center gap-2" style={{color: current.text}}>
                                    <BellRing size={16} className="text-warning" /> {TEXT[lang].activity.title}
                                </h6>
                                <button onClick={() => navigate('/dashboard/leaves')} className="btn btn-sm btn-light rounded-pill px-3 fw-bold text-primary" style={{fontSize:'11px'}}>
                                    {TEXT[lang].activity.all}
                                </button>
                            </div>
                            <div className="card-body p-2">
                                <div className="d-flex flex-column gap-2">
                                    {sonHareketler.map((item, index) => {
                                        const isApproved = item.durum === 'IK_ONAYLADI' || item.durum === 'TAMAMLANDI';
                                        const isRejected = item.durum === 'REDDEDILDI' || item.durum === 'IPTAL_EDILDI';
                                        
                                        return (
                                            <div key={index} className="d-flex align-items-center p-2 rounded-3 hover-glass border"
                                                 style={{ 
                                                     backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : '#fff', 
                                                     borderColor: current.border 
                                                 }}>
                                                <div className="rounded-circle d-flex align-items-center justify-content-center me-3 text-white fw-bold shadow-sm flex-shrink-0" 
                                                     style={{width:'36px', height:'36px', background: `linear-gradient(135deg, ${COLORS.primary}, #8b5cf6)`, fontSize:'12px'}}>
                                                    {item.ad[0]}{item.soyad[0]}
                                                </div>
                                                <div className="flex-grow-1">
                                                    <div className="fw-bold small" style={{color: current.text}}>{item.ad} {item.soyad}</div>
                                                    <div className="opacity-75" style={{color: current.text, fontSize:'10px'}}>{item.izin_turu}</div>
                                                </div>
                                                <span className={`badge rounded-pill px-2 py-1 fw-bold ${isApproved ? 'bg-success bg-opacity-10 text-success' : isRejected ? 'bg-danger bg-opacity-10 text-danger' : 'bg-warning bg-opacity-10 text-warning'}`} style={{fontSize:'9px'}}>
                                                    {isApproved ? TEXT[lang].status.approved : isRejected ? TEXT[lang].status.rejected : TEXT[lang].status.pending}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    {sonHareketler.length === 0 && <div className="text-center py-4 opacity-50 small" style={{color: current.text}}>{TEXT[lang].activity.empty}</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* FOOTER */}
            <footer className="text-center py-4 opacity-50 fade-in-up mt-auto" 
                    style={{
                        animationDelay: '900ms', 
                        color: current.subText, 
                        fontSize: '11px',
                        borderTop: `1px solid ${current.border}` 
                    }}>
                <p className="m-0 fw-bold">{TEXT[lang].municipality}</p>
                <p className="m-0">{TEXT[lang].department} - Developed by {TEXT[lang].developer} © 2026</p>
            </footer>

        </div>
    );
}