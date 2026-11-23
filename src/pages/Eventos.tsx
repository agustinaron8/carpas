import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, MapPin, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Pestanas } from '../components/Pestanas';
import { db } from '../db/dexie';
import { eventosVivos, vivas } from '../db/queries';
import { usePending } from '../hooks/usePending';
import { PendingBadge } from '../components/badges';
import { hoyISO, plural } from '../lib/format';
import { rangoFechas } from '../lib/eventos';

export default function Eventos() {
  const nav = useNavigate();
  const pending = usePending();
  const data = useLiveQuery(async () => {
    const [eventos, ecs] = await Promise.all([eventosVivos(), db.eventoCarpas.toArray()]);
    const cuenta = new Map<string, { propias: number; prestadas: number; sinDevolver: number }>();
    for (const ec of vivas(ecs)) {
      const c = cuenta.get(ec.eventoId) ?? { propias: 0, prestadas: 0, sinDevolver: 0 };
      if (ec.carpaId) c.propias++;
      else {
        c.prestadas++;
        if (!ec.devuelta) c.sinDevolver++;
      }
      cuenta.set(ec.eventoId, c);
    }
    return { eventos, cuenta };
  });
  if (!data) return null;
  const hoy = hoyISO();

  return (
    <div className="space-y-4">
      <Pestanas />
      <h1 className="text-xl font-semibold">
        Eventos <span className="text-base font-normal text-slate-500">({data.eventos.length})</span>
      </h1>
      {data.eventos.length === 0 ? (
        <div className="card p-8 text-center text-slate-600">
          <CalendarDays size={36} className="mx-auto mb-2 text-green-700" />
          <p className="mb-1 font-medium">Todavía no hay eventos.</p>
          <p className="mb-4 text-sm">
            Cargá un campamento para asignarle carpas del inventario, anotar las prestadas y sacar la lista para imprimir.
          </p>
          <Link to="/eventos/nuevo" className="btn-primary">
            <Plus size={18} /> Nuevo evento
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.eventos.map((ev) => {
            const c = data.cuenta.get(ev.id) ?? { propias: 0, prestadas: 0, sinDevolver: 0 };
            const fin = ev.fechaFin ?? ev.fechaInicio;
            const pasado = Boolean(fin && fin < hoy);
            const enCurso = Boolean(ev.fechaInicio && ev.fechaInicio <= hoy && fin && fin >= hoy);
            return (
              <li key={ev.id}>
                <Link to={`/eventos/${ev.id}`} className={`card block p-3 ${pasado ? 'opacity-70' : ''}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{ev.nombre}</span>
                    {enCurso && <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">En curso</span>}
                    <PendingBadge info={pending.byId.get(ev.id)} compact />
                  </span>
                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-slate-600">
                    {rangoFechas(ev) && (
                      <span className="flex items-center gap-1">
                        <CalendarDays size={14} /> {rangoFechas(ev)}
                      </span>
                    )}
                    {ev.lugar && (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} /> {ev.lugar}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {plural(c.propias, 'carpa del grupo', 'carpas del grupo')} · {plural(c.prestadas, 'prestada', 'prestadas')}
                    {c.sinDevolver > 0 && <span className="font-medium text-amber-700"> ({c.sinDevolver} sin devolver)</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <button className="btn-primary w-full" onClick={() => nav('/eventos/nuevo')}>
            <Plus size={18} /> Nuevo evento
          </button>
        </div>
      </div>
    </div>
  );
}
