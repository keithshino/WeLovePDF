export enum Tool {
  Compress = 'Compress',
  Merge = 'Merge',
  Split = 'Split',
}

// Represents a single page from an uploaded PDF for manipulation
export interface PageInProcessing {
  id: string; // Unique ID for this page instance
  sourceFileId: string; // ID of the PdfFile it came from
  originalPageIndex: number; // The 1-based page number in the original PDF
}

// Represents an uploaded PDF file
export interface LoadedPdfFile {
  id: string; // Unique ID for this file upload
  file: File;
  pageCount: number;
}
