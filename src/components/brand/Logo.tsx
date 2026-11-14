import { Link } from "@tanstack/react-router";
import icone from "@/assets/brand/operacondo-icone.png?url";

interface LogoProps {
  /** light = sobre fundo ink; dark = sobre fundo claro (nomes mantidos das telas atuais) */
  variant?: "light" | "dark";
  subtitle?: string;
  to?: string;
}

/** Logo OperaCondo (DESIGN.md §2): ícone + "Opera" em primary e "Condo" em ink/branco, seguido do produto. */
export function Logo({ variant = "dark", subtitle, to = "/app" }: LogoProps) {
  const onInk = variant === "light";
  return (
    <Link to={to} className="flex min-w-0 items-center gap-2.5 select-none">
      <img src={icone} alt="" aria-hidden className="h-7 w-auto shrink-0" />
      <div className="min-w-0">
        <p className="text-[18px] font-semibold leading-none tracking-tight">
          <span className="text-primary">Opera</span>
          <span className={onInk ? "text-white" : "text-ink"}>Condo</span>
          <span className={`ml-1.5 text-[13px] font-medium ${onInk ? "text-ink-muted" : "text-muted-foreground"}`}>
            Concierge
          </span>
        </p>
        {subtitle ? (
          <p className={`mt-1 truncate text-[11px] ${onInk ? "text-ink-muted" : "text-muted-foreground"}`}>
            {subtitle}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
