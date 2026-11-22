import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="flex items-center justify-between gap-3 bg-brand px-4 py-2 text-sm text-on-brand">
      <span>Hay una versión nueva de la app.</span>
      <button className="rounded bg-white/20 px-3 py-1 font-medium" onClick={() => updateServiceWorker(true)}>
        Actualizar
      </button>
    </div>
  );
}
