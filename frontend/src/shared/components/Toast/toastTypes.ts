export type ToastVariant = 'info' | 'warning' | 'error';

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

export type ToastApi = {
  info: (message: string) => string;
  warning: (message: string) => string;
  error: (message: string) => string;
  dismiss: (id: string) => void;
};
