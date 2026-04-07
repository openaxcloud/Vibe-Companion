/**
 * Language Environments component
 * Displays available language environments and their status
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
// Define types locally to avoid circular dependencies
export type Language = 
  | 'nodejs'
  | 'python'
  | 'java'
  | 'go'
  | 'ruby'
  | 'rust'
  | 'php'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'swift'
  | 'kotlin'
  | 'dart'
  | 'typescript'
  | 'bash'
  | 'html-css-js'
  | 'nix'
  | 'deno';

export interface LanguageConfig {
  name: string;
  displayName: string;
  fileExtensions: string[];
  defaultFile: string;
  runCommand: string;
  installCommand?: string;
}

// Language configurations
export const languageConfigs: Record<Language, LanguageConfig> = {
  nodejs: {
    name: 'nodejs',
    displayName: 'Node.js',
    fileExtensions: ['.js', '.jsx', '.json'],
    defaultFile: 'index.js',
    runCommand: 'node index.js',
    installCommand: 'npm install'
  },
  typescript: {
    name: 'typescript',
    displayName: 'TypeScript',
    fileExtensions: ['.ts', '.tsx'],
    defaultFile: 'index.ts',
    runCommand: 'ts-node index.ts',
    installCommand: 'npm install'
  },
  python: {
    name: 'python',
    displayName: 'Python',
    fileExtensions: ['.py'],
    defaultFile: 'main.py',
    runCommand: 'python main.py',
    installCommand: 'pip install -r requirements.txt'
  },
  java: {
    name: 'java',
    displayName: 'Java',
    fileExtensions: ['.java', '.class'],
    defaultFile: 'Main.java',
    runCommand: 'java Main'
  },
  go: {
    name: 'go',
    displayName: 'Go',
    fileExtensions: ['.go'],
    defaultFile: 'main.go',
    runCommand: 'go run main.go'
  },
  ruby: {
    name: 'ruby',
    displayName: 'Ruby',
    fileExtensions: ['.rb'],
    defaultFile: 'main.rb',
    runCommand: 'ruby main.rb'
  },
  rust: {
    name: 'rust',
    displayName: 'Rust',
    fileExtensions: ['.rs'],
    defaultFile: 'main.rs',
    runCommand: './main'
  },
  php: {
    name: 'php',
    displayName: 'PHP',
    fileExtensions: ['.php'],
    defaultFile: 'index.php',
    runCommand: 'php -S 0.0.0.0:8080'
  },
  c: {
    name: 'c',
    displayName: 'C',
    fileExtensions: ['.c', '.h'],
    defaultFile: 'main.c',
    runCommand: './main'
  },
  cpp: {
    name: 'cpp',
    displayName: 'C++',
    fileExtensions: ['.cpp', '.hpp'],
    defaultFile: 'main.cpp',
    runCommand: './main'
  },
  csharp: {
    name: 'csharp',
    displayName: 'C#',
    fileExtensions: ['.cs'],
    defaultFile: 'Program.cs',
    runCommand: 'dotnet run'
  },
  swift: {
    name: 'swift',
    displayName: 'Swift',
    fileExtensions: ['.swift'],
    defaultFile: 'main.swift',
    runCommand: 'swift main.swift'
  },
  kotlin: {
    name: 'kotlin',
    displayName: 'Kotlin',
    fileExtensions: ['.kt'],
    defaultFile: 'Main.kt',
    runCommand: 'java -jar Main.jar'
  },
  dart: {
    name: 'dart',
    displayName: 'Dart',
    fileExtensions: ['.dart'],
    defaultFile: 'main.dart',
    runCommand: 'dart main.dart'
  },
  bash: {
    name: 'bash',
    displayName: 'Bash',
    fileExtensions: ['.sh', '.bash'],
    defaultFile: 'script.sh',
    runCommand: 'bash script.sh'
  },
  'html-css-js': {
    name: 'html-css-js',
    displayName: 'HTML/CSS/JS',
    fileExtensions: ['.html', '.htm', '.css', '.js'],
    defaultFile: 'index.html',
    runCommand: 'npx serve'
  },
  nix: {
    name: 'nix',
    displayName: 'Nix',
    fileExtensions: ['.nix'],
    defaultFile: 'default.nix',
    runCommand: 'nix-build'
  },
  deno: {
    name: 'deno',
    displayName: 'Deno',
    fileExtensions: ['.ts', '.js'],
    defaultFile: 'index.ts',
    runCommand: 'deno run --allow-net index.ts'
  }
};
import { Loader2 } from 'lucide-react';

// Importing language icons - using simpler set of icons that are guaranteed to exist
import {
  SiPython,
  SiNodedotjs,
  SiJavascript,
  SiTypescript,
  SiOracle, // Using as Java icon
  SiGo,
  SiRuby,
  SiRust,
  SiPhp,
  SiC,
  SiCplusplus,
  SiDotnet, // Using as C# icon
  SiSwift,
  SiKotlin,
  SiDart,
  SiLinux, // Using as Bash icon
  SiHtml5,
  SiNixos,
  SiDeno
} from 'react-icons/si';

// Map of language icons
const languageIcons: Record<string, React.ReactNode> = {
  nodejs: <SiNodedotjs className="h-6 w-6 text-green-600" />,
  typescript: <SiTypescript className="h-6 w-6 text-blue-600" />,
  python: <SiPython className="h-6 w-6 text-blue-500" />,
  java: <SiOracle className="h-6 w-6 text-red-600" />,  // Using Oracle icon for Java
  go: <SiGo className="h-6 w-6 text-blue-400" />,
  ruby: <SiRuby className="h-6 w-6 text-red-500" />,
  rust: <SiRust className="h-6 w-6 text-orange-700" />,
  php: <SiPhp className="h-6 w-6 text-indigo-600" />,
  c: <SiC className="h-6 w-6 text-blue-800" />,
  cpp: <SiCplusplus className="h-6 w-6 text-blue-700" />,
  csharp: <SiDotnet className="h-6 w-6 text-purple-600" />, // Using Dotnet icon for C#
  swift: <SiSwift className="h-6 w-6 text-orange-500" />,
  kotlin: <SiKotlin className="h-6 w-6 text-purple-500" />,
  dart: <SiDart className="h-6 w-6 text-blue-500" />,
  bash: <SiLinux className="h-6 w-6 text-gray-800" />,  // Using Linux icon for Bash
  'html-css-js': <SiHtml5 className="h-6 w-6 text-orange-600" />,
  nix: <SiNixos className="h-6 w-6 text-blue-500" />,
  deno: <SiDeno className="h-6 w-6 text-black" />
};

interface LanguageEnvironmentsProps {
  onSelectLanguage?: (language: Language) => void;
  selectedLanguage?: Language;
}

export function LanguageEnvironments({ onSelectLanguage, selectedLanguage }: LanguageEnvironmentsProps) {
  const { data: dependencies, isLoading } = useQuery({
    queryKey: ['/api/runtime/dependencies'],
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  // Add interfaces to fix type issues
  interface RuntimeDependencies {
    docker: boolean;
    nix: boolean;
    languages?: Record<string, boolean>;
  }

  // Cast dependencies to the correct type with defaults
  const deps = (dependencies || {}) as RuntimeDependencies;
  const dockerAvailable = deps.docker || false;
  const nixAvailable = deps.nix || false;

  // Filter and sort languages
  const sortedLanguages = Object.entries(languageConfigs)
    .sort(([, configA], [, configB]) => configA.displayName.localeCompare(configB.displayName))
    .map(([key, config]) => ({ key: key as Language, config }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-xl">Language Environments</CardTitle>
        <CardDescription>
          Available programming language runtimes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-16rem)]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedLanguages.map(({ key, config }) => (
                <TooltipProvider key={key}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card 
                        className={`flex flex-col cursor-pointer hover:border-primary/50 transition-colors
                          ${selectedLanguage === key ? 'border-primary ring-1 ring-primary' : ''}`}
                        onClick={() => onSelectLanguage?.(key)}
                      >
                        <CardHeader className="py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {languageIcons[key] || <div className="h-6 w-6 bg-gray-200 rounded-full" />}
                              <CardTitle className="text-base">{config.displayName}</CardTitle>
                            </div>
                            <div className="flex gap-1">
                              {nixAvailable && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  Nix
                                </Badge>
                              )}
                              {dockerAvailable && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  Docker
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardFooter className="pt-0 pb-3 text-xs text-muted-foreground">
                          {config.fileExtensions.join(', ')}
                        </CardFooter>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p><strong>Run command:</strong> {config.runCommand}</p>
                      {config.installCommand && (
                        <p><strong>Install:</strong> {config.installCommand}</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}