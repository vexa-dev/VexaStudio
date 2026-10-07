import { useId, type InputHTMLAttributes } from "react";
import { Search } from "lucide-react";

export function SearchField({
  label,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <div className="vexa-search">
        <Search size={15} aria-hidden="true" />
        <input {...props} id={inputId} type="search" />
      </div>
    </div>
  );
}
