import AIPanel from '@/components/AIPanel';

export interface ExternalInputHandlers {
  handleSubmit?: (value: string) => void;
  isWorking?: boolean;
  agentMode?: string;
  onModeChange?: (mode: string) => void;
  handleSlashCommand?: () => void;
  agentToolsSettings?: any;
  onAgentToolsSettingsChange?: (settings: any) => void;
  onAttach?: () => void;
  onVoice?: () => void;
  isRecording?: boolean;
  isUploadingFiles?: boolean;
  pendingAttachmentsCount?: number;
}

interface ReplitAgentPanelV3Props {
  projectId: string;
  mode?: 'desktop' | 'tablet' | 'mobile';
  agentToolsSettings?: any;
  onAgentToolsSettingsChange?: (settings: any) => void;
  isBootstrapping?: boolean;
  bootstrapToken?: string | null;
  hideInput?: boolean;
  onExternalInput?: (handlers: ExternalInputHandlers | null) => void;
  onBootstrapFailure?: () => void;
}

export function ReplitAgentPanelV3({ projectId, mode = 'desktop' }: ReplitAgentPanelV3Props) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <AIPanel
        projectId={projectId}
        onClose={() => {}}
        onFileCreated={() => {}}
        onFileUpdated={() => {}}
      />
    </div>
  );
}
