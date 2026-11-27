import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import AuthScreen from './pages/AuthScreen.jsx';
import HomeScreen from './pages/HomeScreen.jsx';
import SimpleList from './pages/SimpleList.jsx';
import SimpleEditor from './pages/SimpleEditor.jsx';
import SectionList from './pages/SectionList.jsx';
import SectionWorkspace from './pages/SectionWorkspace.jsx';
import PageEditor from './pages/PageEditor.jsx';
import SharedList from './pages/SharedList.jsx';
import SharedViewer from './pages/SharedViewer.jsx';
import Loader from './components/common/Loader.jsx';

// The vault pulls in Argon2 (WebAssembly) and the strength dictionaries; load them only when it is opened
const VaultApp = lazy(() => import('./vault/VaultApp.jsx'));

function ProtectedRoute({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <Loader fullScreen />;
  if (status === 'unauthenticated') {
    return <Navigate to="/auth" replace state={{ next: location.pathname + location.search + location.hash }} />;
  }
  return children;
}

// After login/registration, return to the page that sent the user here (e.g. a shared link)
function AuthRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'authenticated') return <Navigate to={location.state?.next || '/'} replace />;
  return <AuthScreen />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthRoute />} />
      <Route path="/" element={<ProtectedRoute><HomeScreen /></ProtectedRoute>} />
      <Route path="/simple" element={<ProtectedRoute><SimpleList /></ProtectedRoute>} />
      <Route path="/simple/:id" element={<ProtectedRoute><SimpleEditor /></ProtectedRoute>} />
      <Route path="/sections" element={<ProtectedRoute><SectionList /></ProtectedRoute>} />
      <Route path="/sections/:sectionId" element={<ProtectedRoute><SectionWorkspace /></ProtectedRoute>}>
        <Route path="pages/:pageId" element={<PageEditor />} />
      </Route>
      <Route path="/shared" element={<ProtectedRoute><SharedList /></ProtectedRoute>} />
      <Route path="/shared/:type/:id" element={<ProtectedRoute><SharedViewer /></ProtectedRoute>} />
      <Route path="/vault/*" element={<ProtectedRoute><Suspense fallback={<Loader fullScreen />}><VaultApp /></Suspense></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
