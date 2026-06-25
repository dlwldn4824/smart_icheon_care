"use client";

import { useEffect, useState } from "react";
import { ClipboardList, X } from "lucide-react";
import type { ActionRegisterPayload } from "@/lib/action-registry";
import { Button } from "@/components/ui/Button";

const DEPARTMENTS = ["시설관리과", "교통행정과", "환경위생과", "제설대응팀", "도시안전과"] as const;

const ASSIGNEES: Record<(typeof DEPARTMENTS)[number], string[]> = {
  시설관리과: ["김○○ 주무관", "이○○ 팀장", "박○○ 주무관"],
  교통행정과: ["최○○ 주무관", "정○○ 팀장"],
  환경위생과: ["한○○ 주무관", "윤○○ 팀장"],
  제설대응팀: ["강○○ 반장", "조○○ 대원"],
  도시안전과: ["서○○ 주무관", "임○○ 팀장"],
};

const ACTION_TYPES = ["현장 출동", "작업 배정", "민원 연계", "모니터링 강화", "긴급 점검"] as const;
const DUE_LABELS = ["당일 완료", "1일 이내", "3일 이내", "1주일 이내"] as const;

interface ActionRegisterDialogProps {
  pending: ActionRegisterPayload | null;
  onClose: () => void;
  onSubmit: (form: {
    department: string;
    assignee: string;
    actionType: string;
    dueLabel: string;
    memo: string;
  }) => void;
}

export function ActionRegisterDialog({ pending, onClose, onSubmit }: ActionRegisterDialogProps) {
  const [department, setDepartment] = useState<(typeof DEPARTMENTS)[number]>("시설관리과");
  const [assignee, setAssignee] = useState(ASSIGNEES["시설관리과"][0]);
  const [actionType, setActionType] = useState<(typeof ACTION_TYPES)[number]>("작업 배정");
  const [dueLabel, setDueLabel] = useState<(typeof DUE_LABELS)[number]>("1일 이내");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    if (!pending) return;
    setDepartment("시설관리과");
    setAssignee(ASSIGNEES["시설관리과"][0]);
    setActionType("작업 배정");
    setDueLabel("1일 이내");
    setMemo("");
  }, [pending]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, onClose]);

  if (!pending) return null;

  const assigneeOptions = ASSIGNEES[department];

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-dialog-title"
        className="relative z-10 w-full max-w-md rounded-xl border border-gray-100 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-50 p-2 text-primary">
              <ClipboardList className="h-4 w-4" />
            </div>
            <div>
              <h2 id="action-dialog-title" className="text-sm font-bold text-slate-900">
                조치 등록
              </h2>
              <p className="text-[10px] text-muted">담당 부서에 작업을 배정합니다</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-slate-100"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-3">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold text-muted">조치 대상</p>
            <p className="mt-0.5 text-sm font-medium text-slate-800">{pending.title}</p>
            {pending.detail && (
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{pending.detail}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] font-semibold text-muted">담당 부서</span>
              <select
                value={department}
                onChange={(e) => {
                  const next = e.target.value as (typeof DEPARTMENTS)[number];
                  setDepartment(next);
                  setAssignee(ASSIGNEES[next][0]);
                }}
                className="w-full rounded-lg border border-gray-200 px-2 py-2 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold text-muted">담당자</span>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-2 py-2 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
              >
                {assigneeOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] font-semibold text-muted">조치 유형</span>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as (typeof ACTION_TYPES)[number])}
                className="w-full rounded-lg border border-gray-200 px-2 py-2 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
              >
                {ACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold text-muted">완료 목표</span>
              <select
                value={dueLabel}
                onChange={(e) => setDueLabel(e.target.value as (typeof DUE_LABELS)[number])}
                className="w-full rounded-lg border border-gray-200 px-2 py-2 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
              >
                {DUE_LABELS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-muted">전달 메모 (선택)</span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              placeholder="현장 상황, 우선 처리 사유 등"
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
            취소
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() =>
              onSubmit({ department, assignee, actionType, dueLabel, memo: memo.trim() })
            }
          >
            조치 배정
          </Button>
        </div>
      </div>
    </div>
  );
}
