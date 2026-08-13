import crypto from 'crypto';
import fs from 'fs/promises';
import { LEGACY_EXCHANGE_RATE_KEYPAIR_FILE } from './paths.js';
import { formatDateInTimeZone, getTimePartsInTimeZone } from './dates.js';

const ENCRYPTION_PREFIX = 'aesgcm-v1';

const fetchUsdRatesFromExchangeRateApi = async (apiKey) => {
  const url = `https://v6.exchangerate-api.com/v6/${encodeURIComponent(apiKey)}/latest/USD`;
  let resp;
  try {
    resp = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new Error('exchange_rate_api_timeout');
    }
    throw err;
  }
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = json?.['error-type'] || json?.message || `exchange_rate_api_http_${resp.status}`;
    throw new Error(msg);
  }
  if (json?.result !== 'success' || !json?.conversion_rates) {
    const msg = json?.['error-type'] || 'exchange_rate_api_invalid_response';
    throw new Error(msg);
  }
  return json.conversion_rates;
};

export const createExchangeRate = ({
  storage,
  defaults,
  dataEncryptionKey,
  legacyKeypairFile = LEGACY_EXCHANGE_RATE_KEYPAIR_FILE,
}) => {
  let rateTimer = null;
  let rateRunning = false;
  const key = crypto.createHash('sha256').update(dataEncryptionKey, 'utf8').digest();

  const encryptApiKey = (plainText) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [ENCRYPTION_PREFIX, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
  };

  const decryptApiKey = async (encryptedValue) => {
    if (!encryptedValue) throw new Error('missing_encrypted_key');
    if (encryptedValue.startsWith(`${ENCRYPTION_PREFIX}.`)) {
      const [, iv, tag, encrypted] = encryptedValue.split('.');
      if (!iv || !tag || !encrypted) throw new Error('invalid_encrypted_key');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(encrypted, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    }
    const legacy = JSON.parse(await fs.readFile(legacyKeypairFile, 'utf8'));
    return crypto.privateDecrypt(
      { key: legacy.privateKeyPem, oaepHash: 'sha256' },
      Buffer.from(encryptedValue, 'base64')
    ).toString('utf8');
  };

  const updateExchangeRatesForUser = async (username, slotHour = null) => {
    const data = await storage.loadUserData(username);
    const settings = data.settings || defaults.defaultSettings();
    const cfg = settings.exchangeRateApi || defaults.defaultSettings().exchangeRateApi;

    if (!cfg.enabled || !cfg.encryptedKey) {
      return { updated: false, reason: 'exchange_rate_api_not_enabled' };
    }

    const apiKey = await decryptApiKey(cfg.encryptedKey);
    const conversionRates = await fetchUsdRatesFromExchangeRateApi(apiKey);

    const now = Date.now();
    const updatedData = await storage.updateUserData(username, (current) => {
      const currentSettings = current.settings || defaults.defaultSettings();
      const currentCfg = currentSettings.exchangeRateApi || defaults.defaultSettings().exchangeRateApi;
      const nextRates = { ...(currentSettings.exchangeRates || {}), USD: 1 };
      const currentDesired = (currentSettings.customCurrencies || []).map((c) => c.code).filter(Boolean);
      for (const code of currentDesired) {
        if (code === 'USD') continue;
        const rate = conversionRates[code];
        if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) nextRates[code] = rate;
      }
      currentSettings.exchangeRates = nextRates;
      currentSettings.lastRatesUpdate = now;
      currentSettings.exchangeRateApi = {
        ...defaults.defaultSettings().exchangeRateApi,
        ...currentCfg,
        ...(slotHour === 0 ? { lastRunAt0: now } : {}),
        ...(slotHour === 12 ? { lastRunAt12: now } : {}),
      };
      return { ...current, settings: currentSettings };
    });

    return {
      updated: true,
      lastRatesUpdate: now,
      exchangeRates: updatedData.settings.exchangeRates,
      exchangeRateApi: updatedData.settings.exchangeRateApi,
    };
  };

  const startExchangeRateScheduler = ({ username }) => {
    if (rateTimer) return;

    const tick = async () => {
      if (rateRunning) return;
      rateRunning = true;
      try {
        const data = await storage.loadUserData(username);
        const settings = data.settings || defaults.defaultSettings();
        const tz = settings.timezone || 'Asia/Shanghai';
        const today = formatDateInTimeZone(tz);
        const { hour } = getTimePartsInTimeZone(tz);

        const cfg = settings.exchangeRateApi || defaults.defaultSettings().exchangeRateApi;
        if (!cfg.enabled || !cfg.encryptedKey || !cfg.lastTestedAt) return;

        const ran0 = cfg.lastRunAt0 ? formatDateInTimeZone(tz, new Date(cfg.lastRunAt0)) : '';
        const ran12 = cfg.lastRunAt12 ? formatDateInTimeZone(tz, new Date(cfg.lastRunAt12)) : '';

        if (hour >= 12 && ran12 !== today) {
          await updateExchangeRatesForUser(username, 12);
        } else if (hour < 12 && ran0 !== today) {
          await updateExchangeRatesForUser(username, 0);
        }
      } catch (err) {
        console.error('Exchange rate tick failed', err);
      } finally {
        rateRunning = false;
      }
    };

    tick();
    rateTimer = setInterval(tick, 5 * 60 * 1000);
  };

  const migrateLegacyKeyForUser = async (username) => {
    const data = await storage.loadUserData(username);
    const encryptedKey = data.settings?.exchangeRateApi?.encryptedKey || '';
    if (encryptedKey && !encryptedKey.startsWith(`${ENCRYPTION_PREFIX}.`)) {
      try {
        const plainText = await decryptApiKey(encryptedKey);
        await storage.updateUserData(username, (current) => {
          current.settings.exchangeRateApi.encryptedKey = encryptApiKey(plainText);
          return current;
        });
      } catch (err) {
        if (err?.code !== 'ENOENT') throw err;
        console.warn(
          'Legacy exchange-rate keypair is missing; disabling the exchange-rate API until a new key is configured.'
        );
        await storage.updateUserData(username, (current) => {
          const currentConfig = current.settings?.exchangeRateApi;
          if (!currentConfig || currentConfig.encryptedKey !== encryptedKey) return current;
          current.settings.exchangeRateApi = {
            ...defaults.defaultSettings().exchangeRateApi,
            ...currentConfig,
            enabled: false,
            encryptedKey: '',
            lastTestedAt: 0,
            lastRunAt0: 0,
            lastRunAt12: 0,
          };
          return current;
        });
      }
    }
    await fs.unlink(legacyKeypairFile).catch((err) => {
      if (err?.code !== 'ENOENT') throw err;
    });
  };

  return {
    encryptApiKey,
    decryptApiKey,
    migrateLegacyKeyForUser,
    fetchUsdRatesFromExchangeRateApi,
    updateExchangeRatesForUser,
    startExchangeRateScheduler,
  };
};
