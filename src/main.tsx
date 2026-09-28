import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { warnOnMismatchedKeys } from './i18n/dictionaries';
import './styles/global.css';

if (import.meta.env.DEV) warnOnMismatchedKeys();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
