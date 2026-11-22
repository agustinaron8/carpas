import { useLiveQuery } from 'dexie-react-hooks';
import { Camera, X } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  CAMPOS_TEXTO,
  COMPONENTES,
  ESTADO_GENERAL_LABEL,
  ESTADOS_GENERALES,
  revisionVacia,
  TIPO_LABEL,
  type Carpa,
  type EstadoActual,
  type EstadoComponentes,
  type EstadoGeneral,
  type Revision,
} from '../../shared/model';
import { db } from '../db/dexie';
import { addFoto, deleteFoto, saveCarpa, saveRevision, uuid } from '../db/repo';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { comprimir } from '../sync/fotos';
import { FotoImg } from './FotoImg';
import { useToast } from './Toast';
import { fechaCorta, hoyISO } from '../lib/format';
import { ComponentesEditor } from './ComponentesEditor';

function copiarComponentes(destino: Revision, origen: EstadoComponentes): Revision {
  const r = { ...destino };
  for (const c of COMPONENTES) {
    r[`${c.key}Estado`] = origen[`${c.key}Estado`];
    r[`${c.key}Nota`] = origen[`${c.key}Nota`];
  }
  r.estacasCantidad = origen.estacasCantidad;
  return r;
}

interface Props {
  carpa: Carpa;
  /** Revisión a editar. Sin ella, se crea una nueva. */
  revision?: Revision;
  /**
   * Estado con el que se compara y se precarga: para una revisión nueva, el estado actual de la carpa;
   * al editar una, la revisión anterior a ella.
   */
  previo?: EstadoActual;
  submitLabel: string;
  onSaved: (r: Revision) => void;
  extraActions?: ReactNode;
  /** Valores que se repiten en la carga en lote (fecha, campa, dirigente de la comisión). */
  defaults?: Partial<Pick<Revision, 'fecha' | 'campa' | 'dirigenteComision'>>;
}

export function RevisionForm({ carpa, revision, previo, submitLabel, onSaved, extraActions, defaults }: Props) {
  const [precargar, setPrecargar] = useState(!revision && Boolean(previo));
  const [r, setR] = useState<Revision>(() => {
    if (revision) return revision;
    const base = { ...revisionVacia(carpa.id, uuid(), Date.now(), defaults?.fecha ?? hoyISO()), campa: defaults?.campa ?? null, dirigenteComision: defaults?.dirigenteComision ?? null };
    return previo ? copiarComponentes(base, previo.estado) : base;
  });
  const [estadoGeneral, setEstadoGeneral] = useState<EstadoGeneral>(carpa.estadoGeneral);
  const [saving, setSaving] = useState(false);
  const [nuevasFotos, setNuevasFotos] = useState<{ blob: Blob; thumbBlob: Blob }[]>([]);
  const [procesando, setProcesando] = useState(false);
  const toast = useToast();
  const fotosGuardadas = useLiveQuery(
    async () => (await db.fotos.where('revisionId').equals(r.id).toArray()).filter((f) => !f.deletedAt).sort((a, b) => a.orden - b.orden),
    [r.id],
  );

  async function onFotos(files: FileList | null) {
    if (!files?.length) return;
    setProcesando(true);
    try {
      const out: { blob: Blob; thumbBlob: Blob }[] = [];
      for (const f of Array.from(files)) out.push(await comprimir(f));
      setNuevasFotos((xs) => [...xs, ...out]);
    } catch {
      toast('No se pudo procesar la foto');
    } finally {
      setProcesando(false);
    }
  }

  const patch = (p: Partial<Revision>) => setR((x) => ({ ...x, ...p }));
  const txt = (v: string) => (v.trim() ? v : null);

  function togglePrecarga(on: boolean) {
    setPrecargar(on);
    if (!previo) return;
    const vacia = revisionVacia(carpa.id, r.id, r.createdAt, r.fecha);
    setR(on ? copiarComponentes(r, previo.estado) : copiarComponentes(r, vacia));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await saveRevision(r);
      for (const f of nuevasFotos) await addFoto(carpa.id, f.blob, f.thumbBlob, saved.id);
      if (estadoGeneral !== carpa.estadoGeneral) await saveCarpa({ ...carpa, estadoGeneral });
      onSaved(saved);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="card flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-sm">
        <span>
          <span className="text-slate-500">Nombre:</span> <b>{carpa.nombre}</b>
        </span>
        <span>
          <span className="text-slate-500">Tipo:</span> {TIPO_LABEL[carpa.tipo]}
        </span>
        <label className="ml-auto flex items-center gap-2">
          <span className="text-slate-500">Fecha</span>
          <input type="date" required className="input w-auto py-1" value={r.fecha} onChange={(e) => patch({ fecha: e.target.value })} />
        </label>
      </div>

      {previo && !revision && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={precargar} onChange={(e) => togglePrecarga(e.target.checked)} />
          Precargar con el estado actual ({previo.fuente === 'manual' ? 'editado el' : 'revisión del'} {fechaCorta(previo.fecha)})
        </label>
      )}

      <ComponentesEditor
        valor={r}
        onChange={patch}
        previo={previo?.estado}
        etiquetaPrevio={previo?.fuente === 'manual' ? 'Igual que el estado actual' : 'Igual que la anterior'}
      />

      <div className="space-y-3">
        {CAMPOS_TEXTO.map((t) => (
          <div key={t.key}>
            <label className="label" htmlFor={t.key}>
              {t.label}
            </label>
            {t.key === 'observaciones' ? (
              <textarea id={t.key} className="input min-h-24" value={r[t.key] ?? ''} onChange={(e) => patch({ [t.key]: txt(e.target.value) })} />
            ) : (
              <input id={t.key} className="input" value={r[t.key] ?? ''} onChange={(e) => patch({ [t.key]: txt(e.target.value) })} />
            )}
          </div>
        ))}
        <div>
          <span className="label">
            Fotos de la revisión <span className="font-normal text-slate-500">(opcional, ej. del daño)</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {fotosGuardadas?.map((f) => (
              <div key={f.id} className="relative">
                <FotoImg foto={f} className="size-20 rounded-lg" />
                <button
                  type="button"
                  aria-label="Borrar foto"
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                  onClick={() => confirm('¿Borrar esta foto?') && void deleteFoto(f.id)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {nuevasFotos.map((f, i) => (
              <NuevaFoto key={i} blob={f.thumbBlob} onRemove={() => setNuevasFotos((xs) => xs.filter((_, j) => j !== i))} />
            ))}
            <label className={`flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 ${procesando ? 'opacity-50' : ''}`}>
              <Camera size={20} />
              {procesando ? 'Procesando…' : 'Agregar'}
              <input type="file" accept="image/*" multiple className="hidden" disabled={procesando} onChange={(e) => void onFotos(e.target.files).then(() => (e.target.value = ''))} />
            </label>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="campa">
            Campamento <span className="font-normal text-slate-500">(opcional)</span>
          </label>
          <input id="campa" className="input" placeholder="Ej.: verano 2026" value={r.campa ?? ''} onChange={(e) => patch({ campa: txt(e.target.value) })} />
        </div>
        <div>
          <span className="label">Estado general de la carpa</span>
          <div className="flex flex-wrap gap-2">
            {ESTADOS_GENERALES.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setEstadoGeneral(s)}
                className={`rounded-full border px-3 py-1.5 text-sm ${estadoGeneral === s ? 'border-brand bg-brand text-on-brand' : 'border-slate-300 bg-white'}`}
              >
                {ESTADO_GENERAL_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        {extraActions}
        <button className="btn-primary flex-1" disabled={saving || procesando}>
          {saving ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function NuevaFoto({ blob, onRemove }: { blob: Blob; onRemove: () => void }) {
  const url = useObjectUrl(blob);
  return (
    <div className="relative">
      <img src={url} alt="" className="size-20 rounded-lg object-cover" />
      <button type="button" onClick={onRemove} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white" aria-label="Quitar">
        <X size={14} />
      </button>
    </div>
  );
}
