import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomeScreen from './pages/HomeScreen.jsx';
import SimpleList from './pages/SimpleList.jsx';
import SimpleEditor from './pages/SimpleEditor.jsx';
import SectionList from './pages/SectionList.jsx';
import SectionWorkspace from './pages/SectionWorkspace.jsx';
import PageEditor from './pages/PageEditor.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/simple" element={<SimpleList />} />
        <Route path="/simple/:id" element={<SimpleEditor />} />
        <Route path="/sections" element={<SectionList />} />
        <Route path="/sections/:sectionId" element={<SectionWorkspace />}>
          <Route path="pages/:pageId" element={<PageEditor />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
