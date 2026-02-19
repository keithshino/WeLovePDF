import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Document, Page, pdfjs } from 'react-pdf';
import FileDropzone from './FileDropzone';
import { DownloadIcon, XCircleIcon } from './Icons';
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

interface PdfFileWithUrl extends LoadedPdfFile {
    url: string;
}

// アイコンたち
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

const GripIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
    </svg>
);

// ★ここが超重要！ React.memo で包んで、ドラッグ中の無駄な再描画（パニック）を防ぐ！
const PdfPageThumbnail = React.memo(({ fileUrl, pageNumber }: { fileUrl: string, pageNumber: number }) => {
    return (
        <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden w-36 h-48 flex items-center justify-center">
            <Document 
                file={fileUrl} 
                loading={<div className="w-full h-full bg-slate-100 animate-pulse" />}
                options={pdfOptions}
            >
                <Page
                    pageNumber={pageNumber}
                    width={144}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                />
            </Document>
        </div>
    );
});

const PdfMerger: React.FC = () => {
    const [loadedFiles, setLoadedFiles] = useState<PdfFileWithUrl[]>([]);
    const [pages, setPages] = useState<PageInProcessing[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [previewData, setPreviewData] = useState<{ url: string, pageNumber: number } | null>(null);

    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            loadedFiles.forEach(f => URL.revokeObjectURL(f.url));
        };
    }, [loadedFiles]);

    const handleFilesAccepted = useCallback(async (acceptedFiles: File[]) => {
        setError(null);
        const currentFileNames = new Set(loadedFiles.map(f => f.file.name));
        const newFiles = acceptedFiles.filter(f => !currentFileNames.has(f.name));

        if (newFiles.length === 0) return;

        setIsProcessing(true);
        let currentLoadedFiles = [...loadedFiles];
        let currentPages = [...pages];

        for (const file of newFiles) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdfDoc = await PDFDocument.load(arrayBuffer);
                const fileId = file.name + '-' + Date.now();
                
                const fileUrl = URL.createObjectURL(file);

                currentLoadedFiles.push({ 
                    id: fileId, 
                    file, 
                    pageCount: pdfDoc.getPageCount(),
                    url: fileUrl
                });

                for (let i = 0; i < pdfDoc.getPageCount(); i++) {
                    currentPages.push({
                        id: fileId + '-page-' + i,
                        sourceFileId: fileId,
                        originalPageIndex: i + 1,
                    });
                }
            } catch (e) {
                console.error("Failed to load a PDF:", e);
                setError(`Could not process ${file.name}. It may be corrupted or protected.`);
            }
        }
        setLoadedFiles(currentLoadedFiles);
        setPages(currentPages);
        setIsProcessing(false);
    }, [loadedFiles, pages]);

    const removePage = (pageIdToRemove: string) => {
        setPages(currentPages => currentPages.filter(p => p.id !== pageIdToRemove));
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
        dragItem.current = position;
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => {
        dragOverItem.current = position;
    };

    const handleDrop = () => {
        const newPages = [...pages];
        if (dragItem.current !== null && dragOverItem.current !== null) {
            const dragItemContent = newPages.splice(dragItem.current, 1)[0];
            newPages.splice(dragOverItem.current, 0, dragItemContent);
            dragItem.current = null;
            dragOverItem.current = null;
            setPages(newPages);
        }
    };

    const handleMerge = async () => {
        if (pages.length === 0) {
            setError("No pages to merge. Please add some PDF files.");
            return;
        }
        setIsProcessing(true);
        setError(null);
        try {
            const mergedPdf = await PDFDocument.create();
            const sourcePdfs: { [key: string]: PDFDocument } = {};

            for (const page of pages) {
                if (!sourcePdfs[page.sourceFileId]) {
                    const loadedFile = loadedFiles.find(f => f.id === page.sourceFileId);
                    if (loadedFile) {
                        const sourceBytes = await loadedFile.file.arrayBuffer();
                        sourcePdfs[page.sourceFileId] = await PDFDocument.load(sourceBytes);
                    }
                }
                const sourcePdf = sourcePdfs[page.sourceFileId];
                if (sourcePdf) {
                    const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [page.originalPageIndex - 1]);
                    mergedPdf.addPage(copiedPage);
                }
            }

            const mergedPdfBytes = await mergedPdf.save();
            const blob = new Blob([new Uint8Array(mergedPdfBytes)], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'merged.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            setError("An error occurred while merging the PDFs.");
        } finally {
            setIsProcessing(false);
        }
    };

    const resetState = () => {
        loadedFiles.forEach(f => URL.revokeObjectURL(f.url));
        setLoadedFiles([]);
        setPages([]);
        setError(null);
        setIsProcessing(false);
    }

    const getFileForPage = (page: PageInProcessing) => {
        return loadedFiles.find(f => f.id === page.sourceFileId);
    }

    return (
        <div className="w-full">
            <h2 className="text-2xl font-bold text-center mb-1 text-slate-800">PDFを結合するけんね🖇️</h2>
            <p className="text-center text-slate-500 mb-6">
                PDFファイルをまとめて結合！<br/>
                <span className="text-blue-600 font-semibold">ドラッグ＆ドロップでページの順番を入れ替えられるバイ！👆</span>
            </p>

            {pages.length === 0 ? (
                <div className="max-w-2xl mx-auto">
                    <FileDropzone
                        onFilesAccepted={handleFilesAccepted}
                        label="Select PDF files to merge"
                        multiple={true}
                    />
                    {isProcessing && <div className="mt-4 flex justify-center"><Spinner /></div>}
                </div>
            ) : (
                <>
                    <div className="bg-white p-4 rounded-lg shadow-md mb-6">
                        <div className="flex flex-wrap gap-4 justify-center" onDrop={handleDrop}>
                            {pages.map((page, index) => {
                                const fileData = getFileForPage(page);
                                return fileData ? (
                                    <div
                                        key={page.id}
                                        className="relative group cursor-grab active:cursor-grabbing pt-2"
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragEnter={(e) => handleDragEnter(e, index)}
                                        onDragOver={(e) => e.preventDefault()}
                                    >
                                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 text-slate-300">
                                            <GripIcon className="w-6 h-6 transform rotate-90" />
                                        </div>

                                        <PdfPageThumbnail fileUrl={fileData.url} pageNumber={page.originalPageIndex} />
                                        
                                        <div className="absolute top-3 right-1 z-10">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removePage(page.id);
                                                }}
                                                className="p-1.5 bg-white text-red-500 rounded-full shadow-md opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all duration-200"
                                                title="ページを削除"
                                            >
                                                <XCircleIcon className="w-6 h-6" />
                                            </button>
                                        </div>

                                        <div className="absolute inset-0 top-2 flex items-center justify-center z-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                             <div className="pointer-events-auto">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPreviewData({ url: fileData.url, pageNumber: page.originalPageIndex });
                                                    }}
                                                    className="p-3 bg-blue-500 bg-opacity-90 text-white rounded-full shadow-lg hover:bg-blue-600 hover:scale-110 transition-all duration-200"
                                                    title="拡大して確認"
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                >
                                                    <EyeIcon className="w-8 h-8" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="absolute bottom-1 right-1 bg-black bg-opacity-50 text-white text-xs px-1.5 py-0.5 rounded pointer-events-none">
                                            {index + 1}
                                        </div>
                                    </div>
                                ) : null;
                            })}
                        </div>
                        <div className="mt-4 pt-4 border-t text-center">
                            <FileDropzone
                                onFilesAccepted={handleFilesAccepted}
                                label="Add more PDF files"
                                multiple={true}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={handleMerge}
                            disabled={isProcessing}
                            className="w-full sm:w-auto bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors flex items-center justify-center space-x-2"
                        >
                            {isProcessing ? <Spinner /> : <><DownloadIcon className="w-5 h-5" /><span>Merge and Download</span></>}
                        </button>
                        <button onClick={resetState} className="text-sm text-slate-500 hover:text-slate-700">Start Over</button>
                    </div>
                </>
            )}
            {error && <p className="text-red-500 text-center mt-4">{error}</p>}

            {/* 拡大プレビュー用のモーダル */}
            {previewData && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4 backdrop-blur-sm"
                    onClick={() => setPreviewData(null)}
                >
                    <div 
                        className="bg-white rounded-lg shadow-2xl p-4 max-w-4xl max-h-[90vh] overflow-auto relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setPreviewData(null)}
                            className="absolute top-2 right-2 text-slate-500 hover:text-red-500 bg-slate-100 hover:bg-red-50 rounded-full p-2 transition-colors z-10"
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                        
                        <div className="flex justify-center">
                            <Document file={previewData.url} options={pdfOptions}>
                                <Page 
                                    pageNumber={previewData.pageNumber} 
                                    width={600} 
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                />
                            </Document>
                        </div>
                        <p className="text-center mt-4 font-bold text-slate-700">Page {previewData.pageNumber}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PdfMerger;