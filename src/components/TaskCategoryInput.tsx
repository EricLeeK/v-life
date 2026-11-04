import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ChevronDown } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";

export const CategoryInput = ({ id, value, onChange, existingCategories, placeholder }: {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  existingCategories: string[];
  placeholder?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLang();
  return (
    <div className="relative mt-1">
      <div className="relative flex items-center">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-8 h-9 text-sm"
          aria-expanded={existingCategories.length > 0 ? isOpen : undefined}
          aria-haspopup={existingCategories.length > 0 ? "listbox" : undefined}
        />
        {existingCategories.length > 0 && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="absolute right-2 text-muted-foreground hover:text-muted-foreground focus:outline-none"
            style={{ zIndex: 5 }}
            aria-label={isOpen ? t("收起分类列表", "Collapse category list") : t("展开分类列表", "Expand category list")}
            aria-expanded={isOpen}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
      {isOpen && existingCategories.length > 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} aria-hidden="true" />
          <div role="listbox" className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-card border border-border rounded-lg shadow-lg z-20 py-1">
            {existingCategories.map((cat: string) => (
              <button
                key={cat}
                type="button"
                role="option"
                onClick={() => {
                  onChange(cat);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-muted/40 transition-colors"
              >
                {cat}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
