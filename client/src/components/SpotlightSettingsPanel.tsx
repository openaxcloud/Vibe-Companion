import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Globe,
  Share2,
  Sparkles,
  Eye,
  MessageSquare,
  Users,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';

interface SpotlightSettingsPanelProps {
  projectId: number;
  className?: string;
}

export function SpotlightSettingsPanel({ projectId, className }: SpotlightSettingsPanelProps) {
  const [shareableUrl] = useState(`https://ecode.app/@team/project-${projectId}`);
  const [isPublic, setIsPublic] = useState(true);
  const [enableComments, setEnableComments] = useState(true);
  const [allowForks, setAllowForks] = useState(true);
  const [description, setDescription] = useState('Building a fully polyglot Replit-style workspace with AI assistants.');
  const [tags, setTags] = useState(['workspace', 'ai-assisted', 'typescript']);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className={className}>
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            <div>
              <CardTitle className="text-base">Spotlight Page</CardTitle>
              <CardDescription>
                Configure how your project appears on the public spotlight page.
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline">Project {projectId}</Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0 h-full flex flex-col">
        <Tabs defaultValue="settings" className="flex-1 flex flex-col">
          <div className="border-b px-4 bg-muted/10">
            <TabsList className="h-10">
              <TabsTrigger value="settings" className="px-3">Settings</TabsTrigger>
              <TabsTrigger value="preview" className="px-3">Preview</TabsTrigger>
              <TabsTrigger value="activity" className="px-3">Activity</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="settings" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                <div>
                  <Label className="text-[13px] font-medium">Page URL</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Input value={shareableUrl} readOnly className="font-mono text-[11px]" />
                    <Button size="sm" variant="outline" onClick={handleCopy}>
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button size="sm" variant="ghost">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Visit
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ToggleRow
                    label="Public visibility"
                    description="Allow anyone with the link to explore your repl"
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                    icon={<Eye className="h-4 w-4" />}
                  />
                  <ToggleRow
                    label="Allow comments"
                    description="Community members can leave feedback threads"
                    checked={enableComments}
                    onCheckedChange={setEnableComments}
                    icon={<MessageSquare className="h-4 w-4" />}
                  />
                  <ToggleRow
                    label="Allow forks"
                    description="Let others remix and build on top of this project"
                    checked={allowForks}
                    onCheckedChange={setAllowForks}
                    icon={<Users className="h-4 w-4" />}
                  />
                </div>

                <div>
                  <Label className="text-[13px] font-medium">Description</Label>
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="mt-2"
                    rows={4}
                  />
                </div>

                <div>
                  <Label className="text-[13px] font-medium">Tags</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary">#{tag}</Badge>
                    ))}
                  </div>
                  <Button size="sm" variant="ghost" className="mt-2">
                    <Sparkles className="h-4 w-4 mr-1" />
                    Suggest tags
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[15px]">{shareableUrl.replace('https://', '')}</CardTitle>
                    <CardDescription>
                      {description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded border border-dashed p-6 text-center text-[13px] text-muted-foreground">
                      Preview of your README, screenshot carousel, and live repl output will show here.
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Share2 className="h-3 w-3" />
                      Public link visible to everyone
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="activity" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="rounded-md border border-border/60 p-3 bg-muted/20">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-medium text-[var(--ecode-text)]">Viewer from San Francisco</span>
                      <span>2 minutes ago</span>
                    </div>
                    <p className="text-[13px] text-[var(--ecode-text)] mt-2">
                      Starred the project and forked the repo to explore the workspace setup.
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  icon?: React.ReactNode;
}

function ToggleRow({ label, description, checked, onCheckedChange, icon }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between rounded-md border border-border/60 bg-background p-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-[13px] font-medium">{label}</p>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
