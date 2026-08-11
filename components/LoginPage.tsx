import React, { useState } from 'react';
import { ArrowRight, Globe, Lock, Repeat2, ShieldCheck, User } from 'lucide-react';
import { getT } from '../services/i18n';

interface Props {
  onLogin: () => void;
  lang: 'en' | 'zh';
  toggleLanguage: () => void;
}

const LoginPage: React.FC<Props> = ({ onLogin, lang, toggleLanguage }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const t = getT(lang);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password, code }),
      });

      if (response.status === 403) {
        setError(lang === 'zh' ? '请输入双重验证码后重试。' : 'Enter your two-factor code and try again.');
        return;
      }

      if (!response.ok) {
        setError(t('invalid_credentials'));
        return;
      }

      await response.json().catch(() => ({}));
      onLogin();
    } catch (loginError) {
      console.error('Login error:', loginError);
      setError(t('connection_failed') || 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="login-shell min-h-screen p-3 sm:p-4 lg:grid lg:grid-cols-[1.08fr_0.92fr] lg:gap-4">
      <section className="login-story hidden min-h-[calc(100vh-2rem)] flex-col justify-between rounded-[26px] p-10 lg:flex xl:p-14" aria-label="Subm overview">
        <div className="relative z-10 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-white/10"><Repeat2 size={20} /></span>
          <span className="font-display text-xl font-semibold tracking-[-0.04em]">Subm</span>
        </div>

        <div className="relative z-10 max-w-2xl py-12">
          <div className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-[#84cbc4]">
            {lang === 'zh' ? '周期支出 · 清晰可见' : 'Recurring costs · clearly scheduled'}
          </div>
          <h1 className="font-display text-5xl font-semibold leading-[0.98] tracking-[-0.06em] xl:text-7xl">
            {lang === 'zh' ? '在扣费之前，先看见它。' : 'See every charge before it arrives.'}
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/66">
            {lang === 'zh'
              ? '把订阅放回时间轴：今天在哪里、下一笔何时发生、本月还需要多少，一眼就能确认。'
              : 'Place every subscription back on a timeline—where today sits, what comes next, and what the month still needs.'}
          </p>

          <div className="login-mini-rail mt-12 max-w-xl" aria-hidden="true">
            <i className="login-mini-stop left-[8%]"><span>05 · Music</span></i>
            <i className="login-mini-stop left-[38%]"><span>14 · Cloud</span></i>
            <i className="login-mini-stop left-[70%]"><span>23 · AI</span></i>
            <i className="login-mini-stop left-[94%]"><span>30 · Video</span></i>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-sm text-white/58">
          <ShieldCheck size={17} />
          <span>{lang === 'zh' ? '自托管数据，仅由你掌控' : 'Self-hosted data, controlled by you'}</span>
        </div>
      </section>

      <section className="relative flex min-h-[calc(100vh-1.5rem)] items-center justify-center px-3 py-16 sm:px-8 lg:min-h-0 lg:px-12">
        <button
          type="button"
          onClick={toggleLanguage}
          className="icon-control absolute right-2 top-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium sm:right-4 sm:top-4"
        >
          <Globe size={16} />
          <span>{lang === 'en' ? 'English' : '中文'}</span>
        </button>

        <div className="w-full max-w-[430px]">
          <div className="mb-10 lg:hidden">
            <div className="flex items-center gap-2.5">
              <span className="brand-mark"><Repeat2 size={19} /></span>
              <span className="brand-wordmark">Subm</span>
            </div>
          </div>

          <div className="eyebrow mb-3">{t('welcome_back')}</div>
          <h2 className="font-display text-4xl font-semibold tracking-[-0.055em] text-[var(--ink)] sm:text-5xl">{t('login_title')}</h2>
          <p className="page-copy mt-3 text-sm">{t('login_subtitle')}</p>

          <form onSubmit={handleSubmit} className="mt-9 space-y-5">
            {error && (
              <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-[var(--alert-coral)] bg-[var(--alert-coral-soft)] px-4 py-3 text-sm text-[var(--alert-coral)]">
                <span className="status-dot mt-1.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-[var(--ink-soft)]">{t('username')}</span>
              <span className="relative block">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-xl border py-3 pl-11 pr-4 outline-none transition"
                  required
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-[var(--ink-soft)]">{t('password')}</span>
              <span className="relative block">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border py-3 pl-11 pr-4 outline-none transition"
                  required
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-[var(--ink-soft)]">2FA</span>
              <span className="relative block">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="w-full rounded-xl border py-3 pl-11 pr-4 font-mono tracking-[0.18em] outline-none transition"
                  placeholder={lang === 'zh' ? '已启用时输入 6 位验证码' : '6-digit code, when enabled'}
                />
              </span>
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="primary-action flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  <span>{t('logging_in')}</span>
                </>
              ) : (
                <>
                  <span>{t('login_button')}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;
