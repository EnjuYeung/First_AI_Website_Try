import { useState, useMemo } from 'react';
import { Subscription } from '../types';
import { parseLocalYMD } from '../services/dateUtils';

interface SortConfig {
    key: 'price' | 'nextBillingDate' | 'name' | 'category' | 'paymentMethod' | null;
    direction: 'asc' | 'desc';
}

const STRING_SORT_KEYS = new Set<NonNullable<SortConfig['key']>>(['name', 'category', 'paymentMethod']);

const PRICE_RANGE_MATCHERS: Record<string, (price: number) => boolean> = {
    low: (price) => price >= 0 && price <= 5,
    mid: (price) => price > 5 && price <= 10,
    high: (price) => price > 10,
};

const matchesSelection = (selected: string[], value: string) => (
    selected.length === 0 || selected.includes(value)
);

const matchesPriceRanges = (selectedRanges: string[], price: number) => (
    selectedRanges.length === 0 ||
    selectedRanges.some(range => PRICE_RANGE_MATCHERS[range]?.(price) ?? false)
);

const getSortValue = (subscription: Subscription, key: NonNullable<SortConfig['key']>) => {
    if (key === 'nextBillingDate') {
        const time = parseLocalYMD(subscription.nextBillingDate).getTime();
        return Number.isFinite(time) ? time : 0;
    }

    const value = subscription[key];
    return STRING_SORT_KEYS.has(key) ? String(value || '').toLowerCase() : value;
};

export const useSubscriptionFilters = (subscriptions: Subscription[]) => {
    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedFrequencies, setSelectedFrequencies] = useState<string[]>([]);
    const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
    const [selectedPriceRanges, setSelectedPriceRanges] = useState<string[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

    const [sortConfig, setSortConfig] = useState<SortConfig>({
        key: null,
        direction: 'asc'
    });

    // Handlers
    const handleSort = (key: SortConfig['key']) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const resetFilters = () => {
        setSelectedCategories([]);
        setSelectedFrequencies([]);
        setSelectedPayments([]);
        setSelectedPriceRanges([]);
        setSelectedStatuses([]);
        setSearchTerm('');
    };

    // Processing Logic
    const filteredSubscriptions = useMemo(() => {
        const normalizedSearch = searchTerm.toLowerCase();

        return subscriptions
            .filter(sub => {
                if (normalizedSearch && !sub.name.toLowerCase().includes(normalizedSearch)) {
                    return false;
                }

                return (
                    matchesSelection(selectedCategories, sub.category) &&
                    matchesSelection(selectedFrequencies, sub.frequency) &&
                    matchesSelection(selectedPayments, sub.paymentMethod || 'Credit Card') &&
                    matchesSelection(selectedStatuses, sub.status || 'active') &&
                    matchesPriceRanges(selectedPriceRanges, sub.price)
                );
            })
            .sort((a, b) => {
                if (!sortConfig.key) return 0;

                const aValue = getSortValue(a, sortConfig.key);
                const bValue = getSortValue(b, sortConfig.key);

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
    }, [
        subscriptions,
        searchTerm,
        selectedCategories,
        selectedFrequencies,
        selectedPayments,
        selectedPriceRanges,
        selectedStatuses,
        sortConfig
    ]);

    return {
        // State Values
        searchTerm,
        selectedCategories,
        selectedFrequencies,
        selectedPayments,
        selectedPriceRanges,
        selectedStatuses,
        sortConfig,

        // Result
        filteredSubscriptions,

        // State Setters
        setSearchTerm,
        setSelectedCategories,
        setSelectedFrequencies,
        setSelectedPayments,
        setSelectedPriceRanges,
        setSelectedStatuses,
        handleSort,
        resetFilters
    };
};
