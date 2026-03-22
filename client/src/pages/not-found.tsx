import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-[var(--ide-bg)]">
      <div className="text-center space-y-6 px-6 max-w-md">
        <div className="flex items-center justify-center mb-4">
          <img src="/logo.png" alt="E-Code" width={48} height={48} className="rounded" style={{ objectFit: 'contain' }} />
        </div>
        <div>
          <h1 className="text-6xl font-bold text-[var(--ide-text)] mb-2">404</h1>
          <p className="text-base text-[var(--ide-text-secondary)]">
            This page doesn't exist or has been moved.
          </p>
        </div>
        <Link href="/">
          <Button
            className="bg-[#0079F2] hover:bg-[#0066CC] text-white gap-2 px-6 py-2 rounded-lg"
            data-testid="link-go-home"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
