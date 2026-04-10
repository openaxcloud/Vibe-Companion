import { useParams } from "wouter";
import { SecretManagement as SecretManagementComponent } from "@/components/SecretManagement";
import { ReplitLayout } from "@/components/layout/ReplitLayout";

export default function SecretManagementPage() {
  const { id } = useParams();
  
  return (
    <ReplitLayout>
      <div className="container mx-auto py-6 max-w-7xl">
        <SecretManagementComponent projectId={id!} />
      </div>
    </ReplitLayout>
  );
}