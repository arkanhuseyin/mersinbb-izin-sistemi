import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Calendar, FileText, Save, ArrowLeft, MapPin, PenTool } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

export default function CreateLeave() {
    const navigate = useNavigate();
    const sigCanvas = useRef({});
    
    const [formData, setFormData] = useState({
        baslangic_tarihi: new Date().toISOString().split('T')[0],
        gun_sayisi: 1,
        izin_turu: 'YILLIK İZİN',
        haftalik_izin: 'Pazar',
        aciklama: '',
        // YENİ ALANLAR
        adres_secimi: 'MEVCUT',
        izin_adresi: '' 
    });

    const [kullaniciAdresi, setKullaniciAdresi] = useState('');
    const [hesaplanan, setHesaplanan] = useState({ bitis: '', ise_baslama: '' });
    const [resmiTatiller, setResmiTatiller] = useState([]);
    
    // ✅ EKLENDİ: Bakiye State
    const [bakiye, setBakiye] = useState(null);

    const izinTurleri = ["YILLIK İZİN", "MAZERET İZNİ", "RAPOR", "BABALIK İZNİ", "DOĞUM İZNİ", "DÜĞÜN İZNİ", "EVLİLİK İZNİ", "ÖLÜM İZNİ", "ÜCRETLİ İZİN", "ÜCRETSİZ İZİN"];
    const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

    useEffect(() => {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));
        if(user) {
            setKullaniciAdresi(user.adres || '');
            setFormData(prev => ({ ...prev, izin_adresi: user.adres || '' }));
        }

        // 1. Tatilleri Çek
        axios.get('https://mersinbb-izin-sistemi.onrender.com/api/izin/resmi-tatiller', {
            headers: { Authorization: `Bearer ${token}` }
        }).then(res => setResmiTatiller(res.data.map(t => t.tarih.split('T')[0]))).catch(console.error);

        // 2. ✅ EKLENDİ: Bakiyeyi Çek
        axios.get('https://mersinbb-izin-sistemi.onrender.com/api/personel/bakiye', {
            headers: { Authorization: `Bearer ${token}` }
        }).then(res => setBakiye(res.data.kalan_izin)).catch(console.error);

    }, []);

    // Adres Seçimi Değişince
    useEffect(() => {
        if(formData.adres_secimi === 'MEVCUT') {
            setFormData(prev => ({ ...prev, izin_adresi: kullaniciAdresi }));
        } else {
            setFormData(prev => ({ ...prev, izin_adresi: '' }));
        }
    }, [formData.adres_secimi]);

    // Hesaplama Motoru (Aynı kod)
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
            const dStr = donus.toISOString().split('T')[0]; const dIdx = donus.getDay(); const dName = dIdx === 0 ? "Pazar" : gunler[dIdx - 1];
            if (!resmiTatiller.includes(dStr) && dName !== formData.haftalik_izin) break;
            donus.setDate(donus.getDate() + 1);
        }
        const baslamaStr = donus.toLocaleDateString('tr-TR');
        setHesaplanan({ bitis: bitisStr, ise_baslama: baslamaStr });
    }, [formData.baslangic_tarihi, formData.gun_sayisi, formData.haftalik_izin, resmiTatiller]);

    const gonder = async (e) => {
        e.preventDefault();
        if (sigCanvas.current.isEmpty()) { alert("Lütfen kutuya imzanızı atınız."); return; }

        try {
            const token = localStorage.getItem('token');
            const imza = sigCanvas.current.getCanvas().toDataURL('image/png');

            const gonderilecekVeri = {
                ...formData,
                bitis_tarihi: hesaplanan.bitis.split('.').reverse().join('-'), 
                ise_baslama: hesaplanan.ise_baslama.split('.').reverse().join('-'),
                kac_gun: parseInt(formData.gun_sayisi),
                personel_imza: imza // YENİ: İmza gönderiliyor
            };

            await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/izin/olustur', gonderilecekVeri, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            alert("✅ İzin talebiniz oluşturuldu ve imzalandı!");
            navigate('/dashboard/leaves');
        } catch (error) {
            console.error(error);
            alert("❌ Hata: Talep oluşturulamadı.");
        }
    };

    return (
        <div className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h3 className="fw-bold text-primary m-0"><FileText className="me-2"/>Yeni İzin Talebi</h3>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}><ArrowLeft size={16}/> Geri Dön</button>
            </div>

            {/* ✅ EKLENDİ: BAKİYE BİLGİSİ KUTUCUĞU */}
            <div className="alert alert-success d-flex align-items-center justify-content-between shadow-sm border-0 mb-4 rounded-3 px-4">
                <div>
                    <strong className="d-block text-success">Kalan Yıllık İzin Hakkınız</strong>
                    <small className="text-muted">Güncel bakiyeniz</small>
                </div>
                <div className="display-6 fw-bold text-success">{bakiye !== null ? bakiye : '-'} <span className="fs-6">Gün</span></div>
            </div>

            <div className="card shadow-sm border-0">
                <div className="card-body p-4">
                    <form onSubmit={gonder}>
                        <div className="row g-3">
                            
                            <div className="col-md-6"><label className="form-label fw-bold">İzin Türü</label><select className="form-select" value={formData.izin_turu} onChange={e => setFormData({...formData, izin_turu: e.target.value})}>{izinTurleri.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                            <div className="col-md-6"><label className="form-label fw-bold">Haftalık İzin</label><select className="form-select" value={formData.haftalik_izin} onChange={e => setFormData({...formData, haftalik_izin: e.target.value})}>{gunler.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                            <div className="col-md-6"><label className="form-label fw-bold">Başlangıç</label><input type="date" className="form-control" value={formData.baslangic_tarihi} onChange={e => setFormData({...formData, baslangic_tarihi: e.target.value})} required /></div>
                            <div className="col-md-6"><label className="form-label fw-bold">Gün Sayısı</label><input type="number" className="form-control" min="1" value={formData.gun_sayisi} onChange={e => setFormData({...formData, gun_sayisi: e.target.value})} required /></div>

                            <div className="col-12"><div className="alert alert-light border text-center"><strong>Bitiş:</strong> {hesaplanan.bitis} | <strong>İşe Başlama:</strong> {hesaplanan.ise_baslama}</div></div>

                            {/* YENİ: ADRES SEÇİMİ */}
                            <div className="col-12">
                                <label className="form-label fw-bold"><MapPin size={16}/> İzin Adresi</label>
                                <div className="d-flex gap-3 mb-2">
                                    <div className="form-check">
                                        <input className="form-check-input" type="radio" name="adres" checked={formData.adres_secimi === 'MEVCUT'} onChange={() => setFormData({...formData, adres_secimi: 'MEVCUT'})} />
                                        <label className="form-check-label">İkametgah Adresim</label>
                                    </div>
                                    <div className="form-check">
                                        <input className="form-check-input" type="radio" name="adres" checked={formData.adres_secimi === 'DIGER'} onChange={() => setFormData({...formData, adres_secimi: 'DIGER'})} />
                                        <label className="form-check-label">Farklı Bir Adres</label>
                                    </div>
                                </div>
                                <textarea className="form-control" rows="2" value={formData.izin_adresi} onChange={e => setFormData({...formData, izin_adresi: e.target.value})} disabled={formData.adres_secimi === 'MEVCUT'} required></textarea>
                            </div>

                            <div className="col-12"><label className="form-label fw-bold">Açıklama</label><textarea className="form-control" rows="2" value={formData.aciklama} onChange={e => setFormData({...formData, aciklama: e.target.value})}></textarea></div>

                            {/* YENİ: İMZA ALANI */}
                            <div className="col-12">
                                <label className="form-label fw-bold text-danger"><PenTool size={16}/> İmza (Zorunlu)</label>
                                <div className="border rounded shadow-sm bg-light" style={{width: '100%', height: 200}}>
                                    <SignatureCanvas ref={sigCanvas} penColor='black' canvasProps={{className: 'sigCanvas w-100 h-100'}} />
                                </div>
                                <button type="button" className="btn btn-link btn-sm text-secondary" onClick={() => sigCanvas.current.clear()}>Temizle</button>
                            </div>

                            <div className="col-12 text-end mt-4">
                                <button type="submit" className="btn btn-primary px-5 fw-bold"><Save size={18} className="me-2"/> Talebi İmzala ve Gönder</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}