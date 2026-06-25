import { hasVWorldApiKey } from "@/lib/map-config";

export function MapApiBadge() {
  const withKey = hasVWorldApiKey();
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
        withKey ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-800"
      }`}
    >
      {withKey ? "VWorld API" : "VWorld 데모"}
    </span>
  );
}
