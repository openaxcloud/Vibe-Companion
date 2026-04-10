import { useParams } from "wouter";
import { DatabaseManagement as DatabaseManagementComponent } from "@/components/DatabaseManagement";
import { ReplitLayout } from "@/components/layout/ReplitLayout";

export default function DatabaseManagementPage() {
  const { id } = useParams();
  
  return (
    <ReplitLayout>
      <div className="container mx-auto py-6 max-w-7xl">
        <DatabaseManagementComponent projectId={id!} />
      </div>
    </ReplitLayout>
  );
}