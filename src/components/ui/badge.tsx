import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "outline" | "success" | "warning" | "info" | "gradient";

const variants: Record<BadgeVariant, string> = {
  default: "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover transition-colors",
  secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors",
  outline: "border-border text-foreground hover:bg-accent transition-colors",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors",
  warning: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors",
  info: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors",
  gradient: "border-transparent bg-gradient-primary text-white shadow-md hover:shadow-lg transition-all",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
