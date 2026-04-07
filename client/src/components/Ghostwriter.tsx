import React, { useState, useRef, useEffect } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
  Sparkles, 
  Code, 
  MessageSquare, 
  Book, 
  RotateCw, 
  SendHorizonal,
  ChevronsUp,
  ChevronsDown,
  Check,
  X,
  Lightbulb,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { File } from '@shared/schema';

interface GhostwriterProps {
  activeFile: File | undefined;
  onApplyCompletion: (content: string) => void;
}

enum AIMode {
  Complete = "complete",
  Explain = "explain",
  Transform = "transform",
  Document = "document",
  Chat = "chat",
}

interface AIRequest {
  code: string;
  language: string;
  options?: Record<string, any>;
}

interface AIResponse {
  content: string;
  reasoning?: string;
}

export function Ghostwriter({ activeFile, onApplyCompletion }: GhostwriterProps) {
  const [open, setOpen] = useState<boolean>(false);
  const [mode, setMode] = useState<AIMode>(AIMode.Complete);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [explanation, setExplanation] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  
  const chatSchema = z.object({
    prompt: z.string().min(1, "Please enter a prompt"),
  });
  
  const transformSchema = z.object({
    prompt: z.string().min(1, "Please describe the transformation"),
    language: z.string().min(1, "Target language is required"),
  });
  
  type ChatFormValues = z.infer<typeof chatSchema>;
  type TransformFormValues = z.infer<typeof transformSchema>;
  
  const chatForm = useForm<ChatFormValues>({
    resolver: zodResolver(chatSchema),
    defaultValues: {
      prompt: '',
    }
  });
  
  const transformForm = useForm<TransformFormValues>({
    resolver: zodResolver(transformSchema),
    defaultValues: {
      prompt: '',
      language: 'JavaScript',
    }
  });
  
  // Reset state when the active file changes
  useEffect(() => {
    setGeneratedCode('');
    setExplanation('');
    setError(null);
  }, [activeFile]);
  
  // Focus prompt input when mode changes
  useEffect(() => {
    if (open && promptInputRef.current) {
      setTimeout(() => promptInputRef.current?.focus(), 100);
    }
  }, [mode, open]);
  
  // Helper function to get file language
  const getLanguageFromFilename = (filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    
    const langMap: Record<string, string> = {
      'js': 'JavaScript',
      'jsx': 'JavaScript (React)',
      'ts': 'TypeScript',
      'tsx': 'TypeScript (React)',
      'py': 'Python',
      'rb': 'Ruby',
      'java': 'Java',
      'c': 'C',
      'cpp': 'C++',
      'cs': 'C#',
      'go': 'Go',
      'rs': 'Rust',
      'php': 'PHP',
      'html': 'HTML',
      'css': 'CSS',
      'scss': 'SCSS',
      'json': 'JSON',
      'md': 'Markdown',
    };
    
    return langMap[extension] || 'Unknown';
  };
  
  // AI request mutation
  const aiMutation = useMutation({
    mutationFn: async (request: { endpoint: string, data: AIRequest }) => {
      const { endpoint, data } = request;
      
      const response = await fetch(`/api/ai/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'AI request failed');
      }
      
      return response.json() as Promise<AIResponse>;
    },
    onMutate: () => {
      setIsGenerating(true);
      setError(null);
    },
    onSuccess: (data) => {
      setGeneratedCode(data.content);
      if (data.reasoning) {
        setExplanation(data.reasoning);
      }
    },
    onError: (error: Error) => {
      setError(error.message);
      toast({
        title: 'AI Request Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsGenerating(false);
    }
  });
  
  const handleCodeCompletion = () => {
    if (!activeFile) return;
    
    const language = getLanguageFromFilename(activeFile.name);
    
    aiMutation.mutate({
      endpoint: 'completion',
      data: {
        code: activeFile.content,
        language,
      }
    });
  };
  
  const handleCodeExplanation = () => {
    if (!activeFile) return;
    
    const language = getLanguageFromFilename(activeFile.name);
    
    aiMutation.mutate({
      endpoint: 'explanation',
      data: {
        code: activeFile.content,
        language,
      }
    });
  };
  
  const handleCodeTransformation = (values: TransformFormValues) => {
    if (!activeFile) return;
    
    const sourceLanguage = getLanguageFromFilename(activeFile.name);
    
    aiMutation.mutate({
      endpoint: 'convert',
      data: {
        code: activeFile.content,
        language: sourceLanguage,
        options: {
          targetLanguage: values.language,
          instructions: values.prompt,
        }
      }
    });
  };
  
  const handleCodeDocumentation = () => {
    if (!activeFile) return;
    
    const language = getLanguageFromFilename(activeFile.name);
    
    aiMutation.mutate({
      endpoint: 'document',
      data: {
        code: activeFile.content,
        language,
      }
    });
  };
  
  const handleChatWithAI = (values: ChatFormValues) => {
    if (!activeFile) return;
    
    const language = getLanguageFromFilename(activeFile.name);
    
    aiMutation.mutate({
      endpoint: 'explanation', // Reuse explanation endpoint for chat
      data: {
        code: activeFile.content,
        language,
        options: {
          prompt: values.prompt,
        }
      }
    });
  };
  
  const handleTabChange = (value: string) => {
    setMode(value as AIMode);
    setGeneratedCode('');
    setExplanation('');
    setError(null);
  };
  
  const handleApplyCompletion = () => {
    if (generatedCode.trim()) {
      onApplyCompletion(generatedCode);
      setOpen(false);
      toast({
        title: 'Code applied',
        description: 'AI-generated code has been applied to your file.',
      });
    }
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          size="sm" 
          variant="outline" 
          className="gap-1 rounded-full"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Ghostwriter</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-[450px]">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium flex items-center gap-1">
            <Sparkles className="h-4 w-4" />
            Ghostwriter AI
          </h3>
          {activeFile && (
            <Badge variant="outline" className="text-xs">
              {getLanguageFromFilename(activeFile.name)}
            </Badge>
          )}
        </div>
        
        <Separator className="my-2" />
        
        {!activeFile ? (
          <div className="py-6 text-center text-muted-foreground">
            <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Open a file to use Ghostwriter AI</p>
          </div>
        ) : (
          <Tabs value={mode} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid grid-cols-5 mb-2">
              <TabsTrigger value={AIMode.Complete} className="text-xs">
                <Code className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">Complete</span>
              </TabsTrigger>
              <TabsTrigger value={AIMode.Explain} className="text-xs">
                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">Explain</span>
              </TabsTrigger>
              <TabsTrigger value={AIMode.Transform} className="text-xs">
                <RotateCw className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">Transform</span>
              </TabsTrigger>
              <TabsTrigger value={AIMode.Document} className="text-xs">
                <Book className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">Document</span>
              </TabsTrigger>
              <TabsTrigger value={AIMode.Chat} className="text-xs">
                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">Chat</span>
              </TabsTrigger>
            </TabsList>
            
            {/* Complete Tab */}
            <TabsContent value={AIMode.Complete} className="space-y-4">
              <div className="text-xs text-muted-foreground">
                Generate code completions based on your current file.
              </div>
              
              <Button 
                onClick={handleCodeCompletion} 
                className="w-full"
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Completion
                  </>
                )}
              </Button>
              
              {generatedCode && (
                <div className="space-y-2">
                  <ScrollArea className="h-[200px] w-full rounded border bg-muted/50 p-4">
                    <pre className="font-mono text-xs whitespace-pre-wrap">{generatedCode}</pre>
                  </ScrollArea>
                  
                  <div className="flex justify-end space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setGeneratedCode('')}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Discard
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleApplyCompletion}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Apply
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
            
            {/* Explain Tab */}
            <TabsContent value={AIMode.Explain} className="space-y-4">
              <div className="text-xs text-muted-foreground">
                Get an explanation of your code to understand what it does.
              </div>
              
              <Button 
                onClick={handleCodeExplanation} 
                className="w-full"
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Explain This Code
                  </>
                )}
              </Button>
              
              {explanation && (
                <ScrollArea className="h-[200px] w-full rounded border bg-muted/50 p-4">
                  <div className="text-sm whitespace-pre-wrap">
                    {explanation}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
            
            {/* Transform Tab */}
            <TabsContent value={AIMode.Transform} className="space-y-4">
              <div className="text-xs text-muted-foreground">
                Transform your code to another language or style.
              </div>
              
              <Form {...transformForm}>
                <form 
                  onSubmit={transformForm.handleSubmit(handleCodeTransformation)} 
                  className="space-y-4"
                >
                  <FormField
                    control={transformForm.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Target Language</FormLabel>
                        <FormControl>
                          <Input placeholder="JavaScript, Python, etc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={transformForm.control}
                    name="prompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Instructions (optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            ref={promptInputRef}
                            placeholder="Convert to modern syntax, optimize for performance, etc."
                            className="h-20"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                        Transforming...
                      </>
                    ) : (
                      <>
                        <RotateCw className="h-4 w-4 mr-2" />
                        Transform Code
                      </>
                    )}
                  </Button>
                </form>
              </Form>
              
              {generatedCode && (
                <div className="space-y-2">
                  <ScrollArea className="h-[200px] w-full rounded border bg-muted/50 p-4">
                    <pre className="font-mono text-xs whitespace-pre-wrap">{generatedCode}</pre>
                  </ScrollArea>
                  
                  <div className="flex justify-end space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setGeneratedCode('')}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Discard
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleApplyCompletion}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Apply
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
            
            {/* Document Tab */}
            <TabsContent value={AIMode.Document} className="space-y-4">
              <div className="text-xs text-muted-foreground">
                Generate documentation for your code, including comments and explanations.
              </div>
              
              <Button 
                onClick={handleCodeDocumentation} 
                className="w-full"
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating Docs...
                  </>
                ) : (
                  <>
                    <Book className="h-4 w-4 mr-2" />
                    Document This Code
                  </>
                )}
              </Button>
              
              {generatedCode && (
                <div className="space-y-2">
                  <ScrollArea className="h-[200px] w-full rounded border bg-muted/50 p-4">
                    <pre className="font-mono text-xs whitespace-pre-wrap">{generatedCode}</pre>
                  </ScrollArea>
                  
                  <div className="flex justify-end space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setGeneratedCode('')}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Discard
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleApplyCompletion}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Apply
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
            
            {/* Chat Tab */}
            <TabsContent value={AIMode.Chat} className="space-y-4">
              <div className="text-xs text-muted-foreground">
                Ask questions about your code and get AI-powered responses.
              </div>
              
              <Form {...chatForm}>
                <form 
                  onSubmit={chatForm.handleSubmit(handleChatWithAI)} 
                  className="space-y-4"
                >
                  <FormField
                    control={chatForm.control}
                    name="prompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Textarea 
                              ref={promptInputRef}
                              placeholder="Ask about your code..."
                              className="h-20 pr-10"
                              {...field} 
                            />
                            <Button
                              type="submit"
                              size="icon"
                              className="absolute right-2 bottom-2 h-6 w-6"
                              disabled={isGenerating || !field.value.trim()}
                            >
                              {isGenerating ? (
                                <RotateCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <SendHorizonal className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
              
              {explanation && (
                <ScrollArea className="h-[200px] w-full rounded border bg-muted/50 p-4">
                  <div className="text-sm whitespace-pre-wrap">
                    {explanation}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
            
            {error && (
              <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-destructive text-xs mt-2">
                {error}
              </div>
            )}
          </Tabs>
        )}
      </PopoverContent>
    </Popover>
  );
}