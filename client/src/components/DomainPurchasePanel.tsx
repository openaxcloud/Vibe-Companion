import React from "react";

export default function DomainPurchasePanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  return (
    <div className="flex flex-col h-full bg-[var(--ide-bg)] p-4 items-center justify-center text-center">
      <h3 className="text-lg font-bold text-[var(--ide-text)] mb-2">Domain Purchase</h3>
      <p className="text-sm text-[var(--ide-text-secondary)] mb-4">Domain purchasing is currently disabled or unavailable.</p>
      <button 
        onClick={onClose}
        className="px-4 py-2 bg-[var(--ide-accent)] text-white rounded text-xs"
      >
        Go Back
      </button>
    </div>
  );
}
