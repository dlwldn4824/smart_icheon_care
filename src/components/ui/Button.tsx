import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "accent" | "outline" | "ghost";
  size?: "sm" | "md";
}

export function Button({
  className,
  variant = "default",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40",
        variant === "default" && "bg-primary text-white shadow-md shadow-blue-200/50 hover:bg-blue-600",
        variant === "accent" && "bg-accent text-white shadow-md shadow-orange-200/60 hover:brightness-105",
        variant === "outline" && "border border-border bg-white text-foreground hover:bg-primary-soft/50",
        variant === "ghost" && "text-muted hover:bg-slate-100 hover:text-foreground",
        size === "sm" && "h-8 px-3.5 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        className,
      )}
      {...props}
    />
  );
}
