import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-primary focus-visible:ring-primary/25 border-primary/50 hover:border-primary hover:text-primary/80 mb-5 inline-flex items-center gap-1.5 border-b pb-1 text-sm font-semibold transition-colors focus-visible:rounded-sm focus-visible:ring-4 focus-visible:outline-none"
    >
      <ArrowLeft aria-hidden="true" className="size-3.5" />
      <span>{label}</span>
    </Link>
  );
}
