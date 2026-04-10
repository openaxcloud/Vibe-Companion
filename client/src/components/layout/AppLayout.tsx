import { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ECodeLoading } from "@/components/ECodeLoading";
import Sidebar from "./Sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <ECodeLoading size="lg" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}