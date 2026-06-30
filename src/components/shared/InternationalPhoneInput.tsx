import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface InternationalPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  countryAriaLabel?: string;
  numberAriaLabel?: string;
  disabled?: boolean;
}

type CountryPhoneConfig = {
  iso2: string;
  name: string;
  flag: string;
  dialCode: string;
  pattern: string;
  placeholder: string;
};

const COUNTRY_PHONE_CONFIGS: CountryPhoneConfig[] = [
  {
    iso2: "BR",
    name: "Brasil",
    flag: "🇧🇷",
    dialCode: "+55",
    pattern: "(##) #####-####",
    placeholder: "(11) 99999-9999",
  },
  {
    iso2: "PT",
    name: "Portugal",
    flag: "🇵🇹",
    dialCode: "+351",
    pattern: "### ### ###",
    placeholder: "912 345 678",
  },
  {
    iso2: "US",
    name: "Estados Unidos",
    flag: "🇺🇸",
    dialCode: "+1",
    pattern: "(###) ###-####",
    placeholder: "(201) 555-0123",
  },
  {
    iso2: "AR",
    name: "Argentina",
    flag: "🇦🇷",
    dialCode: "+54",
    pattern: "## ####-####",
    placeholder: "11 2345-6789",
  },
  {
    iso2: "ES",
    name: "Espanha",
    flag: "🇪🇸",
    dialCode: "+34",
    pattern: "### ## ## ##",
    placeholder: "612 34 56 78",
  },
  {
    iso2: "FR",
    name: "França",
    flag: "🇫🇷",
    dialCode: "+33",
    pattern: "## ## ## ## ##",
    placeholder: "06 12 34 56 78",
  },
  {
    iso2: "DE",
    name: "Alemanha",
    flag: "🇩🇪",
    dialCode: "+49",
    pattern: "#### ########",
    placeholder: "1512 3456789",
  },
  {
    iso2: "GB",
    name: "Reino Unido",
    flag: "🇬🇧",
    dialCode: "+44",
    pattern: "#### ### ####",
    placeholder: "7400 123 456",
  },
  {
    iso2: "IT",
    name: "Itália",
    flag: "🇮🇹",
    dialCode: "+39",
    pattern: "### #### ###",
    placeholder: "312 3456 789",
  },
  {
    iso2: "AO",
    name: "Angola",
    flag: "🇦🇴",
    dialCode: "+244",
    pattern: "### ### ###",
    placeholder: "923 456 789",
  },
  {
    iso2: "IE",
    name: "Irlanda",
    flag: "🇮🇪",
    dialCode: "+353",
    pattern: "## ### ####",
    placeholder: "85 123 4567",
  },
];

const DEFAULT_COUNTRY_ISO2 = "BR";

const countMaskDigits = (pattern: string) => (pattern.match(/#/g) || []).length;

const normalizeTextDigits = (value: string) => value.replace(/\D/g, "");

const applyPatternMask = (digits: string, pattern: string) => {
  if (!digits) return "";

  let result = "";
  let digitIndex = 0;

  for (const char of pattern) {
    if (char === "#") {
      if (digitIndex >= digits.length) break;
      result += digits[digitIndex];
      digitIndex += 1;
      continue;
    }

    if (digitIndex < digits.length) {
      result += char;
    }
  }

  if (digitIndex < digits.length) {
    result += digits.slice(digitIndex);
  }

  return result;
};

const findCountryByDialCode = (rawValue: string) => {
  const numberWithoutPlus = rawValue.replace(/^\+/, "").replace(/\D/g, "");

  return [...COUNTRY_PHONE_CONFIGS]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((country) => {
      const dialDigits = country.dialCode.replace(/\D/g, "");
      return numberWithoutPlus.startsWith(dialDigits);
    });
};

const parsePhoneValue = (rawValue: string) => {
  const defaultCountry =
    COUNTRY_PHONE_CONFIGS.find((country) => country.iso2 === DEFAULT_COUNTRY_ISO2) || COUNTRY_PHONE_CONFIGS[0];

  if (!rawValue) {
    return {
      country: defaultCountry,
      nationalDigits: "",
    };
  }

  const trimmed = rawValue.trim();
  const hasLeadingPlus = trimmed.startsWith("+");

  if (!hasLeadingPlus) {
    return {
      country: defaultCountry,
      nationalDigits: normalizeTextDigits(trimmed).slice(0, countMaskDigits(defaultCountry.pattern)),
    };
  }

  const matchedCountry = findCountryByDialCode(trimmed) || defaultCountry;
  const allDigits = normalizeTextDigits(trimmed);
  const dialDigits = matchedCountry.dialCode.replace(/\D/g, "");

  return {
    country: matchedCountry,
    nationalDigits: allDigits
      .slice(dialDigits.length)
      .slice(0, countMaskDigits(matchedCountry.pattern)),
  };
};

export function InternationalPhoneInput({
  value,
  onChange,
  className,
  countryAriaLabel = "Selecionar país",
  numberAriaLabel = "Número de telefone",
  disabled,
}: InternationalPhoneInputProps) {
  const parsed = useMemo(() => parsePhoneValue(value), [value]);
  const [countryIso2, setCountryIso2] = useState(parsed.country.iso2);
  const [nationalDigits, setNationalDigits] = useState(parsed.nationalDigits);

  useEffect(() => {
    setCountryIso2(parsed.country.iso2);
    setNationalDigits(parsed.nationalDigits);
  }, [parsed.country.iso2, parsed.nationalDigits]);

  const selectedCountry =
    COUNTRY_PHONE_CONFIGS.find((country) => country.iso2 === countryIso2) || parsed.country;

  const maxDigits = countMaskDigits(selectedCountry.pattern);
  const maskedNationalValue = applyPatternMask(nationalDigits, selectedCountry.pattern);

  const emitPhoneValue = (country: CountryPhoneConfig, digits: string) => {
    if (!digits) {
      onChange("");
      return;
    }

    onChange(`${country.dialCode} ${applyPatternMask(digits, country.pattern)}`.trim());
  };

  const handleCountryChange = (newIso2: string) => {
    const nextCountry = COUNTRY_PHONE_CONFIGS.find((country) => country.iso2 === newIso2);
    if (!nextCountry) return;

    const nextMaxDigits = countMaskDigits(nextCountry.pattern);
    const nextDigits = nationalDigits.slice(0, nextMaxDigits);

    setCountryIso2(newIso2);
    setNationalDigits(nextDigits);
    emitPhoneValue(nextCountry, nextDigits);
  };

  const handleNumberChange = (nextValue: string) => {
    const nextDigits = normalizeTextDigits(nextValue).slice(0, maxDigits);
    setNationalDigits(nextDigits);
    emitPhoneValue(selectedCountry, nextDigits);
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Select value={selectedCountry.iso2} onValueChange={handleCountryChange} disabled={disabled}>
        <SelectTrigger className="w-[170px]" aria-label={countryAriaLabel}>
          <div className="flex w-full items-center gap-2">
            <span aria-hidden="true">{selectedCountry.flag}</span>
            <span className="truncate text-sm font-medium">{selectedCountry.dialCode}</span>
          </div>
        </SelectTrigger>
        <SelectContent>
          {COUNTRY_PHONE_CONFIGS.map((country) => (
            <SelectItem key={country.iso2} value={country.iso2}>
              <span className="flex items-center gap-2">
                <span aria-hidden="true">{country.flag}</span>
                <span>{country.name}</span>
                <span className="text-muted-foreground">{country.dialCode}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={selectedCountry.placeholder}
        aria-label={numberAriaLabel}
        value={maskedNationalValue}
        onChange={(event) => handleNumberChange(event.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
