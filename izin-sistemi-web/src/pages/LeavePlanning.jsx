import { useState, useEffect } from 'react';
import axios from 'axios';
import { Gantt, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import { Calendar, Filter, Users } from 'lucide-react';

const API_URL = 'https://mersinbb-izin-sistemi.onrender.com';

export default function LeavePlanning() {
    const [tasks, setTasks] = useState([]);
    const [viewMode, setViewMode] = useState(ViewMode.Month);
    const [loading, setLoading] = useState(true);
    const [birimler, setBirimler] = useState([]);
    const [seciliBirim, setSeciliBirim] = useState('TÜMÜ');
    const [rawData, setRawData] = useState([]);

    useEffect(() => {
        verileriGetir();
    }, []);

    const verileriGetir = async () => {
        try {
            const token = localStorage.getItem('token');
            const [planRes, birimRes] = await Promise.all([
                axios.get(`${API_URL}/api/izin/planlama`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_URL}/api/personel/birimler`, { headers: { Authorization: `Bearer ${token}` } })
            ]);

            setRawData(planRes.data);
            setBirimler(birimRes.data);
            processGanttData(planRes.data, 'TÜMÜ');
        } catch (error) {
            console.error("Veri hatası:", error);
        } finally {
            setLoading(false);
        }
    };

    // Veriyi Gantt Formatına Dönüştürme
    const processGanttData = (data, birimFilter) => {
        let filteredData = data;
        if (birimFilter !== 'TÜMÜ') {
            filteredData = data.filter(item => item.birim_adi === birimFilter);
        }

        // Personelleri Grupla (Aynı personelin birden çok izni olabilir)
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
                    hideChildren: false
                };
            }
        });

        let ganttTasks = Object.values(personelMap);

        // İzinleri Task Olarak Ekle
        filteredData.forEach(row => {
            if (row.talep_id) { // Eğer personelin izni varsa
                const isApproved = row.durum === 'IK_ONAYLADI' || row.durum === 'TAMAMLANDI' || row.durum === 'AMIR_ONAYLADI' || row.durum === 'YAZICI_ONAYLADI';
                
                // RENK KODLAMASI: Kırmızı (Onaylı/Kullanılan), Sarı (Bekleyen)
                const color = isApproved ? '#ef4444' : '#f59e0b'; 

                ganttTasks.push({
                    start: new Date(row.baslangic_tarihi),
                    end: new Date(row.bitis_tarihi),
                    name: `${row.izin_turu} (${row.durum})`,
                    id: `izin-${row.talep_id}`,
                    type: 'task',
                    progress: 100,
                    project: `personel-${row.personel_id}`, // Hangi personele ait olduğu
                    styles: { progressColor: color, backgroundColor: color, backgroundSelectedColor: color }
                });
            }
        });

        // Eğer hiç görev yoksa boş bir tane ekle ki hata vermesin
        if (ganttTasks.length === 0) {
            ganttTasks = [{ start: new Date(), end: new Date(), name: 'Veri Yok', id: 'empty', type: 'task', progress: 0, isDisabled: true }];
        }

        setTasks(ganttTasks);
    };

    const handleBirimChange = (e) => {
        const val = e.target.value;
        setSeciliBirim(val);
        processGanttData(rawData, val);
    };

    return (
        <div className="container-fluid p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="fw-bold text-dark m-0 d-flex align-items-center gap-2">
                    <Calendar className="text-primary"/> İzin Planlama (Gantt)
                </h2>
                
                <div className="d-flex gap-3">
                    {/* Görünüm Modu */}
                    <div className="btn-group shadow-sm">
                        <button className={`btn btn-sm ${viewMode === ViewMode.Month ? 'btn-primary' : 'btn-white border'}`} onClick={() => setViewMode(ViewMode.Month)}>Ay</button>
                        <button className={`btn btn-sm ${viewMode === ViewMode.Week ? 'btn-primary' : 'btn-white border'}`} onClick={() => setViewMode(ViewMode.Week)}>Hafta</button>
                        <button className={`btn btn-sm ${viewMode === ViewMode.Day ? 'btn-primary' : 'btn-white border'}`} onClick={() => setViewMode(ViewMode.Day)}>Gün</button>
                    </div>
                </div>
            </div>

            {/* FİLTRE ALANI */}
            <div className="card border-0 shadow-sm rounded-4 mb-4">
                <div className="card-body p-3 d-flex align-items-center gap-3">
                    <Filter size={20} className="text-muted"/>
                    <select className="form-select border-0 bg-light fw-bold" style={{maxWidth: '300px'}} value={seciliBirim} onChange={handleBirimChange}>
                        <option value="TÜMÜ">TÜM BİRİMLER</option>
                        {birimler.map(b => (
                            <option key={b.birim_id} value={b.birim_adi}>{b.birim_adi}</option>
                        ))}
                    </select>
                    <div className="ms-auto d-flex gap-3 small fw-bold">
                        <span className="d-flex align-items-center gap-1"><span className="badge bg-danger rounded-circle p-1"> </span> Onaylı/Kullanılan</span>
                        <span className="d-flex align-items-center gap-1"><span className="badge bg-warning rounded-circle p-1"> </span> Talep Edilen</span>
                    </div>
                </div>
            </div>

            {/* GANTT ŞEMASI */}
            <div className="card border-0 shadow-lg rounded-4 overflow-hidden bg-white">
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">Yükleniyor...</div>
                    ) : tasks.length > 0 ? (
                        <div style={{overflowX: 'auto'}}>
                            <Gantt
                                tasks={tasks}
                                viewMode={viewMode}
                                locale="tr"
                                columnWidth={viewMode === ViewMode.Month ? 100 : 60}
                                listCellWidth="200px"
                                rowHeight={50}
                                barFill={80}
                                ganttHeight={600}
                                tooltipContent={(task) => {
                                    // Custom Tooltip
                                    return (
                                        <div className="p-2 bg-white border shadow-sm rounded text-dark" style={{minWidth:'150px'}}>
                                            <strong className="d-block mb-1">{task.name}</strong>
                                            <div className="small text-muted">
                                                {task.start.toLocaleDateString('tr-TR')} - {task.end.toLocaleDateString('tr-TR')}
                                            </div>
                                        </div>
                                    );
                                }}
                            />
                        </div>
                    ) : (
                        <div className="text-center py-5 text-muted">
                            <Users size={48} className="mb-3 opacity-25"/>
                            <h5>Gösterilecek veri bulunamadı.</h5>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}