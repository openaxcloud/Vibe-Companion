import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Save, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface CustomPromptsModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface CustomPromptRule {
  id: number;
  name: string;
  description: string;
  prompt: string;
  isActive: boolean;
  createdAt: string;
}

export function CustomPromptsModal({ projectId, isOpen, onClose }: CustomPromptsModalProps) {
  const [editingRule, setEditingRule] = useState<CustomPromptRule | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    prompt: ''
  });
  const { toast } = useToast();

  // Fetch custom prompts for this project
  const { data: customRules = [], isLoading } = useQuery<CustomPromptRule[]>({
    queryKey: ['/api/ai-rules', projectId],
    queryFn: async () => {
      return await apiRequest<CustomPromptRule[]>('GET', `/api/ai-rules/${projectId}`);
    },
    enabled: isOpen,
  });

  // Create new rule
  const createRuleMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest('POST', `/api/ai-rules/${projectId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-rules', projectId] });
      setFormData({ name: '', description: '', prompt: '' });
      setShowAddForm(false);
      toast({
        title: 'Success',
        description: 'Custom prompt rule created successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create custom prompt rule',
        variant: 'destructive',
      });
    },
  });

  // Update existing rule
  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CustomPromptRule> }) => {
      return await apiRequest('PATCH', `/api/ai-rules/${projectId}/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-rules', projectId] });
      setEditingRule(null);
      toast({
        title: 'Success',
        description: 'Custom prompt rule updated successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update custom prompt rule',
        variant: 'destructive',
      });
    },
  });

  // Delete rule
  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: number) => {
      return await apiRequest('DELETE', `/api/ai-rules/${projectId}/${ruleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-rules', projectId] });
      toast({
        title: 'Success',
        description: 'Custom prompt rule deleted successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete custom prompt rule',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.prompt.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Name and prompt are required',
        variant: 'destructive',
      });
      return;
    }
    createRuleMutation.mutate(formData);
  };

  const handleUpdate = (rule: CustomPromptRule) => {
    updateRuleMutation.mutate({
      id: rule.id,
      data: {
        name: rule.name,
        description: rule.description,
        prompt: rule.prompt,
        isActive: rule.isActive,
      },
    });
  };

  const toggleRuleActive = (rule: CustomPromptRule) => {
    updateRuleMutation.mutate({
      id: rule.id,
      data: { isActive: !rule.isActive },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Custom AI Prompt Rules
          </DialogTitle>
          <DialogDescription>
            Define custom instructions and rules for the AI assistant specific to this project
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add New Rule Button */}
          {!showAddForm && (
            <Button
              onClick={() => setShowAddForm(true)}
              className="w-full"
              variant="outline"
              data-testid="button-add-custom-rule"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Custom Rule
            </Button>
          )}

          {/* Add/Edit Form */}
          {showAddForm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">New Custom Rule</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Rule Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Code Style Preferences"
                      data-testid="input-rule-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of this rule"
                      data-testid="input-rule-description"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prompt">Custom Prompt</Label>
                    <Textarea
                      id="prompt"
                      value={formData.prompt}
                      onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                      placeholder="Enter custom instructions for the AI..."
                      className="min-h-[120px] font-mono text-[13px]"
                      data-testid="textarea-rule-prompt"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={createRuleMutation.isPending}
                      data-testid="button-save-rule"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {createRuleMutation.isPending ? 'Saving...' : 'Save Rule'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowAddForm(false);
                        setFormData({ name: '', description: '', prompt: '' });
                      }}
                      data-testid="button-cancel-add"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Existing Rules List */}
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading custom rules...
                </div>
              ) : customRules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No custom rules yet. Add one to get started!
                </div>
              ) : (
                customRules.map((rule) => (
                  <Card
                    key={rule.id}
                    className={rule.isActive ? 'border-primary' : ''}
                    data-testid={`card-rule-${rule.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {editingRule?.id === rule.id ? (
                            <Input
                              value={editingRule.name}
                              onChange={(e) =>
                                setEditingRule({ ...editingRule, name: e.target.value })
                              }
                              className="font-semibold"
                              data-testid="input-edit-rule-name"
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{rule.name}</h4>
                              {rule.isActive && (
                                <Badge variant="default" className="text-[11px]">
                                  Active
                                </Badge>
                              )}
                            </div>
                          )}
                          {rule.description && !editingRule && (
                            <p className="text-[13px] text-muted-foreground mt-1">
                              {rule.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => toggleRuleActive(rule)}
                            data-testid={`button-toggle-${rule.id}`}
                          >
                            {rule.isActive ? '✓' : '○'}
                          </Button>
                          {editingRule?.id === rule.id ? (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleUpdate(editingRule)}
                                data-testid="button-save-edit"
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEditingRule(null)}
                                data-testid="button-cancel-edit"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEditingRule(rule)}
                                data-testid={`button-edit-${rule.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteRuleMutation.mutate(rule.id)}
                                data-testid={`button-delete-${rule.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {editingRule?.id === rule.id ? (
                        <Textarea
                          value={editingRule.prompt}
                          onChange={(e) =>
                            setEditingRule({ ...editingRule, prompt: e.target.value })
                          }
                          className="min-h-[100px] font-mono text-[13px]"
                          data-testid="textarea-edit-prompt"
                        />
                      ) : (
                        <pre className="text-[13px] font-mono bg-muted/50 p-3 rounded whitespace-pre-wrap">
                          {rule.prompt}
                        </pre>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
