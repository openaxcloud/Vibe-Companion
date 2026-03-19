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
  // File context for AI
  activeFileId?: string | null;
  activeFileName?: string | null;
  activeFileContent?: string | null;
  activeFileLanguage?: string | null;
  files?: { id: string; filename: string; content: string }[];
  // Callbacks
  onClose?: () => void;
  onFileCreated?: (file: any) => void;
  onFileUpdated?: (file: any) => void;
  onApplyCode?: (filename: string, code: string) => void;
  // Pending message
  pendingMessage?: string | null;
  onPendingMessageConsumed?: () => void;
  onAgentComplete?: () => void;
  // Canvas frames
  onCanvasFrameCreate?: (htmlContent: string, name?: string) => void;
  onConvertFrame?: (frameId: string, frameName: string, targetType: string) => void;
  canvasFrames?: { id: string; name: string }[];
  // Agent tools
  agentToolsSettings?: any;
  onAgentToolsSettingsChange?: (settings: any) => void;
  // Bootstrap
  isBootstrapping?: boolean;
  bootstrapToken?: string | null;
  hideInput?: boolean;
  onExternalInput?: (handlers: ExternalInputHandlers | null) => void;
  onBootstrapFailure?: () => void;
}

export function ReplitAgentPanelV3({
  projectId,
  mode = 'desktop',
  activeFileId,
  activeFileName,
  activeFileContent,
  activeFileLanguage,
  files,
  onClose,
  onFileCreated,
  onFileUpdated,
  onApplyCode,
  pendingMessage,
  onPendingMessageConsumed,
  onAgentComplete,
  onCanvasFrameCreate,
  onConvertFrame,
  canvasFrames,
  hideInput,
  onExternalInput,
}: ReplitAgentPanelV3Props) {
  const context = (activeFileId && activeFileName && activeFileContent != null)
    ? {
        language: activeFileLanguage || 'javascript',
        filename: activeFileName,
        code: activeFileContent,
      }
    : undefined;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <AIPanel
        projectId={projectId}
        context={context}
        onClose={onClose || (() => {})}
        files={files}
        onFileCreated={onFileCreated}
        onFileUpdated={onFileUpdated}
        onApplyCode={onApplyCode}
        pendingMessage={pendingMessage}
        onPendingMessageConsumed={onPendingMessageConsumed}
        onAgentComplete={onAgentComplete}
        onCanvasFrameCreate={onCanvasFrameCreate}
        onConvertFrame={onConvertFrame}
        canvasFrames={canvasFrames}
        hideInput={hideInput}
        onExternalInput={onExternalInput}
      />
    </div>
  );
}
