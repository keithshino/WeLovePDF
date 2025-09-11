import React, { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import FileDropzone from './FileDropzone';
import { DownloadIcon, CheckCircleIcon } from './Icons';
import Spinner from './Spinner';

interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  reduction: number;
  fileName: string;
  data: Uint8Array;
}

const PdfCompressor: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileAccepted = useCallback((files: File[]) => {
    setFile(files[0]);
    setResult(null);
    setError(null);
  }, []);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handleCompress = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      const compressedBytes = await pdfDoc.save();

      const originalSize = file.size;
      const compressedSize = compressedBytes.length;
      const reduction = ((originalSize - compressedSize) / originalSize) * 100;

      setResult({
        originalSize,
        compressedSize,
        reduction,
        fileName: `compressed-${file.name}`,
        data: compressedBytes,
      });

    } catch (e) {
      console.error(e);
      setError('Failed to process the PDF. It might be corrupted or protected.');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadCompressedFile = () => {
    if (!result) return;
    const blob = new Blob([result.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetState = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setIsProcessing(false);
  };
  
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center mb-1 text-slate-800">PDF Compressor</h2>
        <p className="text-center text-slate-500 mb-6">Reduce the file size of your PDF while optimizing for quality.</p>
        
        {!file && (
          <FileDropzone 
            onFilesAccepted={handleFileAccepted}
            label="Select a PDF file to compress"
          />
        )}

        {file && !result && (
          <div className="text-center">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4 text-left">
              <p className="font-semibold text-slate-700 break-words">{file.name}</p>
              <p className="text-sm text-slate-500">{formatBytes(file.size)}</p>
            </div>
            <button
              onClick={handleCompress}
              disabled={isProcessing}
              className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors flex items-center justify-center"
            >
              {isProcessing ? <Spinner /> : 'Compress PDF'}
            </button>
             <button onClick={resetState} className="mt-4 text-sm text-slate-500 hover:text-slate-700">Choose a different file</button>
          </div>
        )}
        
        {error && <p className="text-red-500 text-center mt-4">{error}</p>}

        {result && (
           <div className="text-center transition-all duration-500 ease-in-out">
             <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center justify-center space-x-3">
              <CheckCircleIcon className="w-8 h-8 text-green-500"/>
              <p className="font-semibold text-green-700 text-lg">Compression Successful!</p>
             </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center mb-6">
                <div>
                    <p className="text-sm text-slate-500">Original Size</p>
                    <p className="text-lg font-semibold">{formatBytes(result.originalSize)}</p>
                </div>
                <div>
                    <p className="text-sm text-slate-500">New Size</p>
                    <p className="text-lg font-semibold text-blue-600">{formatBytes(result.compressedSize)}</p>
                </div>
                <div>
                    <p className="text-sm text-slate-500">Reduction</p>
                    <p className="text-lg font-semibold text-green-600">{result.reduction.toFixed(1)}%</p>
                </div>
            </div>

            <button
              onClick={downloadCompressedFile}
              className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
            >
              <DownloadIcon className="w-5 h-5"/>
              <span>Download Compressed PDF</span>
            </button>
            <button onClick={resetState} className="mt-4 text-sm text-slate-500 hover:text-slate-700">Compress another file</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfCompressor;
