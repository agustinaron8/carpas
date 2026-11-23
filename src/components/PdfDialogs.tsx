import { CheckSquare, Search, Square } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ESTADO_GENERAL_LABEL, ESTADOS_GENERALES, type EstadoGeneral } from '../../shared/model';
import { normalizar, plural } from '../lib/format';
import { EstadoGeneralBadge } from './badges';
import { Modal } from './Modal';
import { useToast } from './Toast';

function useRun() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>, onDone: () => void) {
    setBusy(true);
    try {
      await fn();
      onDone();
    } catch (err) {
      console.error(err);
      toast('No se pudo generar el PDF');
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

export interface CarpaOpcion {
  id: string;
  codigo: string;
  nombre: string;
  estadoGeneral: EstadoGeneral;
}

/**
 * Qué carpas entran al PDF. Con `opciones`, el diálogo deja filtrarlas por estado (ej. solo las listas)
 * y, con `elegir`, ofrece "Todas" o "Elegir cuáles" ahí mismo. Sin `opciones`, van las `carpaIds`
 * dadas (una sola carpa).
 */
interface Props {
  carpaIds?: string[];
  opciones?: CarpaOpcion[];
  elegir?: boolean;
  /** El listado tiene filtros activos: "todas" son las que se ven. */
  filtrado?: boolean;
  onClose: () => void;
}

/** `inicial`: estados marcados al abrir (por defecto, todos los que hay). */
export function useEleccion(opciones: CarpaOpcion[] | undefined, carpaIds: string[] = [], elegir = false, inicial?: EstadoGeneral[]) {
  const presentes = useMemo(() => ESTADOS_GENERALES.filter((e) => opciones?.some((o) => o.estadoGeneral === e)), [opciones]);
  const [estados, setEstados] = useState<Set<EstadoGeneral>>(() => {
    const ini = inicial?.filter((e) => presentes.includes(e));
    return new Set(ini?.length ? ini : presentes);
  });
  const [modo, setModo] = useState<'todas' | 'algunas'>('todas');
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const base = useMemo(() => opciones?.filter((o) => estados.has(o.estadoGeneral)) ?? [], [opciones, estados]);
  const ids = !opciones ? carpaIds : !elegir || modo === 'todas' ? base.map((o) => o.id) : base.filter((o) => elegidas.has(o.id)).map((o) => o.id);
  return { opciones, presentes, estados, setEstados, base, elegir, modo, setModo, elegidas, setElegidas, ids };
}
export type Eleccion = ReturnType<typeof useEleccion>;

/** Chips para filtrar por estado general, con cuántas hay de cada uno. */
export function FiltroEstado({ eleccion }: { eleccion: Eleccion }) {
  const { opciones = [], presentes, estados, setEstados } = eleccion;
  if (presentes.length === 0) return null;
  const toggle = (e: EstadoGeneral) =>
    setEstados((s) => {
      const n = new Set(s);
      if (n.has(e)) n.delete(e);
      else n.add(e);
      return n;
    });
  const soloListas = estados.size === 1 && estados.has('lista');
  return (
    <fieldset className="space-y-2">
      <legend className="label">Según el estado</legend>
      <div className="flex flex-wrap gap-2">
        {presentes.map((e) => {
          const n = opciones.filter((o) => o.estadoGeneral === e).length;
          const on = estados.has(e);
          return (
            <button
              type="button"
              key={e}
              aria-pressed={on}
              onClick={() => toggle(e)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${on ? 'border-green-600 bg-green-50 font-medium text-green-900' : 'border-slate-300 text-slate-500 line-through'}`}
            >
              {on ? <CheckSquare size={15} /> : <Square size={15} />}
              {ESTADO_GENERAL_LABEL[e]} ({n})
            </button>
          );
        })}
      </div>
      {presentes.includes('lista') && presentes.length > 1 && (
        <button
          type="button"
          className="text-sm font-medium text-green-800"
          onClick={() => setEstados(soloListas ? new Set(presentes) : new Set(['lista']))}
        >
          {soloListas ? 'Volver a todos los estados' : 'Solo las listas'}
        </button>
      )}
    </fieldset>
  );
}

function ElegirCarpas({ filtrado, eleccion, que }: { filtrado?: boolean; eleccion: Eleccion; que: string }) {
  const { base, modo, setModo, elegidas, setElegidas, elegir } = eleccion;
  const [q, setQ] = useState('');
  const visibles = useMemo(() => {
    const nq = normalizar(q.trim());
    return nq ? base.filter((o) => normalizar(`${o.codigo} ${o.nombre}`).includes(nq)) : base;
  }, [base, q]);
  const todasMarcadas = visibles.length > 0 && visibles.every((o) => elegidas.has(o.id));
  const toggle = (id: string) =>
    setElegidas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-3">
      <FiltroEstado eleccion={eleccion} />
      {elegir && (
        <fieldset className="space-y-2">
          <legend className="label">{que}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['todas', filtrado ? `Todas las del listado (${base.length})` : `Todas (${base.length})`],
                ['algunas', 'Elegir cuáles'],
              ] as const
            ).map(([v, l]) => (
              <label
                key={v}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${modo === v ? 'border-green-600 bg-green-50 font-medium text-green-900' : 'border-slate-300'}`}
              >
                <input type="radio" name="alcance" className="size-4" checked={modo === v} onChange={() => setModo(v)} />
                {l}
              </label>
            ))}
          </div>
          {modo === 'algunas' && (
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
              <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto">
                {visibles.map((o) => (
                  <li key={o.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                      <input type="checkbox" className="sr-only" checked={elegidas.has(o.id)} onChange={() => toggle(o.id)} />
                      <span className="text-green-700">{elegidas.has(o.id) ? <CheckSquare size={18} /> : <Square size={18} />}</span>
                      <span className="shrink-0 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-white">{o.codigo}</span>
                      <span className="min-w-0 flex-1 truncate">{o.nombre}</span>
                      <EstadoGeneralBadge estado={o.estadoGeneral} />
                    </label>
                  </li>
                ))}
                {visibles.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">Ninguna coincide.</li>}
              </ul>
              <p className="border-t border-slate-200 px-3 py-1.5 text-xs text-slate-500">
                {plural(base.filter((o) => elegidas.has(o.id)).length, 'elegida', 'elegidas')}
              </p>
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}

export function FichaDialog(props: Props) {
  const { opciones, filtrado, onClose } = props;
  const eleccion = useEleccion(opciones, props.carpaIds, props.elegir);
  const { ids } = eleccion;
  const [precargar, setPrecargar] = useState(true);
  const [dosPorHoja, setDosPorHoja] = useState(false);
  const { busy, run } = useRun();
  return (
    <Modal title={!opciones && ids.length === 1 ? 'Imprimir ficha de revisión' : 'Imprimir fichas de revisión'} onClose={onClose}>
      <div className="space-y-4">
        {opciones && <ElegirCarpas filtrado={filtrado} eleccion={eleccion} que="¿Qué fichas?" />}
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 size-4" checked={precargar} onChange={(e) => setPrecargar(e.target.checked)} />
          <span>
            <span className="font-medium">Precargar última revisión</span>
            <span className="block text-sm text-slate-500">La columna 1 sale completa y la 2 queda en blanco para la revisión nueva.</span>
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 size-4" checked={dosPorHoja} onChange={(e) => setDosPorHoja(e.target.checked)} />
          <span>
            <span className="font-medium">2 fichas por hoja</span>
            <span className="block text-sm text-slate-500">A4 apaisada, para ahorrar papel. Queda menos lugar para escribir.</span>
          </span>
        </label>
        <button
          className="btn-primary w-full"
          disabled={busy || ids.length === 0}
          onClick={() =>
            run(async () => {
              const { generarFichas } = await import('../pdf/ficha');
              await generarFichas(ids, { precargar, dosPorHoja });
            }, onClose)
          }
        >
          {busy ? 'Generando…' : ids.length === 0 ? (eleccion.base.length === 0 && opciones?.length ? 'Ningún estado elegido' : 'Elegí al menos una carpa') : `Descargar ${plural(ids.length, 'ficha', 'fichas')} para imprimir`}
        </button>
      </div>
    </Modal>
  );
}

export function InventarioDialog(props: Props) {
  const { opciones, filtrado, onClose } = props;
  const eleccion = useEleccion(opciones, props.carpaIds, props.elegir);
  const { ids } = eleccion;
  const [revisiones, setRevisiones] = useState<'ninguna' | 'ultimas' | 'todas'>('ultimas');
  const [ultimasN, setUltimasN] = useState(3);
  const [fotos, setFotos] = useState(true);
  const { busy, run } = useRun();
  return (
    <Modal title={!opciones && ids.length === 1 ? 'Exportar a PDF' : 'Exportar inventario'} onClose={onClose}>
      <div className="space-y-4">
        {opciones && <ElegirCarpas filtrado={filtrado} eleccion={eleccion} que="¿Qué carpas?" />}
        <fieldset className="space-y-2">
          <legend className="label">Revisiones anteriores</legend>
          {(
            [
              ['ninguna', 'Solo el estado actual'],
              ['ultimas', 'Las últimas'],
              ['todas', 'Todas'],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className="flex items-center gap-3">
              <input type="radio" name="rev" className="size-4" checked={revisiones === v} onChange={() => setRevisiones(v)} />
              <span>{l}</span>
              {v === 'ultimas' && (
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="input w-20 py-1"
                  value={ultimasN}
                  onChange={(e) => setUltimasN(Math.max(1, Number(e.target.value) || 1))}
                  onFocus={() => setRevisiones('ultimas')}
                />
              )}
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="size-4" checked={fotos} onChange={(e) => setFotos(e.target.checked)} />
          <span className="font-medium">Incluir fotos</span>
        </label>
        <button
          className="btn-primary w-full"
          disabled={busy || ids.length === 0}
          onClick={() =>
            run(async () => {
              const { generarInventario } = await import('../pdf/inventario');
              await generarInventario(ids, {
                revisiones: revisiones === 'ninguna' ? 0 : revisiones === 'todas' ? Infinity : ultimasN,
                fotos,
              });
            }, onClose)
          }
        >
          {busy ? 'Generando…' : ids.length === 0 ? (eleccion.base.length === 0 && opciones?.length ? 'Ningún estado elegido' : 'Elegí al menos una carpa') : `Descargar PDF (${plural(ids.length, 'carpa', 'carpas')})`}
        </button>
      </div>
    </Modal>
  );
}
