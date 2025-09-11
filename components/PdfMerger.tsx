import React, { useState, useCallback, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Document, Page } from 'react-pdf';
import FileDropzone from './FileDropzone';
import { DownloadIcon, XCircleIcon } from './Icons';
import Spinner from './Spinner';
import type { LoadedPdfFile, PageInProcessing } from '../types';

const PdfPageThumbnail: React.FC<{ file: File, pageNumber: number }> = ({ file, pageNumber }) => {
    return (
        <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden w-36 h-48 flex items-center justify-center">
             <Document file={file} loading={<div className="w-full h-full bg-slate-100 animate-pulse" />}>
                <Page 
                    pageNumber={pageNumber} 
                    width={144} 
                    renderTextLayer={false}
                    renderAnnotationLayer={false} 
                />
            </Document>
        </div>
    );
};

const PdfMerger: React.FC = () => {
    const [loadedFiles, setLoadedFiles] = useState<LoadedPdfFile[]>([]);
    const [pages, setPages] = useState<PageInProcessing[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    const handleFilesAccepted = useCallback(async (acceptedFiles: File[]) => {
        setError(null);
        const currentFileNames = new Set(loadedFiles.map(f => f.file.name));
        const newFiles = acceptedFiles.filter(f => !currentFileNames.has(f.name));
        
        if (newFiles.length === 0) return;

        setIsProcessing(true);
        const newLoadedFiles: LoadedPdfFile[] = [...loadedFiles];
        const newPages: PageInProcessing[] = [...pages];

        for (const file of newFiles) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdfDoc = await PDFDocument.load(arrayBuffer);
                const fileId = `${file.name}-${Date.now()}`;
                
                newLoadedFiles.push({ id: fileId, file, pageCount: pdfDoc.getPageCount() });

                for (let i = 0; i < pdfDoc.getPageCount(); i++) {
                    newPages.push({
                        id: `${fileId}-page-${i}`,
                        sourceFileId: fileId,
                        originalPageIndex: i + 1,
                    });
                }
            } catch (e) {
                console.error("Failed to load a PDF:", e);
                setError(`Could not process ${file.name}. It may be corrupted or protected.`);
            }
        }
        setLoadedFiles(newLoadedFiles);
        setPages(newPages);
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
                if(sourcePdf) {
                    const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [page.originalPageIndex - 1]);
                    mergedPdf.addPage(copiedPage);
                }
            }

            const mergedPdfBytes = await mergedPdf.save();
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
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
      setLoadedFiles([]);
      setPages([]);
      setError(null);
      setIsProcessing(false);
    }
    
    const getFileForPage = (page: PageInProcessing) => {
        return loadedFiles.find(f => f.id === page.sourceFileId)?.file;
    }

    return (
        <div className="w-full">
            <h2 className="text-2xl font-bold text-center mb-1 text-slate-800">PDF Merger</h2>
            <p className="text-center text-slate-500 mb-6">Combine PDFs. Drag and drop to reorder pages.</p>
            
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
                                const file = getFileForPage(page);
                                return file ? (
                                    <div
                                        key={page.id}
                                        className="relative group cursor-grab"
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragEnter={(e) => handleDragEnter(e, index)}
                                        onDragOver={(e) => e.preventDefault()}
                                    >
                                        <PdfPageThumbnail file={file} pageNumber={page.originalPageIndex} />
                                        <div className="absolute top-1 right-1">
                                            <button onClick={() => removePage(page.id)} className="p-1 bg-black bg-opacity-50 rounded-full text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-opacity">
                                                <XCircleIcon className="w-5 h-5"/>
                                            </button>
                                        </div>
                                        <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1.5 py-0.5 rounded">
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
                           {isProcessing ? <Spinner /> : <><DownloadIcon className="w-5 h-5"/><span>Merge and Download</span></>}
                        </button>
                        <button onClick={resetState} className="text-sm text-slate-500 hover:text-slate-700">Start Over</button>
                    </div>
                </>
            )}
             {error && <p className="text-red-500 text-center mt-4">{error}</p>}
        </div>
    );
};

export default PdfMerger;
