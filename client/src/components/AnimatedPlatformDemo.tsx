import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Card } from '@/components/ui/card';

interface DemoStep {
  id: string;
  title: string;
  duration: number;
  code: string[];
  terminal: string[];
  preview: string;
}

const DEMO_STEPS: DemoStep[] = [
  {
    id: 'ai-prompt',
    title: 'AI analyzes your request',
    duration: 3000,
    code: [
      '// "Build a todo app with dark mode"',
      '',
      '// AI is planning your app...'
    ],
    terminal: [
      '$ e-code create todo-app',
      '✓ Creating project structure',
      '✓ Installing dependencies'
    ],
    preview: '<div class="p-3 text-center text-gray-500"><svg class="w-8 h-8 mx-auto mb-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-opacity="0.2" stroke-width="4"></circle><path stroke-opacity="1" stroke-width="4" d="M12 2a10 10 0 0 1 0 20"></path></svg><p class="text-[11px]">Building...</p></div>'
  },
  {
    id: 'start',
    title: 'AI writes your code',
    duration: 3000,
    code: [
      'import React, { useState } from \'react\';',
      'import { Moon, Sun } from \'lucide-react\';',
      '',
      'function TodoApp() {',
      '  const [todos, setTodos] = useState([]);',
      '  const [darkMode, setDarkMode] = useState(false);'
    ],
    terminal: [
      '✓ React components created',
      '✓ Installing lucide-react',
      '✓ Setting up dark mode'
    ],
    preview: '<div class="p-3"><h1 class="text-[15px] font-semibold">Todo App</h1><div class="flex gap-2 mt-3"><input placeholder="Add todo..." class="border px-2 py-1 text-[13px] flex-1 rounded"><button class="bg-orange-500 text-white px-3 py-1 text-[13px] rounded">Add</button></div></div>'
  },
  {
    id: 'code',
    title: 'Adding functionality',
    duration: 3500,
    code: [
      '  const addTodo = () => {',
      '    if (input.trim()) {',
      '      setTodos([...todos, {',
      '        id: Date.now(),',
      '        text: input,',
      '        done: false',
      '      }]);',
      '    }',
      '  };',
      '',
      '  return (',
      '    <div className={darkMode ? "dark" : ""}>',
      '      {/* App UI */}',
      '    </div>',
      '  );',
      '}'
    ],
    terminal: [
      '✓ Todo functionality added',
      '✓ Dark mode integrated',
      '✓ Building app...',
      '🚀 Starting preview server'
    ],
    preview: '<div class="p-3"><div class="flex justify-between items-center mb-3"><h1 class="text-[15px] font-semibold">Todo App</h1><button class="p-1 rounded hover:bg-gray-100"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg></button></div><div class="space-y-2"><div class="flex items-center gap-2 p-2 bg-gray-50 rounded"><input type="checkbox" class="w-4 h-4"><span class="text-[13px]">Complete the demo</span></div></div></div>'
  },
  {
    id: 'complete',
    title: 'Your app is live!',
    duration: 3000,
    code: [
      '// App completed and deployed!',
      '// Live at: https://todo.e-code.ai',
      '',
      'export default TodoApp;',
      '',
      '// Total build time: 45 seconds',
      '// Files created: 5',
      '// Dependencies: 3',
      '// Ready to share! 🚀'
    ],
    terminal: [
      '✓ Build successful',
      '✓ Deployed to E-Code Cloud',
      '',
      '🎉 App is live at:',
      'https://todo.e-code.ai',
      '',
      'Share your creation!'
    ],
    preview: '<div class="p-3"><div class="mb-3"><h1 class="text-[15px] font-semibold mb-2">Smart Todo</h1><div class="flex gap-2"><span class="text-[11px] px-2 py-1 bg-green-100 text-green-700 rounded">Live</span><span class="text-[11px] px-2 py-1 bg-blue-100 text-blue-700 rounded">v1.0</span></div></div><div class="space-y-2"><div class="flex items-center gap-2 p-2 bg-blue-50 rounded border-l-2 border-blue-400"><input type="checkbox" checked class="w-4 h-4"><span class="text-[13px] line-through text-gray-500">Build with AI</span></div><div class="flex items-center gap-2 p-2 bg-green-50 rounded border-l-2 border-green-400"><input type="checkbox" checked class="w-4 h-4"><span class="text-[13px] line-through text-gray-500">Deploy instantly</span></div><div class="flex items-center gap-2 p-2 bg-purple-50 rounded border-l-2 border-purple-400"><input type="checkbox" class="w-4 h-4"><span class="text-[13px]">Share with friends</span></div></div><div class="mt-3 p-2 bg-gradient-to-r from-orange-100 to-purple-100 rounded text-center"><span class="text-[11px] font-medium">Built in 45 seconds with E-Code AI</span></div></div>'
  }
];

export function AnimatedPlatformDemo() {
  const [currentStep, setCurrentStep] = useState(0);
  const [currentLine, setCurrentLine] = useState(0);
  const [displayedCode, setDisplayedCode] = useState<string[]>([]);
  const [displayedTerminal, setDisplayedTerminal] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  // Continuous autoplay animation
  useEffect(() => {
    const step = DEMO_STEPS[currentStep];
    if (!step) return;

    const timer = setTimeout(() => {
      const codeLines = step.code;
      const terminalLines = step.terminal;
      
      if (currentLine < Math.max(codeLines.length, terminalLines.length)) {
        // Add lines progressively
        if (currentLine < codeLines.length) {
          setDisplayedCode(prev => [...prev, codeLines[currentLine]]);
        }
        if (currentLine < terminalLines.length) {
          setDisplayedTerminal(prev => {
            const updated = [...prev, terminalLines[currentLine]];
            // Keep only last 4 lines for cleaner look
            return updated.slice(-4);
          });
        }
        setCurrentLine(prev => prev + 1);
      } else {
        // Step complete, move to next
        setTimeout(() => {
          if (currentStep < DEMO_STEPS.length - 1) {
            // Next step
            setCurrentStep(prev => prev + 1);
            setCurrentLine(0);
            setDisplayedCode([]);
            setDisplayedTerminal([]);
          } else {
            // Restart immediately - continuous loop
            setCurrentStep(0);
            setCurrentLine(0);
            setDisplayedCode([]);
            setDisplayedTerminal([]);
          }
        }, step.duration - (codeLines.length * 150)); // Use remaining duration after typing
      }
    }, 150); // Fast typing for dynamic feel

    return () => clearTimeout(timer);
  }, [currentStep, currentLine]);

  // Update progress bar smoothly
  useEffect(() => {
    const totalSteps = DEMO_STEPS.length;
    const currentStepProgress = currentStep / totalSteps;
    const lineProgress = currentLine / (DEMO_STEPS[currentStep]?.code.length || 1) / totalSteps;
    setProgress((currentStepProgress + lineProgress) * 100);
  }, [currentStep, currentLine]);

  const currentStepData = DEMO_STEPS[currentStep];

  return (
    <Card className="relative overflow-hidden border border-gray-200 dark:border-gray-700 mx-auto w-full bg-white dark:bg-gray-900 shadow-xl rounded-lg">
      {/* Realistic IDE Header */}
      <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 hover:bg-red-600 transition-colors cursor-pointer" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors cursor-pointer" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 hover:bg-green-600 transition-colors cursor-pointer" />
          </div>
          <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
          <span className="text-gray-700 dark:text-gray-300 text-[11px] font-medium">todo-app — E-Code</span>
        </div>
        
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="font-medium">{currentStepData?.title}</span>
          <div className="flex gap-1">
            {DEMO_STEPS.map((_, index) => (
              <div
                key={index}
                className={`w-1 h-1 rounded-full transition-all duration-300 ${
                  index === currentStep 
                    ? 'bg-orange-500 w-3' 
                    : index < currentStep 
                      ? 'bg-orange-300' 
                      : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 h-[400px]">
        {/* Left Side - Compact Code Editor */}
        <div className="bg-gray-50 dark:bg-gray-900 p-3 lg:col-span-2 border-r border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex gap-1">
              <div className="bg-white dark:bg-gray-800 px-3 py-1 rounded-t-md text-[11px] text-gray-700 dark:text-gray-300 font-medium border border-b-0 border-gray-200 dark:border-gray-700">
                App.jsx
              </div>
              <div className="bg-gray-100 dark:bg-gray-850 px-3 py-1 rounded-t-md text-[11px] text-gray-500 dark:text-gray-500">
                styles.css
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-md p-3 h-[calc(100%-40px)] overflow-auto border border-gray-200 dark:border-gray-700">
            <div className="font-mono text-[11px] leading-5">
              {displayedCode.map((line, index) => (
                <div key={index} className="flex hover:bg-gray-50 dark:hover:bg-gray-750 px-1 -mx-1">
                  <span className="text-gray-400 dark:text-gray-500 w-6 text-right mr-3 select-none text-[11px]">
                    {index + 1}
                  </span>
                  <span className="text-gray-800 dark:text-gray-200 flex-1">
                    {line.includes('//') ? (
                      <>
                        {line.split('//')[0]}
                        <span className="text-gray-500 dark:text-gray-400 italic">//{line.split('//')[1]}</span>
                      </>
                    ) : line.includes('import') ? (
                      <>
                        <span className="text-purple-600 dark:text-purple-400">import</span>
                        {line.replace('import', '')}
                      </>
                    ) : line.includes('function') ? (
                      <>
                        <span className="text-blue-600 dark:text-blue-400">function</span>
                        {line.replace('function', '')}
                      </>
                    ) : line.includes('const') || line.includes('let') ? (
                      <>
                        <span className="text-purple-600 dark:text-purple-400">{line.includes('const') ? 'const' : 'let'}</span>
                        {line.replace(/(const|let)/, '')}
                      </>
                    ) : (
                      line
                    )}
                  </span>
                </div>
              ))}
              {currentLine < currentStepData?.code.length && (
                <span className="inline-block w-1.5 h-4 bg-blue-500 animate-pulse ml-9" />
              )}
            </div>
          </div>
        </div>

        {/* Right Side - Compact Preview & Terminal */}
        <div className="flex flex-col overflow-hidden">
          {/* Live Preview */}
          <div className="bg-white dark:bg-gray-800 p-3 flex-1 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] text-gray-600 dark:text-gray-400 flex items-center gap-1.5 font-medium">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Preview
              </div>
              <div className="text-[11px] text-gray-400 dark:text-gray-500">
                localhost:3000
              </div>
            </div>
            <div 
              className="border border-gray-200 dark:border-gray-700 rounded p-3 h-[160px] bg-gray-50 dark:bg-gray-900 overflow-auto"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentStepData?.preview || '') }}
            />
          </div>

          {/* Compact Terminal */}
          <div className="bg-gray-900 dark:bg-black p-3 h-[140px] overflow-hidden">
            <div className="text-[11px] font-mono leading-4">
              {displayedTerminal.slice(-5).map((line, index) => (
                <div key={index} className="mb-0.5">
                  {line.startsWith('$') ? (
                    <span className="text-green-400">{line}</span>
                  ) : line.startsWith('✓') ? (
                    <span className="text-emerald-400">{line}</span>
                  ) : line.includes('🤖') ? (
                    <span className="text-blue-400">{line}</span>
                  ) : line.includes('🚀') ? (
                    <span className="text-orange-400">{line}</span>
                  ) : (
                    <span className="text-gray-400">{line}</span>
                  )}
                </div>
              ))}
              {currentLine < currentStepData?.terminal.length && (
                <span className="inline-block w-1.5 h-3 bg-green-400 animate-pulse" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Animated Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gray-100 dark:bg-gray-800 h-8 overflow-hidden">
        <div 
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-400 via-purple-500 to-blue-500 transition-all duration-1000 ease-out"
          style={{ width: `${progress}%` }}
        />
        <div className="relative flex items-center justify-between h-full px-3">
          <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            {currentStepData?.title}
          </span>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-gray-500 dark:text-gray-400">
              {currentStep + 1}/{DEMO_STEPS.length}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}