import { MobileReportForm } from "@/components/mobile/MobileReportForm";
import { MobileShell } from "@/components/mobile/MobileShell";

export default function MobileReportPage() {
  return (
    <MobileShell title="민원 신고" showBack>
      <MobileReportForm />
    </MobileShell>
  );
}
