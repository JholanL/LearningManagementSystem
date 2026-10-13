import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';

const ToastContext = createContext(null);

const ICONS = { success: 'bi-check-circle-fill', danger: 'bi-x-octagon-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };

// Usage:  const toast = useToast();  toast.success('Saved!');  toast.error('Failed');
// Clickable pop-up (used by NotificationBell):  toast.notification({ title, message, icon, onClick })
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, variant = 'success', extra = {}) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, variant, ...extra }]);
  }, []);

  const remove = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  const api = useMemo(
    () => ({
      success: (m) => show(m, 'success'),
      error: (m) => show(m, 'danger'),
      warning: (m) => show(m, 'warning'),
      info: (m) => show(m, 'info'),
      notification: ({ title, message, icon, onClick }) => show(message, 'notification', { title, icon, onClick }),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer position="top-end" className="p-3 toast-stack">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            onClose={() => remove(t.id)}
            delay={t.variant === 'notification' ? 6000 : 3500}
            autohide
            className={`app-toast app-toast-${t.variant}`}
          >
            <Toast.Body className="d-flex align-items-start gap-2">
              <i className={`bi ${t.icon || ICONS[t.variant]} toast-icon`} />
              {t.onClick ? (
                <button
                  type="button"
                  className="toast-link flex-grow-1 min-w-0"
                  onClick={() => {
                    remove(t.id);
                    t.onClick();
                  }}
                >
                  {t.title && <strong className="d-block">{t.title}</strong>}
                  <span className="small text-muted">{t.message}</span>
                </button>
              ) : (
                <span className="flex-grow-1">
                  {t.title && <strong className="d-block">{t.title}</strong>}
                  {t.message}
                </span>
              )}
              <button type="button" className="btn-close btn-close-sm" aria-label="Close" onClick={() => remove(t.id)} />
            </Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
