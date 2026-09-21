import { useEffect, useState } from "react";
import { format } from "date-fns";

/** Refresh at local midnight, and after returning to a suspended browser tab. */
export function useLocalDate() {
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      const now = new Date();
      setDate(format(now, "yyyy-MM-dd"));
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime());
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return date;
}
