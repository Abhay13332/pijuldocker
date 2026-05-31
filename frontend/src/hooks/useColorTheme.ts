import { useState, useEffect } from 'react';
import { themes, applyTheme } from '../themes';

const STORAGE_KEY = 'pijulserv-color-theme';

export const useColorTheme = () => {
  const [themeId, setThemeId] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? 'default',
  );

  useEffect(() => {
    applyTheme(themeId);
    localStorage.setItem(STORAGE_KEY, themeId);
  }, [themeId]);

  return {
    themeId,
    themes,
    setTheme: (id: string) => setThemeId(id),
  };
};
