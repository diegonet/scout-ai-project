import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Determines the initial theme based on local storage preference or system preference.
 * Defaults to 'light' if no preference is found or an error occurs.
 * @returns {Theme} The initial theme state.
 */
const getInitialTheme = (): Theme => {
    try {
        const storedTheme = window.localStorage.getItem('scout-ai-theme');
        if (storedTheme === 'light' || storedTheme === 'dark') {
            return storedTheme;
        }
        
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
    } catch (error) {
        console.error("Could not access local storage or system theme preference.", error);
    }
    return 'light';
};

/**
 * Provides the current theme state and a function to toggle it to its children components.
 * It also applies the theme class to the document root element (html tag).
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The child components to be wrapped by the provider.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>(getInitialTheme);

    useEffect(() => {
        const root = window.document.documentElement;
        
        root.classList.remove(theme === 'dark' ? 'light' : 'dark');
        root.classList.add(theme);

        try {
            window.localStorage.setItem('scout-ai-theme', theme);
        } catch (error) {
            console.error(`Failed to save theme '${theme}' to local storage.`, error);
        }

    }, [theme]);

    const toggleTheme = useCallback(() => {
        setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    }, []);

    const value = { theme, toggleTheme };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

/**
 * Custom hook to easily access the theme context value.
 * Throws an error if used outside of a ThemeProvider.
 * @returns {ThemeContextValue} The current theme context object.
 */
export const useTheme = (): ThemeContextValue => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
