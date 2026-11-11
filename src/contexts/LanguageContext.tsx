import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '../types';
import { EN_TRANSLATIONS, SW_TRANSLATIONS, TranslationKey } from '../utils/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => EN_TRANSLATIONS[key] || key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('cdims_lang') as Language;
    return saved === 'sw' ? 'sw' : 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('cdims_lang', lang);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'sw' : 'en');
  };

  const t = (key: TranslationKey): string => {
    const dict = language === 'sw' ? SW_TRANSLATIONS : EN_TRANSLATIONS;
    return dict[key] || EN_TRANSLATIONS[key] || (key as string);
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
