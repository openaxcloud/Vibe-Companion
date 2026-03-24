import MarketingLayout from "@/components/marketing/MarketingLayout";
import { MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const openings = [
  { title: "Senior Full-Stack Engineer", team: "Engineering", location: "Remote", type: "Full-time" },
  { title: "AI/ML Engineer", team: "AI", location: "Remote", type: "Full-time" },
  { title: "Senior Frontend Engineer", team: "Engineering", location: "Remote", type: "Full-time" },
  { title: "DevOps / Platform Engineer", team: "Infrastructure", location: "Remote", type: "Full-time" },
  { title: "Product Designer", team: "Design", location: "Remote", type: "Full-time" },
  { title: "Developer Advocate", team: "Marketing", location: "Remote", type: "Full-time" },
];

export default function Careers() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="careers-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Join E-Code</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-4">Help us build the future of software development. We're a remote-first team building the most accessible cloud IDE on the planet.</p>
          <p className="text-sm text-[var(--ide-text-muted)]">Remote-first · Competitive equity · Health benefits · Unlimited PTO</p>
        </div>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold mb-6">Open positions</h2>
          <div className="space-y-3">
            {openings.map((job) => (
              <div key={job.title} className="flex items-center justify-between p-5 rounded-xl border border-[var(--ide-border)] hover:border-[#0079F2]/50 bg-[var(--ide-panel)]/50 hover:bg-[var(--ide-panel)] transition-all cursor-pointer group" data-testid={`job-${job.title.toLowerCase().replace(/\s/g, "-")}`}>
                <div>
                  <h3 className="font-semibold mb-1">{job.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-[var(--ide-text-muted)]">
                    <span>{job.team}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.location}</span>
                    <span>{job.type}</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--ide-text-muted)] group-hover:text-[#0079F2] transition-colors" />
              </div>
            ))}
          </div>
          <div className="mt-12 p-8 rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50 text-center">
            <h3 className="text-lg font-bold mb-2">Don't see the right role?</h3>
            <p className="text-sm text-[var(--ide-text-secondary)] mb-4">We're always looking for talented people. Send us your resume and we'll keep you in mind.</p>
            <a href="mailto:careers@e-code.ai"><Button className="bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-general-apply">Send your resume <ArrowRight className="w-4 h-4" /></Button></a>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
