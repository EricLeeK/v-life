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
    const id = record.id || generateId();
    const now = new Date().toISOString();
    const newRecord = { id, created_at: now, updated_at: now, ...record };
    setDemoData((prev) => ({
      ...prev,
      [table]: [...(prev[table] as any[]), newRecord],
    }));
    return newRecord;
  }, []);

  const updateRecord = useCallback((table: keyof DemoDataStore, id: string, updates: any) => {
    setDemoData((prev) => ({
      ...prev,
      [table]: (prev[table] as any[]).map((item: any) =>
        item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
      ),
    }));
  }, []);

  const deleteRecord = useCallback((table: keyof DemoDataStore, id: string) => {
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
