import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    startOfMonth, endOfMonth, getDaysInMonth, format, addMonths, 
    isWeekend, getISOWeek, setDate 
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { Calendar, Filter, Search, Briefcase, ChevronLeft, ChevronRight, Users, Info } from 'lucide-react';

const API_URL = 'https://mersinbb-izin-sistemi.onrender.com';

export default function LeavePlanning() {
    const [personeller, setPersoneller] = useState([]);
    const [loading, setLoading] = useState(true);
    const [birimler, setBirimler] = useState([]);
    
    // FİLTRELER
    const [seciliBirim, setSeciliBirim] = useState('TÜMÜ');
    const [aramaMetni, setAramaMetni] = useState('');
    
    // TARİH YÖNETİMİ
    const [currentDate, setCurrentDate] = useState(new Date());
    
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
            
            // Backend'den gelen veriyi kontrol et (Hata ayıklama için)
            console.log("Backend Verisi:", planRes.data); 
            
            setPersoneller(planRes.data);
            setBirimler(birimRes.data);
        } catch (error) {
            console.error("Veri hatası:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMonthChange = (direction) => {
        setCurrentDate(prev => addMonths(prev, direction));
    };

    const getFilteredPersonel = () => {
        return personeller.filter(p => {
            // ADMIN GİZLEME
            const rid = Number(p.rol_id);
            const ad = (p.ad || '').toLowerCase();
            if (rid === 5 || rid === 1 || ad === 'sistem') return false;

            if (seciliBirim !== 'TÜMÜ' && p.birim_adi !== seciliBirim) return false;
            if (aramaMetni && !(p.ad + ' ' + p.soyad).toLowerCase().includes(aramaMetni.toLowerCase())) return false;
            return true;
        });
    };

    // 🔥 BURASI DÜZELTİLDİ: ESKİ BACKEND FORMATINA UYUMLU 🔥
    const checkLeaveStatus = (personel, day) => {
        // İzin verisi yoksa veya boşsa çık
        if (!personel.izinler || !Array.isArray(personel.izinler) || personel.izinler.length === 0) return null;

        // 1. Tablodaki o günün tarihini oluştur
        const currentCellDate = setDate(currentDate, day);
        // Karşılaştırma için format: YYYY-MM-DD
        const cellDateStr = format(currentCellDate, 'yyyy-MM-dd');

        const activeLeave = personel.izinler.find(izin => {
            // İptal edilenleri gösterme
            if (izin.durum === 'REDDEDILDI' || izin.durum === 'IPTAL_EDILDI') return false;
            
            // 2. Backend'den gelen tarihi güvenli şekilde YYYY-MM-DD formatına çevir
            // Backend "2026-01-28T00:00..." gönderse bile sadece ilk 10 karakteri alıyoruz.
            if (!izin.baslangic_tarihi || !izin.bitis_tarihi) return false;

            // Tarih string mi yoksa obje mi kontrol et, stringe çevir ve kırp
            const startRaw = new Date(izin.baslangic_tarihi).toISOString().split('T')[0];
            const endRaw = new Date(izin.bitis_tarihi).toISOString().split('T')[0];

            // 3. Basit String Karşılaştırması
            return cellDateStr >= startRaw && cellDateStr <= endRaw;
        });

        if (activeLeave) {
            let colorClass = 'bg-primary'; 
            let statusText = 'Bekliyor';
            let approverText = 'Süreç Devam Ediyor';

            // Durum Kontrolü
            const isApproved = ['IK_ONAYLADI', 'TAMAMLANDI'].includes(activeLeave.durum);
            const isAmir = activeLeave.durum === 'AMIR_ONAYLADI';
            const isYazici = activeLeave.durum === 'YAZICI_ONAYLADI';

            // Renk Atama
            if (activeLeave.izin_turu === 'RAPOR') colorClass = 'bg-danger'; // Kırmızı
            else if (isApproved) colorClass = 'bg-success'; // Yeşil (Tam Onay)
            else if (isAmir || isYazici) colorClass = 'bg-primary'; // Mavi (İşlemde)
            else colorClass = 'bg-warning text-dark'; // Sarı (İlk Başvuru)

            // Tooltip Metinleri
            if (activeLeave.durum === 'ONAY_BEKLIYOR') {
                statusText = 'Onay Bekliyor';
                approverText = `Birim Amiri (${personel.birim_adi})`;
            } else if (isAmir) {
                statusText = 'Amir Onayladı';
                approverText = 'Yazı İşleri / İdari İşler';
            } else if (isYazici) {
                statusText = 'İdari Onay Tamam';
                approverText = 'İnsan Kaynakları (Son Onay)';
            } else if (isApproved) {
                statusText = 'ONAYLANDI';
                approverText = 'İnsan Kaynakları / Yönetim';
            }

            return {
                exists: true,
                className: colorClass,
                tooltip: `TÜR: ${activeLeave.izin_turu}\nDURUM: ${statusText}\nŞU AN KİMDE: ${approverText}\nSÜRE: ${activeLeave.gun_sayisi} Gün`
            };
        }
        return null;
    };

    // --- TABLO OLUŞTURMA ---
    const daysInMonth = getDaysInMonth(currentDate);
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const filteredList = getFilteredPersonel();

    // Haftaları Grupla
    const weeksHeader = [];
    let currentWeek = null;
    let count = 0;

    for (let i = 1; i <= daysInMonth; i++) {
        const d = setDate(currentDate, i);
        const w = getISOWeek(d);
        if (currentWeek === null) { currentWeek = w; count = 1; }
        else if (w !== currentWeek) {
            weeksHeader.push({ week: currentWeek, count: count });
            currentWeek = w;
            count = 1;
        } else {
            count++;
        }
    }
    weeksHeader.push({ week: currentWeek, count: count });

    return (
        <div className="container-fluid p-0 bg-light" style={{ minHeight: '100vh' }}>
            
            {/* 1. HEADER */}
            <div className="bg-white border-bottom px-4 py-3 d-flex flex-column flex-md-row justify-content-between align-items-center gap-3 shadow-sm sticky-top" style={{zIndex: 1020}}>
                <div>
                    <h2 className="fw-bold text-dark m-0 d-flex align-items-center gap-2">
                        <Calendar className="text-primary" size={26}/>
                        Personel İzin Çizelgesi
                    </h2>
                    <p className="text-muted small m-0">Aylık planlama tablosu.</p>
                </div>

                <div className="d-flex align-items-center bg-light rounded-pill border p-1 shadow-sm">
                    <button className="btn btn-light rounded-circle p-2 border-0" onClick={() => handleMonthChange(-1)}><ChevronLeft size={20}/></button>
                    <div className="mx-4 fw-bolder text-dark fs-5 text-uppercase" style={{minWidth: '180px', textAlign: 'center'}}>
                        {format(currentDate, 'MMMM yyyy', { locale: tr })}
                    </div>
                    <button className="btn btn-light rounded-circle p-2 border-0" onClick={() => handleMonthChange(1)}><ChevronRight size={20}/></button>
                </div>
            </div>

            <div className="p-4">
                {/* 2. FİLTRELER */}
                <div className="card border-0 shadow-sm rounded-4 mb-4 bg-white">
                    <div className="card-body p-3 row g-3 align-items-center">
                        <div className="col-md-3">
                            <div className="input-group border rounded-3 bg-light">
                                <span className="input-group-text bg-transparent border-0"><Search size={18} className="text-muted"/></span>
                                <input type="text" className="form-control border-0 bg-transparent shadow-none" placeholder="Personel Ara..." value={aramaMetni} onChange={(e) => setAramaMetni(e.target.value)}/>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="input-group border rounded-3 bg-light">
                                <span className="input-group-text bg-transparent border-0"><Briefcase size={18} className="text-muted"/></span>
                                <select className="form-select border-0 bg-transparent shadow-none fw-bold" value={seciliBirim} onChange={(e) => setSeciliBirim(e.target.value)}>
                                    <option value="TÜMÜ">TÜM BİRİMLER</option>
                                    {birimler.map(b => (<option key={b.birim_id} value={b.birim_adi}>{b.birim_adi}</option>))}
                                </select>
                            </div>
                        </div>
                        <div className="col-md-6 d-flex justify-content-md-end gap-3 text-small flex-wrap">
                            <div className="d-flex align-items-center gap-2"><span className="badge bg-success rounded-1" style={{width:20, height:20}}> </span> Onaylı</div>
                            <div className="d-flex align-items-center gap-2"><span className="badge bg-primary rounded-1" style={{width:20, height:20}}> </span> İşlemde</div>
                            <div className="d-flex align-items-center gap-2"><span className="badge bg-warning text-dark rounded-1" style={{width:20, height:20}}> </span> Bekleyen</div>
                            <div className="d-flex align-items-center gap-2"><span className="badge bg-danger rounded-1" style={{width:20, height:20}}> </span> Rapor</div>
                        </div>
                    </div>
                </div>

                {/* 3. EXCEL TARZI TABLO */}
                <div className="card border-0 shadow-lg rounded-4 overflow-hidden bg-white">
                    <div className="table-responsive" style={{ maxHeight: '70vh' }}>
                        <table className="table table-bordered mb-0" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                            
                            <thead className="bg-light sticky-top" style={{ zIndex: 10, top: 0 }}>
                                {/* 1. KAT: HAFTALAR */}
                                <tr>
                                    <th rowSpan="2" className="p-3 bg-white border-bottom shadow-sm align-middle" style={{ position: 'sticky', left: 0, zIndex: 20, width: '250px', minWidth: '250px', borderRight: '2px solid #eee' }}>
                                        <div className="d-flex justify-content-between align-items-center text-secondary">
                                            <span>PERSONEL LİSTESİ</span>
                                            <Users size={16}/>
                                        </div>
                                    </th>
                                    {weeksHeader.map((w, idx) => (
                                        <th key={idx} colSpan={w.count} className="text-center bg-white border-bottom border-end small text-muted text-uppercase py-1" style={{fontSize:'10px', backgroundColor: '#f8f9fa'}}>
                                            {w.week}. HAFTA
                                        </th>
                                    ))}
                                </tr>

                                {/* 2. KAT: GÜNLER */}
                                <tr>
                                    {daysArray.map(day => {
                                        const d = setDate(currentDate, day);
                                        const isSatSun = isWeekend(d);
                                        return (
                                            <th key={day} className={`text-center p-1 align-middle border-bottom border-end ${isSatSun ? 'bg-secondary bg-opacity-10' : 'bg-white'}`} style={{ minWidth: '40px', width: '40px', fontSize: '12px' }}>
                                                <div className={`fw-bold ${isSatSun ? 'text-danger' : 'text-dark'}`}>{day}</div>
                                                <div style={{fontSize: '9px', color: '#666', textTransform: 'uppercase'}}>
                                                    {format(d, 'EEE', { locale: tr })}
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>

                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={daysInMonth + 1} className="text-center py-5">Yükleniyor...</td></tr>
                                ) : filteredList.length > 0 ? (
                                    filteredList.map((personel) => (
                                        <tr key={personel.personel_id}>
                                            {/* İSİM SÜTUNU */}
                                            <td className="p-2 bg-white border-end border-bottom" style={{ position: 'sticky', left: 0, zIndex: 5, borderRight: '2px solid #eee' }}>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="bg-light rounded-circle d-flex align-items-center justify-content-center text-primary fw-bold border" style={{width:'36px', height:'36px', fontSize:'14px'}}>
                                                        {personel.ad.charAt(0)}{personel.soyad.charAt(0)}
                                                    </div>
                                                    <div className="text-truncate" style={{maxWidth: '180px'}}>
                                                        <div className="fw-bold text-dark" style={{fontSize: '13px'}}>{personel.ad} {personel.soyad}</div>
                                                        <div className="text-muted text-uppercase" style={{fontSize: '10px'}}>
                                                            {personel.gorev || personel.unvan || '-'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* GÜNLER (KUTUCUKLAR) */}
                                            {daysArray.map(day => {
                                                const d = setDate(currentDate, day);
                                                const isSatSun = isWeekend(d);
                                                const leaveStatus = checkLeaveStatus(personel, day);

                                                return (
                                                    <td 
                                                        key={day} 
                                                        className={`p-0 text-center align-middle border-bottom border-end ${isSatSun && !leaveStatus ? 'bg-secondary bg-opacity-10' : ''}`}
                                                        style={{ height: '50px', position: 'relative' }}
                                                    >
                                                        {leaveStatus ? (
                                                            <div 
                                                                className={`w-100 h-100 d-flex align-items-center justify-content-center text-white fw-bold ${leaveStatus.className}`}
                                                                style={{ cursor: 'help', fontSize: '10px', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)' }}
                                                                title={leaveStatus.tooltip} 
                                                                data-bs-toggle="tooltip" 
                                                            >
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={daysInMonth + 1} className="text-center py-5 text-muted">
                                            <Info size={40} className="mb-2 opacity-25"/>
                                            <div>Kayıt bulunamadı.</div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}