import React from 'react';
import { Subscription, Frequency } from '../types';
import { Edit2, Trash2, ExternalLink, CreditCard } from 'lucide-react';

interface Props {
  subscriptions: Subscription[];
  onEdit: (sub: Subscription) => void;
  onDelete: (id: string) => void;
}

const SubscriptionList: React.FC<Props> = ({ subscriptions, onEdit, onDelete }) => {
  if (subscriptions.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-gray-300">
        <p className="text-gray-500">No subscriptions added yet. Start tracking your expenses!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Service</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Frequency</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Next Bill</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {subscriptions.map((sub) => (
              <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    {sub.iconUrl ? (
                        <div className="w-10 h-10 rounded-full bg-white border border-gray-200 overflow-hidden flex-shrink-0">
                             <img src={sub.iconUrl} alt={sub.name} className="w-full h-full object-contain" />
                        </div>
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg flex-shrink-0">
                        {sub.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    
                    <div>
                      <p className="font-semibold text-gray-900">{sub.name}</p>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <span>{sub.category}</span>
                          {sub.url && (
                            <a href={sub.url} target="_blank" rel="noreferrer" className="text-primary-500 flex items-center hover:underline">
                            <ExternalLink size={10} className="ml-1"/>
                            </a>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="font-medium text-gray-900">{sub.currency === 'USD' ? '$' : sub.currency} {sub.price.toFixed(2)}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      sub.frequency === Frequency.MONTHLY ? 'bg-blue-100 text-blue-800' : 
                      sub.frequency === Frequency.YEARLY ? 'bg-purple-100 text-purple-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                    {sub.frequency}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                        <CreditCard size={14} className="text-gray-400"/>
                        <span>{sub.paymentMethod || 'Credit Card'}</span>
                    </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {sub.nextBillingDate}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <button 
                      onClick={() => onEdit(sub)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => onDelete(sub.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SubscriptionList;