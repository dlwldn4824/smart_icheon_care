"use client";

import Image from "next/image";
import Link from "next/link";
import { cctvFeeds } from "@/data/mock";
import { DetectionOverlay } from "@/components/cctv/DetectionOverlay";
import { useToast } from "@/components/ui/Toast";

export function DashboardCCTVMini() {
  const { toast } = useToast();

  return (
    <div className="elevated-card flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
        <span className="text-xs font-bold text-slate-800">AI CCTV 실시간 탐지</span>
        <Link href="/cctv" className="text-[10px] text-primary hover:underline">
          전체 →
        </Link>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1 p-1.5">
        {cctvFeeds.map((feed) => {
          const det = feed.detections[0];
          return (
            <button
              key={feed.cameraId}
              type="button"
              onClick={() => toast(`${feed.location} · ${det?.label}`, "info")}
              className="relative min-h-0 overflow-hidden rounded-md bg-slate-200 text-left"
            >
              <Image
                src={feed.imageUrl}
                alt={feed.location}
                fill
                className="object-cover"
                unoptimized
              />
              {det && <DetectionOverlay detection={det} showLabel={false} labelSize="sm" />}
              {det && (
                <span className="absolute right-0.5 top-0.5 rounded bg-black/70 px-0.5 text-[8px] font-bold text-white">
                  {det.confidence}%
                </span>
              )}
              <span className="absolute left-0.5 top-0.5 flex items-center gap-0.5 rounded bg-red-600 px-0.5 text-[7px] font-bold text-white">
                <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
                LIVE
              </span>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                <p className="truncate text-[8px] text-white">{det?.label ?? feed.location}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
