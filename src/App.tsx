import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { getToken } from './lib/api';
import { Listado } from './pages/Listado';
import { Login } from './pages/Login';

const CarpaDetalle = lazy(() => import('./pages/CarpaDetalle'));
const CarpaEditar = lazy(() => import('./pages/CarpaEditar'));
const RevisionPage = lazy(() => import('./pages/RevisionPage'));
const Lote = lazy(() => import('./pages/Lote'));
const Pendientes = lazy(() => import('./pages/Pendientes'));
const Ajustes = lazy(() => import('./pages/Ajustes'));

function RequireAuth({ children }: { children: ReactNode }) {
  const loc = useLocation();
  if (!getToken()) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Suspense fallback={<p className="p-6 text-center text-slate-500">Cargando…</p>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<Listado />} />
              <Route path="carpas/nueva" element={<CarpaEditar />} />
              <Route path="carpas/:id" element={<CarpaDetalle />} />
              <Route path="carpas/:id/editar" element={<CarpaEditar />} />
              <Route path="carpas/:id/revision/nueva" element={<RevisionPage />} />
              <Route path="revisiones/:revisionId/editar" element={<RevisionPage />} />
              <Route path="lote" element={<Lote />} />
              <Route path="pendientes" element={<Pendientes />} />
              <Route path="ajustes" element={<Ajustes />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </ToastProvider>
    </BrowserRouter>
  );
}
