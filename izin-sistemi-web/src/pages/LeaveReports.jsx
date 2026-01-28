import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
    Search, FileBarChart, CheckCircle, FileSpreadsheet, FileText, 
    Trash2, AlertTriangle, Filter, Edit3, X, Save, User, Calendar, Briefcase, Download
} from 'lucide-react';
import * as XLSX from 'xlsx'; 

const DEFAULT_PHOTO = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
const API_URL = 'https://mersinbb-izin-sistemi.onrender.com';

export default function LeaveReports() {
    // --- STATE ---
    const [rapor, setRapor] = useState([]);
    const [arama, setArama] = useState('');
    const [yukleniyor, setYukleniyor] = useState(true);
    const [limitBakiye, setLimitBakiye] = useState(''); 

    // Detay Modal
    const [secilenPersonel, setSecilenPersonel] = useState(null);
    const [detayYukleniyor, setDetayYukleniyor] = useState(false);
    const [personelDetay, setPersonelDetay] = useState(null);
    const [activeTab, setActiveTab] = useState('ozet'); 

    // Düzenleme Modal
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editData, setEditData] = useState(null);
    const [yeniBitisTarihi, setYeniBitisTarihi] = useState('');
    const [yeniGunSayisi, setYeniGunSayisi] = useState(0);

    // --- VERİ ÇEKME ---
    useEffect(() => { verileriGetir(); }, []);

    const verileriGetir = () => {
        const token = localStorage.getItem('token');
        if(!token) { window.location.href = '/login'; return; }
        axios.get(`${API_URL}/api/izin/rapor/durum`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => { setRapor(res.data); setYukleniyor(false); })
            .catch(err => { console.error(err); setYukleniyor(false); });
    };

    const getPhotoUrl = (path) => {
        if (!path) return DEFAULT_PHOTO;
        if (path.startsWith('http')) return path;
        let cleanPath = path.replace(/\\/g, '/');
        if (cleanPath.includes('uploads/')) return `${API_URL}/${cleanPath.substring(cleanPath.indexOf('uploads/'))}`;
        return `${API_URL}/uploads/${cleanPath.split('/').pop()}`;
    };

    const handlePersonelClick = async (personel) => {
        setSecilenPersonel(personel); 
        setActiveTab('ozet'); 
        setDetayYukleniyor(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/izin/personel-detay/${personel.personel_id}`, { headers: { Authorization: `Bearer ${token}` } });
            setPersonelDetay(res.data);
        } catch (e) { alert("Detaylar çekilemedi."); }
        setDetayYukleniyor(false);
    };

    const handleLeaveDelete = async (talepId) => {
        if(!confirm("DİKKAT! Bu işlem geri alınamaz ve bakiye personele iade edilir. Silmek istediğinize emin misiniz?")) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/api/izin/talep-sil/${talepId}`, { headers: { Authorization: `Bearer ${token}` } });
            alert("İzin silindi.");
            if (secilenPersonel) handlePersonelClick(secilenPersonel); 
            verileriGetir(); 
        } catch (error) { alert("Hata: " + error.message); }
    };

    const openEditModal = (izin) => {
        setEditData(izin);
        const dateStr = new Date(izin.bitis_tarihi).toISOString().split('T')[0];
        setYeniBitisTarihi(dateStr);
        setYeniGunSayisi(izin.kac_gun);
        setEditModalOpen(true);
    };

    useEffect(() => {
        if(editData && yeniBitisTarihi) {
            const baslangic = new Date(editData.baslangic_tarihi);
            const bitis = new Date(yeniBitisTarihi);
            const diffTime = bitis - baslangic; 
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
            setYeniGunSayisi(diffDays > 0 ? diffDays : 0);
        }
    }, [yeniBitisTarihi, editData]);

    const handleUpdateSave = async () => {
        if(!confirm(`İzin güncellenecek.\nEski Gün: ${editData.kac_gun}\nYeni Gün: ${yeniGunSayisi}\nAradaki fark bakiyeye iade edilecek/düşülecek.\nOnaylıyor musunuz?`)) return;
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_URL}/api/izin/guncelle`, {
                talep_id: editData.talep_id,
                yeni_bitis_tarihi: yeniBitisTarihi,
                yeni_gun_sayisi: yeniGunSayisi
            }, { headers: { Authorization: `Bearer ${token}` } });
            alert("İzin güncellendi!");
            setEditModalOpen(false);
            if (secilenPersonel) handlePersonelClick(secilenPersonel);
            verileriGetir();
        } catch (e) { alert("Hata: " + (e.response?.data?.mesaj || e.message)); }
    };

    const downloadBulkExcel = async () => {
        if(!confirm("Toplu Excel indirilsin mi?")) return; 
        try {
            const excelRows = [["TC", "Ad Soyad", "Birim", "Giriş", "Kıdem", "Ömür Boyu Hak", "Bu Yıl", "KULLANILAN", "KALAN", "DURUM"]];
            
            // 🔥 GÜVENLİK: Admin (Rol 5 ve 1) ve Sistem kullanıcılarını Excel'e dahil etme
            const adminHaricRapor = rapor.filter(p => {
                const rid = Number(p.rol_id);
                const ad = (p.ad || '').toLowerCase();
                return rid !== 5 && rid !== 1 && ad !== 'sistem';
            });
            
            adminHaricRapor.forEach((p) => {
                const kumulatif = parseInt(p.kumulatif_hak) || 0;
                const devreden = parseInt(p.devreden_izin) || 0;
                const buYil = parseInt(p.bu_yil_hakedis) || 0;
                const kalan = parseInt(p.kalan) || 0;
                const toplamHavuz = kumulatif + devreden;
                const kullanilan = toplamHavuz - kalan;
                const kidem = Math.floor((new Date() - new Date(p.ise_giris_tarihi)) / (1000 * 60 * 60 * 24 * 365.25));
                
                let durumMetni = "UYGUN";
                if (kalan > 50) durumMetni = "İZNE GÖNDERİLMELİ";
                else if (kalan < 0) durumMetni = "LİMİT AŞIMI";

                excelRows.push([p.tc_no, `${p.ad} ${p.soyad}`, p.birim_adi, new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR'), kidem, kumulatif, buYil, kullanilan, kalan, durumMetni]);
            });
            const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(excelRows);
            XLSX.utils.book_append_sheet(wb, ws, "Rapor"); XLSX.writeFile(wb, `Genel_Rapor.xlsx`);
        } catch (e) { alert("Hata oluştu."); }
    };

    const downloadBulkPDF = async () => {
        if(!confirm("Toplu PDF?")) return; 
        setYukleniyor(true); const token = localStorage.getItem('token');
        try {
            const response = await axios.get(`${API_URL}/api/izin/rapor/pdf-toplu`, { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a'); link.href = url; link.setAttribute('download', `Genel_Rapor.pdf`);
            document.body.appendChild(link); link.click(); link.remove();
        } catch (e) { alert("Hata."); } finally { setYukleniyor(false); }
    };

    // --- ANA FİLTRELEME (TABLO İÇİN) ---
    const filtered = rapor.filter(p => {
        const matchesSearch = p.ad.toLowerCase().includes(arama.toLowerCase()) || p.tc_no.includes(arama) || p.birim_adi?.toLowerCase().includes(arama.toLowerCase());
        const kalan = parseInt(p.kalan) || 0;
        const limit = parseInt(limitBakiye);
        
        // 🔥 GÜVENLİK: Rol ID 5 ve 1 (Admin/Sistem) GİZLENECEK 🔥
        const rid = Number(p.rol_id);
        const ad = (p.ad || '').toLowerCase();
        const isAdmin = (rid === 5 || rid === 1 || ad === 'sistem'); 
        
        return matchesSearch && (!isNaN(limit) && limit > 0 ? kalan >= limit : true) && !isAdmin;
    });

    return (
        <div className="container-fluid p-4">
              
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                <div>
                    <h2 className="fw-bold text-dark m-0 d-flex align-items-center gap-2">
                        <div className="bg-primary bg-opacity-10 p-2 rounded-3 text-primary">
                            <FileBarChart size={24}/>
                        </div>
                        İzin Takip Raporu
                    </h2>
                    <p className="text-muted small m-0 mt-1">Personel izin durumlarını, bakiyelerini ve geçmiş hareketlerini inceleyin.</p>
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-success shadow-sm d-flex align-items-center gap-2 fw-medium" onClick={downloadBulkExcel} disabled={yukleniyor}>
                        <FileSpreadsheet size={18}/> <span className="d-none d-sm-inline">Excel İndir</span>
                    </button>
                    <button className="btn btn-danger shadow-sm d-flex align-items-center gap-2 fw-medium" onClick={downloadBulkPDF} disabled={yukleniyor}>
                        <FileText size={18}/> <span className="d-none d-sm-inline">PDF İndir</span>
                    </button>
                </div>
            </div>
              
            <div className="card border-0 shadow-sm mb-4 rounded-4 bg-white">
                <div className="card-body p-3 row g-3 align-items-center">
                    <div className="col-12 col-md-5">
                        <div className="input-group shadow-sm">
                            <span className="input-group-text bg-white border-end-0"><Search size={18} className="text-muted"/></span>
                            <input type="text" className="form-control border-start-0" placeholder="Personel Adı, TC No veya Birim Ara..." value={arama} onChange={e=>setArama(e.target.value)}/>
                        </div>
                    </div>
                    <div className="col-12 col-md-7 d-flex align-items-center gap-3 justify-content-md-end flex-wrap">
                        <div className="d-flex align-items-center gap-2 bg-light p-2 rounded-3 border shadow-sm">
                            <Filter size={16} className="text-primary"/>
                            <span className="small fw-bold text-muted">İzin Üst Limit &ge;</span>
                            <input type="number" className="form-control form-control-sm text-center fw-bold text-primary border-0 bg-white" style={{width: '60px'}} placeholder="0" value={limitBakiye} onChange={(e) => setLimitBakiye(e.target.value)}/>
                        </div>
                        {limitBakiye && parseInt(limitBakiye) > 0 && <span className="badge bg-danger bg-opacity-10 text-danger border border-danger px-3 py-2 rounded-pill">{filtered.length} Sonuç</span>}
                    </div>
                </div>
            </div>

            <div className="card shadow-lg border-0 rounded-4 overflow-hidden">
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="bg-light text-muted small text-uppercase fw-bold" style={{fontSize: '11px'}}>
                                <tr>
                                    <th className="ps-4 py-3">ADI SOYADI</th>
                                    <th>KIDEM</th>
                                    <th className="text-center">TOPLAM HAK EDİLEN</th>
                                    <th className="text-center">BU YIL HAK EDİLEN</th>
                                    <th className="text-center">KULLANILAN İZİN</th>
                                    <th className="text-center">KALAN İZİN</th>
                                    <th className="text-end pe-4">İZİN DURUMU</th>
                                </tr>
                            </thead>
                            <tbody>
                                {yukleniyor ? (
                                    <tr><td colSpan="7" className="text-center py-5 text-muted">Yükleniyor...</td></tr>
                                ) : filtered.length > 0 ? (
                                    filtered.map((p, i) => {
                                    const kumulatif = parseInt(p.kumulatif_hak) || 0;
                                    const devreden = parseInt(p.devreden_izin) || 0;
                                    const buYilHak = parseInt(p.bu_yil_hakedis) || 0;
                                    const toplamHavuz = kumulatif + devreden;
                                    const kalan = parseInt(p.kalan) || 0;
                                    const toplamKullanilan = toplamHavuz - kalan;
                                    const kidemYil = Math.floor((new Date() - new Date(p.ise_giris_tarihi)) / (1000 * 60 * 60 * 24 * 365.25));
                                    
                                    const izneGonderilmeli = kalan > 50;
                                    const limitAsimi = kalan < 0;

                                    return (
                                        <tr key={i} onClick={() => handlePersonelClick(p)} style={{cursor: 'pointer', transition: 'all 0.1s'}}>
                                            <td className="ps-4">
                                                <div className="d-flex align-items-center gap-3">
                                                    <div className="bg-light text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold border" style={{width:'40px', height:'40px', fontSize:'14px'}}>
                                                        {p.ad.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="fw-bold text-dark">{p.ad} {p.soyad}</div>
                                                        <div className="small text-muted" style={{fontSize:'11px'}}>{p.birim_adi}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="small fw-medium">{new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR')}</div>
                                                <div className="text-muted" style={{fontSize:'10px'}}>{kidemYil} Yıl Hizmet</div>
                                            </td>
                                            <td className="text-center fw-bold text-secondary">{kumulatif}</td>
                                            <td className="text-center text-info fw-bold">{buYilHak}</td>
                                            <td className="text-center text-muted">{toplamKullanilan}</td>
                                            <td className="text-center">
                                                <span className={`badge px-3 py-2 rounded-pill fw-bold ${izneGonderilmeli ? 'bg-warning text-dark' : limitAsimi ? 'bg-danger text-white' : 'bg-success bg-opacity-10 text-success'}`}>
                                                    {kalan} Gün
                                                </span>
                                            </td>
                                            <td className="text-end pe-4">
                                                {izneGonderilmeli ? (
                                                    <span className="badge bg-warning bg-opacity-25 text-dark border border-warning px-2 py-1" style={{fontSize:'10px'}}>
                                                        <AlertTriangle size={12} className="me-1" style={{verticalAlign:'text-bottom'}}/> İZNE GÖNDERİLMELİ
                                                    </span>
                                                ) : limitAsimi ? (
                                                    <span className="badge bg-danger bg-opacity-10 text-danger border border-danger px-2 py-1" style={{fontSize:'10px'}}>
                                                        <X size={12} className="me-1" style={{verticalAlign:'text-bottom'}}/> LİMİT AŞIMI
                                                    </span>
                                                ) : (
                                                    <span className="badge bg-success bg-opacity-10 text-success border border-success px-2 py-1" style={{fontSize:'10px'}}>
                                                        <CheckCircle size={12} className="me-1" style={{verticalAlign:'text-bottom'}}/> UYGUN
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="text-center py-5 text-muted">
                                            <div className="d-flex flex-column align-items-center opacity-50">
                                                <AlertTriangle size={32} className="mb-2"/>
                                                <div>Kayıt bulunamadı.</div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* MODAL KISIMLARI (Aynı) */}
            {secilenPersonel && (
                <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)'}}>
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden" style={{maxHeight:'90vh'}}>
                            <div className="modal-header bg-white p-4 border-bottom d-flex align-items-center justify-content-between sticky-top">
                                <div className="d-flex align-items-center gap-4">
                                    <img 
                                        src={getPhotoUrl(secilenPersonel.fotograf_yolu)} 
                                        alt={secilenPersonel.ad}
                                        className="rounded-circle shadow-sm border"
                                        style={{width: '70px', height: '70px', objectFit: 'cover'}}
                                        onError={(e) => {e.target.src = DEFAULT_PHOTO}} 
                                    />
                                    <div>
                                        <h4 className="modal-title fw-bold text-dark mb-0">{secilenPersonel.ad} {secilenPersonel.soyad}</h4>
                                        <div className="d-flex gap-3 text-muted small mt-1">
                                            <span className="d-flex align-items-center gap-1"><User size={14}/> {secilenPersonel.tc_no}</span>
                                            <span className="d-flex align-items-center gap-1"><Briefcase size={14}/> {secilenPersonel.birim_adi}</span>
                                        </div>
                                    </div>
                                </div>
                                <button className="btn btn-light rounded-circle p-2" onClick={() => setSecilenPersonel(null)}><X size={20}/></button>
                            </div>
                            
                            <div className="modal-body bg-light p-0">
                                {detayYukleniyor ? <div className="text-center py-5"><div className="spinner-border text-primary"/></div> : personelDetay && (
                                    <div className="d-flex flex-column h-100">
                                        <div className="bg-white border-bottom px-4 pt-2">
                                            <ul className="nav nav-pills gap-2 pb-2">
                                                <li className="nav-item"><button className={`nav-link rounded-pill px-4 ${activeTab==='ozet'?'active':''}`} onClick={()=>setActiveTab('ozet')}>Genel Bakış</button></li>
                                                <li className="nav-item"><button className={`nav-link rounded-pill px-4 ${activeTab==='hakedis'?'active':''}`} onClick={()=>setActiveTab('hakedis')}>Hakedişler</button></li>
                                                <li className="nav-item"><button className={`nav-link rounded-pill px-4 ${activeTab==='gecmis'?'active':''}`} onClick={()=>setActiveTab('gecmis')}>İzin Geçmişi</button></li>
                                            </ul>
                                        </div>

                                        <div className="p-4">
                                            {activeTab === 'ozet' && (
                                                <div className="row g-4">
                                                    <div className="col-md-4">
                                                        <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
                                                            <div className="card-body text-center p-4">
                                                                <div className="p-3 rounded-circle bg-success bg-opacity-10 text-success d-inline-block mb-3">
                                                                    <CheckCircle size={32}/>
                                                                </div>
                                                                <h6 className="text-muted text-uppercase small fw-bold">Kalan Bakiye</h6>
                                                                <h1 className="display-4 fw-bold text-success mb-0">{personelDetay.personel.kalan}</h1>
                                                                <small className="text-muted">Gün Kullanılabilir</small>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-md-4">
                                                        <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
                                                            <div className="card-body text-center p-4">
                                                                <div className="p-3 rounded-circle bg-primary bg-opacity-10 text-primary d-inline-block mb-3">
                                                                    <FileText size={32}/>
                                                                </div>
                                                                <h6 className="text-muted text-uppercase small fw-bold">Toplam Hak</h6>
                                                                <h1 className="display-4 fw-bold text-primary mb-0">{parseInt(secilenPersonel.kumulatif_hak) + parseInt(secilenPersonel.devreden_izin || 0)}</h1>
                                                                <small className="text-muted">Ömür Boyu + Devreden</small>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-md-4">
                                                        <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
                                                            <div className="card-body text-center p-4">
                                                                <div className="p-3 rounded-circle bg-danger bg-opacity-10 text-danger d-inline-block mb-3">
                                                                    <Trash2 size={32}/>
                                                                </div>
                                                                <h6 className="text-muted text-uppercase small fw-bold">Kullanılan</h6>
                                                                <h1 className="display-4 fw-bold text-danger mb-0">{personelDetay.personel.kullanilan}</h1>
                                                                <small className="text-muted">Gün İzin Kullanıldı</small>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {activeTab === 'hakedis' && (
                                                <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                                                    <table className="table table-hover mb-0 align-middle">
                                                        <thead className="bg-light"><tr><th className="ps-4">Hakediş Yılı</th><th className="text-center">Kıdem Yılı</th><th className="text-end pe-4">Hak Edilen</th></tr></thead>
                                                        <tbody>
                                                            {personelDetay.hakedisListesi && personelDetay.hakedisListesi.length > 0 ? (
                                                                personelDetay.hakedisListesi.map((h, idx) => (
                                                                    <tr key={idx}>
                                                                        <td className="ps-4 fw-bold text-dark">{h.yil}</td>
                                                                        <td className="text-center text-muted">{h.kidem}. Yıl</td>
                                                                        <td className="text-end pe-4 fw-bold text-success">+{h.hak} Gün</td>
                                                                    </tr>
                                                                ))
                                                            ) : (<tr><td colSpan="3" className="text-center py-4 text-muted">Kayıt yok.</td></tr>)}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}

                                            {activeTab === 'gecmis' && (
                                                <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                                                    <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center">
                                                        <h6 className="m-0 fw-bold text-dark">İzin Hareketleri</h6>
                                                        <span className="badge bg-primary bg-opacity-10 text-primary">{personelDetay.izinler.length} Kayıt</span>
                                                    </div>
                                                    <div className="table-responsive">
                                                        <table className="table table-hover mb-0 align-middle">
                                                            <thead className="bg-light small text-muted"><tr><th className="ps-4">Tür</th><th>Tarihler</th><th className="text-center">Gün</th><th className="text-center">Durum</th><th className="text-end pe-4">İşlemler</th></tr></thead>
                                                            <tbody>{personelDetay.izinler.map((iz, idx) => (
                                                                <tr key={idx}>
                                                                    <td className="ps-4 fw-bold text-dark">{iz.izin_turu}</td>
                                                                    <td className="small text-muted">
                                                                        <div className="d-flex align-items-center gap-1"><Calendar size={12}/> {new Date(iz.baslangic_tarihi).toLocaleDateString('tr-TR')}</div>
                                                                        <div className="d-flex align-items-center gap-1"><Calendar size={12}/> {new Date(iz.bitis_tarihi).toLocaleDateString('tr-TR')}</div>
                                                                    </td>
                                                                    <td className="text-center fw-bold fs-5">{iz.kac_gun}</td>
                                                                    <td className="text-center"><span className="badge bg-success bg-opacity-10 text-success border border-success">ONAYLANDI</span></td>
                                                                    <td className="text-end pe-4">
                                                                        <div className="d-flex justify-content-end gap-2">
                                                                            <button className="btn btn-light btn-sm text-warning border" title="Erken Dönüş / Düzenle" onClick={() => openEditModal(iz)}>
                                                                                <Edit3 size={16}/>
                                                                            </button>
                                                                            <button className="btn btn-light btn-sm text-danger border" title="İptal Et ve Sil" onClick={() => handleLeaveDelete(iz.talep_id)}>
                                                                                <Trash2 size={16}/>
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}</tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {editModalOpen && editData && (
                <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1060}}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content shadow-lg border-0 rounded-4">
                            <div className="modal-header bg-warning bg-opacity-10 p-4 border-bottom-0">
                                <h5 className="modal-title fw-bold text-warning-emphasis"><Edit3 size={20} className="me-2"/> İzin Düzenle (Erken Dönüş)</h5>
                                <button className="btn-close" onClick={() => setEditModalOpen(false)}></button>
                            </div>
                            <div className="modal-body p-4 pt-0">
                                <div className="alert alert-info border-0 d-flex gap-3 align-items-center rounded-3 shadow-sm mt-3">
                                    <AlertTriangle size={24} className="text-info"/>
                                    <div className="small">Bitiş tarihini değiştirdiğinizde gün sayısı otomatik yeniden hesaplanır ve artan gün bakiyeye iade edilir.</div>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-bold small text-muted">MEVCUT BAŞLANGIÇ</label>
                                    <input type="text" className="form-control bg-light" value={new Date(editData.baslangic_tarihi).toLocaleDateString('tr-TR')} disabled />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-bold small text-dark">YENİ BİTİŞ TARİHİ</label>
                                    <input type="date" className="form-control border-warning fw-bold" value={yeniBitisTarihi} onChange={(e) => setYeniBitisTarihi(e.target.value)} />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-bold small text-muted">YENİ GÜN SAYISI</label>
                                    <input type="text" className="form-control bg-light fw-bold text-primary fs-5" value={yeniGunSayisi} disabled />
                                </div>
                            </div>
                            <div className="modal-footer border-0 p-4 pt-0">
                                <button className="btn btn-light fw-medium" onClick={() => setEditModalOpen(false)}>Vazgeç</button>
                                <button className="btn btn-warning fw-bold px-4 shadow-sm" onClick={handleUpdateSave}><Save size={18} className="me-2"/> Kaydet ve Güncelle</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}