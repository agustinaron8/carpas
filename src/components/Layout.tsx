import { Settings, Tent } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { SyncIndicator } from './SyncIndicator';
import { UpdatePrompt } from './UpdatePrompt';

export function Layout() {
  return (
    <div className="mx-auto min-h-screen max-w-3xl pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        <Link to="/" className="flex shrink-0 items-center gap-1.5 font-semibold text-green-800">
          <Tent size={22} />
          <span className="hidden sm:inline">Carpas</span>
        </Link>
        <div className="flex min-w-0 flex-1 justify-center">
          <SyncIndicator />
        </div>
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
