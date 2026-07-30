import { cn } from "@/lib/utils";

/** 로고 원본 비율 (public/images/smart-icheon-care-logo.jpeg) */
export const BRAND_LOGO_WIDTH = 1536;
export const BRAND_LOGO_HEIGHT = 340;
export const BRAND_LOGO_ASPECT = BRAND_LOGO_WIDTH / BRAND_LOGO_HEIGHT;

export const BRAND_LOGO_SRC = "/images/smart-icheon-care-logo.jpeg";

export function logoDisplaySize(heightPx: number, maxWidthPx?: number) {
  let width = Math.round(heightPx * BRAND_LOGO_ASPECT);
  let height = heightPx;

  if (maxWidthPx && width > maxWidthPx) {
    width = maxWidthPx;
    height = Math.round(width / BRAND_LOGO_ASPECT);
  }

  return { width, height };
}

export function BrandLogo({
  className,
  priority = false,
  height = 54,
  maxWidth = 200,
}: {
  className?: string;
  priority?: boolean;
  /** 목표 높이(px) */
  height?: number;
  /** 헤더 너비 제한 */
  maxWidth?: number;
}) {
  const { width, height: h } = logoDisplaySize(height, maxWidth);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 로고는 원본 파일 그대로 표시
    <img
      src={BRAND_LOGO_SRC}
      alt="Smart Icheon Care"
      width={width}
      height={h}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={cn("block h-auto w-auto shrink-0 object-contain object-left", className)}
      style={{ height: h, width: "auto", maxWidth }}
    />
  );
}
