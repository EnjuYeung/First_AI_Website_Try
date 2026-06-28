import { useEffect, useState } from 'react';
import * as QRCode from 'qrcode';
import { AppSettings } from '../types';
import { apiFetchJson, authJsonHeaders } from '../services/apiClient';
import { SettingsAlert } from './settingsTypes';

export const useSecuritySettings = (
  settings: AppSettings,
  onUpdate: (settings: AppSettings) => void,
  t: (key: any) => string,
  setAlert: (alert: SettingsAlert) => void,
  setToast: (message: string) => void
) => {
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showQr, setShowQr] = useState(false);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaQrUrl, setTwoFaQrUrl] = useState<string | null>(null);
  const [is2faBusy, setIs2faBusy] = useState(false);
  const [is2faVerifying, setIs2faVerifying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const secret = settings.security.pendingTwoFactorSecret;
    if (!secret) {
      setTwoFaQrUrl(null);
      setShowQr(false);
      return;
    }
    setShowQr(true);
    QRCode.toDataURL(`otpauth://totp/Subm?secret=${secret}&issuer=Subm`, { width: 200, margin: 1 })
      .then((url) => { if (!cancelled) setTwoFaQrUrl(url); })
      .catch(() => { if (!cancelled) setTwoFaQrUrl(null); });
    return () => { cancelled = true; };
  }, [settings.security.pendingTwoFactorSecret]);

  const fail = (error: any) =>
    setAlert({ isOpen: true, type: 'error', title: t('error_title'), message: error?.message || t('connection_failed') || 'Network error' });

  const handleUpdatePassword = async () => {
    const { current, new: next, confirm } = passwords;
    if (!current || !next || !confirm) return fail(new Error(t('password_error_empty')));
    if (next !== confirm) return fail(new Error(t('password_error_mismatch')));
    try {
      await apiFetchJson('/api/change-password', {
        method: 'POST', headers: authJsonHeaders(),
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setPasswords({ current: '', new: '', confirm: '' });
      onUpdate({ ...settings, security: { ...settings.security, lastPasswordChange: new Date().toISOString() } });
      setAlert({ isOpen: true, type: 'success', title: t('success_title'), message: t('password_success') });
    } catch (error) { fail(error); }
  };

  const start = async () => {
    setIs2faBusy(true);
    try {
      const data = await apiFetchJson<any>('/api/2fa/init', { method: 'POST' });
      onUpdate({ ...settings, security: { ...settings.security, pendingTwoFactorSecret: data.secret } });
    } catch (error) { fail(error); } finally { setIs2faBusy(false); }
  };
  const disable = async () => {
    setIs2faBusy(true);
    try {
      await apiFetchJson('/api/2fa/disable', { method: 'POST' });
      setTwoFaCode(''); setTwoFaQrUrl(null); setShowQr(false);
      onUpdate({ ...settings, security: { ...settings.security, twoFactorEnabled: false, twoFactorSecret: '', pendingTwoFactorSecret: '' } });
      setToast(t('success_title'));
    } catch (error) { fail(error); } finally { setIs2faBusy(false); }
  };
  const verifyTwoFactor = async () => {
    if (!twoFaCode) return fail(new Error(t('password_error_empty')));
    setIs2faVerifying(true);
    try {
      await apiFetchJson('/api/2fa/verify', {
        method: 'POST', headers: authJsonHeaders(), body: JSON.stringify({ code: twoFaCode }),
      });
      const secret = settings.security.pendingTwoFactorSecret || settings.security.twoFactorSecret || '';
      setTwoFaCode(''); setTwoFaQrUrl(null); setShowQr(false);
      onUpdate({ ...settings, security: { ...settings.security, twoFactorEnabled: true, twoFactorSecret: secret, pendingTwoFactorSecret: '' } });
      setToast(t('success_title'));
    } catch (error) { fail(error); } finally { setIs2faVerifying(false); }
  };

  return {
    passwords, setPasswords, showQr, twoFaCode, setTwoFaCode, twoFaQrUrl,
    is2faBusy, is2faVerifying, verifyTwoFactor,
    handleUpdatePassword, handleToggleTwoFactor: (enabled: boolean) => enabled ? start() : disable(),
    isTwoFactorActive: settings.security.twoFactorEnabled,
    isTwoFactorPending: !!settings.security.pendingTwoFactorSecret,
  };
};
