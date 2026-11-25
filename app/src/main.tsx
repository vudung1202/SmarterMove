import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { captureInstallPrompt } from './lib/install.ts';
import { registerOffline } from './lib/offline.ts';
import './styles/fonts.css';
import './styles/app.css';
import './styles/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

captureInstallPrompt();
registerOffline();
