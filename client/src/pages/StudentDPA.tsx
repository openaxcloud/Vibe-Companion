import MarketingLayout from "@/components/marketing/MarketingLayout";

export default function StudentDPA() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="student-dpa-hero">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-8">Student Data Processing Agreement</h1>
          <div className="prose prose-invert max-w-none space-y-6 text-[var(--ide-text-secondary)] leading-relaxed">
            <p><strong className="text-[var(--ide-text)]">Last updated:</strong> January 1, 2025</p>
            <p>This Student Data Processing Agreement ("Student DPA") supplements our standard DPA with additional protections specific to student data in educational settings.</p>
            <h2 className="text-xl font-bold text-[var(--ide-text)] mt-8">1. FERPA Compliance</h2>
            <p>E-Code acts as a "school official" under FERPA and processes student education records solely for the purpose of providing the educational services described in the agreement with the educational institution.</p>
            <h2 className="text-xl font-bold text-[var(--ide-text)] mt-8">2. COPPA Compliance</h2>
            <p>For students under 13, E-Code collects only the minimum information necessary to provide the service. Parental consent is obtained through the educational institution acting as the parent's agent.</p>
            <h2 className="text-xl font-bold text-[var(--ide-text)] mt-8">3. Data Minimization</h2>
            <p>E-Code collects and retains only the data necessary to provide educational services. Student data is not used for advertising, marketing, or building user profiles.</p>
            <h2 className="text-xl font-bold text-[var(--ide-text)] mt-8">4. Data Retention</h2>
            <p>Student data is retained only for the duration of the agreement with the educational institution. Upon termination, all student data is deleted within 30 days.</p>
            <h2 className="text-xl font-bold text-[var(--ide-text)] mt-8">5. Contact</h2>
            <p>For questions about student data privacy, contact <a href="mailto:education@e-code.ai" className="text-[#0079F2] hover:underline">education@e-code.ai</a>.</p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
