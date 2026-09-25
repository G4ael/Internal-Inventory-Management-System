// Contextos globais: avisos (toast), dados do banco e navegação entre telas.
import { createContext, useContext } from 'react';

export const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

export const DataCtx = createContext(null);
export const useData = () => useContext(DataCtx);

// ir(pagina, { acao, id, dados, busca }) · abrirCliente(id) · abrirBusca()
export const NavCtx = createContext(null);
export const useNav = () => useContext(NavCtx);
