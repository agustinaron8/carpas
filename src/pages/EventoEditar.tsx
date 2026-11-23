import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { db } from '../db/dexie';
import { deleteEvento, saveEvento, uuid } from '../db/repo';

interface FormState {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  lugar: string;
  notas: string;
}

export default function EventoEditar() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const existente = useLiveQuery(() => (id ? db.eventos.get(id) : undefined), [id]);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (form) return;
    if (id && !existente) return;
    setForm({
      nombre: existente?.nombre ?? '',
      fechaInicio: existente?.fechaInicio ?? '',
      fechaFin: existente?.fechaFin ?? '',
      lugar: existente?.lugar ?? '',
      notas: existente?.notas ?? '',
    });
  }, [form, existente, id]);

  if (!form) return null;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm({ ...form, [k]: v });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (form.fechaInicio && form.fechaFin && form.fechaFin < form.fechaInicio) {
      setError('La fecha de fin es anterior a la de inicio.');
      return;
    }
    const ev = await saveEvento({
      ...(existente ?? {}),
      id: existente?.id ?? uuid(),
      nombre: form.nombre.trim(),
      fechaInicio: form.fechaInicio || null,
      fechaFin: form.fechaFin || null,
      lugar: form.lugar.trim() || null,
      notas: form.notas.trim() || null,
    });
    toast(existente ? 'Cambios guardados' : 'Evento creado');
    nav(`/eventos/${ev.id}`, { replace: true });
  }

  async function borrar() {
    if (!existente) return;
    if (!confirm(`¿Borrar el evento ${existente.nombre}? Las carpas del inventario no se tocan.`)) return;
    await deleteEvento(existente.id);
    toast('Evento borrado');
    nav('/eventos', { replace: true });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-xl font-semibold">{existente ? 'Editar evento' : 'Nuevo evento'}</h1>
      <div>
        <label className="label" htmlFor="nombre">
          Nombre
        </label>
        <input
          id="nombre"
          className="input"
          required
          maxLength={120}
          value={form.nombre}
          onChange={(e) => set('nombre', e.target.value)}
          placeholder="Campamento de promesas 2026"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="inicio">
            Desde
          </label>
          <input id="inicio" type="date" className="input" value={form.fechaInicio} onChange={(e) => set('fechaInicio', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="fin">
            Hasta
          </label>
          <input id="fin" type="date" className="input" min={form.fechaInicio || undefined} value={form.fechaFin} onChange={(e) => set('fechaFin', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="lugar">
          Lugar
        </label>
        <input id="lugar" className="input" maxLength={200} value={form.lugar} onChange={(e) => set('lugar', e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="notas">
          Notas
        </label>
        <textarea id="notas" className="input min-h-20" value={form.notas} onChange={(e) => set('notas', e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1" onClick={() => nav(-1)}>
          Cancelar
        </button>
        <button className="btn-primary flex-1">Guardar</button>
      </div>
      {existente && (
        <button type="button" className="btn-danger w-full" onClick={() => void borrar()}>
          <Trash2 size={16} /> Borrar evento
        </button>
      )}
    </form>
  );
}
