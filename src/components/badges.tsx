import { AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { ESTADO_GENERAL_LABEL, ESTADO_LABEL, type Estado, type EstadoGeneral } from '../../shared/model';
import type { PendingInfo } from '../hooks/usePending';
import { useSyncState } from '../sync/syncService';

const GENERAL_COLOR: Record<EstadoGeneral, string> = {
  lista: 'bg-green-100 text-green-800',
  revisar: 'bg-amber-100 text-amber-800',
  reparar: 'bg-red-100 text-red-800',
  baja: 'bg-slate-200 text-slate-600',
};

export function EstadoGeneralBadge({ estado }: { estado: EstadoGeneral }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${GENERAL_COLOR[estado]}`}>
      {ESTADO_GENERAL_LABEL[estado]}
    </span>
  );
}

export const ESTADO_COLOR: Record<Estado, string> = {
  bien: 'bg-green-100 text-green-800 border-green-300',
  regular: 'bg-amber-100 text-amber-800 border-amber-300',
  mal: 'bg-red-100 text-red-800 border-red-300',
  falta: 'bg-purple-100 text-purple-800 border-purple-300',
};

export function EstadoBadge({ estado }: { estado: Estado | null }) {
  if (!estado) return <span className="text-xs text-slate-400">—</span>;
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[estado]}`}>{ESTADO_LABEL[estado]}</span>;
}

/** Estado de subida de un registro: nada si ya está en el servidor. */
export function PendingBadge({ info, compact }: { info: PendingInfo | undefined; compact?: boolean }) {
  const { syncing } = useSyncState();
  if (!info) return null;
  if (info.error)
    return (
      <span title={info.error} className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        <AlertTriangle size={12} />
        {!compact && 'Error al subir'}
      </span>
    );
  if (syncing)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
        <Loader2 size={12} className="animate-spin" />
        {!compact && 'Subiendo'}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      <Clock size={12} />
      {!compact && 'Sin subir'}
    </span>
  );
}
