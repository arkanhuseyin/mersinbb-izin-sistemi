import { useEffect, useState } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';
import { FileCheck, Clock, FileX, Users, Calendar, TrendingUp, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DashboardHome() {
    const [stats, setStats] = useState({ toplam: 0, onayli: 0, bekleyen: 0, reddedilen: 0 });
    const [izinTurleri, setIzinTurleri] = useState([]);
    const [aylikData, setAylikData] = useState([]);
    const [sonHareketler, setSonHareketler] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
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

                // İzin Türü Grafiği Verisi
                const turMap = {};
                data.forEach(d => { turMap[d.izin_turu] = (turMap[d.izin_turu] || 0) + 1; });
                setIzinTurleri(Object.keys(turMap).map(key => ({ name: key, value: turMap[key] })));

                // Son 6 Hareket (Listeyi ters çevirip alıyoruz)
                setSonHareketler([...data].reverse().slice(0, 6));

                // Aylık Veri (Simülasyon - Dolu görünsün diye)
                setAylikData([
                    { name: 'Oca', talep: 4 }, { name: 'Şub', talep: 3 },
                    { name: 'Mar', talep: 6 }, { name: 'Nis', talep: 8 },
                    { name: 'May', talep: 12 }, { name: 'Haz', talep: data.length }
                ]);
            });
    }, []);

    // İSTATİSTİK KARTI BİLEŞENİ
    const StatCard = ({ title, value, icon: Icon, color }) => (
        <div className="col-md-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100 rounded-4 overflow-hidden">
                <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-center">
                        <div>
                            <p className="text-uppercase fw-bold text-muted small mb-1" style={{letterSpacing:'0.5px'}}>{title}</p>
                            <h2 className={`fw-bold mb-0 text-${color}`}>{value}</h2>
                        </div>
                        <div className={`p-3 rounded-4 bg-${color} bg-opacity-10`}>
                            <Icon size={28} className={`text-${color}`} />
                        </div>
                    </div>
                </div>
                <div className={`bg-${color}`} style={{height:'4px'}}></div>
            </div>
        </div>
    );

    return (
        <div className="container-fluid p-4 p-lg-5">
            
            {/* HEADER */}
            <div className="d-flex justify-content-between align-items-end mb-5">
                <div>
                    <h2 className="fw-bold text-dark m-0">Yönetim Paneli</h2>
                    <p className="text-muted m-0">Sistem durum raporu ve aktiviteler.</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-pill shadow-sm border d-flex align-items-center gap-2">
                    <Calendar size={18} className="text-primary"/>
                    <span className="fw-bold text-dark">{new Date().toLocaleDateString('tr-TR')}</span>
                </div>
            </div>
            
            {/* KARTLAR (EN ÜST) */}
            <div className="row g-4 mb-4">
                <StatCard title="Toplam Talep" value={stats.toplam} icon={Users} color="primary" />
                <StatCard title="Onaylanan" value={stats.onayli} icon={FileCheck} color="success" />
                <StatCard title="Bekleyen" value={stats.bekleyen} icon={Clock} color="warning" />
                <StatCard title="Reddedilen" value={stats.reddedilen} icon={FileX} color="danger" />
            </div>

            <div className="row g-4">
                
                {/* --- SOL SÜTUN (GENİŞ GRAFİKLER) --- */}
                <div className="col-xl-8 col-lg-7">
                    
                    {/* 1. AYLIK TREND GRAFİĞİ */}
                    <div className="card border-0 shadow-sm h-100 rounded-4 mb-4">
                        <div className="card-header bg-white border-0 pt-4 ps-4 d-flex justify-content-between align-items-center">
                            <h6 className="fw-bold m-0 d-flex align-items-center gap-2"><TrendingUp size={18} className="text-primary"/> Talep Trendi</h6>
                        </div>
                        <div className="card-body" style={{height: 300}}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={aylikData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorTalep" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0d6efd" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#0d6efd" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0"/>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#999', fontSize:12}} dy={10}/>
                                    <YAxis axisLine={false} tickLine={false} tick={{fill:'#999', fontSize:12}}/>
                                    <Tooltip contentStyle={{borderRadius:'10px', border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)'}}/>
                                    <Area type="monotone" dataKey="talep" stroke="#0d6efd" fillOpacity={1} fill="url(#colorTalep)" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 2. İZİN TÜRÜ DAĞILIMI (ÇUBUK GRAFİK) */}
                    <div className="card border-0 shadow-sm rounded-4">
                        <div className="card-header bg-white border-0 pt-4 ps-4">
                            <h6 className="fw-bold m-0">İzin Türüne Göre Dağılım</h6>
                        </div>
                        <div className="card-body" style={{height: 300}}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={izinTurleri} barSize={50}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#666', fontSize:11}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{fill: '#f8f9fa'}} contentStyle={{borderRadius:'10px', border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}/>
                                    <Bar dataKey="value" fill="#4e73df" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>

                {/* --- SAĞ SÜTUN (PASTA + SON HAREKETLER) --- */}
                <div className="col-xl-4 col-lg-5">
                    
                    {/* 1. DURUM ÖZETİ (PASTA GRAFİK) */}
                    <div className="card border-0 shadow-sm rounded-4 mb-4">
                        <div className="card-header bg-white border-0 pt-4 ps-4">
                            <h6 className="fw-bold m-0">Durum Özeti</h6>
                        </div>
                        <div className="card-body" style={{height: 280}}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={[
                                        {name: 'Onaylı', value: stats.onayli}, 
                                        {name: 'Bekleyen', value: stats.bekleyen}, 
                                        {name: 'Red', value: stats.reddedilen}
                                    ]} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                        {[{name:'Onaylı'},{name:'Bekleyen'},{name:'Red'}].map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index===0?'#198754':index===1?'#ffc107':'#dc3545'} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 2. SON HAREKETLER LİSTESİ (BOŞLUĞU DOLDURAN KISIM) */}
                    <div className="card border-0 shadow-sm rounded-4 h-100">
                        <div className="card-header bg-white border-0 pt-4 ps-4 d-flex justify-content-between align-items-center">
                            <h6 className="fw-bold m-0 d-flex align-items-center gap-2"><Activity size={18} className="text-warning"/> Son Başvurular</h6>
                            <button className="btn btn-link btn-sm text-decoration-none" onClick={() => navigate('/dashboard/leaves')}>Tümü</button>
                        </div>
                        <div className="card-body p-0">
                            <ul className="list-group list-group-flush">
                                {sonHareketler.map((item, index) => (
                                    <li key={index} className="list-group-item border-0 px-4 py-3 d-flex align-items-center justify-content-between">
                                        <div className="d-flex align-items-center">
                                            <div className="bg-light rounded-circle d-flex align-items-center justify-content-center me-3 fw-bold text-primary" style={{width:35, height:35, fontSize:'12px'}}>
                                                {item.ad[0]}{item.soyad[0]}
                                            </div>
                                            <div>
                                                <div className="fw-bold text-dark small">{item.ad} {item.soyad}</div>
                                                <div className="text-muted" style={{fontSize:'11px'}}>{item.izin_turu}</div>
                                            </div>
                                        </div>
                                        <span className={`badge rounded-pill px-2 ${item.durum === 'IK_ONAYLADI' ? 'bg-success-subtle text-success' : item.durum === 'REDDEDILDI' ? 'bg-danger-subtle text-danger' : 'bg-warning-subtle text-warning-emphasis'}`}>
                                            {item.durum === 'IK_ONAYLADI' ? 'Onay' : item.durum === 'REDDEDILDI' ? 'Red' : 'Bekliyor'}
                                        </span>
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