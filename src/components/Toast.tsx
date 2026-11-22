import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { setSyncToast } from '../sync/syncService';

const Ctx = createContext<(msg: string) => void>(() => undefined);
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  const show = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, msg }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3500);
  }, []);
  useEffect(() => setSyncToast(show), [show]);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 pb-[env(safe-area-inset-bottom)]">
        {items.map((t) => (
          <div key={t.id} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
