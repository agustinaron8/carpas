import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, CloudUpload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PendingBadge } from '../components/badges';
import { db } from '../db/dexie';
import { usePending } from '../hooks/usePending';
import { fechaCorta, haceCuanto, plural } from '../lib/format';
import { syncNow, useSyncState } from '../sync/syncService';

interface Item {
  id: string;
  texto: string;
  link: string;
}

export default function Pendientes() {
  const s = useSyncState();
  const pending = usePending();
  const items = useLiveQuery(async () => {
    const [outbox, fotos, carpas] = await Promise.all([db.outbox.toArray(), db.fotos.where('url').equals('').toArray(), db.carpas.toArray()]);
    const nombre = new Map(carpas.map((c) => [c.id, c.nombre]));
    const out: Item[] = [];
    for (const e of outbox) {
      if (e.entidad === 'carpas') {
        const c = carpas.find((x) => x.id === e.entityId);
        out.push({ id: e.entityId, texto: c?.deletedAt ? `Borrado de ${c.nombre}` : `Carpa ${c?.nombre ?? ''}`, link: `/carpas/${e.entityId}` });
      } else if (e.entidad === 'revisiones') {
        const r = await db.revisiones.get(e.entityId);
        out.push({
          id: e.entityId,
          texto: `${r?.deletedAt ? 'Borrado de revisión' : 'Revisión'} de ${nombre.get(r?.carpaId ?? '') ?? '?'} · ${r ? fechaCorta(r.fecha).slice(0, 5) : ''}`,
          link: r ? `/carpas/${r.carpaId}` : '/',
        });
      } else {
        const f = await db.fotos.get(e.entityId);
        out.push({ id: e.entityId, texto: `${f?.deletedAt ? 'Borrado de foto' : 'Foto'}${f?.revisionId ? ' de revisión' : ''} de ${nombre.get(f?.carpaId ?? '') ?? '?'}`, link: f ? `/carpas/${f.carpaId}` : '/' });
      }
    }
    for (const f of fotos) if (!f.deletedAt) out.push({ id: f.id, texto: `Foto${f.revisionId ? ' de revisión' : ''} de ${nombre.get(f.carpaId) ?? '?'}`, link: `/carpas/${f.carpaId}` });
    return out;
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pendientes de subir</h1>
      <div className="card space-y-1 p-3 text-sm">
        <p>
          {s.online ? 'Con conexión' : 'Sin conexión'} · Última sincronización: {s.lastSync ? haceCuanto(s.lastSync) : 'nunca'}
        </p>
        {s.error && <p className="text-red-700">Último error: {s.error}</p>}
        {s.authError && (
          <p>
            <Link to="/login" className="font-medium text-red-700 underline">
              Volver a entrar
            </Link>{' '}
            para seguir subiendo. Lo cargado no se pierde.
          </p>
        )}
      </div>
      {items && items.length === 0 ? (
        <div className="py-8 text-center text-slate-600">
          <CheckCircle2 size={40} className="mx-auto mb-2 text-green-700" />
          Todo lo cargado en este celular ya está subido.
        </div>
      ) : (
        <>
          <ul className="card divide-y divide-slate-100">
            {items?.map((it) => {
              const info = pending.byId.get(it.id);
              return (
                <li key={it.id} className="px-3 py-2.5">
                  <Link to={it.link} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{it.texto}</span>
                    <PendingBadge info={info} />
                  </Link>
                  {info?.error && <p className="mt-1 text-xs text-red-700">{info.error}</p>}
                </li>
              );
            })}
          </ul>
          <button className="btn-primary w-full" disabled={s.syncing || !s.online} onClick={() => void syncNow()}>
            <CloudUpload size={18} />
            {s.syncing ? 'Subiendo…' : s.online ? (pending.errors ? 'Reintentar' : 'Subir ahora') : 'Sin conexión'}
          </button>
          {items && <p className="text-center text-xs text-slate-500">{plural(items.length, 'cambio guardado', 'cambios guardados')} en este celular.</p>}
        </>
      )}
    </div>
  );
}
