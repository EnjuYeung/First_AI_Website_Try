import React, { useState, useEffect } from 'react';
import { X, Upload, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { Frequency, Subscription, AppSettings } from '../types';
import { loadSettings } from '../services/storageService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sub: Subscription) => void;
  initialData?: Subscription | null;
}

const SubscriptionForm: React.FC<Props> = ({ isOpen, onClose, onSave, initialData }) => {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  
  const [formData, setFormData] = useState<Partial<Subscription>>({
    name: '',
    price: 0,
    currency: 'USD',
    frequency: Frequency.MONTHLY,
    category: 'Other',
    paymentMethod: 'Credit Card',
    startDate: new Date().toISOString().split('T')[0],
    nextBillingDate: '',
    notes: '',
    iconUrl: ''
  });

  useEffect(() => {
    // Refresh settings when modal opens to get latest categories/payments
    if (isOpen) {
        setSettings(loadSettings());
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        name: '',
        price: 0,
        currency: 'USD',
        frequency: Frequency.MONTHLY,
        category: settings.customCategories[0] || 'Other',
        paymentMethod: settings.customPaymentMethods[0] || 'Credit Card',
        startDate: today,
        nextBillingDate: today,
        notes: '',
        iconUrl: ''
      });
    }
  }, [initialData, isOpen]);

  // Auto-calculate Next Billing Date based on Start Date and Frequency
  useEffect(() => {
    if (!formData.startDate || !formData.frequency) return;
    
    const calculateNextDate = () => {
      const start = new Date(formData.startDate!);
      const today = new Date();
      today.setHours(0,0,0,0);
      start.setHours(0,0,0,0);

      let nextDate = new Date(start);

      if (nextDate > today) {
        return nextDate.toISOString().split('T')[0];
      }

      while (nextDate <= today) {
        switch (formData.frequency) {
          case Frequency.MONTHLY:
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
          case Frequency.QUARTERLY:
            nextDate.setMonth(nextDate.getMonth() + 3);
            break;
          case Frequency.SEMI_ANNUALLY:
            nextDate.setMonth(nextDate.getMonth() + 6);
            break;
          case Frequency.YEARLY:
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
        }
      }
      return nextDate.toISOString().split('T')[0];
    };

    setFormData(prev => ({ ...prev, nextBillingDate: calculateNextDate() }));
  }, [formData.startDate, formData.frequency]);


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, iconUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: initialData?.id || crypto.randomUUID(),
      ...formData as Subscription,
      price: Number(formData.price)
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden my-8">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {initialData ? 'Edit Subscription' : 'Add New Subscription'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left Column: Icon */}
            <div className="w-full md:w-1/3 space-y-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Service Icon</label>
              
              <div className="flex justify-center">
                <div className="w-24 h-24 rounded-2xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 relative group">
                  {formData.iconUrl ? (
                    <>
                      <img src={formData.iconUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, iconUrl: '' }))}
                        className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white font-medium"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <ImageIcon className="text-gray-400" size={32} />
                  )}
                </div>
              </div>

              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-full py-2 bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition flex items-center justify-center space-x-2">
                  <Upload size={16} />
                  <span>Upload Icon</span>
                </div>
              </div>
            </div>

            {/* Right Column: Details */}
            <div className="w-full md:w-2/3 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Service Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Netflix, Spotify"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    value={formData.currency}
                    onChange={e => setFormData({...formData, currency: e.target.value})}
                  >
                    {settings.customCurrencies.map(c => (
                        <option key={c.code} value={c.code}>{c.code} ({c.name})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequency</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    value={formData.frequency}
                    onChange={e => setFormData({...formData, frequency: e.target.value as Frequency})}
                  >
                    {Object.values(Frequency).map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  >
                    {settings.customCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method</label>
                <select
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    value={formData.paymentMethod}
                    onChange={e => setFormData({...formData, paymentMethod: e.target.value})}
                  >
                    {settings.customPaymentMethods.map(pm => (
                      <option key={pm} value={pm}>{pm}</option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    value={formData.startDate}
                    onChange={e => setFormData({...formData, startDate: e.target.value})}
                  />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                     Next Billing Date
                     <RefreshCw size={12} className="text-gray-400" />
                   </label>
                   <input
                    type="date"
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-slate-600 rounded-lg text-gray-500 dark:text-gray-300 cursor-not-allowed outline-none"
                    value={formData.nextBillingDate}
                   />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all transform active:scale-95 mt-4"
          >
            {initialData ? 'Update Subscription' : 'Add Subscription'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SubscriptionForm;