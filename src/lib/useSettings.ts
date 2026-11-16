import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { applyTheme } from './theme';
import type { Settings } from './types';

/** Charge les paramètres du mariage et applique le thème de couleurs. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const reload = async () => {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
    if (data) {
      setSettings(data as Settings);
      applyTheme((data as Settings).theme);
    }
  };
  useEffect(() => {
    reload();
  }, []);
  return { settings, reload };
}
