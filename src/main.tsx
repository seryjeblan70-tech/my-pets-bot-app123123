import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// если есть глобальные стили, можно импортировать index.css

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)