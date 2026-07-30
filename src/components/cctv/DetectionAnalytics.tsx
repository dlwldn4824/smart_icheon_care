"use client";

import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { detectionByType, hourlyDetections } from "@/data/mock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function DetectionAnalytics() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>오늘 탐지 유형별</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={detectionByType}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
              >
                {detectionByType.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 text-xs">
            {detectionByType.map((d) => (
              <span key={d.name} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                {d.name} {d.value}%
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>시간대별 탐지 건수</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={hourlyDetections}>
              <Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2} dot />
              <Tooltip />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
