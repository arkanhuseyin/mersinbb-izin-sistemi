import { useEffect, useState } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';
import { FileCheck, Clock, FileX, Users, Calendar, TrendingUp, Activity, ArrowUpRight, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ✅ LOGOYU İMPORT EDİYORUZ
import logoMbb from '../assets/logombb.png'; 

export default function DashboardHome() {
    const [stats, setStats] = useState({ toplam: 0, onayli: 0, bekleyen: 0, reddedilen: 0 });
    const [izinTurleri, setIzinTurleri] = useState([]);
    const [aylikData, setAylikData] = useState([]);
    const [sonHareketler, setSonHareketler] = useState([]);
    const [selamlama, setSelamlama] = useState('');
    const navigate = useNavigate();

    // Modern Renk Paleti (Soft & Kurumsal)
    const COLORS = {
        primary: '#4361ee',
        success: '#2ec4b6',
        warning: '#ff9f1c',
        danger: '#e71d36',
        text: '#2b2d42',
        subtext: '#8d99ae',
        bg: '#f3f4f6'
    };

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setSelamlama('Günaydın');
        else if (hour < 18) setSelamlama('Tünaydın');
        else setSelamlama('İyi Akşamlar');

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
                    { name: 'Oca', talep: 4 }, { name: 'Şub', talep: 8 },
                    { name: 'Mar', talep: 6 }, { name: 'Nis', talep: 15 },
                    { name: 'May', talep: 12 }, { name: 'Haz', talep: data.length }
                ]);
            });
    }, []);

    // Grafik Tooltip Tasarımı
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 rounded-3 shadow border border-light">
                    <p className="m-0 fw-bold text-dark mb-1">{label}</p>
                    <p className="m-0 text-primary fw-bold" style={{fontSize:'14px'}}>{payload[0].value} Adet</p>
                </div>
            );
        }
        return null;
    };

    // İstatistik Kartı Bileşeni
    const StatCard = ({ title, value, icon: Icon, color, bgGradient }) => (
        <div className="col-md-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100 rounded-4 overflow-hidden position-relative hover-scale" 
                 style={{ transition: 'all 0.3s ease' }}>
                <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-start">
                        <div>
                            <p className="text-uppercase fw-bold text-muted small mb-2" style={{letterSpacing:'0.5px', fontSize:'11px'}}>{title}</p>
                            <h2 className="fw-bolder m-0 display-6" style={{color: COLORS.text}}>{value}</h2>
                        </div>
                        <div className={`p-3 rounded-4 shadow-sm text-white`} 
                             style={{ background: bgGradient, width: '54px', height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon size={26} strokeWidth={2.5} />
                        </div>
                    </div>
                    {/* Alt Dekorasyon Çizgisi */}
                    <div className="mt-3 rounded-pill" style={{height:'4px', width:'40%', background: bgGradient, opacity:0.7}}></div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="container-fluid p-4 p-lg-5" style={{backgroundColor: '#f8f9fa', minHeight: '100vh'}}>
            <style>{`
                .hover-scale:hover { transform: translateY(-5px); box-shadow: 0 15px 30px rgba(0,0,0,0.08) !important; }
                .list-hover:hover { background-color: #f8f9fa; transform: translateX(5px); }
            `}</style>

            {/* 🔥 1. YENİ KARŞILAMA PANELİ (Logolu Header) */}
            <div className="card border-0 shadow-sm rounded-4 mb-5 overflow-hidden" 
                 style={{ background: 'linear-gradient(120deg, #ffffff 0%, #f0f4ff 100%)' }}>
                <div className="card-body p-4 p-lg-5 d-flex flex-column flex-md-row align-items-center justify-content-between gap-4">
                    
                    {/* Sol: Logo ve Metin */}
                    <div className="d-flex align-items-center gap-4">
                        <div className="bg-white p-3 rounded-circle shadow-sm d-flex align-items-center justify-content-center" style={{width:'100px', height:'100px'}}>
                            <img src={logoMbb} alt="MBB Logo" style={{width:'80%', height:'auto'}} />
                        </div>
                        <div>
                            <h5 className="text-primary fw-bold text-uppercase mb-1" style={{letterSpacing:'1px'}}>Mersin Büyükşehir Belediyesi</h5>
                            <h2 className="fw-bolder text-dark mb-1">Toplu Taşıma Şube Müdürlüğü</h2>
                            <p className="text-muted m-0 fs-5">{selamlama}, Hüseyin Arkan</p>
                        </div>
                    </div>

                    {/* Sağ: Tarih ve Buton */}
                    <div className="d-flex flex-column align-items-md-end gap-3">
                        <div className="bg-white px-4 py-3 rounded-4 shadow-sm border border-light d-flex align-items-center gap-3">
                            <div className="bg-primary bg-opacity-10 p-2 rounded-circle">
                                <Calendar size={20} className="text-primary"/>
                            </div>
                            <div>
                                <div className="small text-muted fw-bold text-uppercase" style={{fontSize:'10px'}}>BUGÜN</div>
                                <div className="fw-bold text-dark fs-6">
                                    {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
            
            {/* 2. İSTATİSTİK KARTLARI */}
            <div className="row g-4 mb-5">
                <StatCard title="TOPLAM BAŞVURU" value={stats.toplam} icon={Users} bgGradient="linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)" />
                <StatCard title="ONAYLANAN İZİNLER" value={stats.onayli} icon={FileCheck} bgGradient="linear-gradient(135deg, #2ec4b6 0%, #20a4f3 100%)" />
                <StatCard title="BEKLEYEN TALEPLER" value={stats.bekleyen} icon={Clock} bgGradient="linear-gradient(135deg, #ff9f1c 0%, #ffbf69 100%)" />
                <StatCard title="REDDEDİLENLER" value={stats.reddedilen} icon={FileX} bgGradient="linear-gradient(135deg, #e71d36 0%, #d90429 100%)" />
            </div>

            <div className="row g-4">
                
                {/* 3. GRAFİKLER (Sol Taraf) */}
                <div className="col-xl-8 col-lg-7">
                    
                    {/* Alan Grafiği */}
                    <div className="card border-0 shadow-sm h-100 rounded-4 mb-4">
                        <div className="card-header bg-white border-0 pt-4 ps-4 d-flex justify-content-between align-items-center">
                            <div>
                                <h5 className="fw-bold text-dark m-0">Başvuru Yoğunluğu</h5>
                                <p className="text-muted small m-0">Aylık talep trend analizi</p>
                            </div>
                            <div className="bg-light p-2 rounded-circle"><TrendingUp size={20} className="text-primary"/></div>
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
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: COLORS.subtext, fontSize:12}} dy={10}/>
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: COLORS.subtext, fontSize:12}}/>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="talep" stroke={COLORS.primary} strokeWidth={4} fill="url(#colorTalep)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>

                {/* 4. DURUM VE LİSTE (Sağ Taraf) */}
                <div className="col-xl-4 col-lg-5">
                    
                    {/* Donut Chart */}
                    <div className="card border-0 shadow-sm rounded-4 mb-4">
                        <div className="card-header bg-white border-0 pt-4 ps-4">
                            <h5 className="fw-bold m-0 text-dark">Genel Durum</h5>
                        </div>
                        <div className="card-body" style={{height: 300}}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={[
                                            {name: 'Onaylı', value: stats.onayli}, 
                                            {name: 'Bekleyen', value: stats.bekleyen}, 
                                            {name: 'Red', value: stats.reddedilen}
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
                            {/* Ortadaki Toplam Sayı */}
                            <div className="position-absolute top-50 start-50 translate-middle text-center" style={{marginTop:'-10px'}}>
                                <h1 className="fw-bolder m-0 text-dark display-6">{stats.toplam}</h1>
                                <small className="text-muted fw-bold text-uppercase" style={{fontSize:'11px'}}>TOPLAM</small>
                            </div>
                        </div>
                    </div>

                    {/* Son İşlemler Listesi */}
                    <div className="card border-0 shadow-sm rounded-4 h-100">
                        <div className="card-header bg-white border-0 pt-4 ps-4 pb-2 d-flex justify-content-between align-items-center">
                            <h5 className="fw-bold m-0 d-flex align-items-center gap-2"><Activity size={20} className="text-warning"/> Son Aktiviteler</h5>
                            <button className="btn btn-sm btn-light rounded-pill px-3 fw-bold text-primary d-flex align-items-center gap-1" onClick={() => navigate('/dashboard/leaves')}>
                                Tümü <ArrowUpRight size={14}/>
                            </button>
                        </div>
                        <div className="card-body p-2">
                            <div className="d-flex flex-column gap-2">
                                {sonHareketler.map((item, index) => (
                                    <div key={index} className="p-3 rounded-4 list-hover bg-white border border-light d-flex align-items-center justify-content-between" style={{transition:'all 0.2s ease'}}>
                                        <div className="d-flex align-items-center">
                                            <div className="rounded-circle d-flex align-items-center justify-content-center me-3 text-white fw-bold shadow-sm" 
                                                 style={{width:'42px', height:'42px', background: `linear-gradient(135deg, ${COLORS.primary}, #a0c4ff)`}}>
                                                {item.ad[0]}{item.soyad[0]}
                                            </div>
                                            <div>
                                                <div className="fw-bold text-dark">{item.ad} {item.soyad}</div>
                                                <div className="text-muted" style={{fontSize:'12px'}}>{item.izin_turu}</div>
                                            </div>
                                        </div>
                                        <span className={`badge rounded-pill px-3 py-2 fw-bold ${item.durum === 'IK_ONAYLADI' ? 'bg-success bg-opacity-10 text-success' : item.durum === 'REDDEDILDI' ? 'bg-danger bg-opacity-10 text-danger' : 'bg-warning bg-opacity-10 text-warning'}`} style={{fontSize:'11px'}}>
                                            {item.durum === 'IK_ONAYLADI' ? 'ONAYLANDI' : item.durum === 'REDDEDILDI' ? 'REDDEDİLDİ' : 'BEKLİYOR'}
                                        </span>
                                    </div>
                                ))}
                                {sonHareketler.length === 0 && <div className="text-center text-muted py-5">Henüz işlem yok.</div>}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}