import { useState, useEffect } from 'react';
import axios from 'axios';
import { Gantt, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import { Calendar, Filter, Users, Search, Briefcase, ChevronRight, Layout } from 'lucide-react';

const API_URL = 'https://mersinbb-izin-sistemi.onrender.com';

export default function LeavePlanning() {
    const [tasks, setTasks] = useState([]);
    const [viewMode, setViewMode] = useState(ViewMode.Month);
    const [loading, setLoading] = useState(true);
    const [birimler, setBirimler] = useState([]);
    const [seciliBirim, setSeciliBirim] = useState('TÜMÜ');
    const [aramaMetni, setAramaMetni] = useState('');
    const [rawData, setRawData] = useState([]);

    useEffect(() => {
        verileriGetir();
    }, []);

    useEffect(() => {
        if (rawData.length > 0) {
            processGanttData(rawData, seciliBirim, aramaMetni);
        }
    }, [seciliBirim, aramaMetni, rawData]);

    const verileriGetir = async () => {
        try {
            const token = localStorage.getItem('token');
            const [planRes, birimRes] = await Promise.all([
                axios.get(`${API_URL}/api/izin/planlama`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_URL}/api/personel/birimler`, { headers: { Authorization: `Bearer ${token}` } })
            ]);

            setRawData(planRes.data);
            setBirimler(birimRes.data);
            processGanttData(planRes.data, 'TÜMÜ', '');
        } catch (error) {
            console.error("Veri hatası:", error);
        } finally {
            setLoading(false);
        }
    };

    const processGanttData = (data, birimFilter, searchFilter) => {
        let filteredData = data;

        // 1. ADMIN GİZLEME (Çoklu Kontrol) 🛡️
        // rol_id 5, 1 ve Adı 'Sistem' olanları uçuruyoruz.
        filteredData = filteredData.filter(item => {
            const rid = Number(item.rol_id); 
            const ad = (item.ad || '').toLowerCase();
            return rid !== 5 && rid !== 1 && ad !== 'sistem'; 
        });

        // 2. BİRİM FİLTRESİ
        if (birimFilter !== 'TÜMÜ') {
            filteredData = filteredData.filter(item => item.birim_adi === birimFilter);
        }

        // 3. ARAMA FİLTRESİ
        if (searchFilter) {
            const lower = searchFilter.toLowerCase();
            filteredData = filteredData.filter(item => 
                (item.ad + ' ' + item.soyad).toLowerCase().includes(lower)
            );
        }

        const personelMap = {};
        
        filteredData.forEach(row => {
            if (!personelMap[row.personel_id]) {
                personelMap[row.personel_id] = {
                    id: `personel-${row.personel_id}`,
                    name: `${row.ad} ${row.soyad}`,
                    type: 'project', 
                    progress: 0,
                    isDisabled: true,
                    start: new Date(), // Göstermelik tarih
                    end: new Date(),
                    hideChildren: false,
                    // Kurumsal Başlık Stili
                    styles: { 
                        backgroundColor: '#f8f9fa', 
                        progressColor: '#f8f9fa', 
                        backgroundSelectedColor: '#e9ecef',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#333'
                    }
                };
            }
        });

        let ganttTasks = Object.values(personelMap);

        filteredData.forEach(row => {
            if (row.talep_id) { 
                const isApproved = row.durum === 'IK_ONAYLADI' || row.durum === 'TAMAMLANDI' || row.durum === 'AMIR_ONAYLADI' || row.durum === 'YAZICI_ONAYLADI';
                
                // Profesyonel Renk Paleti
                let color = '#3b82f6'; // Mavi (Yıllık)
                let label = 'Yıllık İzin';

                if (!isApproved) { color = '#9ca3af'; label = 'Onay Bekliyor'; }
                else if (row.izin_turu === 'RAPOR') { color = '#ef4444'; label = 'Raporlu'; }
                else if (row.izin_turu === 'MAZERET İZNİ') { color = '#f59e0b'; label = 'Mazeret'; }
                else if (row.izin_turu === 'YILLIK İZİN') { color = '#10b981'; label = 'Yıllık İzin'; }

                const startDate = new Date(row.baslangic_tarihi);
                const endDate = new Date(row.bitis_tarihi);
                endDate.setHours(23, 59, 59); // Bitiş gününü tam kaplasın

                ganttTasks.push({
                    start: startDate,
                    end: endDate,
                    name: label, // Barın üzerinde yazacak yazı
                    id: `izin-${row.talep_id}`,
                    type: 'task',
                    progress: 100,
                    project: `personel-${row.personel_id}`,
                    styles: { progressColor: color, backgroundColor: color, backgroundSelectedColor: color, borderRadius: '4px' }
                });
            }
        });

        if (ganttTasks.length === 0) {
            ganttTasks = [{ start: new Date(), end: new Date(), name: 'Kayıt Bulunamadı', id: 'empty', type: 'task', progress: 0, isDisabled: true }];
        }

        setTasks(ganttTasks);
    };

    return (
        <div className="container-fluid p-4 bg-light" style={{minHeight: '100vh'}}>
            
            {/* --- 1. ÜST PANEL (HEADER) --- */}
            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center mb-4 gap-3 bg-white p-4 rounded-4 shadow-sm border">
                <div>
                    <h2 className="fw-bold text-dark m-0 d-flex align-items-center gap-2">
                        <div className="bg-primary bg-opacity-10 p-2 rounded-3 text-primary">
                            <Layout size={28}/>
                        </div>
                        Personel Planlama Merkezi
                    </h2>
                    <p className="text-muted small m-0 mt-1 ps-1">Tüm birimlerin izin ve vardiya durumunu tek ekrandan yönetin.</p>
                </div>
                
                {/* GÖRÜNÜM MODU SEÇİCİSİ */}
                <div className="d-flex bg-light p-1 rounded-3 border">
                    <button className={`btn btn-sm fw-bold px-4 rounded-3 transition-all ${viewMode === ViewMode.Month ? 'btn-white shadow-sm text-primary' : 'text-muted'}`} onClick={() => setViewMode(ViewMode.Month)}>Ay</button>
                    <button className={`btn btn-sm fw-bold px-4 rounded-3 transition-all ${viewMode === ViewMode.Week ? 'btn-white shadow-sm text-primary' : 'text-muted'}`} onClick={() => setViewMode(ViewMode.Week)}>Hafta</button>
                    <button className={`btn btn-sm fw-bold px-4 rounded-3 transition-all ${viewMode === ViewMode.Day ? 'btn-white shadow-sm text-primary' : 'text-muted'}`} onClick={() => setViewMode(ViewMode.Day)}>Gün</button>
                </div>
            </div>

            {/* --- 2. FİLTRE VE ARAMA KARTI --- */}
            <div className="card border-0 shadow-sm rounded-4 mb-4 bg-white">
                <div className="card-body p-3 row g-3 align-items-center">
                    
                    {/* Arama */}
                    <div className="col-md-3">
                        <div className="input-group input-group-lg border rounded-3 overflow-hidden bg-light">
                            <span className="input-group-text bg-transparent border-0"><Search size={20} className="text-muted"/></span>
                            <input 
                                type="text" 
                                className="form-control border-0 bg-transparent shadow-none" 
                                placeholder="Personel Ara..." 
                                style={{fontSize: '0.95rem'}}
                                value={aramaMetni} 
                                onChange={(e) => setAramaMetni(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Birim Filtresi */}
                    <div className="col-md-3">
                        <div className="input-group input-group-lg border rounded-3 overflow-hidden bg-light">
                            <span className="input-group-text bg-transparent border-0"><Briefcase size={20} className="text-muted"/></span>
                            <select 
                                className="form-select border-0 bg-transparent shadow-none fw-medium cursor-pointer" 
                                value={seciliBirim} 
                                onChange={(e) => setSeciliBirim(e.target.value)}
                                style={{fontSize: '0.95rem'}}
                            >
                                <option value="TÜMÜ">TÜM BİRİMLER</option>
                                {birimler.map(b => (
                                    <option key={b.birim_id} value={b.birim_adi}>{b.birim_adi}</option>
                                ))}
                            </select>
                            <span className="input-group-text bg-transparent border-0"><ChevronDownIcon size={16} className="text-muted"/></span>
                        </div>
                    </div>

                    {/* Lejant (Bilgi) */}
                    <div className="col-md-6 d-flex justify-content-md-end align-items-center gap-2 flex-wrap">
                        <span className="badge bg-success bg-opacity-10 text-success border border-success d-flex align-items-center gap-1 px-3 py-2 rounded-pill"><span className="badge bg-success rounded-circle p-1"> </span> Yıllık İzin</span>
                        <span className="badge bg-warning bg-opacity-10 text-dark border border-warning d-flex align-items-center gap-1 px-3 py-2 rounded-pill"><span className="badge bg-warning rounded-circle p-1"> </span> Mazeret</span>
                        <span className="badge bg-danger bg-opacity-10 text-danger border border-danger d-flex align-items-center gap-1 px-3 py-2 rounded-pill"><span className="badge bg-danger rounded-circle p-1"> </span> Rapor</span>
                        <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary d-flex align-items-center gap-1 px-3 py-2 rounded-pill"><span className="badge bg-secondary rounded-circle p-1"> </span> Bekleyen</span>
                    </div>
                </div>
            </div>

            {/* --- 3. GANTT TABLOSU (Responsive Wrapper) --- */}
            <div className="card border-0 shadow-lg rounded-4 overflow-hidden bg-white">
                <div className="card-body p-0">
                    {loading ? (
                        <div className="d-flex flex-column align-items-center justify-content-center py-5">
                            <div className="spinner-border text-primary mb-3" role="status"></div>
                            <h6 className="text-muted fw-bold">Veriler Yükleniyor...</h6>
                        </div>
                    ) : tasks.length > 1 ? (
                        /* 🔥 BURASI RESPONSIVE SORUNUNU ÇÖZEN YER 🔥 */
                        <div style={{
                            overflowX: 'auto', 
                            backgroundColor: 'white',
                            borderBottomLeftRadius: '16px',
                            borderBottomRightRadius: '16px'
                        }}>
                            {/* minWidth vererek içeriğin sıkışmasını engelliyoruz, scroll çıkıyor */}
                            <div style={{ minWidth: '1200px' }}> 
                                <Gantt
                                    tasks={tasks}
                                    viewMode={viewMode}
                                    locale="tr"
                                    
                                    /* GÖRÜNÜM AYARLARI */
                                    columnWidth={viewMode === ViewMode.Month ? 120 : 65} // Ay modunda sütunları genişlettim
                                    listCellWidth="250px" // İsim alanı genişliği
                                    rowHeight={55}
                                    barFill={70}
                                    ganttHeight={650}
                                    headerHeight={60}
                                    
                                    fontFamily="'Segoe UI', 'Roboto', sans-serif"
                                    fontSize="13px"
                                    
                                    /* TOOLTIP (Üzerine gelince çıkan kutu) */
                                    tooltipContent={(task) => {
                                        if(task.type === 'project') return null;
                                        return (
                                            <div className="p-3 bg-white border border-secondary border-opacity-10 shadow-lg rounded-3 text-dark" style={{minWidth:'220px', zIndex: 9999}}>
                                                <div className="d-flex align-items-center gap-2 mb-2 pb-2 border-bottom">
                                                    <Calendar size={18} className="text-primary"/>
                                                    <strong className="fw-bold">{task.name}</strong>
                                                </div>
                                                <div className="small text-muted d-flex flex-column gap-1">
                                                    <div className="d-flex justify-content-between"><span>Başlangıç:</span> <span className="fw-bold text-dark">{task.start.toLocaleDateString('tr-TR')}</span></div>
                                                    <div className="d-flex justify-content-between"><span>Bitiş:</span> <span className="fw-bold text-dark">{task.end.toLocaleDateString('tr-TR')}</span></div>
                                                </div>
                                            </div>
                                        );
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-5">
                            <div className="bg-light rounded-circle p-4 d-inline-block mb-3">
                                <Users size={48} className="text-secondary opacity-50"/>
                            </div>
                            <h5 className="fw-bold text-dark">Kayıt Bulunamadı</h5>
                            <p className="text-muted small">Seçtiğiniz filtrelere uygun personel veya izin kaydı yok.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Küçük ikon bileşeni
function ChevronDownIcon({size, className}) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6"/></svg>
    );
}