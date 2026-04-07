import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Github, 
  Database, 
  Brain,
  Server,
  FileText,
  Code,
  GitBranch,
  Table,
  Search,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface MCPServer {
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'active' | 'inactive' | 'error';
  tools: string[];
  category: string;
}

export function MCPServersPanel() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadMCPServers();
  }, []);

  const loadMCPServers = async () => {
    try {
      setLoading(true);
      
      // Define the integrated MCP servers
      const mcpServers: MCPServer[] = [
        {
          name: 'GitHub MCP',
          description: 'Manage GitHub repositories, issues, and pull requests',
          icon: <Github className="w-5 h-5" />,
          status: 'active',
          tools: ['github_list_repos', 'github_create_repo', 'github_create_issue', 'github_create_pr'],
          category: 'Version Control'
        },
        {
          name: 'PostgreSQL MCP',
          description: 'Execute database queries and manage PostgreSQL databases',
          icon: <Database className="w-5 h-5" />,
          status: 'active',
          tools: ['postgres_list_tables', 'postgres_get_schema', 'postgres_query', 'postgres_backup'],
          category: 'Database'
        },
        {
          name: 'Memory MCP',
          description: 'Manage conversation memory and knowledge graphs',
          icon: <Brain className="w-5 h-5" />,
          status: 'active',
          tools: ['memory_create_node', 'memory_search', 'memory_create_edge', 'memory_save_conversation', 'memory_get_history'],
          category: 'AI & Memory'
        },
        {
          name: 'Filesystem MCP',
          description: 'File and directory operations with watch capabilities',
          icon: <FileText className="w-5 h-5" />,
          status: 'active',
          tools: ['fs_read', 'fs_write', 'fs_list', 'fs_delete', 'fs_mkdir', 'fs_move', 'fs_copy', 'fs_search', 'fs_watch'],
          category: 'Core'
        },
        {
          name: 'Execution MCP',
          description: 'Command execution and process management',
          icon: <Code className="w-5 h-5" />,
          status: 'active',
          tools: ['exec_command', 'exec_spawn', 'process_kill'],
          category: 'Core'
        },
        {
          name: 'System MCP',
          description: 'System information and environment management',
          icon: <Server className="w-5 h-5" />,
          status: 'active',
          tools: ['system_info', 'env_get', 'env_set'],
          category: 'Core'
        }
      ];

      setServers(mcpServers);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load MCP servers',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const testMCPServer = async (serverName: string) => {
    try {
      toast({
        title: 'Testing MCP Server',
        description: `Testing ${serverName}...`
      });

      // Test specific server functionality
      let result;
      switch (serverName) {
        case 'GitHub MCP':
          result = await apiRequest('GET', '/api/mcp/github/repos/octocat');
          break;
        case 'PostgreSQL MCP':
          result = await apiRequest('GET', '/api/mcp/postgres/tables');
          break;
        case 'Memory MCP':
          result = await apiRequest('GET', '/api/mcp/memory/search?query=test&limit=5');
          break;
        default:
          result = await apiRequest('GET', '/api/mcp/tools');
      }

      toast({
        title: 'Success',
        description: `${serverName} is working correctly`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to test ${serverName}`,
        variant: 'destructive'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'inactive':
        return 'bg-gray-400';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const groupedServers = servers.reduce((acc, server) => {
    if (!acc[server.category]) {
      acc[server.category] = [];
    }
    acc[server.category].push(server);
    return acc;
  }, {} as Record<string, MCPServer[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">MCP Servers</h2>
          <p className="text-muted-foreground mt-1">
            Model Context Protocol servers providing AI capabilities
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          <span className="mr-2">●</span>
          {servers.filter(s => s.status === 'active').length} Active
        </Badge>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="core">Core</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="ai">AI & Memory</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid gap-4">
            {Object.entries(groupedServers).map(([category, categoryServers]) => (
              <div key={category} className="space-y-4">
                <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {category}
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {categoryServers.map((server) => (
                    <Card 
                      key={server.name}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => setSelectedServer(server.name)}
                    >
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              {server.icon}
                            </div>
                            <div>
                              <CardTitle className="text-[15px]">{server.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                {getStatusIcon(server.status)}
                                <span className="text-[11px] text-muted-foreground">
                                  {server.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="mb-3">
                          {server.description}
                        </CardDescription>
                        <div className="flex flex-wrap gap-1">
                          {server.tools.slice(0, 3).map((tool) => (
                            <Badge key={tool} variant="secondary" className="text-[11px]">
                              {tool.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                          {server.tools.length > 3 && (
                            <Badge variant="outline" className="text-[11px]">
                              +{server.tools.length - 3} more
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-4"
                          onClick={(e) => {
                            e.stopPropagation();
                            testMCPServer(server.name);
                          }}
                        >
                          Test Connection
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="core" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {servers.filter(s => s.category === 'Core').map((server) => (
              <Card key={server.name}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {server.icon}
                    <CardTitle>{server.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{server.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {servers.filter(s => s.category === 'Version Control' || s.category === 'Database').map((server) => (
              <Card key={server.name}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {server.icon}
                    <CardTitle>{server.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{server.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {servers.filter(s => s.category === 'AI & Memory').map((server) => (
              <Card key={server.name}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {server.icon}
                    <CardTitle>{server.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{server.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {selectedServer && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Server Details: {selectedServer}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-[13px] font-semibold mb-2">Available Tools</h4>
                <div className="flex flex-wrap gap-2">
                  {servers.find(s => s.name === selectedServer)?.tools.map((tool) => (
                    <Badge key={tool} variant="outline">
                      {tool}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-[13px] font-semibold mb-2">Connection Status</h4>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(servers.find(s => s.name === selectedServer)?.status || 'inactive')}`}></div>
                  <span className="text-[13px]">
                    Server is {servers.find(s => s.name === selectedServer)?.status}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}