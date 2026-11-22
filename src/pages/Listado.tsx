import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, CheckSquare, ClipboardList, FileDown, FileText, Plus, RefreshCw, Search, Square, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  componentesConProblema,
  ESTADO_GENERAL_LABEL,
  ESTADOS_GENERALES,
  TIPO_LABEL,
  TIPOS,
  type Carpa,
  type EstadoGeneral,
  type Revision,
  type Tipo,
} from '../../shared/model';
import { EstadoGeneralBadge, PendingBadge } from '../components/badges';
import { FotoImg } from '../components/FotoImg';
import { FichaDialog, InventarioDialog } from '../components/PdfDialogs';
import { db } from '../db/dexie';
import { carpasVivas, ultimasRevisiones } from '../db/queries';
import { usePending } from '../hooks/usePending';
import { fechaCorta, normalizar, plural } from '../lib/format';
import { syncNow, useSyncState } from '../sync/syncService';

export function tieneProblemas(c: Carpa, ultima: Revision | undefined): boolean {
  return c.estadoGeneral === 'revisar' || c.estadoGeneral === 'reparar' || componentesConProblema(ultima).length > 0;
}

export function Listado() {
  const data = useLiveQuery(async () => {
    const [carpas, ultimas, fotos] = await Promise.all([carpasVivas(), ultimasRevisiones(), db.fotos.toArray()]);
    return { carpas, ultimas, fotos: new Map(fotos.map((f) => [f.id, f])) };
  });
  const pending = usePending();
  const { syncing } = useSyncState();
  const nav = useNavigate();

  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState<Tipo | ''>('');
  const [estado, setEstado] = useState<EstadoGeneral | ''>('');
  const [conProblemas, setConProblemas] = useState(false);
  const [verBajas, setVerBajas] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<'ficha' | 'inventario' | null>(null);

  const visibles = useMemo(() => {
    if (!data) return [];
    const nq = normalizar(q.trim());
    return data.carpas.filter((c) => {
      if (nq && !normalizar(`${c.codigo} ${c.nombre}`).includes(nq)) return false;
      if (tipo && c.tipo !== tipo) return false;
      if (estado && c.estadoGeneral !== estado) return false;
      if (!estado && !verBajas && c.estadoGeneral === 'baja') return false;
      if (conProblemas && !tieneProblemas(c, data.ultimas.get(c.id))) return false;
      return true;
    });
  }, [data, q, tipo, estado, conProblemas, verBajas]);

  if (!data) return null;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const todasSeleccionadas = visibles.length > 0 && visibles.every((c) => selected.has(c.id));
  const ids = visibles.filter((c) => selected.has(c.id)).map((c) => c.id);
  const filtrando = Boolean(q || tipo || estado || conProblemas);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">
          Carpas <span className="text-base font-normal text-slate-500">({visibles.length})</span>
        </h1>
        <div className="flex gap-1">
          <button className="btn-ghost" onClick={() => void syncNow()} aria-label="Actualizar" title="Actualizar">
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
          </button>
          <button
            className={selecting ? 'btn-secondary' : 'btn-ghost'}
            onClick={() => {
              setSelecting(!selecting);
              setSelected(new Set());
            }}
          >
            {selecting ? <X size={18} /> : <CheckSquare size={18} />}
            {selecting ? 'Cancelar' : 'Seleccionar'}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Buscar por nombre o código" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto py-1.5 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value as Tipo | '')}>
            <option value="">Todos los tipos</option>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {TIPO_LABEL[t]}
              </option>
            ))}
          </select>
          <select
            className="input w-auto py-1.5 text-sm"
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoGeneral | '')}
          >
            <option value="">Todos los estados</option>
            {ESTADOS_GENERALES.map((t) => (
              <option key={t} value={t}>
                {ESTADO_GENERAL_LABEL[t]}
              </option>
            ))}
          </select>
          <button
            className={`rounded-full border px-3 py-1.5 text-sm ${conProblemas ? 'border-red-300 bg-red-50 text-red-800' : 'border-slate-300 bg-white text-slate-700'}`}
            onClick={() => setConProblemas(!conProblemas)}
          >
            <AlertTriangle size={14} className="mr-1 inline" />
            Con problemas
          </button>
          {!estado && (
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input type="checkbox" checked={verBajas} onChange={(e) => setVerBajas(e.target.checked)} />
              Ver bajas
            </label>
          )}
        </div>
      </div>

      {selecting && (
        <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm">
          <button
            className="flex items-center gap-2 font-medium"
            onClick={() => setSelected(todasSeleccionadas ? new Set() : new Set(visibles.map((c) => c.id)))}
          >
            {todasSeleccionadas ? <CheckSquare size={18} /> : <Square size={18} />}
            Seleccionar todas
          </button>
          <span className="text-slate-600">{plural(ids.length, 'seleccionada', 'seleccionadas')}</span>
        </div>
      )}

      {data.carpas.length === 0 ? (
        <div className="card p-8 text-center text-slate-600">
          <p className="mb-4">Todavía no hay carpas cargadas.</p>
          <Link to="/carpas/nueva" className="btn-primary">
            <Plus size={18} /> Agregar la primera
          </Link>
        </div>
      ) : visibles.length === 0 ? (
        <p className="py-8 text-center text-slate-500">{filtrando ? 'Ninguna carpa coincide con los filtros.' : 'No hay carpas.'}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visibles.map((c) => {
            const ultima = data.ultimas.get(c.id);
            const problemas = componentesConProblema(ultima).length;
            const p = pending.byCarpa.get(c.id);
            const isSel = selected.has(c.id);
            return (
              <li key={c.id}>
                <button
                  onClick={() => (selecting ? toggle(c.id) : nav(`/carpas/${c.id}`))}
                  className={`card flex w-full gap-3 p-2 text-left transition ${isSel ? 'border-green-600 ring-2 ring-green-600/30' : ''}`}
                >
                  {selecting && (
                    <span className="flex items-center pl-1 text-green-700">{isSel ? <CheckSquare size={20} /> : <Square size={20} />}</span>
                  )}
                  <FotoImg foto={c.fotoPrincipalId ? data.fotos.get(c.fotoPrincipalId) : undefined} className="size-20 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1 py-0.5">
                    <span className="flex items-center gap-2">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-white">{c.codigo}</span>
                      <span className="truncate font-medium">{c.nombre}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                      <EstadoGeneralBadge estado={c.estadoGeneral} />
                      <span>{TIPO_LABEL[c.tipo]}</span>
                      {c.capacidad ? <span>· {c.capacidad} pers.</span> : null}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      {ultima ? `Revisada ${fechaCorta(ultima.fecha)}` : 'Sin revisiones'}
                      {problemas > 0 && <span className="font-medium text-red-700">· {plural(problemas, 'problema', 'problemas')}</span>}
                      {p && <PendingBadge info={{ error: p.error }} compact />}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-2">
          {selecting ? (
            <>
              <button className="btn-secondary flex-1 px-2" disabled={!ids.length} onClick={() => setDialog('ficha')}>
                <FileText size={18} /> Fichas
              </button>
              <button className="btn-secondary flex-1 px-2" disabled={!ids.length} onClick={() => setDialog('inventario')}>
                <FileDown size={18} /> PDF
              </button>
              <button className="btn-primary flex-1 px-2" disabled={!ids.length} onClick={() => nav(`/lote?ids=${ids.join(',')}`)}>
                <ClipboardList size={18} /> Cargar
              </button>
            </>
          ) : (
            <>
              <button
                className="btn-secondary flex-1 px-2"
                disabled={!visibles.length}
                onClick={() => {
                  setSelected(new Set(visibles.map((c) => c.id)));
                  setDialog('inventario');
                }}
              >
                <FileDown size={18} /> Inventario
              </button>
              <Link to="/carpas/nueva" className="btn-primary flex-1 px-2">
                <Plus size={18} /> Nueva carpa
              </Link>
            </>
          )}
        </div>
      </div>

      {dialog === 'ficha' && <FichaDialog carpaIds={ids} onClose={() => setDialog(null)} />}
      {dialog === 'inventario' && (
        <InventarioDialog
          carpaIds={ids}
          onClose={() => {
            setDialog(null);
            if (!selecting) setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}
