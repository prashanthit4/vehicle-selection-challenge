export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownSelectorProps {
  id: string;
  label: string;
  placeholder: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Keep the label for screen readers but don't show it. */
  hideLabel?: boolean;
}

/** Presentation-only labelled <select>. Holds no state; the parent owns value and options. */
export default function DropdownSelector({
  id,
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled = false,
  hideLabel = false,
}: DropdownSelectorProps) {
  return (
    <div>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : undefined}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
