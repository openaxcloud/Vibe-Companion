/**
 * AI Agent Tool Definitions
 * Comprehensive tool schemas for autonomous agent capabilities
 * Identical to Replit Agent v3 functionality
 */

export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * File System Tools
 */
export const fileTools: AgentTool[] = [
  {
    name: 'create_file',
    description: 'Create a new file with specified content. Use this to create new source files, configs, or documentation.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative file path from project root (e.g., "src/components/Button.tsx")'
        },
        content: {
          type: 'string',
          description: 'Complete file content to write'
        },
        description: {
          type: 'string',
          description: 'Brief description of what this file does (for user visibility)'
        }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'edit_file',
    description: 'Modify an existing file by replacing old content with new content. Use for targeted edits.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative file path from project root'
        },
        old_content: {
          type: 'string',
          description: 'Exact content to replace (must match exactly including whitespace)'
        },
        new_content: {
          type: 'string',
          description: 'New content to insert in place of old content'
        },
        description: {
          type: 'string',
          description: 'Brief description of what this edit does'
        }
      },
      required: ['path', 'old_content', 'new_content']
    }
  },
  {
    name: 'read_file',
    description: 'Read the complete contents of a file to understand its current state.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative file path from project root'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'delete_file',
    description: 'Delete a file from the project. Use with caution.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative file path from project root'
        },
        reason: {
          type: 'string',
          description: 'Why this file is being deleted'
        }
      },
      required: ['path', 'reason']
    }
  },
  {
    name: 'list_directory',
    description: 'List all files and folders in a directory to understand project structure.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to list (default: "." for root)'
        },
        recursive: {
          type: 'boolean',
          description: 'Whether to list subdirectories recursively'
        }
      },
      required: ['path']
    }
  }
];

/**
 * Command Execution Tools
 */
export const commandTools: AgentTool[] = [
  {
    name: 'run_command',
    description: 'Execute a shell command in the project terminal. Use for installing packages, running builds, tests, etc.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Shell command to execute (e.g., "npm install react", "npm run build")'
        },
        description: {
          type: 'string',
          description: 'What this command does and why it\'s needed'
        },
        timeout: {
          type: 'number',
          description: 'Maximum execution time in milliseconds (default: 30000)'
        }
      },
      required: ['command', 'description']
    }
  },
  {
    name: 'install_package',
    description: 'Install an npm package to the project. Automatically runs npm install.',
    parameters: {
      type: 'object',
      properties: {
        package_name: {
          type: 'string',
          description: 'Package name (e.g., "react-router-dom", "axios")'
        },
        dev: {
          type: 'boolean',
          description: 'Install as dev dependency (default: false)'
        },
        version: {
          type: 'string',
          description: 'Specific version to install (optional)'
        }
      },
      required: ['package_name']
    }
  }
];

/**
 * Search and Analysis Tools
 */
export const searchTools: AgentTool[] = [
  {
    name: 'web_search',
    description: 'Search the internet for current information, documentation, or solutions. Use when you need up-to-date information.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g., "React hooks best practices 2024", "TypeScript error handling patterns")'
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'search_code',
    description: 'Search for specific code patterns in the project files using grep.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Code pattern to search for (regex supported)'
        },
        file_pattern: {
          type: 'string',
          description: 'File pattern to search in (e.g., "*.ts", "**/*.tsx")'
        }
      },
      required: ['pattern']
    }
  }
];

/**
 * Project Context Tools
 */
export const contextTools: AgentTool[] = [
  {
    name: 'get_project_structure',
    description: 'Get a complete overview of the project structure including files, folders, and technologies used.',
    parameters: {
      type: 'object',
      properties: {
        include_content: {
          type: 'boolean',
          description: 'Whether to include file contents for key files (package.json, etc.)'
        }
      }
    }
  },
  {
    name: 'get_diagnostics',
    description: 'Get current errors, warnings, and diagnostics from the project (TypeScript, ESLint, etc.).',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Specific file to get diagnostics for (optional, defaults to all files)'
        }
      }
    }
  }
];

/**
 * Browser Testing & Quality Assurance Tools (Phase 2)
 */
export const testingTools: AgentTool[] = [
  {
    name: 'run_browser_test',
    description: 'Execute a Playwright browser test to validate UI functionality. Tests interactions, navigation, and visual regression.',
    parameters: {
      type: 'object',
      properties: {
        test_script: {
          type: 'string',
          description: 'Playwright test script (e.g., "await page.goto(\'/\'); await page.click(\'[data-testid=button-login]\');")'
        },
        browser_type: {
          type: 'string',
          enum: ['chromium', 'firefox', 'webkit'],
          description: 'Browser to use for testing (default: chromium)'
        },
        record_video: {
          type: 'boolean',
          description: 'Whether to record video of the test execution (default: false)'
        },
        trace_enabled: {
          type: 'boolean',
          description: 'Whether to capture Playwright trace for debugging (default: false)'
        }
      },
      required: ['test_script']
    }
  },
  {
    name: 'analyze_performance',
    description: 'Analyze web performance metrics including load time, first contentful paint, and resource sizes.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to analyze (e.g., "http://localhost:5000" or production URL)'
        },
        metrics: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['fcp', 'lcp', 'cls', 'ttfb', 'tti']
          },
          description: 'Performance metrics to measure (default: all)'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'check_accessibility',
    description: 'Run WCAG 2.1 accessibility checks to ensure the application is usable by people with disabilities.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to check for accessibility issues'
        },
        level: {
          type: 'string',
          enum: ['A', 'AA', 'AAA'],
          description: 'WCAG conformance level (default: AA)'
        },
        selectors: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific elements to check (optional, defaults to entire page)'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'generate_selectors',
    description: 'Generate robust CSS and XPath selectors for UI elements by analyzing the page structure.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Page URL to analyze for element selectors'
        },
        selector_type: {
          type: 'string',
          enum: ['css', 'xpath'],
          description: 'Type of selector to generate (default: css)'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'start_recording',
    description: 'Start recording a browser session with video capture and timeline markers for debugging and documentation.',
    parameters: {
      type: 'object',
      properties: {
        browser_type: {
          type: 'string',
          enum: ['chromium', 'firefox', 'webkit'],
          description: 'Browser to use (default: chromium)'
        },
        viewport: {
          type: 'object',
          properties: {
            width: { type: 'number' },
            height: { type: 'number' }
          },
          description: 'Browser viewport size (default: 1920x1080)'
        }
      }
    }
  },
  {
    name: 'stop_recording',
    description: 'Stop an active recording session and process the captured video.',
    parameters: {
      type: 'object',
      properties: {
        recording_id: {
          type: 'string',
          description: 'ID of the active recording to stop'
        }
      },
      required: ['recording_id']
    }
  },
  {
    name: 'add_marker',
    description: 'Add a timeline marker to an active recording session to mark important events, errors, or milestones.',
    parameters: {
      type: 'object',
      properties: {
        recording_id: {
          type: 'string',
          description: 'ID of the recording to add marker to'
        },
        label: {
          type: 'string',
          description: 'Marker label (e.g., "User logged in", "Payment processed")'
        },
        type: {
          type: 'string',
          enum: ['event', 'error', 'milestone'],
          description: 'Type of marker (default: event)'
        }
      },
      required: ['recording_id', 'label']
    }
  },
  {
    name: 'get_test_results',
    description: 'Retrieve results from previous test executions including pass/fail status, errors, and artifacts.',
    parameters: {
      type: 'object',
      properties: {
        execution_id: {
          type: 'string',
          description: 'Specific execution ID to retrieve (optional, returns recent if not specified)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)'
        }
      }
    }
  },
  {
    name: 'get_selectors',
    description: 'Retrieve previously generated element selectors with their metadata and usage examples.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Filter selectors by URL (optional)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of selectors to return (default: 20)'
        }
      }
    }
  },
  {
    name: 'get_recordings',
    description: 'Retrieve session recordings with playback URLs and timeline markers.',
    parameters: {
      type: 'object',
      properties: {
        recording_id: {
          type: 'string',
          description: 'Specific recording ID (optional, returns recent if not specified)'
        },
        status: {
          type: 'string',
          enum: ['recording', 'stopped', 'processing', 'ready', 'error'],
          description: 'Filter by recording status (optional)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of recordings to return (default: 10)'
        }
      }
    }
  }
];

/**
 * All Tools Combined
 */
export const allTools: AgentTool[] = [
  ...fileTools,
  ...commandTools,
  ...searchTools,
  ...contextTools,
  ...testingTools
];

/**
 * Convert tools to OpenAI function calling format
 */
export function toOpenAITools(tools: AgentTool[]) {
  return tools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}

/**
 * Convert tools to Anthropic tool format
 */
export function toAnthropicTools(tools: AgentTool[]) {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters
  }));
}
