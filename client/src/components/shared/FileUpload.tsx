import React, { useRef, useState } from 'react';
import { Button } from './Button';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  label?: string;
  helperText?: string;
  error?: string;
  maxSizeMB?: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  accept = 'image/*',
  label = 'Upload file',
  helperText,
  error,
  maxSizeMB = 5,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeMB * 1024 * 1024) {
      setSizeError(`File too large. Maximum size is ${maxSizeMB}MB.`);
      return;
    }

    setSizeError(null);
    setFileName(file.name);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    onFileSelect(file);
  };

  return (
    <div className="w-full">
      {label && <p className="text-sm font-medium text-surface-700 mb-1.5">{label}</p>}

      <div
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
          ${error || sizeError ? 'border-red-400 bg-red-50' : 'border-surface-300 hover:border-primary-400 hover:bg-primary-50/30'}`}
      >
        {preview ? (
          <img src={preview} alt="Preview" className="mx-auto max-h-32 rounded-lg object-cover mb-2" />
        ) : (
          <div className="mb-2">
            <svg className="mx-auto h-10 w-10 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
        )}

        {fileName ? (
          <p className="text-sm text-primary-700 font-medium">{fileName}</p>
        ) : (
          <div>
            <Button type="button" variant="secondary" size="sm">
              Choose file
            </Button>
            <p className="text-xs text-surface-500 mt-1">or drag and drop</p>
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />

      {(error || sizeError) && <p className="mt-1 text-xs text-red-600">{error || sizeError}</p>}
      {helperText && !error && !sizeError && <p className="mt-1 text-xs text-surface-500">{helperText}</p>}
    </div>
  );
};
