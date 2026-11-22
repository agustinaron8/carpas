import { useLiveQuery } from 'dexie-react-hooks';
import { LogOut, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, getMeta } from '../db/dexie';
import { usePending } from '../hooks/usePending';
import { useTema } from '../hooks/useTema';
import type { Tema } from '../lib/theme';
import { logout } from '../lib/api';
import { haceCuanto, plural } from '../lib/format';
import { resetCursor, syncNow, useSyncState } from '../sync/syncService';

export default function Ajustes() {
  const s = useSyncState();
  const pending = usePending();
  const nav = useNavigate();
  const { tema, setTema } = useTema();
  const persisted = useLiveQuery(() => getMeta<boolean>('persisted'));
  const counts = useLiveQuery(async () => ({ carpas: await db.carpas.count(), revisiones: await db.revisiones.count(), fotos: await db.fotos.count() }));

  const sinSubir = plural(pending.total, 'cambio', 'cambios');
  function confirmarPerdida(accion: string): boolean {
    if (pending.total === 0) return confirm(`¿${accion}?`);
    return confirm(`Tenés ${sinSubir} sin subir. Si continuás, se pierden. ¿${accion} igual?`);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Ajustes</h1>
      <section className="card space-y-2 p-4 text-sm">
        <h2 className="font-semibold">Sincronización</h2>
        <p>Estado: {s.online ? 'con conexión' : 'sin conexión'}{s.syncing && ' · sincronizando…'}</p>
        <p>Última sincronización: {s.lastSync ? haceCuanto(s.lastSync) : 'nunca'}</p>
        <p>Sin subir: {pending.total}</p>
        {s.error && <p className="text-red-700">Error: {s.error}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <button className="btn-primary" disabled={s.syncing} onClick={() => void syncNow()}>
            <RefreshCw size={16} /> Sincronizar ahora
          </button>
          <button className="btn-secondary" disabled={s.syncing} onClick={() => void resetCursor()}>
            Volver a bajar todo
          </button>
        </div>
      </section>
      <section className="card space-y-2 p-4 text-sm">
        <h2 className="font-semibold">Apariencia</h2>
        <div className="flex gap-2">
          {(
            [
              ['sistema', 'Como el celular'],
              ['claro', 'Claro'],
              ['oscuro', 'Oscuro'],
            ] as [Tema, string][]
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setTema(v)}
              className={`rounded-full border px-3 py-1.5 ${tema === v ? 'border-brand bg-brand text-on-brand' : 'border-slate-300 bg-white'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </section>
      <section className="card space-y-1 p-4 text-sm">
        <h2 className="font-semibold">Este celular</h2>
        {counts && (
          <p>
            Guardado: {plural(counts.carpas, 'carpa', 'carpas')}, {plural(counts.revisiones, 'revisión', 'revisiones')}, {plural(counts.fotos, 'foto', 'fotos')}.
          </p>
        )}
        {persisted === false && (
          <p className="rounded bg-amber-50 p-2 text-amber-900">
            El navegador no garantizó guardar los datos de forma permanente. Instalá la app en la pantalla de inicio y subí los cambios seguido.
          </p>
        )}
        {persisted === true && <p className="text-slate-600">El navegador no va a borrar los datos por falta de espacio.</p>}
        <p className="text-slate-500">Versión {__APP_VERSION__}</p>
      </section>
      <section className="space-y-2">
        <button
          className="btn-secondary w-full"
          onClick={() => {
            const msg = pending.total
              ? `Tenés ${sinSubir} sin subir. Quedan en este celular, pero no se suben hasta que vuelvas a entrar. ¿Cerrar sesión?`
              : '¿Cerrar sesión? Para volver a entrar alcanza con la contraseña, aunque no haya señal.';
            if (!confirm(msg)) return;
            logout();
            nav('/login', { replace: true });
          }}
        >
          <LogOut size={16} /> Cerrar sesión
        </button>
        <button
          className="btn-danger w-full"
          onClick={() => {
            if (!confirmarPerdida('Borrar los datos de este celular')) return;
            void db.delete().then(() => location.replace('/'));
          }}
        >
          <Trash2 size={16} /> Borrar datos locales
        </button>
        <p className="text-center text-xs text-slate-500">Borrar los datos locales no toca lo que ya está subido: se vuelve a bajar.</p>
      </section>
    </div>
  );
}
