// Entrada da versão de demonstração: o mesmo sistema, com dados fictícios na memória.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import App from '../App.jsx';

// Janelas de confirmação ("Remover?") não aparecem em todo lugar onde a demo é aberta
window.confirm = () => true;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <div style={{
      position: 'fixed', left: '50%', bottom: 12, transform: 'translateX(-50%)', zIndex: 90, pointerEvents: 'none',
      background: 'var(--tinta)', color: 'var(--fundo)', borderRadius: 999, padding: '6px 14px', fontSize: 12.5, fontWeight: 600,
      boxShadow: '0 10px 24px -10px rgba(0,0,0,.4)', whiteSpace: 'nowrap'
    }}>
      Demonstração · dados fictícios, nada é salvo
    </div>
  </StrictMode>
);
