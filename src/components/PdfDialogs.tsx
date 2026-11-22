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

/**
 * Desde el listado: el diálogo abre con "todas" y ofrece elegir cuáles, que pasa a la selección múltiple.
 * `descripcion` dice qué abarca "todas" (ej. "Todas las carpas (33)").
 */
export interface Alcance {
  descripcion: string;
  onElegir: () => void;
}

function AlcanceCampo({ alcance, verbo }: { alcance: Alcance; verbo: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-100 px-3 py-2 text-sm">
      <span>
        <span className="text-slate-500">{verbo}: </span>
        <span className="font-medium">{alcance.descripcion}</span>
      </span>
      <button type="button" className="shrink-0 font-medium text-green-800 underline" onClick={alcance.onElegir}>
        Elegir cuáles…
      </button>
    </div>
  );
}

export function FichaDialog({ carpaIds, onClose, alcance }: { carpaIds: string[]; onClose: () => void; alcance?: Alcance }) {
  const [precargar, setPrecargar] = useState(true);
  const [dosPorHoja, setDosPorHoja] = useState(false);
  const { busy, run } = useRun();
  return (
    <Modal title={carpaIds.length === 1 ? 'Imprimir ficha de revisión' : 'Imprimir fichas de revisión'} onClose={onClose}>
      <div className="space-y-3">
        {alcance ? <AlcanceCampo alcance={alcance} verbo="Fichas de" /> : carpaIds.length > 1 && <p className="text-sm text-slate-600">{plural(carpaIds.length, 'carpa', 'carpas')} seleccionadas.</p>}
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
          {busy ? 'Generando…' : `Descargar ${plural(carpaIds.length, 'ficha', 'fichas')} para imprimir`}
        </button>
      </div>
    </Modal>
  );
}

export function InventarioDialog({ carpaIds, onClose, alcance }: { carpaIds: string[]; onClose: () => void; alcance?: Alcance }) {
  const [revisiones, setRevisiones] = useState<'ninguna' | 'ultimas' | 'todas'>('ultimas');
  const [ultimasN, setUltimasN] = useState(3);
  const [fotos, setFotos] = useState(true);
  const { busy, run } = useRun();
  return (
    <Modal title={carpaIds.length === 1 ? 'Exportar a PDF' : 'Exportar inventario'} onClose={onClose}>
      <div className="space-y-4">
        {alcance ? <AlcanceCampo alcance={alcance} verbo="Incluye" /> : carpaIds.length > 1 && <p className="text-sm text-slate-600">{plural(carpaIds.length, 'carpa', 'carpas')} seleccionadas.</p>}
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
          {busy ? 'Generando…' : 'Descargar PDF'}
        </button>
      </div>
    </Modal>
  );
}
