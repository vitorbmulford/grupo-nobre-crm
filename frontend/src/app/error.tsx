"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold">Algo deu errado</h1>
      <p className="text-muted-foreground text-sm">
        Ocorreu um erro inesperado. Você pode tentar carregar a página
        novamente.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </main>
  );
}
