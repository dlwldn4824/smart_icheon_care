import { ComplaintList } from "@/components/mobile/ComplaintStatusCard";
import { MobileShell } from "@/components/mobile/MobileShell";

export default function MobileComplaintsPage() {
  return (
    <MobileShell title="내 민원" showBack>
      <ComplaintList />
    </MobileShell>
  );
}
