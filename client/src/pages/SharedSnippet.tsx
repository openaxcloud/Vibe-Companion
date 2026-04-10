import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Code2, User, Calendar, Eye, FileCode, Home } from "lucide-react";
import { LightSyntaxHighlighter, darkStyle } from "@/components/ui/LightSyntaxHighlighter";

interface CodeSnippet {
  id: number;
  shareId: string;
  projectId: number;
  userId: number;
  fileName: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  code: string;
  language: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  views: number;
  expiresAt: string | null;
  createdAt: string;
  project: {
    name: string;
    language: string;
  } | null;
  author: {
    username: string;
    displayName: string | null;
  } | null;
}

export default function SharedSnippet() {
  const { shareId } = useParams() as { shareId: string };
  const [snippet, setSnippet] = useState<CodeSnippet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSnippet();
  }, [shareId]);

  const fetchSnippet = async () => {
    try {
      const response = await fetch(`/api/snippets/${shareId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError("This snippet could not be found.");
        } else if (response.status === 410) {
          setError("This snippet has expired.");
        } else {
          setError("Failed to load snippet.");
        }
        return;
      }

      const data = await response.json();
      setSnippet(data);
    } catch (err) {
      console.error("Error fetching snippet:", err);
      setError("Failed to load snippet.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!snippet) return;
    
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      toast({
        title: "Code copied!",
        description: "The code has been copied to your clipboard.",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Unable to copy the code to clipboard.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getLanguageDisplay = (lang: string) => {
    const languageMap: { [key: string]: string } = {
      javascript: "JavaScript",
      typescript: "TypeScript",
      python: "Python",
      java: "Java",
      cpp: "C++",
      csharp: "C#",
      go: "Go",
      rust: "Rust",
      php: "PHP",
      ruby: "Ruby",
      swift: "Swift",
      kotlin: "Kotlin",
      html: "HTML",
      css: "CSS",
      sql: "SQL",
      shell: "Shell",
      markdown: "Markdown",
    };
    return languageMap[lang.toLowerCase()] || lang;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicNavbar />
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-5xl mx-auto space-y-6">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  if (error || !snippet) {
    return (
      <div className="min-h-screen bg-background">
        <PublicNavbar />
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <div className="mb-8">
              <FileCode className="h-24 w-24 mx-auto text-muted-foreground/50" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Snippet Not Found</h1>
            <p className="text-[15px] text-muted-foreground mb-8">
              {error || "The snippet you're looking for doesn't exist or has been removed."}
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/">
                <Button variant="default" data-testid="button-go-home">
                  <Home className="mr-2 h-4 w-4" />
                  Go to Homepage
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" data-testid="button-start-building-error">
                  Start Building
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  const lineCount = snippet.lineEnd - snippet.lineStart + 1;

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-4">{snippet.title}</h1>
            
            <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground">
              {snippet.author && (
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>{snippet.author?.displayName || snippet.author?.username || 'Unknown'}</span>
                </div>
              )}
              
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(snippet.createdAt)}</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{snippet.views} views</span>
              </div>
              
              {snippet.project && (
                <div className="flex items-center gap-1">
                  <Code2 className="h-4 w-4" />
                  <span>{snippet.project.name}</span>
                </div>
              )}
            </div>
            
            {snippet.description && (
              <p className="mt-4 text-muted-foreground">{snippet.description}</p>
            )}
          </div>

          {/* Code Section */}
          <Card className="overflow-hidden">
            <div className="bg-muted px-4 py-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-[13px] font-medium">{snippet.fileName}</span>
                <span className="text-[13px] text-muted-foreground">
                  Lines {snippet.lineStart}-{snippet.lineEnd} ({lineCount} lines)
                </span>
                <span className="text-[13px] px-2 py-1 bg-primary/10 text-primary rounded">
                  {getLanguageDisplay(snippet.language)}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  disabled={copied}
                  data-testid="button-copy-code"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {copied ? "Copied!" : "Copy Code"}
                </Button>
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-12 bg-muted/50 text-muted-foreground text-[11px] leading-[1.5rem] text-right pr-2 pt-3 select-none">
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i}>{snippet.lineStart + i}</div>
                ))}
              </div>
              
              <div className="pl-12 overflow-x-auto">
                <LightSyntaxHighlighter
                  language={snippet.language}
                  style={darkStyle}
                  customStyle={{
                    margin: 0,
                    padding: "1rem",
                    background: "transparent",
                    fontSize: "0.875rem",
                  }}
                >
                  {snippet.code}
                </LightSyntaxHighlighter>
              </div>
            </div>
          </Card>

          {/* CTA Section */}
          <div className="mt-12 text-center">
            <h2 className="text-2xl font-semibold mb-4">
              Build something amazing with E-Code
            </h2>
            <p className="text-muted-foreground mb-6">
              Create, share, and collaborate on code snippets and full applications with our AI-powered development platform.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" data-testid="button-start-building">
                  Start Building
                </Button>
              </Link>
              <Link href="/features">
                <Button size="lg" variant="outline" data-testid="button-learn-more">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      <PublicFooter />
    </div>
  );
}