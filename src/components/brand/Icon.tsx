import type { CSSProperties } from "react";

interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
  weight?: 300 | 400 | 500 | 600 | 700;
  style?: CSSProperties;
}

/**
 * Material Symbols icon. Uses the Google variable font loaded in __root.tsx.
 */
export function Icon({
  name,
  className = "",
  filled = false,
  weight = 400,
  style,
}: IconProps) {
  return (
    <span
      aria-hidden
      className={`material-symbols-outlined select-none ${className}`}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' 24`,
        ...style,
      }}
    >
      {name}
    </span>
  );
}
