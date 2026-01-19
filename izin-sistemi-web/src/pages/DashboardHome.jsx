import { useEffect, useState } from 'react';
import axios from 'axios';
import { useModule } from '../context/ModuleContext';
import { 
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, LineChart, Line 
} from 'recharts';
import { 
    FileCheck, Clock, FileX, Users, Activity, Moon, Sun, Globe, BellRing, Sparkles, LayoutDashboard,
    BarChart2, PieChart as IconPie, LineChart as IconLine, MessageSquare, Shirt, Box, AlertTriangle, CheckCircle
} from 'lucide-react';
import logoMbb from '../assets/logombb.png'; 

export default function DashboardHome() {
    const { activeModule } = useModule();
    
    // --- GENEL STATE ---
    const [personelSayisi, setPersonelSayisi] = useState(0); 
    const [loading, setLoading] = useState(true);

    // --- İZİN MODÜLÜ STATE ---
    const [izinStats, setIzinStats] = useState({ toplam: 0, onayli: 0, bekleyen: 0, reddedilen: 0 });
    const [izinTurleri, setIzinTurleri] = useState([]);
    const [aylikData, setAylikData] = useState([]);
    const [sonHareketler, setSonHareketler] = useState([]);

    // --- TALEP MODÜLÜ STATE ---
    const [talepStats, setTalepStats] = useState({ toplam: 0, acik: 0, cozuldu: 0, iptal: 0 });
    const [sonTalepler, setSonTalepler] = useState([]);

    // --- GENEL AYARLAR ---
    const [kullanici, setKullanici] = useState({ ad: 'Misafir', soyad: '' });
    const [darkMode, setDarkMode] = useState(false);
    const [lang, setLang] = useState('tr');
    const [trendChartType, setTrendChartType] = useState('area'); 
    const [typeChartType, setTypeChartType] = useState('bar');   

    const API_URL = 'https://mersinbb-izin-sistemi.onrender.com';

    // --- TEMA VE RENKLER ---
    const THEME = {
        light: { bg: '#f3f4f6', cardBg: 'rgba(255, 255, 255, 0.95)', glass: 'rgba(255, 255, 255, 0.8)', text: '#111827', subText: '#6b7280', border: '#e5e7eb', shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)', chartGrid: '#e5e7eb', accentGradient: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)' },
        dark: { bg: '#0f172a', cardBg: 'rgba(30, 41, 59, 0.8)', glass: 'rgba(30, 41, 59, 0.5)', text: '#f3f4f6', subText: '#9ca3af', border: 'rgba(255,255,255,0.08)', shadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)', chartGrid: '#374151', accentGradient: 'linear-gradient(135deg, #312e81 0%, #4f46e5 100%)' }
    };
    const current = darkMode ? THEME.dark : THEME.light;
    const COLORS = { primary: '#3b82f6', success: '#10b981', warning: '#f59e0b', danger: '#ef4444' };
    const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    // --- VERİ ÇEKME İŞLEMLERİ ---
    useEffect(() => {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        if (storedUser) { try { setKullanici(JSON.parse(storedUser)); } catch (e) {} }

        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. PERSONEL SAYISI
                const pRes = await axios.get(`${API_URL}/api/personel/liste`, { headers: { Authorization: `Bearer ${token}` } });
                setPersonelSayisi(pRes.data.length);

                // 2. İZİN MODÜLÜ
                if (activeModule === 'IZIN') {
                    const res = await axios.get(`${API_URL}/api/izin/listele`, { headers: { Authorization: `Bearer ${token}` } });
                    const data = res.data;
                    
                    setIzinStats({
                        toplam: data.length,
                        onayli: data.filter(x => x.durum === 'IK_ONAYLADI' || x.durum === 'TAMAMLANDI').length,
                        bekleyen: data.filter(x => x.durum.includes('BEK') || x.durum.includes('AMIR') || x.durum.includes('YAZICI')).length,
                        reddedilen: data.filter(x => x.durum === 'REDDEDILDI' || x.durum === 'IPTAL_EDILDI').length
                    });

                    const turMap = {};
                    data.forEach(d => { turMap[d.izin_turu] = (turMap[d.izin_turu] || 0) + 1; });
                    setIzinTurleri(Object.keys(turMap).map(key => ({ name: key, value: turMap[key] })));
                    setSonHareketler([...data].reverse().slice(0, 5));

                    const currentYear = new Date().getFullYear();
                    const monthCounts = new Array(12).fill(0);
                    data.forEach(item => {
                        const tarihStr = item.olusturma_tarihi || item.baslangic_tarihi;
                        if (tarihStr) {
                            const d = new Date(tarihStr);
                            if (d.getFullYear() === currentYear) monthCounts[d.getMonth()]++;
                        }
                    });
                    const aylarTR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
                    setAylikData(aylarTR.map((ayAdi, index) => ({ name: ayAdi, talep: monthCounts[index] })));
                }

                // 3. TALEP MODÜLÜ
                if (activeModule === 'TALEP') {
                    try {
                        const talepRes = await axios.get(`${API_URL}/api/talep/listele`, { headers: { Authorization: `Bearer ${token}` } });
                        const tData = talepRes.data || [];
                        setTalepStats({
                            toplam: tData.length,
                            acik: tData.filter(t => t.durum === 'ACIK' || t.durum === 'ISLEMDE').length,
                            cozuldu: tData.filter(t => t.durum === 'COZULDU').length,
                            iptal: tData.filter(t => t.durum === 'IPTAL').length
                        });
                        setSonTalepler([...tData].reverse().slice(0, 5));
                    } catch (e) {
                        setTalepStats({ toplam: 0, acik: 0, cozuldu: 0, iptal: 0 });
                        setSonTalepler([]);
                    }
                }

            } catch (err) {
                console.error("Veri çekme hatası:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [activeModule, lang]);

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Günaydın';
        if (h < 18) return 'Tünaydın';
        return 'İyi Geceler';
    };

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
                    </div>
                    <div>
                        <h3 className="fw-bolder m-0" style={{color: current.text}}>{value}</h3>
                        <p className="fw-bold text-uppercase m-0 opacity-60" style={{color: current.text, fontSize:'10px', letterSpacing:'0.5px'}}>{title}</p>
                    </div>
                </div>
            </div>
        </div>
    );

    // eslint-disable-next-line react/prop-types
    const ChartToggleBtn = ({ icon: Icon, active, onClick }) => (
        <button onClick={onClick} className={`btn btn-sm p-1 px-2 rounded-3 border-0 transition-all ${active ? 'bg-primary text-white shadow-sm' : 'bg-transparent text-secondary hover-bg-light'}`}>
            <Icon size={16} />
        </button>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: current.bg, transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)', fontFamily: "'Inter', sans-serif" }}>
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
                            <h5 className="fw-bold m-0" style={{color: current.text}}>
                                {activeModule === 'IZIN' ? 'İzin Yönetim Paneli' : activeModule === 'TALEP' ? 'Talep & Öneri Paneli' : 'Lojistik Paneli'}
                            </h5>
                            <p className="m-0 small opacity-60" style={{color: current.text, fontSize:'12px'}}>Toplu Taşıma Şube Müdürlüğü</p>
                        </div>
                    </div>
                    <div className="d-flex align-items-center gap-2 p-1 rounded-pill shadow-sm glass-panel">
                        <button onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')} className="btn rounded-pill d-flex align-items-center gap-2 px-3 fw-bold" style={{ color: current.text, fontSize: '12px' }}>
                            <Globe size={14} /> {lang === 'tr' ? 'TR' : 'EN'}
                        </button>
                        <div style={{width:1, height: 16, background: current.border}}></div>
                        <button onClick={() => setDarkMode(!darkMode)} className="btn rounded-pill d-flex align-items-center gap-2 px-3" style={{ color: current.text }}>
                            {darkMode ? <Sun size={16} className="text-warning"/> : <Moon size={16} className="text-primary"/>}
                        </button>
                    </div>
                </div>

                {/* BANNER (Her Modülde Aynı - Renk Değişir) */}
                <div className="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden fade-in-up position-relative" 
                     style={{ background: activeModule === 'TALEP' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : activeModule === 'KIYAFET' ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' : current.accentGradient, color: '#fff', animationDelay: '100ms' }}>
                    <div className="position-absolute top-0 end-0 p-5 opacity-10"><Sparkles size={200} strokeWidth={0.5} /></div>
                    <div className="card-body p-4 d-flex flex-column flex-md-row align-items-center justify-content-between gap-4 position-relative z-1">
                        <div className="d-flex align-items-center gap-3">
                            <div className="p-1 rounded-circle bg-white shadow-lg" style={{width: 70, height: 70}}>
                                <img src={logoMbb} alt="MBB" className="rounded-circle p-1" style={{width: '100%', height: '100%', objectFit:'contain'}} />
                            </div>
                            <div>
                                <span className="badge bg-white text-primary px-2 py-1 rounded-pill shadow-sm fw-bold border-0 mb-1" style={{fontSize:'10px', letterSpacing:'0.5px'}}>MERSİN BÜYÜKŞEHİR BELEDİYESİ</span>
                                <h2 className="fw-bolder m-0 text-white text-shadow fs-3">{getGreeting()}, {kullanici.ad}!</h2>
                                <p className="m-0 text-white text-opacity-90 small">Sisteme hoş geldiniz.</p>
                            </div>
                        </div>
                        <div className="text-md-end text-center bg-white p-2 rounded-3 shadow-sm border-0" style={{minWidth: '100px'}}>
                            <div className="h4 fw-bold text-primary m-0">{new Date().getDate()}</div>
                            <div className="text-uppercase fw-bold text-dark text-opacity-75" style={{fontSize:'10px'}}>
                                {new Date().toLocaleDateString('tr-TR', { month: 'long', weekday: 'long' })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- 1. İZİN MODÜLÜ İÇERİĞİ (GERÇEK VERİ) --- */}
                {activeModule === 'IZIN' && (
                    <>
                        <div className="row g-3 mb-4">
                            <StatCard title="PERSONEL MEVCUDU" value={personelSayisi} icon={Users} color={COLORS.primary} delay="150ms" />
                            {/* DÜZELTME: stats yerine izinStats kullanıldı */}
                            <StatCard title="TOPLAM BAŞVURU" value={izinStats.toplam} icon={FileCheck} color={COLORS.primary} delay="200ms" />
                            <StatCard title="ONAYLANAN İZİN" value={izinStats.onayli} icon={FileCheck} color={COLORS.success} delay="300ms" />
                            <StatCard title="BEKLEYEN TALEP" value={izinStats.bekleyen} icon={Clock} color={COLORS.warning} delay="400ms" />
                        </div>

                        <div className="row g-3">
                            <div className="col-xl-8 col-lg-7 fade-in-up" style={{animationDelay: '600ms'}}>
                                <div className="card border-0 shadow-sm rounded-4 mb-3 glass-panel" style={{ backgroundColor: current.cardBg }}>
                                    <div className="card-header border-0 pt-3 ps-3 pe-3 bg-transparent d-flex justify-content-between align-items-center">
                                        <h6 className="fw-bold m-0" style={{color: current.text}}>Başvuru Analizi (Bu Yıl)</h6>
                                        <div className="d-flex bg-light rounded-3 p-1 gap-1 border">
                                            <ChartToggleBtn icon={Activity} active={trendChartType==='area'} onClick={()=>setTrendChartType('area')} />
                                            <ChartToggleBtn icon={BarChart2} active={trendChartType==='bar'} onClick={()=>setTrendChartType('bar')} />
                                            <ChartToggleBtn icon={IconLine} active={trendChartType==='line'} onClick={()=>setTrendChartType('line')} />
                                        </div>
                                    </div>
                                    <div className="card-body p-2" style={{height: 250}}>
                                        <ResponsiveContainer width="100%" height="100%">
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
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            <div className="col-xl-4 col-lg-5 fade-in-up" style={{animationDelay: '700ms'}}>
                                <div className="card border-0 shadow-sm rounded-4 glass-panel" style={{ backgroundColor: current.cardBg }}>
                                    <div className="card-header border-0 pt-3 ps-3 bg-transparent">
                                        <h6 className="fw-bold m-0" style={{color: current.text}}>Genel Durum</h6>
                                    </div>
                                    <div className="card-body position-relative p-2" style={{height: 250}}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                {/* DÜZELTME: stats yerine izinStats */}
                                                <Pie data={[{name: 'Onaylı', value: izinStats.onayli}, {name: 'Bekleyen', value: izinStats.bekleyen}, {name: 'Red', value: izinStats.reddedilen}]} 
                                                     innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                                                    <Cell fill={COLORS.success} /> <Cell fill={COLORS.warning} /> <Cell fill={COLORS.danger} />
                                                </Pie>
                                                <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', backgroundColor: current.cardBg, color: current.text }}/>
                                                <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="position-absolute top-50 start-50 translate-middle text-center" style={{marginTop:'-15px'}}>
                                            {/* DÜZELTME: stats yerine izinStats */}
                                            <h3 className="fw-bolder m-0" style={{color: current.text}}>{izinStats.toplam}</h3>
                                            <p className="small fw-bold text-uppercase m-0 opacity-50" style={{color: current.text, fontSize:'10px'}}>TOPLAM</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* --- 2. TALEP MODÜLÜ İÇERİĞİ --- */}
                {activeModule === 'TALEP' && (
                    <>
                        <div className="row g-3 mb-4">
                            <StatCard title="TOPLAM BİLDİRİM" value={talepStats.toplam} icon={MessageSquare} color={COLORS.primary} delay="200ms" />
                            <StatCard title="AÇIK TALEPLER" value={talepStats.acik} icon={Clock} color={COLORS.warning} delay="300ms" />
                            <StatCard title="ÇÖZÜLENLER" value={talepStats.cozuldu} icon={CheckCircle} color={COLORS.success} delay="400ms" />
                            <StatCard title="İPTAL / RED" value={talepStats.iptal} icon={FileX} color={COLORS.danger} delay="500ms" />
                        </div>
                        <div className="card border-0 shadow-sm rounded-4 p-4 glass-panel" style={{ backgroundColor: current.cardBg }}>
                            <h6 className="fw-bold mb-3" style={{color: current.text}}>Son Gelen Talepler</h6>
                            {sonTalepler.length > 0 ? (
                                <div className="table-responsive">
                                    <table className="table align-middle" style={{color: current.text}}>
                                        <thead className="bg-light bg-opacity-50">
                                            <tr><th>Personel</th><th>Konu</th><th>Durum</th><th>Tarih</th></tr>
                                        </thead>
                                        <tbody>
                                            {sonTalepler.map((t, i) => (
                                                <tr key={i}>
                                                    <td>{t.ad} {t.soyad}</td>
                                                    <td>{t.konu}</td>
                                                    <td>
                                                        <span className={`badge ${t.durum==='COZULDU'?'bg-success':t.durum==='IPTAL'?'bg-danger':'bg-warning'} text-white`}>
                                                            {t.durum}
                                                        </span>
                                                    </td>
                                                    <td>{new Date(t.tarih).toLocaleDateString('tr-TR')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-5 text-muted">Henüz kayıtlı talep bulunmuyor.</div>
                            )}
                        </div>
                    </>
                )}

                {/* --- 3. KIYAFET MODÜLÜ İÇERİĞİ --- */}
                {activeModule === 'KIYAFET' && (
                    <>
                        <div className="row g-3 mb-4">
                            <StatCard title="TOPLAM PERSONEL" value={personelSayisi} icon={Users} color={COLORS.primary} delay="200ms" />
                            <StatCard title="BEDEN DEĞİŞİM" value="0" icon={Shirt} color={COLORS.warning} delay="300ms" />
                            <StatCard title="DAĞITILAN ÜRÜN" value="0" icon={Box} color={COLORS.success} delay="400ms" />
                            <StatCard title="STOK UYARISI" value="0" icon={AlertTriangle} color={COLORS.danger} delay="500ms" />
                        </div>
                        <div className="row g-3">
                            <div className="col-12">
                                <div className="card border-0 shadow-sm rounded-4 p-5 h-100 glass-panel d-flex align-items-center justify-content-center" style={{ backgroundColor: current.cardBg }}>
                                    <div className="text-center text-muted">
                                        <Box size={64} className="mb-3 opacity-25"/>
                                        <h5>Lojistik verileri hazırlanıyor...</h5>
                                        <p className="small">Personel sayısına ({personelSayisi}) göre stok planlaması yapılabilir.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

            </div>
            
            {/* FOOTER */}
            <footer className="text-center py-4 opacity-50 fade-in-up mt-auto" style={{ animationDelay: '900ms', color: current.subText, fontSize: '11px', borderTop: `1px solid ${current.border}` }}>
                <p className="m-0 fw-bold">MERSİN BÜYÜKŞEHİR BELEDİYESİ</p>
                <p className="m-0">Toplu Taşıma Şube Müdürlüğü - Developed by Hüseyin Arkan © 2026</p>
            </footer>
        </div>
    );
}