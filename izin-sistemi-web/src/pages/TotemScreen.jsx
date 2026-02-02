import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Bus, Users, ClipboardList, Gavel, 
    Car, Package, AlertTriangle 
} from 'lucide-react';

// LOGO İMPORTU (Senin klasöründen)
// Eğer logo dosyanın adı farklıysa veya yeri farklıysa burayı düzelt
import logo from '../assets/logo.png'; 

export default function TotemScreen() {
    const navigate = useNavigate();

    // Modül Listesi (CSS Renkleri ve İkonlar)
    const cards = [
        { id: 'AKM', title: "Ana Koordinasyon", icon: <Bus size={50} />, path: "/login?modul=admin" },
        { id: 'IK', title: "İnsan Kaynakları", icon: <Users size={50} />, path: "/login?modul=ik" },
        { id: 'GOREV', title: "Günlük Görev", icon: <ClipboardList size={50} />, path: "/login?modul=gorev" },
        { id: 'DISIPLIN', title: "Disiplin İşleri", icon: <Gavel size={50} />, path: "/login?modul=disiplin" },
        { id: 'KAZA', title: "Kaza İşleri", icon: <Car size={50} />, path: "/login?modul=kaza" },
        { id: 'LOJISTIK', title: "Lojistik", icon: <Package size={50} />, path: "/login?modul=lojistik" }
    ];

    return (
        <div className="totem-container">
            {/* CSS STYLES - Tasarımın Birebir Aynısı Olması İçin */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Segoe+UI:wght@400;600;700;900&display=swap');

                .totem-container {
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    font-family: 'Segoe UI', sans-serif;
                    background-color: #f4f6f9;
                    overflow: hidden;
                }

                /* HEADER: O özel gradient renkler */
                .totem-header {
                    background: linear-gradient(90deg, #0099cc 0%, #663399 50%, #ff3300 100%);
                    color: white;
                    padding: 15px 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 20px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.4);
                    border-bottom: 5px solid rgba(255,255,255,0.2);
                    z-index: 20;
                }

                .header-logo {
                    height: 70px;
                    width: auto;
                    background: rgba(255,255,255,0.15);
                    padding: 5px;
                    border-radius: 8px;
                    backdrop-filter: blur(5px);
                }

                .header-titles h1 {
                    margin: 0;
                    font-size: 42px;
                    font-weight: 900;
                    letter-spacing: 4px;
                    text-shadow: 3px 3px 6px rgba(0,0,0,0.4);
                    line-height: 1;
                }

                .header-titles p {
                    margin: 5px 0 0;
                    font-size: 14px;
                    letter-spacing: 1px;
                    opacity: 0.9;
                    text-transform: uppercase;
                }

                .header-titles .sub-title {
                    font-size: 12px;
                    font-weight: 600;
                    color: #ffeb3b;
                    display: block;
                    margin-bottom: 2px;
                }

                /* MAIN AREA */
                .main-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    position: relative;
                    padding: 20px;
                }

                /* Arka Plan Resmi */
                .main-content::before {
                    content: "";
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: linear-gradient(rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.2)), url('https://mersin.bel.tr/images/bg-main.jpg');
                    background-size: cover;
                    background-position: center;
                    filter: blur(5px);
                    z-index: -1;
                }

                /* SLOGAN */
                .slogan-box {
                    text-align: center;
                    margin-bottom: 40px;
                    animation: fadeInDown 0.8s ease-out;
                }

                .slogan-title {
                    color: #2c3e50;
                    font-size: 3em;
                    font-weight: 900;
                    text-transform: uppercase;
                    text-shadow: 2px 2px 0px rgba(255,255,255,0.6);
                    margin: 0;
                }

                .slogan-badge {
                    font-size: 1.2em;
                    font-weight: 700;
                    margin-top: 10px;
                    background: linear-gradient(to right, #ff3300, #ff9900);
                    color: white;
                    padding: 5px 25px;
                    border-radius: 20px;
                    display: inline-block;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.2);
                }

                /* GRID CARDS */
                .cards-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 30px;
                    max-width: 1200px;
                    width: 100%;
                }

                .totem-card {
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: 12px;
                    padding: 30px 20px;
                    text-align: center;
                    transition: all 0.3s ease;
                    cursor: pointer;
                    box-shadow: 0 8px 15px rgba(0,0,0,0.2);
                    height: 180px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                    border: 1px solid rgba(255,255,255,0.5);
                }

                .totem-card:hover {
                    transform: translateY(-8px);
                    background: #fff;
                    box-shadow: 0 15px 30px rgba(0,0,0,0.3);
                }

                /* Alt Çizgi Animasyonu */
                .totem-card::after {
                    content: '';
                    position: absolute;
                    bottom: 0; left: 0;
                    width: 100%;
                    height: 5px;
                    background: linear-gradient(90deg, #0099cc, #663399, #ff3300);
                    transform: scaleX(0);
                    transition: transform 0.3s ease;
                }

                .totem-card:hover::after {
                    transform: scaleX(1);
                }

                .icon-wrapper {
                    margin-bottom: 15px;
                    /* Gradient Text Effect for Icons */
                    color: #663399; 
                }
                
                .totem-card:hover .icon-wrapper {
                    background: -webkit-linear-gradient(45deg, #0099cc, #663399);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    transform: scale(1.1);
                    transition: 0.3s;
                }

                .card-title {
                    color: #333;
                    margin: 0;
                    font-size: 1.3em;
                    font-weight: 700;
                }

                @media (max-width: 900px) {
                    .cards-grid { grid-template-columns: repeat(2, 1fr); }
                    .slogan-title { font-size: 2em; }
                    .header-titles h1 { font-size: 32px; }
                }
                @media (max-width: 600px) {
                    .cards-grid { grid-template-columns: 1fr; }
                    .totem-header { flex-direction: column; text-align: center; }
                }
                
                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {/* HEADER KISMI */}
            <header className="totem-header">
                {/* Logo Yerel Dosyadan Gelecek */}
                <img src={logo} alt="Mersin BB Logo" className="header-logo" />
                
                <div className="header-titles">
                    <span className="sub-title">Mersin Büyükşehir Belediyesi</span>
                    <h1>TOTEM</h1>
                    <p>Toplu Taşıma Entegrasyon Merkezi</p>
                </div>
            </header>

            {/* ORTA ALAN */}
            <main className="main-content">
                
                {/* Slogan */}
                <div className="slogan-box">
                    <h1 className="slogan-title">Geleceğin Ulaşımı Mersin'de</h1>
                    <div className="slogan-badge">Güvenli, Konforlu ve Sürdürülebilir</div>
                </div>

                {/* Kartlar */}
                <div className="cards-grid">
                    {cards.map((card) => (
                        <div 
                            key={card.id} 
                            className="totem-card"
                            onClick={() => navigate(card.path)}
                        >
                            <div className="icon-wrapper">
                                {card.icon}
                            </div>
                            <h3 className="card-title">{card.title}</h3>
                        </div>
                    ))}
                </div>

            </main>
        </div>
    );
}