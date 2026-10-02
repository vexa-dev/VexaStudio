import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  decorative = false,
}: {
  className?: string;
  decorative?: boolean;
}) {
  return (
    <span className={cn("brand-logo inline-grid shrink-0", className)}>
      <img
        src="/vexa-fondo-blanco.svg"
        alt={decorative ? "" : "VEXA"}
        className="col-start-1 row-start-1 h-full w-full dark:hidden"
      />
      <img
        src="/vexa-fondo-negro.svg"
        alt={decorative ? "" : "VEXA"}
        className="col-start-1 row-start-1 hidden h-full w-full dark:block"
      />
    </span>
  );
}
