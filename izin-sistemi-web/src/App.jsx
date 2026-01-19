import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import Header from './components/Header'; // ✅ Yeni Header Eklendi
import { ModuleProvider } from './context/ModuleContext'; // ✅ Context Eklendi

// --- SAYFALAR ---
import DashboardHome from './pages/DashboardHome'; 
import LeaveRequests from './pages/LeaveRequests'; 
import ProfilOnay from './pages/ProfilOnay';       
import CreateLeave from './pages/CreateLeave';     
import Settings from './pages/Settings';           
import LeaveReports from './pages/LeaveReports';   
import Yetkilendirme from './pages/Yetkilendirme'; 
import TalepYonetimi from './pages/TalepYonetimi'; 
import HrLeaveEntry from './pages/HrLeaveEntry';

const DashboardLayout = () => (
  // Dikey yerleşim: Üstte Header, Altta (Sidebar + İçerik)
  <div className="d-flex flex-column vh-100 vw-100 overflow-hidden bg-light">
    
    {/* Üst Bar (Header) */}
    <div className="flex-shrink-0 w-100">
      <Header />
    </div>

    {/* Alt Kısım */}
    <div className="d-flex flex-grow-1 overflow-hidden">
      {/* Sol Sidebar */}
      <div className="flex-shrink-0 h-100" style={{ width: '260px' }}>
        <Sidebar />
      </div>
      
      {/* Sağ İçerik Alanı */}
      <div className="flex-grow-1 overflow-auto h-100 w-100 position-relative">
        <div className="container-fluid p-0"> 
          <Outlet /> 
        </div>
      </div>
    </div>
  </div>
);

function App() {
  return (
    // ✅ Tüm uygulamayı Provider ile sarmaladık
    <ModuleProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          
          <Route path="/dashboard" element={<DashboardLayout />}>   
              <Route path="home" element={<DashboardHome />} /> 
              <Route path="leaves" element={<LeaveRequests />} />
              <Route path="create-leave" element={<CreateLeave />} />
              <Route path="profile-requests" element={<ProfilOnay />} />
              <Route path="reports" element={<LeaveReports />} />
              <Route path="settings" element={<Settings />} />
              <Route path="yetkilendirme" element={<Yetkilendirme />} /> 
              <Route path="requests" element={<TalepYonetimi />} /> 
              <Route path="hr-entry" element={<HrLeaveEntry />} /> 
          </Route>
        </Routes>
      </BrowserRouter>
    </ModuleProvider>
  );
}

export default App;