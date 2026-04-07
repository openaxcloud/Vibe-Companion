import { UsageAlerts as UsageAlertsComponent } from "@/components/UsageAlerts";
import { ReplitLayout } from "@/components/layout/ReplitLayout";

export default function UsageAlertsPage() {
  return (
    <ReplitLayout>
      <div className="container mx-auto py-6 max-w-7xl">
        <UsageAlertsComponent />
      </div>
    </ReplitLayout>
  );
}