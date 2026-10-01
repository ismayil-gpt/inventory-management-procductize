import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
// Self-hosted faces (§9.3) — bundled by Vite, never fetched from a CDN.
import '@fontsource/overpass/400.css';
import '@fontsource/overpass/600.css';
import '@fontsource/overpass/800.css';
import '@fontsource/overpass-mono/400.css';
import '@fontsource/overpass-mono/600.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@shared/design-tokens/design-tokens.css';
import './styles/global.css';
import './internationalisation/i18n';
import { App } from './App';
import { initPreferences } from './application-shell/preferences.store';

// Apply saved theme + language to <html> before first paint.
initPreferences();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
