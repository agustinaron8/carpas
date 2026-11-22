import { useLiveQuery } from 'dexie-react-hooks';
import { Camera, Trash2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ESTADO_GENERAL_LABEL, ESTADOS_GENERALES, TIPO_LABEL, TIPOS, type Carpa, type EstadoGeneral, type Tipo } from '../../shared/model';
import { useToast } from '../components/Toast';
import { db } from '../db/dexie';
import { carpasVivas, sugerirCodigo } from '../db/queries';
import { addFoto, deleteCarpa, saveCarpa, uuid } from '../db/repo';
import { usePending } from '../hooks/usePending';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { comprimir } from '../sync/fotos';

interface FormState {
  codigo: string;
  nombre: string;
  tipo: Tipo;
  capacidad: string;
  estadoGeneral: EstadoGeneral;
  notas: string;
}

export default function CarpaEditar() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const pending = usePending();
  const existente = useLiveQuery(() => (id ? db.carpas.get(id) : undefined), [id]);
  const todas = useLiveQuery(carpasVivas);
  const [form, setForm] = useState<FormState | null>(null);
  const [fotos, setFotos] = useState<{ blob: Blob; thumbBlob: Blob }[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (form || !todas) return;
    if (id && !existente) return;
    setForm(
      existente
        ? {
            codigo: existente.codigo,
            nombre: existente.nombre,
            tipo: existente.tipo,
            capacidad: existente.capacidad?.toString() ?? '',
            estadoGeneral: existente.estadoGeneral,
            notas: existente.notas ?? '',
          }
        : { codigo: sugerirCodigo(todas), nombre: '', tipo: 'canadiense', capacidad: '', estadoGeneral: 'lista', notas: '' },
    );
  }, [form, todas, existente, id]);

  if (!form || !todas) return null;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm({ ...form, [k]: v });
  const syncError = id ? pending.byId.get(id)?.error : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form || !todas) return;
    const codigo = form.codigo.trim().toUpperCase();
    if (todas.some((c) => c.codigo.toUpperCase() === codigo && c.id !== id)) {
      setError(`Ya hay una carpa con el código ${codigo}.`);
      return;
    }
    const capacidad = form.capacidad.trim() ? Number(form.capacidad) : null;
    const carpa: Omit<Carpa, 'createdAt' | 'updatedAt' | 'deletedAt'> & Partial<Carpa> = {
      ...(existente ?? {}),
      id: existente?.id ?? uuid(),
      codigo,
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      capacidad: capacidad !== null && Number.isFinite(capacidad) ? Math.round(capacidad) : null,
      estadoGeneral: form.estadoGeneral,
      notas: form.notas.trim() || null,
      fotoPrincipalId: existente?.fotoPrincipalId ?? null,
    };
    await saveCarpa(carpa);
    for (const f of fotos) await addFoto(carpa.id, f.blob, f.thumbBlob);
    toast(existente ? 'Cambios guardados' : 'Carpa creada');
    nav(`/carpas/${carpa.id}`, { replace: true });
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setProcesando(true);
    try {
      const nuevas: { blob: Blob; thumbBlob: Blob }[] = [];
      for (const f of Array.from(files)) nuevas.push(await comprimir(f));
      setFotos((xs) => [...xs, ...nuevas]);
    } catch {
      toast('No se pudo procesar la foto');
    } finally {
      setProcesando(false);
    }
  }

  async function borrar() {
    if (!existente) return;
    if (!confirm(`¿Borrar la carpa ${existente.codigo} · ${existente.nombre}? Se oculta en todos los celulares.`)) return;
    await deleteCarpa(existente.id);
    toast('Carpa borrada');
    nav('/', { replace: true });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-xl font-semibold">{existente ? 'Editar carpa' : 'Nueva carpa'}</h1>
      {syncError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">No se pudo subir: {syncError}</p>}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor="codigo">
            Código
          </label>
          <input id="codigo" className="input font-mono uppercase" required maxLength={20} value={form.codigo} onChange={(e) => set('codigo', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label" htmlFor="nombre">
            Nombre
          </label>
          <input id="nombre" className="input" required maxLength={120} value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Nahuel 23" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="tipo">
            Tipo
          </label>
          <select id="tipo" className="input" value={form.tipo} onChange={(e) => set('tipo', e.target.value as Tipo)}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {TIPO_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="capacidad">
            Capacidad (personas)
          </label>
          <input id="capacidad" className="input" type="number" inputMode="numeric" min={0} max={1000} value={form.capacidad} onChange={(e) => set('capacidad', e.target.value)} />
        </div>
      </div>
      <div>
        <span className="label">Estado general</span>
        <div className="flex flex-wrap gap-2">
          {ESTADOS_GENERALES.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => set('estadoGeneral', s)}
              className={`rounded-full border px-3 py-1.5 text-sm ${form.estadoGeneral === s ? 'border-brand bg-brand text-on-brand' : 'border-slate-300 bg-white'}`}
            >
              {ESTADO_GENERAL_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="notas">
          Notas permanentes
        </label>
        <textarea id="notas" className="input min-h-20" value={form.notas} onChange={(e) => set('notas', e.target.value)} placeholder="Ej.: no tiene bolsa de parantes" />
      </div>
      {!existente && (
        <div>
          <span className="label">Fotos</span>
          <div className="flex flex-wrap gap-2">
            {fotos.map((f, i) => (
              <Preview key={i} blob={f.thumbBlob} onRemove={() => setFotos((xs) => xs.filter((_, j) => j !== i))} />
            ))}
            <label className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500">
              <Camera size={22} />
              {procesando ? 'Procesando…' : 'Tomar o elegir'}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />
            </label>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1" onClick={() => nav(-1)}>
          Cancelar
        </button>
        <button className="btn-primary flex-1" disabled={procesando}>
          Guardar
        </button>
      </div>
      {existente && (
        <button type="button" className="btn-danger w-full" onClick={() => void borrar()}>
          <Trash2 size={16} /> Borrar carpa
        </button>
      )}
    </form>
  );
}

function Preview({ blob, onRemove }: { blob: Blob; onRemove: () => void }) {
  const url = useObjectUrl(blob);
  return (
    <div className="relative">
      <img src={url} alt="" className="size-24 rounded-lg object-cover" />
      <button type="button" onClick={onRemove} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white" aria-label="Quitar">
        <X size={14} />
      </button>
    </div>
  );
}
