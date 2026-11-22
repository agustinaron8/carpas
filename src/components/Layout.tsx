import { ArrowLeft, Moon, Settings, Sun, Tent } from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTema } from '../hooks/useTema';
import { SyncIndicator } from './SyncIndicator';
import { UpdatePrompt } from './UpdatePrompt';

/** A dónde lleva "volver" cuando no hay historial (ej. se abrió el link del QR de una ficha). */
function pantallaAnterior(path: string): string {
  const m = path.match(/^\/carpas\/([^/]+)\/(editar|revision\/nueva)$/);
  if (m && m[1] !== 'nueva') return `/carpas/${m[1]}`;
  return '/';
}

function BotonVolver() {
  const nav = useNavigate();
  const loc = useLocation();
  return (
    <button
      className="-ml-1 inline-flex shrink-0 items-center gap-1 rounded-full border border-green-600 bg-green-50 py-1.5 pl-2 pr-3 text-sm font-semibold text-green-800 active:scale-95"
      aria-label="Volver"
      // Con historial dentro de la app, vuelve como el gesto; si no, a la pantalla de arriba.
      onClick={() => (loc.key !== 'default' ? nav(-1) : nav(pantallaAnterior(loc.pathname), { replace: true }))}
    >
      <ArrowLeft size={20} strokeWidth={2.5} />
      Volver
    </button>
  );
}

export function Layout() {
  const { oscuro, setTema } = useTema();
  const enInicio = useLocation().pathname === '/';
  return (
    <div className="mx-auto min-h-screen max-w-3xl pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        {enInicio ? (
          <Link to="/" className="flex shrink-0 items-center gap-1.5 font-semibold text-green-800">
            <Tent size={22} />
            <span className="hidden sm:inline">Carpas</span>
          </Link>
        ) : (
          <BotonVolver />
        )}
        <div className="flex min-w-0 flex-1 justify-center">
          <SyncIndicator />
        </div>
        <button
          className="btn-ghost shrink-0"
          onClick={() => setTema(oscuro ? 'claro' : 'oscuro')}
          aria-label={oscuro ? 'Pasar a modo claro' : 'Pasar a modo oscuro'}
          title={oscuro ? 'Modo claro' : 'Modo oscuro'}
        >
          {oscuro ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <Link to="/ajustes" className="btn-ghost shrink-0" aria-label="Ajustes">
          <Settings size={20} />
        </Link>
      </header>
      <UpdatePrompt />
      <main className="px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
