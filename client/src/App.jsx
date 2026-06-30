import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import AuthScreen from './pages/AuthScreen.jsx';
import HomeScreen from './pages/HomeScreen.jsx';
import SimpleList from './pages/SimpleList.jsx';
import SimpleEditor from './pages/SimpleEditor.jsx';
import SectionList from './pages/SectionList.jsx';
import SectionWorkspace from './pages/SectionWorkspace.jsx';
import PageEditor from './pages/PageEditor.jsx';
import Loader from './components/common/Loader.jsx';

function ProtectedRoute({ children }) {
  const { status } = useAuth();
  if (status === 'loading') return <Loader fullScreen />;
  if (status === 'unauthenticated') return <Navigate to="/auth" replace />;
  return children;
}

function AppRoutes() {
  const { status } = useAuth();
  return (
    <Routes>
      <Route
        path="/auth"
        element={status === 'authenticated' ? <Navigate to="/" replace /> : <AuthScreen />}
      />
      <Route path="/" element={<ProtectedRoute><HomeScreen /></ProtectedRoute>} />
      <Route path="/simple" element={<ProtectedRoute><SimpleList /></ProtectedRoute>} />
      <Route path="/simple/:id" element={<ProtectedRoute><SimpleEditor /></ProtectedRoute>} />
      <Route path="/sections" element={<ProtectedRoute><SectionList /></ProtectedRoute>} />
      <Route path="/sections/:sectionId" element={<ProtectedRoute><SectionWorkspace /></ProtectedRoute>}>
        <Route path="pages/:pageId" element={<PageEditor />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
