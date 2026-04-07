import React, {
  FC,
  ReactNode,
  useEffect,
  useRef,
  useCallback,
  KeyboardEvent,
  MouseEvent,
} from "react";
import ReactDOM from "react-dom";

type ModalSize = "sm" | "md" | "lg" | "xl";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: ModalSize;
  ariaLabel?: string;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement>;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  disableScrollLock?: boolean;
}

const MODAL_ROOT_ID = "modal-root";

const ensureModalRoot = (): HTMLElement => {
  let root = document.getElementById(MODAL_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = MODAL_ROOT_ID;
    document.body.appendChild(root);
  }
  return root;
};

const getFocusableElements = (container: HTMLElement | null): HTMLElement[] => {
  if (!container) return [];
  const selectors = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ];
  const nodes = container.querySelectorAll<HTMLElement>(selectors.join(","));
  return Array.from(nodes).filter((el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"));
};

const Modal: FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  ariaLabel,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  initialFocusRef,
  footer,
  className = "",
  contentClassName = "",
  disableScrollLock = false,
}) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape" && closeOnEsc) {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === "Tab") {
        const focusable = getFocusableElements(dialogRef.current);
        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];
        const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);

        if (event.shiftKey) {
          if (document.activeElement === firstElement || currentIndex === -1) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || currentIndex === -1) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    [closeOnEsc, onClose]
  );

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!closeOnOverlayClick) return;
    if (event.target === overlayRef.current) {
      onClose();
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    lastActiveElementRef.current = document.activeElement as HTMLElement;

    if (!disableScrollLock) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }

    return;
  }, [isOpen, disableScrollLock]);

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const timer = window.requestAnimationFrame(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }

      const focusable = getFocusableElements(dialog);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        dialog.focus();
      }
    });

    return () => {
      window.cancelAnimationFrame(timer);
    };
  }, [isOpen, initialFocusRef]);

  useEffect(() => {
    if (!isOpen) return;

    return () => {
      if (lastActiveElementRef.current && typeof lastActiveElementRef.current.focus === "function") {
        lastActiveElementRef.current.focus();
      }
    };
  }, [isOpen]);

  if (typeof document === "undefined") {
    return null;
  }

  if (!isOpen) {
    return null;
  }

  const modalRoot = ensureModalRoot();

  const sizeClasses: Record<ModalSize, string> = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  const dialogAriaLabel = ariaLabel || title || "Modal dialog";

  const modalContent = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={handleOverlayClick}
      onKeyDown={handleKeyDown}
      aria-modal="true"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-label={dialogAriaLabel}
        aria-modal="true"
        tabIndex={-1}
        className={[
          "relative w-full",
          sizeClasses[size],
          "mx-4 rounded-lg bg-white shadow-xl focus:outline-none",
          "max-h-[90vh] flex flex-col",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          {title && (
            <h2 className="text-lg font-semibold text-gray-900 truncate" id="modal-title">
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            aria-label="Close modal"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <div
          className={[
            "flex-1 overflow-auto px-4 py-3 text-gray-800",
            contentClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </div>

        {footer && (
          <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, modalRoot);
};

export default Modal;