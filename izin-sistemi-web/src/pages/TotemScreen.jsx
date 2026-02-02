import { useNavigate } from 'react-router-dom';
import { 
    Users, BarChart3, AlertTriangle, Shirt, 
    Truck, Settings, LayoutGrid, FileText
} from 'lucide-react';

export default function TotemScreen() {
    const navigate = useNavigate();

    // Hilal'in projesindeki gibi Kurumsal Renkler ve Büyük Kartlar
    const moduller = [
        { 
            id: 1, 
            baslik: "ANA KOORDİNASYON", 
            icon: <BarChart3 size={40} />, 
            renk: "bg-blue-600", // Mavi
            golge: "shadow-blue-200",
            hedef: "/login?modul=admin" 
        },
        { 
            id: 2, 
            baslik: "İNSAN KAYNAKLARI", 
            icon: <Users size={40} />, 
            renk: "bg-indigo-600", // Mor
            golge: "shadow-indigo-200",
            hedef: "/login?modul=ik" 
        },
        { 
            id: 3, 
            baslik: "DİSİPLİN & TALEP", 
            icon: <FileText size={40} />, 
            renk: "bg-emerald-600", // Yeşil
            golge: "shadow-emerald-200",
            hedef: "/login?modul=disiplin" 
        },
        { 
            id: 4, 
            baslik: "LOJİSTİK & KIYAFET", 
            icon: <Shirt size={40} />, 
            renk: "bg-orange-500", // Turuncu
            golge: "shadow-orange-200",
            hedef: "/login?modul=lojistik"
        },
        { 
            id: 5, 
            baslik: "FİLO & KAZA TAKİP", 
            icon: <Truck size={40} />, 
            renk: "bg-red-600", // Kırmızı
            golge: "shadow-red-200",
            hedef: "/login?modul=kaza"
        },
        { 
            id: 6, 
            baslik: "SİSTEM AYARLARI", 
            icon: <Settings size={40} />, 
            renk: "bg-slate-700", // Gri
            golge: "shadow-slate-200",
            hedef: "/login?modul=ayarlar"
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 relative">
            
            {/* Arka Plan: Hafif bir Mersin/Şehir silüeti veya kurumsal desen */}
            <div 
                className="absolute inset-0 bg-cover bg-center z-0 opacity-10"
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop')" }}
            ></div>

            {/* İçerik Kutusu */}
            <div className="relative z-10 w-full max-w-7xl">
                
                {/* Üst Başlık (Header) */}
                <div className="flex flex-col items-center mb-12">
                    {/* Buraya Mersin BB logosu gelebilir, şimdilik ikon koyuyorum */}
                    <div className="bg-white p-4 rounded-full shadow-lg mb-4">
                        <LayoutGrid size={48} className="text-red-600" />
                    </div>
                    
                    <h1 className="text-4xl md:text-5xl font-black text-gray-800 tracking-tight text-center mb-2">
                        TOTEM <span className="text-red-600">YÖNETİM SİSTEMİ</span>
                    </h1>
                    <p className="text-gray-500 text-lg uppercase tracking-widest font-medium">
                        Mersin Büyükşehir Belediyesi
                    </p>
                </div>

                {/* Grid Yapısı (Hilal'in Tasarımı Tarzı - Büyük Bloklar) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {moduller.map((modul) => (
                        <div 
                            key={modul.id}
                            onClick={() => navigate(modul.hedef)}
                            className="group cursor-pointer bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden border border-gray-100 flex flex-col"
                            style={{ height: '220px' }} // Kart yüksekliği sabit ve büyük
                        >
                            {/* Üst Renkli Kısım */}
                            <div className={`${modul.renk} h-2 w-full group-hover:h-3 transition-all`}></div>

                            <div className="flex flex-col items-center justify-center flex-grow p-6 text-center">
                                {/* İkon Yuvarlağı */}
                                <div className={`mb-6 p-4 rounded-full bg-gray-50 group-hover:bg-gray-100 text-gray-700 group-hover:${modul.renk.replace('bg-', 'text-')} transition-colors duration-300`}>
                                    {modul.icon}
                                </div>
                                
                                {/* Başlık */}
                                <h3 className="text-2xl font-bold text-gray-800 group-hover:text-red-600 transition-colors uppercase">
                                    {modul.baslik}
                                </h3>
                                
                                {/* Alt Çizgi Efekti */}
                                <div className="mt-4 w-12 h-1 bg-gray-200 rounded-full group-hover:w-24 group-hover:bg-red-500 transition-all duration-500"></div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="text-center mt-16 text-gray-400 font-medium text-sm">
                    © 2024 Bilgi İşlem Dairesi Başkanlığı | Tüm Hakları Saklıdır
                </div>
            </div>
        </div>
    );
}