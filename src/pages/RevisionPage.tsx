import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RevisionForm } from '../components/RevisionForm';
import { useToast } from '../components/Toast';
import { db } from '../db/dexie';
import { revisionesDe } from '../db/queries';
import { deleteRevision } from '../db/repo';
import { fechaCorta } from '../lib/format';

export default function RevisionPage() {
  const { id, revisionId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  // Se lee una sola vez: si cambia mientras se edita, el formulario no se reinicia.
  const data = useLiveQuery(async () => {
    const revision = revisionId ? await db.revisiones.get(revisionId) : undefined;
    const carpaId = revision?.carpaId ?? id ?? '';
    const carpa = await db.carpas.get(carpaId);
    const revs = await revisionesDe(carpaId);
    const anterior = revision ? revs.find((r) => r.id !== revision.id && (r.fecha < revision.fecha || (r.fecha === revision.fecha && r.createdAt < revision.createdAt))) : revs[0];
    return { carpa, revision, anterior, loaded: true };
  }, []);

  if (!data) return null;
  const { carpa, revision, anterior } = data;
  if (!carpa || carpa.deletedAt || (revisionId && !revision))
    return (
      <p className="py-8 text-center text-slate-500">
        No se encontró. <Link to="/" className="text-green-700 underline">Volver</Link>
      </p>
    );

  return (
    <div className="space-y-4">
      <div>
        <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-sm text-white">{carpa.codigo}</span>
        <h1 className="mt-1 text-xl font-semibold">{revision ? `Editar revisión del ${fechaCorta(revision.fecha)}` : 'Cargar revisión'}</h1>
      </div>
      <RevisionForm
        carpa={carpa}
        revision={revision}
        anterior={anterior}
        submitLabel="Guardar revisión"
        onSaved={() => {
          toast('Revisión guardada');
          nav(`/carpas/${carpa.id}`, { replace: true });
        }}
        extraActions={
          revision && (
            <button
              type="button"
              className="btn-danger"
              aria-label="Borrar revisión"
              onClick={() => {
                if (!confirm('¿Borrar esta revisión?')) return;
                void deleteRevision(revision.id).then(() => {
                  toast('Revisión borrada');
                  nav(`/carpas/${carpa.id}`, { replace: true });
                });
              }}
            >
              <Trash2 size={16} />
            </button>
          )
        }
      />
    </div>
  );
}
