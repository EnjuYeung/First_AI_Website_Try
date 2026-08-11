
import React, { useState, useMemo } from 'react';
import { getT } from '../services/i18n';
import { NotificationRecord, NotificationStatus, NotificationChannel } from '../types';
import { Search, ChevronDown, CheckCircle2, XCircle, BarChart3, Mail, Send, Trash2 } from 'lucide-react';
import { canonicalRenewalFeedback } from '../services/displayLabels';

interface Props {
  lang: 'en' | 'zh';
  notifications: NotificationRecord[];
  onDeleteNotification: (id: string) => void;
  onClearNotifications: () => void;
}

const NotificationHistory: React.FC<Props> = ({ lang, notifications, onDeleteNotification, onClearNotifications }) => {
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<NotificationStatus | 'all'>('all');
  const [channelFilter, setChannelFilter] = useState<NotificationChannel | 'all'>('all');

  const t = getT(lang);
  const searchLower = search.trim().toLowerCase();

  // --- Statistics ---
  const sortedNotifications = useMemo(
    () => [...notifications].sort((a, b) => b.timestamp - a.timestamp),
    [notifications]
  );

  const stats = useMemo(() => {
    const total = sortedNotifications.length;
    const sent = sortedNotifications.filter(n => n.status === 'success').length;
    const failed = sortedNotifications.filter(n => n.status === 'failed').length;
    const rate = total > 0 ? Math.round((sent / total) * 100) : 0;
    return { total, sent, failed, rate };
  }, [sortedNotifications]);

  // --- Filtering ---
  const filteredNotifications = useMemo(() => {
    return sortedNotifications.filter(n => {
      const matchesSearch = 
        n.subscriptionName.toLowerCase().includes(searchLower) || 
        (n.details.message && n.details.message.toLowerCase().includes(searchLower));
      
      const matchesStatus = statusFilter === 'all' || n.status === statusFilter;
      const matchesChannel = channelFilter === 'all' || n.channel === channelFilter;

      return matchesSearch && matchesStatus && matchesChannel;
    });
  }, [sortedNotifications, searchLower, statusFilter, channelFilter]);

  const handleDelete = (id: string) => {
    if (!window.confirm(t('confirm_delete_notification'))) return;
    onDeleteNotification(id);
  };

  const handleClearAll = () => {
    if (sortedNotifications.length === 0) return;
    if (!window.confirm(t('confirm_clear_notifications'))) return;
    onClearNotifications();
  };

  // --- Render Helpers ---

  const getStatusBadge = (status: NotificationStatus) => {
    if (status === 'success') {
      return (
        <span className="flex items-center gap-1.5 rounded-md bg-[var(--rail-teal-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--rail-teal)]">
          <CheckCircle2 size={12} strokeWidth={3} />
          {t('notif_status_success')}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 rounded-md bg-[var(--alert-coral-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--alert-coral)]">
        <XCircle size={12} strokeWidth={3} />
        {t('notif_status_failed')}
      </span>
    );
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRenewalFeedbackLabel = (value?: string) => {
    if (!value) return '';
    const code = canonicalRenewalFeedback(value);
    if (code === 'pending') return t('notif_feedback_pending');
    if (code === 'renewed') return t('notif_feedback_renewed');
    if (code === 'deprecated') return t('notif_feedback_deprecated');
    return value;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <header>
        <div className="eyebrow mb-3">{t('notification_delivery')}</div>
        <h1 className="page-title">{t('notifications_history')}</h1>
        <p className="page-copy mt-3 text-sm">{t('notifications_text')}</p>
      </header>
      
      {/* Stats Cards */}
      <div className="statement-card grid grid-cols-2 overflow-hidden lg:grid-cols-4">
        {[
          { label: t('notif_total'), value: stats.total, icon: <BarChart3 size={16} />, color: 'text-[var(--ink)]' },
          { label: t('notif_sent'), value: stats.sent, icon: <CheckCircle2 size={16} />, color: 'text-[var(--rail-teal)]' },
          { label: t('notif_failed'), value: stats.failed, icon: <XCircle size={16} />, color: 'text-[var(--alert-coral)]' },
          { label: t('notif_success_rate'), value: `${stats.rate}%`, icon: <BarChart3 size={16} />, color: 'text-[var(--due-amber)]' },
        ].map((stat, i) => (
          <div key={i} className="metric-cell relative flex h-28 flex-col justify-between overflow-hidden p-5">
             <div className="z-10 flex items-start justify-between">
                <span className="text-sm font-medium text-[var(--muted)]">{stat.label}</span>
                <div className={stat.color}>{stat.icon}</div>
             </div>
             <div className={`font-data z-10 text-3xl font-medium ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="statement-card space-y-4 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-1">
             <div className="flex items-center gap-2">
                <Search size={18} className="text-gray-400" />
                <h3 className="font-bold text-gray-800 dark:text-white text-sm">{t('notifications_history')}</h3>
             </div>
             {sortedNotifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/60 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  {t('notif_clear')}
                </button>
             )}
          </div>
          
          <div className="flex flex-col xl:flex-row gap-4">
              <input 
                type="text" 
                placeholder={t('notif_search_placeholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none"
              />
              
              <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
                  <div className="relative min-w-[140px]">
                      <select 
                        value={statusFilter} 
                        onChange={e => setStatusFilter(e.target.value as any)}
                        className="w-full cursor-pointer appearance-none rounded-xl border py-2.5 pl-4 pr-8 text-sm outline-none"
                      >
                          <option value="all">{t('notif_filter_status')}</option>
                          <option value="success">{t('notif_status_success')}</option>
                          <option value="failed">{t('notif_status_failed')}</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>

                  <div className="relative min-w-[140px]">
                      <select 
                        value={channelFilter} 
                        onChange={e => setChannelFilter(e.target.value as any)}
                        className="w-full cursor-pointer appearance-none rounded-xl border py-2.5 pl-4 pr-8 text-sm outline-none"
                      >
                          <option value="all">{t('notif_filter_channel')}</option>
                          <option value="telegram">Telegram</option>
                          <option value="email">Email</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
              </div>
          </div>
      </div>

      {/* List */}
      <div>
         <div className="mb-4 text-sm text-gray-500 dark:text-gray-400 font-medium px-1">
             {t('notif_records_count').replace('{count}', filteredNotifications.length.toString())}
         </div>

         <div className="space-y-3">
             {filteredNotifications.map(notif => {
                 const feedbackLabel = getRenewalFeedbackLabel(notif.details?.renewalFeedback);

                 return (
                     <div 
                        key={notif.id} 
                        className="subscription-card relative overflow-hidden"
                        style={{ borderLeftWidth: 3, borderLeftColor: notif.status === 'success' ? 'var(--rail-teal)' : 'var(--alert-coral)' }}
                     >
                         <div className="p-5 pr-12">
                           <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                             <div className="flex items-center">{getStatusBadge(notif.status)}</div>

                             <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700/50 text-xs font-medium text-slate-600 dark:text-slate-400 w-fit">
                                 {notif.channel === 'telegram' ? <Send size={10} /> : <Mail size={10} />}
                                 {notif.channel === 'telegram' ? 'Telegram' : 'Email'}
                             </div>

                             <div className="min-w-0">
                               <div className="text-xs text-gray-400 uppercase font-bold">{t('service')}</div>
                               <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{notif.subscriptionName}</div>
                             </div>

                             <div>
                               <div className="text-xs text-gray-400 uppercase font-bold">{t('notif_detail_sent_time')}</div>
                               <div className="text-sm text-gray-700 dark:text-gray-200">{formatTime(notif.timestamp)}</div>
                             </div>

                             <div>
                               <div className="text-xs text-gray-400 uppercase font-bold">{t('notif_detail_feedback')}</div>
                               <div className="text-sm font-medium text-gray-900 dark:text-white">{feedbackLabel || '-'}</div>
                             </div>
                           </div>
                         </div>

                         <button
                           onClick={() => handleDelete(notif.id)}
                           className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                           title={t('notif_delete')}
                         >
                           <Trash2 size={16} />
                         </button>
                     </div>
                 )
             })}
             
             {filteredNotifications.length === 0 && (
                 <div className="statement-card border-dashed py-12 text-center text-[var(--muted)]">
                     {t('no_records')}
                 </div>
             )}
         </div>
      </div>
    </div>
  );
};

export default NotificationHistory;
