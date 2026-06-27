import { Link } from "@tanstack/react-router";
import { Icon } from "./Icon";

interface LogoProps {
  variant?: "light" | "dark";
  subtitle?: string;
  to?: string;
}

export function Logo({ variant = "dark", subtitle, to = "/app" }: LogoProps) {
  const isLight = variant === "light";
  return (
    <Link to={to} className="flex items-center gap-3 group">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
          isLight
            ? "bg-white/10 text-white"
            : "bg-[var(--color-brand)] text-white"
        } transition-transform group-hover:scale-105`}
      >
        <Icon name="apartment" className="text-[22px]" />
      </span>
      <div className="min-w-0">
        <h1
          className={`text-[15px] leading-tight tracking-tight ${
            isLight ? "text-white" : "text-[var(--color-navy)]"
          }`}
        >
          <span className="font-extrabold">Concierge </span>
          <span className="font-extrabold">Opera</span>
          <span className="font-light">Condo</span>
        </h1>
        {subtitle ? (
          <p
            className={`text-[11px] mt-0.5 truncate ${
              isLight ? "text-white/60" : "text-[var(--color-on-surface-variant)]"
            }`}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
