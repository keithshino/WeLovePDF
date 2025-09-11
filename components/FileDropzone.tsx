import React, { useState, useRef, useCallback } from 'react';
import { UploadIcon } from './Icons';

interface FileDropzoneProps {
  onFilesAccepted: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  label: string;
}

const FileDropzone: React.FC<FileDropzoneProps> = ({ onFilesAccepted, accept = "application/pdf", multiple = false, label }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Fix: Explicitly type 'file' as 'File' to resolve type inference issue.
      const acceptedFiles = Array.from(e.dataTransfer.files).filter((file: File) => file.type === 'application/pdf');
      if (acceptedFiles.length > 0) {
          onFilesAccepted(multiple ? acceptedFiles : [acceptedFiles[0]]);
      } else {
        alert("Please drop PDF files only.");
      }
    }
  }, [onFilesAccepted, multiple]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesAccepted(Array.from(e.target.files));
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={onButtonClick}
      className={`border-2 border-dashed rounded-lg p-8 sm:p-12 text-center cursor-pointer transition-colors duration-200 ease-in-out ${
        isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:border-slate-400'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
      />
      <div className="flex flex-col items-center justify-center space-y-4 text-slate-500">
        <UploadIcon className="w-12 h-12 text-slate-400" />
        <p className="font-semibold">{label}</p>
        <p className="text-sm">or drag and drop here</p>
      </div>
    </div>
  );
};

export default FileDropzone;