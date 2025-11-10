import React, { createContext, useState, useContext, useCallback } from 'react';
import { translations, SUPPORTED_LANGUAGES } from '../utils/translations';

/**
 * Defines the structure of the value provided by the LanguageContext.
 */
interface LanguageContextValue {
    language: string;
    changeLanguage: (language: string) => void;
    t: (key: string, replacements?: { [key: string]: string | number }) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

/**
 * Provides the language state and translation utilities to its children.
 * It manages the current language and stores it in local storage.
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The child components to be wrapped by the provider.
 */
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<string>(() => {
        try {
            const savedLanguage = window.localStorage.getItem('tour-guide-language');
            // Check if the saved language is one of the supported ones to avoid invalid states
            const isSupported = SUPPORTED_LANGUAGES.some(lang => lang.code === savedLanguage);
            return savedLanguage && isSupported ? savedLanguage : 'en';
        } catch (error) {
            console.error("Could not access local storage, defaulting to 'en'.", error);
            return 'en';
        }
    });

    const changeLanguage = useCallback((lang: string) => {
        if (translations[lang]) {
            try {
                window.localStorage.setItem('tour-guide-language', lang);
                setLanguage(lang);
            } catch (error) {
                 console.error(`Failed to save language '${lang}' to local storage.`, error);
                 setLanguage(lang); // Still update state even if storage fails
            }
        } else {
            console.warn(`Language '${lang}' not supported. Defaulting to 'en'.`);
            try {
                 window.localStorage.setItem('tour-guide-language', 'en');
            } catch (error) {
                console.error("Failed to save default language to local storage.", error);
            }
            setLanguage('en');
        }
    }, []);

    const t = useCallback((key: string, replacements?: { [key: string]: string | number }) => {
        let translation = translations[language]?.[key] || translations['en']?.[key] || key;

        if (replacements) {
            Object.keys(replacements).forEach(placeholder => {
                translation = translation.replace(`{{${placeholder}}}`, String(replacements[placeholder]));
            });
        }
        
        return translation;

    // Fix: Corrected a typo in the dependency array from 'Language' to 'language'.
    }, [language]);

    const value = { language, changeLanguage, t };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};

/**
 * Custom hook to easily access the language context value.
 * Throws an error if used outside of a LanguageProvider.
 * @returns {LanguageContextValue} The current language context object.
 */
export const useTranslation = (): LanguageContextValue => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useTranslation must be used within a LanguageProvider');
    }
    return context;
};
