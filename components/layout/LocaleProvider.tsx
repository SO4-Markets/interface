'use client';

import React, { createContext, useContext } from 'react';

interface LocaleContextProps {
  currentLocale: string;
  defaultLocale: string;
  isFallback: boolean;
  messages: any;
}

const LocaleContext = createContext<LocaleContextProps | undefined>(undefined);

export function LocaleProvider({ 
  children, 
  locale, 
  isFallback = false,
  messages 
}: { 
  children: React.ReactNode; 
  locale: string; 
  isFallback?: boolean;
  messages: any;
}) {
  return (
    <LocaleContext.Provider value={{ currentLocale: locale, defaultLocale: 'en', isFallback, messages }}>
      {/* Visual Content Fallback Banner Notice */}
      {isFallback && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-center text-sm text-amber-800 font-medium">
          ⚠️ {messages?.chrome?.fallbackNotice || 'This page is not available in your selected locale. Displaying default version.'}
        </div>
      )}
      {children}
    </LocaleContext.Provider>
  );
}

// Custom hook to cleanly pull dictionary words inside the docs chrome layouts without hardcoding strings
export function useTranslations() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useTranslations must be wrapped inside a LocaleProvider execution hierarchy.');
  }
  return context.messages;
}
