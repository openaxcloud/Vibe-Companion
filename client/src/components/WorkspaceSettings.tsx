import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Sparkles, 
  Eye, 
  Palette, 
  Code, 
  Settings2
} from 'lucide-react';

interface WorkspaceSettingsProps {
  projectId?: number;
}

export function WorkspaceSettings({ projectId }: WorkspaceSettingsProps) {
  const [agentAudioNotification, setAgentAudioNotification] = useState(false);
  const [agentPushNotification, setAgentPushNotification] = useState(true);
  const [assistantPushNotification, setAssistantPushNotification] = useState(true);
  const [automaticPreview, setAutomaticPreview] = useState(true);
  const [forwardPorts, setForwardPorts] = useState('all_ports_except_localhost');
  const [fontSize, setFontSize] = useState('normal');
  const [aiCodeCompletion, setAiCodeCompletion] = useState(true);
  const [acceptOnCommitChar, setAcceptOnCommitChar] = useState(true);
  const [autoCloseBrackets, setAutoCloseBrackets] = useState(true);
  const [wrapping, setWrapping] = useState('soft_wrap');
  const [indentationDetection, setIndentationDetection] = useState(true);
  const [formatPastedText, setFormatPastedText] = useState(true);
  const [indentationChar, setIndentationChar] = useState('spaces');
  const [indentationSize, setIndentationSize] = useState('2');
  const [codeIntelligence, setCodeIntelligence] = useState(true);
  const [semanticTokens, setSemanticTokens] = useState(true);
  const [showWhitespaceLeading, setShowWhitespaceLeading] = useState(false);
  const [showWhitespaceEnclosed, setShowWhitespaceEnclosed] = useState(false);
  const [showWhitespaceTrailing, setShowWhitespaceTrailing] = useState(false);
  const [showWhitespaceSelected, setShowWhitespaceSelected] = useState(false);
  const [keybinds, setKeybinds] = useState('default');
  const [multiselectModifier, setMultiselectModifier] = useState('Alt');
  const [filetreeGitStatus, setFiletreeGitStatus] = useState(true);
  const [accessibleTerminal, setAccessibleTerminal] = useState(false);
  const [shellBellIndicator, setShellBellIndicator] = useState(false);
  const [keyboardShortcutHint, setKeyboardShortcutHint] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('keyboard-shortcut-hint') !== 'false';
  });
  const [keyboardShortcutTester, setKeyboardShortcutTester] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('keyboard-shortcut-tester') === 'true';
  });

  const SettingRow = ({ id, label, description, checked, onCheckedChange }: {
    id: string; label: string; description: string; checked: boolean; onCheckedChange: (v: boolean) => void;
  }) => (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex-1 min-w-0 pr-3">
        <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
        <p className="text-[11px] text-muted-foreground truncate">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} className="shrink-0 scale-90" />
    </div>
  );

  const SelectRow = ({ id, label, description, value, onValueChange, options }: {
    id: string; label: string; description: string; value: string; onValueChange: (v: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <div className="py-1.5">
      <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="h-7 text-xs mt-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
    </div>
  );

  const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <Icon className="h-3 w-3" />
        {title}
      </h3>
      <div className="rounded-md border bg-card/50 px-3 py-1 divide-y divide-border/50">
        {children}
      </div>
    </div>
  );

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4 max-w-xl">
        <p className="text-[11px] text-muted-foreground">
          Settings apply to your account across all Apps.
        </p>

        <Section icon={Sparkles} title="Agent & Assistant">
          <SettingRow id="agent-audio" label="Agent Audio Notification" description="Play sound when Agent needs response" checked={agentAudioNotification} onCheckedChange={setAgentAudioNotification} />
          <SettingRow id="agent-push" label="Agent Push Notification" description="Push notification when Agent needs response" checked={agentPushNotification} onCheckedChange={setAgentPushNotification} />
          <SettingRow id="assistant-push" label="Assistant Push Notification" description="Push notification when Assistant needs response" checked={assistantPushNotification} onCheckedChange={setAssistantPushNotification} />
        </Section>

        <Section icon={Eye} title="App Preview">
          <SettingRow id="auto-preview" label="Automatic Preview" description="Open preview when a port is open" checked={automaticPreview} onCheckedChange={setAutomaticPreview} />
          <SelectRow id="forward-ports" label="Forward Ports" description="Auto-configure detected ports" value={forwardPorts} onValueChange={setForwardPorts}
            options={[
              { value: 'all_ports_except_localhost', label: 'All except localhost' },
              { value: 'all_ports', label: 'All ports' },
              { value: 'none', label: 'None' }
            ]} />
        </Section>

        <Section icon={Palette} title="Appearance">
          <SelectRow id="font-size" label="Font Size" description="Editor font size" value={fontSize} onValueChange={setFontSize}
            options={[
              { value: 'small', label: 'Small' },
              { value: 'normal', label: 'Normal' },
              { value: 'large', label: 'Large' }
            ]} />
        </Section>

        <Section icon={Code} title="Code Editing">
          <SettingRow id="ai-completion" label="AI Code Completion" description="Inline ghost text suggestions" checked={aiCodeCompletion} onCheckedChange={setAiCodeCompletion} />
          <SettingRow id="accept-commit" label="Accept on Commit Char" description="Accept suggestions on commit characters" checked={acceptOnCommitChar} onCheckedChange={setAcceptOnCommitChar} />
          <SettingRow id="auto-brackets" label="Auto Close Brackets" description="Auto-close brackets and quotes" checked={autoCloseBrackets} onCheckedChange={setAutoCloseBrackets} />
          <SelectRow id="wrapping" label="Wrapping" description="Line wrapping behavior" value={wrapping} onValueChange={setWrapping}
            options={[{ value: 'no_wrap', label: 'No wrap' }, { value: 'soft_wrap', label: 'Soft wrap' }]} />
          <SettingRow id="indent-detection" label="Indentation Detection" description="Auto-detect file indentation" checked={indentationDetection} onCheckedChange={setIndentationDetection} />
          <SettingRow id="format-paste" label="Format Pasted Text" description="Auto-format pasted text indentation" checked={formatPastedText} onCheckedChange={setFormatPastedText} />
          <SelectRow id="indent-char" label="Indentation Character" description="Spaces or tabs" value={indentationChar} onValueChange={setIndentationChar}
            options={[{ value: 'spaces', label: 'Spaces' }, { value: 'tabs', label: 'Tabs' }]} />
          <div className="py-1.5">
            <Label htmlFor="indent-size" className="text-xs font-medium">Indentation Size</Label>
            <Input id="indent-size" type="number" value={indentationSize} onChange={(e) => setIndentationSize(e.target.value)} min="1" max="8" className="h-7 text-xs mt-1 w-16" />
            <p className="text-[11px] text-muted-foreground mt-0.5">Columns per indent level</p>
          </div>
          <SettingRow id="code-intel" label="Code Intelligence" description="Autocomplete and hints" checked={codeIntelligence} onCheckedChange={setCodeIntelligence} />
          <SettingRow id="semantic-tokens" label="Semantic Tokens" description="Enhanced syntax highlighting" checked={semanticTokens} onCheckedChange={setSemanticTokens} />
          <div className="py-1.5">
            <Label className="text-xs font-medium">Show Whitespace</Label>
            <p className="text-[11px] text-muted-foreground mb-1">Make whitespace visible</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {[
                { id: 'whitespace-leading', label: 'Leading', checked: showWhitespaceLeading, onChange: setShowWhitespaceLeading },
                { id: 'whitespace-enclosed', label: 'Enclosed', checked: showWhitespaceEnclosed, onChange: setShowWhitespaceEnclosed },
                { id: 'whitespace-trailing', label: 'Trailing', checked: showWhitespaceTrailing, onChange: setShowWhitespaceTrailing },
                { id: 'whitespace-selected', label: 'Selected', checked: showWhitespaceSelected, onChange: setShowWhitespaceSelected },
              ].map(w => (
                <div key={w.id} className="flex items-center justify-between">
                  <Label htmlFor={w.id} className="text-[11px] font-normal">{w.label}</Label>
                  <Switch id={w.id} checked={w.checked} onCheckedChange={w.onChange} className="scale-75" />
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section icon={Settings2} title="Advanced">
          <SelectRow id="keybinds" label="Keybinds" description="Keyboard mapping" value={keybinds} onValueChange={setKeybinds}
            options={[{ value: 'default', label: 'Default' }, { value: 'vim', label: 'Vim' }, { value: 'emacs', label: 'Emacs' }]} />
          <SelectRow id="multiselect" label="Multiselect Modifier" description="Key for multi-select in filetree" value={multiselectModifier} onValueChange={setMultiselectModifier}
            options={[{ value: 'Alt', label: 'Alt' }, { value: 'Ctrl', label: 'Ctrl' }, { value: 'Cmd', label: 'Cmd' }]} />
          <SettingRow id="git-status" label="Filetree Git Status" description="Show Git status in file tree" checked={filetreeGitStatus} onCheckedChange={setFiletreeGitStatus} />
          <SettingRow id="accessible-term" label="Accessible Terminal" description="Screen reader support (may affect performance)" checked={accessibleTerminal} onCheckedChange={setAccessibleTerminal} />
          <SettingRow id="shell-bell" label="Shell Bell Sound" description="Play sound on shell bell" checked={shellBellIndicator} onCheckedChange={setShellBellIndicator} />
          <SettingRow id="shortcut-hint" label="Shortcut Hints" description="Show shortcuts on modifier press"
            checked={keyboardShortcutHint}
            onCheckedChange={(checked) => {
              setKeyboardShortcutHint(checked);
              localStorage.setItem('keyboard-shortcut-hint', String(checked));
              window.dispatchEvent(new CustomEvent('keyboard-settings-changed', { detail: { shortcutHint: String(checked), shortcutTester: localStorage.getItem('keyboard-shortcut-tester') } }));
            }} />
          <SettingRow id="shortcut-tester" label="Shortcut Tester" description="Display last pressed shortcut (debug)"
            checked={keyboardShortcutTester}
            onCheckedChange={(checked) => {
              setKeyboardShortcutTester(checked);
              localStorage.setItem('keyboard-shortcut-tester', String(checked));
              window.dispatchEvent(new CustomEvent('keyboard-settings-changed', { detail: { shortcutHint: localStorage.getItem('keyboard-shortcut-hint'), shortcutTester: String(checked) } }));
            }} />
        </Section>
      </div>
    </ScrollArea>
  );
}
