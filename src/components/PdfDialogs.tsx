import { useState } from 'react';
import { plural } from '../lib/format';
import { Modal } from './Modal';
import { useToast } from './Toast';

function useRun() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>, onDone: () => void) {
    setBusy(true);
    try {
      await fn();
      onDone();
    } catch (err) {
      console.error(err);
      toast('No se pudo generar el PDF');
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

export function FichaDialog({ carpaIds, onClose }: { carpaIds: string[]; onClose: () => void }) {
  const [precargar, setPrecargar] = useState(true);
  const [dosPorHoja, setDosPorHoja] = useState(false);
  const { busy, run } = useRun();
  return (
    <Modal title={carpaIds.length === 1 ? 'Ficha de revisión' : `Fichas de revisión (${carpaIds.length})`} onClose={onClose}>
      <div className="space-y-3">
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 size-4" checked={precargar} onChange={(e) => setPrecargar(e.target.checked)} />
          <span>
            <span className="font-medium">Precargar última revisión</span>
            <span className="block text-sm text-slate-500">La columna 1 sale completa y la 2 queda en blanco para la revisión nueva.</span>
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 size-4" checked={dosPorHoja} onChange={(e) => setDosPorHoja(e.target.checked)} />
          <span>
            <span className="font-medium">2 fichas por hoja</span>
            <span className="block text-sm text-slate-500">A4 apaisada, para ahorrar papel. Queda menos lugar para escribir.</span>
          </span>
        </label>
        <button
          className="btn-primary w-full"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const { generarFichas } = await import('../pdf/ficha');
              await generarFichas(carpaIds, { precargar, dosPorHoja });
            }, onClose)
          }
        >
          {busy ? 'Generando…' : `Generar ${plural(carpaIds.length, 'ficha', 'fichas')}`}
        </button>
      </div>
    </Modal>
  );
}

export function InventarioDialog({ carpaIds, onClose }: { carpaIds: string[]; onClose: () => void }) {
  const [revisiones, setRevisiones] = useState<'ninguna' | 'ultimas' | 'todas'>('ultimas');
  const [ultimasN, setUltimasN] = useState(3);
  const [fotos, setFotos] = useState(true);
  const { busy, run } = useRun();
  return (
    <Modal title={`Inventario (${plural(carpaIds.length, 'carpa', 'carpas')})`} onClose={onClose}>
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="label">Revisiones anteriores</legend>
          {(
            [
              ['ninguna', 'Solo el estado actual'],
              ['ultimas', 'Las últimas'],
              ['todas', 'Todas'],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className="flex items-center gap-3">
              <input type="radio" name="rev" className="size-4" checked={revisiones === v} onChange={() => setRevisiones(v)} />
              <span>{l}</span>
              {v === 'ultimas' && (
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="input w-20 py-1"
                  value={ultimasN}
                  onChange={(e) => setUltimasN(Math.max(1, Number(e.target.value) || 1))}
                  onFocus={() => setRevisiones('ultimas')}
                />
              )}
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="size-4" checked={fotos} onChange={(e) => setFotos(e.target.checked)} />
          <span className="font-medium">Incluir fotos</span>
        </label>
        <button
          className="btn-primary w-full"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const { generarInventario } = await import('../pdf/inventario');
              await generarInventario(carpaIds, {
                revisiones: revisiones === 'ninguna' ? 0 : revisiones === 'todas' ? Infinity : ultimasN,
                fotos,
              });
            }, onClose)
          }
        >
          {busy ? 'Generando…' : 'Exportar PDF'}
        </button>
      </div>
    </Modal>
  );
}
