import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';

// --- SAYFALARIMIZ ---
import DashboardHome from './pages/DashboardHome'; // Grafikli Ana Ekran (Kokpit)
import LeaveRequests from './pages/LeaveRequests'; // İzin Listesi ve Onaylar
import ProfilOnay from './pages/ProfilOnay';       // Profil Değişiklik Onayları
import CreateLeave from './pages/CreateLeave';     // Yeni İzin Talebi Formu
import Settings from './pages/Settings';           // Ayarlar ve Personel Yönetimi
import LeaveReports from './pages/LeaveReports';   // İzin Takip Raporu (Excel İndirme)
import Yetkilendirme from './pages/Yetkilendirme'; // <--- 1. YENİ EKLENEN IMPORT

// --- LAYOUT BİLEŞENİ ---
const DashboardLayout = () => (
  <div className="d-flex vh-100 vw-100 overflow-hidden">
    {/* Sol Menü (Sabit) */}
    <div className="flex-shrink-0" style={{ width: '260px' }}>
      <Sidebar />
    </div>
    
    {/* Sağ İçerik (Kaydırılabilir) */}
    <div className="flex-grow-1 overflow-auto bg-light h-100 w-100">
      <div className="container-fluid p-0"> {/* Padding'i sayfa içlerinde veriyoruz */}
        <Outlet /> 
      </div>
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Giriş Yönlendirmesi */}
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        {/* Yönetim Paneli (İç İçe Rotalar) */}
        <Route path="/dashboard" element={<DashboardLayout />}>   
            {/* 1. Ana Sayfa */}
            <Route path="home" element={<DashboardHome />} /> 
            {/* 2. İzin Listesi (Onay/Red) */}
            <Route path="leaves" element={<LeaveRequests />} />
            {/* 3. Yeni İzin Talebi */}
            <Route path="create-leave" element={<CreateLeave />} />
            {/* 4. Profil Onayları (Admin/İK/Filo) */}
            <Route path="profile-requests" element={<ProfilOnay />} />
            {/* 5. İzin Takip Raporu (Admin/İK) */}
            <Route path="reports" element={<LeaveReports />} />
            {/* 6. Ayarlar ve Personel Yönetimi */}
            <Route path="settings" element={<Settings />} />
            {/* 7. Yetkilendirme Paneli */}
            <Route path="yetkilendirme" element={<Yetkilendirme />} /> {/* <--- 2. YENİ EKLENEN ROTA */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;