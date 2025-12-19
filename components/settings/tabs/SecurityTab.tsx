import React from 'react';
import { AppSettings } from '../../../types';

type Props = {
  t: (key: any) => string;

  settings: AppSettings;
  passwords: { current: string; new: string; confirm: string };
  setPasswords: React.Dispatch<React.SetStateAction<{ current: string; new: string; confirm: string }>>;
  handleUpdatePassword: () => void;

  isTwoFactorActive: boolean;
  isTwoFactorPending: boolean;
  showQr: boolean;
  twoFaQrUrl: string | null;
  twoFaCode: string;
  setTwoFaCode: React.Dispatch<React.SetStateAction<string>>;
  is2faBusy: boolean;
  is2faVerifying: boolean;
  handleToggleTwoFactor: (enabled: boolean) => void;
  verifyTwoFactor: () => void;
};

const SecurityTab: React.FC<Props> = ({
  t,
  settings,
  passwords,
  setPasswords,
  handleUpdatePassword,
  isTwoFactorActive,
  isTwoFactorPending,
  showQr,
  twoFaQrUrl,
  twoFaCode,
  setTwoFaCode,
  is2faBusy,
  is2faVerifying,
  handleToggleTwoFactor,
  verifyTwoFactor,
}) => {
  return (
    <div className="space-y-8 max-w-2xl">
      <section>
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('change_password')}</h3>
        <div className="space-y-4">
          <input
            type="password"
            placeholder={t('current_password')}
            className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-gray-600 dark:text-white"
            value={passwords.current}
            onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
          />
          <input
            type="password"
            placeholder={t('new_password')}
            className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-gray-600 dark:text-white"
            value={passwords.new}
            onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
          />
          <input
            type="password"
            placeholder={t('confirm_new_password')}
            className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-gray-600 dark:text-white"
            value={passwords.confirm}
            onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
          />
          <button
            onClick={handleUpdatePassword}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            {t('update_password')}
          </button>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('two_factor')}</h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isTwoFactorActive || isTwoFactorPending || showQr}
              onChange={(e) => handleToggleTwoFactor(e.target.checked)}
              className="sr-only peer"
              disabled={is2faBusy || is2faVerifying}
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          {settings.security.twoFactorEnabled ? '已开启双重认证' : '未开启双重认证'}
        </p>
        {(showQr || isTwoFactorPending || twoFaQrUrl) && (
          <div className="p-6 bg-gray-50 dark:bg-slate-700 rounded-xl flex flex-col items-center gap-4">
            <div className="w-48 h-48 bg-white p-2">
              {twoFaQrUrl ? (
                <img src={twoFaQrUrl} alt="2FA QR" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                  Loading...
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 text-center">{t('scan_qr')}</p>
            <div className="flex gap-2 w-full max-w-sm">
              <input
                type="text"
                placeholder="Enter 6-digit code"
                className="flex-1 px-4 py-2 border rounded-lg dark:bg-slate-800 dark:border-gray-600 dark:text-white"
                value={twoFaCode}
                onChange={(e) => setTwoFaCode(e.target.value)}
              />
              <button
                onClick={verifyTwoFactor}
                disabled={is2faVerifying}
                className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-60"
              >
                {is2faVerifying ? t('logging_in') : t('verify')}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default SecurityTab;
