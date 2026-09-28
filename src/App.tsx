import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { Festival } from './festival/Festival';
import { LanguageProvider } from './i18n/LanguageProvider';
import { AboutPanel } from './panels/AboutPanel';
import { ContactPanel } from './panels/ContactPanel';
import { FohPanel } from './panels/FohPanel';
import { LabPanel } from './panels/LabPanel';
import { LinksPanel } from './panels/LinksPanel';
import { MerchPanel } from './panels/MerchPanel';
import { Overview } from './panels/Overview';
import { ProjectPanel } from './panels/ProjectPanel';
import { ProjectsPanel } from './panels/ProjectsPanel';
import './panels/panels.css';

export function App() {
  return (
    <LanguageProvider>
      {/* HashRouter keeps routes after the # (e.g. /#/projects), which GitHub Pages can serve. */}
      <HashRouter>
        <Routes>
          {/* Every route renders inside <Festival>: the URL decides which place is open. */}
          <Route element={<Festival />}>
            <Route index element={<Overview />} />
            <Route path="about" element={<AboutPanel />} />
            <Route path="foh" element={<FohPanel />} />
            <Route path="projects" element={<ProjectsPanel />} />
            <Route path="projects/:slug" element={<ProjectPanel />} />
            <Route path="lab" element={<LabPanel />} />
            <Route path="contact" element={<ContactPanel />} />
            <Route path="links" element={<LinksPanel />} />
            <Route path="merch" element={<MerchPanel />} />
            {/* Old v1 addresses still lead somewhere sensible */}
            <Route path="work" element={<Navigate to="/projects" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </LanguageProvider>
  );
}
