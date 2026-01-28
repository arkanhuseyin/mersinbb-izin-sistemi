import { useState, useEffect } from 'react';
import axios from 'axios';
import { Gantt, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import { Calendar, Filter, Users, Search, Briefcase, ChevronDown } from 'lucide-react';

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

    // Arama veya Birim değiştiğinde tabloyu yeniden hesapla
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
            // İlk yüklemede çalıştır
            processGanttData(planRes.data, 'TÜMÜ', '');
        } catch (error) {
            console.error("Veri hatası:", error);
        } finally {
            setLoading(false);
        }
    };

    // Veriyi Gantt Formatına Dönüştürme
    const processGanttData = (data, birimFilter, searchFilter) => {
        let filteredData = data;

        // 1. ADMİN GİZLEME (rol_id 5 olanı listeden at)
        filteredData = filteredData.filter(item => item.rol_id !== 5);

        // 2. BİRİM FİLTRESİ
        if (birimFilter !== 'TÜMÜ') {
            filteredData = filteredData.filter(item => item.birim_adi === birimFilter);
        }

        // 3. İSİM ARAMA FİLTRESİ
        if (searchFilter) {
            const lowerTerm = searchFilter.toLowerCase();
            filteredData = filteredData.filter(item => 
                item.ad.toLowerCase().includes(lowerTerm) || 
                item.soyad.toLowerCase().includes(lowerTerm)
            );
        }

        // Personelleri Grupla
        const personelMap = {};
        
        filteredData.forEach(row => {
            if (!personelMap[row.personel_id]) {
                personelMap[row.personel_id] = {
                    id: `personel-${row.personel_id}`,
                    name: `${row.ad} ${row.soyad}`,
                    type: 'project', // Grup Başlığı
                    progress: 0,
                    isDisabled: true,
                    start: new Date(),
                    end: new Date(),
                    hideChildren: false,
                    styles: { backgroundColor: '#f8f9fa', progressColor: '#f8f9fa', backgroundSelectedColor: '#e9ecef' }
                };
            }
        });

        let ganttTasks = Object.values(personelMap);

        // İzinleri Task Olarak Ekle
        filteredData.forEach(row => {
            if (row.talep_id) { 
                // Onay Durumu Kontrolü
                const isApproved = row.durum === 'IK_ONAYLADI' || row.durum === 'TAMAMLANDI' || row.durum === 'AMIR_ONAYLADI' || row.durum === 'YAZICI_ONAYLADI';
                
                // RENK KODLAMASI
                let color = '#3b82f6'; // Varsayılan Mavi (Yıllık İzin)
                
                if (!isApproved) color = '#9ca3af'; // Onaysız (Gri)
                else if (row.izin_turu === 'RAPOR') color = '#ef4444'; // Rapor (Kırmızı)
                else if (row.izin_turu === 'MAZERET İZNİ') color = '#f59e0b'; // Mazeret (Turuncu)
                else if (row.izin_turu === 'YILLIK İZİN') color = '#10b981'; // Yıllık (Yeşil)

                // Tarihleri Date objesine çevir
                const startDate = new Date(row.baslangic_tarihi);
                const endDate = new Date(row.bitis_tarihi);
                
                // Bitiş tarihini Gantt'ta doğru göstermek için saati gün sonuna ayarla
                endDate.setHours(23, 59, 59);

                ganttTasks.push({
                    start: startDate,
                    end: endDate,
                    name: `${row.izin_turu} (${row.durum === 'TAMAMLANDI' || row.durum === 'IK_ONAYLADI' ? 'Onaylı' : 'Bekliyor'})`,
                    id: `izin-${row.talep_id}`,
                    type: 'task',
                    progress: 100,
                    project: `personel-${row.personel_id}`,
                    styles: { progressColor: color, backgroundColor: color, backgroundSelectedColor: color }
                });
            }
        });

        // Eğer hiç görev yoksa boş bir tane ekle
        if (ganttTasks.length === 0) {
            ganttTasks = [{ start: new Date(), end: new Date(), name: 'Kayıt Bulunamadı', id: 'empty', type: 'task', progress: 0, isDisabled: true }];
        }

        setTasks(ganttTasks);
    };

    return (
        <div className="container-fluid p-4">
            
            {/* ÜST BAŞLIK */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4 gap-3">
                <div>
                    <h2 className="fw-bold text-dark m-0 d-flex align-items-center gap-2">
                        <div className="bg-primary bg-opacity-10 p-2 rounded-3 text-primary">
                            <Calendar size={24}/>
                        </div>
                        Personel İzin Planlama
                    </h2>
                    <p className="text-muted small m-0 mt-1">Birimlerin doluluk oranını ve personel izin çakışmalarını yönetin.</p>
                </div>
                
                {/* Görünüm Modu Butonları */}
                <div className="bg-white p-1 rounded-3 shadow-sm border d-flex">
                    <button className={`btn btn-sm fw-medium px-3 ${viewMode === ViewMode.Month ? 'btn-primary' : 'text-muted'}`} onClick={() => setViewMode(ViewMode.Month)}>Ay</button>
                    <button className={`btn btn-sm fw-medium px-3 ${viewMode === ViewMode.Week ? 'btn-primary' : 'text-muted'}`} onClick={() => setViewMode(ViewMode.Week)}>Hafta</button>
                    <button className={`btn btn-sm fw-medium px-3 ${viewMode === ViewMode.Day ? 'btn-primary' : 'text-muted'}`} onClick={() => setViewMode(ViewMode.Day)}>Gün</button>
                </div>
            </div>

            {/* FİLTRE PANELİ */}
            <div className="card border-0 shadow-sm rounded-4 mb-4 bg-white">
                <div className="card-body p-3 row g-3 align-items-center">
                    
                    {/* Arama Kutusu */}
                    <div className="col-md-4">
                        <div className="input-group shadow-sm">
                            <span className="input-group-text bg-white border-end-0"><Search size={18} className="text-muted"/></span>
                            <input 
                                type="text" 
                                className="form-control border-start-0 ps-0" 
                                placeholder="Personel Adı Ara..." 
                                value={aramaMetni} 
                                onChange={(e) => setAramaMetni(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Birim Filtresi */}
                    <div className="col-md-4">
                        <div className="input-group shadow-sm">
                            <span className="input-group-text bg-white border-end-0"><Briefcase size={18} className="text-muted"/></span>
                            <select className="form-select border-start-0 ps-0 fw-bold text-dark" value={seciliBirim} onChange={(e) => setSeciliBirim(e.target.value)}>
                                <option value="TÜMÜ">TÜM BİRİMLER</option>
                                {birimler.map(b => (
                                    <option key={b.birim_id} value={b.birim_adi}>{b.birim_adi}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Legend (Renk Açıklamaları) */}
                    <div className="col-md-4 d-flex justify-content-md-end flex-wrap gap-2 text-small">
                        <span className="badge bg-success bg-opacity-10 text-success border border-success d-flex align-items-center gap-1"><span className="badge bg-success rounded-circle p-1"> </span> Yıllık</span>
                        <span className="badge bg-warning bg-opacity-10 text-dark border border-warning d-flex align-items-center gap-1"><span className="badge bg-warning rounded-circle p-1"> </span> Mazeret</span>
                        <span className="badge bg-danger bg-opacity-10 text-danger border border-danger d-flex align-items-center gap-1"><span className="badge bg-danger rounded-circle p-1"> </span> Rapor</span>
                        <span className="badge bg-secondary bg-opacity-10 text-secondary border d-flex align-items-center gap-1"><span className="badge bg-secondary rounded-circle p-1"> </span> Bekleyen</span>
                    </div>
                </div>
            </div>

            {/* GANTT TABLOSU */}
            <div className="card border-0 shadow-lg rounded-4 overflow-hidden bg-white">
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary mb-3"></div>
                            <h6 className="text-muted">Veriler Yükleniyor...</h6>
                        </div>
                    ) : tasks.length > 1 ? ( // 1'den büyük kontrolü (boş task harici veri varsa)
                        <div style={{overflowX: 'auto', backgroundColor: 'white'}}>
                            <Gantt
                                tasks={tasks}
                                viewMode={viewMode}
                                locale="tr"
                                columnWidth={viewMode === ViewMode.Month ? 100 : 60}
                                listCellWidth="220px" // İsim alanı genişliği
                                rowHeight={50}
                                barFill={70}
                                ganttHeight={600}
                                headerHeight={50}
                                fontFamily="'Segoe UI', sans-serif"
                                fontSize="12px"
                                tooltipContent={(task) => {
                                    if(task.type === 'project') return null;
                                    return (
                                        <div className="p-3 bg-white border border-light shadow rounded-3 text-dark" style={{minWidth:'200px'}}>
                                            <div className="d-flex align-items-center gap-2 mb-2">
                                                <Calendar size={16} className="text-primary"/>
                                                <strong className="small">{task.name}</strong>
                                            </div>
                                            <div className="small text-muted border-top pt-2">
                                                <div>Başlangıç: <span className="fw-bold text-dark">{task.start.toLocaleDateString('tr-TR')}</span></div>
                                                <div>Bitiş: <span className="fw-bold text-dark">{task.end.toLocaleDateString('tr-TR')}</span></div>
                                            </div>
                                        </div>
                                    );
                                }}
                            />
                        </div>
                    ) : (
                        <div className="text-center py-5 text-muted">
                            <div className="bg-light rounded-circle p-4 d-inline-block mb-3">
                                <Users size={48} className="opacity-25"/>
                            </div>
                            <h5>Bu kriterlere uygun kayıt bulunamadı.</h5>
                            <p className="small">Filtreleri değiştirmeyi deneyin.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}