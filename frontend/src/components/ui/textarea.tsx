import * as React from "react";
import { cn } from "cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-border/80 placeholder:text-muted-foreground hover:border-primary/45 focus-visible:border-primary focus-visible:ring-primary/25 disabled:bg-muted/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 bg-background flex field-sizing-content min-h-28 w-full rounded-xl border-2 px-3.5 py-3 text-base shadow-sm transition-[border-color,box-shadow,background-color] outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:ring-3 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
