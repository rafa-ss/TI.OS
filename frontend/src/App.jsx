import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Equipment from './pages/Equipment';
import Laboratories from './pages/Laboratories';
import LaboratoryDetail from './pages/LaboratoryDetail';
import Kits from './pages/Kits';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import EquipmentDetail from './pages/EquipmentDetail';
import Schools from './pages/Schools';
import Users from './pages/Users';
import Reports from './pages/Reports';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="ordens" element={<Orders />} />
        <Route path="ordens/:id" element={<OrderDetail />} />
        <Route path="equipamentos" element={<ProtectedRoute roles={['admin','tecnico']}><Equipment /></ProtectedRoute>} />
        <Route path="laboratorios" element={<ProtectedRoute roles={['admin','tecnico']}><Laboratories /></ProtectedRoute>} />
        <Route path="laboratorios/:id" element={<ProtectedRoute roles={['admin','tecnico']}><LaboratoryDetail /></ProtectedRoute>} />
        <Route path="kits" element={<ProtectedRoute roles={['admin','tecnico']}><Kits /></ProtectedRoute>} />
        <Route path="equipamentos/:id" element={<ProtectedRoute roles={['admin','tecnico']}><EquipmentDetail /></ProtectedRoute>} />
        <Route path="escolas" element={<Schools />} />
        <Route path="chat" element={<Chat />} />
        <Route path="perfil" element={<Profile />} />
        <Route path="relatorios" element={<ProtectedRoute roles={['admin','tecnico']}><Reports /></ProtectedRoute>} />
        <Route path="usuarios" element={<ProtectedRoute roles={['admin']}><Users /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
