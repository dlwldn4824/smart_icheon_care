import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "urgent" | "high" | "medium" | "low" | "info" | "outline";
}

const variants = {
  default: "bg-slate-100 text-slate-700",
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-green-100 text-green-700",
  info: "bg-blue-100 text-blue-700",
  outline: "border border-border bg-white text-muted",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
