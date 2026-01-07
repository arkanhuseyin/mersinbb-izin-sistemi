import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import SignatureCanvas from 'react-signature-canvas';
import { Filter, Search, CheckCircle, XCircle, Clock, FileText, Printer, Download, UserCheck, Eye, Activity, UserX, PenTool } from 'lucide-react';

export default function LeaveRequests() {
    const [izinler, setIzinler] = useState([]);
    const [filteredIzinler, setFilteredIzinler] = useState([]);
    const [kullanici, setKullanici] = useState(null);
    const [secilenTalep, setSecilenTalep] = useState(null);
    const [timeline, setTimeline] = useState([]);
    
    // Bakiye State
    const [bakiye, setBakiye] = useState(null);

    const [activeTab, setActiveTab] = useState('pending');
    const [arama, setArama] = useState('');
    
    const [printModalOpen, setPrintModalOpen] = useState(false);
    const [printSettings, setPrintSettings] = useState({
        managerName: 'Bayram DEMİR', isManagerProxy: false,
        headName: 'Ersan TOPÇUOĞLU', isHeadProxy: false
    });

    const sigCanvas = useRef({});

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');
        if (userStr) { 
            setKullanici(JSON.parse(userStr)); 
            verileriGetir(token); 
        }
    }, []);

    useEffect(() => {
        let result = izinler;
        if (activeTab === 'pending') result = result.filter(x => ['ONAY_BEKLIYOR', 'AMIR_ONAYLADI', 'YAZICI_ONAYLADI'].includes(x.durum));
        else if (activeTab === 'approved') result = result.filter(x => ['IK_ONAYLADI', 'TAMAMLANDI'].includes(x.durum));
        else if (activeTab === 'rejected') result = result.filter(x => ['REDDEDILDI', 'IPTAL_EDILDI'].includes(x.durum));

        if (arama) result = result.filter(x => x.ad.toLowerCase().includes(arama.toLowerCase()) || x.tc_no.includes(arama));
        setFilteredIzinler(result);
    }, [izinler, activeTab, arama]);

    const verileriGetir = async (token) => {
        try {
            const response = await axios.get('https://mersinbb-izin-sistemi.onrender.com/api/izin/listele', { headers: { Authorization: `Bearer ${token}` } });
            setIzinler(response.data);
            setFilteredIzinler(response.data);

            // Bakiye Çekme
            axios.get('https://mersinbb-izin-sistemi.onrender.com/api/personel/bakiye', { 
                headers: { Authorization: `Bearer ${token}` } 
            }).then(res => setBakiye(res.data.kalan_izin)).catch(console.error);

        } catch (error) { console.error(error); }
    };

    // --- 🔥 DİNAMİK YETKİ KONTROLÜ (YENİ) 🔥 ---
    const checkDownloadPermission = (key) => {
        if (!kullanici) return false;
        // Admin her şeyi yapar
        if (kullanici.rol === 'admin') return true;

        // Yetkilendirme tablosunda "Ekle/Düzenle/İndir" sütununa bakıyoruz
        const yetki = kullanici.yetkiler?.find(y => y.modul_adi === key);
        return yetki ? yetki.ekle_duzenle === true : false;
    };

    const incele = async (izin) => {
        setSecilenTalep(izin);
        setTimeline([]);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`https://mersinbb-izin-sistemi.onrender.com/api/izin/timeline/${izin.talep_id}`, { headers: { Authorization: `Bearer ${token}` } });
            setTimeline(res.data);
        } catch (e) { console.error("Timeline hatası", e); }
        setTimeout(() => { if(sigCanvas.current && sigCanvas.current.clear) sigCanvas.current.clear(); }, 100);
    };

    const onayla = async (onayTuru) => {
        if (sigCanvas.current.isEmpty()) { alert("Lütfen imza atınız!"); return; }
        const imzaResmi = sigCanvas.current.getCanvas().toDataURL('image/png');
        const token = localStorage.getItem('token');
        let yeniDurum = onayTuru === 'AMIR' ? 'AMIR_ONAYLADI' : onayTuru === 'YAZICI' ? 'YAZICI_ONAYLADI' : 'IK_ONAYLADI';

        try {
            await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/izin/onayla', { talep_id: secilenTalep.talep_id, imza_data: imzaResmi, yeni_durum: yeniDurum }, { headers: { Authorization: `Bearer ${token}` } });
            alert(`✅ İşlem Başarılı!`); setSecilenTalep(null); verileriGetir(token);
        } catch (error) { alert('Hata oluştu!'); }
    };

    const reddet = async () => {
        if(!window.confirm("Reddetmek istiyor musunuz?")) return;
        const token = localStorage.getItem('token');
        try {
            await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/izin/onayla', { talep_id: secilenTalep.talep_id, imza_data: null, yeni_durum: 'REDDEDILDI' }, { headers: { Authorization: `Bearer ${token}` } });
            alert(`❌ Reddedildi.`); setSecilenTalep(null); verileriGetir(token);
        } catch (error) { alert('Hata oluştu!'); }
    };

    const islakImzaIslemi = async (durum) => {
        const mesaj = durum === 'GELDI' 
            ? "Personel ıslak imzayı attı mı? İşlem TAMAMLANACAK." 
            : "Personel gelmediği için izin İPTAL edilecek. Onaylıyor musunuz?";

        if(!window.confirm(mesaj)) return;
        const token = localStorage.getItem('token');

        try {
            await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/izin/islak-imza-durumu', { 
                talep_id: secilenTalep.talep_id,
                durum: durum 
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            alert(durum === 'GELDI' ? "✅ Tamamlandı!" : "❌ İptal Edildi!");
            setSecilenTalep(null); verileriGetir(token);
        } catch (error) { alert('Hata oluştu!'); }
    };

    const downloadForm2 = () => {
        const managerTitle = printSettings.isManagerProxy ? 'Toplu Taşıma Şube Müdürü V.' : 'Toplu Taşıma Şube Müdürü';
        const headTitle = printSettings.isHeadProxy ? 'Ulaşım Dairesi Başkanı V.' : 'Ulaşım Dairesi Başkanı';
        const hrName = `${kullanici.ad} ${kullanici.soyad}`;
        const url = `https://mersinbb-izin-sistemi.onrender.com/api/izin/pdf/form2/${secilenTalep.talep_id}?hrName=${hrName}&managerName=${printSettings.managerName}&managerTitle=${managerTitle}&headName=${printSettings.headName}&headTitle=${headTitle}`;
        window.open(url, '_blank'); setPrintModalOpen(false);
    };

    const getBelgeUrl = (yol) => {
        if (!yol) return null;
        const temizYol = yol.replace(/\\/g, '/');
        const dosyaAdi = temizYol.split('/').pop();
        return `https://mersinbb-izin-sistemi.onrender.com/uploads/izinler/${dosyaAdi}`;
    };

    const butonGoster = (izin) => {
        if (kullanici?.rol === 'personel') return null;
        const btnStyle = "btn btn-sm px-3 fw-bold shadow-sm d-flex align-items-center gap-1";

        if (kullanici?.rol === 'amir' && izin.durum === 'ONAY_BEKLIYOR') return <button className={`${btnStyle} btn-warning text-dark`} onClick={() => incele(izin)}><UserCheck size={14}/> Amir Onayı</button>;
        if (kullanici?.rol === 'yazici' && izin.durum === 'AMIR_ONAYLADI') return <button className={`${btnStyle} btn-primary`} onClick={() => incele(izin)}><UserCheck size={14}/> Yazıcı Onayı</button>;
        if ((['ik', 'admin', 'filo'].includes(kullanici?.rol)) && izin.durum === 'YAZICI_ONAYLADI') return <button className={`${btnStyle} btn-success`} onClick={() => incele(izin)}><CheckCircle size={14}/> İK Onayı</button>;
        return <button className="btn btn-light btn-sm border text-secondary d-flex align-items-center gap-1" onClick={() => incele(izin)}><FileText size={14}/> Detay</button>;
    };

    const StatusBadge = ({ status }) => {
        if (status === 'IK_ONAYLADI' || status === 'TAMAMLANDI') return <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded-pill d-flex align-items-center gap-1 w-auto"><CheckCircle size={12}/> {status === 'TAMAMLANDI' ? 'Tamamlandı' : 'Onaylandı'}</span>;
        if (status === 'REDDEDILDI' || status === 'IPTAL_EDILDI') return <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 rounded-pill d-flex align-items-center gap-1 w-auto"><XCircle size={12}/> {status.replace(/_/g, ' ')}</span>;
        return <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1 rounded-pill d-flex align-items-center gap-1 w-auto"><Clock size={12}/> {status.replace(/_/g, ' ')}</span>;
    };

    return (
        <div className="container-fluid p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div><h3 className="fw-bold text-dark m-0">📅 İzin Talepleri</h3></div>
                
                <div className="d-flex gap-3">
                    <div className="bg-success bg-opacity-10 p-2 px-3 rounded shadow-sm border border-success">
                        <small className="d-block text-success fw-bold" style={{fontSize:'10px'}}>KALAN İZİN</small>
                        <span className="fw-bold text-success">{bakiye !== null ? bakiye : '-'} Gün</span>
                    </div>
                    <div className="bg-white p-2 px-3 rounded shadow-sm border">
                        <small className="d-block text-muted" style={{fontSize:'10px'}}>TOPLAM TALEP</small>
                        <span className="fw-bold text-primary">{izinler.length}</span>
                    </div>
                </div>
            </div>

            <div className="card border-0 shadow-sm mb-4 rounded-4"><div className="card-body p-2"><div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div className="nav nav-pills bg-light p-1 rounded-3">
                    {['all', 'pending', 'approved', 'rejected'].map(tab => (
                        <button key={tab} className={`nav-link btn-sm fw-bold px-3 ${activeTab === tab ? 'active bg-white text-primary shadow-sm' : 'text-muted'}`} onClick={() => setActiveTab(tab)}>
                            {tab === 'all' ? 'Tümü' : tab === 'pending' ? '🟡 Bekleyenler' : tab === 'approved' ? '🟢 Onaylananlar' : '🔴 Reddedilenler'}
                        </button>
                    ))}
                </div>
                <div className="input-group shadow-sm" style={{maxWidth: '300px'}}><span className="input-group-text bg-white border-end-0 ps-3"><Search size={16} className="text-muted"/></span><input type="text" className="form-control border-start-0 ps-0" placeholder="Ara..." value={arama} onChange={(e) => setArama(e.target.value)}/></div>
            </div></div></div>

            <div className="card shadow-sm border-0 rounded-4"><div className="card-body p-0"><div className="table-responsive"><table className="table table-hover align-middle mb-0">
                <thead className="bg-light text-secondary small text-uppercase"><tr><th className="ps-4 py-3">Personel</th><th>İzin Türü</th><th>Tarihler</th><th>Durum</th><th className="text-end pe-4">İşlem</th></tr></thead>
                <tbody>{filteredIzinler.map((izin) => (<tr key={izin.talep_id} style={{cursor: 'pointer'}} onClick={() => incele(izin)}>
                    <td className="ps-4"><div className="d-flex align-items-center"><div className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center me-3 fw-bold" style={{width:'40px', height:'40px', fontSize:'14px'}}>{izin.ad[0]}{izin.soyad[0]}</div><div><div className="fw-bold text-dark">{izin.ad} {izin.soyad}</div><small className="text-muted">{izin.tc_no}</small></div></div></td>
                    <td><span className="badge bg-light text-dark border fw-normal px-2 py-1">{izin.izin_turu}</span></td>
                    <td><div className="d-flex flex-column small"><span className="text-muted">Baş: <strong className="text-dark">{new Date(izin.baslangic_tarihi).toLocaleDateString('tr-TR')}</strong></span><span className="text-muted">Bit: <strong className="text-dark">{new Date(izin.bitis_tarihi).toLocaleDateString('tr-TR')}</strong></span></div></td>
                    <td><StatusBadge status={izin.durum} /></td>
                    <td className="text-end pe-4" onClick={(e) => e.stopPropagation()}>{butonGoster(izin)}</td>
                </tr>))}</tbody></table></div></div></div>

            {secilenTalep && (<div className="modal d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)', zIndex:1050}}><div className="modal-dialog modal-dialog-centered modal-lg"><div className="modal-content border-0 shadow-lg rounded-4">
                <div className="modal-header bg-white border-bottom p-4"><h5 className="modal-title fw-bold">Talep Detayı</h5><button className="btn-close" onClick={() => setSecilenTalep(null)}></button></div>
                <div className="modal-body p-4">
                    <div className="row g-3 mb-4">
                        <div className="col-md-6 p-3 bg-light rounded-3 border"><label className="small text-muted fw-bold text-uppercase mb-1">PERSONEL</label><div className="fw-bold text-dark fs-5">{secilenTalep.ad} {secilenTalep.soyad}</div><div className="text-muted small">{secilenTalep.tc_no}</div><div className="mt-2 small"><span className="fw-bold">Adres:</span> {secilenTalep.izin_adresi}</div></div>
                        <div className="col-md-6 p-3 bg-light rounded-3 border"><label className="small text-muted fw-bold text-uppercase mb-1">AÇIKLAMA</label><div className="text-dark mb-2">{secilenTalep.aciklama || 'Açıklama yok.'}</div>{secilenTalep.belge_yolu && (<a href={getBelgeUrl(secilenTalep.belge_yolu)} target="_blank" rel="noreferrer" className="btn btn-warning btn-sm w-100 fw-bold text-dark mt-2"><Eye size={16} className="me-1"/> Ekli Raporu Görüntüle</a>)}</div>
                    </div>

                    {/* SÜREÇ TAKİBİ (TIMELINE) */}
                    <div className="mb-4"><h6 className="fw-bold text-secondary mb-3 d-flex align-items-center gap-2"><Activity size={18}/> İŞLEM GEÇMİŞİ</h6><div className="p-3 bg-white border rounded-3" style={{maxHeight: '200px', overflowY: 'auto'}}>{timeline.length === 0 && <div className="text-muted small">Henüz işlem kaydı yok.</div>}{timeline.map((adim, index) => (<div key={index} className="d-flex mb-3 position-relative">{index !== timeline.length - 1 && <div className="position-absolute start-0 top-0 h-100 border-start border-2 border-success opacity-50" style={{left: '15px', top: '25px'}}></div>}<div className="bg-success text-white rounded-circle d-flex align-items-center justify-content-center me-3 flex-shrink-0" style={{width:30, height:30, zIndex:2}}><CheckCircle size={16}/></div><div><div className="fw-bold text-dark" style={{fontSize:'14px'}}>{adim.islem_turu.replace('_', ' ')}</div><div className="text-muted small">{adim.ad} {adim.soyad} <span className="badge bg-light text-dark border ms-1">{adim.rol_adi}</span></div><div className="text-secondary small mt-1 fst-italic">{new Date(adim.tarih).toLocaleString('tr-TR')} - {adim.aciklama}</div></div></div>))}</div></div>

                    {!['IK_ONAYLADI', 'REDDEDILDI', 'TAMAMLANDI', 'IPTAL_EDILDI'].includes(secilenTalep.durum) && (<div className="mt-3"><label className="form-label fw-bold text-primary mb-2">Lütfen İmza Atınız:</label><div className="border rounded-3 bg-white mx-auto shadow-sm overflow-hidden" style={{width: '100%', height: 200}}><SignatureCanvas ref={sigCanvas} penColor='black' canvasProps={{className: 'sigCanvas w-100 h-100'}} /></div><div className="text-end mt-2"><button className="btn btn-link text-danger text-decoration-none btn-sm p-0" onClick={() => sigCanvas.current.clear()}>Temizle</button></div></div>)}
                </div>
                <div className="modal-footer bg-light border-top p-3"><div className="d-flex justify-content-between w-100 align-items-center"><div className="d-flex gap-2">
                    
                    {/* ✅ FORM 1 BUTONU (Yetki Kontrollü) */}
                    {checkDownloadPermission('form1') && (
                        <a href={`https://mersinbb-izin-sistemi.onrender.com/api/izin/pdf/form1/${secilenTalep.talep_id}`} target="_blank" className="btn btn-outline-dark btn-sm fw-bold">
                            <Printer size={16} className="me-1"/> Form 1
                        </a>
                    )}

                    {/* ✅ FORM 2 BUTONU (Yetki Kontrollü - Yazıcı engellenebilir) */}
                    {checkDownloadPermission('form2') && (
                        <button className="btn btn-outline-danger btn-sm fw-bold" onClick={() => setPrintModalOpen(true)}>
                            <Download size={16} className="me-1"/> Form 2
                        </button>
                    )}

                </div>
                
                <div className="d-flex flex-column gap-2 align-items-end">
                    <div className="d-flex gap-2">
                        <button className="btn btn-secondary" onClick={() => setSecilenTalep(null)}>Kapat</button>
                        {kullanici.rol === 'amir' && secilenTalep.durum === 'ONAY_BEKLIYOR' && <><button className="btn btn-danger" onClick={reddet}>Reddet</button><button className="btn btn-warning fw-bold text-dark" onClick={() => onayla('AMIR')}>Amir Onayı</button></>}
                        {kullanici.rol === 'yazici' && secilenTalep.durum === 'AMIR_ONAYLADI' && <><button className="btn btn-danger" onClick={reddet}>Reddet</button><button className="btn btn-primary fw-bold" onClick={() => onayla('YAZICI')}>Yazıcı Onayı</button></>}
                        {(['ik', 'admin', 'filo'].includes(kullanici.rol)) && secilenTalep.durum === 'YAZICI_ONAYLADI' && <><button className="btn btn-danger" onClick={reddet}>Reddet</button><button className="btn btn-success fw-bold" onClick={() => onayla('IK')}>İK Onayı</button></>}
                    </div>

                    {/* ISLAK İMZA KONTROL BUTONLARI */}
                    {(['ik', 'admin'].includes(kullanici.rol)) && secilenTalep.durum === 'IK_ONAYLADI' && (
                        <div className="d-flex gap-2 mt-2">
                            <button className="btn btn-success fw-bold d-flex align-items-center gap-1" onClick={() => islakImzaIslemi('GELDI')}>
                                <PenTool size={16}/> İmzalandı (Tamamla)
                            </button>
                            <button className="btn btn-danger fw-bold d-flex align-items-center gap-1" onClick={() => islakImzaIslemi('GELMEDI')}>
                                <UserX size={16}/> Gelmedi (İptal)
                            </button>
                        </div>
                    )}
                </div></div></div></div></div></div>)}
                
            {printModalOpen && (<div className="modal d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060}}><div className="modal-dialog modal-sm modal-dialog-centered"><div className="modal-content shadow-lg border-0 rounded-4"><div className="modal-header bg-danger text-white py-2"><h6 className="modal-title fw-bold">🖨️ Yazdırma Ayarları</h6><button className="btn-close btn-close-white" onClick={() => setPrintModalOpen(false)}></button></div><div className="modal-body p-4"><div className="mb-3"><label className="form-label small fw-bold text-muted">İK Personeli</label><input type="text" className="form-control form-control-sm bg-light" value={`${kullanici.ad} ${kullanici.soyad}`} disabled /></div><div className="mb-2"><div className="form-check"><input className="form-check-input" type="checkbox" id="proxyManager" checked={printSettings.isManagerProxy} onChange={(e) => setPrintSettings({...printSettings, isManagerProxy: e.target.checked})} /><label className="form-check-label small fw-bold" htmlFor="proxyManager">Şube Müdürü V.</label></div><input type="text" className="form-control form-control-sm mt-1" value={printSettings.managerName} onChange={(e) => setPrintSettings({...printSettings, managerName: e.target.value})} disabled={!printSettings.isManagerProxy} /></div><div className="mb-3"><div className="form-check"><input className="form-check-input" type="checkbox" id="proxyHead" checked={printSettings.isHeadProxy} onChange={(e) => setPrintSettings({...printSettings, isHeadProxy: e.target.checked})} /><label className="form-check-label small fw-bold" htmlFor="proxyHead">Daire Başkanı V.</label></div><input type="text" className="form-control form-control-sm mt-1" value={printSettings.headName} onChange={(e) => setPrintSettings({...printSettings, headName: e.target.value})} disabled={!printSettings.isHeadProxy} /></div><button className="btn btn-danger w-100 fw-bold" onClick={downloadForm2}>PDF İNDİR</button></div></div></div></div>)}
        </div>
    );
}