/**
 * Document Upload Component
 * Story 6-1: Bank-Auditor Workflow
 * Epic 6: Production Workflows
 * 
 * File upload component with progress indicator and validation
 */

'use client';

import { useState, useRef } from 'react';
import { Upload, File, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface DocumentUploadProps {
  onUpload: (formData: FormData) => Promise<void>;
  uploading: boolean;
}

export function DocumentUpload({ onUpload, uploading }: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const validFormats = ['application/pdf', 'image/jpeg', 'image/png'];
  const maxSize = 10 * 1024 * 1024; // 10 MB

  /**
   * Handle file selection
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    
    if (!selectedFile) {
      return;
    }

    // Validate file format
    if (!validFormats.includes(selectedFile.type)) {
      setError('Invalid file format. Please upload PDF, JPEG, or PNG files.');
      return;
    }

    // Validate file size
    if (selectedFile.size > maxSize) {
      setError('File size exceeds 10 MB limit.');
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  /**
   * Handle file upload
   */
  const handleUpload = async () => {
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('groupId', 'allura-system'); // TODO: Get from props/context

    try {
      setProgress(50);
      await onUpload(formData);
      setProgress(100);
      
      // Reset after successful upload
      setTimeout(() => {
        setFile(null);
        setProgress(0);
        if (inputRef.current) {
          inputRef.current.value = '';
        }
      }, 1000);
    } catch (err) {
      setError('Upload failed. Please try again.');
      setProgress(0);
    }
  };

  /**
   * Clear selected file
   */
  const handleClear = () => {
    setFile(null);
    setError(null);
    setProgress(0);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  /**
   * Get file extension
   */
  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toUpperCase() || 'FILE';
  };

  return (
    <div className="space-y-4">
      {/* File Input */}
      <div className="grid w-full max-w-sm items-center gap-1.5">
        <label 
          htmlFor="document-upload" 
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Upload Document
        </label>
        <input
          ref={inputRef}
          id="document-upload"
          type="file"
          accept=".pdf,.jpeg,.jpg,.png"
          onChange={handleFileSelect}
          disabled={uploading}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <p className="text-xs text-muted-foreground">
          Supported formats: PDF, JPEG, PNG (max 10 MB)
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <X className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Selected File */}
      {file && (
        <div className="p-4 border rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <File className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {getFileExtension(file.name)} • {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Progress Bar */}
          {uploading && (
            <div className="mt-3">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                Uploading... {progress}%
              </p>
            </div>
          )}
        </div>
      )}

      {/* Upload Button */}
      <Button 
        onClick={handleUpload} 
        disabled={!file || uploading}
        className="w-full"
      >
        <Upload className="mr-2 h-4 w-4" />
        {uploading ? 'Uploading...' : 'Upload Document'}
      </Button>
    </div>
  );
}