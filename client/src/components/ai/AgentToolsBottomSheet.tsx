import { memo, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { 
  Zap, 
  Brain, 
  Sparkles, 
  Globe, 
  TestTube2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentToolsSettings } from '@/hooks/useAgentTools';

interface AgentToolsBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AgentToolsSettings;
  onSettingsChange: (settings: AgentToolsSettings) => void;
  className?: string;
}

export const AgentToolsBottomSheet = memo(function AgentToolsBottomSheet({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
  className,
}: AgentToolsBottomSheetProps) {

  const handleMaxAutonomyToggle = useCallback((checked: boolean) => {
    onSettingsChange({ ...settings, maxAutonomy: checked });
  }, [settings, onSettingsChange]);

  const handleExtendedThinkingToggle = useCallback((checked: boolean) => {
    onSettingsChange({ ...settings, extendedThinking: checked });
  }, [settings, onSettingsChange]);

  const handleHighPowerModelsToggle = useCallback((checked: boolean) => {
    onSettingsChange({ ...settings, highPowerModels: checked });
  }, [settings, onSettingsChange]);

  const handleWebSearchToggle = useCallback((checked: boolean) => {
    onSettingsChange({ ...settings, webSearch: checked });
  }, [settings, onSettingsChange]);

  const handleAppTestingToggle = useCallback((checked: boolean) => {
    onSettingsChange({ ...settings, appTesting: checked });
  }, [settings, onSettingsChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className={cn(
          "rounded-t-2xl max-h-[85vh] overflow-hidden",
          className
        )}
      >
        <div className="space-y-4 pb-6">
          <SheetHeader className="text-left pb-2">
            <SheetTitle className="text-base font-semibold text-foreground">
              Agent Tools
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-1">
            <div className="flex items-center justify-between py-3 px-1">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-amber-500" />
                <div>
                  <div className="font-medium text-[13px] text-foreground">Max Autonomy</div>
                  <div className="text-[11px] text-muted-foreground">Extended autonomous sessions</div>
                </div>
              </div>
              <Switch
                checked={settings.maxAutonomy}
                onCheckedChange={handleMaxAutonomyToggle}
                className="data-[state=checked]:bg-amber-500"
                data-testid="toggle-max-autonomy"
              />
            </div>

            <div className="flex items-center justify-between py-3 px-1">
              <div className="flex items-center gap-3">
                <Brain className="w-5 h-5 text-purple-500" />
                <div>
                  <div className="font-medium text-[13px] text-foreground">Extended Thinking</div>
                  <div className="text-[11px] text-muted-foreground">Deeper reasoning for complex tasks</div>
                </div>
              </div>
              <Switch
                checked={settings.extendedThinking}
                onCheckedChange={handleExtendedThinkingToggle}
                className="data-[state=checked]:bg-purple-500"
                data-testid="toggle-extended-thinking"
              />
            </div>

            <div className="flex items-center justify-between py-3 px-1">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-blue-500" />
                <div>
                  <div className="font-medium text-[13px] text-foreground">High Power Models</div>
                  <div className="text-[11px] text-muted-foreground">Use more capable AI models</div>
                </div>
              </div>
              <Switch
                checked={settings.highPowerModels}
                onCheckedChange={handleHighPowerModelsToggle}
                className="data-[state=checked]:bg-blue-500"
                data-testid="toggle-high-power-models"
              />
            </div>

            <div className="flex items-center justify-between py-3 px-1">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-green-500" />
                <div>
                  <div className="font-medium text-[13px] text-foreground">Web Search</div>
                  <div className="text-[11px] text-muted-foreground">Search the internet for information</div>
                </div>
              </div>
              <Switch
                checked={settings.webSearch}
                onCheckedChange={handleWebSearchToggle}
                className="data-[state=checked]:bg-green-500"
                data-testid="toggle-web-search"
              />
            </div>

            <div className="flex items-center justify-between py-3 px-1">
              <div className="flex items-center gap-3">
                <TestTube2 className="w-5 h-5 text-orange-500" />
                <div>
                  <div className="font-medium text-[13px] text-foreground">App Testing</div>
                  <div className="text-[11px] text-muted-foreground">Automated testing of your app</div>
                </div>
              </div>
              <Switch
                checked={settings.appTesting}
                onCheckedChange={handleAppTestingToggle}
                className="data-[state=checked]:bg-orange-500"
                data-testid="toggle-app-testing"
              />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
});

export default AgentToolsBottomSheet;
