import crypto from 'crypto';
import fs from 'fs/promises';
import { EXCHANGE_RATE_KEYPAIR_FILE } from './storagePaths.js';
import { formatDateInTimeZone, getTimePartsInTimeZone } from './dates.js';

const readExchangeRateKeypair = async (storage) => {
  await storage.ensureDataDir();
  try {
    const raw = await fs.readFile(EXCHANGE_RATE_KEYPAIR_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed?.publicKeyPem || !parsed?.privateKeyPem) throw new Error('invalid_keypair');
    return parsed;
  } catch {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const payload = { publicKeyPem: publicKey, privateKeyPem: privateKey };
    await fs.writeFile(EXCHANGE_RATE_KEYPAIR_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    return payload;
  }
};

const fetchUsdRatesFromExchangeRateApi = async (apiKey) => {
  const url = `https://v6.exchangerate-api.com/v6/${encodeURIComponent(apiKey)}/latest/USD`;
  const resp = await fetch(url, { method: 'GET' });
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

const decryptExchangeRateApiKey = async (storage, encryptedKeyBase64) => {
  if (!encryptedKeyBase64) throw new Error('missing_encrypted_key');
  const { privateKeyPem } = await readExchangeRateKeypair(storage);
  const buf = Buffer.from(encryptedKeyBase64, 'base64');
  const decrypted = crypto.privateDecrypt({ key: privateKeyPem, oaepHash: 'sha256' }, buf);
  return decrypted.toString('utf-8');
};

export const createExchangeRate = ({ storage, defaults }) => {
  let rateTimer = null;
  let rateRunning = false;

  const getPublicJwk = async () => {
    const { publicKeyPem } = await readExchangeRateKeypair(storage);
    const keyObj = crypto.createPublicKey(publicKeyPem);
    return keyObj.export({ format: 'jwk' });
  };

  const updateExchangeRatesForUser = async (username, slotHour = null) => {
    const data = await storage.loadUserData(username);
    const settings = data.settings || defaults.defaultSettings();
    const cfg = settings.exchangeRateApi || defaults.defaultSettings().exchangeRateApi;

    if (!cfg.enabled || !cfg.encryptedKey) {
      return { updated: false, reason: 'exchange_rate_api_not_enabled' };
    }

    const apiKey = await decryptExchangeRateApiKey(storage, cfg.encryptedKey);
    const conversionRates = await fetchUsdRatesFromExchangeRateApi(apiKey);

    const desired = (settings.customCurrencies || []).map((c) => c.code).filter(Boolean);
    const nextRates = { ...(settings.exchangeRates || {}) };
    nextRates.USD = 1;

    for (const code of desired) {
      if (code === 'USD') continue;
      const rate = conversionRates[code];
      if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
        nextRates[code] = rate;
      }
    }

    const now = Date.now();
    settings.exchangeRates = nextRates;
    settings.lastRatesUpdate = now;
    settings.exchangeRateApi = {
      ...defaults.defaultSettings().exchangeRateApi,
      ...cfg,
      ...(slotHour === 0 ? { lastRunAt0: now } : {}),
      ...(slotHour === 12 ? { lastRunAt12: now } : {}),
    };

    data.settings = settings;
    await storage.saveUserData(username, data);

    return { updated: true, lastRatesUpdate: now, exchangeRates: nextRates, exchangeRateApi: settings.exchangeRateApi };
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
        const { hour, minute } = getTimePartsInTimeZone(tz);

        const cfg = settings.exchangeRateApi || defaults.defaultSettings().exchangeRateApi;
        if (!cfg.enabled || !cfg.encryptedKey || !cfg.lastTestedAt) return;

        const ran0 = cfg.lastRunAt0 ? formatDateInTimeZone(tz, new Date(cfg.lastRunAt0)) : '';
        const ran12 = cfg.lastRunAt12 ? formatDateInTimeZone(tz, new Date(cfg.lastRunAt12)) : '';

        if ((hour > 0 || (hour === 0 && minute >= 0)) && ran0 !== today) {
          await updateExchangeRatesForUser(username, 0);
        }
        if ((hour > 12 || (hour === 12 && minute >= 0)) && ran12 !== today) {
          await updateExchangeRatesForUser(username, 12);
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

  const decryptKeyForTest = async (encryptedKey) => decryptExchangeRateApiKey(storage, encryptedKey);

  return {
    getPublicJwk,
    decryptKeyForTest,
    fetchUsdRatesFromExchangeRateApi,
    updateExchangeRatesForUser,
    startExchangeRateScheduler,
  };
};
