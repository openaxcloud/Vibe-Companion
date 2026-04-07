import { useState } from 'react';
import { 
  ChevronDown, ChevronRight, Check, Package, Code2, 
  Globe, Smartphone, Brain, Database, Shield, DollarSign,
  Award, Users, Zap
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface TemplateFiltersProps {
  categories: any[];
  tags: any[];
  selectedCategory: string;
  selectedTags: string[];
  selectedLanguages: string[];
  selectedDifficulty: string[];
  priceRange: [number, number];
  onCategoryChange: (category: string) => void;
  onTagsChange: (tags: string[]) => void;
  onLanguagesChange: (languages: string[]) => void;
  onDifficultyChange: (difficulty: string[]) => void;
  onPriceRangeChange: (range: [number, number]) => void;
}

export function TemplateFilters({
  categories,
  tags,
  selectedCategory,
  selectedTags,
  selectedLanguages,
  selectedDifficulty,
  priceRange,
  onCategoryChange,
  onTagsChange,
  onLanguagesChange,
  onDifficultyChange,
  onPriceRangeChange,
}: TemplateFiltersProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'category',
    'languages',
    'difficulty',
  ]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const languages = [
    { value: 'javascript', label: 'JavaScript', count: 245 },
    { value: 'typescript', label: 'TypeScript', count: 189 },
    { value: 'python', label: 'Python', count: 156 },
    { value: 'java', label: 'Java', count: 98 },
    { value: 'go', label: 'Go', count: 87 },
    { value: 'rust', label: 'Rust', count: 45 },
    { value: 'csharp', label: 'C#', count: 67 },
    { value: 'php', label: 'PHP', count: 54 },
    { value: 'ruby', label: 'Ruby', count: 34 },
    { value: 'swift', label: 'Swift', count: 29 },
  ];

  const frameworks = [
    { value: 'react', label: 'React', count: 178 },
    { value: 'nextjs', label: 'Next.js', count: 145 },
    { value: 'vue', label: 'Vue.js', count: 89 },
    { value: 'angular', label: 'Angular', count: 67 },
    { value: 'express', label: 'Express', count: 98 },
    { value: 'django', label: 'Django', count: 56 },
    { value: 'flask', label: 'Flask', count: 43 },
    { value: 'spring', label: 'Spring Boot', count: 78 },
    { value: 'laravel', label: 'Laravel', count: 45 },
    { value: 'rails', label: 'Rails', count: 34 },
  ];

  const difficulties = [
    { value: 'beginner', label: 'Beginner', icon: Award, color: 'text-green-500' },
    { value: 'intermediate', label: 'Intermediate', icon: Zap, color: 'text-yellow-500' },
    { value: 'advanced', label: 'Advanced', icon: Brain, color: 'text-red-500' },
    { value: 'expert', label: 'Expert', icon: Shield, color: 'text-purple-500' },
  ];

  const licenses = [
    { value: 'mit', label: 'MIT License' },
    { value: 'apache', label: 'Apache 2.0' },
    { value: 'gpl', label: 'GPL' },
    { value: 'bsd', label: 'BSD' },
    { value: 'proprietary', label: 'Proprietary' },
  ];

  const categoryIcons: Record<string, any> = {
    web: Globe,
    api: Database,
    mobile: Smartphone,
    'ml-ai': Brain,
    security: Shield,
    enterprise: Package,
    starter: Code2,
  };

  return (
    <div className="space-y-4" data-testid="template-filters">
      {/* Category Filter */}
      <Collapsible open={expandedSections.includes('category')}>
        <CollapsibleTrigger
          onClick={() => toggleSection('category')}
          className="flex w-full items-center justify-between py-2 text-[13px] font-medium hover:text-foreground"
          data-testid="filter-category-toggle"
        >
          <span>Category</span>
          {expandedSections.includes('category') ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <RadioGroup value={selectedCategory} onValueChange={onCategoryChange}>
            <div className="flex items-center space-x-2 mb-2">
              <RadioGroupItem value="all" id="cat-all" />
              <Label htmlFor="cat-all" className="cursor-pointer">
                All Categories
              </Label>
            </div>
            {categories?.map((category) => {
              const Icon = categoryIcons[category.slug] || Package;
              return (
                <div key={category.id} className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value={category.slug} id={`cat-${category.slug}`} />
                  <Label
                    htmlFor={`cat-${category.slug}`}
                    className="cursor-pointer flex items-center gap-2"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {category.name}
                    <Badge variant="secondary" className="ml-auto">
                      {category.count || 0}
                    </Badge>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Language Filter */}
      <Collapsible open={expandedSections.includes('languages')}>
        <CollapsibleTrigger
          onClick={() => toggleSection('languages')}
          className="flex w-full items-center justify-between py-2 text-[13px] font-medium hover:text-foreground"
          data-testid="filter-languages-toggle"
        >
          <span>Languages</span>
          {selectedLanguages.length > 0 && (
            <Badge variant="secondary" className="mr-2">
              {selectedLanguages.length}
            </Badge>
          )}
          {expandedSections.includes('languages') ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <ScrollArea className="h-[200px]">
            {languages.map((lang) => (
              <div key={lang.value} className="flex items-center space-x-2 mb-2">
                <Checkbox
                  id={`lang-${lang.value}`}
                  checked={selectedLanguages.includes(lang.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onLanguagesChange([...selectedLanguages, lang.value]);
                    } else {
                      onLanguagesChange(selectedLanguages.filter(l => l !== lang.value));
                    }
                  }}
                />
                <Label
                  htmlFor={`lang-${lang.value}`}
                  className="cursor-pointer flex items-center justify-between flex-1"
                >
                  {lang.label}
                  <span className="text-[11px] text-muted-foreground">
                    {lang.count}
                  </span>
                </Label>
              </div>
            ))}
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Framework Filter */}
      <Collapsible open={expandedSections.includes('frameworks')}>
        <CollapsibleTrigger
          onClick={() => toggleSection('frameworks')}
          className="flex w-full items-center justify-between py-2 text-[13px] font-medium hover:text-foreground"
        >
          <span>Frameworks</span>
          {expandedSections.includes('frameworks') ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <ScrollArea className="h-[200px]">
            {frameworks.map((framework) => (
              <div key={framework.value} className="flex items-center space-x-2 mb-2">
                <Checkbox
                  id={`framework-${framework.value}`}
                  checked={selectedTags.includes(framework.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onTagsChange([...selectedTags, framework.value]);
                    } else {
                      onTagsChange(selectedTags.filter(t => t !== framework.value));
                    }
                  }}
                />
                <Label
                  htmlFor={`framework-${framework.value}`}
                  className="cursor-pointer flex items-center justify-between flex-1"
                >
                  {framework.label}
                  <span className="text-[11px] text-muted-foreground">
                    {framework.count}
                  </span>
                </Label>
              </div>
            ))}
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Difficulty Filter */}
      <Collapsible open={expandedSections.includes('difficulty')}>
        <CollapsibleTrigger
          onClick={() => toggleSection('difficulty')}
          className="flex w-full items-center justify-between py-2 text-[13px] font-medium hover:text-foreground"
        >
          <span>Difficulty</span>
          {selectedDifficulty.length > 0 && (
            <Badge variant="secondary" className="mr-2">
              {selectedDifficulty.length}
            </Badge>
          )}
          {expandedSections.includes('difficulty') ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          {difficulties.map((diff) => {
            const Icon = diff.icon;
            return (
              <div key={diff.value} className="flex items-center space-x-2 mb-2">
                <Checkbox
                  id={`diff-${diff.value}`}
                  checked={selectedDifficulty.includes(diff.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onDifficultyChange([...selectedDifficulty, diff.value]);
                    } else {
                      onDifficultyChange(selectedDifficulty.filter(d => d !== diff.value));
                    }
                  }}
                />
                <Label
                  htmlFor={`diff-${diff.value}`}
                  className="cursor-pointer flex items-center gap-2"
                >
                  <Icon className={cn("h-4 w-4", diff.color)} />
                  {diff.label}
                </Label>
              </div>
            );
          })}
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Price Range Filter */}
      <Collapsible open={expandedSections.includes('price')}>
        <CollapsibleTrigger
          onClick={() => toggleSection('price')}
          className="flex w-full items-center justify-between py-2 text-[13px] font-medium hover:text-foreground"
        >
          <span>Price Range</span>
          {expandedSections.includes('price') ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[13px]">
              <span>Free</span>
              <span className="font-medium">
                ${priceRange[1] === 100 ? '100+' : priceRange[1]}
              </span>
            </div>
            <Slider
              value={priceRange}
              onValueChange={(value) => onPriceRangeChange([0, value[1]])}
              min={0}
              max={100}
              step={10}
              className="w-full"
            />
            <div className="flex gap-2">
              <Button
                variant={priceRange[1] === 0 ? "default" : "outline"}
                size="sm"
                onClick={() => onPriceRangeChange([0, 0])}
              >
                Free Only
              </Button>
              <Button
                variant={priceRange[1] > 0 && priceRange[1] < 100 ? "default" : "outline"}
                size="sm"
                onClick={() => onPriceRangeChange([0, 50])}
              >
                Under $50
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPriceRangeChange([0, 100])}
              >
                All
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Popular Tags */}
      <div className="pt-2">
        <p className="text-[13px] font-medium mb-3">Popular Tags</p>
        <div className="flex flex-wrap gap-2">
          {tags?.slice(0, 10).map((tag) => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => {
                if (selectedTags.includes(tag)) {
                  onTagsChange(selectedTags.filter(t => t !== tag));
                } else {
                  onTagsChange([...selectedTags, tag]);
                }
              }}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}