import { File } from "@/lib/types";

export const getFileIcon = (file: File): string => {
  if (file.isFolder) {
    return "ri-folder-open-line text-yellow-500";
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  
  const iconMap: Record<string, string> = {
    // Web files
    'html': 'ri-html-5-line text-orange-500',
    'css': 'ri-css-3-line text-blue-500',
    'scss': 'ri-css-3-line text-pink-500',
    'less': 'ri-css-3-line text-blue-400',
    'js': 'ri-javascript-line text-yellow-400',
    'jsx': 'ri-reactjs-line text-blue-400',
    'ts': 'ri-typescript-line text-blue-600',
    'tsx': 'ri-reactjs-line text-blue-600',
    
    // Data formats
    'json': 'ri-braces-line text-yellow-300',
    'yaml': 'ri-file-list-line text-red-400',
    'yml': 'ri-file-list-line text-red-400',
    'xml': 'ri-code-box-line text-orange-400',
    'csv': 'ri-file-excel-line text-green-500',
    'md': 'ri-markdown-line text-white',
    
    // Programming languages
    'py': 'ri-python-line text-green-400',
    'rb': 'ri-ruby-line text-red-500',
    'php': 'ri-php-line text-purple-400',
    'java': 'ri-file-code-line text-red-400',
    'c': 'ri-file-code-line text-blue-400',
    'cpp': 'ri-file-code-line text-blue-500',
    'cs': 'ri-file-code-line text-purple-500',
    'go': 'ri-file-code-line text-blue-300',
    'rs': 'ri-file-code-line text-orange-600',
    
    // Config files
    'gitignore': 'ri-git-repository-line text-gray-400',
    'env': 'ri-settings-3-line text-green-400',
    'lock': 'ri-lock-line text-red-400',
    'toml': 'ri-settings-3-line text-gray-400',
    
    // Images
    'svg': 'ri-image-line text-purple-400',
    'png': 'ri-image-line text-green-400',
    'jpg': 'ri-image-line text-blue-400',
    'jpeg': 'ri-image-line text-blue-400',
    'gif': 'ri-image-line text-yellow-400',
    'ico': 'ri-image-line text-orange-400',
    
    // Misc
    'txt': 'ri-file-text-line text-gray-400',
    'pdf': 'ri-file-pdf-line text-red-500',
    'zip': 'ri-file-zip-line text-yellow-600',
    'exe': 'ri-window-line text-purple-400',
  };
  
  return iconMap[ext] || 'ri-file-text-line text-gray-400';
};
