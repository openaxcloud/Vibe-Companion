// @ts-nocheck
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  ShieldCheck, Mail, Chrome, Github, MessageSquare, Apple,
  Users, Code2, Copy, Check, ChevronRight, Zap, Globe, Lock
} from 'lucide-react';

interface AuthConfig {
  projectId: number;
  enabled: boolean;
  providers: string[];
  allowedDomains: string[];
  requireVerifiedEmail: boolean;
  loginRedirectUrl: string | null;
}

interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  avatar: string | null;
  provider: string;
  lastSignIn: string | null;
  createdAt: string;
}

const PROVIDERS = [
  { id: 'email', label: 'Email / Password', icon: Mail, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { id: 'google', label: 'Google', icon: Chrome, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  { id: 'github', label: 'GitHub', icon: Github, color: 'text-gray-300', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
  { id: 'discord', label: 'Discord', icon: MessageSquare, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  { id: 'apple', label: 'Apple', icon: Apple, color: 'text-gray-200', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
];

const CODE_SNIPPET_NODE = `const express = require('express');
const app = express();

// Check if user is authenticated
app.get('/api/me', (req, res) => {
  const userId = req.headers['x-replit-user-id'];
  const userName = req.headers['x-replit-user-name'];
  
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  res.json({ id: userId, name: userName });
});`;

const CODE_SNIPPET_PYTHON = `from flask import Flask, request, jsonify
app = Flask(__name__)

@app.route('/api/me')
def get_user():
    user_id = request.headers.get('X-Replit-User-Id')
    user_name = request.headers.get('X-Replit-User-Name')
    
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    return jsonify({'id': user_id, 'name': user_name})`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors">
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function ProviderIcon({ provider }: { provider: string }) {
  const p = PROVIDERS.find(p => p.id === provider);
  if (!p) return <Globe size={14} className="text-gray-400" />;
  return <p.icon size={14} className={p.color} />;
}

export function ReplitAuthPanel({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const numericProjectId = parseInt(projectId, 10);

  const { data: config, isLoading } = useQuery<AuthConfig>({
    queryKey: ['/api/project-auth', projectId, 'config'],
    queryFn: () => apiRequest('GET', `/api/project-auth/${projectId}/config`),
  });

  const { data: usersData } = useQuery<{ users: AuthUser[]; total: number }>({
    queryKey: ['/api/project-auth', projectId, 'users'],
    queryFn: () => apiRequest('GET', `/api/project-auth/${projectId}/users`),
    enabled: config?.enabled,
  });

  const updateConfig = useMutation({
    mutationFn: (updates: Partial<AuthConfig>) =>
      apiRequest('PUT', `/api/project-auth/${projectId}/config`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-auth', projectId, 'config'] });
    },
    onError: () => toast({ title: 'Failed to update auth settings', variant: 'destructive' }),
  });

  const deleteUser = useMutation({
    mutationFn: (userId: number) =>
      apiRequest('DELETE', `/api/project-auth/${projectId}/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-auth', projectId, 'users'] });
      toast({ title: 'User removed' });
    },
  });

  const toggleEnabled = (enabled: boolean) => {
    updateConfig.mutate({ ...config, enabled });
  };

  const toggleProvider = (providerId: string) => {
    if (!config) return;
    const current = config.providers || [];
    const next = current.includes(providerId)
      ? current.filter(p => p !== providerId)
      : [...current, providerId];
    if (next.length === 0) return;
    updateConfig.mutate({ ...config, providers: next });
  };

  const loginPageUrl = `${window.location.origin}/api/project-auth/${projectId}/login`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-gray-500">Loading auth settings...</div>
      </div>
    );
  }

  const users = usersData?.users || [];

  return (
    <div className="h-full flex flex-col bg-[#0d1117] text-gray-200 overflow-y-auto">
      <div className="flex-1 px-4 py-4 space-y-4">

        {/* Header toggle card */}
        <div className="rounded-lg border border-white/8 bg-white/4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 rounded-lg bg-blue-500/15 border border-blue-500/20">
                <ShieldCheck size={18} className="text-blue-400" />
              </div>
              <div>
                <div className="font-semibold text-white text-sm">Authentication</div>
                <div className="text-xs text-gray-400 mt-0.5 leading-relaxed max-w-xs">
                  Let users sign in to your app using a prebuilt login page. E-Code injects user info into request headers.
                </div>
              </div>
            </div>
            <Switch
              checked={config?.enabled || false}
              onCheckedChange={toggleEnabled}
              disabled={updateConfig.isPending}
            />
          </div>

          {config?.enabled && (
            <div className="mt-3 pt-3 border-t border-white/8">
              <div className="text-xs text-gray-400 mb-1.5">Login page URL</div>
              <div className="flex items-center gap-2 bg-black/30 rounded px-2.5 py-1.5 border border-white/8">
                <Globe size={12} className="text-gray-500 shrink-0" />
                <span className="text-xs text-gray-300 font-mono truncate flex-1">{loginPageUrl}</span>
                <CopyButton text={loginPageUrl} />
              </div>
            </div>
          )}
        </div>

        {/* How it works — shown when disabled */}
        {!config?.enabled && (
          <div className="rounded-lg border border-white/8 bg-white/2 p-4 space-y-3">
            <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider">How it works</div>
            {[
              { icon: Lock, text: 'Enable auth to get a prebuilt login page for your app' },
              { icon: Users, text: 'Your users sign in with email, Google, GitHub, or Discord' },
              { icon: Code2, text: 'User info is injected as HTTP request headers in your app' },
              { icon: Zap, text: 'No backend code required — works with any language' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-2.5">
                <Icon size={13} className="text-blue-400 mt-0.5 shrink-0" />
                <span className="text-xs text-gray-400">{text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Providers */}
        {config?.enabled && (
          <div className="rounded-lg border border-white/8 bg-white/4 p-4">
            <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Sign-in Providers</div>
            <div className="space-y-2">
              {PROVIDERS.map(provider => {
                const enabled = config.providers?.includes(provider.id);
                return (
                  <div
                    key={provider.id}
                    className={`flex items-center justify-between rounded-md px-3 py-2.5 border transition-colors cursor-pointer ${
                      enabled ? `${provider.bg} ${provider.border}` : 'bg-white/2 border-white/8 hover:bg-white/4'
                    }`}
                    onClick={() => toggleProvider(provider.id)}
                  >
                    <div className="flex items-center gap-2.5">
                      <provider.icon size={15} className={enabled ? provider.color : 'text-gray-500'} />
                      <span className={`text-sm ${enabled ? 'text-white' : 'text-gray-400'}`}>{provider.label}</span>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => toggleProvider(provider.id)}
                      disabled={updateConfig.isPending}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Users table */}
        {config?.enabled && (
          <div className="rounded-lg border border-white/8 bg-white/4 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Users</div>
              <Badge variant="secondary" className="text-xs bg-white/8 text-gray-400 border-white/10">
                {users.length}
              </Badge>
            </div>

            {users.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center gap-2">
                <Users size={24} className="text-gray-600" />
                <p className="text-xs text-gray-500">No users yet.<br />Share your login page link to get started.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {users.map(user => (
                  <div key={user.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-white/4 group">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs bg-blue-500/20 text-blue-300">
                        {(user.name || user.email).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white truncate">{user.name || user.email}</div>
                      {user.name && <div className="text-xs text-gray-500 truncate">{user.email}</div>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <ProviderIcon provider={user.provider} />
                      <button
                        onClick={() => deleteUser.mutate(user.id)}
                        className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 transition-opacity"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Code snippets */}
        {config?.enabled && (
          <div className="rounded-lg border border-white/8 bg-white/4 p-4">
            <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Integration Code</div>
            <Tabs defaultValue="node">
              <TabsList className="bg-white/6 border border-white/10 h-7 mb-3">
                <TabsTrigger value="node" className="text-xs h-5 px-2.5 data-[state=active]:bg-white/10">Node.js</TabsTrigger>
                <TabsTrigger value="python" className="text-xs h-5 px-2.5 data-[state=active]:bg-white/10">Python</TabsTrigger>
              </TabsList>
              {[{ value: 'node', code: CODE_SNIPPET_NODE }, { value: 'python', code: CODE_SNIPPET_PYTHON }].map(({ value, code }) => (
                <TabsContent key={value} value={value}>
                  <div className="relative rounded-md bg-black/40 border border-white/8 overflow-hidden">
                    <div className="absolute top-2 right-2">
                      <CopyButton text={code} />
                    </div>
                    <pre className="p-3 text-xs text-gray-300 font-mono overflow-x-auto leading-relaxed">
                      <code>{code}</code>
                    </pre>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Available headers: <code className="text-blue-400">X-Replit-User-Id</code>, <code className="text-blue-400">X-Replit-User-Name</code>, <code className="text-blue-400">X-Replit-User-Email</code>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}

        {/* Docs link */}
        <a
          href="https://docs.replit.com/hosting/deployments/replit-auth"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-white/8 bg-white/2 hover:bg-white/4 transition-colors group"
        >
          <div className="flex items-center gap-2.5">
            <Code2 size={14} className="text-gray-400" />
            <span className="text-xs text-gray-400">Auth documentation</span>
          </div>
          <ChevronRight size={13} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
        </a>

      </div>
    </div>
  );
}
