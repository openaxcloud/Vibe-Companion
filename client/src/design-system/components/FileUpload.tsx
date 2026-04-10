/**
 * File Upload Component
 * Drag-and-drop file upload with progress indicators
 */

import React, { useState, useCallback, useRef } from 'react';
import { LazyMotionDiv } from '@/lib/motion';
import { useDesignSystem } from '../hooks/useDesignSystem';
import { triggerHaptic } from '../hooks/useGestures';

// ============================================================================
// TYPES
// ============================================================================

export interface FileUploadProps {
  onUpload: (files: File[]) => Promise<void>;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // bytes
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
}

export interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

// ============================================================================
// FILE UPLOAD COMPONENT
// ============================================================================

export const FileUpload: React.FC<FileUploadProps> = ({
  onUpload,
  accept,
  multiple = true,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 10,
  disabled = false,
  className,
}) => {
  const ds = useDesignSystem();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const validateFiles = useCallback(
    (files: File[]): { valid: File[]; errors: string[] } => {
      const valid: File[] = [];
      const errors: string[] = [];

      if (files.length > maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
        return { valid, errors };
      }

      files.forEach((file) => {
        if (file.size > maxSize) {
          errors.push(`${file.name}: File too large (max ${formatFileSize(maxSize)})`);
        } else if (accept && !matchesAccept(file, accept)) {
          errors.push(`${file.name}: File type not allowed`);
        } else {
          valid.push(file);
        }
      });

      return { valid, errors };
    },
    [maxSize, maxFiles, accept]
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);
      const { valid, errors } = validateFiles(fileArray);

      if (errors.length > 0) {
        triggerHaptic('error');
        // Show errors (you can integrate with toast system)
        console.error(errors);
        return;
      }

      if (valid.length === 0) return;

      triggerHaptic('medium');

      // Initialize uploading state
      const newUploadingFiles: UploadingFile[] = valid.map((file) => ({
        file,
        progress: 0,
        status: 'uploading' as const,
      }));

      setUploadingFiles(newUploadingFiles);

      try {
        // Simulate progress (replace with real upload progress)
        for (let i = 0; i <= 100; i += 10) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          setUploadingFiles((prev) =>
            prev.map((f) => ({ ...f, progress: i }))
          );
        }

        await onUpload(valid);

        // Mark as success
        setUploadingFiles((prev) =>
          prev.map((f) => ({ ...f, status: 'success' as const, progress: 100 }))
        );

        triggerHaptic('success');

        // Clear after 2 seconds
        setTimeout(() => {
          setUploadingFiles([]);
        }, 2000);
      } catch (error) {
        triggerHaptic('error');
        setUploadingFiles((prev) =>
          prev.map((f) => ({
            ...f,
            status: 'error' as const,
            error: error instanceof Error ? error.message : 'Upload failed',
          }))
        );
      }
    },
    [validateFiles, onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      dragCounterRef.current = 0;
      setIsDragging(false);

      if (disabled) return;

      handleFiles(e.dataTransfer.files);
    },
    [disabled, handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      dragCounterRef.current++;

      if (!disabled && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current--;

    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleClick = useCallback(() => {
    if (!disabled) {
      triggerHaptic('selection');
      fileInputRef.current?.click();
    }
  }, [disabled]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      // Reset input
      e.target.value = '';
    },
    [handleFiles]
  );

  return (
    <div className={className}>
      {/* Drop Zone */}
      <LazyMotionDiv
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        whileHover={!disabled ? { scale: 1.01 } : undefined}
        whileTap={!disabled ? { scale: 0.99 } : undefined}
        style={{
          padding: ds.spacing[10],
          borderRadius: ds.borderRadius.xl,
          border: `2px dashed ${
            isDragging
              ? ds.colors.interactive.primary
              : ds.colors.separator.nonOpaque
          }`,
          backgroundColor: isDragging
            ? `${ds.colors.interactive.primary}10`
            : ds.colors.background.secondary,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          opacity: disabled ? 0.5 : 1,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '48px',
            marginBottom: ds.spacing[4],
          }}
        >
          {isDragging ? '📥' : '📤'}
        </div>

        <div
          style={{
            ...ds.typography.textStyles.headline,
            color: ds.colors.text.primary,
            marginBottom: ds.spacing[2],
          }}
        >
          {isDragging ? 'Drop files here' : 'Upload Files'}
        </div>

        <div
          style={{
            ...ds.typography.textStyles.callout,
            color: ds.colors.text.secondary,
            marginBottom: ds.spacing[3],
          }}
        >
          Drag and drop or click to browse
        </div>

        <div
          style={{
            ...ds.typography.textStyles.footnote,
            color: ds.colors.text.tertiary,
          }}
        >
          {accept && `Accepted: ${accept}`}
          {accept && maxSize && ' • '}
          {maxSize && `Max size: ${formatFileSize(maxSize)}`}
          {(accept || maxSize) && multiple && maxFiles && ' • '}
          {multiple && maxFiles && `Up to ${maxFiles} files`}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
          disabled={disabled}
        />
      </LazyMotionDiv>

      {/* Upload Progress */}
      <div
        className={`collapsible-content ${uploadingFiles.length > 0 ? 'expanded' : ''}`}
        style={{ marginTop: uploadingFiles.length > 0 ? ds.spacing[5] : 0 }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: ds.spacing[3],
          }}
        >
          {uploadingFiles.map((uploadingFile, index) => (
            <UploadProgress
              key={`${uploadingFile.file.name}-${index}`}
              file={uploadingFile}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// UPLOAD PROGRESS ITEM
// ============================================================================

interface UploadProgressProps {
  file: UploadingFile;
}

const UploadProgress: React.FC<UploadProgressProps> = ({ file }) => {
  const ds = useDesignSystem();

  const getStatusIcon = () => {
    switch (file.status) {
      case 'uploading':
        return '⏳';
      case 'success':
        return '✓';
      case 'error':
        return '✕';
    }
  };

  const getStatusColor = () => {
    switch (file.status) {
      case 'uploading':
        return ds.colors.interactive.primary;
      case 'success':
        return ds.colors.feedback.success;
      case 'error':
        return ds.colors.feedback.error;
    }
  };

  return (
    <LazyMotionDiv
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      style={{
        padding: ds.spacing[4],
        backgroundColor: ds.colors.background.secondary,
        borderRadius: ds.borderRadius.lg,
        border: `1px solid ${ds.colors.separator.nonOpaque}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: ds.spacing[3],
        }}
      >
        <div style={{ flex: 1, minWidth: 0, marginRight: ds.spacing[3] }}>
          <div
            style={{
              ...ds.typography.textStyles.callout,
              color: ds.colors.text.primary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {file.file.name}
          </div>
          <div
            style={{
              ...ds.typography.textStyles.caption1,
              color: ds.colors.text.secondary,
            }}
          >
            {formatFileSize(file.file.size)}
            {file.error && ` • ${file.error}`}
          </div>
        </div>

        <div
          style={{
            fontSize: '20px',
            color: getStatusColor(),
          }}
        >
          {getStatusIcon()}
        </div>
      </div>

      {/* Progress Bar */}
      {file.status === 'uploading' && (
        <div
          style={{
            width: '100%',
            height: '4px',
            backgroundColor: ds.colors.fill.tertiary,
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            className="transition-transform duration-200 origin-left"
            style={{
              height: '100%',
              backgroundColor: ds.colors.interactive.primary,
              transform: `scaleX(${file.progress / 100})`,
            }}
          />
        </div>
      )}
    </LazyMotionDiv>
  );
};

// ============================================================================
// UTILITIES
// ============================================================================

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const matchesAccept = (file: File, accept: string): boolean => {
  const acceptTypes = accept.split(',').map((type) => type.trim());

  return acceptTypes.some((type) => {
    if (type.startsWith('.')) {
      return file.name.toLowerCase().endsWith(type.toLowerCase());
    }
    if (type.endsWith('/*')) {
      const mainType = type.split('/')[0];
      return file.type.startsWith(mainType + '/');
    }
    return file.type === type;
  });
};

export default FileUpload;
