import type { BollardStatus, BollardSummary, BollardUnit } from "@/types";

export function formatBollardTime(date = new Date()): string {
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export function isBollardSafe(unit: BollardUnit): boolean {
  return Object.values(unit.safetyChecks).every(Boolean);
}

export function canOperateBollard(unit: BollardUnit, operatingId: string | null): boolean {
  if (operatingId) return false;
  if (unit.status === "maintenance" || unit.status === "lowering" || unit.status === "raising") {
    return false;
  }
  return isBollardSafe(unit);
}

export function computeBollardSummary(units: BollardUnit[], total = 12): BollardSummary {
  return {
    total,
    raising: units.filter((u) => u.status === "raising").length,
    lowering: units.filter((u) => u.status === "lowering").length,
    maintenance: units.filter((u) => u.status === "maintenance").length,
  };
}

export function getStatusAfterMove(
  unit: BollardUnit,
  status: BollardStatus,
): Pick<BollardUnit, "status" | "statusLabel" | "actionLabel" | "targetAction"> {
  switch (status) {
    case "raised":
      return {
        status: "raised",
        statusLabel: "상승 상태",
        actionLabel: "하강하기",
        targetAction: "lower",
      };
    case "lowered":
      return {
        status: "lowered",
        statusLabel: "하강 상태",
        actionLabel: "상승하기",
        targetAction: "raise",
      };
    case "lowering":
      return {
        status: "lowering",
        statusLabel: "하강 중",
        actionLabel: "제어",
        targetAction: unit.targetAction,
      };
    case "raising":
      return {
        status: "raising",
        statusLabel: "상승 중",
        actionLabel: "제어",
        targetAction: unit.targetAction,
      };
    default:
      return {
        status: unit.status,
        statusLabel: unit.statusLabel,
        actionLabel: unit.actionLabel,
        targetAction: unit.targetAction,
      };
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
