import React, { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { pdfjs } from 'react-pdf';
import FileDropzone from './FileDropzone';
import { DownloadIcon, CheckCircleIcon } from './Icons';
import Spinner from './Spinner';

// 結果表示用の型定義
interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  reduction: number;
  fileName: string;
  data: Uint8Array;
}

// ✨ 圧縮レベルを2択に変更＆微調整 ✨
const COMPRESSION_LEVELS = [
    { label: '標準 (推奨)', quality: 0.7, scale: 0.9 }, // バランス型
    { label: '高画質 (低圧縮)', quality: 0.8, scale: 1.0 }, // 綺麗さ優先
];

const PdfCompressor: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  
  // デフォルトを「0番目（標準）」にする
  const [compressionLevel, setCompressionLevel] = useState(0);

  // Workerの設定（必須）
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }

  const handleFileAccepted = useCallback((files: File[]) => {
    setFile(files[0]);
    setResult(null);
    setError(null);
    setProgress('');
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
    setProgress('準備中...');

    try {
      // 1. 元のPDFを読み込む
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument(new Uint8Array(arrayBuffer));
      const pdfViewerDoc = await loadingTask.promise;

      // 2. 新しい空のPDFを作る
      const newPdfDoc = await PDFDocument.create();
      const totalPages = pdfViewerDoc.numPages;
      const settings = COMPRESSION_LEVELS[compressionLevel];

      // 3. 全ページを画像化して貼り付け直す
      for (let i = 1; i <= totalPages; i++) {
        setProgress(`${i} / ${totalPages} ページ目を処理中...`);

        const page = await pdfViewerDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 * settings.scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (!context) throw new Error("Canvas context error");

        await page.render({ canvasContext: context, viewport: viewport }).promise;

        const imgDataUrl = canvas.toDataURL('image/jpeg', settings.quality);
        const jpgImage = await newPdfDoc.embedJpg(imgDataUrl);

        const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);
        newPage.drawImage(jpgImage, {
            x: 0,
            y: 0,
            width: viewport.width,
            height: viewport.height,
        });
      }

      setProgress('仕上げ処理中...');

      // 4. 保存データを作成
      const compressedBytes = await newPdfDoc.save();

      // 5. 結果セット
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
      setError('圧縮中にエラーが発生しました。ファイルが壊れているか、保護されている可能性があります。');
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  const downloadCompressedFile = () => {
    if (!result) return;
    const blob = new Blob([new Uint8Array(result.data)], { type: 'application/pdf' });
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
    setProgress('');
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center mb-1 text-slate-800">PDFを圧縮するけんね📦</h2>
        <p className="text-center text-slate-500 mb-6">
            画像を最適化してファイルサイズを小さくするよ。<br/>
            <span className="text-xs text-amber-600">※ テキストは画像化されるため選択できなくなります。</span>
        </p>

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

            {/* 圧縮レベル選択ボタン（2択に変更） */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">圧縮レベル</label>
                <div className="flex flex-wrap justify-center gap-2">
                    {COMPRESSION_LEVELS.map((level, index) => (
                        <button
                            key={index}
                            onClick={() => setCompressionLevel(index)}
                            className={`px-4 py-2 text-sm rounded-full border transition-colors ${
                                compressionLevel === index
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            {level.label}
                        </button>
                    ))}
                </div>
            </div>

            <button
              onClick={handleCompress}
              disabled={isProcessing}
              className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors flex items-center justify-center"
            >
              {isProcessing ? <Spinner /> : 'Compress PDF'}
            </button>

            {progress && (
                <div className="mt-4">
                    <p className="text-sm text-blue-600 font-semibold animate-pulse">{progress}</p>
                    <div className="w-full bg-slate-200 rounded-full h-2 mt-2 overflow-hidden">
                        <div className="bg-blue-600 h-2 rounded-full animate-progress-indeterminate"></div>
                    </div>
                </div>
            )}

            <button onClick={resetState} disabled={isProcessing} className="mt-4 text-sm text-slate-500 hover:text-slate-700">Choose a different file</button>
          </div>
        )}

        {error && <p className="text-red-500 text-center mt-4">{error}</p>}

        {result && (
          <div className="text-center transition-all duration-500 ease-in-out">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center justify-center space-x-3">
              <CheckCircleIcon className="w-8 h-8 text-green-500" />
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
              <DownloadIcon className="w-5 h-5" />
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
