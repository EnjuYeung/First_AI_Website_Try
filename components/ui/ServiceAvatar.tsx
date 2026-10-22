import React, { useState } from 'react';
import type { Subscription } from '../../types';

export const ServiceAvatar = ({ sub, large = false }: { sub: Subscription; large?: boolean }) => {
  const [failedUrl, setFailedUrl] = useState('');
  return (
    <span className={`service-avatar ${large ? 'service-avatar-large' : ''}`} aria-hidden="true">
      {sub.iconUrl && sub.iconUrl !== failedUrl ? (
        <img
          src={sub.iconUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(sub.iconUrl || '')}
        />
      ) : (
        sub.name.charAt(0).toUpperCase()
      )}
    </span>
  );
};
