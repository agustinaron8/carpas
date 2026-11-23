import { CalendarDays, Tent } from 'lucide-react';
import { NavLink } from 'react-router-dom';

/** Carpas (inventario) y Eventos: las dos pantallas principales. */
export function Pestanas() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium ${isActive ? 'bg-white text-green-800 shadow-sm' : 'text-slate-600'}`;
  return (
    <nav className="flex gap-1 rounded-lg bg-slate-100 p-1">
      <NavLink to="/" end replace className={cls}>
        <Tent size={16} /> Carpas
      </NavLink>
      <NavLink to="/eventos" end replace className={cls}>
        <CalendarDays size={16} /> Eventos
      </NavLink>
    </nav>
  );
}
