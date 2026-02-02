import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Bus, Users, ClipboardList, Gavel, 
    Car, Box, LogIn, X 
} from 'lucide-react'; // FontAwesome yerine Lucide (React standardı)

export default function TotemScreen() {
    const navigate = useNavigate();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedModule, setSelectedModule] = useState(null);

    // Modül Listesi (Onların tasarımıyla aynı mantık)
    const moduller = [
        { id: 'AKM', title: "Ana Koordinasyon", icon: <Bus size={40} />, color: "text-blue-500", path: "/login?modul=admin" },
        { id: 'IK', title: "İnsan Kaynakları", icon: <Users size={40} />, color: "text-purple-600", path: "/login?modul=ik" },
        { id: 'GOREV', title: "Günlük Görev", icon: <ClipboardList size={40} />, color: "text-green-600", path: "/login?modul=gorev" },
        { id: 'DISIPLIN', title: "Disiplin İşleri", icon: <Gavel size={40} />, color: "text-red-500", path: "/login?modul=disiplin" },
        { id: 'KAZA', title: "Kaza İşleri", icon: <Car size={40} />, color: "text-orange-500", path: "/login?modul=kaza" },
        { id: 'LOJISTIK', title: "Lojistik", icon: <Box size={40} />, color: "text-indigo-500", path: "/login?modul=lojistik" }
    ];

    const handleCardClick = (modul) => {
        // Direkt Login'e gönderiyoruz, parametreyle hangi modülden geldiğini iletiyoruz
        navigate(modul.path);
    };

    return (
        <div className="min-h-screen flex flex-col relative overflow-hidden font-sans">
            
            {/* ARKA PLAN RESMİ (Senin projendeki bir resimle değiştir) */}
            <div 
                className="absolute inset-0 bg-cover bg-center z-0"
                style={{ 
                    backgroundImage: "url('https://mersin.bel.tr/images/bg-main.jpg')", // Temsili resim
                    filter: "blur(4px) brightness(0.9)"
                }}
            ></div>
            <div className="absolute inset-0 bg-white/10 backdrop-blur-sm z-0"></div>

            {/* HEADER (Onların CSS'ine sadık kaldık) */}
            <header className="relative z-10 flex items-center justify-center gap-6 py-6 px-8 bg-gradient-to-r from-[#0099cc] via-[#663399] to-[#ff3300] shadow-xl border-b-4 border-white/20">
                {/* Logo Alanı */}
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-md shadow-sm">
                    {/* Buraya belediye logosunu koy */}
                    <img src="https://cdn-icons-png.flaticon.com/512/9311/9311896.png" alt="Logo" className="h-16 w-auto drop-shadow-md" />
                </div>
                
                <div className="text-white text-left">
                    <span className="block text-xs font-bold text-yellow-300 uppercase tracking-wider mb-1">Mersin Büyükşehir Belediyesi</span>
                    <h1 className="text-5xl font-black tracking-widest drop-shadow-lg leading-none m-0" style={{fontFamily: 'Arial Black, sans-serif'}}>TOTEM</h1>
                    <p className="text-sm tracking-widest opacity-90 uppercase mt-1">Toplu Taşıma Entegrasyon Merkezi</p>
                </div>
            </header>

            {/* ORTA ALAN (Slogan ve Kartlar) */}
            <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full max-w-6xl mx-auto px-4 py-8">
                
                {/* Slogan */}
                <div className="text-center mb-12 animate-fade-in-down">
                    <h1 className="text-4xl md:text-5xl font-black text-slate-800 uppercase drop-shadow-sm mb-4">
                        Geleceğin Ulaşımı Mersin'de
                    </h1>
                    <div className="inline-block bg-gradient-to-r from-orange-500 to-red-600 text-white px-8 py-2 rounded-full font-bold text-lg shadow-lg">
                        Güvenli, Konforlu ve Sürdürülebilir
                    </div>
                </div>

                {/* Grid Kartlar */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                    {moduller.map((modul) => (
                        <div 
                            key={modul.id}
                            onClick={() => handleCardClick(modul)}
                            className="group bg-white/95 backdrop-blur-sm rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 h-40 relative overflow-hidden border border-white/50"
                        >
                            {/* İkon */}
                            <div className={`mb-3 transition-transform duration-300 group-hover:scale-110 ${modul.color}`}>
                                {modul.icon}
                            </div>
                            
                            {/* Başlık */}
                            <h3 className="text-xl font-bold text-slate-700 m-0 group-hover:text-black transition-colors">
                                {modul.title}
                            </h3>

                            {/* Alt Çizgi Efekti (Onların CSS'indeki gradient çizgi) */}
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-[#0099cc] via-[#663399] to-[#ff3300] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                        </div>
                    ))}
                </div>

            </div>

            {/* Footer */}
            <div className="relative z-10 text-center py-4 text-slate-600 text-sm font-medium bg-white/80 backdrop-blur-md">
                © 2026 Mersin Büyükşehir Belediyesi Bilgi İşlem Dairesi Başkanlığı
            </div>
        </div>
    );
}