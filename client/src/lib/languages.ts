/**
 * Language configurations for the client
 * This mirrors the server-side language configurations
 */

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
  defaultContent: string;
  compilerCommand?: string;
  runCommand: string;
  installCommand?: string;
  packageManager?: string;
  packageFile?: string;
  icon: string;
}

// Map of language configurations
export const languageConfigs: Record<Language, LanguageConfig> = {
  nodejs: {
    name: 'nodejs',
    displayName: 'Node.js',
    fileExtensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    defaultFile: 'index.js',
    defaultContent: `console.log('Hello, world!');`,
    runCommand: 'node index.js',
    installCommand: 'npm install',
    packageManager: 'npm',
    packageFile: 'package.json',
    icon: 'nodejs'
  },
  python: {
    name: 'python',
    displayName: 'Python',
    fileExtensions: ['.py', '.pyw', '.pyc', '.pyo', '.pyd'],
    defaultFile: 'main.py',
    defaultContent: `print("Hello, world!")`,
    runCommand: 'python main.py',
    installCommand: 'pip install -r requirements.txt',
    packageManager: 'pip',
    packageFile: 'requirements.txt',
    icon: 'python'
  },
  java: {
    name: 'java',
    displayName: 'Java',
    fileExtensions: ['.java', '.class', '.jar'],
    defaultFile: 'Main.java',
    defaultContent: 
`public class Main {
  public static void main(String[] args) {
    System.out.println("Hello, world!");
  }
}`,
    compilerCommand: 'javac Main.java',
    runCommand: 'java Main',
    icon: 'java'
  },
  go: {
    name: 'go',
    displayName: 'Go',
    fileExtensions: ['.go'],
    defaultFile: 'main.go',
    defaultContent: 
`package main

import "fmt"

func main() {
  fmt.Println("Hello, world!")
}`,
    runCommand: 'go run main.go',
    installCommand: 'go mod download',
    packageManager: 'go',
    packageFile: 'go.mod',
    icon: 'go'
  },
  ruby: {
    name: 'ruby',
    displayName: 'Ruby',
    fileExtensions: ['.rb', '.erb', '.gemspec'],
    defaultFile: 'main.rb',
    defaultContent: `puts "Hello, world!"`,
    runCommand: 'ruby main.rb',
    installCommand: 'bundle install',
    packageManager: 'bundler',
    packageFile: 'Gemfile',
    icon: 'ruby'
  },
  rust: {
    name: 'rust',
    displayName: 'Rust',
    fileExtensions: ['.rs'],
    defaultFile: 'main.rs',
    defaultContent: 
`fn main() {
  println!("Hello, world!");
}`,
    compilerCommand: 'rustc main.rs',
    runCommand: './main',
    installCommand: 'cargo build',
    packageManager: 'cargo',
    packageFile: 'Cargo.toml',
    icon: 'rust'
  },
  php: {
    name: 'php',
    displayName: 'PHP',
    fileExtensions: ['.php', '.phtml', '.php7'],
    defaultFile: 'index.php',
    defaultContent: `<?php echo "Hello, world!"; ?>`,
    runCommand: 'php -S 0.0.0.0:8080',
    installCommand: 'composer install',
    packageManager: 'composer',
    packageFile: 'composer.json',
    icon: 'php'
  },
  c: {
    name: 'c',
    displayName: 'C',
    fileExtensions: ['.c', '.h'],
    defaultFile: 'main.c',
    defaultContent: 
`#include <stdio.h>

int main() {
  printf("Hello, world!\\n");
  return 0;
}`,
    compilerCommand: 'gcc main.c -o main',
    runCommand: './main',
    icon: 'c'
  },
  cpp: {
    name: 'cpp',
    displayName: 'C++',
    fileExtensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'],
    defaultFile: 'main.cpp',
    defaultContent: 
`#include <iostream>

int main() {
  std::cout << "Hello, world!" << std::endl;
  return 0;
}`,
    compilerCommand: 'g++ main.cpp -o main',
    runCommand: './main',
    icon: 'cpp'
  },
  csharp: {
    name: 'csharp',
    displayName: 'C#',
    fileExtensions: ['.cs'],
    defaultFile: 'Program.cs',
    defaultContent: 
`using System;

class Program {
  static void Main(string[] args) {
    Console.WriteLine("Hello, world!");
  }
}`,
    compilerCommand: 'dotnet build',
    runCommand: 'dotnet run',
    installCommand: 'dotnet restore',
    packageManager: 'dotnet',
    packageFile: '*.csproj',
    icon: 'csharp'
  },
  swift: {
    name: 'swift',
    displayName: 'Swift',
    fileExtensions: ['.swift'],
    defaultFile: 'main.swift',
    defaultContent: `print("Hello, world!")`,
    runCommand: 'swift main.swift',
    packageManager: 'swift',
    packageFile: 'Package.swift',
    icon: 'swift'
  },
  kotlin: {
    name: 'kotlin',
    displayName: 'Kotlin',
    fileExtensions: ['.kt', '.kts'],
    defaultFile: 'Main.kt',
    defaultContent: 
`fun main() {
  println("Hello, world!")
}`,
    compilerCommand: 'kotlinc Main.kt -include-runtime -d Main.jar',
    runCommand: 'java -jar Main.jar',
    icon: 'kotlin'
  },
  dart: {
    name: 'dart',
    displayName: 'Dart',
    fileExtensions: ['.dart'],
    defaultFile: 'main.dart',
    defaultContent: 
`void main() {
  print('Hello, world!');
}`,
    runCommand: 'dart main.dart',
    installCommand: 'dart pub get',
    packageManager: 'pub',
    packageFile: 'pubspec.yaml',
    icon: 'dart'
  },
  typescript: {
    name: 'typescript',
    displayName: 'TypeScript',
    fileExtensions: ['.ts', '.tsx'],
    defaultFile: 'index.ts',
    defaultContent: `console.log('Hello, world!');`,
    compilerCommand: 'tsc',
    runCommand: 'ts-node index.ts',
    installCommand: 'npm install',
    packageManager: 'npm',
    packageFile: 'package.json',
    icon: 'typescript'
  },
  bash: {
    name: 'bash',
    displayName: 'Bash',
    fileExtensions: ['.sh', '.bash'],
    defaultFile: 'script.sh',
    defaultContent: `echo "Hello, world!"`,
    runCommand: 'bash script.sh',
    icon: 'bash'
  },
  'html-css-js': {
    name: 'html-css-js',
    displayName: 'HTML/CSS/JS',
    fileExtensions: ['.html', '.htm', '.css', '.js'],
    defaultFile: 'index.html',
    defaultContent: 
`<!DOCTYPE html>
<html>
<head>
  <title>Hello World</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    h1 {
      color: #333;
    }
  </style>
</head>
<body>
  <h1>Hello, world!</h1>
  <script>
    console.log('Hello from JavaScript!');
  </script>
</body>
</html>`,
    runCommand: 'npx serve',
    installCommand: 'npm install serve --no-save',
    icon: 'html'
  },
  nix: {
    name: 'nix',
    displayName: 'Nix',
    fileExtensions: ['.nix'],
    defaultFile: 'default.nix',
    defaultContent: 
`{ pkgs ? import <nixpkgs> {} }:

pkgs.stdenv.mkDerivation {
  name = "hello-world";
  src = ./.;
  buildPhase = "echo \\"Hello, world!\\" > hello.txt";
  installPhase = "mkdir -p $out && cp hello.txt $out/";
}`,
    runCommand: 'nix-build',
    icon: 'nix'
  },
  deno: {
    name: 'deno',
    displayName: 'Deno',
    fileExtensions: ['.ts', '.js'],
    defaultFile: 'index.ts',
    defaultContent: `console.log('Hello, world!');`,
    runCommand: 'deno run --allow-net index.ts',
    icon: 'deno'
  },
};

/**
 * Get language configuration by extension
 */
export function getLanguageByExtension(filename: string): Language | undefined {
  const extension = filename.substring(filename.lastIndexOf('.'));
  
  for (const [language, config] of Object.entries(languageConfigs)) {
    if (config.fileExtensions.includes(extension)) {
      return language as Language;
    }
  }
  
  return undefined;
}