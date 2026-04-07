import { useState } from 'react';
import { LazyMotionDiv } from '@/lib/motion';
import { Badge } from '@/components/ui/badge';
import { 
  FolderTree, Code, Terminal, Monitor, Bot, Rocket,
  ChevronRight
} from 'lucide-react';

const showcaseFeatures = [
  {
    id: 'file-explorer',
    title: 'File Explorer',
    description: 'Navigate your project with a familiar tree view. Drag & drop, multi-select, and search across files instantly.',
    icon: <FolderTree className="h-6 w-6" />,
    preview: (
      <div className="space-y-2 text-left">
        <div className="flex items-center gap-2 text-sm text-foreground/80">
          <FolderTree className="h-4 w-4 text-ecode-accent" />
          <span className="font-medium">my-project</span>
        </div>
        {['src/', '  App.tsx', '  index.css', '  main.ts', 'package.json', 'tsconfig.json'].map((file, i) => (
          <div key={i} className={`flex items-center gap-2 text-xs py-1 px-2 rounded ${i === 1 ? 'bg-ecode-accent/10 text-ecode-accent' : 'text-muted-foreground'}`}
            style={{ paddingLeft: `${(file.match(/^\s*/)?.[0].length || 0) * 8 + 8}px` }}>
            {file.includes('/') ? <FolderTree className="h-3 w-3" /> : <Code className="h-3 w-3" />}
            <span>{file.trim()}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'code-editor',
    title: 'Code Editor',
    description: 'Monaco-powered editor with IntelliSense, multi-cursor, syntax highlighting for 50+ languages, and real-time error checking.',
    icon: <Code className="h-6 w-6" />,
    preview: (
      <div className="text-left font-mono text-xs space-y-0.5">
        <div><span className="text-purple-400">import</span> <span className="text-cyan-400">React</span> <span className="text-purple-400">from</span> <span className="text-green-400">'react'</span>;</div>
        <div className="h-1" />
        <div><span className="text-purple-400">export default function</span> <span className="text-yellow-400">App</span>() {'{'}</div>
        <div className="pl-4"><span className="text-purple-400">return</span> (</div>
        <div className="pl-8 bg-ecode-accent/10 rounded">&lt;<span className="text-cyan-400">div</span> <span className="text-yellow-400">className</span>=<span className="text-green-400">"app"</span>&gt;</div>
        <div className="pl-12">&lt;<span className="text-cyan-400">h1</span>&gt;Hello World&lt;/<span className="text-cyan-400">h1</span>&gt;</div>
        <div className="pl-8">&lt;/<span className="text-cyan-400">div</span>&gt;</div>
        <div className="pl-4">);</div>
        <div>{'}'}</div>
      </div>
    ),
  },
  {
    id: 'terminal',
    title: 'Integrated Shell',
    description: 'Full terminal access with bash support, command history, multiple sessions, and built-in package management.',
    icon: <Terminal className="h-6 w-6" />,
    preview: (
      <div className="text-left font-mono text-xs space-y-1 bg-gray-950 rounded-lg p-3">
        <div><span className="text-green-400">$</span> <span className="text-foreground/80">npm install</span></div>
        <div className="text-muted-foreground">added 127 packages in 3.2s</div>
        <div><span className="text-green-400">$</span> <span className="text-foreground/80">npm run dev</span></div>
        <div className="text-cyan-400">VITE v5.0.0  ready in 231ms</div>
        <div className="text-muted-foreground">  Local:   http://localhost:5173/</div>
        <div className="text-green-400 animate-pulse">  Server running...</div>
      </div>
    ),
  },
  {
    id: 'preview',
    title: 'Live Preview',
    description: 'Instant preview of your application with hot reload. Test responsive layouts across devices without leaving the IDE.',
    icon: <Monitor className="h-6 w-6" />,
    preview: (
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-muted/50 px-3 py-1.5 flex items-center gap-2 border-b border-border">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 bg-background rounded px-2 py-0.5 text-[10px] text-muted-foreground text-center">
            localhost:5173
          </div>
        </div>
        <div className="p-4 bg-background space-y-2">
          <div className="h-3 w-24 bg-ecode-accent/20 rounded" />
          <div className="h-2 w-full bg-muted rounded" />
          <div className="h-2 w-3/4 bg-muted rounded" />
          <div className="h-8 w-20 bg-ecode-accent/30 rounded mt-3" />
        </div>
      </div>
    ),
  },
  {
    id: 'ai-agent',
    title: 'AI Agent',
    description: 'Your AI pair programmer understands context, generates production code, fixes bugs, and helps you ship faster.',
    icon: <Bot className="h-6 w-6" />,
    preview: (
      <div className="space-y-3 text-left">
        <div className="flex gap-2">
          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px]">U</div>
          <div className="flex-1 bg-muted/50 rounded-lg p-2 text-xs text-muted-foreground">Add a dark mode toggle</div>
        </div>
        <div className="flex gap-2">
          <div className="w-6 h-6 rounded-full bg-ecode-accent/20 flex items-center justify-center">
            <Bot className="h-3 w-3 text-ecode-accent" />
          </div>
          <div className="flex-1 bg-ecode-accent/5 border border-ecode-accent/10 rounded-lg p-2 text-xs text-muted-foreground">
            I'll add a theme toggle using your existing ThemeProvider...
            <div className="mt-1 font-mono text-[10px] bg-background rounded p-1 text-green-400">
              + const [theme, setTheme] = useState('dark');
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'deploy',
    title: 'One-Click Deploy',
    description: 'Deploy to production in seconds with automatic SSL, CDN, and global edge distribution. Zero configuration needed.',
    icon: <Rocket className="h-6 w-6" />,
    preview: (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-green-400 font-medium">Deployed Successfully</span>
        </div>
        <div className="text-left space-y-2 text-xs text-muted-foreground">
          <div className="flex justify-between"><span>URL:</span><span className="text-foreground">myapp.e-code.app</span></div>
          <div className="flex justify-between"><span>SSL:</span><span className="text-green-400">Active</span></div>
          <div className="flex justify-between"><span>Regions:</span><span className="text-foreground">200+ edges</span></div>
          <div className="flex justify-between"><span>Build time:</span><span className="text-foreground">2.3s</span></div>
        </div>
      </div>
    ),
  },
];

export function IDEFeatureShowcase() {
  const [activeFeature, setActiveFeature] = useState(0);
  const feature = showcaseFeatures[activeFeature];

  return (
    <section
      className="py-20 bg-gradient-to-b from-[var(--ecode-background)] to-[var(--ecode-surface-tertiary)]"
      data-testid="section-ide-showcase"
    >
      <div className="container-responsive max-w-7xl">
        <LazyMotionDiv
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Badge variant="outline" className="mb-4 text-ecode-accent border-ecode-accent/20 bg-ecode-accent/5">
            Interactive IDE Preview
          </Badge>
          <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-[var(--ecode-text)]">
            Explore the IDE Before You Sign Up
          </h2>
          <p className="text-xl text-[var(--ecode-text-muted)] max-w-3xl mx-auto">
            See exactly what you get. Click each panel to explore the full development experience.
          </p>
        </LazyMotionDiv>

        <div className="grid lg:grid-cols-5 gap-6 items-start">
          <div className="lg:col-span-2 space-y-2" data-testid="showcase-feature-list">
            {showcaseFeatures.map((f, index) => (
              <button
                key={f.id}
                onClick={() => setActiveFeature(index)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-300 flex items-center gap-4 min-h-[64px] group ${
                  index === activeFeature
                    ? 'border-ecode-accent/40 bg-ecode-accent/5 shadow-[0_4px_16px_-4px_rgba(242,98,7,0.15)]'
                    : 'border-[var(--ecode-border)] bg-[var(--ecode-surface)] hover:border-ecode-accent/20'
                }`}
                data-testid={`button-showcase-${f.id}`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  index === activeFeature
                    ? 'bg-ecode-accent text-white'
                    : 'bg-muted text-muted-foreground group-hover:text-ecode-accent'
                }`}>
                  {f.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`text-sm font-semibold transition-colors ${
                    index === activeFeature ? 'text-ecode-accent' : 'text-[var(--ecode-text)]'
                  }`}>
                    {f.title}
                  </h4>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {f.description}
                  </p>
                </div>
                <ChevronRight className={`h-4 w-4 flex-shrink-0 transition-all duration-300 ${
                  index === activeFeature ? 'text-ecode-accent translate-x-0.5' : 'text-muted-foreground/30'
                }`} />
              </button>
            ))}
          </div>

          <div className="lg:col-span-3" data-testid="showcase-preview-panel">
            <LazyMotionDiv
              key={feature.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="border border-[var(--ecode-border)] bg-[var(--ecode-surface)] rounded-2xl overflow-hidden shadow-[0_8px_32px_-8px_rgba(242,98,7,0.15)]"
            >
              <div className="bg-muted/30 border-b border-border px-4 py-2.5 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
                  <div className="w-3 h-3 rounded-full bg-green-400/60" />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{feature.title}</span>
                  <span>- E-Code IDE</span>
                </div>
              </div>

              <div className="p-6 min-h-[280px] flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-ecode-orange/15 to-ecode-yellow/15 flex items-center justify-center text-ecode-accent">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>

                <div className="flex-1 bg-background rounded-lg p-4 border border-border">
                  {feature.preview}
                </div>
              </div>
            </LazyMotionDiv>
          </div>
        </div>
      </div>
    </section>
  );
}
