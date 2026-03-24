import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight, Gamepad2, Sparkles, Globe, Users, Layers, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Gamepad2, title: "Web game frameworks", desc: "Full support for Phaser, Three.js, Babylon.js, PixiJS, and other popular game engines.", color: "#7C65CB" },
  { icon: Sparkles, title: "AI game logic", desc: "Use the AI agent to generate game mechanics, level design, physics, and AI opponents.", color: "#0079F2" },
  { icon: Globe, title: "Instant playtesting", desc: "See your game running live as you code. Share a URL for instant playtesting.", color: "#0CCE6B" },
  { icon: Users, title: "Multiplayer support", desc: "Build multiplayer games with WebSocket support and real-time state synchronization.", color: "#F26522" },
  { icon: Layers, title: "Asset management", desc: "Upload and manage sprites, sounds, and 3D models directly in the IDE.", color: "#0079F2" },
  { icon: Zap, title: "Fast iteration", desc: "Hot reloading and instant preview mean you can iterate on gameplay in real time.", color: "#7C65CB" },
];

export default function GameBuilder() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="game-builder-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#7C65CB]/10 border border-[#7C65CB]/20 text-[#7C65CB] text-xs font-medium mb-6">Solutions</div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Build games in the cloud</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-10">Create, test, and publish browser games with AI assistance, real-time preview, and instant sharing.</p>
          <Link href="/login"><Button className="h-12 px-8 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-game">Start building <ArrowRight className="w-4 h-4" /></Button></Link>
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="p-6 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${f.color}15`, border: `1px solid ${f.color}30` }}>
                <f.icon className="w-5 h-5" style={{ color: f.color }} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-[var(--ide-text-secondary)] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
