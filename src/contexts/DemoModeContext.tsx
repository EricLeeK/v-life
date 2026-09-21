import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { DemoDataStore } from "@/data/demoSeed";
import { createDemoDataStore } from "@/data/demoSeed";

const STORAGE_KEY = "vlife-demo-mode";

function generateId(): string {
  return "demo-new-" + crypto.randomUUID();
}

interface DemoModeContextType {
  isDemo: boolean;
  enterDemo: () => void;
  exitDemo: () => void;
  demoData: DemoDataStore;
  addRecord: (table: keyof DemoDataStore, record: any) => any;
  updateRecord: (table: keyof DemoDataStore, id: string, updates: any) => void;
  deleteRecord: (table: keyof DemoDataStore, id: string) => void;
}

const DemoModeContext = createContext<DemoModeContextType>({
  isDemo: false,
  enterDemo: () => {},
  exitDemo: () => {},
  demoData: createDemoDataStore(),
  addRecord: () => ({}),
  updateRecord: () => {},
  deleteRecord: () => {},
});

export const useDemoMode = () => useContext(DemoModeContext);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemo, setIsDemo] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");
  const [demoData, setDemoData] = useState<DemoDataStore>(() => {
    if (localStorage.getItem(STORAGE_KEY) === "true") {
      return createDemoDataStore();
    }
    return createDemoDataStore();
  });

  const enterDemo = useCallback(() => {
    setIsDemo(true);
    setDemoData(createDemoDataStore());
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  const exitDemo = useCallback(() => {
    setIsDemo(false);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const addRecord = useCallback((table: keyof DemoDataStore, record: any) => {
    const now = new Date().toISOString();
    if (table === "settings") {
      const defaultSettings = createDemoDataStore().settings;
      const newRecord = {
        ...defaultSettings,
        ...record,
        // Keep the canonical singleton id even if a caller supplies another one.
        id: defaultSettings.id,
        updated_at: now,
      };
      setDemoData((prev) => {
        const current = prev.settings;
        const nextSettings = {
          ...current,
          ...record,
          // settings is a singleton: an "insert" updates the existing row
          // instead of changing its object shape into an array.
          id: current.id,
          created_at: current.created_at ?? now,
          updated_at: now,
        };
        return { ...prev, settings: nextSettings };
      });
      return newRecord;
    }

    const id = record.id || generateId();
    const newRecord = { id, created_at: now, updated_at: now, ...record };
    setDemoData((prev) => ({
      ...prev,
      [table]: [...(prev[table] as any[]), newRecord],
    }));
    return newRecord;
  }, []);

  const updateRecord = useCallback((table: keyof DemoDataStore, id: string, updates: any) => {
    if (table === "settings") {
      setDemoData((prev) => {
        if (prev.settings.id !== id) return prev;
        return {
          ...prev,
          settings: { ...prev.settings, ...updates, id: prev.settings.id, updated_at: new Date().toISOString() },
        };
      });
      return;
    }

    setDemoData((prev) => ({
      ...prev,
      [table]: (prev[table] as any[]).map((item: any) =>
        item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
      ),
    }));
  }, []);

  const deleteRecord = useCallback((table: keyof DemoDataStore, id: string) => {
    if (table === "settings") {
      setDemoData((prev) => {
        if (prev.settings.id !== id) return prev;
        // Keep the singleton row and its object shape after a demo delete.
        return { ...prev, settings: createDemoDataStore().settings };
      });
      return;
    }

    setDemoData((prev) => ({
      ...prev,
      [table]: (prev[table] as any[]).filter((item: any) => item.id !== id),
    }));
  }, []);

  return (
    <DemoModeContext.Provider value={{ isDemo, enterDemo, exitDemo, demoData, addRecord, updateRecord, deleteRecord }}>
      {children}
    </DemoModeContext.Provider>
  );
}
