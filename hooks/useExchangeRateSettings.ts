import { useState } from 'react';
import { AppSettings } from '../types';
import { apiFetchJson, authJsonHeaders } from '../services/apiClient';
import { SettingsAlert } from './settingsTypes';

export const useExchangeRateSettings = (
  settings: AppSettings,
  onUpdate: (settings: AppSettings) => void,
  t: (key: any) => string,
  setAlert: (alert: SettingsAlert) => void
) => {
  const [exchangeApiKey, setExchangeApiKey] = useState('');
  const [isSavingExchangeApi, setIsSavingExchangeApi] = useState(false);
  const [isUpdatingRates, setIsUpdatingRates] = useState(false);

  const applyResponse = (json: any) =>
    onUpdate({
      ...settings,
      exchangeRateApi: json.settings.exchangeRateApi,
      exchangeRates: json.settings.exchangeRates,
      lastRatesUpdate: json.settings.lastRatesUpdate,
    });

  const encryptKey = async (plainKey: string) => {
    const { jwk } = await apiFetchJson<any>('/api/exchange-rate/public-key');
    if (!jwk) throw new Error('failed_to_get_public_key');
    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']
    );
    const encrypted = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' }, key, new TextEncoder().encode(plainKey)
    );
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  };

  const handleSaveExchangeApiKey = async (test: boolean) => {
    if (!exchangeApiKey.trim()) return;
    setIsSavingExchangeApi(true);
    try {
      const encryptedKey = await encryptKey(exchangeApiKey.trim());
      const json = await apiFetchJson<any>('/api/exchange-rate/config', {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify({ encryptedKey, test }),
      });
      applyResponse(json);
      setExchangeApiKey('');
      setAlert({ isOpen: true, type: 'success', title: t('success_title'), message: t(test ? 'connection_success' : 'saved') });
    } catch (err: any) {
      setAlert({ isOpen: true, type: 'error', title: t('error_title'), message: err?.message || 'save_failed' });
    } finally {
      setIsSavingExchangeApi(false);
    }
  };

  const handleManualUpdateRates = async () => {
    setIsUpdatingRates(true);
    try {
      const json = await apiFetchJson<any>('/api/exchange-rate/update', {
        method: 'POST',
        headers: authJsonHeaders(),
      });
      applyResponse(json);
      setAlert({ isOpen: true, type: 'success', title: t('success_title'), message: t('rates_updated') });
    } catch (err: any) {
      setAlert({ isOpen: true, type: 'error', title: t('error_title'), message: err?.message || 'update_failed' });
    } finally {
      setIsUpdatingRates(false);
    }
  };

  return {
    exchangeApiKey, setExchangeApiKey, isSavingExchangeApi, isUpdatingRates,
    handleSaveExchangeApiKey, handleManualUpdateRates,
  };
};
