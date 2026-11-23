import { useLiveQuery } from 'dexie-react-hooks';
import { Camera, ChevronDown, ChevronRight, ClipboardPlus, FileDown, FileText, Pencil, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CAMPOS_TEXTO,
  COMPONENTES,
  componentesConFaltante,
  componentesConProblema,
  estadoActual,
  TIPO_LABEL,
  type Carpa,
  type EstadoComponentes,
  type Revision,
} from '../../shared/model';
import { EstadoBadge, EstadoGeneralBadge, PendingBadge } from '../components/badges';
import { FotoImg } from '../components/FotoImg';
import { SugeridoDesplegable } from '../components/SugeridoPorTribu';
import { FichaDialog, InventarioDialog } from '../components/PdfDialogs';
import { useToast } from '../components/Toast';
import { db, type LocalFoto } from '../db/dexie';
import { fotosDeCarpa, fotosPorRevision, revisionesDe } from '../db/queries';
import { addFoto, deleteFoto, setFotoPrincipal } from '../db/repo';
import { usePending, type PendingState } from '../hooks/usePending';
import { fechaCorta, plural } from '../lib/format';
import { comprimir } from '../sync/fotos';

export default function CarpaDetalle() {
  const { id = '' } = useParams();
  const data = useLiveQuery(async () => {
    const carpa = await db.carpas.get(id);
    const [fotos, fotosRev, revisiones] = await Promise.all([fotosDeCarpa(id), fotosPorRevision(id), revisionesDe(id)]);
    return { carpa, fotos, fotosRev, revisiones };
  }, [id]);
  const pending = usePending();
  const [dialog, setDialog] = useState<'ficha' | 'inventario' | null>(null);

  if (!data) return null;
  const { carpa, fotos, fotosRev, revisiones } = data;
  if (!carpa || carpa.deletedAt)
    return (
      <p className="py-8 text-center text-slate-500">
        Esta carpa no existe o fue borrada. <Link to="/" className="text-green-700 underline">Volver</Link>
      </p>
    );
  const ultima = revisiones[0];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-sm text-white">{carpa.codigo}</span>
            <PendingBadge info={pending.byId.get(carpa.id)} />
          </div>
          <h1 className="mt-1 text-2xl font-semibold">{carpa.nombre}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <EstadoGeneralBadge estado={carpa.estadoGeneral} />
            <span>{TIPO_LABEL[carpa.tipo]}</span>
            {carpa.capacidad ? <span>· {carpa.capacidad} personas</span> : null}
          </div>
        </div>
        <Link to={`/carpas/${carpa.id}/editar`} className="btn-secondary shrink-0">
          <Pencil size={16} /> Editar
        </Link>
      </div>

      <SugeridoDesplegable carpaId={carpa.id} sugerido={carpa.sugeridoPorTribu} />

      <Fotos carpaId={carpa.id} principalId={carpa.fotoPrincipalId} fotos={fotos} pending={pending} />

      {carpa.notas && <p className="whitespace-pre-wrap rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{carpa.notas}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Link to={`/carpas/${carpa.id}/revision/nueva`} className="btn-primary col-span-2 sm:col-span-1">
          <ClipboardPlus size={18} /> Cargar revisión
        </Link>
        <button className="btn-secondary px-2" onClick={() => setDialog('ficha')}>
          <FileText size={18} /> Imprimir ficha
        </button>
        <button className="btn-secondary px-2" onClick={() => setDialog('inventario')}>
          <FileDown size={18} /> Exportar a PDF
        </button>
      </div>

      <EstadoActualSeccion carpa={carpa} ultima={ultima} fotos={ultima ? fotosRev.get(ultima.id) : undefined} pending={pending} />

      {revisiones.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Historial ({revisiones.length})</h2>
          <ul className="space-y-2">
            {revisiones.map((r) => (
              <HistorialItem key={r.id} r={r} fotos={fotosRev.get(r.id)} pending={pending} />
            ))}
          </ul>
        </section>
      )}

      {dialog === 'ficha' && <FichaDialog carpaIds={[carpa.id]} onClose={() => setDialog(null)} />}
      {dialog === 'inventario' && <InventarioDialog carpaIds={[carpa.id]} onClose={() => setDialog(null)} />}
    </div>
  );
}

function Fotos({ carpaId, principalId, fotos, pending }: { carpaId: string; principalId: string | null; fotos: LocalFoto[]; pending: PendingState }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [abierta, setAbierta] = useState<LocalFoto | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        const { blob, thumbBlob } = await comprimir(f);
        await addFoto(carpaId, blob, thumbBlob);
      }
    } catch (err) {
      console.error(err);
      toast('No se pudo procesar la foto');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {fotos.map((f) => (
          <button key={f.id} className="relative shrink-0" onClick={() => setAbierta(f)}>
            <FotoImg foto={f} className="size-28 rounded-lg" />
            {f.id === principalId && fotos.length > 1 && (
              <Star size={16} className="absolute left-1.5 top-1.5 fill-yellow-400 text-yellow-500" />
            )}
            <span className="absolute bottom-1 right-1">
              <PendingBadge info={pending.byId.get(f.id)} compact />
            </span>
          </button>
        ))}
        <label className={`flex size-28 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-sm text-slate-500 ${busy ? 'opacity-50' : ''}`}>
          <Camera size={24} />
          {busy ? 'Procesando…' : 'Agregar foto'}
          <input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => void onFiles(e.target.files).then(() => (e.target.value = ''))} />
        </label>
      </div>
      {abierta && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black/90" onClick={() => setAbierta(null)}>
          <div className="flex flex-1 items-center justify-center p-2">
            <FotoImg foto={abierta} full className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex justify-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            {pending.byId.get(abierta.id)?.error && <p className="self-center text-sm text-red-300">{pending.byId.get(abierta.id)?.error}</p>}
            {abierta.id !== principalId && (
              <button className="btn-secondary" onClick={() => void setFotoPrincipal(carpaId, abierta.id).then(() => setAbierta(null))}>
                <Star size={16} /> Principal
              </button>
            )}
            <button
              className="btn-danger"
              onClick={() => {
                if (confirm('¿Borrar esta foto?')) void deleteFoto(abierta.id).then(() => setAbierta(null));
              }}
            >
              <Trash2 size={16} /> Borrar
            </button>
            <button className="btn-secondary" onClick={() => setAbierta(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Estado actual: editable a mano, sin cargar una revisión. Muestra lo más nuevo (edición o última revisión). */
function EstadoActualSeccion({ carpa, ultima, fotos, pending }: { carpa: Carpa; ultima?: Revision; fotos?: LocalFoto[]; pending: PendingState }) {
  const actual = estadoActual(carpa, ultima);
  return (
    <section>
      <h2 className="mb-2 font-semibold">
        Estado actual{' '}
        {actual && (
          <span className="font-normal text-slate-500">
            · {actual.fuente === 'manual' ? 'editado el' : 'revisión del'} {fechaCorta(actual.fecha)}
          </span>
        )}
      </h2>
      {actual ? (
        <TablaRevision r={ultima} estado={actual.estado} fotos={fotos} pending={pending} />
      ) : (
        <p className="text-sm text-slate-500">Todavía no tiene revisiones. El estado se puede cargar con "Editar".</p>
      )}
    </section>
  );
}

/** Componentes (de `estado`, o de la revisión) y, si hay revisión, sus textos y fotos. */
export function TablaRevision({ r, estado, fotos, pending }: { r?: Revision; estado?: EstadoComponentes; fotos?: LocalFoto[]; pending?: PendingState }) {
  const [abierta, setAbierta] = useState<LocalFoto | null>(null);
  const e = estado ?? r!;
  return (
    <div className="card divide-y divide-slate-100 text-sm">
      {fotos && fotos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-3 py-2">
          {fotos.map((f) => (
            <button key={f.id} type="button" className="relative shrink-0" onClick={() => setAbierta(f)}>
              <FotoImg foto={f} className="size-20 rounded-lg" />
              <span className="absolute bottom-1 right-1">
                <PendingBadge info={pending?.byId.get(f.id)} compact />
              </span>
            </button>
          ))}
        </div>
      )}
      {abierta && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/90 p-2" onClick={() => setAbierta(null)}>
          <FotoImg foto={abierta} full className="max-h-full max-w-full object-contain" />
        </div>
      )}
      {COMPONENTES.map((c) => (
        <div key={c.key} className="flex items-start gap-3 px-3 py-2">
          <span className="w-32 shrink-0 text-slate-600">{c.label}</span>
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {c.key === 'estacas' && e.estacasCantidad !== null && <span className="font-medium">{e.estacasCantidad}</span>}
            <EstadoBadge estado={e[`${c.key}Estado`]} />
            {e[`${c.key}Nota`] && <span className="text-slate-700">{e[`${c.key}Nota`]}</span>}
          </span>
        </div>
      ))}
      {r && CAMPOS_TEXTO.map((t) =>
        r[t.key] ? (
          <div key={t.key} className="flex items-start gap-3 px-3 py-2">
            <span className="w-32 shrink-0 text-slate-600">{t.label}</span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap">{r[t.key]}</span>
          </div>
        ) : null,
      )}
      {r?.campa && (
        <div className="flex items-start gap-3 px-3 py-2">
          <span className="w-32 shrink-0 text-slate-600">Campamento</span>
          <span>{r.campa}</span>
        </div>
      )}
    </div>
  );
}

function HistorialItem({ r, fotos, pending }: { r: Revision; fotos?: LocalFoto[]; pending: PendingState }) {
  const [open, setOpen] = useState(false);
  const problemas = componentesConProblema(r);
  const faltantes = componentesConFaltante(r);
  return (
    <li className="card">
      <div className="flex items-center">
      <button className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-3 pr-1 text-left" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <span className="font-medium">{fechaCorta(r.fecha)}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-slate-500">
          {[r.tribu, r.campa].filter(Boolean).join(' · ')}
          {problemas.length > 0 && <span className="text-red-700"> · {plural(problemas.length, 'problema', 'problemas')}</span>}
          {faltantes.length > 0 && <span className="text-purple-700"> · {plural(faltantes.length, 'faltante', 'faltantes')}</span>}
          {fotos?.length ? <span> · {plural(fotos.length, 'foto', 'fotos')}</span> : null}
        </span>
        <PendingBadge info={pending.byId.get(r.id)} compact />
      </button>
      <Link
        to={`/revisiones/${r.id}/editar`}
        className="mr-1.5 shrink-0 rounded-lg p-2.5 text-slate-600 hover:bg-slate-100"
        aria-label={`Editar revisión del ${fechaCorta(r.fecha)}`}
        title="Editar revisión"
      >
        <Pencil size={18} />
      </Link>
      </div>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          <TablaRevision r={r} fotos={fotos} pending={pending} />
          <Link to={`/revisiones/${r.id}/editar`} className="btn-secondary">
            <Pencil size={16} /> Editar revisión
          </Link>
        </div>
      )}
    </li>
  );
}
