import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Revision } from '../../shared/model';
import { RevisionForm } from '../components/RevisionForm';
import { db } from '../db/dexie';
import { compararCodigo, ultimaRevision } from '../db/queries';
import { plural } from '../lib/format';

/** Después de una jornada de revisión: recorre las carpas elegidas una por una. */
export default function Lote() {
  const [params] = useSearchParams();
  const ids = useMemo(() => (params.get('ids') ?? '').split(',').filter(Boolean), [params]);
  const [i, setI] = useState(0);
  const [guardadas, setGuardadas] = useState(0);
  const [defaults, setDefaults] = useState<Partial<Revision>>({});

  const carpas = useLiveQuery(async () => (await db.carpas.bulkGet(ids)).filter((c) => c && !c.deletedAt).map((c) => c!).sort(compararCodigo), [ids]);
  const actual = carpas?.[i];
  const anterior = useLiveQuery(async () => (actual ? ((await ultimaRevision(actual.id)) ?? null) : null), [actual?.id]);

  if (!carpas) return null;
  if (i >= carpas.length)
    return (
      <div className="card space-y-4 p-6 text-center">
        <CheckCircle2 size={48} className="mx-auto text-green-700" />
        <p className="text-lg font-medium">Listo: {plural(guardadas, 'revisión guardada', 'revisiones guardadas')}.</p>
        <Link to="/" className="btn-primary">
          Volver al listado
        </Link>
      </div>
    );
  if (!actual || anterior === undefined) return null;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center justify-between text-sm text-slate-500">
          <span>
            Carpa {i + 1} de {carpas.length}
          </span>
          <span>{plural(guardadas, 'guardada', 'guardadas')}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-green-700 transition-all" style={{ width: `${(i / carpas.length) * 100}%` }} />
        </div>
        <h1 className="mt-3 text-xl font-semibold">
          <span className="mr-2 rounded bg-slate-800 px-2 py-0.5 font-mono text-base text-white">{actual.codigo}</span>
          {actual.nombre}
        </h1>
      </div>
      <RevisionForm
        key={actual.id}
        carpa={actual}
        anterior={anterior ?? undefined}
        defaults={defaults}
        submitLabel={i + 1 < carpas.length ? 'Guardar y siguiente' : 'Guardar y terminar'}
        onSaved={(r) => {
          setDefaults({ fecha: r.fecha, campa: r.campa, dirigenteComision: r.dirigenteComision });
          setGuardadas((n) => n + 1);
          setI((n) => n + 1);
          window.scrollTo(0, 0);
        }}
        extraActions={
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setI((n) => n + 1);
              window.scrollTo(0, 0);
            }}
          >
            Saltar
          </button>
        }
      />
    </div>
  );
}
