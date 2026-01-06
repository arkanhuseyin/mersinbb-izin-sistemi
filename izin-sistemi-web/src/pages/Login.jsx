import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff } from 'lucide-react';

// ✅ LOGOYU BURADAN İMPORT EDİYORUZ
// Eğer Login.jsx 'src/pages' içindeyse: '../assets/logombb.png'
// Eğer Login.jsx direkt 'src' içindeyse: './assets/logombb.png' olarak değiştirin.
import logoMbb from '../assets/logombb.png'; 

export default function Login() {
    const [tcNo, setTcNo] = useState('');
    const [sifre, setSifre] = useState('');
    const [hata, setHata] = useState('');
    const [sifreGoster, setSifreGoster] = useState(false);
    const [yukleniyor, setYukleniyor] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setHata('');
        setYukleniyor(true);

        try {
            const response = await axios.post('https://mersinbb-izin-sistemi.onrender.com/api/auth/login', { tc_no: tcNo, sifre: sifre });
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            navigate('/dashboard/home'); 
        } catch (error) {
            setHata('Giriş bilgileri hatalı veya sunucu erişilemiyor.');
        } finally {
            setYukleniyor(false);
        }
    };

    return (
        <div style={{ 
            backgroundImage: "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            height: '100vh',
            width: '100vw',
            position: 'relative'
        }}>
            {/* Overlay Katmanı (Kurumsal Mavi - Mobille Aynı Ton) */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(13, 110, 253, 0.85)', 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
            }}>

                {/* LOGO ve BAŞLIK ALANI */}
                <div className="text-center mb-4">
                    {/* ✅ Import ettiğimiz logoyu kullanıyoruz */}
                    <img 
                        src={logoMbb} 
                        alt="Mersin BB Logo" 
                        style={{ width: '120px', height: 'auto', marginBottom: '15px', filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.2))' }}
                    />
                    <h2 className="fw-bold text-white m-0" style={{ letterSpacing: '1px', textShadow: '0px 2px 4px rgba(0,0,0,0.3)' }}>MERSİN BÜYÜKŞEHİR</h2>
                    <h4 className="fw-light text-white m-0" style={{ letterSpacing: '2px', opacity: 0.9 }}>BELEDİYESİ</h4>
                </div>

                {/* BEYAZ KART ALANI */}
                <div className="bg-white p-4 p-md-5 shadow-lg" style={{ 
                    borderRadius: '20px', 
                    width: '100%', 
                    maxWidth: '420px',
                    position: 'relative',
                    zIndex: 10
                }}>
                    <div className="text-center mb-4">
                        <h4 className="fw-bold text-dark m-0">Personel Girişi</h4>
                        <p className="text-muted small">İKYS Sistemine Hoşgeldiniz</p>
                    </div>

                    {hata && <div className="alert alert-danger text-center py-2 small mb-3">{hata}</div>}

                    <form onSubmit={handleLogin}>
                        {/* TC INPUT */}
                        <div className="mb-3">
                            <div className="d-flex align-items-center bg-light border rounded-3 px-3 py-2" style={{ height: '55px' }}>
                                <User size={20} className="text-secondary me-3" />
                                <input 
                                    type="text" 
                                    className="form-control border-0 bg-transparent shadow-none p-0" 
                                    placeholder="TC Kimlik No"
                                    maxLength="11"
                                    value={tcNo} 
                                    onChange={(e) => setTcNo(e.target.value)} 
                                    required 
                                    style={{ fontSize: '16px', fontWeight: '500' }}
                                />
                            </div>
                        </div>

                        {/* ŞİFRE INPUT */}
                        <div className="mb-4">
                            <div className="d-flex align-items-center bg-light border rounded-3 px-3 py-2" style={{ height: '55px' }}>
                                <Lock size={20} className="text-secondary me-3" />
                                <input 
                                    type={sifreGoster ? "text" : "password"}
                                    className="form-control border-0 bg-transparent shadow-none p-0" 
                                    placeholder="Şifre"
                                    value={sifre} 
                                    onChange={(e) => setSifre(e.target.value)} 
                                    required 
                                    style={{ fontSize: '16px', fontWeight: '500' }}
                                />
                                <button type="button" className="btn btn-link text-secondary p-0 ms-2" onClick={() => setSifreGoster(!sifreGoster)}>
                                    {sifreGoster ? <EyeOff size={20}/> : <Eye size={20}/>}
                                </button>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className="btn btn-primary w-100 py-3 rounded-3 fw-bold shadow-sm" 
                            disabled={yukleniyor}
                            style={{ 
                                backgroundColor: '#0d6efd', 
                                border: 'none', 
                                fontSize: '16px', 
                                letterSpacing: '0.5px',
                                transition: 'all 0.3s'
                            }}
                        >
                            {yukleniyor ? 'Giriş Yapılıyor...' : 'GİRİŞ YAP'}
                        </button>
                    </form>
                </div>

                {/* ✅ FOOTER - İSTENİLEN İMZA */}
                <div className="mt-5 text-center text-white opacity-75">
                    <p className="m-0 small fw-bold">Toplu Taşıma Şube Müdürlüğü</p>
                    <p className="m-0" style={{ fontSize: '11px', marginTop: '5px' }}>
                        Hüseyin Arkan Tarafından Hazırlanmıştır © 2026
                    </p>
                    <p className="m-0" style={{ fontSize: '10px', marginTop: '2px' }}>v1.0.0</p>
                </div>

            </div>
        </div>
    );
}