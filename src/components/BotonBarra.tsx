import type { ReactNode } from 'react';

/** Botón de la barra fija de abajo (ícono arriba, texto abajo). */
export function BotonBarra({
  icon,
  label,
  onClick,
  disabled,
  destacado,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destacado?: boolean;
}) {
  return (
    <button
      className={`${destacado ? 'btn-primary' : 'btn-secondary'} h-full flex-col gap-1 px-1 py-2 text-xs leading-tight`}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      <span className="text-center">{label}</span>
    </button>
  );
}
