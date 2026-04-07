import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Copy, ExternalLink, Loader2, Check } from "lucide-react";

interface ShareSnippetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  fileName: string;
  filePath: string;
  code: string;
  language: string;
  lineStart: number;
  lineEnd: number;
}

export function ShareSnippetDialog({
  isOpen,
  onClose,
  projectId,
  fileName,
  filePath,
  code,
  language,
  lineStart,
  lineEnd,
}: ShareSnippetDialogProps) {
  const [title, setTitle] = useState(`${fileName} (lines ${lineStart}-${lineEnd})`);
  const [description, setDescription] = useState("");
  const [expiresIn, setExpiresIn] = useState("never");
  const [isPublic, setIsPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleShare = async () => {
    setIsLoading(true);
    
    try {
      // Calculate expiration date
      let expiresAt: Date | null = null;
      if (expiresIn !== "never") {
        const now = new Date();
        switch (expiresIn) {
          case "1hour":
            expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
            break;
          case "1day":
            expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            break;
          case "1week":
            expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            break;
          case "1month":
            expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            break;
        }
      }

      const data = await apiRequest('POST', `/api/snippets/${projectId}`, {
        fileName,
        filePath,
        lineStart,
        lineEnd,
        code,
        language,
        title,
        description,
        isPublic,
        expiresAt,
      });

      const fullUrl = `${window.location.origin}${data.shareUrl}`;
      setShareUrl(fullUrl);
      
      toast({
        title: "Snippet shared successfully!",
        description: "The share link has been generated.",
      });
    } catch (error) {
      console.error("Error sharing snippet:", error);
      toast({
        title: "Failed to share snippet",
        description: error instanceof Error ? error.message : "An error occurred while sharing the snippet.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      toast({
        title: "Link copied!",
        description: "The share link has been copied to your clipboard.",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Unable to copy the link to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleOpenInNewTab = () => {
    window.open(shareUrl, "_blank");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share Code Snippet</DialogTitle>
          <DialogDescription>
            Share {lineEnd - lineStart + 1} lines from {fileName}
          </DialogDescription>
        </DialogHeader>

        {!shareUrl ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your snippet a title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add context or explanation for this code"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select value={isPublic ? "public" : "private"} onValueChange={(v) => setIsPublic(v === "public")}>
                  <SelectTrigger id="visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiration">Expiration</Label>
                <Select value={expiresIn} onValueChange={setExpiresIn}>
                  <SelectTrigger id="expiration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="1hour">1 hour</SelectItem>
                    <SelectItem value="1day">1 day</SelectItem>
                    <SelectItem value="1week">1 week</SelectItem>
                    <SelectItem value="1month">1 month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-muted p-3 rounded-md">
              <p className="text-[13px] text-muted-foreground">
                Preview: {lineEnd - lineStart + 1} lines of {language} code
              </p>
              <pre className="text-[11px] mt-2 overflow-hidden">
                <code>{code.split('\n').slice(0, 3).join('\n')}...</code>
              </pre>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-md">
              <p className="text-[13px] font-medium text-green-800 dark:text-green-200 mb-2">
                Your snippet has been shared!
              </p>
              <div className="flex items-center gap-2">
                <Input value={shareUrl} readOnly className="font-mono text-[13px]" />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopy}
                  disabled={copied}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="outline" onClick={handleOpenInNewTab}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="text-[13px] text-muted-foreground">
              <p>Share this link with others to let them view your code snippet.</p>
              {expiresIn !== "never" && (
                <p className="mt-1">This link will expire in {expiresIn.replace(/(\d+)/, "$1 ")}.</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {!shareUrl ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleShare} disabled={isLoading || !title.trim()}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Share Snippet
              </Button>
            </>
          ) : (
            <Button onClick={onClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}