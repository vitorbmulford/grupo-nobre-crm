import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-primary text-sm font-semibold">404</p>
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-muted-foreground text-sm">
        Confira o endereço ou volte para as oportunidades.
      </p>
      <Link
        className="text-primary text-sm font-medium underline-offset-4 hover:underline"
        href="/opportunities"
      >
        Ir para oportunidades
      </Link>
    </main>
  );
}
