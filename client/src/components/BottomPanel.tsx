import { useState } from "react";
import { File } from "@shared/schema";
import { Terminal, AlertCircle, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BottomPanelProps {
  activeFile: File | undefined;
}

type LogType = "info" | "error" | "warning" | "success";

interface LogMessage {
  id: number;
  type: LogType;
  message: string;
  timestamp: Date;
}

const BottomPanel = ({ activeFile }: BottomPanelProps) => {
  const [logs, setLogs] = useState<LogMessage[]>([
    { id: 1, type: "info", message: "Running application...", timestamp: new Date() },
    { id: 2, type: "success", message: "Application started successfully", timestamp: new Date() },
    { id: 3, type: "warning", message: "Missing doctype declaration", timestamp: new Date() },
    { id: 4, type: "error", message: "Failed to load resource: net::ERR_FILE_NOT_FOUND", timestamp: new Date() },
  ]);
  
  const problems = activeFile ? [
    { id: 1, type: "error", message: `${activeFile.name}: Unexpected token (5:10)`, line: 5, column: 10 },
    { id: 2, type: "warning", message: `${activeFile.name}: Variable 'count' is declared but never used`, line: 8, column: 5 },
  ] : [];
  
  const getLogIcon = (type: LogType) => {
    switch (type) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "success":
        return <Terminal className="h-4 w-4 text-green-500" />;
      case "info":
      default:
        return <Terminal className="h-4 w-4 text-blue-500" />;
    }
  };
  
  const getLogTextColor = (type: LogType) => {
    switch (type) {
      case "error":
        return "text-red-500";
      case "warning":
        return "text-yellow-500";
      case "success":
        return "text-green-500";
      case "info":
      default:
        return "text-blue-500";
    }
  };
  
  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  return (
    <div className="h-full flex flex-col bg-background">
      <Tabs defaultValue="console" className="h-full flex flex-col">
        <div className="flex items-center justify-between border-b">
          <TabsList className="h-10">
            <TabsTrigger value="console" className="flex gap-2 h-8">
              <Terminal className="h-4 w-4" />
              <span>Console</span>
              <Badge variant="outline" className="ml-1 h-5 min-w-5 px-1 rounded-full">
                {logs.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="problems" className="flex gap-2 h-8">
              <AlertCircle className="h-4 w-4" />
              <span>Problems</span>
              <Badge variant="outline" className="ml-1 h-5 min-w-5 px-1 rounded-full">
                {problems.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center pr-2">
            <button 
              className="p-1 hover:bg-accent hover:text-accent-foreground rounded-sm"
              onClick={() => setLogs([])}
              title="Clear console"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        <TabsContent value="console" className="flex-1 p-0 m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-1">
              {logs.length === 0 ? (
                <div className="text-muted-foreground text-sm py-8 text-center">
                  Console is empty
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="flex text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground text-xs shrink-0">
                        {formatTimestamp(log.timestamp)}
                      </span>
                      <span className="shrink-0">
                        {getLogIcon(log.type)}
                      </span>
                      <span className={cn("break-all", getLogTextColor(log.type))}>
                        {log.message}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="problems" className="flex-1 p-0 m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {problems.length === 0 ? (
                <div className="text-muted-foreground text-sm py-8 text-center">
                  No problems detected
                </div>
              ) : (
                problems.map(problem => (
                  <div key={problem.id} className="flex text-sm gap-2 p-2 hover:bg-accent rounded-md cursor-pointer">
                    <div className="shrink-0 mt-0.5">
                      {problem.type === "error" ? (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="break-all font-medium">
                        {problem.message}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Line {problem.line}, Column {problem.column}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BottomPanel;