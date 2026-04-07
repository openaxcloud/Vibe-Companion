import React, { useEffect, useCallback, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../../store";
import { clearToast } from "../../store/uiSlice";

type ToastVariant = "success" | "error" | "info";

interface ToastState {
  id: string | null;
  message: string | null;
  variant: ToastVariant;
  isVisible: boolean;
  autoClose: boolean;
  duration: number;
}

const AUTO_DISMISS_FALLBACK = 4000;
const TRANSITION_DURATION = 200;

const variantStyles: Record<
  ToastVariant,
  {
    container: string;
    icon: JSX.Element;
  }
> = {
  success: {
    container:
      "bg-emerald-600 text-white shadow-lg border border-emerald-500/80",
    icon: (
      <svg
        className="h-5 w-5 text-emerald-100 flex-shrink-0"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM14.707 8.293a1 1 0 00-1.414-1.414L9 11.172 6.707 8.879A1 1 0 105.293 10.293l3 3a1 1 0 001.414 0l5-5z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  error: {
    container:
      "bg-rose-600 text-white shadow-lg border border-rose-500/80",
    icon: (
      <svg
        className="h-5 w-5 text-rose-100 flex-shrink-0"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M18 10A8 8 0 11.001 10 8 8 0 0118 10zM9 5a1 1 0 112 0v5a1 1 0 11-2 0V5zm1 9a1.25 1.25 0 100-2.5A1.25 1.25 0 0010 14z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  info: {
    container:
      "bg-slate-800 text-slate-50 shadow-lg border border-slate-700/80",
    icon: (
      <svg
        className="h-5 w-5 text-slate-100 flex-shrink-0"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M9 7a1 1 0 102 0 1 1 0 00-2 0z" />
        <path
          fillRule="evenodd"
          d="M18 10A8 8 0 11.001 10 8 8 0 0118 10zM9 9a1 1 0 000 2h.25v3H9a1 1 0 100 2h2a1 1 0 001-1v-4a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
};

const Toast: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const toast = useSelector<RootState, ToastState>((state) => state.ui.toast);
  const timeoutRef = useRef<number | null>(null);

  const handleClear = useCallback(() => {
    if (!toast.id) return;
    window.clearTimeout(timeoutRef.current ?? undefined);
    timeoutRef.current = null;
    dispatch(clearToast());
  }, [dispatch, toast.id]);

  useEffect(() => {
    if (!toast.id || !toast.message || !toast.isVisible) {
      if (!toast.isVisible && timeoutRef.current) {
        window.clearTimeout(timeoutRef.current ?? undefined);
        timeoutRef.current = null;
      }
      return;
    }

    if (toast.autoClose) {
      const duration =
        toast.duration && toast.duration > TRANSITION_DURATION
          ? toast.duration
          : AUTO_DISMISS_FALLBACK;
      timeoutRef.current = window.setTimeout(() => {
        handleClear();
      }, duration);
    }

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current ?? undefined);
        timeoutRef.current = null;
      }
    };
  }, [toast.id, toast.message, toast.isVisible, toast.autoClose, toast.duration, handleClear]);

  if (!toast.id || !toast.message) {
    return null;
  }

  const variant = variantStyles[toast.variant] ?? variantStyles.info;

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-0 flex items-start justify-center px-4 py-6 sm:items-start sm:justify-end sm:p-6 z-50"
    >
      <div className="flex w-full flex-col items-center space-y-3 sm:items-end">
        <div
          className={[
            "pointer-events-auto max-w-sm overflow-hidden rounded-lg ring-1 ring-black/5",
            "transform transition-all duration-200 ease-out",
            toast.isVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-2 opacity-0",
            variant.container,
          ].join(" ")}
          role="status"
        >
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">{variant.icon}</div>
              <div className="ml-3 flex-1 pt-0.5">
                <p className="text-sm font-medium">{toast.message}</p>
              </div>
              <div className="ml-4 flex flex-shrink-0">
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex rounded-md bg-transparent text-slate-100/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-white"
                  aria-label="Dismiss notification"
                >
                  <span className="sr-only">Close</span>
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 
                      1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 
                      1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 
                      10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toast;