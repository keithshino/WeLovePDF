import React, { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Document, Page } from 'react-pdf';
import FileDropzone from './FileDropzone';
import { DownloadIcon, TrashIcon } from './Icons';
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


const PdfSplitter: React.FC = () => {
    const [loadedFile, setLoadedFile] = useState<LoadedPdfFile | null>(null);
    const [pages, setPages] = useState<PageInProcessing[]>([]);
    const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
    
    const deleteSelectedPages = () => {
        setPages(currentPages => currentPages.filter(p => !selectedPages.has(p.id)));
        setSelectedPages(new Set());
    };

    const handleCreatePdf = async () => {
        if (!loadedFile || pages.length === 0) {
            setError("No pages to create a PDF from.");
            return;
        }
        setIsProcessing(true);
        setError(null);
        try {
            const newPdf = await PDFDocument.create();
            const sourceBytes = await loadedFile.file.arrayBuffer();
            const sourcePdf = await PDFDocument.load(sourceBytes);
            
            const pageIndicesToKeep = pages.map(p => p.originalPageIndex - 1);
            const copiedPages = await newPdf.copyPages(sourcePdf, pageIndicesToKeep);
            copiedPages.forEach(page => newPdf.addPage(page));

            const newPdfBytes = await newPdf.save();
            const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `split-${loadedFile.file.name}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            setError("An error occurred while creating the new PDF.");
        } finally {
            setIsProcessing(false);
        }
    };
    
    const resetState = () => {
      setLoadedFile(null);
      setPages([]);
      setSelectedPages(new Set());
      setError(null);
    };

    return (
        <div className="w-full">
            <h2 className="text-2xl font-bold text-center mb-1 text-slate-800">PDF Splitter / Delete Pages</h2>
            <p className="text-center text-slate-500 mb-6">Select pages you want to delete from your PDF.</p>
            
            {!loadedFile ? (
                <div className="max-w-2xl mx-auto">
                    <FileDropzone 
                        onFilesAccepted={handleFileAccepted}
                        label="Select a PDF file to split"
                    />
                     {isProcessing && !error && <div className="mt-4 flex justify-center"><Spinner /></div>}
                </div>
            ) : (
                <>
                    <div className="bg-white p-4 rounded-lg shadow-md mb-6">
                        <div className="flex flex-wrap gap-4 justify-center">
                            {pages.map((page) => (
                                <div
                                    key={page.id}
                                    className="relative group cursor-pointer"
                                    onClick={() => togglePageSelection(page.id)}
                                >
                                    <div className={`transition-all rounded-lg overflow-hidden ${selectedPages.has(page.id) ? 'ring-4 ring-blue-500' : 'ring-2 ring-transparent'}`}>
                                        <PdfPageThumbnail file={loadedFile.file} pageNumber={page.originalPageIndex} />
                                    </div>
                                    <div className={`absolute inset-0 bg-black transition-opacity ${selectedPages.has(page.id) ? 'bg-opacity-20' : 'bg-opacity-0'}`}></div>
                                    <div className="absolute top-2 left-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedPages.has(page.id)}
                                            readOnly
                                            className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                    </div>
                                    <div className="absolute bottom-1 right-1 bg-black bg-opacity-50 text-white text-xs px-1.5 py-0.5 rounded">
                                        Page {page.originalPageIndex}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={deleteSelectedPages}
                            disabled={selectedPages.size === 0 || isProcessing}
                            className="w-full sm:w-auto bg-red-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-red-700 disabled:bg-red-300 transition-colors flex items-center justify-center space-x-2"
                        >
                           <TrashIcon className="w-5 h-5"/><span>Delete Selected ({selectedPages.size})</span>
                        </button>
                        <button
                            onClick={handleCreatePdf}
                            disabled={isProcessing || pages.length === 0}
                            className="w-full sm:w-auto bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors flex items-center justify-center space-x-2"
                        >
                           {isProcessing ? <Spinner /> : <><DownloadIcon className="w-5 h-5"/><span>Create PDF ({pages.length} Pages)</span></>}
                        </button>
                    </div>
                     <div className="text-center mt-4">
                        <button onClick={resetState} className="text-sm text-slate-500 hover:text-slate-700">Start Over</button>
                    </div>
                </>
            )}
             {error && <p className="text-red-500 text-center mt-4">{error}</p>}
        </div>
    );
};

export default PdfSplitter;
