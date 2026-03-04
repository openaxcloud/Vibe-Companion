import { Link } from "wouter";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-[#0d1117]">
      <div className="text-center space-y-4 px-6">
        <div className="flex items-center justify-center gap-3 mb-2">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <h1 className="text-2xl font-bold text-white">404</h1>
        </div>
        <p className="text-sm text-[#8b949e]">
          This page doesn't exist or has been moved.
        </p>
        <Link href="/">
          <Button variant="ghost" className="text-[#58a6ff] text-xs gap-1.5 hover:bg-[#161b22]" data-testid="link-go-home">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Vibe Platform
          </Button>
        </Link>
      </div>
    </div>
  );
}
