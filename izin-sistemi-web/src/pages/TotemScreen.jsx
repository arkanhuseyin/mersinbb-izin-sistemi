import { useNavigate } from 'react-router-dom';
import { 
    Users, BarChart3, AlertTriangle, Shirt, 
    Truck, Settings, ArrowRight 
} from 'lucide-react';

export default function TotemScreen() {
    const navigate = useNavigate();

    // Modül Listesi ve Senin Projendeki Karşılıkları
    const moduller = [
        { 
            id: 1, 
            baslik: "ANA KOORDİNASYON", 
            aciklama: "Filo Takip, Harita ve Yönetim Paneli", 
            icon: <BarChart3 size={32} />, 
            renk: "bg-blue-600",
            hedef: "/login?modul=admin" // Admin paneline yönlendirir
        },
        { 
            id: 2, 
            baslik: "İNSAN KAYNAKLARI", 
            aciklama: "İzin Takip, Personel ve Özlük İşlemleri", 
            icon: <Users size={32} />, 
            renk: "bg-purple-600",
            hedef: "/login?modul=ik" // Senin İzin Sistemine yönlendirir
        },
        { 
            id: 3, 
            baslik: "DİSİPLİN & TALEP", 
            aciklama: "Şikayet, Talep ve Disiplin Süreçleri", 
            icon: <AlertTriangle size={32} />, 
            renk: "bg-red-600",
            hedef: "/login?modul=disiplin" 
        },
        { 
            id: 4, 
            baslik: "LOJİSTİK & KIYAFET", 
            aciklama: "Stok, Zimmet ve Kıyafet Dağıtımı", 
            icon: <Shirt size={32} />, 
            renk: "bg-orange-500",
            hedef: "/login?modul=lojistik"
        },
        { 
            id: 5, 
            baslik: "ARAÇ & KAZA", 
            aciklama: "Kaza Tutanakları ve Araç Durumları", 
            icon: <Truck size={32} />, 
            renk: "bg-slate-700",
            hedef: "/login?modul=kaza"
        },
        { 
            id: 6, 
            baslik: "SİSTEM AYARLARI", 
            aciklama: "Kullanıcı ve Yetki İşlemleri", 
            icon: <Settings size={32} />, 
            renk: "bg-gray-600",
            hedef: "/login?modul=ayarlar"
        }
    ];

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            
            {/* Arka Plan Efekti (Video veya Görsel konabilir) */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
            
            {/* İçerik */}
            <div className="relative z-10 w-full max-w-6xl">
                
                {/* Başlık Alanı */}
                <div className="text-center mb-12">
                    <h1 className="text-6xl font-black text-white tracking-widest mb-2 drop-shadow-lg">
                        TOTEM
                    </h1>
                    <div className="h-1 w-32 bg-blue-500 mx-auto rounded-full mb-4"></div>
                    <p className="text-gray-300 text-xl font-light tracking-wide uppercase">
                        Mersin Büyükşehir Belediyesi<br/>Entegre Yönetim Sistemi
                    </p>
                </div>

                {/* Grid Butonlar */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {moduller.map((modul) => (
                        <div 
                            key={modul.id}
                            onClick={() => navigate(modul.hedef)}
                            className="group cursor-pointer bg-gray-800/80 backdrop-blur-sm border border-gray-700 hover:border-white/50 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/20"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className={`p-3 rounded-xl ${modul.renk} text-white shadow-lg group-hover:scale-110 transition-transform`}>
                                    {modul.icon}
                                </div>
                                <ArrowRight className="text-gray-500 group-hover:text-white transition-colors" />
                            </div>
                            
                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                                {modul.baslik}
                            </h3>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                {modul.aciklama}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Alt Bilgi */}
                <div className="text-center mt-12 text-gray-500 text-sm">
                    &copy; 2024 Bilgi İşlem Dairesi Başkanlığı - Yazılım Şube Müdürlüğü
                </div>
            </div>
        </div>
    );
}