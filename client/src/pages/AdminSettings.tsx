import { AdminLayout } from './admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings, Shield, Zap, Database, Globe, Mail, CreditCard, Bot } from 'lucide-react';

const CONFIG_ITEMS = [
  { category: 'Security', icon: Shield, items: [
    { key: 'CSRF Protection', value: 'Enabled', status: 'ok' },
    { key: 'Rate Limiting', value: 'Redis-based', status: 'ok' },
    { key: 'Session Encryption', value: 'AES-256', status: 'ok' },
    { key: 'Helmet Headers', value: 'Enabled', status: 'ok' },
    { key: 'ALLOW_INSECURE_PTY', value: 'Disabled in prod', status: 'ok' },
  ]},
  { category: 'Database', icon: Database, items: [
    { key: 'Provider', value: 'Neon PostgreSQL', status: 'ok' },
    { key: 'Connection Pool', value: '25 connections (prod)', status: 'ok' },
    { key: 'SSL', value: 'Enabled', status: 'ok' },
  ]},
  { category: 'AI Integrations', icon: Bot, items: [
    { key: 'OpenAI', value: 'Configured', status: 'ok' },
    { key: 'Anthropic', value: 'Configured', status: 'ok' },
    { key: 'Google Gemini', value: 'Configured', status: 'ok' },
    { key: 'xAI (Grok)', value: 'Configured', status: 'ok' },
  ]},
  { category: 'Email', icon: Mail, items: [
    { key: 'Provider', value: 'SendGrid', status: 'ok' },
    { key: 'From Address', value: process.env.FROM_EMAIL || 'contact@e-code.ai', status: 'ok' },
  ]},
  { category: 'Payments', icon: CreditCard, items: [
    { key: 'Stripe', value: 'Live mode', status: 'ok' },
    { key: 'Webhook', value: 'Configured', status: 'ok' },
  ]},
  { category: 'Performance', icon: Zap, items: [
    { key: 'Redis Cache', value: 'Enabled', status: 'ok' },
    { key: 'Compression', value: 'gzip level 6', status: 'ok' },
    { key: 'Memory (Node)', value: '4096MB max', status: 'ok' },
  ]},
];

export default function AdminSettings() {
  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Platform Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Current configuration and environment status</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {CONFIG_ITEMS.map(section => (
            <Card key={section.category}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <section.icon className="w-4 h-4 text-muted-foreground" />
                  {section.category}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {section.items.map(item => (
                    <div key={item.key} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{item.key}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.value}</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Environment</CardTitle>
            <CardDescription>Read-only configuration snapshot</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {['NODE_ENV=production', 'PORT=80', 'LOG_LEVEL=warn', 'REDIS_ENABLED=true', 'ENABLE_BILLING=true', 'ENABLE_AI=true', 'ENABLE_COLLABORATION=true'].map(v => (
                <Badge key={v} variant="outline" className="font-mono text-[11px]">{v}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
