import React from 'react';
import { ProjectTemplates } from '@/components/ProjectTemplates';
import { ReplitHeader } from '@/components/layout/ReplitHeader';

export default function TemplatesPage() {
  return (
    <div className="min-h-screen bg-background">
      <ReplitHeader />
      <div className="container mx-auto px-4 py-8">
        <ProjectTemplates />
      </div>
    </div>
  );
}