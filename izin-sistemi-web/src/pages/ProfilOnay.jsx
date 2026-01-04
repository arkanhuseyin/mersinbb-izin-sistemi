import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, FileText, User, ArrowLeft, Clock, MapPin, Phone, Mail, FileCheck, ShieldAlert } from 'lucide-react';

export default function ProfilOnay() {
    const [talepler, setTalepler] = useState([]);
    const [yukleniyor, setYukleniyor] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        verileriCek();
    }, []);

    const verileriCek = async () => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }

        try {
            // Sadece Admin/İK/Filo görebilir (Backend kontrolü var)
            const response = await axios.get('https://mersinbb-izin-sistemi.onrender.com/api/personel/talepler', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTalepler(response.data);
        } catch (error) {
            console.error(error);
            if (error.response && error.response.status === 403) {
                alert("Bu sayfaya erişim yetkiniz yok.");
                navigate('/dashboard/home');
            }
        } finally {
            setYukleniyor(false);
        }
    };

    const islemYap = async (id, tur) => { // tur: 'ONAYLA' veya 'REDDET'
        const token = localStorage.getItem('token');
        const mesaj = tur === 'ONAYLA' 
            ? "Bu değişiklikleri onaylamak ve personelin profilini güncellemek istiyor musunuz?" 
            : "Bu talebi reddetmek istiyor musunuz?";

        if(!window.confirm(mesaj)) return;

        try {
            await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/personel/talep-islem', { id, islem: tur }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(`İşlem Başarılı: ${tur === 'ONAYLA' ? 'Onaylandı' : 'Reddedildi'}`);
            verileriCek(); // Listeyi yenile
        } catch (error) {
            alert("Hata oluştu.");
        }
    };

    // Belge Linki Oluşturucu
    const belgeLink = (yol) => {
        if(!yol) return null;
        // Windows ters slash (\) karakterini düz slash (/) yapıyoruz
        const temizYol = yol.replace(/\\/g, '/'); 
        const dosyaAdi = temizYol.split('/').pop();
        // Backend 'uploads' klasörünü statik sunuyor
        return `https://mersinbb-izin-sistemi.onrender.com/uploads/belgeler/${dosyaAdi}`;
    };

    if (yukleniyor) return <div className="p-5 text-center text-muted">Yükleniyor...</div>;

    return (
        <div className="container-fluid p-4 p-lg-5" style={{backgroundColor: '#f4f7fe', minHeight: '100vh'}}>
            
            {/* HEADER */}
            <div className="d-flex justify-content-between align-items-center mb-5">
                <div>
                    <h2 className="fw-bold text-dark m-0">Profil Onayları</h2>
                    <p className="text-muted m-0">Personelin gönderdiği bilgi ve belge güncelleme talepleri.</p>
                </div>
                <button className="btn btn-light border shadow-sm px-3 fw-bold text-secondary" onClick={() => navigate('/dashboard/home')}>
                    <ArrowLeft size={18} className="me-2"/> Panale Dön
                </button>
            </div>

            {talepler.length === 0 && (
                <div className="text-center p-5 bg-white rounded-4 shadow-sm">
                    <div className="bg-light p-4 rounded-circle d-inline-block mb-3">
                        <CheckCircle size={40} className="text-success opacity-50"/>
                    </div>
                    <h5 className="text-muted">Bekleyen talep yok.</h5>
                    <p className="text-muted small">Tüm profil güncellemeleri incelendi.</p>
                </div>
            )}

            <div className="row g-4">
                {talepler.map((talep) => (
                    <div key={talep.id} className="col-lg-6">
                        <div className="card border-0 shadow-sm h-100 rounded-4 overflow-hidden">
                            
                            {/* KART BAŞLIĞI */}
                            <div className="card-header bg-white border-bottom p-4 d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="bg-primary bg-opacity-10 text-primary fw-bold rounded-circle d-flex align-items-center justify-content-center" style={{width: 45, height: 45}}>
                                        {talep.ad[0]}{talep.soyad[0]}
                                    </div>
                                    <div>
                                        <h5 className="m-0 fw-bold text-dark">{talep.ad} {talep.soyad}</h5>
                                        <small className="text-muted font-monospace">{talep.tc_no}</small>
                                    </div>
                                </div>
                                <div className="text-end">
                                    <span className="badge bg-warning text-dark d-flex align-items-center gap-1 mb-1">
                                        <Clock size={12}/> Bekliyor
                                    </span>
                                    <div className="small text-muted" style={{fontSize:'11px'}}>{new Date(talep.talep_tarihi).toLocaleDateString('tr-TR')}</div>
                                </div>
                            </div>

                            {/* İÇERİK */}
                            <div className="card-body p-4">
                                <div className="row">
                                    
                                    {/* SOL: İSTENEN DEĞİŞİKLİKLER */}
                                    <div className="col-md-6 mb-3 mb-md-0 border-end">
                                        <h6 className="fw-bold text-secondary text-uppercase small mb-3">📋 İstenen Değişiklikler</h6>
                                        <div className="d-flex flex-column gap-2">
                                            {talep.yeni_veri.telefon && (
                                                <div className="d-flex align-items-center gap-2 text-dark"><Phone size={16} className="text-primary"/> <span>{talep.yeni_veri.telefon}</span></div>
                                            )}
                                            {talep.yeni_veri.email && (
                                                <div className="d-flex align-items-center gap-2 text-dark"><Mail size={16} className="text-primary"/> <span className="text-truncate">{talep.yeni_veri.email}</span></div>
                                            )}
                                            {talep.yeni_veri.adres && (
                                                <div className="d-flex align-items-start gap-2 text-dark"><MapPin size={16} className="text-primary mt-1"/> <span>{talep.yeni_veri.adres}</span></div>
                                            )}
                                            
                                            {/* TARİHLER */}
                                            {talep.yeni_veri.src_tarih && <div className="small bg-light p-2 rounded border"><strong>SRC Tarihi:</strong> {talep.yeni_veri.src_tarih}</div>}
                                            {talep.yeni_veri.psiko_tarih && <div className="small bg-light p-2 rounded border"><strong>Psikoteknik:</strong> {talep.yeni_veri.psiko_tarih}</div>}
                                            {talep.yeni_veri.ehliyet_tarih && <div className="small bg-light p-2 rounded border"><strong>Ehliyet:</strong> {talep.yeni_veri.ehliyet_tarih}</div>}

                                            {/* ŞİFRE */}
                                            {talep.yeni_veri.sifre_hash && (
                                                <div className="alert alert-danger d-flex align-items-center gap-2 p-2 mt-2 mb-0 small">
                                                    <ShieldAlert size={16}/> <strong>Şifre Değişikliği Talep Edildi</strong>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* SAĞ: BELGELER */}
                                    <div className="col-md-6 ps-md-4">
                                        <h6 className="fw-bold text-secondary text-uppercase small mb-3">📂 Yüklenen Belgeler</h6>
                                        <div className="d-flex flex-column gap-2">
                                            {talep.dosya_yollari.adres_belgesi_yol && (
                                                <a href={belgeLink(talep.dosya_yollari.adres_belgesi_yol)} target="_blank" rel="noreferrer" className="btn btn-sm btn-light border text-start d-flex align-items-center gap-2">
                                                    <FileText size={16} className="text-danger"/> İkametgah Belgesi
                                                </a>
                                            )}
                                            {talep.dosya_yollari.src_belgesi_yol && (
                                                <a href={belgeLink(talep.dosya_yollari.src_belgesi_yol)} target="_blank" rel="noreferrer" className="btn btn-sm btn-light border text-start d-flex align-items-center gap-2">
                                                    <FileCheck size={16} className="text-info"/> SRC Belgesi
                                                </a>
                                            )}
                                            {talep.dosya_yollari.psiko_belgesi_yol && (
                                                <a href={belgeLink(talep.dosya_yollari.psiko_belgesi_yol)} target="_blank" rel="noreferrer" className="btn btn-sm btn-light border text-start d-flex align-items-center gap-2">
                                                    <FileCheck size={16} className="text-warning"/> Psikoteknik Belgesi
                                                </a>
                                            )}
                                            {talep.dosya_yollari.ehliyet_belgesi_yol && (
                                                <a href={belgeLink(talep.dosya_yollari.ehliyet_belgesi_yol)} target="_blank" rel="noreferrer" className="btn btn-sm btn-light border text-start d-flex align-items-center gap-2">
                                                    <User size={16} className="text-success"/> Ehliyet Görüntüsü
                                                </a>
                                            )}
											{/* YENİ EKLENEN: KİMLİK BELGESİ GÖRÜNTÜLEME */}
{talep.dosya_yollari.kimlik_belgesi_yol && (
    <div className="alert alert-info border-info d-flex flex-column gap-2">
        <strong className="text-info d-flex align-items-center gap-2"><ShieldAlert size={18}/> Şifre Sıfırlama Talebi</strong>
        <p className="small m-0">Bu talep şifre değişikliği içindir. Lütfen aşağıdaki kimlik görüntüsü ile personel bilgilerini doğrulayınız.</p>
        <a href={belgeLink(talep.dosya_yollari.kimlik_belgesi_yol)} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary text-start d-flex align-items-center gap-2 mt-1">
            <User size={16} className="text-white"/> Kimlik Fotoğrafını Görüntüle
        </a>
    </div>
)}
                                            
                                            {Object.keys(talep.dosya_yollari || {}).length === 0 && (
                                                <div className="text-muted small fst-italic">Belge yüklenmemiş.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* BUTONLAR */}
                            <div className="card-footer bg-white p-3 border-top d-flex justify-content-end gap-2">
                                <button className="btn btn-outline-danger fw-bold px-4" onClick={() => islemYap(talep.id, 'REDDET')}>
                                    <XCircle size={18} className="me-2 mb-1"/> Reddet
                                </button>
                                <button className="btn btn-success fw-bold px-4" onClick={() => islemYap(talep.id, 'ONAYLA')}>
                                    <CheckCircle size={18} className="me-2 mb-1"/> Onayla ve Güncelle
                                </button>
                            </div>

                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}