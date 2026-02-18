import React, { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Document, Page, pdfjs } from 'react-pdf';
import JSZip from 'jszip';
import FileDropzone from './FileDropzone';
import { DownloadIcon } from './Icons';
import Spinner from './Spinner';
import type { LoadedPdfFile, PageInProcessing } from '../types';

// Worker設定
if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

// 日本語対応のためのCMap設定
const pdfOptions = {
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
};

// アイコンたち（結合機能と同じデザイン）
const EyeIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const XMarkIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const PdfSplitter: React.FC = () => {
    const [loadedFile, setLoadedFile] = useState<LoadedPdfFile | null>(null);
    const [pages, setPages] = useState<PageInProcessing[]>([]);
    const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>('');
    
    // 拡大プレビュー表示中のページ
    const [previewPage, setPreviewPage] = useState<PageInProcessing | null>(null);

    const handleFileAccepted = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        setError(null);
        setIsProcessing(true);
        resetState();

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const fileId = `${file.name}-${Date.now()}`;
            const pageCount = pdfDoc.getPageCount();

            const newFile: LoadedPdfFile = { id: fileId, file, pageCount };
            setLoadedFile(newFile);

            const newPages: PageInProcessing[] = Array.from({ length: pageCount }, (_, i) => ({
                id: `${fileId}-page-${i}`,
                sourceFileId: fileId,
                originalPageIndex: i + 1,
            }));
            setPages(newPages);
        } catch (e) {
            console.error("Failed to load PDF:", e);
            setError(`Could not process ${file.name}. It may be corrupted or protected.`);
            resetState();
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const togglePageSelection = (pageId: string) => {
        setSelectedPages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(pageId)) {
                newSet.delete(pageId);
            } else {
                newSet.add(pageId);
            }
            return newSet;
        });
    };

    const selectAll = () => {
        const allIds = new Set(pages.map(p => p.id));
        setSelectedPages(allIds);
    };

    const deselectAll = () => {
        setSelectedPages(new Set());
    };

    const generateFileName = (originalName: string, pageIndices: number[]) => {
        const baseName = originalName.replace(/\.pdf$/i, '');
        const sortedPages = [...pageIndices].sort((a, b) => a - b);
        
        let pageStr = '';
        if (sortedPages.length === 1) {
            pageStr = `p${sortedPages[0]}`;
        } else {
            let isContinuous = true;
            for (let i = 0; i < sortedPages.length - 1; i++) {
                if (sortedPages[i + 1] !== sortedPages[i] + 1) {
                    isContinuous = false;
                    break;
                }
            }

            if (isContinuous) {
                pageStr = `p${sortedPages[0]}-${sortedPages[sortedPages.length - 1]}`;
            } else {
                pageStr = `p${sortedPages.join(',')}`;
            }
        }

        return `${baseName}_${pageStr}.pdf`;
    };

    const handleExtractSelected = async () => {
        if (!loadedFile || selectedPages.size === 0) return;
        
        setIsProcessing(true);
        setError(null);
        setProgress('PDFを作成中...');

        try {
            const newPdf = await PDFDocument.create();
            const sourceBytes = await loadedFile.file.arrayBuffer();
            const sourcePdf = await PDFDocument.load(sourceBytes);

            const selectedPagesList = pages.filter(p => selectedPages.has(p.id));
            const pageIndices = selectedPagesList.map(p => p.originalPageIndex - 1);

            const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
            copiedPages.forEach(page => newPdf.addPage(page));

            const newPdfBytes = await newPdf.save();
            const blob = new Blob([new Uint8Array(newPdfBytes)], { type: 'application/pdf' });
            
            const fileName = generateFileName(loadedFile.file.name, selectedPagesList.map(p => p.originalPageIndex));

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
        } catch (e) {
            console.error(e);
            setError("PDF作成中にエラーが発生しました。");
        } finally {
            setIsProcessing(false);
            setProgress('');
        }
    };

    const handleExplodeToZip = async () => {
        if (!loadedFile) return;

        setIsProcessing(true);
        setError(null);
        setProgress('全ページを分割処理中...');

        try {
            const zip = new JSZip();
            const sourceBytes = await loadedFile.file.arrayBuffer();
            const sourcePdf = await PDFDocument.load(sourceBytes);
            const totalPages = sourcePdf.getPageCount();
            const baseName = loadedFile.file.name.replace(/\.pdf$/i, '');

            for (let i = 0; i < totalPages; i++) {
                setProgress(`${i + 1} / ${totalPages} ページを処理中...`);
                
                const newPdf = await PDFDocument.create();
                const [copiedPage] = await newPdf.copyPages(sourcePdf, [i]);
                newPdf.addPage(copiedPage);
                
                const pdfBytes = await newPdf.save();
                const fileName = `${baseName}_p${i + 1}.pdf`;
                zip.file(fileName, pdfBytes);
            }

            setProgress('ZIPファイルを作成中...');
            
            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${baseName}_all_pages.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (e) {
            console.error(e);
            setError("一括分割中にエラーが発生しました。");
        } finally {
            setIsProcessing(false);
            setProgress('');
        }
    };

    const resetState = () => {
        setLoadedFile(null);
        setPages([]);
        setSelectedPages(new Set());
        setError(null);
        setProgress('');
    };

    return (
        <div className="w-full">
            <h2 className="text-2xl font-bold text-center mb-1 text-slate-800">PDFを抽出・分割するけんね✂️</h2>
            <p className="text-center text-slate-500 mb-6">
                Select pages to extract. Click the eye icon to preview.
            </p>

            {!loadedFile ? (
                <div className="max-w-2xl mx-auto">
                    <FileDropzone
                        onFilesAccepted={handleFileAccepted}
                        label="Select a PDF file"
                    />
                    {isProcessing && !error && <div className="mt-4 flex justify-center"><Spinner /></div>}
                </div>
            ) : (
                <>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex gap-2">
                            <button onClick={selectAll} className="text-sm px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100">全選択</button>
                            <button onClick={deselectAll} className="text-sm px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100">全解除</button>
                        </div>
                        <div className="text-sm font-bold text-slate-700">
                            {selectedPages.size} ページ選択中
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg shadow-md mb-6 max-h-[60vh] overflow-y-auto">
                        <Document
                            file={loadedFile.file}
                            options={pdfOptions}
                            loading={<div className="text-center p-4">PDFを読み込み中...</div>}
                            className="flex flex-wrap gap-4 justify-center"
                        >
                            {pages.map((page) => (
                                <div
                                    key={page.id}
                                    className="relative group cursor-pointer w-36 h-48"
                                    onClick={() => togglePageSelection(page.id)}
                                >
                                    {/* 枠線と背景 */}
                                    <div className={`w-full h-full bg-slate-100 border border-slate-200 rounded-md shadow-sm overflow-hidden flex items-center justify-center transition-all ${selectedPages.has(page.id) ? 'ring-4 ring-blue-500' : 'ring-2 ring-transparent'}`}>
                                        <Page
                                            pageNumber={page.originalPageIndex}
                                            width={144}
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                            loading={<div className="w-full h-full bg-slate-100 animate-pulse" />}
                                        />
                                    </div>
                                    
                                    {/* 選択時の青いチェックマークオーバーレイ */}
                                    {selectedPages.has(page.id) && (
                                        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 rounded-md pointer-events-none flex items-center justify-center z-0">
                                            <div className="bg-blue-600 text-white rounded-full p-1 opacity-50">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* 🔵 プレビューボタン（中央）: ど真ん中で「見る」をアピール！ */}
                                    {/* グループホバーで表示。クリック時は選択処理を止める(stopPropagation) */}
                                    <div className="absolute inset-0 flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                         <button 
                                            onClick={(e) => {
                                                e.stopPropagation(); // 選択（チェック）が切り替わらないように！
                                                setPreviewPage(page);
                                            }}
                                            className="p-3 bg-blue-500 bg-opacity-90 text-white rounded-full shadow-lg hover:bg-blue-600 hover:scale-110 transition-all duration-200"
                                            title="拡大して確認"
                                        >
                                            <EyeIcon className="w-8 h-8" />
                                        </button>
                                    </div>

                                    {/* 左上のチェックボックス */}
                                    <div className="absolute top-2 left-2 z-10">
                                        <input
                                            type="checkbox"
                                            checked={selectedPages.has(page.id)}
                                            readOnly
                                            className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 pointer-events-none"
                                        />
                                    </div>

                                    {/* 右下のページ番号 */}
                                    <div className="absolute bottom-1 right-1 bg-black bg-opacity-50 text-white text-xs px-1.5 py-0.5 rounded pointer-events-none z-10">
                                        p.{page.originalPageIndex}
                                    </div>
                                </div>
                            ))}
                        </Document>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={handleExtractSelected}
                            disabled={selectedPages.size === 0 || isProcessing}
                            className="w-full sm:w-auto bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors flex items-center justify-center space-x-2"
                        >
                            {isProcessing && selectedPages.size > 0 ? <Spinner /> : (
                                <>
                                    <DownloadIcon className="w-5 h-5" />
                                    <span>選択ページをダウンロード ({selectedPages.size}枚)</span>
                                </>
                            )}
                        </button>

                        <button
                            onClick={handleExplodeToZip}
                            disabled={isProcessing}
                            className="w-full sm:w-auto bg-slate-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-800 disabled:bg-slate-400 transition-colors flex items-center justify-center space-x-2"
                        >
                            {isProcessing && selectedPages.size === 0 ? <Spinner /> : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    <span>全ページ分割保存 (ZIP)</span>
                                </>
                            )}
                        </button>
                    </div>

                    {progress && <p className="text-center text-blue-600 font-bold mt-4 animate-pulse">{progress}</p>}

                    <div className="text-center mt-6">
                        <button onClick={resetState} disabled={isProcessing} className="text-sm text-slate-500 hover:text-slate-700 underline">
                            ファイルを閉じる
                        </button>
                    </div>
                </>
            )}
            {error && <p className="text-red-500 text-center mt-4">{error}</p>}

            {/* 拡大プレビュー用のモーダルウィンドウ */}
            {previewPage && loadedFile && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4 backdrop-blur-sm"
                    onClick={() => setPreviewPage(null)}
                >
                    <div 
                        className="bg-white rounded-lg shadow-2xl p-4 max-w-4xl max-h-[90vh] overflow-auto relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setPreviewPage(null)}
                            className="absolute top-2 right-2 text-slate-500 hover:text-red-500 bg-slate-100 hover:bg-red-50 rounded-full p-2 transition-colors z-10"
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                        
                        <div className="flex justify-center">
                            <Document file={loadedFile.file} options={pdfOptions}>
                                <Page 
                                    pageNumber={previewPage.originalPageIndex} 
                                    width={600}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                />
                            </Document>
                        </div>
                        <p className="text-center mt-4 font-bold text-slate-700">Page {previewPage.originalPageIndex}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PdfSplitter;