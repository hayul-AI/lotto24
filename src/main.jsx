import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// [디버깅] 브라우저 콘솔을 볼 수 없는 환경을 위해 에러를 화면에 팝업
window.onerror = function(message, source, lineno, colno, error) {
  const errorMsg = `JS Error: ${message}\nSource: ${source}\nLine: ${lineno}:${colno}`;
  console.error(errorMsg);
  alert(errorMsg); // 사용자에게 직접 에러 내용을 보여줌
};

window.addEventListener('unhandledrejection', function(event) {
  const errorMsg = `Unhandled Promise: ${event.reason}`;
  console.error(errorMsg);
  alert(errorMsg);
});

console.log("[Main] App starting...");

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    alert("Error: Root element not found");
    throw new Error("Root element not found");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
} catch (err) {
  alert("Critical Initialization Error: " + err.message);
  if (document.body) {
    document.body.innerHTML = `<div style="padding:20px; color:red;"><h1>초기화 오류</h1><pre>${err.stack}</pre></div>`;
  }
}
