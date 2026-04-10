import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
  MousePointer2,
  Type,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Save,
  X,
  Pipette,
  Square,
  Move,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ElementSelection {
  elementId: string;
  tagName: string;
  text?: string;
  styles: {
    color?: string;
    backgroundColor?: string;
    fontSize?: string;
    fontWeight?: string;
    textAlign?: string;
    padding?: string;
    margin?: string;
  };
  path: string;
  canEditDirectly: boolean;
}

interface ElementEditorProps {
  isActive: boolean;
  onToggle: () => void;
  selectedElement: ElementSelection | null;
  onSave: (changes: Partial<ElementSelection['styles']> & { text?: string }) => void;
  onCancel: () => void;
  className?: string;
}

export function ElementEditor({
  isActive,
  onToggle,
  selectedElement,
  onSave,
  onCancel,
  className
}: ElementEditorProps) {
  const [editedText, setEditedText] = useState('');
  const [editedStyles, setEditedStyles] = useState<Partial<ElementSelection['styles']>>({});
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'bg' | null>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedElement) {
      setEditedText(selectedElement.text || '');
      setEditedStyles({});
    }
  }, [selectedElement]);

  const handleStyleChange = useCallback((key: keyof ElementSelection['styles'], value: string) => {
    setEditedStyles(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(() => {
    const changes: Partial<ElementSelection['styles']> & { text?: string } = {
      ...editedStyles,
    };
    if (editedText !== selectedElement?.text) {
      changes.text = editedText;
    }
    onSave(changes);
  }, [editedStyles, editedText, selectedElement, onSave]);

  const currentColor = editedStyles.color || selectedElement?.styles.color || '#000000';
  const currentBgColor = editedStyles.backgroundColor || selectedElement?.styles.backgroundColor || '#ffffff';
  const currentAlign = editedStyles.textAlign || selectedElement?.styles.textAlign || 'left';
  const currentWeight = editedStyles.fontWeight || selectedElement?.styles.fontWeight || 'normal';

  const presetColors = [
    '#000000', '#374151', '#6b7280', '#9ca3af',
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff',
  ];

  return (
    <div className={cn("", className)}>
      {/* Element Editor Toggle Button */}
      <Button
        variant={isActive ? "default" : "outline"}
        size="sm"
        onClick={onToggle}
        className={cn(
          "h-8 gap-1.5",
          isActive && "bg-purple-600 hover:bg-purple-700 text-white"
        )}
        data-testid="element-editor-toggle"
      >
        <MousePointer2 className="w-3.5 h-3.5" />
        <span className="text-[11px] font-medium">Element Editor</span>
      </Button>

      {/* Element Editor Panel - shown when element is selected */}
      {isActive && selectedElement && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-card border rounded-lg shadow-lg p-3 space-y-3" data-testid="element-editor-panel">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                <MousePointer2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-[11px] font-medium">{selectedElement.tagName}</p>
                <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                  {selectedElement.path}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancel}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          <Separator />

          {/* Direct Text Editing */}
          {selectedElement.canEditDirectly && selectedElement.text && (
            <div className="space-y-1.5">
              <Label className="text-[11px] flex items-center gap-1.5">
                <Type className="w-3 h-3" />
                Text content
              </Label>
              <Input
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="h-8 text-[11px]"
                placeholder="Edit text..."
                data-testid="element-text-input"
              />
            </div>
          )}

          {/* Color Editing */}
          <div className="space-y-2">
            <Label className="text-[11px] flex items-center gap-1.5">
              <Palette className="w-3 h-3" />
              Colors
            </Label>
            <div className="flex gap-2">
              {/* Text Color */}
              <Popover open={showColorPicker === 'text'} onOpenChange={(open) => setShowColorPicker(open ? 'text' : null)}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 flex-1 justify-start gap-2"
                    data-testid="text-color-trigger"
                  >
                    <div 
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: currentColor }}
                    />
                    <span className="text-[11px]">Text</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  <div className="space-y-2">
                    <div className="grid grid-cols-6 gap-1">
                      {presetColors.map(color => (
                        <button
                          key={color}
                          className={cn(
                            "w-6 h-6 rounded border-2",
                            currentColor === color ? "border-primary" : "border-transparent"
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => handleStyleChange('color', color)}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <Input
                        ref={colorInputRef}
                        type="color"
                        value={currentColor}
                        onChange={(e) => handleStyleChange('color', e.target.value)}
                        className="w-8 h-8 p-0.5 cursor-pointer"
                      />
                      <Input
                        value={currentColor}
                        onChange={(e) => handleStyleChange('color', e.target.value)}
                        className="h-8 text-[11px] flex-1"
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Background Color */}
              <Popover open={showColorPicker === 'bg'} onOpenChange={(open) => setShowColorPicker(open ? 'bg' : null)}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 flex-1 justify-start gap-2"
                    data-testid="bg-color-trigger"
                  >
                    <div 
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: currentBgColor }}
                    />
                    <span className="text-[11px]">Background</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  <div className="space-y-2">
                    <div className="grid grid-cols-6 gap-1">
                      {presetColors.map(color => (
                        <button
                          key={color}
                          className={cn(
                            "w-6 h-6 rounded border-2",
                            currentBgColor === color ? "border-primary" : "border-transparent"
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => handleStyleChange('backgroundColor', color)}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <Input
                        type="color"
                        value={currentBgColor}
                        onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                        className="w-8 h-8 p-0.5 cursor-pointer"
                      />
                      <Input
                        value={currentBgColor}
                        onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                        className="h-8 text-[11px] flex-1"
                        placeholder="#ffffff"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Text Alignment */}
          <div className="space-y-1.5">
            <Label className="text-[11px]">Alignment</Label>
            <div className="flex gap-1">
              {[
                { value: 'left', icon: AlignLeft },
                { value: 'center', icon: AlignCenter },
                { value: 'right', icon: AlignRight },
              ].map(({ value, icon: Icon }) => (
                <Button
                  key={value}
                  variant={currentAlign === value ? "default" : "outline"}
                  size="sm"
                  className="h-8 flex-1"
                  onClick={() => handleStyleChange('textAlign', value)}
                  data-testid={`align-${value}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </Button>
              ))}
              <Button
                variant={currentWeight === 'bold' || currentWeight === '700' ? "default" : "outline"}
                size="sm"
                className="h-8 flex-1"
                onClick={() => handleStyleChange('fontWeight', currentWeight === 'bold' || currentWeight === '700' ? 'normal' : 'bold')}
                data-testid="toggle-bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Spacing Controls */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] flex items-center gap-1">
                <Square className="w-3 h-3" />
                Padding
              </Label>
              <Input
                value={editedStyles.padding || selectedElement.styles.padding || ''}
                onChange={(e) => handleStyleChange('padding', e.target.value)}
                className="h-8 text-[11px]"
                placeholder="0px"
                data-testid="padding-input"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] flex items-center gap-1">
                <Move className="w-3 h-3" />
                Margin
              </Label>
              <Input
                value={editedStyles.margin || selectedElement.styles.margin || ''}
                onChange={(e) => handleStyleChange('margin', e.target.value)}
                className="h-8 text-[11px]"
                placeholder="0px"
                data-testid="margin-input"
              />
            </div>
          </div>

          <Separator />

          {/* Save/Cancel Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8"
              onClick={onCancel}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 h-8 bg-purple-600 hover:bg-purple-700"
              onClick={handleSave}
              data-testid="element-save-btn"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              Save changes
            </Button>
          </div>

          {!selectedElement.canEditDirectly && (
            <p className="text-[10px] text-muted-foreground text-center">
              Complex edit - Agent will apply changes
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export type { ElementSelection };
