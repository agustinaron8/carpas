import { AlertTriangle, Check, Clock, CloudOff, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePending } from '../hooks/usePending';
import { haceCuanto, plural } from '../lib/format';
import { useSyncState } from '../sync/syncService';

/** Siempre visible en el header: dice si lo cargado ya está en el almacenamiento compartido. */
export function SyncIndicator() {
  const s = useSyncState();
  const p = usePending();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  let icon = <Check size={14} />;
  let text: string;
  let tone = 'text-green-800 bg-green-50 border-green-200';
  if (s.authError) {
    icon = <AlertTriangle size={14} />;
    text = 'Sesión vencida · Entrar';
    tone = 'text-red-700 bg-red-50 border-red-200';
  } else if (p.errors > 0 || (s.error && p.total > 0)) {
    icon = <AlertTriangle size={14} />;
    text = 'Error al subir · Ver';
    tone = 'text-red-700 bg-red-50 border-red-200';
  } else if (!s.online) {
    icon = <CloudOff size={14} />;
    text = p.total > 0 ? `Sin conexión · ${plural(p.total, 'cambio guardado', 'cambios guardados')} en este celular` : 'Sin conexión';
    tone = 'text-slate-700 bg-slate-100 border-slate-200';
  } else if (p.total > 0) {
    icon = s.syncing ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />;
    text = s.syncing ? `Subiendo ${plural(p.total, 'cambio', 'cambios')}…` : `${plural(p.total, 'cambio', 'cambios')} sin subir`;
    tone = 'text-amber-800 bg-amber-50 border-amber-200';
  } else if (s.syncing && !s.lastSync) {
    icon = <Loader2 size={14} className="animate-spin" />;
    text = 'Actualizando…';
  } else {
    text = s.lastSync ? `Todo subido · ${haceCuanto(s.lastSync)}` : 'Todo subido';
  }
  return (
    <Link
      to={s.authError ? '/login' : '/pendientes'}
      className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{text}</span>
    </Link>
  );
}
