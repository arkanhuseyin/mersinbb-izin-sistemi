import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import DashboardLayout from './components/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import CreateLeave from './pages/CreateLeave';
import LeaveList from './pages/LeaveList';
import LeaveReports from './pages/LeaveReports';
import Settings from './pages/Settings';
import Yetkilendirme from './pages/Yetkilendirme';
import ProfileRequests from './pages/ProfileRequests';
import TalepYonetimi from './pages/TalepYonetimi'; // ✅ IMPORT EKLENDİ

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="home" replace />} />
          
          <Route path="home" element={<DashboardHome />} />
          <Route path="create-leave" element={<CreateLeave />} />
          <Route path="leaves" element={<LeaveList />} />
          <Route path="reports" element={<LeaveReports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="yetkilendirme" element={<Yetkilendirme />} />
          <Route path="profile-requests" element={<ProfileRequests />} />
          
          {/* ✅ YENİ SAYFA ROTASI */}
          <Route path="requests" element={<TalepYonetimi />} />
          
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;