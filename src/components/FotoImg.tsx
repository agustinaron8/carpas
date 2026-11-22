import { ImageOff, Tent } from 'lucide-react';
import { useState } from 'react';
import type { LocalFoto } from '../db/dexie';
import { useObjectUrl } from '../hooks/useObjectUrl';

/** Muestra la miniatura guardada en el celular; si no está, la de Blob (cacheada por el SW). */
export function FotoImg({ foto, full, className = '' }: { foto: LocalFoto | undefined; full?: boolean; className?: string }) {
  const local = useObjectUrl(full ? (foto?.blob ?? foto?.thumbBlob) : (foto?.thumbBlob ?? foto?.blob));
  const [failed, setFailed] = useState(false);
  const remote = full ? foto?.url || foto?.thumbUrl : foto?.thumbUrl;
  const src = full && navigator.onLine && foto?.url ? (local && foto.blob ? local : foto.url) : (local ?? remote);
  if (!foto)
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-300 ${className}`}>
        <Tent size={32} />
      </div>
    );
  if (!src || failed)
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-300 ${className}`}>
        <ImageOff size={24} />
      </div>
    );
  return <img src={src} alt="" crossOrigin="anonymous" loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
}
