import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-[var(--ide-bg)]">
      <div className="text-center space-y-6 px-6 max-w-md">
        <div className="flex items-center justify-center mb-4">
          <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
            <path d="M7 5.5C7 4.67157 7.67157 4 8.5 4H15.5C15.7761 4 16 4.22386 16 4.5V12.5C16 12.7761 16.2239 13 16.5 13H24.5C24.7761 13 25 13.2239 25 13.5V26.5C25 27.3284 24.3284 28 23.5 28H8.5C7.67157 28 7 27.3284 7 26.5V5.5Z" fill="#F26522"/>
            <path d="M17 4.5V11.5C17 12.3284 17.6716 13 18.5 13H25.5L17 4.5Z" fill="#FF8C4C"/>
          </svg>
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
