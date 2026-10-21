import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadingState({
  label = "Carregando informações…",
}: {
  label?: string;
}) {
  return (
    <div
      role="status"
      className="bg-card text-muted-foreground flex min-h-52 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-sm"
    >
      <LoaderCircle className="text-primary size-5 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
      <span className="bg-muted text-muted-foreground mb-3 flex size-11 items-center justify-center rounded-full">
        <Inbox className="size-5" />
      </span>
      <h2 className="font-medium">{title}</h2>
      <p className="text-muted-foreground mt-1 max-w-md text-sm">
        {description}
      </p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-[#e1be68]/50 bg-[#e1be68]/10 px-6 text-center dark:border-[#e1be68]/30 dark:bg-[#e1be68]/5"
    >
      <AlertCircle className="mb-3 size-5 text-[#80651f] dark:text-[#e1be68]" />
      <h2 className="font-medium">Não foi possível carregar os dados</h2>
      <p className="text-muted-foreground mt-1 max-w-md text-sm">{message}</p>
      <Button variant="outline" className="mt-4" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}
