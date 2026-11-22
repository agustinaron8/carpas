import { useSyncExternalStore } from 'react';
import { esOscuro, getTema, onTema, setTema, type Tema } from '../lib/theme';

export function useTema(): { tema: Tema; oscuro: boolean; setTema: (t: Tema) => void } {
  const tema = useSyncExternalStore(onTema, getTema);
  const oscuro = useSyncExternalStore(onTema, () => esOscuro());
  return { tema, oscuro, setTema };
}
