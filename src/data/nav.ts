import type { NavItem } from "@/types";

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "대시보드", iconName: "layout", ready: true },
  { href: "/bollard-control", label: "차단봉 제어", iconName: "shield", ready: true },
  { href: "/parking-analysis", label: "주차 리스크 분석", iconName: "car", ready: true },
  { href: "/cctv", label: "불법 현수막 탐지", iconName: "flag", ready: true },
  { href: "/facility-management", label: "시설 관리", iconName: "building", ready: true },
  { href: "/snow-removal", label: "제설 관리", iconName: "snowflake", ready: true },
  { href: "/complaint-management", label: "민원 관리", iconName: "message", ready: true },
  { href: "/ai-report", label: "AI 리포트", iconName: "file", ready: true },
  { href: "/settings", label: "설정", iconName: "settings", ready: true },
];
