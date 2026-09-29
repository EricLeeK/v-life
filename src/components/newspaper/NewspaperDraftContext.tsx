import { createContext, useCallback, useContext, useRef } from "react";
type Saver = () => Promise<boolean>;
interface DraftBarrier {
  register: (id: string, saver: Saver) => () => void;
  flush: () => Promise<boolean>;
}
export const NewspaperDraftContext = createContext<DraftBarrier>({
  register: () => () => {},
  flush: async () => true,
});
export const useNewspaperDrafts = () => useContext(NewspaperDraftContext);
export function useNewspaperSaveBarrier(): DraftBarrier {
  const savers = useRef(new Map<string, Saver>());
  const register = useCallback((id: string, saver: Saver) => {
    savers.current.set(id, saver);
    return () => {
      savers.current.delete(id);
    };
  }, []);
  const flush = useCallback(async () => {
    const result = await Promise.all(
      [...savers.current.values()].map((save) => save()),
    );
    return result.every(Boolean);
  }, []);
  return { register, flush };
}
