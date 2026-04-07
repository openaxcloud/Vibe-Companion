import React, { useEffect, useCallback, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../../store";
import { removeToast } from "../../store/uiSlice";

type ToastVariant = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContainerProps {
  defaultDuration?: number;
}

const VARIANT_STYLES: Record<
  ToastVariant,
  {
    base: string;
    accent: string;
    icon: JSX.Element;
    ariaLabel: string;
  }
> = {
  success: {
    base: "bg-emerald-50 border-emerald-200 text-emerald-900",
    accent: "bg-emerald-500 text-white",
    icon: (
      <svg
        className="h-4 w-4"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M13.28 4.22a.75.75 0 0 0-1.06-1.06L6.5 8.878 3.78 6.158a.75.75 0 0 0-1.06 1.06l3.25 3.25a.75.75 0 0 0 1.06 0l6.25-6.25Z"
          fill="currentColor"
        />
      </svg>
    ),
    ariaLabel: "Success notification",
  },
  error: {
    base: "bg-rose-50 border-rose-200 text-rose-900",
    accent: "bg-rose-500 text-white",
    icon: (
      <svg
        className="h-4 w-4"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 1.333a6.667 6.667 0 1 0 0 13.334A6.667 6.667 0 0 0 8 1.333Zm0 3.334a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4.667Zm0 6.666a.917.917 0 1 1 0-1.834.917.917 0 0 1 0 1.834Z"
          fill="currentColor"
        />
      </svg>
    ),
    ariaLabel: "Error notification",
  },
  info: {
    base: "bg-sky-50 border-sky-200 text-sky-900",
    accent: "bg-sky-500 text-white",
    icon: (
      <svg
        className="h-4 w-4"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 1.333a6.667 6.667 0 1 0 0 13.334A6.667 6.667 0 0 0 8 1.333Zm0 3.334a.917.917 0 1 1 0 1.833.917.917 0 0 1 0-1.833Zm1 6H7.667a.667.667 0 0 1 0-1.333h.333V8H7a.667.667 0 0 1 0-1.333h1.333C8.701 6.667 9 6.966 9 7.333v2.334h0.333A.667.667 0 1 1 9 11.333Z"
          fill="currentColor"
        />
      </svg>
    ),
    ariaLabel: "Information notification",
  },
};

const ToastContainer: React.FC<ToastContainerProps> = ({
  defaultDuration = 4500,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const toasts = useSelector<RootState, ToastMessage[]>(
    (state) => state.ui.toasts ?? []
  );

  const sortedToasts = useMemo(
    () => [...toasts].sort((a, b) => (a.id > b.id ? 1 : -1)),
    [toasts]
  );

  const handleDismiss = useCallback(
    (id: string) => {
      dispatch(removeToast(id));
    },
    [dispatch]
  );

  useEffect(() => {
    if (!sortedToasts.length) return;

    const timers: number[] = [];
    sortedToasts.forEach((toast) => {
      const timeout = window.setTimeout(
        () => handleDismiss(toast.id),
        toast.duration ?? defaultDuration
      );
      timers.push(timeout);
    });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [sortedToasts, handleDismiss, defaultDuration]);

  if (!sortedToasts.length) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center space-y-2 px-4 pt-4 sm:items-end sm:space-y-3 sm:px-6"
    >
      {sortedToasts.map((toast) => {
        const variant = VARIANT_STYLES[toast.variant] ?? VARIANT_STYLES.info;

        return (
          <div
            key={toast.id}
            role="status"
            aria-label={variant.ariaLabel}
            className="pointer-events-auto w-full max-w-sm transform transition-all duration-200 ease-out sm:max-w-md"
          >
            <div
              className={`relative flex overflow-hidden rounded-lg border shadow-lg ring-1 ring-black/5 undefined`}
            >
              <div className={`flex items-center px-3 undefined`}>
                {variant.icon}
              </div>
              <div className="flex-1 px-3 py-2 text-sm sm:px-4 sm:py-3">
                <p className="text-sm font-medium">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDismiss(toast.id)}
                className="mr-1 inline-flex items-center justify-center rounded-md p-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400"
                aria-label="Dismiss notification"
              >
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4.22 4.22a.75.75 0 0 1 1.06 0L8 6.94l2.72-2.72a.75.75 0 1 1 1.06 1.06L9.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L8 9.06l-2.72 2.72a.75.75 0 1 1-1.06-1.06L6.94 8 4.22 5.28a.75.75 0 0 1 0-1.06Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;