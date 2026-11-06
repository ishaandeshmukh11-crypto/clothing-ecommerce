'use client';

import { createContext, useContext } from 'react';
import { DEFAULT_SETTINGS } from '@/lib/defaults';

const SettingsContext = createContext(DEFAULT_SETTINGS);

export function SettingsProvider({ value, children }) {
  return <SettingsContext.Provider value={{ ...DEFAULT_SETTINGS, ...value }}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
