import { useState, useEffect } from 'react';
import axios from 'axios';
import { Gantt, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
// Tarih işlemleri için date-fns kütüphanesini kullanıyoruz (React projelerinde standarttır)
import { startOfMonth, endOfMonth, format, addMonths, tr } from 'date-fns'; 
import { Calendar, Filter, Users, Search, Briefcase, ChevronLeft, ChevronRight } from 'lucide-react';

const API_URL = 'https://mersinbb-izin-sistemi.onrender.com';

// 🎨 PROFESYONEL RENK PALETİ
const COLORS = {
    APPROVED_ANNUAL: '#10b981', // Yeşil (Onaylı Yıllık)
    APPROVED_OTHER: '#3b82f6',  // Mavi (Onaylı Diğer - Mazeret vs.)
    PENDING: '#f59e0b',         // Turuncu (Bekleyen)
    SICK_LEAVE: '#ef4444',      // Kırmızı (Rapor)
    TEXT_DARK: '#1f2937',
    BG_LIGHT: '#f3f4f6',
    BORDER: '#e5e7eb'
};

export default function LeavePlanning() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [birimler, setBirimler] = useState([]);
    
    // FİLTRELER
    const [seciliBirim, setSeciliBirim] = useState('TÜMÜ');
    const [aramaMetni, setAramaMetni] = useState('');
    
    // TARİH YÖNETİMİ (Varsayılan: Bugünün olduğu ay)
    const [currentMonth, setCurrentMonth] = useState(new Date());
    
    const [rawData, setRawData] = useState([]);

    useEffect(() => {
        verileriGetir();
    }, []);

    // Filtreler veya Ay değiştiğinde tabloyu güncelle
    useEffect(() => {
        if (rawData.length > 0) {
            processGanttData(rawData, seciliBirim, aramaMetni, currentMonth);
        }
    }, [seciliBirim, aramaMetni, currentMonth, rawData]);

    const verileriGetir = async () => {
        try {
            const token = localStorage.getItem('token');
            const [planRes, birimRes] = await Promise.all([
                axios.get(`${API_URL}/api/izin/planlama`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_URL}/api/personel/birimler`, { headers: { Authorization: `Bearer ${token}` } })
            ]);

            setRawData(planRes.data);
            setBirimler(birimRes.data);
            // İlk açılışta veriyi işle
            processGanttData(planRes.data, 'TÜMÜ', '', currentMonth);
        } catch (error) {
            console.error("Veri hatası:", error);
        } finally {
            setLoading(false);
        }
    };

    // Ay Değiştirme Fonksiyonu
    const handleMonthChange = (direction) => {
        setCurrentMonth(prev => addMonths(prev, direction));
    };

    // Veriyi İşleme ve Gantt Formatına Çevirme
    const processGanttData = (data, birimFilter, searchFilter, selectedMonth) => {
        let filteredData = data;

        // 1. GÜVENLİK FİLTRESİ (Admin ve Sistem hesaplarını gizle)
        filteredData = filteredData.filter(item => {
            const rid = Number(item.rol_id);
            const ad = (item.ad || '').toLowerCase();
            return rid !== 5 && rid !== 1 && ad !== 'sistem';
        });

        // 2. KULLANICI FİLTRELERİ
        if (birimFilter !== 'TÜMÜ') {
            filteredData = filteredData.filter(item => item.birim_adi === birimFilter);
        }
        if (searchFilter) {
            const lower = searchFilter.toLowerCase();
            filteredData = filteredData.filter(item => (item.ad + ' ' + item.soyad).toLowerCase().includes(lower));
        }

        // 3. GANTT VERİSİNİ OLUŞTUR
        const personelMap = {};
        const ganttTasks = [];

        // Seçili ayın başı ve sonu (Gantt sınırları için)
        const monthStart = startOfMonth(selectedMonth);
        const monthEnd = endOfMonth(selectedMonth);

        filteredData.forEach(row => {
            // Personel Ana Satırını Oluştur (Eğer yoksa)
            if (!personelMap[row.personel_id]) {
                personelMap[row.personel_id] = true;
                ganttTasks.push({
                    id: `p-${row.personel_id}`,
                    name: row.ad + ' ' + row.soyad, // Sol sütunda görünecek isim
                    type: 'project',
                    progress: 0,
                    hideChildren: false,
                    isDisabled: true,
                    start: monthStart, // Mecburi alanlar, görüntüde etkisi yok
                    end: monthEnd,
                    // Sol sütun stili (İsim ve Unvan)
                    styles: { 
                        backgroundColor: '#ffffff',
                        backgroundSelectedColor: '#f9fafb',
                        textColor: COLORS.TEXT_DARK,
                        fontWeight: '600',
                        fontSize: '14px'
                    },
                    // Özel bir alan ekleyip bunu render ederken kullanacağız
                    unvan: row.unvan || row.gorev || 'Personel' 
                });
            }

            // İzin Barını Oluştur (Task)
            if (row.talep_id) {
                const startDate = new Date(row.baslangic_tarihi);
                const endDate = new Date(row.bitis_tarihi);
                endDate.setHours(23, 59, 59); // Günün sonuna kadar

                // Sadece seçili ayın içine düşen veya kesişen izinleri göster
                if (endDate < monthStart || startDate > monthEnd) return;

                const isApproved = ['IK_ONAYLADI', 'TAMAMLANDI', 'AMIR_ONAYLADI'].includes(row.durum);
                const isSick = row.izin_turu === 'RAPOR';

                // RENK BELİRLEME
                let barColor = COLORS.PENDING; // Varsayılan: Bekleyen (Turuncu)
                let label = 'Bekliyor';

                if (isApproved) {
                    if (isSick) { barColor = COLORS.SICK_LEAVE; label = 'Raporlu'; }
                    else if (row.izin_turu === 'YILLIK İZİN') { barColor = COLORS.APPROVED_ANNUAL; label = 'Yıllık İzin'; }
                    else { barColor = COLORS.APPROVED_OTHER; label = row.izin_turu; }
                } else if (isSick) {
                     barColor = COLORS.SICK_LEAVE; label = 'Rapor (Bekliyor)';
                }

                ganttTasks.push({
                    id: `t-${row.talep_id}`,
                    name: label, // Barın üzerindeki yazı
                    type: 'task',
                    project: `p-${row.personel_id}`, // Hangi personele ait
                    start: startDate < monthStart ? monthStart : startDate, // Ayın dışına taşıyorsa kırp
                    end: endDate > monthEnd ? monthEnd : endDate,
                    progress: 100,
                    styles: { 
                        backgroundColor: barColor, 
                        progressColor: barColor, 
                        backgroundSelectedColor: barColor,
                        borderRadius: '4px',
                        border: `1px solid ${barColor}`
                    },
                    // Tooltip için detay veriler
                    detay: { tur: row.izin_turu, durum: row.durum, gun: row.kac_gun, baslangic: startDate, bitis: endDate }
                });
            }
        });

        setTasks(ganttTasks);
    };

    // Sol Sütun Özel Render (İsim + Unvan)
    const CustomTaskListHeader = ({ headerHeight, fontFamily, fontSize, rowWidth }) => {
        return (
            <div style={{ height: headerHeight, fontFamily, fontSize, width: rowWidth, display: 'flex', alignItems: 'center', paddingLeft: '16px', fontWeight: 'bold', borderBottom: `1px solid ${COLORS.BORDER}`, backgroundColor: '#f9fafb' }}>
                PERSONEL LİSTESİ
            </div>
        );
    };

    const CustomTaskListTable = ({ tasks, rowHeight, rowWidth, fontFamily, fontSize, onExpanderClick }) => {
        return (
            <div style={{ borderRight: `1px solid ${COLORS.BORDER}` }}>
                {tasks.map((task) => {
                    // Sadece personel satırlarını (type: project) sol tarafa render et
                    if (task.type !== 'project') return null;
                    return (
                        <div 
                            key={task.id}
                            style={{ height: rowHeight, width: rowWidth, fontFamily, fontSize, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: '16px', borderBottom: `1px solid ${COLORS.BORDER}`, backgroundColor: 'white', cursor: 'pointer' }}
                            onClick={() => onExpanderClick(task)}
                        >
                            <div className="text-dark fw-bold">{task.name}</div>
                            <div className="text-muted small" style={{fontSize: '11px'}}>{task.unvan}</div>
                        </div>
                    );
                })}
            </div>
        );
    };


    return (
        <div className="container-fluid p-0 bg-light" style={{ minHeight: '100vh' }}>
            
            {/* --- ÜST PANEL (Header & Tarih Seçici) --- */}
            <div className="bg-white border-bottom px-4 py-3 d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
                <div>
                    <h2 className="fw-bold text-dark m-0 d-flex align-items-center gap-2">
                        <Calendar className="text-primary" size={26}/>
                        İzin Planlama Takvimi
                    </h2>
                    <p className="text-muted small m-0">Personel izinlerini aylık bazda görüntüleyin ve yönetin.</p>
                </div>

                {/* TARİH NAVİGASYONU (OCAK 2026) */}
                <div className="d-flex align-items-center bg-light rounded-pill border p-1 shadow-sm">
                    <button className="btn btn-light rounded-circle p-2 border-0 hover-shadow" onClick={() => handleMonthChange(-1)}>
                        <ChevronLeft size={20} color={COLORS.TEXT_DARK}/>
                    </button>
                    <div className="mx-4 fw-bolder text-dark fs-5" style={{minWidth: '160px', textAlign: 'center', letterSpacing: '1px'}}>
                        {format(currentMonth, 'MMMM yyyy', { locale: tr }).toUpperCase()}
                    </div>
                    <button className="btn btn-light rounded-circle p-2 border-0 hover-shadow" onClick={() => handleMonthChange(1)}>
                        <ChevronRight size={20} color={COLORS.TEXT_DARK}/>
                    </button>
                </div>
            </div>

            <div className="p-4">
                {/* --- FİLTRE KARTI --- */}
                <div className="card border-0 shadow-sm rounded-4 mb-4 bg-white">
                    <div className="card-body p-3 row g-3 align-items-center">
                        {/* Arama */}
                        <div className="col-md-3">
                            <div className="input-group border rounded-3 bg-light">
                                <span className="input-group-text bg-transparent border-0"><Search size={18} className="text-muted"/></span>
                                <input type="text" className="form-control border-0 bg-transparent shadow-none" placeholder="Personel Ara..." value={aramaMetni} onChange={(e) => setAramaMetni(e.target.value)}/>
                            </div>
                        </div>
                        {/* Birim Filtresi */}
                        <div className="col-md-3">
                            <div className="input-group border rounded-3 bg-light">
                                <span className="input-group-text bg-transparent border-0"><Briefcase size={18} className="text-muted"/></span>
                                <select className="form-select border-0 bg-transparent shadow-none fw-medium" value={seciliBirim} onChange={(e) => setSeciliBirim(e.target.value)}>
                                    <option value="TÜMÜ">TÜM BİRİMLER</option>
                                    {birimler.map(b => (<option key={b.birim_id} value={b.birim_adi}>{b.birim_adi}</option>))}
                                </select>
                            </div>
                        </div>
                        {/* Lejant */}
                        <div className="col-md-6 d-flex justify-content-md-end gap-3 text-small">
                            <div className="d-flex align-items-center gap-2"><span className="rounded-circle" style={{width:10, height:10, backgroundColor: COLORS.APPROVED_ANNUAL}}></span> Yıllık (Onaylı)</div>
                            <div className="d-flex align-items-center gap-2"><span className="rounded-circle" style={{width:10, height:10, backgroundColor: COLORS.SICK_LEAVE}}></span> Rapor</div>
                            <div className="d-flex align-items-center gap-2"><span className="rounded-circle" style={{width:10, height:10, backgroundColor: COLORS.PENDING}}></span> Bekleyen</div>
                        </div>
                    </div>
                </div>

                {/* --- GANTT TAKVİMİ --- */}
                <div className="card border-0 shadow-lg rounded-4 overflow-hidden bg-white" style={{ minHeight: '600px' }}>
                    {loading ? (
                        <div className="text-center py-5 my-auto"><div className="spinner-border text-primary mb-2"></div><div>Yükleniyor...</div></div>
                    ) : tasks.length > 0 && tasks.some(t => t.type === 'project') ? (
                        <Gantt
                            tasks={tasks}
                            viewMode={ViewMode.Day} // Her zaman gün bazlı göster (Aylık görünüm içinde)
                            locale="tr"
                            
                            // Görünüm Ayarları
                            columnWidth={50} // Gün sütunlarının genişliği
                            listCellWidth="220px" // Sol sütun genişliği
                            rowHeight={60} // Satır yüksekliği (İsim+Unvan için)
                            ganttHeight={650}
                            headerHeight={50}
                            barCornerRadius={4}
                            barFill={85} // Bar yüksekliği yüzdesi
                            todayColor="rgba(59, 130, 246, 0.1)" // Bugünün rengi

                            // Özel Sol Sütun Renderları
                            TaskListHeader={CustomTaskListHeader}
                            TaskListTable={CustomTaskListTable}

                            // Tooltip (Üzerine gelince çıkan kutu)
                            tooltipContent={(task) => {
                                if(!task.detay) return null;
                                return (
                                    <div className="p-3 bg-white rounded-3 shadow-lg border" style={{minWidth: '200px', borderColor: task.styles.backgroundColor}}>
                                        <h6 className="fw-bold mb-2" style={{color: task.styles.backgroundColor}}>{task.name}</h6>
                                        <div className="small text-muted border-top pt-2 vstack gap-1">
                                            <div className="d-flex justify-content-between"><span>Süre:</span> <span className="fw-bold text-dark">{task.detay.gun} Gün</span></div>
                                            <div className="d-flex justify-content-between"><span>Başlangıç:</span> <span className="fw-bold text-dark">{format(task.detay.baslangic, 'dd.MM.yyyy')}</span></div>
                                            <div className="d-flex justify-content-between"><span>Bitiş:</span> <span className="fw-bold text-dark">{format(task.detay.bitis, 'dd.MM.yyyy')}</span></div>
                                            <div className="d-flex justify-content-between mt-1"><span>Durum:</span> <span className="badge bg-light text-dark border">{task.detay.durum}</span></div>
                                        </div>
                                    </div>
                                );
                            }}
                        />
                    ) : (
                        <div className="text-center py-5 my-auto text-muted">
                            <Users size={48} className="opacity-25 mb-3"/>
                            <h5>Bu ay için görüntülenecek kayıt yok.</h5>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}