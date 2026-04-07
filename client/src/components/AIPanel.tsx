import React, { useState, useEffect } from 'react';
import { useAI } from '@/hooks/useAI';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Sparkles, MessageSquare, Code, GitCompare, FileText, TestTube } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Markdown } from '@/components/ui/markdown';

interface AIToolProps {
  projectId: number;
  currentFileContent?: string;
  currentLanguage?: string;
  onInsertCode?: (code: string) => void;
}

const languageOptions = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'rust', label: 'Rust' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sql', label: 'SQL' },
];

const frameworkOptions = {
  javascript: [
    { value: 'jest', label: 'Jest' },
    { value: 'mocha', label: 'Mocha' },
    { value: 'jasmine', label: 'Jasmine' },
  ],
  typescript: [
    { value: 'jest', label: 'Jest' },
    { value: 'mocha', label: 'Mocha' },
    { value: 'jasmine', label: 'Jasmine' },
  ],
  python: [
    { value: 'pytest', label: 'PyTest' },
    { value: 'unittest', label: 'Unittest' },
  ],
  java: [
    { value: 'junit', label: 'JUnit' },
    { value: 'testng', label: 'TestNG' },
  ],
  csharp: [
    { value: 'nunit', label: 'NUnit' },
    { value: 'xunit', label: 'xUnit' },
    { value: 'mstest', label: 'MSTest' },
  ],
  php: [
    { value: 'phpunit', label: 'PHPUnit' },
  ],
  ruby: [
    { value: 'rspec', label: 'RSpec' },
    { value: 'minitest', label: 'Minitest' },
  ],
};

const AIPanel: React.FC<AIToolProps> = ({ 
  projectId, 
  currentFileContent = '', 
  currentLanguage = 'javascript',
  onInsertCode
}) => {
  const [activeTab, setActiveTab] = useState('completion');
  const [code, setCode] = useState(currentFileContent);
  const [language, setLanguage] = useState(currentLanguage);
  const [fromLanguage, setFromLanguage] = useState(currentLanguage);
  const [toLanguage, setToLanguage] = useState('python');
  const [docStyle, setDocStyle] = useState('standard');
  const [framework, setFramework] = useState('');
  const [result, setResult] = useState('');
  
  const { toast } = useToast();
  const { 
    completionMutation,
    explanationMutation,
    convertMutation,
    documentationMutation,
    testGenerationMutation,
    isProcessing,
  } = useAI();

  // Update the code when the current file content changes
  useEffect(() => {
    setCode(currentFileContent);
  }, [currentFileContent]);

  // Update the language when the current language changes
  useEffect(() => {
    setLanguage(currentLanguage);
    setFromLanguage(currentLanguage);
  }, [currentLanguage]);

  const handleGenerateCompletion = async () => {
    try {
      const completion = await completionMutation.mutateAsync({ 
        code, 
        language 
      });
      setResult(completion);
    } catch (error) {
      console.error('Error generating completion:', error);
    }
  };

  const handleGenerateExplanation = async () => {
    try {
      const explanation = await explanationMutation.mutateAsync({ 
        code, 
        language 
      });
      setResult(explanation);
    } catch (error) {
      console.error('Error generating explanation:', error);
    }
  };

  const handleConvertCode = async () => {
    try {
      const convertedCode = await convertMutation.mutateAsync({ 
        code, 
        fromLanguage, 
        toLanguage 
      });
      setResult(convertedCode);
    } catch (error) {
      console.error('Error converting code:', error);
    }
  };

  const handleGenerateDocumentation = async () => {
    try {
      const documentedCode = await documentationMutation.mutateAsync({ 
        code, 
        language, 
        style: docStyle as any 
      });
      setResult(documentedCode);
    } catch (error) {
      console.error('Error generating documentation:', error);
    }
  };

  const handleGenerateTests = async () => {
    try {
      const tests = await testGenerationMutation.mutateAsync({ 
        code, 
        language, 
        framework 
      });
      setResult(tests);
    } catch (error) {
      console.error('Error generating tests:', error);
    }
  };

  const handleInsertCode = () => {
    if (onInsertCode && result) {
      onInsertCode(result);
      toast({
        title: 'Code Inserted',
        description: 'AI-generated code has been inserted into the editor.',
        duration: 3000,
      });
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col h-full"
      >
        <div className="px-4 py-2 border-b">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="completion" className="text-xs py-1 flex flex-col items-center gap-1">
              <Sparkles className="h-4 w-4" />
              <span>Complete</span>
            </TabsTrigger>
            <TabsTrigger value="explain" className="text-xs py-1 flex flex-col items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              <span>Explain</span>
            </TabsTrigger>
            <TabsTrigger value="convert" className="text-xs py-1 flex flex-col items-center gap-1">
              <GitCompare className="h-4 w-4" />
              <span>Convert</span>
            </TabsTrigger>
            <TabsTrigger value="document" className="text-xs py-1 flex flex-col items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>Document</span>
            </TabsTrigger>
            <TabsTrigger value="test" className="text-xs py-1 flex flex-col items-center gap-1">
              <TestTube className="h-4 w-4" />
              <span>Test</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Code Completion */}
          <TabsContent value="completion" className="flex-1 flex flex-col p-4 space-y-4 data-[state=inactive]:hidden">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="completion-code">Code to Complete</Label>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="language" className="text-xs">Language:</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {languageOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea
                id="completion-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-mono text-sm h-32"
                placeholder="Enter your code here..."
              />
              <Button 
                onClick={handleGenerateCompletion} 
                disabled={!code.trim() || isProcessing}
                className="w-full"
              >
                {completionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating completion...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Complete Code
                  </>
                )}
              </Button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <Label>Completion Result</Label>
                {result && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleInsertCode}
                    className="h-7 text-xs"
                  >
                    <Code className="mr-1 h-3 w-3" /> Insert into Editor
                  </Button>
                )}
              </div>
              <ScrollArea className="flex-1 border rounded-md">
                <div className="p-4">
                  {result ? (
                    <SyntaxHighlighter
                      language={language}
                      style={vscDarkPlus}
                      customStyle={{ margin: 0, background: 'transparent' }}
                    >
                      {result}
                    </SyntaxHighlighter>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Code completion will appear here...
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Code Explanation */}
          <TabsContent value="explain" className="flex-1 flex flex-col p-4 space-y-4 data-[state=inactive]:hidden">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="explain-code">Code to Explain</Label>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="language" className="text-xs">Language:</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {languageOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea
                id="explain-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-mono text-sm h-32"
                placeholder="Enter your code here..."
              />
              <Button 
                onClick={handleGenerateExplanation} 
                disabled={!code.trim() || isProcessing}
                className="w-full"
              >
                {explanationMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating explanation...
                  </>
                ) : (
                  <>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Explain Code
                  </>
                )}
              </Button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              <Label className="mb-2">Explanation</Label>
              <ScrollArea className="flex-1 border rounded-md">
                <div className="p-4">
                  {result ? (
                    <Markdown>{result}</Markdown>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Code explanation will appear here...
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Code Conversion */}
          <TabsContent value="convert" className="flex-1 flex flex-col p-4 space-y-4 data-[state=inactive]:hidden">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="convert-code">Code to Convert</Label>
                <div className="flex items-center space-x-2">
                  <Label className="text-xs">From:</Label>
                  <Select value={fromLanguage} onValueChange={setFromLanguage}>
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue placeholder="Source language" />
                    </SelectTrigger>
                    <SelectContent>
                      {languageOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Label className="text-xs">To:</Label>
                  <Select value={toLanguage} onValueChange={setToLanguage}>
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue placeholder="Target language" />
                    </SelectTrigger>
                    <SelectContent>
                      {languageOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea
                id="convert-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-mono text-sm h-32"
                placeholder="Enter your code here..."
              />
              <Button 
                onClick={handleConvertCode} 
                disabled={!code.trim() || fromLanguage === toLanguage || isProcessing}
                className="w-full"
              >
                {convertMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Converting code...
                  </>
                ) : (
                  <>
                    <GitCompare className="mr-2 h-4 w-4" />
                    Convert Code
                  </>
                )}
              </Button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <Label>Converted Code</Label>
                {result && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleInsertCode}
                    className="h-7 text-xs"
                  >
                    <Code className="mr-1 h-3 w-3" /> Insert into Editor
                  </Button>
                )}
              </div>
              <ScrollArea className="flex-1 border rounded-md">
                <div className="p-4">
                  {result ? (
                    <SyntaxHighlighter
                      language={toLanguage}
                      style={vscDarkPlus}
                      customStyle={{ margin: 0, background: 'transparent' }}
                    >
                      {result}
                    </SyntaxHighlighter>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Converted code will appear here...
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Documentation Generation */}
          <TabsContent value="document" className="flex-1 flex flex-col p-4 space-y-4 data-[state=inactive]:hidden">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="document-code">Code to Document</Label>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="language" className="text-xs">Language:</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {languageOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Label htmlFor="docStyle" className="text-xs">Style:</Label>
                  <Select value={docStyle} onValueChange={setDocStyle}>
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue placeholder="Doc style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="jsdoc">JSDoc/Javadoc</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="numpy">NumPy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea
                id="document-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-mono text-sm h-32"
                placeholder="Enter your code here..."
              />
              <Button 
                onClick={handleGenerateDocumentation} 
                disabled={!code.trim() || isProcessing}
                className="w-full"
              >
                {documentationMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating documentation...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Documentation
                  </>
                )}
              </Button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <Label>Documented Code</Label>
                {result && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleInsertCode}
                    className="h-7 text-xs"
                  >
                    <Code className="mr-1 h-3 w-3" /> Insert into Editor
                  </Button>
                )}
              </div>
              <ScrollArea className="flex-1 border rounded-md">
                <div className="p-4">
                  {result ? (
                    <SyntaxHighlighter
                      language={language}
                      style={vscDarkPlus}
                      customStyle={{ margin: 0, background: 'transparent' }}
                    >
                      {result}
                    </SyntaxHighlighter>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Documented code will appear here...
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Test Generation */}
          <TabsContent value="test" className="flex-1 flex flex-col p-4 space-y-4 data-[state=inactive]:hidden">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="test-code">Code to Test</Label>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="language" className="text-xs">Language:</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {languageOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Label htmlFor="framework" className="text-xs">Framework:</Label>
                  <Select 
                    value={framework} 
                    onValueChange={setFramework}
                    disabled={!(language in frameworkOptions)}
                  >
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue placeholder="Test framework" />
                    </SelectTrigger>
                    <SelectContent>
                      {language in frameworkOptions ? (
                        frameworkOptions[language as keyof typeof frameworkOptions].map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          No frameworks available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea
                id="test-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-mono text-sm h-32"
                placeholder="Enter your code here..."
              />
              <Button 
                onClick={handleGenerateTests} 
                disabled={!code.trim() || isProcessing}
                className="w-full"
              >
                {testGenerationMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating tests...
                  </>
                ) : (
                  <>
                    <TestTube className="mr-2 h-4 w-4" />
                    Generate Tests
                  </>
                )}
              </Button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <Label>Generated Tests</Label>
                {result && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleInsertCode}
                    className="h-7 text-xs"
                  >
                    <Code className="mr-1 h-3 w-3" /> Insert into Editor
                  </Button>
                )}
              </div>
              <ScrollArea className="flex-1 border rounded-md">
                <div className="p-4">
                  {result ? (
                    <SyntaxHighlighter
                      language={language}
                      style={vscDarkPlus}
                      customStyle={{ margin: 0, background: 'transparent' }}
                    >
                      {result}
                    </SyntaxHighlighter>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Test code will appear here...
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </Card>
  );
};

export default AIPanel;