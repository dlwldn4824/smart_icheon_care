"use client";

import { ActionRegistryProvider } from "@/lib/action-registry";
import { ToastProvider } from "@/components/ui/Toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ActionRegistryProvider>{children}</ActionRegistryProvider>
    </ToastProvider>
  );
}
