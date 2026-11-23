// Diálogos de la pantalla de un evento: agregar carpas del inventario, editar una carpa del evento
// (propia o prestada) y exportar la lista.
import { CheckSquare, Search, Square, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { GENERO_LABEL, GENEROS, type Carpa, type Evento, type EventoCarpa, type Genero } from '../../shared/model';
import { db } from '../db/dexie';
import { deleteEventoCarpa, eventoCarpaVacia, idEventoCarpa, saveEventoCarpas } from '../db/repo';
import type { OrdenLista } from '../lib/eventos';
import { normalizar, plural } from '../lib/format';
import { EstadoGeneralBadge } from './badges';
import { Modal } from './Modal';
import { FiltroEstado, useEleccion } from './PdfDialogs';
import { useToast } from './Toast';

const op = (c: Carpa) => ({ id: c.id, codigo: c.codigo, nombre: c.nombre, estadoGeneral: c.estadoGeneral });

export function AgregarDelInventario({
  evento,
  disponibles,
  enOtros,
  onClose,
}: {
  evento: Evento;
  /** Carpas que todavía no están en el evento (sin las dadas de baja). */
  disponibles: Carpa[];
  /** Carpa → nombres de otros eventos en las mismas fechas donde ya está. */
  enOtros: Map<string, string[]>;
  onClose: () => void;
}) {
  const toast = useToast();
  const opciones = useMemo(() => disponibles.map(op), [disponibles]);
  const eleccion = useEleccion(opciones, [], false, ['lista']);
  const [q, setQ] = useState('');
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const porId = useMemo(() => new Map(disponibles.map((c) => [c.id, c])), [disponibles]);
  const visibles = useMemo(() => {
    const nq = normalizar(q.trim());
    return eleccion.base.filter((o) => !nq || normalizar(`${o.codigo} ${o.nombre}`).includes(nq));
  }, [eleccion.base, q]);
  const ids = eleccion.base.filter((o) => elegidas.has(o.id)).map((o) => o.id);
  const todasMarcadas = visibles.length > 0 && visibles.every((o) => elegidas.has(o.id));
  const toggle = (id: string) =>
    setElegidas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function agregar() {
    setGuardando(true);
    try {
      const rows: EventoCarpa[] = [];
      for (const carpaId of ids) {
        const id = await idEventoCarpa(evento.id, carpaId);
        // Si se había quitado, vuelve con lo que tenía anotado.
        const antes = await db.eventoCarpas.get(id);
        rows.push(antes ? { ...antes, deletedAt: null } : eventoCarpaVacia(evento.id, id, carpaId));
      }
      await saveEventoCarpas(rows);
      toast(`${plural(rows.length, 'carpa agregada', 'carpas agregadas')}`);
      onClose();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title="Agregar carpas del grupo" onClose={onClose}>
      <div className="space-y-3">
        {disponibles.length === 0 ? (
          <p className="text-sm text-slate-600">Todas las carpas del inventario ya están en este evento.</p>
        ) : (
          <>
            <FiltroEstado eleccion={eleccion} />
            <div className="rounded-lg border border-slate-300">
              <div className="flex items-center gap-2 border-b border-slate-200 p-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="input py-1.5 pl-8 text-sm" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <button
                  type="button"
                  className="shrink-0 text-sm font-medium text-green-800"
                  onClick={() =>
                    setElegidas((s) => {
                      const n = new Set(s);
                      for (const o of visibles) {
                        if (todasMarcadas) n.delete(o.id);
                        else n.add(o.id);
                      }
                      return n;
                    })
                  }
                >
                  {todasMarcadas ? 'Desmarcar' : 'Marcar'} {q ? 'estas' : 'todas'}
                </button>
              </div>
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                {visibles.map((o) => {
                  const c = porId.get(o.id);
                  const otros = enOtros.get(o.id);
                  return (
                    <li key={o.id}>
                      <label className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm">
                        <input type="checkbox" className="sr-only" checked={elegidas.has(o.id)} onChange={() => toggle(o.id)} />
                        <span className="pt-0.5 text-green-700">{elegidas.has(o.id) ? <CheckSquare size={18} /> : <Square size={18} />}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="shrink-0 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-white">{o.codigo}</span>
                            <span className="min-w-0 flex-1 truncate">{o.nombre}</span>
                            <EstadoGeneralBadge estado={o.estadoGeneral} />
                          </span>
                          {(c?.capacidad || otros) && (
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {c?.capacidad ? `${c.capacidad} pers.` : ''}
                              {otros && <span className="font-medium text-amber-700">{c?.capacidad ? ' · ' : ''}También en {otros.join(', ')}</span>}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
                {visibles.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">Ninguna coincide.</li>}
              </ul>
            </div>
          </>
        )}
        <button className="btn-primary w-full" disabled={guardando || ids.length === 0} onClick={() => void agregar()}>
          {ids.length === 0 ? 'Marcá las carpas a agregar' : `Agregar ${plural(ids.length, 'carpa', 'carpas')}`}
        </button>
      </div>
    </Modal>
  );
}

export interface Sugerencias {
  tribus: string[];
  dirigentes: string[];
}

/** Editar lo anotado de una carpa en el evento. Para prestadas, también sus datos. */
export function EventoCarpaForm({
  inicial,
  carpa,
  sugerencias,
  onClose,
}: {
  inicial: EventoCarpa;
  carpa?: Carpa;
  sugerencias: Sugerencias;
  onClose: () => void;
}) {
  const toast = useToast();
  const prestada = !inicial.carpaId;
  const nueva = prestada && !inicial.createdAt;
  const [f, setF] = useState({
    nombre: inicial.nombre ?? '',
    prestadaPor: inicial.prestadaPor ?? '',
    capacidad: inicial.capacidad?.toString() ?? '',
    devuelta: inicial.devuelta,
    tribu: inicial.tribu ?? '',
    cantidad: inicial.cantidad?.toString() ?? '',
    genero: inicial.genero,
    dirigente: inicial.dirigente ?? '',
    observaciones: inicial.observaciones ?? '',
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const entero = (s: string) => {
    const n = s.trim() ? Math.round(Number(s)) : null;
    return n !== null && Number.isFinite(n) && n >= 0 ? Math.min(n, 1000) : null;
  };
  const txt = (s: string) => s.trim() || null;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    await saveEventoCarpas([
      {
        ...inicial,
        nombre: prestada ? txt(f.nombre) : null,
        prestadaPor: prestada ? txt(f.prestadaPor) : null,
        capacidad: prestada ? entero(f.capacidad) : null,
        devuelta: prestada && f.devuelta,
        tribu: txt(f.tribu),
        cantidad: entero(f.cantidad),
        genero: f.genero,
        dirigente: txt(f.dirigente),
        observaciones: txt(f.observaciones),
      },
    ]);
    toast(nueva ? 'Carpa prestada agregada' : 'Cambios guardados');
    onClose();
  }

  async function quitar() {
    const cual = prestada ? f.nombre || 'esta carpa prestada' : carpa?.nombre;
    if (!confirm(`¿Quitar ${cual} del evento?${prestada ? '' : ' La carpa sigue en el inventario.'}`)) return;
    await deleteEventoCarpa(inicial.id);
    toast('Quitada del evento');
    onClose();
  }

  const titulo = nueva ? 'Carpa prestada' : prestada ? f.nombre || 'Carpa prestada' : `${carpa?.codigo ?? ''} · ${carpa?.nombre ?? 'Carpa'}`;
  return (
    <Modal title={titulo} onClose={onClose}>
      <form onSubmit={guardar} className="space-y-3">
        {prestada ? (
          <>
            <div>
              <label className="label" htmlFor="ec-nombre">
                Carpa
              </label>
              <input
                id="ec-nombre"
                className="input"
                required
                maxLength={120}
                value={f.nombre}
                onChange={(e) => set('nombre', e.target.value)}
                placeholder="Ej.: iglú verde"
                autoFocus={nueva}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="label" htmlFor="ec-por">
                  Prestada por
                </label>
                <input id="ec-por" className="input" maxLength={120} value={f.prestadaPor} onChange={(e) => set('prestadaPor', e.target.value)} placeholder="Familia, otro grupo…" />
              </div>
              <div>
                <label className="label" htmlFor="ec-cap">
                  Capacidad
                </label>
                <input id="ec-cap" className="input" type="number" inputMode="numeric" min={0} max={1000} value={f.capacidad} onChange={(e) => set('capacidad', e.target.value)} />
              </div>
            </div>
          </>
        ) : (
          carpa && (
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <EstadoGeneralBadge estado={carpa.estadoGeneral} />
              {carpa.capacidad ? `${carpa.capacidad} pers. · ` : ''}
              <Link to={`/carpas/${carpa.id}`} className="font-medium text-green-800 underline">
                Ver carpa
              </Link>
            </p>
          )
        )}
        <div>
          <label className="label" htmlFor="ec-tribu">
            Tribu
          </label>
          <input id="ec-tribu" className="input" list="ec-tribus" maxLength={120} value={f.tribu} onChange={(e) => set('tribu', e.target.value)} />
          <datalist id="ec-tribus">
            {sugerencias.tribus.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="ec-cant">
              Cantidad de personas
            </label>
            <input id="ec-cant" className="input" type="number" inputMode="numeric" min={0} max={1000} value={f.cantidad} onChange={(e) => set('cantidad', e.target.value)} />
          </div>
          <div>
            <span className="label">Mujeres o varones</span>
            <div className="flex gap-1.5">
              {([...GENEROS, null] as (Genero | null)[]).map((g) => (
                <button
                  type="button"
                  key={g ?? 'n'}
                  onClick={() => set('genero', g)}
                  title={g ? GENERO_LABEL[g] : 'Sin indicar'}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium ${f.genero === g ? 'border-brand bg-brand text-on-brand' : 'border-slate-300'}`}
                >
                  {g ? g.toUpperCase() : '—'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="ec-diri">
            Dirigente a cargo
          </label>
          <input id="ec-diri" className="input" list="ec-diris" maxLength={200} value={f.dirigente} onChange={(e) => set('dirigente', e.target.value)} />
          <datalist id="ec-diris">
            {sugerencias.dirigentes.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="ec-obs">
            Observaciones
          </label>
          <textarea id="ec-obs" className="input min-h-16" maxLength={2000} value={f.observaciones} onChange={(e) => set('observaciones', e.target.value)} />
        </div>
        {prestada && !nueva && (
          <label className="flex items-center gap-3">
            <input type="checkbox" className="size-4" checked={f.devuelta} onChange={(e) => set('devuelta', e.target.checked)} />
            <span className="font-medium">Ya se devolvió</span>
          </label>
        )}
        <div className="flex gap-2 pt-1">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary flex-1">{nueva ? 'Agregar' : 'Guardar'}</button>
        </div>
        {!nueva && (
          <button type="button" className="btn-danger w-full" onClick={() => void quitar()}>
            <Trash2 size={16} /> Quitar del evento
          </button>
        )}
      </form>
    </Modal>
  );
}

export function ListaEventoDialog({
  evento,
  propias,
  prestadas,
  onClose,
}: {
  evento: Evento;
  propias: Carpa[];
  prestadas: number;
  onClose: () => void;
}) {
  const toast = useToast();
  const opciones = useMemo(() => propias.map(op), [propias]);
  const eleccion = useEleccion(opciones);
  const [conPrestadas, setConPrestadas] = useState(prestadas > 0);
  const [orden, setOrden] = useState<OrdenLista>('tribu');
  const [busy, setBusy] = useState(false);
  const ids = eleccion.ids;
  const total = ids.length + (conPrestadas ? prestadas : 0);

  async function descargar() {
    setBusy(true);
    try {
      const { generarListaEvento } = await import('../pdf/evento');
      await generarListaEvento(evento.id, { carpaIds: ids, prestadas: conPrestadas, orden });
      onClose();
    } catch (err) {
      console.error(err);
      toast('No se pudo generar el PDF');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Lista de carpas del evento" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Para imprimir: una tabla con las carpas del grupo y otra con las prestadas, con una columna de observaciones para anotar a mano.
        </p>
        {propias.length > 0 && (
          <div className="space-y-1">
            <p className="font-medium">Carpas del grupo</p>
            <FiltroEstado eleccion={eleccion} />
          </div>
        )}
        {prestadas > 0 && (
          <label className="flex items-center gap-3">
            <input type="checkbox" className="size-4" checked={conPrestadas} onChange={(e) => setConPrestadas(e.target.checked)} />
            <span className="font-medium">Incluir las prestadas ({prestadas})</span>
          </label>
        )}
        <fieldset className="space-y-2">
          <legend className="label">Orden</legend>
          {(
            [
              ['tribu', 'Por tribu'],
              ['carpa', 'Por carpa'],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className="flex items-center gap-3">
              <input type="radio" name="orden" className="size-4" checked={orden === v} onChange={() => setOrden(v)} />
              <span>{l}</span>
            </label>
          ))}
        </fieldset>
        <button className="btn-primary w-full" disabled={busy || total === 0} onClick={() => void descargar()}>
          {busy ? 'Generando…' : total === 0 ? 'No queda ninguna carpa' : `Descargar lista (${plural(total, 'carpa', 'carpas')})`}
        </button>
      </div>
    </Modal>
  );
}
