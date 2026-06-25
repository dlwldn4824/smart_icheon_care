export type RiskLevel = "low" | "medium" | "high" | "critical";
export type Priority = "urgent" | "high" | "medium" | "low";
export type ZoneType = "demand" | "restriction" | "conflict";
export type MarkerType = "park" | "parking" | "cctv" | "complaint";
export type Severity = "violation" | "caution" | "info";
export type ComplaintStatus = "received" | "reviewing" | "processing" | "completed";

export interface MapZone {
  id: string;
  name: string;
  type: ZoneType;
  lat: number;
  lng: number;
  radiusMeters: number;
  area?: string;
  /** 주차 부족 지수 (높을수록 부족) */
  shortageScore?: number;
  nearbyParkingSpaces?: number;
  demandIndex?: number;
}

export interface MapMarker {
  id: string;
  type: MarkerType;
  lat: number;
  lng: number;
  label: string;
  area?: string;
}

export interface RiskCardData {
  id: string;
  title: string;
  riskLevel: RiskLevel;
  riskLabel: string;
  description: string;
  count: number;
  unit: string;
  changePercent: number;
  trend: number[];
  iconName: "trees" | "car" | "flag" | "snowflake";
}

export interface FacilityRow {
  id: string;
  name: string;
  type: string;
  address: string;
  floatingPopulation: number;
  complaints: number;
  aiStatus: string;
  priority: Priority;
  manager: string;
  lastInspection: string;
  nextMaintenance: string;
  lat: number;
  lng: number;
}

export interface MaintenanceRecord {
  id: string;
  facilityId: string;
  date: string;
  action: string;
  status: "completed" | "scheduled" | "in_progress";
  assignee: string;
}

export interface Recommendation {
  id: string;
  priority: Priority;
  title: string;
  detail: string;
  score?: number;
}

export interface DetectionBox {
  label: string;
  confidence: number;
  box: { x: number; y: number; width: number; height: number };
  severity: Severity;
}

export interface CCTVFeed {
  cameraId: string;
  location: string;
  imageUrl: string;
  detections: DetectionBox[];
  timestamp: string;
  isLive: boolean;
}

export interface DetectionEvent {
  id: string;
  time: string;
  type: string;
  location: string;
  confidence: number;
  severity: Severity;
}

export interface Hotspot {
  id: string;
  name: string;
  score: number;
  priority: Priority;
  peakTimes: string;
  recommendation: string;
}

export interface Complaint {
  id: string;
  category: string;
  title: string;
  date: string;
  status: ComplaintStatus;
  assignee?: string;
  completedDate?: string;
  location?: string;
  description?: string;
  reporter?: string;
  source?: "시민앱" | "전화" | "CCTV" | "현장";
  priority?: Priority;
}

export type SnowRemovalStatus = "pending" | "in_progress" | "completed" | "scheduled";

export interface SnowRemovalRoute {
  id: string;
  name: string;
  area: string;
  address: string;
  lengthKm: number;
  snowfallCm: number;
  roadCondition: "양호" | "습설" | "결빙" | "적설";
  priority: Priority;
  status: SnowRemovalStatus;
  assignee: string;
  equipment: string;
  progress: number;
  lat: number;
  lng: number;
  lastWorked?: string;
}

export interface NavItem {
  href: string;
  label: string;
  iconName: "layout" | "building" | "car" | "snowflake" | "flag" | "message" | "file" | "settings";
  ready?: boolean;
}

export type NotificationType = "urgent" | "warning" | "info" | "success";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  read: boolean;
  href?: string;
  category: string;
}

export type AIReportType = "daily" | "weekly" | "monthly" | "custom";
export type AIReportStatus = "ready" | "generating" | "scheduled";
export type AIReportDomain = "주차" | "CCTV" | "시설" | "제설" | "민원";

export interface AIReport {
  id: string;
  title: string;
  type: AIReportType;
  period: string;
  generatedAt: string;
  status: AIReportStatus;
  summary: string;
  highlights: string[];
  domains: AIReportDomain[];
  riskScore: number;
  actionCount: number;
}

export interface AIInsight {
  id: string;
  domain: AIReportDomain;
  title: string;
  description: string;
  impact: Priority;
  metric?: string;
}

export type ActionSourceType = "recommendation" | "cctv" | "map" | "report";

export interface RegisteredAction {
  id: string;
  sourceType: ActionSourceType;
  sourceId: string;
  title: string;
  detail?: string;
  department: string;
  assignee: string;
  actionType: string;
  dueLabel: string;
  memo?: string;
  registeredAt: string;
  status: "assigned" | "in_progress" | "completed";
}
