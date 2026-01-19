import { createContext, useState, useContext } from 'react';

const ModuleContext = createContext();

export const ModuleProvider = ({ children }) => {
    // Varsayılan modül: 'IZIN'
    // Sayfa yenilenince kaybolmasın diye localStorage kullanıyoruz
    const [activeModule, setActiveModule] = useState(() => {
        return localStorage.getItem('active_module') || 'IZIN';
    });

    const changeModule = (moduleKey) => {
        setActiveModule(moduleKey);
        localStorage.setItem('active_module', moduleKey);
    };

    return (
        <ModuleContext.Provider value={{ activeModule, changeModule }}>
            {children}
        </ModuleContext.Provider>
    );
};

export const useModule = () => useContext(ModuleContext);