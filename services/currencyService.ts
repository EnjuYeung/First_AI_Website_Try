
import { ExchangeRates, AIConfig } from '../types';

// Check if we need to update based on 12:00 PM daily schedule
export const shouldAutoUpdate = (lastUpdate: number): boolean => {
    const now = new Date();
    const last = new Date(lastUpdate);

    // If never updated
    if (lastUpdate === 0) return true;

    // 1. Check if it's a different day
    const isSameDay = now.toDateString() === last.toDateString();
    
    // 2. Check if current time is past 12:00 PM
    const isPastNoon = now.getHours() >= 12;

    // If it's a new day and it's past noon, we should have an update for "today"
    if (!isSameDay && isPastNoon) {
        return true;
    }

    // Also update if the data is older than 24 hours (fallback)
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (now.getTime() - lastUpdate > twentyFourHours) {
        return true;
    }

    return false;
};

export const getRatesFromAI = async (targetCurrencies: string[], config: AIConfig): Promise<ExchangeRates | null> => {
    if (!config.apiKey || !config.baseUrl) {
        console.error("Missing AI Configuration");
        return null;
    }

    try {
        // Filter out USD as it's the base
        const symbols = targetCurrencies.filter(c => c !== 'USD');
        if (symbols.length === 0) return { 'USD': 1 };

        const prompt = `
          You are a financial assistant. 
          Provide the current approximate exchange rates for the following currencies against USD (Base 1).
          Currencies: ${symbols.join(', ')}.
          
          Return ONLY a raw JSON object. No markdown formatting, no code blocks, no explanations.
          Example format: { "CNY": 7.23, "EUR": 0.92 }
        `;

        const response = await fetch(config.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model || 'gpt-3.5-turbo',
                messages: [
                    { role: "user", content: prompt }
                ],
                // Attempt to force JSON mode if supported by the provider, otherwise the prompt handles it
                // response_format: { type: "json_object" } 
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) throw new Error("Empty response from AI");

        // Simple cleanup to handle if model wraps in markdown code blocks
        const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const rates = JSON.parse(cleanJson);
        
        // Ensure USD is present
        rates['USD'] = 1;

        return rates;

    } catch (error) {
        console.error("AI Currency Update Failed:", error);
        return null;
    }
};