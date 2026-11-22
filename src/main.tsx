import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { setMeta, getMeta } from './db/dexie';
import { getToken } from './lib/api';
import { startSync } from './sync/syncService';
import './index.css';

// Pedimos que el navegador no borre IndexedDB por falta de espacio.
void (async () => {
  if (!navigator.storage?.persist) return;
  const already = await navigator.storage.persisted();
  const ok = already || (await navigator.storage.persist());
  if ((await getMeta('persisted')) !== ok) await setMeta('persisted', ok);
})();

if (getToken()) startSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
