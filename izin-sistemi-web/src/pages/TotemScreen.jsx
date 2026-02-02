import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Bus, Users, ClipboardList, Gavel, 
    Car, Package 
} from 'lucide-react';

// ✅ LOGO İSMİNİ SENİN DOSYANA GÖRE GÜNCELLEDİM
import logo from '../assets/logombb.png'; 

export default function TotemScreen() {
    const navigate = useNavigate();

    const cards = [
        { id: 'AKM', title: "Ana Koordinasyon", icon: <Bus size={45} />, path: "/login?modul=admin" },
        { id: 'IK', title: "İnsan Kaynakları", icon: <Users size={45} />, path: "/login?modul=ik" },
        { id: 'GOREV', title: "Günlük Görev", icon: <ClipboardList size={45} />, path: "/login?modul=gorev" },
        { id: 'DISIPLIN', title: "Disiplin İşleri", icon: <Gavel size={45} />, path: "/login?modul=disiplin" },
        { id: 'KAZA', title: "Kaza İşleri", icon: <Car size={45} />, path: "/login?modul=kaza" },
        { id: 'LOJISTIK', title: "Lojistik", icon: <Package size={45} />, path: "/login?modul=lojistik" }
    ];

    return (
        <div className="totem-wrapper">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Segoe+UI:wght@400;600;700;900&display=swap');

                /* 1. TÜM SAYFAYI SIFIRLA VE KAYDIRMAYI ENGELLE */
                * {
                    box-sizing: border-box;
                }

                html, body {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100%;
                    overflow: hidden; /* Scrollbar'ı yok eder */
                }

                .totem-wrapper {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    width: 100vw;
                    height: 100vh; /* Ekranı tam kapla */
                    background-color: #f4f6f9;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden; /* İçerik taşarsa gizle */
                }

                /* HEADER */
                .landing-header {
                    background: linear-gradient(90deg, #0099cc 0%, #663399 50%, #ff3300 100%);
                    color: white;
                    padding: 10px 30px; /* Paddingi biraz kıstım */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 20px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.4);
                    z-index: 20;
                    border-bottom: 5px solid rgba(255,255,255,0.2);
                    flex-shrink: 0; /* Header küçülmesin */
                    height: 100px; /* Sabit yükseklik */
                }

                .header-logo {
                    height: 60px; /* Logo boyutunu ekrana sığması için optimize ettim */
                    width: auto;
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
                    background: rgba(255,255,255,0.15);
                    border-radius: 8px;
                    padding: 5px;
                }

                .header-text { text-align: left; }

                .landing-header h1 {
                    margin: 0;
                    font-size: 36px; /* Fontu biraz optimize ettim */
                    font-weight: 900;
                    letter-spacing: 3px;
                    text-shadow: 3px 3px 6px rgba(0,0,0,0.4);
                    font-family: 'Arial Black', sans-serif;
                    line-height: 1;
                }

                .landing-header p {
                    margin: 2px 0 0;
                    font-size: 12px;
                    letter-spacing: 1px;
                    opacity: 0.9;
                    text-transform: uppercase;
                }

                .landing-header .institution {
                    font-size: 11px;
                    opacity: 0.9;
                    display: block;
                    font-weight: 600;
                    color: #ffeb3b;
                }

                /* MAIN CONTENT - ORTALAMA */
                .main-wrapper {
                    flex: 1; /* Kalan tüm boşluğu doldur */
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    justify-content: center; /* Dikey ortala */
                    align-items: center;     /* Yatay ortala */
                    width: 100%;
                    padding: 20px;
                }

                .main-wrapper::before {
                    content: "";
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: linear-gradient(rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.2)), url('https://mersin.bel.tr/images/bg-main.jpg');
                    background-size: cover;
                    background-position: center bottom;
                    filter: blur(5px);
                    transform: scale(1.02);
                    z-index: -1;
                }

                /* SLOGAN */
                .slogan-container {
                    text-align: center;
                    margin-bottom: 30px; /* Kartlarla arasını aç */
                    animation: fadeInDown 0.8s ease-out;
                }

                .slogan-title {
                    color: #2c3e50;
                    font-size: 2.5em; /* Ekrana sığması için */
                    font-weight: 900;
                    text-transform: uppercase;
                    text-shadow: 2px 2px 0px rgba(255,255,255,0.6);
                    margin: 0;
                }

                .slogan-sub {
                    font-size: 1.1em;
                    font-weight: 700;
                    margin-top: 10px;
                    background: linear-gradient(to right, #ff3300, #ff9900);
                    color: white;
                    padding: 5px 25px;
                    border-radius: 20px;
                    display: inline-block;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.2);
                }

                /* GRID SİSTEMİ */
                .grid-container {
                    width: 100%;
                    max-width: 1000px; /* Kartlar çok yayılmasın */
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 25px;
                }

                .card {
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: 12px;
                    padding: 15px;
                    text-align: center;
                    transition: all 0.3s ease;
                    cursor: pointer;
                    box-shadow: 0 8px 15px rgba(0,0,0,0.2);
                    height: 140px; /* Yüksekliği sabitledim */
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                }

                .card:hover {
                    transform: translateY(-5px);
                    background: #fff;
                    box-shadow: 0 15px 30px rgba(0,0,0,0.3);
                }

                .card::after {
                    content: '';
                    position: absolute;
                    bottom: 0; left: 0;
                    width: 100%;
                    height: 5px;
                    background: linear-gradient(90deg, #0099cc, #663399, #ff3300);
                    transform: scaleX(0);
                    transition: transform 0.3s ease;
                }

                .card:hover::after { transform: scaleX(1); }

                .icon-box {
                    margin-bottom: 8px;
                    color: #663399;
                    transition: 0.3s;
                }
                
                .card:hover .icon-box {
                    transform: scale(1.1);
                    color: #0099cc;
                }

                .card h3 {
                    color: #333;
                    margin: 0;
                    font-size: 1em;
                    font-weight: 700;
                }

                /* MOBİL VE KÜÇÜK EKRAN UYUMU */
                @media (max-height: 768px) {
                    .card { height: 120px; }
                    .slogan-container { margin-bottom: 15px; }
                    .landing-header { height: 80px; padding: 5px 20px; }
                    .header-logo { height: 50px; }
                    .slogan-title { font-size: 2em; }
                }

                @media (max-width: 900px) {
                    .grid-container { grid-template-columns: repeat(2, 1fr); }
                }

                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            <header className="landing-header">
                <img src={logo} alt="Logo" className="header-logo" />
                <div className="header-text">
                    <span className="institution">Mersin Büyükşehir Belediyesi</span>
                    <h1>TOTEM</h1>
                    <p>Toplu Taşıma Entegrasyon Merkezi</p>
                </div>
            </header>

            <div className="main-wrapper">
                <div className="slogan-container">
                    <h1 className="slogan-title">Geleceğin Ulaşımı Mersin'de</h1>
                    <div className="slogan-sub">Güvenli, Konforlu ve Sürdürülebilir</div>
                </div>

                <div className="grid-container">
                    {cards.map((card) => (
                        <div 
                            key={card.id} 
                            className="card"
                            onClick={() => navigate(card.path)}
                        >
                            <div className="icon-box">
                                {card.icon}
                            </div>
                            <h3>{card.title}</h3>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}