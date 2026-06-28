export interface SettingsAlert {
  isOpen: boolean;
  type: 'success' | 'error';
  title: string;
  message: string;
}
