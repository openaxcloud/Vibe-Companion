import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Plus, Trash2, Sparkles } from 'lucide-react';

interface SectionDraft {
  title: string;
  body: string;
  imageUrl: string;
}

interface NewsletterDraft {
  subject: string;
  previewText: string;
  heroImageUrl: string;
  intro: string;
  highlights: string;
  closing: string;
  footerNote: string;
  ctaLabel: string;
  ctaUrl: string;
}

const emptySection: SectionDraft = {
  title: '',
  body: '',
  imageUrl: '',
};

const initialDraft: NewsletterDraft = {
  subject: '',
  previewText: '',
  heroImageUrl: '',
  intro: '',
  highlights: '',
  closing: '',
  footerNote: '',
  ctaLabel: '',
  ctaUrl: '',
};

export default function NewsletterComposer() {
  const { toast } = useToast();
  const [draft, setDraft] = useState<NewsletterDraft>(initialDraft);
  const [sections, setSections] = useState<SectionDraft[]>([emptySection]);
  const [isSending, setIsSending] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  const handleDraftChange = (field: keyof NewsletterDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSectionChange = (index: number, field: keyof SectionDraft, value: string) => {
    setSections((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addSection = () => setSections((prev) => [...prev, emptySection]);

  const removeSection = (index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setDraft(initialDraft);
    setSections([emptySection]);
  };

  const payloadFromDraft = () => {
    const highlightList = draft.highlights
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const normalizedSections = sections
      .map((section) => ({
        title: section.title.trim(),
        body: section.body.trim(),
        imageUrl: section.imageUrl.trim(),
      }))
      .filter((section) => section.title || section.body || section.imageUrl);

    return {
      subject: draft.subject.trim(),
      previewText: draft.previewText.trim(),
      heroImageUrl: draft.heroImageUrl.trim(),
      intro: draft.intro.trim(),
      highlights: highlightList,
      sections: normalizedSections,
      closing: draft.closing.trim(),
      footerNote: draft.footerNote.trim(),
      cta: draft.ctaLabel && draft.ctaUrl ? { label: draft.ctaLabel.trim(), url: draft.ctaUrl.trim() } : undefined,
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = payloadFromDraft();

    if (!payload.subject || !payload.intro) {
      toast({
        title: 'Missing required fields',
        description: 'Subject and introduction are required to send a campaign.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    try {
      const data = await apiRequest('POST', '/api/newsletter/campaigns/send', payload);

      toast({
        title: 'Campaign sent',
        description: data.message || 'Newsletter campaign dispatched successfully.',
      });
      resetForm();
    } catch (error) {
      toast({
        title: 'Network error',
        description: 'We could not reach the newsletter service. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail.trim()) {
      toast({
        title: 'Test email required',
        description: 'Provide an email address to receive the test message.',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    try {
      const data = await apiRequest('POST', '/api/newsletter/test-send', { email: testEmail.trim() });
      toast({
        title: 'Test email dispatched',
        description: data.message || 'Check your inbox for the sample newsletter.',
      });
    } catch (error) {
      toast({
        title: 'Network error',
        description: 'We could not reach the newsletter service. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          Compose Newsletter
        </CardTitle>
        <CardDescription>
          Draft a rich newsletter and deliver it to every confirmed subscriber without touching external tooling.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="subject">Subject line</Label>
              <Input
                id="subject"
                placeholder="Announcing the next release"
                value={draft.subject}
                onChange={(event) => handleDraftChange('subject', event.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="preview">Preview text</Label>
              <Input
                id="preview"
                placeholder="A short snippet that appears in inbox previews"
                value={draft.previewText}
                onChange={(event) => handleDraftChange('previewText', event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="hero">Hero image URL</Label>
              <Input
                id="hero"
                placeholder="https://cdn.example.com/newsletter/hero.png"
                value={draft.heroImageUrl}
                onChange={(event) => handleDraftChange('heroImageUrl', event.target.value)}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="ctaLabel">CTA label</Label>
                <Input
                  id="ctaLabel"
                  placeholder="Explore release notes"
                  value={draft.ctaLabel}
                  onChange={(event) => handleDraftChange('ctaLabel', event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ctaUrl">CTA URL</Label>
                <Input
                  id="ctaUrl"
                  placeholder="https://app.e-code.ai/releases"
                  value={draft.ctaUrl}
                  onChange={(event) => handleDraftChange('ctaUrl', event.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="intro">Introductory message</Label>
            <Textarea
              id="intro"
              placeholder="Set the tone for the announcement..."
              value={draft.intro}
              onChange={(event) => handleDraftChange('intro', event.target.value)}
              rows={4}
              required
            />
          </div>

          <div>
            <Label htmlFor="highlights">Highlights (one per line)</Label>
            <Textarea
              id="highlights"
              placeholder={'Studio upgrades\nAI-assisted reviews\nInfrastructure hardening'}
              value={draft.highlights}
              onChange={(event) => handleDraftChange('highlights', event.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-[13px] font-medium">Content sections</Label>
              <Button type="button" variant="outline" size="sm" onClick={addSection}>
                <Plus className="h-4 w-4 mr-1" />
                Add section
              </Button>
            </div>

            {sections.map((section, index) => (
              <div key={`section-${index}`} className="rounded-lg border p-4 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">Section {index + 1}</Badge>
                  {sections.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSection(index)}
                      aria-label="Remove section"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Section title</Label>
                    <Input
                      placeholder="What changed"
                      value={section.title}
                      onChange={(event) => handleSectionChange(index, 'title', event.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Image URL (optional)</Label>
                    <Input
                      placeholder="https://cdn.example.com/images/update.png"
                      value={section.imageUrl}
                      onChange={(event) => handleSectionChange(index, 'imageUrl', event.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label>Body copy</Label>
                  <Textarea
                    placeholder="Share details, milestones, or guidance for readers..."
                    value={section.body}
                    onChange={(event) => handleSectionChange(index, 'body', event.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="closing">Closing message</Label>
              <Textarea
                id="closing"
                placeholder="Thank readers and suggest next steps..."
                value={draft.closing}
                onChange={(event) => handleDraftChange('closing', event.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="footerNote">Footer note</Label>
              <Textarea
                id="footerNote"
                placeholder="Compliance notes, physical address, or support contact."
                value={draft.footerNote}
                onChange={(event) => handleDraftChange('footerNote', event.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <Input
                placeholder="test@example.com"
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
                className="w-full lg:w-72"
              />
              <Button type="button" variant="outline" onClick={handleSendTest} disabled={isTesting}>
                {isTesting ? 'Sending test...' : 'Send test email'}
              </Button>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={resetForm} disabled={isSending}>
                Reset
              </Button>
              <Button type="submit" disabled={isSending}>
                {isSending ? 'Sending...' : 'Send campaign'}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
