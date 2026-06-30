import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface SearchableComboboxOption {
  value: string;
  label: string;
  searchText?: string;
}

interface SearchableComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableComboboxOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  ariaLabel: string;
}

const normalizeForSearch = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function SearchableCombobox({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  ariaLabel,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const selectedOption = options.find((option) => option.value === value);
  const normalizedSearchTerm = normalizeForSearch(searchTerm);

  const filteredOptions = useMemo(() => {
    if (!normalizedSearchTerm) return options;

    return options.filter((option) =>
      normalizeForSearch(option.searchText || option.label).includes(normalizedSearchTerm)
    );
  }, [options, normalizedSearchTerm]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearchTerm("");
    }
  };

  const handleSelect = (nextValue: string) => {
    onValueChange(nextValue);
    setOpen(false);
    setSearchTerm("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selectedOption && "text-muted-foreground")}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            {filteredOptions.length === 0 ? (
              <CommandEmpty>{emptyText}</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem key={option.value} value={option.value} onSelect={() => handleSelect(option.value)}>
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        option.value === value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
