
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from './ui/button';
import { Upload, FileText, XCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload }) => {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setUploadError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
  });

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);

    // Placeholder for actual file upload logic
    // In a real application, you would send this file to your backend
    // and process it for RAG (chunking, embedding, storing in vector DB).
    console.log('Simulating file upload:', selectedFile.name);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call

    if (Math.random() > 0.1) { // Simulate occasional upload failure
      onFileUpload(selectedFile);
      setSelectedFile(null);
      console.log('File uploaded successfully (simulated)!');
    } else {
      setUploadError(t('upload_failed'));
    }

    setIsUploading(false);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadError(null);
  };

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={() => (document.getElementById('fileInput') as HTMLInputElement)?.click()}>
        <Upload className="h-5 w-5" />
      </Button>

      <input {...getInputProps()} id="fileInput" className="hidden" />

      {selectedFile && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-gray-800 border border-gray-700 rounded-md shadow-lg flex items-center space-x-3 text-white z-10">
          <FileText className="h-5 w-5 text-indigo-400" />
          <span className="text-sm truncate max-w-[150px]">{selectedFile.name}</span>
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-indigo-300" />
          ) : uploadError ? (
            <div className="flex items-center text-red-400">
              <XCircle className="h-5 w-5 mr-1" />
              <span className="text-sm">{t('error')}</span>
              <Button variant="ghost" size="sm" onClick={handleRemoveFile} className="ml-2 p-1 h-auto text-gray-400 hover:text-white">
                X
              </Button>
            </div>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={handleUpload} className="p-1 h-auto text-indigo-400 hover:text-white">
                {t('confirm_upload')}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleRemoveFile} className="p-1 h-auto text-gray-400 hover:text-white">
                X
              </Button>
            </>
          )}
        </div>
      )}

      {isDragActive && (
        <div className="absolute inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center rounded-md border-2 border-dashed border-indigo-500 text-indigo-300">
          {t('drop_files_here')}
        </div>
      )}
    </div>
  );
};
