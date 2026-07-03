export const registerExchangeRateRoutes = ({ app, auth, storage, exchangeRate }) => {
  app.post('/api/exchange-rate/config', auth.authMiddleware, async (req, res) => {
    try {
      const { apiKey, test } = req.body || {};
      if (typeof apiKey !== 'string' || !apiKey.trim()) {
        return res.status(400).json({ ok: false, message: 'missing_api_key' });
      }
      const plainApiKey = apiKey.trim();
      const encryptedKey = exchangeRate.encryptApiKey(plainApiKey);
      const username = req.user.username;
      const conversionRates = test
        ? await exchangeRate.fetchUsdRatesFromExchangeRateApi(plainApiKey)
        : null;
      const now = Date.now();
      const configured = await storage.updateUserData(username, (current) => {
        const currentSettings = current.settings;
        current.settings.exchangeRateApi = {
          ...currentSettings.exchangeRateApi,
          encryptedKey,
          enabled: Boolean(test),
          lastTestedAt: test ? now : 0,
          lastRunAt0: test ? currentSettings.exchangeRateApi.lastRunAt0 : 0,
          lastRunAt12: test ? currentSettings.exchangeRateApi.lastRunAt12 : 0,
        };
        if (conversionRates) {
          const nextRates = { ...(currentSettings.exchangeRates || {}), USD: 1 };
          const desiredCurrencies = (currentSettings.customCurrencies || [])
            .map((currency) => currency.code)
            .filter(Boolean);
          for (const code of desiredCurrencies) {
            if (code === 'USD') continue;
            const rate = conversionRates[code];
            if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
              nextRates[code] = rate;
            }
          }
          currentSettings.exchangeRates = nextRates;
          currentSettings.lastRatesUpdate = now;
        }
        return current;
      });
      const settings = configured.settings;
      res.json({
        ok: true,
        settings: {
          exchangeRateApi: settings.exchangeRateApi,
          exchangeRates: settings.exchangeRates,
          lastRatesUpdate: settings.lastRatesUpdate,
        },
      });
    } catch (err) {
      console.error('Exchange rate config error', err);
      res.status(400).json({ ok: false, message: err?.message || 'exchange_rate_config_failed' });
    }
  });

  app.post('/api/exchange-rate/update', auth.authMiddleware, async (req, res) => {
    try {
      const updated = await exchangeRate.updateExchangeRatesForUser(req.user.username, null);
      if (!updated.updated) {
        return res.status(400).json({ ok: false, message: updated.reason || 'not_updated' });
      }
      res.json({
        ok: true,
        settings: {
          exchangeRateApi: updated.exchangeRateApi,
          exchangeRates: updated.exchangeRates,
          lastRatesUpdate: updated.lastRatesUpdate,
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, message: err?.message || 'exchange_rate_update_failed' });
    }
  });
};
