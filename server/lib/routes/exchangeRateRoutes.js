export const registerExchangeRateRoutes = ({ app, auth, storage, exchangeRate }) => {
  app.post('/api/exchange-rate/config', auth.authMiddleware, async (req, res) => {
    try {
      const { apiKey, test } = req.body || {};
      if (typeof apiKey !== 'string' || !apiKey.trim()) {
        return res.status(400).json({ ok: false, message: 'missing_api_key' });
      }
      const encryptedKey = exchangeRate.encryptApiKey(apiKey.trim());
      const username = req.user.username;
      const configured = await storage.updateUserData(username, (current) => {
        current.settings.exchangeRateApi = {
          ...current.settings.exchangeRateApi,
          ...(typeof encryptedKey === 'string' ? { encryptedKey } : {}),
          enabled: false,
        };
        return current;
      });
      let settings = configured.settings;
      if (test) {
        const keyToUse = settings.exchangeRateApi.encryptedKey;
        const decryptedApiKey = await exchangeRate.decryptApiKey(keyToUse);
        await exchangeRate.fetchUsdRatesFromExchangeRateApi(decryptedApiKey);
        const tested = await storage.updateUserData(username, (current) => {
          if (current.settings.exchangeRateApi.encryptedKey !== keyToUse) {
            throw new Error('exchange_rate_key_changed');
          }
          Object.assign(current.settings.exchangeRateApi, {
            enabled: true,
            lastTestedAt: Date.now(),
          });
          return current;
        });
        settings = tested.settings;
        const updated = await exchangeRate.updateExchangeRatesForUser(username, null);
        return res.json({
          ok: true,
          settings: {
            exchangeRateApi: updated.exchangeRateApi,
            exchangeRates: updated.exchangeRates,
            lastRatesUpdate: updated.lastRatesUpdate,
          },
        });
      }
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
