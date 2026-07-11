import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface FilterMultiSelectProps {
    label: string;
    options: { value: string; label: string; icon?: React.ReactNode }[];
    selectedValues: string[];
    onChange: (values: string[]) => void;
    resetText: string;
}

export const FilterMultiSelect: React.FC<FilterMultiSelectProps> = ({
    label,
    options,
    selectedValues,
    onChange,
    resetText
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const listboxId = React.useId();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    const toggleOption = (value: string) => {
        if (selectedValues.includes(value)) {
            onChange(selectedValues.filter(v => v !== value));
        } else {
            onChange([...selectedValues, value]);
        }
    };

    return (
        <div className="relative z-40" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={listboxId}
                className={`flex items-center justify-between gap-2 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors ${selectedValues.length > 0 ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'}`}
            >
                <span>{label} {selectedValues.length > 0 && `(${selectedValues.length})`}</span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div id={listboxId} role="listbox" aria-multiselectable="true" aria-label={label} className="absolute z-50 mt-2 w-56 mac-surface rounded-xl shadow-lg border border-gray-100 dark:border-gray-600 overflow-hidden animate-fade-in">
                    <div className="p-2 max-h-60 overflow-y-auto space-y-1">
                        {options.map((opt) => (
                            <button
                                type="button"
                                role="option"
                                aria-selected={selectedValues.includes(opt.value)}
                                key={opt.value}
                                onClick={() => toggleOption(opt.value)}
                                className="flex w-full items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer text-left text-sm text-gray-700 dark:text-gray-200"
                            >
                                {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedValues.includes(opt.value) ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300 dark:border-gray-500'}`}>
                                    {selectedValues.includes(opt.value) && <Check size={10} strokeWidth={3} />}
                                </div>
                                <span className="truncate">{opt.label}</span>
                            </button>
                        ))}
                    </div>
                    {selectedValues.length > 0 && (
                        <div className="border-t border-gray-100 dark:border-gray-700 p-2">
                            <button
                                onClick={() => { onChange([]); setIsOpen(false); }}
                                className="w-full py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white bg-gray-50 dark:bg-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                            >
                                {resetText}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
