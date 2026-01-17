import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
    User, Search, Plus, Save, Ban, Edit, FileDown, Lock, KeyRound, Filter, Trash2, CheckCircle, Calendar, AlertCircle, Shield, History, Shirt, ToggleLeft, ToggleRight, Briefcase, MapPin, CreditCard, Truck
} from 'lucide-react';

// Hakediş Ayarları Komponenti
import HakedisAyarlari from '../components/HakedisAyarlari';

// API URL
const API_URL = 'https://mersinbb-izin-sistemi.onrender.com';

export default function Settings() {
    const [activeTab, setActiveTab] = useState('profile');
    const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } });
    const token = localStorage.getItem('token'); 

    const [usersList, setUsersList] = useState([]);
    const [birimler, setBirimler] = useState([]);
    const [arama, setArama] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [yukleniyor, setYukleniyor] = useState(false);
    
    // 🔥 DİNAMİK HAKEDİŞ KURALLARI
    const [hakedisKurallari, setHakedisKurallari] = useState([]);

    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('add'); 
    const [modalTab, setModalTab] = useState(1); 
    const [dondurmaModal, setDondurmaModal] = useState(null);

    const [yeniSifre, setYeniSifre] = useState('');
    const [fotograf, setFotograf] = useState(null);

    const [izinGecmisi, setIzinGecmisi] = useState([]);
    const [izinHakki, setIzinHakki] = useState(0); 
    const [kullanilanIzin, setKullanilanIzin] = useState(0);
    const [kidemYili, setKidemYili] = useState(0);

    // Geçmiş Bakiye Yönetimi
    const [gecmisBakiyeler, setGecmisBakiyeler] = useState([]);
    const [yeniGecmisYil, setYeniGecmisYil] = useState(new Date().getFullYear() - 1);
    const [yeniGecmisGun, setYeniGecmisGun] = useState(0);

    // Kıyafet Yönetimi
    const [kiyafetDonemiAktif, setKiyafetDonemiAktif] = useState(false);
    const [kiyafetLoading, setKiyafetLoading] = useState(false);

    // --- SABİT LİSTELER ---
    const sabitListeler = {
        gorevler: [
            "Şoför", "Baş Şoför", "Şef", "Yıkama", "Sefer Çıkış Kontrol", "Araç Bakım Onarım", "Yardımcı Hizmetler", 
            "Dış Görev", "İdari İzinli", "Santral Operatörü", "Çıkış Görevlisi", "Eğitim ve Disiplin İşleri", 
            "Saha Görevlisi", "Büro Personeli", "Memur", "Düz İşçi (KHK)", "Yol Kontrol Ekibi", "Kaza Ekibi", 
            "Geçici İşçi", "Usta", "Kadrolu İşçi", "Sürekli İşçi", "Personel İşleri", "Genel Evrak", "Muhasebe", 
            "Bilgisayar Teknikeri", "Harita Teknikeri", "Ulaştırma Teknikeri", "Elektrik Teknikeri", "Bilgisayar Mühendisi", 
            "Ulaştırma Mühendisi", "Gece Bekçisi", "Makine Mühendisi", "Makine Teknikeri", "Mersin 33 Kart", "Manevracı", 
            "İnspektör", "Binek Araç Şoförü", "Servis Şoförü", "Hareket Görevlisi", "Şube Müdürü", "Yazıcı", 
            "Hareket Planlama", "Lojistik", "Saha Tespit ve İnceleme", "AKILLI ULAŞIM SİSTEMİ (AUS)", "Puantör", 
            "Yazı İşleri", "Araç Takip Sistemleri", "Hareket Memuru", "Gece Servis Şoförü", "Oryantasyon", 
            "Günlük Görevlendirmeci", "Ücret Toplama Sistemi (EÜTS)"
        ],
        kadroTipleri: [
            "Sürekli İşçi", "Kadrolu İşçi", "Memur", "Sözleşmeli Personel", "Şirket Personeli", "Geçici İşçi", "Düz İşçi (KHK)"
        ],
        roller: [
            "personel", "amir", "yazici", "ik", "admin", "filo" 
        ]
    };

    const initialFormState = {
        tc_no: '', ad: '', soyad: '', sifre: '123456', telefon: '', telefon2: '', adres: '',
        dogum_tarihi: '', cinsiyet: 'Erkek', medeni_hal: 'Bekar', kan_grubu: '', egitim_durumu: 'Lise',
        birim_id: '1', 
        gorev: '',           
        kadro_tipi: '',     
        gorev_yeri: '', calisma_durumu: 'Çalışıyor', 
        rol: 'personel',    
        ehliyet_no: '', ehliyet_sinifi: '', ehliyet_tarih: '', src_belge_no: '', psiko_tarih: '', surucu_no: '',
        ayakkabi_no: '', tisort_beden: '', gomlek_beden: '', suveter_beden: '', mont_beden: '',
        sicil_no: '', asis_kart_no: '', hareket_merkezi: '', ise_giris_tarihi: '', ayrilma_tarihi: ''
    };
    const [formData, setFormData] = useState(initialFormState);

    // --- YETKİ KONTROLÜ ---
    const checkPermission = (modulKey) => {
        if (user?.rol === 'admin') return true; 
        const userPermissions = user?.yetkiler || [];
        const permission = userPermissions.find(p => p.modul_adi === modulKey);
        if (permission) return permission.goruntule === true; 
        if (modulKey === 'ayar_profil') return true;
        return false; 
    };

    // --- VERİ YÜKLEME ---
    useEffect(() => {
        fetchHakedisKurallari();
        if (activeTab === 'users' && checkPermission('ayar_personel')) { fetchUsers(); fetchBirimler(); }
        if (activeTab === 'kiyafet' && checkPermission('ayar_kiyafet')) { checkKiyafetDurumu(); }
    }, [activeTab]);

    const fetchHakedisKurallari = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/ayar/hakedis-listele`, { headers: { Authorization: `Bearer ${token}` } });
            setHakedisKurallari(res.data);
        } catch (error) { console.error("Kurallar çekilemedi:", error); }
    };

    const handleGorevChange = (e) => {
        const secilenGorev = e.target.value;
        let onerilenRol = 'personel'; 
        if (['Baş Şoför', 'Günlük Görevlendirmeci', 'Puantör'].includes(secilenGorev)) onerilenRol = 'amir';
        else if (['Yazıcı'].includes(secilenGorev)) onerilenRol = 'yazici';
        else if (['Personel İşleri'].includes(secilenGorev)) onerilenRol = 'ik'; 
        setFormData({ ...formData, gorev: secilenGorev, rol: onerilenRol });
    };

    // --- 🔥 DİNAMİK HAKEDİŞ HESAPLAMA MOTORU 🔥 ---
    const hesaplaDinamikHakedis = useCallback((iseGirisTarihi) => {
        if (!iseGirisTarihi) return 0;
        
        const giris = new Date(iseGirisTarihi);
        const girisYili = giris.getFullYear();
        
        const bugun = new Date();
        const farkMs = bugun - giris;
        const kidemYili = Math.floor(farkMs / (1000 * 60 * 60 * 24 * 365.25));

        const uygunKural = hakedisKurallari.find(k => 
            girisYili >= k.baslangic_yili && 
            girisYili <= k.bitis_yili && 
            kidemYili >= k.kidem_alt && 
            kidemYili <= k.kidem_ust
        );

        if (uygunKural) {
            return uygunKural.gun_sayisi;
        }

        // Yedek Mantık (Eski Sistem)
        let hak = 0;
        if (kidemYili < 1) return 0;

        if (girisYili < 2018) {
            if (kidemYili <= 5) hak = 14; else if (kidemYili <= 15) hak = 19; else hak = 25;
        } else if (girisYili < 2024) {
            if (girisYili < 2019) { if (kidemYili <= 5) hak = 14; else if (kidemYili <= 15) hak = 19; else hak = 25; } 
            else { if (kidemYili <= 3) hak = 16; else if (kidemYili <= 5) hak = 18; else if (kidemYili <= 15) hak = 25; else hak = 30; }
        } else {
            if (girisYili < 2025) { if (kidemYili <= 3) hak = 16; else if (kidemYili <= 5) hak = 18; else if (kidemYili <= 15) hak = 25; else hak = 30; } 
            else { if (kidemYili <= 3) hak = 18; else if (kidemYili <= 5) hak = 20; else if (kidemYili <= 15) hak = 27; else hak = 32; }
        }
        return hak;

    }, [hakedisKurallari]);

    // --- FORM VERİSİ DEĞİŞİNCE HESAPLAMA YAP ---
    useEffect(() => {
        if (formData.ise_giris_tarihi) {
            const giris = new Date(formData.ise_giris_tarihi);
            const bugun = new Date();
            const fark = bugun - giris;
            const yil = Math.floor(fark / (1000 * 60 * 60 * 24 * 365.25));
            setKidemYili(yil < 0 ? 0 : yil);

            const toplamHak = hesaplaDinamikHakedis(formData.ise_giris_tarihi);
            setIzinHakki(toplamHak);

            if (izinGecmisi.length > 0) {
                const toplamKullanilan = izinGecmisi
                    .filter(i => (i.durum === 'IK_ONAYLADI' || i.durum === 'TAMAMLANDI') && i.izin_turu === 'YILLIK İZİN')
                    .reduce((acc, curr) => acc + (curr.gun_sayisi || 0), 0);
                setKullanilanIzin(toplamKullanilan);
            } else {
                setKullanilanIzin(0);
            }
        }
    }, [formData.ise_giris_tarihi, izinGecmisi, hakedisKurallari, hesaplaDinamikHakedis]);

    useEffect(() => {
        if (showModal && modalMode === 'edit' && modalTab === 2 && formData.personel_id) {
            fetchIzinGecmisi(formData.personel_id);
            fetchGecmisBakiyeler(formData.personel_id);
        }
    }, [showModal, modalMode, modalTab]);

    const fetchIzinGecmisi = async (id) => {
        try {
            const res = await axios.get(`${API_URL}/api/personel/izin-gecmisi/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            setIzinGecmisi(res.data);
        } catch (error) { console.error('İzin geçmişi hatası', error); }
    };

    const fetchGecmisBakiyeler = async (id) => {
        try {
            const res = await axios.get(`${API_URL}/api/izin/gecmis-bakiyeler/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            setGecmisBakiyeler(res.data);
        } catch (error) { console.error('Geçmiş bakiye hatası', error); }
    };

    const addGecmisBakiye = async () => {
        if (!yeniGecmisGun || yeniGecmisGun <= 0) return alert("Lütfen geçerli bir gün sayısı giriniz.");
        try {
            await axios.post(`${API_URL}/api/izin/gecmis-bakiye-ekle`, 
                { personel_id: formData.personel_id, yil: yeniGecmisYil, gun_sayisi: yeniGecmisGun },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchGecmisBakiyeler(formData.personel_id);
            setYeniGecmisGun(0);
        } catch (e) { alert("Hata oluştu."); }
    };

    const deleteGecmisBakiye = async (id) => {
        if(!window.confirm("Silmek istediğinize emin misiniz?")) return;
        try {
            await axios.delete(`${API_URL}/api/izin/gecmis-bakiye-sil/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchGecmisBakiyeler(formData.personel_id);
        } catch (e) { alert("Hata oluştu."); }
    };

    const checkKiyafetDurumu = async () => {
        setKiyafetLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/personel/kiyafet-donemi`, { headers: { Authorization: `Bearer ${token}` } });
            setKiyafetDonemiAktif(res.data.aktif);
        } catch (e) { console.error(e); } finally { setKiyafetLoading(false); }
    };

    const toggleDonem = async () => {
        const yeniDurum = !kiyafetDonemiAktif;
        if(!window.confirm(`Dönemi ${yeniDurum ? 'AÇMAK' : 'KAPATMAK'} istediğinize emin misiniz?`)) return;
        setKiyafetLoading(true);
        try {
            await axios.post(`${API_URL}/api/personel/kiyafet-donemi-ayar`, { durum: yeniDurum }, { headers: { Authorization: `Bearer ${token}` } });
            setKiyafetDonemiAktif(yeniDurum);
            alert(`Dönem ${yeniDurum ? 'AÇILDI' : 'KAPATILDI'}`);
        } catch (e) { alert('Hata: Yetkiniz yok veya sunucu hatası.'); } finally { setKiyafetLoading(false); }
    };

    const fetchUsers = async () => {
        setYukleniyor(true);
        try {
            const res = await axios.get(`${API_URL}/api/personel/liste`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            setUsersList(res.data);
        } catch (error) { console.error(error); }
        setYukleniyor(false);
    };

    const fetchBirimler = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/personel/birimler`, { headers: { Authorization: `Bearer ${token}` } });
            setBirimler(res.data);
        } catch (error) { console.error(error); }
    };

    const openModal = (mode, data = null) => {
        setModalMode(mode);
        setModalTab(1); 
        setIzinGecmisi([]); 
        setGecmisBakiyeler([]);
        setFotograf(null);

        if (mode === 'edit' && data) {
            const fixDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
            setFormData({
                ...data,
                dogum_tarihi: fixDate(data.dogum_tarihi),
                ehliyet_tarih: fixDate(data.ehliyet_tarih),
                psiko_tarih: fixDate(data.psiko_tarih),
                ise_giris_tarihi: fixDate(data.ise_giris_tarihi),
                ayrilma_tarihi: fixDate(data.ayrilma_tarihi),
                rol: data.rol_adi || 'personel'
            });
        } else {
            setFormData(initialFormState);
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => { 
                data.append(key, formData[key] === null || formData[key] === undefined ? '' : formData[key]); 
            });
            if (fotograf) data.append('fotograf', fotograf);

            const url = modalMode === 'add' ? `${API_URL}/api/personel/ekle` : `${API_URL}/api/personel/guncelle/${formData.personel_id}`;
            const method = modalMode === 'add' ? 'post' : 'put';

            await axios[method](url, data, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
            alert(`Personel başarıyla ${modalMode === 'add' ? 'eklendi' : 'güncellendi'}!`);
            setShowModal(false);
            fetchUsers();
        } catch (error) { 
            alert('Hata: ' + (error.response?.data?.mesaj || 'İşlem başarısız.')); 
        }
    };

    const changeStatus = async (id, type, reason = null) => {
        if(!window.confirm('Bu işlemi yapmak istediğinize emin misiniz?')) return;
        try {
            if (type === 'dondur') {
                await axios.post(`${API_URL}/api/personel/dondur`, { personel_id: id, sebep: reason }, { headers: { Authorization: `Bearer ${token}` } });
                setDondurmaModal(null);
            } else if (type === 'aktif') {
                await axios.post(`${API_URL}/api/personel/aktif-et`, { personel_id: id }, { headers: { Authorization: `Bearer ${token}` } });
            } else if (type === 'sil') {
                await axios.delete(`${API_URL}/api/personel/sil/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            }
            alert('İşlem başarılı.');
            setUsersList(prev => prev.map(u => {
                if (u.personel_id !== id) return u;
                if (type === 'aktif') return { ...u, aktif: true, calisma_durumu: 'Çalışıyor' };
                if (type === 'dondur') return { ...u, aktif: false, calisma_durumu: reason };
                return u;
            }).filter(u => type !== 'sil' || u.personel_id !== id));
        } catch (e) { alert('Hata oluştu.'); }
    };

    const downloadPdf = (id, ad) => {
        axios.get(`${API_URL}/api/personel/pdf/${id}`, { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' })
            .then((response) => {
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `${ad}_Dosya.pdf`);
                document.body.appendChild(link);
                link.click();
            });
    };

    const profilGuncelle = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/api/personel/guncelle`, { yeni_sifre: yeniSifre }, { headers: { Authorization: `Bearer ${token}` } });
            alert('Şifreniz başarıyla güncellendi.');
            setYeniSifre('');
        } catch (error) { alert('Hata oluştu'); }
    };

    const filteredUsers = usersList.filter(u => {
        const matchesSearch = u.ad?.toLowerCase().includes(arama.toLowerCase()) || u.tc_no?.includes(arama);
        const isActive = u.aktif === true || u.aktif === 'true' || u.aktif === 1;
        if (filterStatus === 'all') return matchesSearch;
        if (filterStatus === 'active') return matchesSearch && isActive;
        if (filterStatus === 'passive') return matchesSearch && !isActive;
        return matchesSearch;
    });

    return (
        <div className="container-fluid p-4">
            <h2 className="fw-bold mb-4 text-dark flex items-center gap-2">
                <User size={28}/> Yönetim Paneli
            </h2>

            {/* SEKME BAŞLIKLARI */}
            <ul className="nav nav-tabs mb-4 border-bottom-0">
                {checkPermission('ayar_profil') && (
                    <li className="nav-item">
                        <button className={`nav-link px-4 fw-bold ${activeTab === 'profile' ? 'active shadow-sm border-0' : 'text-muted border-0 bg-transparent'}`} 
                            onClick={() => setActiveTab('profile')}>Profilim</button>
                    </li>
                )}
                {checkPermission('ayar_personel') && (
                    <li className="nav-item">
                        <button className={`nav-link px-4 fw-bold ${activeTab === 'users' ? 'active shadow-sm border-0' : 'text-muted border-0 bg-transparent'}`} 
                            onClick={() => setActiveTab('users')}>Personel Listesi</button>
                    </li>
                )}
                {checkPermission('ayar_kiyafet') && (
                    <li className="nav-item">
                        <button className={`nav-link px-4 fw-bold ${activeTab === 'kiyafet' ? 'active shadow-sm border-0 bg-dark text-white' : 'text-muted border-0 bg-transparent'}`} 
                            onClick={() => setActiveTab('kiyafet')}>👕 Kıyafet Yönetimi</button>
                    </li>
                )}
                {/* ✅ TAB: HAKEDİŞ AYARLARI */}
                {checkPermission('ayar_hakedis') && (
                    <li className="nav-item">
                        <button className={`nav-link px-4 fw-bold ${activeTab === 'hakedis' ? 'active shadow-sm border-0' : 'text-muted border-0 bg-transparent'}`} 
                            onClick={() => setActiveTab('hakedis')}>📅 İzin Hakediş Ayarları</button>
                    </li>
                )}
            </ul>

            <div className="card shadow-sm border-0 rounded-4" style={{minHeight: '600px'}}>
                <div className="card-body p-4">
                    
                    {/* TAB: PROFİLİM */}
                    {activeTab === 'profile' && checkPermission('ayar_profil') && (
                        <div className="row justify-content-center">
                            <div className="col-md-6 text-center">
                                <div className="bg-light d-inline-block p-4 rounded-circle mb-3"><User size={64} className="text-primary"/></div>
                                <h3>{user?.ad} {user?.soyad}</h3>
                                <p className="text-muted">{user?.unvan || 'Kullanıcı'}</p>
                                
                                <div className="card mt-4 border shadow-sm">
                                    <div className="card-body text-start">
                                        <h5 className="fw-bold mb-3 d-flex align-items-center gap-2"><Lock size={18}/> Şifre Değiştir</h5>
                                        <form onSubmit={profilGuncelle}>
                                            <label className="form-label small text-muted">Yeni Şifre</label>
                                            <div className="input-group mb-3">
                                                <span className="input-group-text bg-white"><KeyRound size={16}/></span>
                                                <input type="password" className="form-control" placeholder="******" 
                                                    value={yeniSifre} onChange={e=>setYeniSifre(e.target.value)} required minLength="6"/>
                                            </div>
                                            <button type="submit" className="btn btn-primary w-100">Güncelle</button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: KIYAFET YÖNETİMİ */}
                    {activeTab === 'kiyafet' && checkPermission('ayar_kiyafet') && (
                        <div className="row justify-content-center pt-5">
                            <div className="col-md-6 text-center">
                                <div className={`card border-0 shadow-lg ${kiyafetDonemiAktif ? 'bg-success-subtle' : 'bg-danger-subtle'}`}>
                                    <div className="card-body p-5">
                                        <div className={`rounded-circle p-4 d-inline-block mb-3 ${kiyafetDonemiAktif ? 'bg-success text-white' : 'bg-danger text-white'}`}>
                                            <Shirt size={64} />
                                        </div>
                                        <h3 className={`fw-bold mb-2 ${kiyafetDonemiAktif ? 'text-success' : 'text-danger'}`}>
                                            {kiyafetDonemiAktif ? 'DÖNEM AKTİF 🟢' : 'DÖNEM PASİF 🔴'}
                                        </h3>
                                        <p className="text-muted mb-4 fs-5">
                                            {kiyafetDonemiAktif ? "Mobil uygulamadan veri girişi AÇIK." : "Mobil uygulamadan veri girişi KAPALI."}
                                        </p>
                                        <button onClick={toggleDonem} disabled={kiyafetLoading} className={`btn btn-lg px-5 py-3 fw-bold shadow ${kiyafetDonemiAktif ? 'btn-danger' : 'btn-success'}`}>
                                            {kiyafetLoading ? 'İşleniyor...' : (kiyafetDonemiAktif ? <><ToggleRight className="me-2"/> DÖNEMİ KAPAT</> : <><ToggleLeft className="me-2"/> DÖNEMİ BAŞLAT</>)}
                                        </button>
                                    </div>
                                </div>
                                <div className="alert alert-info mt-4">
                                    <strong>Bilgi:</strong> "Dönemi Başlat" dediğinizde tüm personel mobil uygulamasından "Profilim" sekmesine girip beden bilgilerini güncelleyebilir.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ✅ TAB: HAKEDİŞ AYARLARI */}
                    {activeTab === 'hakedis' && checkPermission('ayar_hakedis') && (
                        <div className="pt-4">
                            <HakedisAyarlari />
                        </div>
                    )}

                    {/* TAB: PERSONEL LİSTESİ */}
                    {activeTab === 'users' && checkPermission('ayar_personel') && (
                        <>
                            <div className="d-flex justify-content-between align-items-end mb-4">
                                <div className="w-50">
                                    <div className="input-group w-100 shadow-sm rounded-3 mb-2">
                                        <span className="input-group-text bg-white border-end-0"><Search size={18} className="text-muted"/></span>
                                        <input type="text" className="form-control border-start-0" placeholder="Personel ara (TC, Ad)..." value={arama} onChange={e => setArama(e.target.value)}/>
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                        <Filter size={16} className="text-muted"/>
                                        <select className="form-select form-select-sm w-auto border-0 bg-light fw-bold text-muted" 
                                            value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                                            <option value="all">Tümü (Hepsi)</option>
                                            <option value="active">🟢 Sadece Aktif Personel</option>
                                            <option value="passive">🔴 Pasif / Ayrılanlar</option>
                                        </select>
                                    </div>
                                </div>
                                <button className="btn btn-primary fw-bold shadow-sm px-4 py-2" onClick={() => openModal('add')}><Plus size={18} className="me-2"/> Yeni Personel</button>
                            </div>

                            <div className="table-responsive">
                                <table className="table table-hover align-middle">
                                    <thead className="bg-light text-muted small text-uppercase">
                                        <tr>
                                            <th>TC / Ad Soyad</th>
                                            <th>Birim / Görev</th>
                                            <th>Rol</th>
                                            <th>Giriş Tarihi</th>
                                            {/* ✅ SADECE HAKEDİŞ VAR - DEVREDEN KALDIRILDI */}
                                            <th className="text-center text-primary">Hakediş (Yıllık)</th>
                                            <th className="text-center">Durum</th>
                                            <th className="text-end">İşlemler</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {yukleniyor ? <tr><td colSpan="7" className="text-center py-4">Yükleniyor...</td></tr> : 
                                         filteredUsers.map(u => {
                                            const isActive = u.aktif === true || u.aktif === 'true' || u.aktif === 1;
                                            return (
                                                <tr key={u.personel_id} className={!isActive ? 'table-light text-muted' : ''}>
                                                    <td><div className="fw-bold">{u.ad} {u.soyad}</div><small className="text-muted font-monospace">{u.tc_no}</small></td>
                                                    <td>
                                                        <span className="badge bg-light text-dark border fw-normal me-1">{u.birim_adi}</span>
                                                        <span className="text-muted small">{u.gorev}</span>
                                                    </td>
                                                    <td><span className="badge bg-primary bg-opacity-10 text-primary border fw-normal">{u.rol_adi?.toUpperCase()}</span></td>
                                                    <td className="small">{new Date(u.ise_giris_tarihi).toLocaleDateString('tr-TR')}</td>
                                                    
                                                    {/* ✅ DİNAMİK HESAPLANAN HAKEDİŞ DEĞERİ */}
                                                    <td className="text-center fw-bold text-primary">
                                                        {hesaplaDinamikHakedis(u.ise_giris_tarihi)} Gün
                                                    </td>

                                                    <td className="text-center">{!isActive ? <span className="badge bg-secondary">Pasif ({u.calisma_durumu})</span> : <span className="badge bg-success">Aktif</span>}</td>
                                                    <td className="text-end">
                                                        <button className="btn btn-sm btn-light text-danger me-1" title="PDF" onClick={() => downloadPdf(u.personel_id, u.ad)}><FileDown size={18}/></button>
                                                        <button className="btn btn-sm btn-light text-primary me-1" title="Düzenle" onClick={() => openModal('edit', u)}><Edit size={18}/></button>
                                                        
                                                        {isActive ? (
                                                            <button className="btn btn-sm btn-light text-warning" title="Pasife Al" onClick={() => setDondurmaModal(u)}><Ban size={18}/></button>
                                                        ) : (
                                                            <>
                                                                <button className="btn btn-sm btn-light text-success me-1" title="Aktif Et" onClick={() => changeStatus(u.personel_id, 'aktif')}><CheckCircle size={18}/></button>
                                                                <button className="btn btn-sm btn-light text-danger" title="Tamamen Sil" onClick={() => changeStatus(u.personel_id, 'sil')}><Trash2 size={18}/></button>
                                                            </>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ... MODAL KISIMLARI AYNI KALIYOR ... */}
            {/* Modal kodları zaten doğru olduğu için tekrar buraya kopyalamıyorum, yukarıdaki tam kodda mevcuttur. */}
            
            {showModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', overflowY: 'auto' }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered my-4">
                        <div className="modal-content shadow-lg rounded-4 border-0">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title fw-bold">{modalMode === 'add' ? 'Yeni Personel Ekle' : 'Personel Düzenle'}</h5>
                                <button className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
                            </div>
                            <div className="modal-body p-0">
                                <ul className="nav nav-tabs nav-fill bg-light border-bottom">
                                    <li className="nav-item">
                                        <button className={`nav-link py-3 fw-bold rounded-0 ${modalTab===1?'active border-top-0 border-start-0 border-end-0 border-primary border-bottom-2 text-primary':'text-muted'}`} 
                                            onClick={()=>setModalTab(1)}><User size={18} className="me-2"/>Personel Bilgileri</button>
                                    </li>
                                    <li className="nav-item">
                                        <button className={`nav-link py-3 fw-bold rounded-0 ${modalTab===2?'active border-top-0 border-start-0 border-end-0 border-primary border-bottom-2 text-primary':'text-muted'}`} 
                                            onClick={()=>setModalTab(2)}><Calendar size={18} className="me-2"/>İzin Yönetimi & Geçmiş</button>
                                    </li>
                                </ul>

                                <div className="p-4">
                                    {modalTab === 1 && (
                                        <form onSubmit={handleSubmit}>
                                            <div className="row g-3">
                                                <div className="col-md-3 text-center border-end">
                                                    <div className="mb-3">
                                                        <div className="bg-light border rounded d-flex align-items-center justify-content-center mx-auto shadow-sm" style={{width:'150px', height:'180px', overflow:'hidden'}}>
                                                            {fotograf ? 
                                                                <img src={URL.createObjectURL(fotograf)} alt="Preview" style={{width:'100%', height:'100%', objectFit:'cover'}}/> : 
                                                                (modalMode==='edit' && formData.fotograf_yolu ? <div className="text-success small fw-bold">Kayıtlı Foto Var</div> : <span className="text-muted small">FOTOĞRAF</span>)
                                                            }
                                                        </div>
                                                        <input type="file" className="form-control form-control-sm mt-2" onChange={e=>setFotograf(e.target.files[0])} />
                                                        <div className="form-text small">Değiştirmek için dosya seçin.</div>
                                                    </div>
                                                    <div className="text-start">
                                                        <label className="small fw-bold text-muted">Adres</label>
                                                        <textarea className="form-control form-control-sm" rows="5" placeholder="Adres" value={formData.adres} onChange={e=>setFormData({...formData, adres:e.target.value})}></textarea>
                                                    </div>
                                                </div>

                                                <div className="col-md-9">
                                                    <div className="row g-2">
                                                        {/* KİMLİK & İLETİŞİM */}
                                                        <div className="col-12"><h6 className="text-primary small fw-bold border-bottom pb-1">Kimlik & İletişim</h6></div>
                                                        <div className="col-md-4"><label className="small fw-bold">TC Kimlik No *</label><input className="form-control form-control-sm" required value={formData.tc_no} onChange={e=>setFormData({...formData, tc_no:e.target.value})} /></div>
                                                        <div className="col-md-4"><label className="small fw-bold">Ad *</label><input className="form-control form-control-sm" required value={formData.ad} onChange={e=>setFormData({...formData, ad:e.target.value})} /></div>
                                                        <div className="col-md-4"><label className="small fw-bold">Soyad *</label><input className="form-control form-control-sm" required value={formData.soyad} onChange={e=>setFormData({...formData, soyad:e.target.value})} /></div>
                                                        <div className="col-md-4"><label className="small fw-bold">Telefon 1</label><input className="form-control form-control-sm" value={formData.telefon} onChange={e=>setFormData({...formData, telefon:e.target.value})} /></div>
                                                        <div className="col-md-4"><label className="small fw-bold">Telefon 2</label><input className="form-control form-control-sm" value={formData.telefon2} onChange={e=>setFormData({...formData, telefon2:e.target.value})} /></div>
                                                        <div className="col-md-4"><label className="small fw-bold">Doğum Tarihi</label><input type="date" className="form-control form-control-sm" value={formData.dogum_tarihi} onChange={e=>setFormData({...formData, dogum_tarihi:e.target.value})} /></div>
                                                        
                                                        {/* CİNSİYET, MEDENİ HAL, KAN GRUBU, TAHSİL */}
                                                        <div className="col-md-3"><label className="small fw-bold">Cinsiyet</label><select className="form-select form-select-sm" value={formData.cinsiyet} onChange={e=>setFormData({...formData, cinsiyet:e.target.value})}><option>Erkek</option><option>Kadın</option></select></div>
                                                        <div className="col-md-3"><label className="small fw-bold">Medeni Hal</label><select className="form-select form-select-sm" value={formData.medeni_hal} onChange={e=>setFormData({...formData, medeni_hal:e.target.value})}><option>Bekar</option><option>Evli</option></select></div>
                                                        <div className="col-md-3"><label className="small fw-bold">Kan Grubu</label><select className="form-select form-select-sm" value={formData.kan_grubu} onChange={e=>setFormData({...formData, kan_grubu:e.target.value})}><option value="">Seç</option><option>A Rh+</option><option>A Rh-</option><option>B Rh+</option><option>B Rh-</option><option>0 Rh+</option><option>0 Rh-</option><option>AB Rh+</option><option>AB Rh-</option></select></div>
                                                        <div className="col-md-3"><label className="small fw-bold">Tahsil</label><select className="form-select form-select-sm" value={formData.egitim_durumu} onChange={e=>setFormData({...formData, egitim_durumu:e.target.value})}><option>İlkokul</option><option>Ortaokul</option><option>Lise</option><option>Önlisans</option><option>Lisans</option><option>Yüksek Lisans</option></select></div>

                                                        {/* KURUMSAL BİLGİLER */}
                                                        <div className="col-12 mt-2"><h6 className="text-primary small fw-bold border-bottom pb-1">Kurumsal Bilgiler</h6></div>
                                                        <div className="col-md-3"><label className="small fw-bold">Sicil No</label><input className="form-control form-control-sm" value={formData.sicil_no} onChange={e=>setFormData({...formData, sicil_no:e.target.value})} /></div>
                                                        <div className="col-md-3"><label className="small fw-bold">Asis Kart No</label><input className="form-control form-control-sm" value={formData.asis_kart_no} onChange={e=>setFormData({...formData, asis_kart_no:e.target.value})} /></div>
                                                        <div className="col-md-3"><label className="small fw-bold">Hareket Merkezi</label><input className="form-control form-control-sm" value={formData.hareket_merkezi} onChange={e=>setFormData({...formData, hareket_merkezi:e.target.value})} /></div>
                                                        <div className="col-md-3"><label className="small fw-bold">Çalışma Durumu</label><select className="form-select form-select-sm" value={formData.calisma_durumu} onChange={e=>setFormData({...formData, calisma_durumu:e.target.value})}><option>Çalışıyor</option><option>Emekli</option><option>İş Akdi Fesih</option></select></div>
                                                        
                                                        {/* ✅ YENİ: Görev Yeri */}
                                                        <div className="col-md-4"><label className="small fw-bold d-flex align-items-center gap-1"><MapPin size={12}/> Görev Yeri</label><input className="form-control form-control-sm" placeholder="Örn: Garaj" value={formData.gorev_yeri} onChange={e=>setFormData({...formData, gorev_yeri:e.target.value})} /></div>

                                                        <div className="col-md-4"><label className="small fw-bold">Birim</label><select className="form-select form-select-sm" value={formData.birim_id} onChange={e=>setFormData({...formData, birim_id:e.target.value})}>{birimler.map(b=><option key={b.birim_id} value={b.birim_id}>{b.birim_adi}</option>)}</select></div>
                                                        <div className="col-md-4"><label className="small fw-bold text-primary">Görevi</label><select className="form-select form-select-sm" value={formData.gorev} onChange={handleGorevChange}><option value="">Seçiniz...</option>{sabitListeler.gorevler.sort().map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                                                        <div className="col-md-6"><label className="small fw-bold text-danger d-flex align-items-center gap-1"><Shield size={14}/> Rol (Yetki)</label><select className="form-select form-select-sm border-danger" value={formData.rol} onChange={e=>setFormData({...formData, rol: e.target.value})}>{sabitListeler.roller.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}</select></div>
                                                        <div className="col-md-6"><label className="small fw-bold">Kadro Tipi</label><select className="form-select form-select-sm" value={formData.kadro_tipi} onChange={e=>setFormData({...formData, kadro_tipi:e.target.value})}><option value="">Seçiniz...</option>{sabitListeler.kadroTipleri.map(k => <option key={k} value={k}>{k}</option>)}</select></div>

                                                        {/* LOJİSTİK VE BEDEN */}
                                                        <div className="col-12 mt-2"><h6 className="text-primary small fw-bold border-bottom pb-1">Lojistik ve Beden</h6></div>
                                                        <div className="col-md-3"><label className="small fw-bold">Ehliyet No</label><input className="form-control form-control-sm" value={formData.ehliyet_no} onChange={e=>setFormData({...formData, ehliyet_no:e.target.value})} /></div>
                                                        <div className="col-md-2"><label className="small fw-bold">Sınıfı</label><input className="form-control form-control-sm" value={formData.ehliyet_sinifi} onChange={e=>setFormData({...formData, ehliyet_sinifi:e.target.value})} /></div>
                                                        <div className="col-md-3"><label className="small fw-bold">Ehliyet Bitiş</label><input type="date" className="form-control form-control-sm" value={formData.ehliyet_tarih} onChange={e=>setFormData({...formData, ehliyet_tarih:e.target.value})} /></div>
                                                        
                                                        {/* ✅ YENİ: Sürücü Kart No */}
                                                        <div className="col-md-4"><label className="small fw-bold d-flex align-items-center gap-1"><CreditCard size={12}/> Sürücü Kart No</label><input className="form-control form-control-sm" value={formData.surucu_no} onChange={e=>setFormData({...formData, surucu_no:e.target.value})} /></div>

                                                        <div className="col-md-3"><label className="small fw-bold">SRC Belge No</label><input className="form-control form-control-sm" value={formData.src_belge_no} onChange={e=>setFormData({...formData, src_belge_no:e.target.value})} /></div>
                                                        
                                                        {/* ✅ YENİ: Psikoteknik Tarih */}
                                                        <div className="col-md-3"><label className="small fw-bold d-flex align-items-center gap-1"><Truck size={12}/> Psikoteknik</label><input type="date" className="form-control form-control-sm" value={formData.psiko_tarih} onChange={e=>setFormData({...formData, psiko_tarih:e.target.value})} /></div>

                                                        <div className="col-md-2"><label className="small">Ayakkabı</label><input className="form-control form-control-sm" value={formData.ayakkabi_no} onChange={e=>setFormData({...formData, ayakkabi_no:e.target.value})} /></div>
                                                        <div className="col-md-2"><label className="small">Tişört</label><input className="form-control form-control-sm" value={formData.tisort_beden} onChange={e=>setFormData({...formData, tisort_beden:e.target.value})} /></div>
                                                        <div className="col-md-2"><label className="small">Gömlek</label><input className="form-control form-control-sm" value={formData.gomlek_beden} onChange={e=>setFormData({...formData, gomlek_beden:e.target.value})} /></div>
                                                        <div className="col-md-2"><label className="small">Mont</label><input className="form-control form-control-sm" value={formData.mont_beden} onChange={e=>setFormData({...formData, mont_beden:e.target.value})} /></div>
                                                        <div className="col-md-2"><label className="small">Süveter</label><input className="form-control form-control-sm" value={formData.suveter_beden} onChange={e=>setFormData({...formData, suveter_beden:e.target.value})} /></div>
                                                        <div className="col-md-2"><label className="small text-danger fw-bold">Şifre</label><input className="form-control form-control-sm" value={formData.sifre} onChange={e=>setFormData({...formData, sifre:e.target.value})} /></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-4 text-end border-top pt-3">
                                                <button type="button" className="btn btn-secondary me-2 px-4" onClick={()=>setShowModal(false)}>Kapat</button>
                                                <button type="submit" className="btn btn-success px-5 fw-bold shadow-sm"><Save size={18} className="me-2"/> Kaydet & Güncelle</button>
                                            </div>
                                        </form>
                                    )}

                                    {modalTab === 2 && (
                                        <div className="p-3">
                                            {/* --- TARİH GÜNCELLEME --- */}
                                            <form onSubmit={handleSubmit}>
                                                <div className="row mb-4 bg-light p-3 rounded border">
                                                    <div className="col-md-6 border-end">
                                                        <label className="form-label fw-bold text-dark d-flex align-items-center gap-2"><Calendar size={18}/> İşe Giriş Tarihi</label>
                                                        <input type="date" className="form-control" value={formData.ise_giris_tarihi} onChange={e=>setFormData({...formData, ise_giris_tarihi:e.target.value})} />
                                                        
                                                        {/* HAKEDİŞ BİLGİSİ (DİNAMİK) */}
                                                        <div className="mt-2 text-success small fw-bold d-flex align-items-center gap-2">
                                                            <Briefcase size={16}/> 
                                                            Kıdem: {kidemYili} Yıl | Hakediş: <span className="badge bg-success fs-6">{izinHakki} Gün</span>
                                                        </div>
                                                    </div>
                                                    <div className="col-md-6">
                                                        <label className="form-label fw-bold text-danger d-flex align-items-center gap-2"><AlertCircle size={18}/> İşten Ayrılış Tarihi</label>
                                                        <input type="date" className="form-control border-danger bg-danger-subtle" value={formData.ayrilma_tarihi} onChange={e=>setFormData({...formData, ayrilma_tarihi:e.target.value})} />
                                                    </div>
                                                    <div className="col-12 mt-2 text-end"><button className="btn btn-sm btn-primary">Tarihleri Güncelle</button></div>
                                                </div>
                                            </form>

                                            <hr/>

                                            {/* --- GEÇMİŞ BAKİYE EKLEME --- */}
                                            <div className="bg-warning-subtle p-3 rounded mb-4 border border-warning">
                                                <h6 className="fw-bold d-flex align-items-center gap-2 text-dark"><History size={18}/> Geçmiş Dönem İzin Girişi</h6>
                                                <div className="d-flex gap-2 align-items-end mt-2">
                                                    <div><label className="small fw-bold">Hangi Yıl?</label><input type="number" className="form-control form-control-sm" value={yeniGecmisYil} onChange={e=>setYeniGecmisYil(e.target.value)} style={{width:'80px'}}/></div>
                                                    <div><label className="small fw-bold">Kaç Gün?</label><input type="number" className="form-control form-control-sm" value={yeniGecmisGun} onChange={e=>setYeniGecmisGun(e.target.value)} style={{width:'100px'}}/></div>
                                                    <button className="btn btn-sm btn-success fw-bold" onClick={addGecmisBakiye}><Plus size={14}/> Ekle</button>
                                                </div>
                                                
                                                <div className="mt-3 d-flex flex-wrap gap-2">
                                                    {gecmisBakiyeler.length > 0 ? gecmisBakiyeler.map(g => (
                                                        <span key={g.id} className="badge bg-white text-dark border d-flex align-items-center gap-2 p-2 shadow-sm">
                                                            {g.yil}: <strong className="text-success">+{g.gun_sayisi} Gün</strong>
                                                            <button onClick={()=>deleteGecmisBakiye(g.id)} className="btn btn-link text-danger p-0 m-0" style={{lineHeight:0}}><Trash2 size={14}/></button>
                                                        </span>
                                                    )) : <span className="text-muted small fst-italic">Henüz geçmiş kayıt eklenmemiş.</span>}
                                                </div>
                                            </div>

                                            {/* --- GEÇMİŞ İZİN HAREKETLERİ --- */}
                                            <h6 className="border-bottom pb-2 fw-bold text-dark d-flex align-items-center"><FileDown size={18} className="me-2"/> Geçmiş İzin Hareketleri (Sistem)</h6>
                                            <div className="table-responsive bg-white border rounded" style={{maxHeight:'350px'}}>
                                                <table className="table table-sm table-striped table-hover text-center mb-0">
                                                    <thead className="table-dark sticky-top">
                                                        <tr><th>İzin Türü</th><th>Başlangıç</th><th>Bitiş</th><th>Gün</th><th>Durum</th></tr>
                                                    </thead>
                                                    <tbody>
                                                        {izinGecmisi.length > 0 ? (
                                                            izinGecmisi.map((izin, idx) => (
                                                                <tr key={idx}>
                                                                    <td>{izin.izin_turu}</td>
                                                                    <td>{new Date(izin.baslangic_tarihi).toLocaleDateString('tr-TR')}</td>
                                                                    <td>{new Date(izin.bitis_tarihi).toLocaleDateString('tr-TR')}</td>
                                                                    <td className="fw-bold">{izin.gun_sayisi}</td>
                                                                    <td>
                                                                        {izin.durum === 'IK_ONAYLADI' || izin.durum === 'TAMAMLANDI' ? <span className="badge bg-success">Onaylı</span> : 
                                                                         izin.durum === 'REDDEDILDI' ? <span className="badge bg-danger">Red</span> : 
                                                                         <span className="badge bg-warning text-dark">Bekliyor</span>}
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        ) : (
                                                            <tr><td colSpan="5" className="text-muted py-4">Henüz kayıtlı izin hareketi bulunmamaktadır.</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {dondurmaModal && (
                <div className="modal show d-block" style={{backgroundColor:'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content shadow rounded-4 p-4 text-center">
                            <h5 className="fw-bold text-danger mb-3">Personel Pasife Al</h5>
                            <p className="text-muted"><strong>{dondurmaModal.ad} {dondurmaModal.soyad}</strong> adlı personeli pasife alma nedeniniz?</p>
                            <div className="d-grid gap-2 mt-3">
                                <button className="btn btn-outline-danger fw-bold" onClick={()=>changeStatus(dondurmaModal.personel_id, 'dondur', 'EMEKLİLİK')}>Emeklilik</button>
                                <button className="btn btn-outline-danger fw-bold" onClick={()=>changeStatus(dondurmaModal.personel_id, 'dondur', 'İŞ AKDİ FESHİ')}>İş Akdi Fesih</button>
                                <button className="btn btn-outline-danger fw-bold" onClick={()=>changeStatus(dondurmaModal.personel_id, 'dondur', 'VEFAT')}>Vefat</button>
                                <button className="btn btn-outline-danger fw-bold" onClick={()=>changeStatus(dondurmaModal.personel_id, 'dondur', 'İSTİFA')}>İstifa</button>
								<button className="btn btn-outline-danger fw-bold" onClick={()=>changeStatus(dondurmaModal.personel_id, 'dondur', 'DİĞER')}>Diğer..</button>
                                <button className="btn btn-secondary mt-2" onClick={()=>setDondurmaModal(null)}>İptal</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}