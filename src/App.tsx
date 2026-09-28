import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { Shell } from './components/Shell';
import { LanguageProvider } from './i18n/LanguageProvider';
import { AboutView } from './stations/AboutView';
import { ContactView } from './stations/ContactView';
import { EntryView } from './stations/EntryView';
import { LabView } from './stations/LabView';
import { ProjectView } from './stations/ProjectView';
import { WorkView } from './stations/WorkView';
import './stations/stations.css';

export function App() {
  return (
    <LanguageProvider>
      {/* HashRouter keeps routes after the # (e.g. /#/work), which GitHub Pages can serve. */}
      <HashRouter>
        <Routes>
          {/* Every route renders inside <Shell>, at the position of its <Outlet />. */}
          <Route element={<Shell />}>
            <Route index element={<EntryView />} />
            <Route path="work" element={<WorkView />} />
            <Route path="lab" element={<LabView />} />
            <Route path="about" element={<AboutView />} />
            <Route path="contact" element={<ContactView />} />
            <Route path="projects/:slug" element={<ProjectView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </LanguageProvider>
  );
}
