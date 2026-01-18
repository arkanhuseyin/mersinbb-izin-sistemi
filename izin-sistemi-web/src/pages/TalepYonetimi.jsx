import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MessageSquare, Plus, Send, Archive, User, Search, Clock, CheckCircle } from 'lucide-react';

const API_URL = 'https://mersinbb-izin-sistemi.onrender.com';

export default function TalepYonetimi() {
    const [talepler, setTalepler] = useState([]);
    const [filteredTalepler, setFilteredTalepler] = useState([]);
    const [seciliTalep, setSeciliTalep] = useState(null);
    const [mesajlar, setMesajlar] = useState([]);
    const [yeniMesaj, setYeniMesaj] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [arama, setArama] = useState('');
    
    // Form
    const [yeniKonu, setYeniKonu] = useState('');
    const [yeniTur, setYeniTur] = useState('Öneri');
    const [ilkMesaj, setIlkMesaj] = useState('');
    const [kvkkOnay, setKvkkOnay] = useState(false);

    let user = null;
    try { user = JSON.parse(localStorage.getItem('user')); } catch (e) {}
    const token = localStorage.getItem('token');
    const bottomRef = useRef(null);

    useEffect(() => { fetchTalepler(); }, []);
    
    useEffect(() => { 
        if(seciliTalep) {
            fetchMesajlar(seciliTalep.id);
            const interval = setInterval(() => fetchMesajlar(seciliTalep.id), 5000);
            return () => clearInterval(interval);
        }
    }, [seciliTalep]);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mesajlar]);

    useEffect(() => {
        const sonuc = talepler.filter(t => 
            t.konu.toLowerCase().includes(arama.toLowerCase()) || 
            (t.gorunen_ad && t.gorunen_ad.toLowerCase().includes(arama.toLowerCase()))
        );
        setFilteredTalepler(sonuc);
    }, [arama, talepler]);

    const fetchTalepler = async () => {
        if(!token) return;
        try {
            const res = await axios.get(`${API_URL}/api/talep/listele`, { headers: { Authorization: `Bearer ${token}` } });
            setTalepler(Array.isArray(res.data) ? res.data : []);
        } catch (e) { console.error(e); }
    };

    const fetchMesajlar = async (id) => {
        try {
            const res = await axios.get(`${API_URL}/api/talep/detay/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            setMesajlar(Array.isArray(res.data) ? res.data : []);
        } catch (e) { console.error(e); }
    };

    const gonderYeniTalep = async () => {
        if (!kvkkOnay || !yeniKonu || !ilkMesaj) return alert("Lütfen tüm alanları doldurup onaylayın.");
        try {
            await axios.post(`${API_URL}/api/talep/olustur`, 
                { tur: yeniTur, konu: yeniKonu, mesaj: ilkMesaj, kvkk: true },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert("Talebiniz iletildi.");
            setShowModal(false);
            setYeniKonu(''); setIlkMesaj(''); setKvkkOnay(false);
            fetchTalepler();
        } catch (e) { alert("Hata."); }
    };

    const cevapla = async () => {
        if (!yeniMesaj.trim()) return;
        try {
            let durum = null;
            if (user && ['admin', 'ik', 'filo'].includes(user.rol)) durum = 'YANITLANDI';
            
            await axios.post(`${API_URL}/api/talep/cevapla`, 
                { talep_id: seciliTalep.id, mesaj: yeniMesaj, yeni_durum: durum },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setYeniMesaj('');
            fetchMesajlar(seciliTalep.id);
        } catch (e) { alert("Gönderilemedi."); }
    };

    const talepKapat = async () => {
        if(!confirm("Kapatmak istediğinize emin misiniz?")) return;
        try {
            await axios.post(`${API_URL}/api/talep/cevapla`, 
                { talep_id: seciliTalep.id, mesaj: 'Talep kapatıldı.', yeni_durum: 'KAPANDI' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchTalepler();
            setSeciliTalep(prev => ({...prev, durum: 'KAPANDI'}));
        } catch(e) { alert("Hata"); }
    };

    return (
        <div className="container-fluid p-3 h-100 d-flex flex-column" style={{height:'95vh', backgroundColor:'#f0f2f5'}}>
            
            <div className="d-flex justify-content-between align-items-center mb-3 px-2">
                <div>
                    <h4 className="fw-bold text-dark m-0 d-flex align-items-center gap-2">
                        <MessageSquare className="text-primary"/> Destek Merkezi
                    </h4>
                    <small className="text-muted">Taleplerinizi ve yanıtlarınızı buradan yönetin.</small>
                </div>
                <button className="btn btn-primary fw-bold shadow-sm d-flex align-items-center gap-2 px-4 rounded-pill" onClick={()=>setShowModal(true)}>
                    <Plus size={20}/> Yeni Talep Oluştur
                </button>
            </div>

            <div className="row flex-grow-1 g-3 overflow-hidden m-0">
                {/* SOL LISTE */}
                <div className="col-md-4 col-lg-3 h-100 d-flex flex-column">
                    <div className="card border-0 shadow-sm h-100 rounded-4 overflow-hidden bg-white">
                        <div className="p-3 border-bottom bg-light">
                            <div className="input-group">
                                <span className="input-group-text bg-white border-end-0"><Search size={16} className="text-muted"/></span>
                                <input type="text" className="form-control border-start-0" placeholder="Ara..." value={arama} onChange={e=>setArama(e.target.value)}/>
                            </div>
                        </div>
                        <div className="list-group list-group-flush overflow-auto flex-grow-1">
                            {filteredTalepler.map(t => (
                                <button key={t.id} onClick={()=>setSeciliTalep(t)} 
                                    className={`list-group-item list-group-item-action p-3 border-bottom border-light 
                                    ${seciliTalep?.id===t.id ? 'bg-primary bg-opacity-10 border-start border-4 border-primary' : ''}`}>
                                    <div className="d-flex justify-content-between align-items-start mb-1">
                                        <span className={`badge rounded-pill ${t.tur==='Şikayet'?'bg-danger':t.tur==='Öneri'?'bg-success':'bg-info'}`}>{t.tur}</span>
                                        <small className="text-muted" style={{fontSize:'10px'}}>{new Date(t.son_guncelleme).toLocaleDateString('tr-TR')}</small>
                                    </div>
                                    <h6 className="mb-1 fw-bold text-truncate text-dark">{t.konu}</h6>
                                    <div className="d-flex justify-content-between align-items-center mt-2">
                                        <div className="d-flex align-items-center gap-1 small text-muted text-truncate" style={{maxWidth:'120px'}}>
                                            <User size={12}/> {t.gorunen_ad}
                                        </div>
                                        {t.durum === 'AÇIK' && <span className="badge bg-warning text-dark border">Açık</span>}
                                        {t.durum === 'YANITLANDI' && <span className="badge bg-info text-white">Yanıtlandı</span>}
                                        {t.durum === 'KAPANDI' && <span className="badge bg-secondary">Kapandı</span>}
                                    </div>
                                </button>
                            ))}
                            {filteredTalepler.length === 0 && <div className="p-5 text-center text-muted small">Kayıt bulunamadı.</div>}
                        </div>
                    </div>
                </div>

                {/* SAĞ CHAT */}
                <div className="col-md-8 col-lg-9 h-100">
                    {seciliTalep ? (
                        <div className="card border-0 shadow-sm h-100 rounded-4 d-flex flex-column overflow-hidden">
                            <div className="card-header bg-white p-3 border-bottom d-flex justify-content-between align-items-center shadow-sm z-1">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="bg-primary bg-opacity-10 text-primary rounded-circle p-2"><MessageSquare size={24}/></div>
                                    <div>
                                        <h5 className="mb-0 fw-bold">{seciliTalep.konu}</h5>
                                        <div className="d-flex align-items-center gap-2 small text-muted">
                                            <span>#{seciliTalep.id}</span>
                                            <span>•</span>
                                            <span>{seciliTalep.gorunen_ad}</span>
                                        </div>
                                    </div>
                                </div>
                                {seciliTalep.durum !== 'KAPANDI' && user && ['admin','ik','filo'].includes(user.rol) && (
                                    <button className="btn btn-outline-danger btn-sm fw-bold px-3" onClick={talepKapat}><Archive size={16} className="me-2"/> Kapat</button>
                                )}
                            </div>
                            
                            <div className="card-body overflow-auto flex-grow-1 p-4" style={{backgroundColor: '#e5ddd5', backgroundImage: 'linear-gradient(rgba(255,255,255,0.5), rgba(255,255,255,0.5))'}}> 
                                {mesajlar.map((m, i) => {
                                    const isMe = m.taraf === 'me';
                                    return (
                                        <div key={i} className={`d-flex mb-3 ${isMe ? 'justify-content-end' : 'justify-content-start'}`}>
                                            <div className={`p-3 shadow-sm position-relative ${isMe ? 'bg-success text-white' : 'bg-white text-dark'}`} 
                                                 style={{maxWidth:'70%', minWidth:'120px', borderRadius: isMe ? '15px 0 15px 15px' : '0 15px 15px 15px'}}>
                                                
                                                {!isMe && <div className="fw-bold small mb-1 text-primary">{m.gorunen_isim}</div>}
                                                
                                                <div style={{wordWrap: 'break-word', whiteSpace: 'pre-wrap'}}>{m.mesaj}</div>
                                                
                                                <div className={`text-end mt-1 small ${isMe?'text-light':'text-muted'}`} style={{fontSize:'10px', opacity: 0.8}}>
                                                    {new Date(m.gonderim_tarihi).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                <div ref={bottomRef} />
                            </div>

                            {seciliTalep.durum !== 'KAPANDI' ? (
                                <div className="card-footer bg-light p-3 border-top">
                                    <div className="input-group shadow-sm">
                                        <input type="text" className="form-control border-0 p-3" placeholder="Mesaj yazın..." 
                                            value={yeniMesaj} onChange={e=>setYeniMesaj(e.target.value)} onKeyDown={e=>e.key==='Enter' && cevapla()} />
                                        <button className="btn btn-success px-4" onClick={cevapla}><Send size={20}/></button>
                                    </div>
                                </div>
                            ) : (
                                <div className="card-footer bg-secondary text-white text-center p-3 small fw-bold">Bu konu kapatılmıştır.</div>
                            )}
                        </div>
                    ) : (
                        <div className="h-100 d-flex align-items-center justify-content-center text-muted bg-light rounded-4 border flex-column">
                            <MessageSquare size={64} className="text-primary opacity-50 mb-3"/>
                            <h4 className="fw-bold text-dark">Hoşgeldiniz</h4>
                            <p className="text-muted">Mesajlaşmak için soldan bir talep seçin.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL */}
            {showModal && (
                <div className="modal show d-block" style={{backgroundColor:'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)'}}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content rounded-4 border-0 shadow-lg">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title fw-bold"><Plus size={20}/> Yeni Talep</h5>
                                <button className="btn-close btn-close-white" onClick={()=>setShowModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="mb-3"><label className="fw-bold mb-1">Tür</label><select className="form-select" value={yeniTur} onChange={e=>setYeniTur(e.target.value)}><option>Öneri</option><option>Şikayet</option><option>Talep</option></select></div>
                                <div className="mb-3"><label className="fw-bold mb-1">Konu</label><input className="form-control" placeholder="Örn: Yemekhane..." value={yeniKonu} onChange={e=>setYeniKonu(e.target.value)}/></div>
                                <div className="mb-3"><label className="fw-bold mb-1">Mesaj</label><textarea className="form-control" rows="5" placeholder="Detaylar..." value={ilkMesaj} onChange={e=>setIlkMesaj(e.target.value)}></textarea></div>
                                <div className="bg-light p-3 rounded border mb-3 d-flex gap-3 align-items-start">
                                    <input className="form-check-input mt-1" type="checkbox" checked={kvkkOnay} onChange={e=>setKvkkOnay(e.target.checked)}/>
                                    <label className="small text-muted"><strong>KVKK:</strong> Kişisel verilerimin işlenmesine ve yetkili birimlerce görüntülenmesine rıza gösteriyorum.</label>
                                </div>
                                <button className="btn btn-primary w-100 fw-bold py-3 rounded-3 shadow-sm" onClick={gonderYeniTalep} disabled={!kvkkOnay}>GÖNDER</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}