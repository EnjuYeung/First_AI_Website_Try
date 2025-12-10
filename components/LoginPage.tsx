
import React, { useState } from 'react';
import { getT } from '../services/i18n';
import { Lock, User, Globe, ArrowRight, CheckCircle2 } from 'lucide-react';

interface Props {
  onLogin: (token: string) => void;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
        const resp = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, code })
        });

        if (resp.status === 403) {
            setError('需要输入双重验证码');
            return;
        }

        if (!resp.ok) {
            setError(t('invalid_credentials'));
            return;
        }

        const data = await resp.json();
        localStorage.setItem('auth_token', data.token);
        onLogin(data.token);
    } catch (err) {
        console.error('Login error:', err);
        setError(t('connection_failed') || 'Network error');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center items-center p-6 relative overflow-hidden">
      
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px]"></div>
      </div>

      {/* Language Toggle */}
      <div className="absolute top-6 right-6 z-20">
         <button 
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-full shadow-sm hover:shadow-md transition-all text-sm font-medium text-gray-600 dark:text-gray-300"
         >
             <Globe size={16} />
             <span>{lang === 'en' ? 'English' : '中文'}</span>
         </button>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden relative z-10 animate-fade-in">
        
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 p-8 pb-6 text-center">
            <div className="w-16 h-16 bg-primary-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-primary-500/30">
                <span className="text-3xl font-bold text-white">S</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('login_title')}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{t('login_subtitle')}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 pt-0 space-y-5">
            
            {error && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2 animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                    {error}
                </div>
            )}

            <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">{t('username')}</label>
                <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                        type="text" 
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white transition-all"
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">{t('password')}</label>
                <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                        type="password" 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white transition-all"
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">2FA</label>
                <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                        type="text" 
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white transition-all"
                        placeholder="6-digit code (2FA, 如已启用)"
                    />
                </div>
            </div>

            <button 
                type="submit" 
                disabled={isLoading}
                className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4"
            >
                {isLoading ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>{t('logging_in')}</span>
                    </>
                ) : (
                    <>
                        <span>{t('login_button')}</span>
                        <ArrowRight size={20} />
                    </>
                )}
            </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
