import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-primary mb-1 text-xs font-semibold tracking-[0.16em] uppercase">
          Grupo Nobre · Comercial
        </p>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-[28px]">
          {title}
        </h1>
        <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
