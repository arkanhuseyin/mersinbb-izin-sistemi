import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Calendar, ChevronLeft, ChevronRight, Filter, 
    Briefcase, AlertCircle, CheckCircle, Info 
} from 'lucide-react';

const API_URL = 'https://mersinbb-izin-sistemi.onrender.com';

export default function LeavePlanning() {
    const [personeller, setPersoneller] = useState([]); // Tüm veri
    const [gruplanmisVeri, setGruplanmisVeri] = useState({}); // Birim bazlı
    const [yukleniyor, setYukleniyor] = useState(true);
    
    // Tarih Yönetimi
    const [secilenTarih, setSecilenTarih] = useState(new Date());
    const [gunler, setGunler] = useState([]);

    // Filtreler
    const [arama, setArama] = useState('');

    useEffect(() => {
        verileriGetir();
    }, []);

    // Tarih değişince takvimi yeniden oluştur
    useEffect(() => {
        takvimOlustur(secilenTarih);
    }, [secilenTarih]);

    // Arama yapılınca listeyi filtrele
    useEffect(() => {
        if (personeller.length > 0) {
            gruplaVeFiltrele(personeller);
        }
    }, [arama, personeller]);

    const verileriGetir = async () => {
        const token = localStorage.getItem('token');
        if(!token) { window.location.href = '/login'; return; }

        try {
            const res = await axios.get(`${API_URL}/api/izin/personel-izin-takvim`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            
            // Veri dolu gelirse
            if(res.data && res.data.length > 0) {
                setPersoneller(res.data);
                gruplaVeFiltrele(res.data);
            } else {
                // Fallback: Eski rapor endpointi (Eğer backend henüz güncel değilse)
                const raporRes = await axios.get(`${API_URL}/api/izin/rapor/durum`, { headers: { Authorization: `Bearer ${token}` } });
                setPersoneller(raporRes.data);
                gruplaVeFiltrele(raporRes.data);
            }
        } catch (error) {
            console.error("Veri çekilemedi", error);
        } finally {
            setYukleniyor(false);
        }
    };

    const gruplaVeFiltrele = (veri) => {
        // 1. ADMIN GİZLEME (Rol ID 5 ve 1 Gizlenir)
        let filtreli = veri.filter(p => p.rol_id !== 5 && p.rol_id !== 1);

        // 2. Arama Filtresi
        if (arama) {
            filtreli = filtreli.filter(p => 
                p.ad.toLowerCase().includes(arama.toLowerCase()) || 
                p.soyad.toLowerCase().includes(arama.toLowerCase()) ||
                p.birim_adi?.toLowerCase().includes(arama.toLowerCase())
            );
        }

        // 3. Birimlere Göre Grupla
        const gruplar = {};
        filtreli.forEach(p => {
            const birim = p.birim_adi || 'Diğer';
            if (!gruplar[birim]) gruplar[birim] = [];
            gruplar[birim].push(p);
        });

        setGruplanmisVeri(gruplar);
    };

    const takvimOlustur = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const tempGunler = [];
        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(year, month, i);
            // YYYY-MM-DD formatında string tarih oluştur (Karşılaştırma için)
            const stringTarih = d.toLocaleDateString('en-CA'); // 2026-01-27 formatı verir

            tempGunler.push({
                gun: i,
                tamTarih: d,
                stringTarih: stringTarih, // Bunu kullanacağız
                haftaSonu: d.getDay() === 0 || d.getDay() === 6, 
                gunAdi: d.toLocaleDateString('tr-TR', { weekday: 'short' })
            });
        }
        setGunler(tempGunler);
    };

    const ayDegistir = (yon) => {
        const yeniTarih = new Date(secilenTarih);
        yeniTarih.setMonth(yeniTarih.getMonth() + yon);
        setSecilenTarih(yeniTarih);
    };

    // 🔥 DÜZELTİLEN FONKSİYON BURASI 🔥
    const izinDurumuGetir = (personel, hucreStringTarih) => {
        if (!personel.izinler || !Array.isArray(personel.izinler)) return null;

        for (const izin of personel.izinler) {
            // Sadece REDDEDİLEN veya İPTAL EDİLENLERİ görmeyelim. Geri kalan (Onaylı/Bekleyen) görünsün.
            if (izin.durum === 'REDDEDILDI' || izin.durum === 'IPTAL_EDILDI') continue;

            // Tarihleri String Formatına Çevir (Saat farkı sorununu çözer)
            // Backend "2026-01-27T00:00:00.000Z" gönderir, biz "2026-01-27" kısmını alırız.
            const baslangic = String(izin.baslangic_tarihi).split('T')[0];
            const bitis = String(izin.bitis_tarihi).split('T')[0];

            // String karşılaştırması (Alfabetik karşılaştırma YYYY-MM-DD formatında doğru çalışır)
            if (hucreStringTarih >= baslangic && hucreStringTarih <= bitis) {
                
                // Renk Belirleme
                let renk = 'bg-primary'; // Varsayılan: Mavi
                
                if (izin.izin_turu === 'RAPOR') renk = 'bg-danger'; 
                else if (izin.izin_turu === 'MAZERET İZNİ' || izin.izin_turu === 'BABALIK İZNİ') renk = 'bg-warning';
                else if (izin.izin_turu === 'YILLIK İZİN') renk = 'bg-primary';

                // Eğer izin henüz tam onaylanmamışsa (Yazıcı/Amir aşamasındaysa) rengi soluk yapalım
                // String '3' kontrolünü gevşettik, 'IK_ONAYLADI' veya 'TAMAMLANDI' değilse soluk olsun
                const tamOnayli = izin.durum === 'IK_ONAYLADI' || izin.durum === 'TAMAMLANDI' || String(izin.onay_durumu) === '3';
                if (!tamOnayli) {
                    renk = 'bg-secondary bg-opacity-50'; // Gri/Şeffaf
                }

                return {
                    tur: izin.izin_turu,
                    aciklama: `${izin.izin_turu} (${izin.gun_sayisi} Gün) - ${izin.durum}`,
                    renk: renk
                };
            }
        }
        return null;
    };

    return (
        <div className="container-fluid p-4">
            
            {/* BAŞLIK VE KONTROLLER */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4 gap-3">
                <div>
                    <h2 className="fw-bold text-dark m-0 d-flex align-items-center gap-2">
                        <div className="bg-info bg-opacity-10 p-2 rounded-3 text-info">
                            <Calendar size={24}/>
                        </div>
                        Personel İzin Planlama (Gantt)
                    </h2>
                    <p className="text-muted small m-0 mt-1">Birimlerin doluluk oranını ve personel izin çakışmalarını görüntüleyin.</p>
                </div>

                <div className="d-flex bg-white p-1 rounded-3 shadow-sm border align-items-center">
                    <button className="btn btn-light btn-sm rounded-circle" onClick={() => ayDegistir(-1)}><ChevronLeft size={20}/></button>
                    <div className="mx-3 fw-bold text-dark" style={{minWidth: '150px', textAlign: 'center'}}>
                        {secilenTarih.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }).toUpperCase()}
                    </div>
                    <button className="btn btn-light btn-sm rounded-circle" onClick={() => ayDegistir(1)}><ChevronRight size={20}/></button>
                </div>
            </div>

            {/* ARAMA VE LEGEND */}
            <div className="card border-0 shadow-sm mb-4 rounded-4 bg-white">
                <div className="card-body p-3 row g-3 align-items-center">
                    <div className="col-md-4">
                        <div className="input-group shadow-sm">
                            <span className="input-group-text bg-white border-end-0"><Filter size={18} className="text-muted"/></span>
                            <input type="text" className="form-control border-start-0" placeholder="Personel veya Birim Ara..." value={arama} onChange={e=>setArama(e.target.value)}/>
                        </div>
                    </div>
                    <div className="col-md-8 d-flex justify-content-md-end gap-3 text-small flex-wrap">
                        <div className="d-flex align-items-center gap-1"><span className="badge bg-primary rounded-circle p-1"> </span> <span className="small text-muted">Yıllık İzin (Onaylı)</span></div>
                        <div className="d-flex align-items-center gap-1"><span className="badge bg-warning rounded-circle p-1"> </span> <span className="small text-muted">Mazeret</span></div>
                        <div className="d-flex align-items-center gap-1"><span className="badge bg-danger rounded-circle p-1"> </span> <span className="small text-muted">Rapor</span></div>
                        <div className="d-flex align-items-center gap-1"><span className="badge bg-secondary bg-opacity-50 rounded-circle p-1"> </span> <span className="small text-muted">Onay Bekleyen</span></div>
                    </div>
                </div>
            </div>

            {/* GANTT TABLOSU */}
            <div className="card shadow-lg border-0 rounded-4 overflow-hidden">
                <div className="table-responsive" style={{ maxHeight: '70vh' }}>
                    <table className="table table-bordered mb-0" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead className="bg-light sticky-top" style={{ zIndex: 5 }}>
                            <tr>
                                <th className="p-3 bg-white border-bottom shadow-sm" style={{ position: 'sticky', left: 0, zIndex: 6, width: '250px', minWidth: '250px' }}>
                                    PERSONEL LİSTESİ
                                </th>
                                {gunler.map((g) => (
                                    <th key={g.gun} className={`text-center p-1 border-bottom ${g.haftaSonu ? 'bg-secondary bg-opacity-10' : 'bg-white'}`} style={{ minWidth: '35px', fontSize: '11px' }}>
                                        <div className="fw-bold text-dark">{g.gun}</div>
                                        <div className="text-muted" style={{fontSize: '9px'}}>{g.gunAdi}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {yukleniyor ? (
                                <tr><td colSpan={gunler.length + 1} className="text-center py-5">Yükleniyor...</td></tr>
                            ) : Object.keys(gruplanmisVeri).length > 0 ? (
                                Object.keys(gruplanmisVeri).map((birimAdi) => (
                                    <>
                                        {/* BİRİM BAŞLIĞI */}
                                        <tr key={birimAdi} className="bg-light">
                                            <td colSpan={gunler.length + 1} className="py-2 px-3 fw-bold text-dark border-bottom border-top">
                                                <Briefcase size={16} className="me-2 text-primary"/>
                                                {birimAdi} ({gruplanmisVeri[birimAdi].length} Personel)
                                            </td>
                                        </tr>
                                        
                                        {/* PERSONEL SATIRLARI */}
                                        {gruplanmisVeri[birimAdi].map((personel) => (
                                            <tr key={personel.personel_id}>
                                                <td className="p-2 border-end bg-white" style={{ position: 'sticky', left: 0, zIndex: 4 }}>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="bg-light rounded-circle d-flex align-items-center justify-content-center text-primary fw-bold" style={{width:'32px', height:'32px', fontSize:'12px', border:'1px solid #eee'}}>
                                                            {personel.ad.charAt(0)}{personel.soyad.charAt(0)}
                                                        </div>
                                                        <div className="text-truncate" style={{maxWidth: '180px'}}>
                                                            <div className="fw-bold text-dark small">{personel.ad} {personel.soyad}</div>
                                                            <div className="text-muted" style={{fontSize: '10px'}}>{personel.unvan || 'Şoför'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                {gunler.map((g) => {
                                                    // DÜZELTME: Artık string tarih (YYYY-MM-DD) gönderiyoruz
                                                    const durum = izinDurumuGetir(personel, g.stringTarih);
                                                    return (
                                                        <td 
                                                            key={g.gun} 
                                                            className={`p-0 border-end border-bottom text-center align-middle ${g.haftaSonu ? 'bg-secondary bg-opacity-10' : ''}`}
                                                            style={{ height: '45px', position: 'relative' }}
                                                        >
                                                            {durum && (
                                                                <div 
                                                                    className={`w-100 h-75 my-auto shadow-sm rounded-1 ${durum.renk}`} 
                                                                    style={{ margin: '0 auto', width: '90%' }}
                                                                    title={`${durum.aciklama} - ${g.stringTarih}`}
                                                                    data-bs-toggle="tooltip"
                                                                >
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </>
                                ))
                            ) : (
                                <tr><td colSpan={gunler.length + 1} className="text-center py-5 text-muted">Kayıt bulunamadı.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="mt-3 text-muted small d-flex align-items-center gap-2">
                <Info size={16}/>
                <span>Tabloda izinli personeller renkli kutucuklarla gösterilmiştir. Detay için kutucuğun üzerine gelin.</span>
            </div>
        </div>
    );
}