import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MessageSquare, Plus, Send, X, Lock, CheckCircle, Clock, Archive } from 'lucide-react';

const API_URL = 'https://mersinbb-izin-sistemi.onrender.com';

export default function TalepYonetimi() {
    const [talepler, setTalepler] = useState([]);
    const [seciliTalep, setSeciliTalep] = useState(null);
    const [mesajlar, setMesajlar] = useState([]);
    const [yeniMesaj, setYeniMesaj] = useState('');
    const [showModal, setShowModal] = useState(false);
    
    // Yeni Talep Formu
    const [yeniKonu, setYeniKonu] = useState('');
    const [yeniTur, setYeniTur] = useState('Öneri');
    const [ilkMesaj, setIlkMesaj] = useState('');
    const [kvkkOnay, setKvkkOnay] = useState(false);

    // Kullanıcı verisini güvenli çek
    let user = null;
    try {
        user = JSON.parse(localStorage.getItem('user'));
    } catch (e) { console.error("User data error"); }

    const token = localStorage.getItem('token');
    const bottomRef = useRef(null);

    useEffect(() => { fetchTalepler(); }, []);
    useEffect(() => { if(seciliTalep) fetchMesajlar(seciliTalep.id); }, [seciliTalep]);
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mesajlar]);

    const fetchTalepler = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/talep/listele`, { headers: { Authorization: `Bearer ${token}` } });
            setTalepler(res.data);
        } catch (e) { console.error(e); }
    };

    const fetchMesajlar = async (id) => {
        try {
            const res = await axios.get(`${API_URL}/api/talep/detay/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            setMesajlar(res.data);
        } catch (e) { console.error(e); }
    };

    const gonderYeniTalep = async () => {
        if (!kvkkOnay) return alert("Lütfen KVKK metnini onaylayınız.");
        if (!yeniKonu || !ilkMesaj) return alert("Tüm alanları doldurunuz.");
        
        try {
            await axios.post(`${API_URL}/api/talep/olustur`, 
                { tur: yeniTur, konu: yeniKonu, mesaj: ilkMesaj, kvkk: true },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert("Talebiniz iletildi!");
            setShowModal(false);
            setYeniKonu(''); setIlkMesaj(''); setKvkkOnay(false);
            fetchTalepler();
        } catch (e) { alert("Hata oluştu."); }
    };

    const cevapla = async () => {
        if (!yeniMesaj.trim()) return;
        try {
            let durum = null;
            // Güvenli rol kontrolü
            if (user && ['admin', 'ik', 'filo'].includes(user.rol)) durum = 'YANITLANDI';
            
            await axios.post(`${API_URL}/api/talep/cevapla`, 
                { talep_id: seciliTalep.id, mesaj: yeniMesaj, yeni_durum: durum },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setYeniMesaj('');
            fetchMesajlar(seciliTalep.id);
        } catch (e) { alert("Mesaj gönderilemedi."); }
    };

    const talepKapat = async () => {
        if(!confirm("Bu talebi kapatmak istediğinize emin misiniz?")) return;
        try {
            await axios.post(`${API_URL}/api/talep/cevapla`, 
                { talep_id: seciliTalep.id, mesaj: 'Talep kapatıldı.', yeni_durum: 'KAPANDI' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchTalepler();
            setSeciliTalep(null);
        } catch(e) { alert("Hata"); }
    };

    return (
        <div className="container-fluid p-4 h-100 d-flex flex-column" style={{height:'90vh'}}>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="fw-bold text-dark d-flex align-items-center gap-2"><MessageSquare size={28}/> Öneri / Şikayet / Talep</h2>
                <button className="btn btn-primary shadow-sm" onClick={()=>setShowModal(true)}><Plus size={18} className="me-2"/> Yeni Oluştur</button>
            </div>

            <div className="row flex-grow-1 g-4" style={{minHeight:0}}>
                {/* SOL: LİSTE */}
                <div className="col-md-4 h-100">
                    <div className="card border-0 shadow-sm h-100 rounded-4 overflow-hidden">
                        <div className="list-group list-group-flush overflow-auto h-100">
                            {talepler.map(t => (
                                <button key={t.id} onClick={()=>setSeciliTalep(t)} 
                                    className={`list-group-item list-group-item-action p-3 border-bottom ${seciliTalep?.id===t.id ? 'bg-primary bg-opacity-10' : ''}`}>
                                    <div className="d-flex justify-content-between mb-1">
                                        <span className={`badge ${t.tur==='Şikayet'?'bg-danger':t.tur==='Öneri'?'bg-success':'bg-primary'}`}>{t.tur}</span>
                                        <small className="text-muted">{new Date(t.son_guncelleme).toLocaleDateString('tr-TR')}</small>
                                    </div>
                                    <h6 className="mb-1 fw-bold text-truncate">{t.konu}</h6>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <small className="text-muted fst-italic">{t.gorunen_ad}</small>
                                        <span className={`badge rounded-pill ${t.durum==='AÇIK'?'bg-warning text-dark':t.durum==='KAPANDI'?'bg-secondary':'bg-info'}`}>{t.durum}</span>
                                    </div>
                                </button>
                            ))}
                            {talepler.length === 0 && <div className="p-4 text-center text-muted">Henüz bir kayıt yok.</div>}
                        </div>
                    </div>
                </div>

                {/* SAĞ: CHAT DETAY */}
                <div className="col-md-8 h-100">
                    {seciliTalep ? (
                        <div className="card border-0 shadow-sm h-100 rounded-4 d-flex flex-column">
                            <div className="card-header bg-white p-3 border-bottom d-flex justify-content-between align-items-center">
                                <div>
                                    <h5 className="mb-0 fw-bold">{seciliTalep.konu}</h5>
                                    <small className="text-muted">Talep No: #{seciliTalep.id} | Durum: {seciliTalep.durum}</small>
                                </div>
                                {/* Güvenli Rol Kontrolü */}
                                {seciliTalep.durum !== 'KAPANDI' && user && ['admin','ik','filo'].includes(user.rol) && (
                                    <button className="btn btn-sm btn-outline-danger" onClick={talepKapat}><Archive size={16} className="me-1"/> Konuyu Kapat</button>
                                )}
                            </div>
                            
                            <div className="card-body bg-light overflow-auto flex-grow-1 p-3">
                                {mesajlar.map((m, i) => {
                                    const isMe = user && m.gonderen_id === user.personel_id;
                                    return (
                                        <div key={i} className={`d-flex mb-3 ${isMe ? 'justify-content-end' : 'justify-content-start'}`}>
                                            <div className={`p-3 rounded-4 shadow-sm ${isMe ? 'bg-primary text-white' : 'bg-white text-dark'}`} style={{maxWidth:'75%'}}>
                                                <div className="fw-bold small mb-1 opacity-75">{m.ad_soyad}</div>
                                                <div>{m.mesaj}</div>
                                                <div className={`text-end mt-1 small ${isMe?'text-light':'text-muted'}`} style={{fontSize:'10px'}}>
                                                    {new Date(m.gonderim_tarihi).toLocaleString('tr-TR')}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                <div ref={bottomRef} />
                            </div>

                            {seciliTalep.durum !== 'KAPANDI' ? (
                                <div className="card-footer bg-white p-3 border-top">
                                    <div className="input-group">
                                        <input type="text" className="form-control border-0 bg-light" placeholder="Bir cevap yazın..." 
                                            value={yeniMesaj} onChange={e=>setYeniMesaj(e.target.value)} onKeyDown={e=>e.key==='Enter' && cevapla()}/>
                                        <button className="btn btn-primary px-4" onClick={cevapla}><Send size={18}/></button>
                                    </div>
                                </div>
                            ) : (
                                <div className="card-footer bg-secondary text-white text-center p-2 small">Bu talep kapatılmıştır. Cevap yazılamaz.</div>
                            )}
                        </div>
                    ) : (
                        <div className="h-100 d-flex align-items-center justify-content-center text-muted bg-light rounded-4 border">
                            <div className="text-center">
                                <MessageSquare size={48} className="mb-3 opacity-25"/>
                                <p>Detayları görmek için soldan bir talep seçin.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* YENİ TALEP MODALI & KVKK */}
            {showModal && (
                <div className="modal show d-block" style={{backgroundColor:'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content rounded-4 border-0 shadow-lg">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title fw-bold">Yeni Bildirim Oluştur</h5>
                                <button className="btn-close btn-close-white" onClick={()=>setShowModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="mb-3">
                                    <label className="form-label fw-bold">Tür</label>
                                    <select className="form-select" value={yeniTur} onChange={e=>setYeniTur(e.target.value)}>
                                        <option>Öneri</option>
                                        <option>Şikayet</option>
                                        <option>Talep</option>
                                    </select>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-bold">Konu Başlığı</label>
                                    <input className="form-control" placeholder="Örn: Yemekhane hk." value={yeniKonu} onChange={e=>setYeniKonu(e.target.value)}/>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-bold">Mesajınız</label>
                                    <textarea className="form-control" rows="4" placeholder="Detayları buraya yazınız..." value={ilkMesaj} onChange={e=>setIlkMesaj(e.target.value)}></textarea>
                                </div>
                                
                                <div className="bg-light p-3 rounded border mb-3">
                                    <div className="form-check">
                                        <input className="form-check-input" type="checkbox" id="kvkkCheck" checked={kvkkOnay} onChange={e=>setKvkkOnay(e.target.checked)}/>
                                        <label className="form-check-label small text-muted" htmlFor="kvkkCheck">
                                            <strong>KVKK Aydınlatma Metni:</strong> Kişisel verilerimin, talebimin işleme alınması amacıyla işlenmesine, yetkili birimlerce görüntülenmesine ve yanıtlanmasına açık rıza gösteriyorum. Kimlik bilgilerim sadece sistem yöneticileri tarafından görüntülenebilir.
                                        </label>
                                    </div>
                                </div>

                                <button className="btn btn-primary w-100 fw-bold py-2" onClick={gonderYeniTalep} disabled={!kvkkOnay}>
                                    GÖNDER
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}