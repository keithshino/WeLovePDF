import React, { useState, useMemo } from 'react';
import PdfCompressor from './components/PdfCompressor';
import PdfMerger from './components/PdfMerger';
import PdfSplitter from './components/PdfSplitter';
import { Tool } from './types.ts';
import { GithubIcon } from './components/Icons';

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<Tool>(Tool.Compress);

  const renderTool = () => {
    switch (activeTool) {
      case Tool.Compress:
        return <PdfCompressor />;
      case Tool.Merge:
        return <PdfMerger />;
      case Tool.Split:
        return <PdfSplitter />;
      default:
        return null;
    }
  };

  const tabs = useMemo(() => [Tool.Compress, Tool.Merge, Tool.Split], []);

  const tabJapanese: { [key in Tool]: string } = {
    [Tool.Compress]: '圧縮',
    [Tool.Merge]: '結合',
    [Tool.Split]: '分割',
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h.01a1 1 0 100-2H10zm3 0a1 1 0 000 2h.01a1 1 0 100-2H13z" clipRule="evenodd" />
              </svg>
              <h1 className="text-2xl font-bold text-slate-800">WeLovePDF</h1>
            </div>
            <a href="https://github.com/google-gemini/generative-ai-docs" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-800" aria-label="Github Repository">
              <GithubIcon className="w-6 h-6" />
            </a>
          </div>
          <div className="flex border-b border-slate-200">
            {tabs.map((tool) => (
              <button
                key={tool}
                onClick={() => setActiveTool(tool)}
                className={`py-3 px-4 sm:px-6 text-sm font-semibold transition-colors duration-200 ease-in-out focus:outline-none ${activeTool === tool
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'border-b-2 border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
              >
                {tabJapanese[tool]}
              </button>
            ))}
          </div>
        </nav>
      </header>
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-green-500 text-white text-center py-4 rounded-lg shadow-md mb-4">
          Tailwind は動いとるばい！🌸
        </div>
        {renderTool()}
      </main>
      <footer className="text-center py-4 text-sm text-slate-500 bg-white border-t">
        <p>&copy; {new Date().getFullYear()} shinoharaKsuke. All processing is done in your browser.</p>
      </footer>
    </div>
  );
};

export default App;
