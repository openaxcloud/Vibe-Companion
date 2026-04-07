import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import { 
  Brain, 
  Search,
  Plus,
  Loader2,
  MessageSquare,
  Clock,
  Link,
  FileText,
  Tag,
  History,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface MemoryNode {
  id: string;
  type: 'concept' | 'fact' | 'experience' | 'conversation';
  content: string;
  metadata: Record<string, any>;
  connections: number;
  createdAt: string;
  lastAccessed: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: number;
  lastMessage: string;
  createdAt: string;
}

export function MemoryMCPPanel({ projectId }: { projectId?: number }) {
  const [activeTab, setActiveTab] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<MemoryNode | null>(null);
  const { toast } = useToast();

  // Search memory mutation
  const searchMemoryMutation = useMutation<MemoryNode[], Error, string>({
    mutationFn: async (query: string) => {
      const response = await apiRequest('POST', '/api/mcp/memory/search', { query });
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    onError: (error) => {
      toast({
        title: 'Search Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Get conversation history
  const { data: conversations, isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ['/api/mcp/memory/conversations'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/mcp/memory/conversations');
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return response.json();
    }
  });

  // Create memory node mutation
  const createNodeMutation = useMutation({
    mutationFn: async (data: { type: string; content: string; metadata: Record<string, any> }) => {
      const response = await apiRequest('POST', '/api/mcp/memory/nodes', data);
      if (!response.ok) throw new Error('Failed to create memory node');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Memory Created',
        description: 'New memory node has been added to the knowledge graph'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Create edge between nodes
  const createEdgeMutation = useMutation({
    mutationFn: async (data: { fromId: string; toId: string; relationship: string }) => {
      const response = await apiRequest('POST', '/api/mcp/memory/edges', data);
      if (!response.ok) throw new Error('Failed to create connection');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Connection Created',
        description: 'Memory nodes have been linked'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const [newNode, setNewNode] = useState({
    type: 'concept',
    content: '',
    tags: '',
    source: ''
  });

  const [newConnection, setNewConnection] = useState({
    fromId: '',
    toId: '',
    relationship: ''
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMemoryMutation.mutate(searchQuery);
    }
  };

  const searchResults = searchMemoryMutation.data || [];

  return (
    <Card className="h-full bg-[var(--ecode-bg)] border-[var(--ecode-border)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-[var(--ecode-accent)]" />
            <CardTitle className="text-[var(--ecode-text)]">Memory & Knowledge Graph</CardTitle>
          </div>
          <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30">
            <Sparkles className="w-3 h-3 mr-1" />
            AI Powered
          </Badge>
        </div>
        <CardDescription className="text-[var(--ecode-muted)]">
          Store and retrieve contextual information across conversations
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 bg-[var(--ecode-sidebar)]">
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="create">Add Memory</TabsTrigger>
            <TabsTrigger value="conversations">History</TabsTrigger>
            <TabsTrigger value="connections">Connect</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search memory for concepts, facts, or experiences..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 bg-[var(--ecode-sidebar)] border-[var(--ecode-border)]"
              />
              <Button
                onClick={handleSearch}
                disabled={!searchQuery.trim() || searchMemoryMutation.isPending}
              >
                {searchMemoryMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>

            <ScrollArea className="h-[400px]">
              {searchResults.length === 0 && !searchMemoryMutation.isPending ? (
                <div className="text-center py-12 text-[var(--ecode-muted)]">
                  <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No memories found</p>
                  <p className="text-[13px] mt-1">Try searching for different keywords</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((node) => (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`p-4 rounded-lg bg-[var(--ecode-sidebar)] hover:bg-[var(--ecode-sidebar-hover)] cursor-pointer transition-colors ${
                        selectedNode?.id === node.id ? 'ring-2 ring-[var(--ecode-accent)]' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {node.type === 'concept' && <Tag className="w-4 h-4 text-blue-500" />}
                          {node.type === 'fact' && <FileText className="w-4 h-4 text-green-500" />}
                          {node.type === 'experience' && <Clock className="w-4 h-4 text-yellow-500" />}
                          {node.type === 'conversation' && <MessageSquare className="w-4 h-4 text-purple-500" />}
                          <Badge variant="outline" className="text-[11px]">
                            {node.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[var(--ecode-muted)]">
                          <Link className="w-3 h-3" />
                          {node.connections} connections
                        </div>
                      </div>
                      <p className="text-[13px] text-[var(--ecode-text)] mb-2">{node.content}</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(node.metadata).slice(0, 3).map(([key, value]) => (
                          <Badge key={key} variant="secondary" className="text-[11px]">
                            {key}: {String(value)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="node-type">Memory Type</Label>
                <select
                  id="node-type"
                  value={newNode.type}
                  onChange={(e) => setNewNode({ ...newNode, type: e.target.value })}
                  className="w-full p-2 rounded-md bg-[var(--ecode-sidebar)] border border-[var(--ecode-border)] text-[var(--ecode-text)]"
                >
                  <option value="concept">Concept</option>
                  <option value="fact">Fact</option>
                  <option value="experience">Experience</option>
                  <option value="conversation">Conversation</option>
                </select>
              </div>
              <div>
                <Label htmlFor="node-content">Content</Label>
                <Textarea
                  id="node-content"
                  placeholder="Enter the memory content..."
                  value={newNode.content}
                  onChange={(e) => setNewNode({ ...newNode, content: e.target.value })}
                  className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)] min-h-[150px]"
                />
              </div>
              <div>
                <Label htmlFor="node-tags">Tags (comma-separated)</Label>
                <Input
                  id="node-tags"
                  placeholder="programming, javascript, react"
                  value={newNode.tags}
                  onChange={(e) => setNewNode({ ...newNode, tags: e.target.value })}
                  className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)]"
                />
              </div>
              <div>
                <Label htmlFor="node-source">Source (optional)</Label>
                <Input
                  id="node-source"
                  placeholder="URL or reference"
                  value={newNode.source}
                  onChange={(e) => setNewNode({ ...newNode, source: e.target.value })}
                  className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)]"
                />
              </div>
              <Button
                onClick={() => createNodeMutation.mutate({
                  type: newNode.type,
                  content: newNode.content,
                  metadata: {
                    tags: newNode.tags.split(',').map(t => t.trim()).filter(Boolean),
                    source: newNode.source || undefined
                  }
                })}
                disabled={!newNode.content || createNodeMutation.isPending}
                className="w-full"
              >
                {createNodeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Create Memory Node
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="conversations" className="space-y-4">
            <ScrollArea className="h-[450px]">
              {conversationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--ecode-muted)]" />
                </div>
              ) : conversations?.length === 0 ? (
                <div className="text-center py-12 text-[var(--ecode-muted)]">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No conversation history</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {conversations?.map((conv) => (
                    <div
                      key={conv.id}
                      className="p-4 rounded-lg bg-[var(--ecode-sidebar)] hover:bg-[var(--ecode-sidebar-hover)] cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-[var(--ecode-text)]">{conv.title}</h4>
                        <Badge variant="outline" className="text-[11px]">
                          {conv.messages} messages
                        </Badge>
                      </div>
                      <p className="text-[13px] text-[var(--ecode-muted)] mb-2 line-clamp-2">
                        {conv.lastMessage}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--ecode-muted)]">
                        <Clock className="w-3 h-3" />
                        {new Date(conv.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="connections" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="from-node">From Node ID</Label>
                <Input
                  id="from-node"
                  placeholder="Enter source node ID"
                  value={newConnection.fromId}
                  onChange={(e) => setNewConnection({ ...newConnection, fromId: e.target.value })}
                  className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)]"
                />
              </div>
              <div>
                <Label htmlFor="to-node">To Node ID</Label>
                <Input
                  id="to-node"
                  placeholder="Enter target node ID"
                  value={newConnection.toId}
                  onChange={(e) => setNewConnection({ ...newConnection, toId: e.target.value })}
                  className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)]"
                />
              </div>
              <div>
                <Label htmlFor="relationship">Relationship</Label>
                <Input
                  id="relationship"
                  placeholder="e.g., 'relates to', 'causes', 'is part of'"
                  value={newConnection.relationship}
                  onChange={(e) => setNewConnection({ ...newConnection, relationship: e.target.value })}
                  className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)]"
                />
              </div>
              <Button
                onClick={() => createEdgeMutation.mutate(newConnection)}
                disabled={!newConnection.fromId || !newConnection.toId || !newConnection.relationship || createEdgeMutation.isPending}
                className="w-full"
              >
                {createEdgeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Link className="w-4 h-4 mr-2" />
                )}
                Create Connection
              </Button>

              {selectedNode && (
                <div className="mt-6 p-4 rounded-lg bg-[var(--ecode-sidebar)] border border-[var(--ecode-border)]">
                  <h4 className="font-medium text-[var(--ecode-text)] mb-2">Selected Node</h4>
                  <p className="text-[13px] text-[var(--ecode-muted)] mb-1">ID: {selectedNode.id}</p>
                  <p className="text-[13px] text-[var(--ecode-text)]">{selectedNode.content}</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}