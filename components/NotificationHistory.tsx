
import React, { useState, useMemo } from 'react';
import { getT } from '../services/i18n';
import { NotificationRecord, NotificationStatus, NotificationChannel } from '../types';
import { Search, ChevronDown, CheckCircle2, XCircle, BarChart3, Clock, Calendar, AlertTriangle, Lightbulb, Mail, Send } from 'lucide-react';
import { PaymentGlyph } from './ui/glyphs';
import { displayPaymentMethodLabel } from '../services/displayLabels';

interface Props {
  lang: 'en' | 'zh';
  notifications: NotificationRecord[];
}

const NotificationHistory: React.FC<Props> = ({ lang, notifications }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        (n.details.message && n.details.message.toLowerCase().includes(searchLower)) ||
        (n.details.receiver && n.details.receiver.toLowerCase().includes(searchLower));
      
      const matchesStatus = statusFilter === 'all' || n.status === statusFilter;
      const matchesChannel = channelFilter === 'all' || n.channel === channelFilter;

      return matchesSearch && matchesStatus && matchesChannel;
    });
  }, [sortedNotifications, searchLower, statusFilter, channelFilter]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // --- Render Helpers ---

  const getStatusBadge = (status: NotificationStatus) => {
    if (status === 'success') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-900">
          <CheckCircle2 size={12} strokeWidth={3} />
          {t('notif_status_success')}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-900">
        <XCircle size={12} strokeWidth={3} />
        {t('notif_status_failed')}
      </span>
    );
  };

  const getTypeLabel = () => t('notif_type_renewal_reminder');

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('notif_total'), value: stats.total, icon: <BarChart3 size={18} />, color: 'text-gray-900 dark:text-white', subColor: 'text-gray-500' },
          { label: t('notif_sent'), value: stats.sent, icon: <CheckCircle2 size={18} />, color: 'text-green-600 dark:text-green-400', subColor: 'text-green-600/70' },
          { label: t('notif_failed'), value: stats.failed, icon: <XCircle size={18} />, color: 'text-red-600 dark:text-red-400', subColor: 'text-red-600/70' },
          { label: t('notif_success_rate'), value: `${stats.rate}%`, icon: <BarChart3 size={18} />, color: 'text-blue-600 dark:text-blue-400', subColor: 'text-blue-600/70' },
        ].map((stat, i) => (
          <div key={i} className="mac-surface p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between h-28 relative overflow-hidden">
             <div className="flex justify-between items-start z-10">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</span>
                <div className={`p-1.5 rounded-lg bg-gray-50 dark:bg-slate-700 ${stat.subColor}`}>{stat.icon}</div>
             </div>
             <div className={`text-3xl font-bold z-10 ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="mac-surface p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-1">
             <Search size={18} className="text-gray-400" />
             <h3 className="font-bold text-gray-800 dark:text-white text-sm">{t('notifications_history')}</h3>
          </div>
          
          <div className="flex flex-col xl:flex-row gap-4">
              <input 
                type="text" 
                placeholder={t('notif_search_placeholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white text-sm"
              />
              
              <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
                  <div className="relative min-w-[140px]">
                      <select 
                        value={statusFilter} 
                        onChange={e => setStatusFilter(e.target.value as any)}
                        className="w-full appearance-none px-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-600 rounded-xl outline-none dark:text-white text-sm pr-8 cursor-pointer"
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
                        className="w-full appearance-none px-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-600 rounded-xl outline-none dark:text-white text-sm pr-8 cursor-pointer"
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
                 const isExpanded = expandedId === notif.id;
                 const typeLabel = getTypeLabel();

                 return (
                     <div 
                        key={notif.id} 
                        className={`mac-surface border rounded-2xl overflow-hidden transition-all ${
                            isExpanded 
                            ? 'border-primary-500 ring-1 ring-primary-500 shadow-md' 
                            : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                     >
                         {/* Header */}
                         <div 
                            onClick={() => toggleExpand(notif.id)}
                            className="p-5 cursor-pointer flex items-center justify-between group"
                         >
                             <div className="flex items-center gap-4">
                                 {/* Status Icon */}
                                 <div>{getStatusBadge(notif.status)}</div>

                                 {/* Type Badge */}
                                 <div className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-slate-700 text-xs font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                     {typeLabel}
                                 </div>

                                 {/* Channel Badge */}
                                 <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700/50 text-xs font-medium text-slate-600 dark:text-slate-400">
                                     {notif.channel === 'telegram' ? <Send size={10} /> : <Mail size={10} />}
                                     {notif.channel === 'telegram' ? 'Telegram' : 'Email'}
                                 </div>
                             </div>

                             <div className="flex items-center gap-6">
                                  <div className="text-right hidden sm:block">
                                      <div className="text-sm font-bold text-gray-900 dark:text-white">{t('service')}: {notif.subscriptionName}</div>
                                      <div className="text-xs text-gray-400 mt-0.5">{formatTime(notif.timestamp)}</div>
                                  </div>
                                  <ChevronDown size={20} className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                             </div>
                         </div>

                         {/* Details (Expanded) */}
                         {isExpanded && (
                             <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-900/50 p-6 animate-fade-in">
                                 
                                 {/* Grid Layout for Fields */}
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                                     
                                     {/* Common Fields */}
                                     <div className="space-y-4">
                                         <div className="flex items-center gap-3">
                                             <Calendar className="text-blue-500" size={18} />
                                             <div>
                                                 <div className="text-xs text-gray-400 uppercase font-bold">{t('notif_detail_date')}</div>
                                                 <div className="text-sm font-medium text-gray-900 dark:text-white">{notif.details.date}</div>
                                             </div>
                                         </div>

                                         {notif.details.amount && (
                                            <div className="flex items-center gap-3">
                                                <div className="w-[18px] text-center text-yellow-500 font-bold">$</div>
                                                <div>
                                                    <div className="text-xs text-gray-400 uppercase font-bold">{t('notif_detail_amount')}</div>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {notif.details.amount.toFixed(2)} {notif.details.currency}
                                                    </div>
                                                </div>
                                            </div>
                                         )}

                                         {notif.details.paymentMethod && (
                                             <div className="flex items-center gap-3">
                                                <PaymentGlyph method={notif.details.paymentMethod} containerSize={18} size={12} />
                                                <div>
                                                    <div className="text-xs text-gray-400 uppercase font-bold">{t('notif_detail_payment')}</div>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{displayPaymentMethodLabel(notif.details.paymentMethod, lang)}</div>
                                                </div>
                                            </div>
                                         )}

                                          <div className="flex items-center gap-3">
                                                <div className="w-[18px] h-[18px] rounded bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-[10px] text-gray-600 dark:text-gray-300 font-bold">Plan</div>
                                                <div>
                                                    <div className="text-xs text-gray-400 uppercase font-bold">{t('notif_detail_plan')}</div>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">/</div>
                                                </div>
                                            </div>
                                     </div>

                                     {/* Right Column / Conditional Fields */}
                                     <div className="space-y-4">
                                         {notif.type === 'renewal_reminder' && (
                                             <div className="flex items-start gap-3">
                                                <Lightbulb className="text-orange-500 mt-1" size={18} />
                                                <div>
                                                    <div className="text-xs text-gray-400 uppercase font-bold">{t('notif_tips')}</div>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{t('notif_tip_ensure_funds')}</div>
                                                </div>
                                            </div>
                                         )}

                                        {notif.status === 'failed' && notif.details.errorReason && (
                                             <div className="flex items-start gap-3">
                                                <AlertTriangle className="text-red-500 mt-1" size={18} />
                                                <div>
                                                    <div className="text-xs text-gray-400 uppercase font-bold">{t('notif_detail_error')}</div>
                                                    <div className="text-sm font-bold text-red-600 dark:text-red-400">{notif.details.errorReason}</div>
                                                </div>
                                            </div>
                                         )}

                                         <div className="flex items-center gap-3">
                                              <div className="w-[18px] flex justify-center"><div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div></div>
                                              <div>
                                                  <div className="text-xs text-gray-400 uppercase font-bold">{t('notif_detail_receiver')}</div>
                                                  <div className="text-xs font-mono bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                                                      {notif.details.receiver}
                                                  </div>
                                              </div>
                                          </div>

                                          <div className="flex items-center gap-3">
                                              <Clock className="text-gray-400" size={18} />
                                              <div>
                                                  <div className="text-xs text-gray-400 uppercase font-bold">{t('notif_detail_sent_time')}</div>
                                                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                      {formatTime(notif.timestamp)}
                                                  </div>
                                              </div>
                                          </div>
                                     </div>

                                 </div>
                             </div>
                         )}
                     </div>
                 )
             })}
             
             {filteredNotifications.length === 0 && (
                 <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                     {t('no_records')}
                 </div>
             )}
         </div>
      </div>
    </div>
  );
};

export default NotificationHistory;
