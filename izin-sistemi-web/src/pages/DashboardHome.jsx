import { useEffect, useState } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';
import { FileCheck, Clock, FileX, Users, Calendar, TrendingUp, Activity, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DashboardHome() {
    const [stats, setStats] = useState({ toplam: 0, onayli: 0, bekleyen: 0, reddedilen: 0 });
    const [izinTurleri, setIzinTurleri] = useState([]);
    const [aylikData, setAylikData] = useState([]);
    const [sonHareketler, setSonHareketler] = useState([]);
    const [selamlama, setSelamlama] = useState('');
    const navigate = useNavigate();

    // Özel Renk Paleti
    const COLORS = {
        primary: '#4361ee',   // Canlı Mavi
        success: '#06d6a0',   // Modern Yeşil
        warning: '#ffd166',   // Soft Sarı
        danger: '#ef476f',    // Soft Kırmızı
        text: '#2b2d42',
        subtext: '#8d99ae'
    };

    useEffect(() => {
        // Saate göre selamlama
        const hour = new Date().getHours();
        if (hour < 12) setSelamlama('Günaydın');
        else if (hour < 18) setSelamlama('Tünaydın');
        else setSelamlama('İyi Akşamlar');

        const token = localStorage.getItem('token');
        axios.get('https://mersinbb-izin-sistemi.onrender.com/api/izin/listele', { headers: { Authorization: `Bearer ${token}` } })
            .then(res => {
                const data = res.data;
                
                // İstatistikler
                setStats({
                    toplam: data.length,
                    onayli: data.filter(x => x.durum === 'IK_ONAYLADI').length,
                    bekleyen: data.filter(x => x.durum.includes('BEK') || x.durum.includes('AMIR') || x.durum.includes('YAZICI')).length,
                    reddedilen: data.filter(x => x.durum === 'REDDEDILDI').length
                });

                // İzin Türü Verisi
                const turMap = {};
                data.forEach(d => { turMap[d.izin_turu] = (turMap[d.izin_turu] || 0) + 1; });
                setIzinTurleri(Object.keys(turMap).map(key => ({ name: key, value: turMap[key] })));

                // Son Hareketler
                setSonHareketler([...data].reverse().slice(0, 5)); // Son 5'e düşürdüm daha temiz dursun

                // Aylık Veri Simülasyonu
                setAylikData([
                    { name: 'Oca', talep: 4 }, { name: 'Şub', talep: 8 },
                    { name: 'Mar', talep: 6 }, { name: 'Nis', talep: 15 },
                    { name: 'May', talep: 12 }, { name: 'Haz', talep: data.length }
                ]);
            });
    }, []);

    // ✨ Özel Grafik Tooltip'i (Hover yapınca çıkan kutu)
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-dark text-white p-2 rounded shadow-sm opacity-90 small">
                    <p className="m-0 fw-bold">{label}</p>
                    <p className="m-0 text-info">{`Talep: ${payload[0].value}`}</p>
                </div>
            );
        }
        return null;
    };

    // ✨ İSTATİSTİK KARTI
    const StatCard = ({ title, value, icon: Icon, color, bgGradient }) => (
        <div className="col-md-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100 rounded-4 overflow-hidden position-relative hover-scale" 
                 style={{ transition: 'transform 0.3s ease, box-shadow 0.3s ease' }}>
                <div className="card-body p-4">
                    <div className="d-flex align-items-center mb-3">
                        <div className={`p-3 rounded-4 shadow-sm me-3 text-white`} 
                             style={{ background: bgGradient, width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon size={24} />
                        </div>
                        <h6 className="text-muted fw-bold m-0 text-uppercase small" style={{letterSpacing:'1px'}}>{title}</h6>
                    </div>
                    <div className="d-flex align-items-end justify-content-between">
                        <h2 className="fw-bolder m-0 display-6" style={{color: COLORS.text}}>{value}</h2>
                        {/* Süsleme Amaçlı Mini Grafik */}
                        <div style={{height: '40px', width: '80px', opacity: 0.5}}>
                             <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={[{v:10}, {v:30}, {v:20}, {v:50}, {v:40}, {v:80}, {v:60}]}>
                                    <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="container-fluid p-4 p-lg-5" style={{backgroundColor: '#f8f9fa', minHeight: '100vh'}}>
            
            {/* CSS: Kartların üzerine gelince yükselmesi için */}
            <style>{`
                .hover-scale:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important; }
            `}</style>

            {/* HEADER */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-end mb-5">
                <div className="mb-3 mb-md-0">
                    <h6 className="text-primary fw-bold text-uppercase small mb-1">{selamlama}, Hoş Geldiniz</h6>
                    <h2 className="fw-bold text-dark m-0">Filo Yönetim Paneli</h2>
                </div>
                <div className="bg-white px-4 py-2 rounded-pill shadow-sm border d-flex align-items-center gap-2">
                    <Calendar size={18} className="text-primary"/>
                    <span className="fw-bold text-secondary">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
            </div>
            
            {/* KARTLAR */}
            <div className="row g-4 mb-5">
                <StatCard title="Toplam Başvuru" value={stats.toplam} icon={Users} color={COLORS.primary} bgGradient="linear-gradient(135deg, #4361ee 0%, #4cc9f0 100%)" />
                <StatCard title="Onaylanan" value={stats.onayli} icon={FileCheck} color={COLORS.success} bgGradient="linear-gradient(135deg, #06d6a0 0%, #118ab2 100%)" />
                <StatCard title="Bekleyen" value={stats.bekleyen} icon={Clock} color={COLORS.warning} bgGradient="linear-gradient(135deg, #ffd166 0%, #f72585 100%)" />
                <StatCard title="Reddedilen" value={stats.reddedilen} icon={FileX} color={COLORS.danger} bgGradient="linear-gradient(135deg, #ef476f 0%, #d90429 100%)" />
            </div>

            <div className="row g-4">
                
                {/* --- SOL KOLON (Büyük Grafikler) --- */}
                <div className="col-xl-8 col-lg-7">
                    
                    {/* AYLIK GRAFİK */}
                    <div className="card border-0 shadow-sm h-100 rounded-4 mb-4 overflow-hidden">
                        <div className="card-header bg-white border-0 pt-4 ps-4 pb-0 d-flex justify-content-between align-items-center">
                            <div>
                                <h5 className="fw-bold m-0 text-dark">Yıllık İzin Trendi</h5>
                                <p className="text-muted small">Son 6 aylık başvuru yoğunluğu</p>
                            </div>
                            <div className="p-2 bg-light rounded-circle"><TrendingUp size={20} className="text-primary"/></div>
                        </div>
                        <div className="card-body ps-0" style={{height: 320}}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={aylikData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorTalep" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: COLORS.subtext, fontSize:12}} dy={10}/>
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: COLORS.subtext, fontSize:12}}/>
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: COLORS.primary, strokeWidth: 1, strokeDasharray: '5 5' }} />
                                    <Area type="monotone" dataKey="talep" stroke={COLORS.primary} strokeWidth={3} fillOpacity={1} fill="url(#colorTalep)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* İZİN TÜRÜ GRAFİĞİ */}
                    <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                        <div className="card-header bg-white border-0 pt-4 ps-4 pb-0">
                            <h5 className="fw-bold m-0 text-dark">İzin Türüne Göre Dağılım</h5>
                        </div>
                        <div className="card-body" style={{height: 300}}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={izinTurleri} barSize={40}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: COLORS.subtext, fontSize:11}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: COLORS.subtext}}/>
                                    <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8f9fa'}}/>
                                    <Bar dataKey="value" fill={COLORS.primary} radius={[10, 10, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>

                {/* --- SAĞ KOLON (Durum ve Liste) --- */}
                <div className="col-xl-4 col-lg-5">
                    
                    {/* PASTA GRAFİK */}
                    <div className="card border-0 shadow-sm rounded-4 mb-4">
                        <div className="card-header bg-white border-0 pt-4 ps-4 pb-0">
                            <h5 className="fw-bold m-0 text-dark">Başvuru Durumu</h5>
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
                                        innerRadius={70} 
                                        outerRadius={90} 
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
                            {/* Ortadaki Sayı */}
                            <div className="position-absolute top-50 start-50 translate-middle text-center">
                                <h3 className="fw-bold m-0 text-dark">{stats.toplam}</h3>
                                <small className="text-muted">Toplam</small>
                            </div>
                        </div>
                    </div>

                    {/* SON HAREKETLER LİSTESİ */}
                    <div className="card border-0 shadow-sm rounded-4 h-100">
                        <div className="card-header bg-white border-0 pt-4 ps-4 pb-2 d-flex justify-content-between align-items-center">
                            <h5 className="fw-bold m-0 d-flex align-items-center gap-2"><Activity size={20} className="text-warning"/> Son İşlemler</h5>
                            <button className="btn btn-sm btn-light rounded-pill px-3 fw-bold text-primary d-flex align-items-center gap-1" onClick={() => navigate('/dashboard/leaves')}>
                                Tümü <ArrowUpRight size={14}/>
                            </button>
                        </div>
                        <div className="card-body p-2">
                            <ul className="list-group list-group-flush">
                                {sonHareketler.map((item, index) => (
                                    <li key={index} className="list-group-item border-0 p-3 mb-2 rounded-3 hover-bg-light d-flex align-items-center justify-content-between" style={{transition: 'background 0.2s'}}>
                                        <div className="d-flex align-items-center">
                                            <div className={`rounded-circle d-flex align-items-center justify-content-center me-3 fw-bold text-white shadow-sm`} 
                                                 style={{width:40, height:40, fontSize:'14px', background: `linear-gradient(45deg, ${COLORS.primary}, #a0c4ff)`}}>
                                                {item.ad[0]}{item.soyad[0]}
                                            </div>
                                            <div>
                                                <div className="fw-bold text-dark">{item.ad} {item.soyad}</div>
                                                <div className="text-muted small">{item.izin_turu}</div>
                                            </div>
                                        </div>
                                        <div className="text-end">
                                            <span className={`badge rounded-pill px-3 py-2 fw-normal ${item.durum === 'IK_ONAYLADI' ? 'bg-success bg-opacity-10 text-success' : item.durum === 'REDDEDILDI' ? 'bg-danger bg-opacity-10 text-danger' : 'bg-warning bg-opacity-10 text-warning'}`}>
                                                {item.durum === 'IK_ONAYLADI' ? 'Onaylandı' : item.durum === 'REDDEDILDI' ? 'Reddedildi' : 'Bekliyor'}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                                {sonHareketler.length === 0 && <li className="list-group-item border-0 text-center text-muted py-4">Henüz işlem yok.</li>}
                            </ul>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}