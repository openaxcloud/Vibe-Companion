import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Play, X, CheckCircle, XCircle, Clock, FlaskConical, FileText, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";

interface TestRunnerPanelProps {
  projectId: string;
  onClose: () => void;
}

interface TestResult {
  name: string;
  status: "pass" | "fail" | "skip";
  duration?: number;
  error?: string;
}

interface TestSuite {
  file: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

export default function TestRunnerPanel({ projectId, onClose }: TestRunnerPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedSuite, setExpandedSuite] = useState<string | null>(null);

  const testFilesQuery = useQuery<{ files: string[]; framework: string }>({
    queryKey: ["/api/projects", projectId, "tests/detect"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/tests/detect`, { credentials: "include" });
      if (!res.ok) return { files: [], framework: "none" };
      return res.json();
    },
  });

  const [testResults, setTestResults] = useState<TestSuite[] | null>(null);
  const [testOutput, setTestOutput] = useState("");

  const runTestsMutation = useMutation({
    mutationFn: async (file?: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/tests/run`, { file });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.suites) {
        setTestResults(data.suites);
        setTestOutput(data.output || "");
        if (data.suites.length > 0) setExpandedSuite(data.suites[0].file);
      } else if (data.output) {
        setTestOutput(data.output);
        setTestResults([]);
      }
    },
    onError: (err: any) => {
      toast({ title: "Test run failed", description: err.message, variant: "destructive" });
    },
  });

  const totalPassed = testResults?.reduce((s, suite) => s + suite.passed, 0) ?? 0;
  const totalFailed = testResults?.reduce((s, suite) => s + suite.failed, 0) ?? 0;
  const totalSkipped = testResults?.reduce((s, suite) => s + suite.skipped, 0) ?? 0;

  return (
    <div className="flex flex-col h-full" data-testid="test-runner-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest flex items-center gap-1.5">
          <FlaskConical className="w-3.5 h-3.5 text-[#F59E0B]" /> Tests
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
            onClick={() => { queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "tests/detect"] }); setTestResults(null); setTestOutput(""); }}
            data-testid="button-refresh-tests">
            <RotateCcw className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={onClose} data-testid="button-close-tests">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-[var(--ide-border)] flex items-center justify-between">
        <Button
          size="sm"
          className="h-7 px-4 text-[11px] bg-[#0CCE6B] hover:bg-[#0CCE6B]/80 text-black rounded-md font-semibold gap-1.5"
          onClick={() => runTestsMutation.mutate(undefined)}
          disabled={runTestsMutation.isPending}
          data-testid="button-run-all-tests"
        >
          {runTestsMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          Run All Tests
        </Button>
        {testResults !== null && (
          <div className="flex items-center gap-2 text-[10px]">
            {totalPassed > 0 && <span className="flex items-center gap-1 text-[#0CCE6B]"><CheckCircle className="w-3 h-3" />{totalPassed}</span>}
            {totalFailed > 0 && <span className="flex items-center gap-1 text-red-400"><XCircle className="w-3 h-3" />{totalFailed}</span>}
            {totalSkipped > 0 && <span className="flex items-center gap-1 text-[var(--ide-text-muted)]"><Clock className="w-3 h-3" />{totalSkipped}</span>}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {testFilesQuery.isLoading && (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-[var(--ide-text-muted)] animate-spin" /></div>
        )}

        {testFilesQuery.data && testFilesQuery.data.files.length === 0 && !testResults && (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <FlaskConical className="w-8 h-8 text-[var(--ide-text-muted)] mb-2 opacity-30" />
            <p className="text-xs text-[var(--ide-text-muted)]">No test files detected</p>
            <p className="text-[10px] text-[var(--ide-text-muted)] mt-1 opacity-60">
              Create files matching *.test.js, *.spec.js, test_*.py, etc.
            </p>
          </div>
        )}

        {testFilesQuery.data && testFilesQuery.data.files.length > 0 && !testResults && (
          <div>
            <div className="px-3 py-1.5">
              <span className="text-[9px] text-[var(--ide-text-muted)] uppercase tracking-wider font-semibold">
                {testFilesQuery.data.framework} · {testFilesQuery.data.files.length} test file{testFilesQuery.data.files.length === 1 ? "" : "s"}
              </span>
            </div>
            {testFilesQuery.data.files.map((file) => (
              <button
                key={file}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--ide-surface)]/40 transition-colors"
                onClick={() => runTestsMutation.mutate(file)}
                data-testid={`test-file-${file}`}
              >
                <FileText className="w-3 h-3 text-[#F59E0B] shrink-0" />
                <span className="text-[11px] text-[var(--ide-text)] font-mono truncate">{file}</span>
                <Play className="w-3 h-3 text-[var(--ide-text-muted)] ml-auto opacity-0 group-hover:opacity-100 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {testResults && testResults.length > 0 && (
          <div>
            {testResults.map((suite) => (
              <div key={suite.file}>
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--ide-surface)]/40 transition-colors"
                  onClick={() => setExpandedSuite(expandedSuite === suite.file ? null : suite.file)}
                  data-testid={`suite-${suite.file}`}
                >
                  {expandedSuite === suite.file ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)]" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)]" />}
                  {suite.failed > 0 ? <XCircle className="w-3.5 h-3.5 text-red-400" /> : <CheckCircle className="w-3.5 h-3.5 text-[#0CCE6B]" />}
                  <span className="text-[11px] text-[var(--ide-text)] font-mono truncate flex-1">{suite.file}</span>
                  <span className="text-[9px] text-[var(--ide-text-muted)]">{suite.duration}ms</span>
                </button>
                {expandedSuite === suite.file && (
                  <div className="pl-6 pr-3 pb-1">
                    {suite.tests.map((test, i) => (
                      <div key={i} className="flex items-start gap-2 py-1" data-testid={`test-result-${i}`}>
                        {test.status === "pass" ? <CheckCircle className="w-3 h-3 text-[#0CCE6B] shrink-0 mt-0.5" /> :
                         test.status === "fail" ? <XCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" /> :
                         <Clock className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <span className={`text-[10px] font-mono ${test.status === "fail" ? "text-red-400" : "text-[var(--ide-text)]"}`}>{test.name}</span>
                          {test.error && (
                            <div className="text-[9px] text-red-400/80 font-mono mt-0.5 bg-red-500/5 rounded px-1.5 py-1">{test.error}</div>
                          )}
                        </div>
                        {test.duration !== undefined && <span className="text-[9px] text-[var(--ide-text-muted)] shrink-0">{test.duration}ms</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {testOutput && (
          <div className="border-t border-[var(--ide-border)] mt-2">
            <div className="px-3 py-1.5">
              <span className="text-[9px] text-[var(--ide-text-muted)] uppercase tracking-wider font-semibold">Output</span>
            </div>
            <pre className="px-3 pb-3 text-[10px] font-mono text-[var(--ide-text-secondary)] whitespace-pre-wrap break-words" data-testid="text-test-output">{testOutput}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
export { TestRunnerPanel };
