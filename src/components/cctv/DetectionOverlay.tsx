import { cn } from "@/lib/utils";
import { detectionBoxStyle } from "@/lib/detection-box";
import type { DetectionBox, Severity } from "@/types";

const severityBorder: Record<Severity, string> = {
  violation: "border-red-500",
  caution: "border-yellow-500",
  info: "border-blue-500",
};

interface DetectionOverlayProps {
  detection: DetectionBox;
  labelSize?: "sm" | "md";
  showLabel?: boolean;
}

export function DetectionOverlay({
  detection,
  labelSize = "md",
  showLabel = true,
}: DetectionOverlayProps) {
  return (
    <div
      className={cn("absolute box-border border-2", severityBorder[detection.severity])}
      style={detectionBoxStyle(detection.box)}
    >
      {showLabel && (
        <span
          className={cn(
            "absolute left-0 top-0 max-w-full truncate rounded-br bg-black/75 px-1 py-0.5 text-white",
            labelSize === "sm" ? "text-[8px]" : "text-[10px]",
          )}
        >
          {detection.label} {detection.confidence}%
        </span>
      )}
    </div>
  );
}
