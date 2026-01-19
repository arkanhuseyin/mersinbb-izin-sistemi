import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { User, Search, Calendar, FileText, CheckCircle, AlertTriangle, MapPin, PenTool, Save } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

const API_URL = 'https://mersinbb-izin-sistemi.onrender.com';

export default function HrLeaveEntry() {
    const sigCanvas = useRef({});
    
    // Genel State'ler
    const [personeller, setPersoneller] = useState([]);
    const [arama, setArama] = useState('');
    const [secilenPersonel, setSecilenPersonel] = useState(null);
    const [bakiyeBilgisi, setBakiyeBilgisi] = useState(null);
    const [loading, setLoading] = useState(false);
    const [resmiTatiller, setResmiTatiller] = useState([]);

    // Hesaplama State'i
    const [hesaplanan, setHesaplanan] = useState({ bitis: '', ise_baslama: '' });

    // Form State (CreateLeave ile aynı yapı)
    const [formData, setFormData] = useState({
        baslangic_tarihi: new Date().toISOString().split('T')[0],
        gun_sayisi: 1,
        izin_turu: 'YILLIK İZİN',
        haftalik_izin: 'Pazar',
        aciklama: '',
        adres_secimi: 'MEVCUT',
        izin_adresi: '' 
    });

    const izinTurleri = ["YILLIK İZİN", "MAZERET İZNİ", "RAPOR", "BABALIK İZNİ", "DOĞUM İZNİ", "DÜĞÜN İZNİ", "EVLİLİK İZNİ", "ÖLÜM İZNİ", "ÜCRETLİ İZİN", "ÜCRETSİZ İZİN", "İDARİ İZİN"];
    const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

    // 1. Verileri Çek
    useEffect(() => {
        const token = localStorage.getItem('token');
        // Personel Listesi
        axios.get(`${API_URL}/api/personel/liste`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => setPersoneller(res.data)).catch(e => alert("Personel listesi hatası"));
        
        // Resmi Tatiller
        axios.get(`${API_URL}/api/izin/resmi-tatiller`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => setResmiTatiller(res.data.map(t => t.tarih.split('T')[0]))).catch(console.error);
    }, []);

    // 2. Personel Seçimi ve Adres/Bakiye Doldurma
    const selectPersonel = async (p) => {
        setSecilenPersonel(p);
        setBakiyeBilgisi('...');
        
        // Adres bilgisini doldur
        if (p.adres) {
            setFormData(prev => ({ ...prev, izin_adresi: p.adres, adres_secimi: 'MEVCUT' }));
        }

        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/izin/personel-detay/${p.personel_id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBakiyeBilgisi(res.data.personel.kalan); 
        } catch (e) { setBakiyeBilgisi('?'); }
    };

    // 3. Adres Seçimi Değişince
    useEffect(() => {
        if(secilenPersonel) {
            if(formData.adres_secimi === 'MEVCUT') {
                setFormData(prev => ({ ...prev, izin_adresi: secilenPersonel.adres || '' }));
            } else {
                setFormData(prev => ({ ...prev, izin_adresi: '' }));
            }
        }
    }, [formData.adres_secimi, secilenPersonel]);

    // 4. Hesaplama Motoru (CreateLeave ile Aynı)
    useEffect(() => {
        if (!formData.gun_sayisi || formData.gun_sayisi <= 0) return;
        let kalan = parseInt(formData.gun_sayisi);
        let curr = new Date(formData.baslangic_tarihi);
        
        while (kalan > 0) {
            const str = curr.toISOString().split('T')[0];
            const gunIdx = curr.getDay();
            const gunIsmi = gunIdx === 0 ? "Pazar" : gunler[gunIdx - 1];
            if (!resmiTatiller.includes(str) && gunIsmi !== formData.haftalik_izin) kalan--;
            if (kalan > 0) curr.setDate(curr.getDate() + 1);
        }
        const bitisStr = curr.toLocaleDateString('tr-TR');
        
        let donus = new Date(curr); donus.setDate(donus.getDate() + 1);
        while (true) {
            const dStr = donus.toISOString().split('T')[0]; 
            const dIdx = donus.getDay(); 
            const dName = dIdx === 0 ? "Pazar" : gunler[dIdx - 1];
            if (!resmiTatiller.includes(dStr) && dName !== formData.haftalik_izin) break;
            donus.setDate(donus.getDate() + 1);
        }
        const baslamaStr = donus.toLocaleDateString('tr-TR');
        setHesaplanan({ bitis: bitisStr, ise_baslama: baslamaStr });
    }, [formData.baslangic_tarihi, formData.gun_sayisi, formData.haftalik_izin, resmiTatiller]);


    // 5. Gönderme İşlemi
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!secilenPersonel) return alert("Lütfen bir personel seçin.");
        if (sigCanvas.current.isEmpty()) { alert("Lütfen imza atınız (İK Onayı Yerine Geçer)."); return; }

        if(!confirm(`${secilenPersonel.ad} ${secilenPersonel.soyad} adına ${formData.gun_sayisi} gün izin girilecek.\n\nBu işlem AMİR onayı beklemeden direkt ONAYLANACAK.\nOnaylıyor musunuz?`)) return;

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const imza = sigCanvas.current.getCanvas().toDataURL('image/png');

            const gonderilecekVeri = {
                ...formData,
                kac_gun: parseInt(formData.gun_sayisi),
                bitis_tarihi: hesaplanan.bitis.split('.').reverse().join('-'), 
                ise_baslama: hesaplanan.ise_baslama.split('.').reverse().join('-'),
                personel_imza: imza, // İK'nın attığı imza
                hedef_personel_id: secilenPersonel.personel_id // Backend bunu görünce bypass yapacak
            };

            await axios.post(`${API_URL}/api/izin/olustur`, gonderilecekVeri, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            
            alert("✅ İzin başarıyla tanımlandı ve onaylandı!");
            
            // Formu resetle
            setFormData({
                baslangic_tarihi: new Date().toISOString().split('T')[0],
                gun_sayisi: 1, izin_turu: 'YILLIK İZİN', haftalik_izin: 'Pazar',
                aciklama: '', adres_secimi: 'MEVCUT', izin_adresi: secilenPersonel.adres || ''
            });
            sigCanvas.current.clear();
            selectPersonel(secilenPersonel); // Bakiyeyi güncelle

        } catch (error) {
            alert("Hata: " + (error.response?.data?.mesaj || error.message));
        } finally {
            setLoading(false);
        }
    };

    // Arama Filtresi
    const filtered = personeller.filter(p => p.ad.toLowerCase().includes(arama.toLowerCase()) || p.tc_no.includes(arama));

    return (
        <div className="container-fluid p-4">
            <h2 className="fw-bold mb-4 text-dark d-flex align-items-center gap-2">
                <FileText className="text-primary"/> İK Hızlı İzin Girişi
            </h2>

            <div className="row g-4">
                {/* SOL KOLON: PERSONEL LİSTESİ */}
                <div className="col-lg-3">
                    <div className="card shadow-sm border-0 rounded-4 h-100">
                        <div className="card-header bg-white p-3">
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0"><Search size={18}/></span>
                                <input type="text" className="form-control border-start-0 bg-light" placeholder="Personel Ara..." value={arama} onChange={e=>setArama(e.target.value)}/>
                            </div>
                        </div>
                        <div className="card-body p-0 overflow-auto" style={{maxHeight: '750px'}}>
                            <div className="list-group list-group-flush">
                                {filtered.map(p => (
                                    <button 
                                        key={p.personel_id} 
                                        className={`list-group-item list-group-item-action d-flex align-items-center gap-3 py-3 ${secilenPersonel?.personel_id === p.personel_id ? 'active' : ''}`}
                                        onClick={() => selectPersonel(p)}
                                    >
                                        <div className="bg-light text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{width:'40px', height:'40px'}}>
                                            {p.ad.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="fw-bold">{p.ad} {p.soyad}</div>
                                            <div className="small opacity-75">{p.birim_adi}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* SAĞ KOLON: İZİN FORMU (CreateLeave ile Aynı Tasarım) */}
                <div className="col-lg-9">
                    {secilenPersonel ? (
                        <div className="card shadow-lg border-0 rounded-4">
                            {/* ÜST BİLGİ VE BAKİYE */}
                            <div className="card-header bg-light p-4 border-bottom">
                                <div className="alert alert-success d-flex align-items-center justify-content-between shadow-sm border-0 mb-0 rounded-3 px-4">
                                    <div>
                                        <strong className="d-block text-success fs-5">{secilenPersonel.ad} {secilenPersonel.soyad}</strong>
                                        <small className="text-muted">Kalan Yıllık İzin Hakkı</small>
                                    </div>
                                    <div className="display-6 fw-bold text-success">{bakiyeBilgisi !== null ? bakiyeBilgisi : '...'} <span className="fs-6">Gün</span></div>
                                </div>
                            </div>

                            <div className="card-body p-4">
                                <div className="alert alert-warning d-flex align-items-center gap-2 small mb-4">
                                    <AlertTriangle size={18}/>
                                    <strong>YÖNETİCİ MODU:</strong> Bu alandan girilen izinler onay sürecine girmeden direkt onaylanır.
                                </div>

                                <form onSubmit={handleSubmit}>
                                    <div className="row g-3">
                                        <div className="col-md-6">
                                            <label className="form-label fw-bold">İzin Türü</label>
                                            <select className="form-select" value={formData.izin_turu} onChange={e => setFormData({...formData, izin_turu: e.target.value})}>
                                                {izinTurleri.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label fw-bold">Haftalık İzin</label>
                                            <select className="form-select" value={formData.haftalik_izin} onChange={e => setFormData({...formData, haftalik_izin: e.target.value})}>
                                                {gunler.map(g => <option key={g} value={g}>{g}</option>)}
                                            </select>
                                        </div>

                                        <div className="col-md-6">
                                            <label className="form-label fw-bold">Başlangıç</label>
                                            <input type="date" className="form-control" value={formData.baslangic_tarihi} onChange={e => setFormData({...formData, baslangic_tarihi: e.target.value})} required />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label fw-bold">Gün Sayısı</label>
                                            <input type="number" className="form-control" min="1" value={formData.gun_sayisi} onChange={e => setFormData({...formData, gun_sayisi: e.target.value})} required />
                                        </div>

                                        <div className="col-12">
                                            <div className="alert alert-light border text-center text-muted">
                                                <span className="me-3">📅 Bitiş: <strong>{hesaplanan.bitis}</strong></span>
                                                <span>🚀 İşe Başlama: <strong>{hesaplanan.ise_baslama}</strong></span>
                                            </div>
                                        </div>

                                        {/* ADRES SEÇİMİ */}
                                        <div className="col-12">
                                            <label className="form-label fw-bold"><MapPin size={16}/> İzin Adresi</label>
                                            <div className="d-flex gap-3 mb-2">
                                                <div className="form-check">
                                                    <input className="form-check-input" type="radio" name="adres" checked={formData.adres_secimi === 'MEVCUT'} onChange={() => setFormData({...formData, adres_secimi: 'MEVCUT'})} />
                                                    <label className="form-check-label">İkametgah ({secilenPersonel.adres ? 'Dolu' : 'Boş'})</label>
                                                </div>
                                                <div className="form-check">
                                                    <input className="form-check-input" type="radio" name="adres" checked={formData.adres_secimi === 'DIGER'} onChange={() => setFormData({...formData, adres_secimi: 'DIGER'})} />
                                                    <label className="form-check-label">Farklı Bir Adres</label>
                                                </div>
                                            </div>
                                            <textarea className="form-control" rows="2" value={formData.izin_adresi} onChange={e => setFormData({...formData, izin_adresi: e.target.value})} disabled={formData.adres_secimi === 'MEVCUT'} required></textarea>
                                        </div>

                                        <div className="col-12">
                                            <label className="form-label fw-bold">Açıklama</label>
                                            <textarea className="form-control" rows="2" value={formData.aciklama} onChange={e => setFormData({...formData, aciklama: e.target.value})}></textarea>
                                        </div>

                                        {/* İMZA ALANI */}
                                        <div className="col-12">
                                            <label className="form-label fw-bold text-danger"><PenTool size={16}/> İmza (İK Yetkilisi)</label>
                                            <div className="border rounded shadow-sm bg-light" style={{width: '100%', height: 200}}>
                                                <SignatureCanvas ref={sigCanvas} penColor='black' canvasProps={{className: 'sigCanvas w-100 h-100'}} />
                                            </div>
                                            <button type="button" className="btn btn-link btn-sm text-secondary ps-0" onClick={() => sigCanvas.current.clear()}>Temizle</button>
                                        </div>

                                        <div className="col-12 text-end mt-4">
                                            <button type="submit" className="btn btn-primary px-5 fw-bold" disabled={loading}>
                                                {loading ? 'İşleniyor...' : <><Save size={18} className="me-2"/> Talebi İmzala ve Kaydet</>}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    ) : (
                        <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted border rounded-4 bg-light p-5" style={{minHeight: '600px'}}>
                            <User size={64} className="mb-3 opacity-25"/>
                            <h5>Personel Seçiniz</h5>
                            <p>İzin girişi yapmak için soldaki listeden bir personel seçin.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}