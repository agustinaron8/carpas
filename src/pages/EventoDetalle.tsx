import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, FileDown, FileText, ListChecks, MapPin, Pencil, Plus, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TRIBUS, tribuDe, type Carpa, type EventoCarpa } from '../../shared/model';
import { EstadoGeneralBadge, PendingBadge } from '../components/badges';
import { BotonBarra } from '../components/BotonBarra';
import { AgregarDelInventario, EventoCarpaForm, ListaEventoDialog, type Sugerencias } from '../components/EventoDialogs';
import { FichaDialog, InventarioDialog } from '../components/PdfDialogs';
import { db } from '../db/dexie';
import { carpasDeEvento, carpasVivas, compararCodigo, sePisan, vivas } from '../db/queries';
import { eventoCarpaVacia, uuid } from '../db/repo';
import { usePending } from '../hooks/usePending';
import { cantidadTexto, nombreDe, ordenar, rangoFechas, totales } from '../lib/eventos';
import { plural } from '../lib/format';

type Dialogo = { tipo: 'agregar' } | { tipo: 'editar'; ec: EventoCarpa } | { tipo: 'lista' } | { tipo: 'fichas' } | { tipo: 'inventario' };

/** Valores ya usados, sin repetir (sin importar mayúsculas), del más usado al menos usado. */
function distintos(valores: (string | null | undefined)[]): string[] {
  const cuenta = new Map<string, { v: string; n: number }>();
  for (const v of valores) {
    const t = v?.trim();
    if (!t) continue;
    const k = t.toLocaleLowerCase('es');
    const c = cuenta.get(k) ?? { v: t, n: 0 };
    c.n++;
    cuenta.set(k, c);
  }
  return [...cuenta.values()].sort((a, b) => b.n - a.n || a.v.localeCompare(b.v, 'es')).map((c) => c.v);
}

export default function EventoDetalle() {
  const { id = '' } = useParams();
  const pending = usePending();
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const data = useLiveQuery(async () => {
    const [evento, ecs, todas, eventos, todasEcs, revs] = await Promise.all([
      db.eventos.get(id),
      carpasDeEvento(id),
      db.carpas.toArray(),
      db.eventos.toArray(),
      db.eventoCarpas.toArray(),
      db.revisiones.toArray(),
    ]);
    return { evento, ecs, carpas: new Map(todas.map((c) => [c.id, c])), eventos: vivas(eventos), todasEcs: vivas(todasEcs), revs: vivas(revs) };
  }, [id]);
  const inventario = useLiveQuery(carpasVivas);

  const derivado = useMemo(() => {
    if (!data?.evento || !inventario) return null;
    const { evento, ecs, carpas } = data;
    const propias = ordenar(ecs.filter((e) => e.carpaId), carpas, 'tribu');
    const prestadas = ordenar(ecs.filter((e) => !e.carpaId), carpas, 'tribu');
    const usadas = new Set(propias.map((e) => e.carpaId));
    const disponibles = inventario.filter((c) => !usadas.has(c.id) && c.estadoGeneral !== 'baja');
    // Otros eventos en las mismas fechas, para avisar si una carpa ya está comprometida.
    const otros = new Map(data.eventos.filter((e) => e.id !== evento.id && sePisan(e, evento)).map((e) => [e.id, e.nombre]));
    const enOtros = new Map<string, string[]>();
    for (const ec of data.todasEcs) {
      const nombre = otros.get(ec.eventoId);
      if (nombre && ec.carpaId) enOtros.set(ec.carpaId, [...(enOtros.get(ec.carpaId) ?? []), nombre]);
    }
    const sugerencias: Sugerencias = {
      tribus: distintos([...TRIBUS.map((t) => t.label), ...data.todasEcs.map((e) => e.tribu), ...data.revs.map((r) => r.tribu)]),
      dirigentes: distintos([...data.todasEcs.map((e) => e.dirigente), ...data.revs.map((r) => r.dirigenteTribu)]),
    };
    const carpasPropias = propias
      .map((e) => carpas.get(e.carpaId!))
      .filter((c): c is Carpa => Boolean(c && !c.deletedAt))
      .sort(compararCodigo);
    return { propias, prestadas, disponibles, enOtros, sugerencias, carpasPropias };
  }, [data, inventario]);

  if (!data) return null;
  if (!data.evento || data.evento.deletedAt) return <p className="py-8 text-center text-slate-500">Este evento no existe o fue borrado.</p>;
  if (!derivado) return null;
  const { evento, carpas } = data;
  const { propias, prestadas, disponibles, enOtros, sugerencias, carpasPropias } = derivado;
  const t = totales([...propias, ...prestadas], carpas);
  const sinDevolver = prestadas.filter((p) => !p.devuelta).length;
  const close = () => setDialogo(null);
  const opcionesPdf = carpasPropias.map((c) => ({ id: c.id, codigo: c.codigo, nombre: c.nombre, estadoGeneral: c.estadoGeneral }));

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-semibold">{evento.nombre}</h1>
          <Link to={`/eventos/${evento.id}/editar`} className="btn-secondary shrink-0 px-3 py-1.5 text-sm">
            <Pencil size={16} /> Editar
          </Link>
        </div>
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-slate-600">
          {rangoFechas(evento) && (
            <span className="flex items-center gap-1">
              <CalendarDays size={14} /> {rangoFechas(evento)}
            </span>
          )}
          {evento.lugar && (
            <span className="flex items-center gap-1">
              <MapPin size={14} /> {evento.lugar}
            </span>
          )}
          <PendingBadge info={pending.byId.get(evento.id)} />
        </p>
        {evento.notas && <p className="whitespace-pre-line text-sm text-slate-700">{evento.notas}</p>}
        {t.carpas > 0 && (
          <p className="pt-1 text-sm text-slate-600">
            {plural(t.carpas, 'carpa', 'carpas')}
            {t.lugares > 0 && ` · ${plural(t.lugares, 'lugar', 'lugares')}`}
            {t.personas > 0 && ` · ${plural(t.personas, 'persona asignada', 'personas asignadas')}`}
            {(t.m > 0 || t.v > 0) && ` (${t.m} M, ${t.v} V)`}
          </p>
        )}
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1">
          <h2 className="font-semibold text-green-800">Del grupo ({propias.length})</h2>
          <button className="btn-ghost shrink-0 whitespace-nowrap text-sm font-medium text-green-800" onClick={() => setDialogo({ tipo: 'agregar' })}>
            <Plus size={16} /> Agregar del inventario
          </button>
        </div>
        {propias.length === 0 ? (
          <p className="py-2 text-sm text-slate-500">Todavía no hay carpas del inventario asignadas.</p>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {propias.map((ec) => {
              const c = carpas.get(ec.carpaId!);
              return (
                <Fila key={ec.id} ec={ec} carpa={c} onClick={() => setDialogo({ tipo: 'editar', ec })} pendiente={pending.byId.get(ec.id)}>
                  <span className="shrink-0 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-white">{c?.codigo ?? '?'}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{nombreDe(ec, carpas)}</span>
                  {c && c.deletedAt ? (
                    <span className="text-xs text-red-700">Borrada del inventario</span>
                  ) : (
                    c && c.estadoGeneral !== 'lista' && <EstadoGeneralBadge estado={c.estadoGeneral} />
                  )}
                </Fila>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1">
          <h2 className="font-semibold text-green-800">
            Prestadas ({prestadas.length})
            {prestadas.length > 0 && (
              <span className={`block text-xs font-medium ${sinDevolver ? 'text-amber-700' : 'text-slate-500'}`}>
                {sinDevolver === 0 ? 'Todas devueltas' : `${sinDevolver} sin devolver`}
              </span>
            )}
          </h2>
          <button
            className="btn-ghost shrink-0 whitespace-nowrap text-sm font-medium text-green-800"
            onClick={() => setDialogo({ tipo: 'editar', ec: eventoCarpaVacia(evento.id, uuid(), null) })}
          >
            <Plus size={16} /> Agregar prestada
          </button>
        </div>
        {prestadas.length === 0 ? (
          <p className="py-2 text-sm text-slate-500">Las carpas que les prestan para este evento: no entran al inventario.</p>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {prestadas.map((ec) => (
              <Fila key={ec.id} ec={ec} onClick={() => setDialogo({ tipo: 'editar', ec })} pendiente={pending.byId.get(ec.id)}>
                <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">Prestada</span>
                <span className="min-w-0 flex-1 truncate font-medium">{nombreDe(ec, carpas)}</span>
                {ec.devuelta ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                    <Undo2 size={12} /> Devuelta
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full border border-amber-300 px-2 py-0.5 text-xs font-medium text-amber-800">Sin devolver</span>
                )}
              </Fila>
            ))}
          </ul>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2">
          <BotonBarra icon={<FileDown size={20} />} label="Exportar inventario" disabled={!carpasPropias.length} onClick={() => setDialogo({ tipo: 'inventario' })} />
          <BotonBarra icon={<FileText size={20} />} label="Imprimir fichas" disabled={!carpasPropias.length} onClick={() => setDialogo({ tipo: 'fichas' })} />
          <BotonBarra icon={<ListChecks size={20} />} label="Lista para imprimir" destacado disabled={t.carpas === 0} onClick={() => setDialogo({ tipo: 'lista' })} />
        </div>
      </div>

      {dialogo?.tipo === 'agregar' && <AgregarDelInventario evento={evento} disponibles={disponibles} enOtros={enOtros} onClose={close} />}
      {dialogo?.tipo === 'editar' && (
        <EventoCarpaForm
          inicial={dialogo.ec}
          carpa={dialogo.ec.carpaId ? carpas.get(dialogo.ec.carpaId) : undefined}
          sugerencias={sugerencias}
          onClose={close}
        />
      )}
      {dialogo?.tipo === 'lista' && <ListaEventoDialog evento={evento} propias={carpasPropias} prestadas={prestadas.length} onClose={close} />}
      {dialogo?.tipo === 'fichas' && <FichaDialog opciones={opcionesPdf} elegir onClose={close} />}
      {dialogo?.tipo === 'inventario' && <InventarioDialog opciones={opcionesPdf} elegir onClose={close} />}
    </div>
  );
}

function Fila({
  ec,
  carpa,
  onClick,
  pendiente,
  children,
}: {
  ec: EventoCarpa;
  carpa?: Carpa;
  onClick: () => void;
  pendiente: { error: string | null } | undefined;
  children: React.ReactNode;
}) {
  const detalle = [ec.tribu, cantidadTexto(ec), ec.dirigente].filter(Boolean);
  const tribu = tribuDe(ec.tribu);
  const sugerido = tribu ? carpa?.sugeridoPorTribu?.[tribu] : undefined;
  const presta = [ec.prestadaPor, ec.prestadaPorTribu && `(${ec.prestadaPorTribu})`].filter(Boolean).join(' ');
  return (
    <li>
      <button className="w-full px-3 py-2.5 text-left" onClick={onClick}>
        <span className="flex min-w-0 items-center gap-2">
          {children}
          <PendingBadge info={pendiente} compact />
        </span>
        <span className="mt-0.5 block truncate text-sm text-slate-600">
          {detalle.length ? detalle.join(' · ') : <span className="text-slate-400">Sin tribu ni dirigente asignados</span>}
        </span>
        {sugerido != null && (ec.cantidad == null || ec.cantidad > sugerido) && (
          <span className={`mt-0.5 block text-xs ${ec.cantidad == null ? 'text-slate-500' : 'font-medium text-amber-700'}`}>
            {ec.cantidad == null ? `Sugerido: ${sugerido}` : `Más de lo sugerido (${sugerido})`}
          </span>
        )}
        {!ec.carpaId && presta && <span className="mt-0.5 block truncate text-xs text-amber-800">La presta: {presta}</span>}
        {ec.observaciones && <span className="mt-0.5 block truncate text-xs text-slate-500">{ec.observaciones}</span>}
      </button>
    </li>
  );
}
