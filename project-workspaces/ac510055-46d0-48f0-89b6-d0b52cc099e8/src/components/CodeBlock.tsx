
import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Play } from 'lucide-react';
import { Button } from './ui/button';
import { useTranslation } from 'react-i18next';

interface CodeBlockProps {
  language: string;
  value: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  const { t } = useTranslation();
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    // Optionally, add a toast notification here
  };

  const handleExecute = () => {
    // Placeholder for code execution logic
    // In a real application, you would send the code to a sandboxed environment
    // for execution and display the results.
    console.log(`Executing ${language} code:\n`, value);
    alert(t('code_execution_placeholder'));
  };

  return (
    <div className="relative my-4 rounded-md overflow-hidden bg-gray-800">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-700 text-gray-200 text-sm font-mono">
        <span>{language.toUpperCase()}</span>
        <div className="flex space-x-2">
          <Button
            onClick={handleExecute}
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:bg-gray-600 hover:text-white p-1 h-auto"
            title={t('execute_code')}
          >
            <Play className="h-4 w-4" />
          </Button>
          <Button
            onClick={handleCopy}
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:bg-gray-600 hover:text-white p-1 h-auto"
            title={t('copy_code')}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <SyntaxHighlighter
        language={language}
        style={dracula}
        customStyle={{
          margin: 0,
          padding: '1.25rem',
          backgroundColor: '#1f2937', // gray-800
          fontSize: '0.875rem', // text-sm
          lineHeight: '1.5',
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};
