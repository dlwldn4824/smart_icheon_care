"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ActionRegisterDialog } from "@/components/actions/ActionRegisterDialog";
import { useToast } from "@/components/ui/Toast";
import type { ActionSourceType, RegisteredAction } from "@/types";

const STORAGE_KEY = "smart-icheon-registered-actions";

export interface ActionRegisterPayload {
  sourceType: ActionSourceType;
  sourceId: string;
  title: string;
  detail?: string;
}

interface ActionRegistryContextValue {
  actions: RegisteredAction[];
  openRegister: (payload: ActionRegisterPayload) => void;
  isRegistered: (sourceType: ActionSourceType, sourceId: string) => boolean;
  getAction: (sourceType: ActionSourceType, sourceId: string) => RegisteredAction | undefined;
}

const ActionRegistryContext = createContext<ActionRegistryContextValue | null>(null);

export function formatActionTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return new Date(iso).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActionRegistryProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [actions, setActions] = useState<RegisteredAction[]>([]);
  const [pending, setPending] = useState<ActionRegisterPayload | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setActions(JSON.parse(raw) as RegisteredAction[]);
    } catch {
      setActions([]);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  }, [actions, hydrated]);

  const openRegister = useCallback((payload: ActionRegisterPayload) => {
    setPending(payload);
  }, []);

  const closeRegister = useCallback(() => {
    setPending(null);
  }, []);

  const isRegistered = useCallback(
    (sourceType: ActionSourceType, sourceId: string) =>
      actions.some((a) => a.sourceType === sourceType && a.sourceId === sourceId),
    [actions],
  );

  const getAction = useCallback(
    (sourceType: ActionSourceType, sourceId: string) =>
      actions.find((a) => a.sourceType === sourceType && a.sourceId === sourceId),
    [actions],
  );

  const submitAction = useCallback(
    (form: {
      department: string;
      assignee: string;
      actionType: string;
      dueLabel: string;
      memo: string;
    }) => {
      if (!pending) return;

      const action: RegisteredAction = {
        id: `act-${Date.now()}`,
        sourceType: pending.sourceType,
        sourceId: pending.sourceId,
        title: pending.title,
        detail: pending.detail,
        department: form.department,
        assignee: form.assignee,
        actionType: form.actionType,
        dueLabel: form.dueLabel,
        memo: form.memo || undefined,
        registeredAt: new Date().toISOString(),
        status: "assigned",
      };

      setActions((prev) => [...prev, action]);
      closeRegister();
      toast(
        `${form.department} ${form.assignee} 담당자에게 「${pending.title}」 조치가 배정되었습니다.`,
        "success",
      );
    },
    [pending, closeRegister, toast],
  );

  const value = useMemo(
    () => ({ actions, openRegister, isRegistered, getAction }),
    [actions, openRegister, isRegistered, getAction],
  );

  return (
    <ActionRegistryContext.Provider value={value}>
      {children}
      <ActionRegisterDialog pending={pending} onClose={closeRegister} onSubmit={submitAction} />
    </ActionRegistryContext.Provider>
  );
}

export function useActionRegistry() {
  const ctx = useContext(ActionRegistryContext);
  if (!ctx) throw new Error("useActionRegistry must be used within ActionRegistryProvider");
  return ctx;
}

export function useActionRegistration(sourceType: ActionSourceType, sourceId: string) {
  const { openRegister, isRegistered, getAction } = useActionRegistry();

  return {
    isRegistered: isRegistered(sourceType, sourceId),
    action: getAction(sourceType, sourceId),
    openRegister: (title: string, detail?: string) =>
      openRegister({ sourceType, sourceId, title, detail }),
  };
}
