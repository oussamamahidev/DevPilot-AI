import { Input } from "@/components/ui/Input";

type SearchInputProps = {
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
};

export function SearchInput({
  onChange,
  placeholder = "Search",
  value,
}: SearchInputProps) {
  return (
    <Input
      aria-label={placeholder}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      type="search"
      value={value}
    />
  );
}
