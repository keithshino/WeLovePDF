import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { pdfjs } from 'react-pdf';

// ↓↓↓ 【追加】これがないと、テキスト選択の位置がズレたりするけん、足しとこう！ ↓↓↓
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// ↓↓↓ 【修正】ここを「https」から始まる確実なURLにする！ ↓↓↓
// これでバージョン不一致も、http/httpsの混在エラーも全部防げる！
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
