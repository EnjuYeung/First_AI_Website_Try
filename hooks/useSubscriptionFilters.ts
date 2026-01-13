import { useState, useMemo } from 'react';
import { Subscription, Frequency } from '../types';
import { parseLocalYMD } from '../services/dateUtils';

// Types for Filter State
interface SortConfig {
    key: 'price' | 'nextBillingDate' | 'name' | 'category' | 'paymentMethod' | null;
    direction: 'asc' | 'desc';
}

interface FilterState {
    searchTerm: string;
    categories: string[];
    frequencies: string[];
    payments: string[];
    priceRanges: string[];
    statuses: string[];
}

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
        return subscriptions
            .filter(sub => {
                // Search Term (Name)
                if (searchTerm && !sub.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                    return false;
                }

                // Multi-Select Filters
                if (selectedCategories.length > 0 && !selectedCategories.includes(sub.category)) return false;
                if (selectedFrequencies.length > 0 && !selectedFrequencies.includes(sub.frequency)) return false;
                if (selectedPayments.length > 0 && !selectedPayments.includes(sub.paymentMethod || 'Credit Card')) return false;
                if (selectedStatuses.length > 0 && !selectedStatuses.includes(sub.status || 'active')) return false;

                // Price Range Logic
                if (selectedPriceRanges.length > 0) {
                    const matchesRange = selectedPriceRanges.some(range => {
                        if (range === 'low') return sub.price >= 0 && sub.price <= 5;
                        if (range === 'mid') return sub.price > 5 && sub.price <= 10;
                        if (range === 'high') return sub.price > 10;
                        return false;
                    });
                    if (!matchesRange) return false;
                }

                return true;
            })
            .sort((a, b) => {
                if (!sortConfig.key) return 0;

                let aValue: any = a[sortConfig.key];
                let bValue: any = b[sortConfig.key];

                // String Normalization
                if (['name', 'category', 'paymentMethod'].includes(sortConfig.key)) {
                    aValue = (aValue || '').toLowerCase();
                    bValue = (bValue || '').toLowerCase();
                }

                // Date Handling
                if (sortConfig.key === 'nextBillingDate') {
                    const aTime = parseLocalYMD(a.nextBillingDate).getTime();
                    const bTime = parseLocalYMD(b.nextBillingDate).getTime();
                    aValue = Number.isFinite(aTime) ? aTime : 0;
                    bValue = Number.isFinite(bTime) ? bTime : 0;
                }

                // Comparison
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
