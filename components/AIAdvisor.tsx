import React from 'react';
import { Subscription } from '../types';

interface Props {
  subscriptions: Subscription[];
}

const AIAdvisor: React.FC<Props> = ({ subscriptions }) => {
  return (
    <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
        <h2 className="text-xl font-bold text-gray-700">AI Advisor Disabled</h2>
        <p className="text-gray-500 mt-2">AI features have been removed from this application.</p>
    </div>
  );
};

export default AIAdvisor;