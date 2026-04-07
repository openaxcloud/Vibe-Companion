import React, { useCallback, useEffect, useState } from "react";

type NotificationPermissionState = "default" | "denied" | "granted" | "unsupported" | "error";

interface NotificationSettingsProps {
  initiallyEnabled?: boolean;
  onChange?: (enabled: boolean) => void;
  /**
   * Called when a subscription attempt should be made.
   * Should resolve to true if subscription is active after call.
   */
  onEnableSubscription?: () => Promise<boolean>;
  /**
   * Called when an unsubscription attempt should be made.
   * Should resolve to true if subscription is disabled after call.
   */
  onDisableSubscription?: () => Promise<boolean>;
}

const getInitialPermissionState = (): NotificationPermissionState => {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  try {
    const perm = Notification.permission;
    if (perm === "granted" || perm === "denied" || perm === "default") {
      return perm;
    }
    return "unsupported";
  } catch {
    return "error";
  }
};

const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  initiallyEnabled = false,
  onChange,
  onEnableSubscription,
  onDisableSubscription,
}) => {
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    getInitialPermissionState()
  );
  const [enabled, setEnabled] = useState<boolean>(initiallyEnabled);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    setPermission(getInitialPermissionState());
  }, []);

  const updatePermission = useCallback(() => {
    setPermission(getInitialPermissionState());
  }, []);

  const handleEnable = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
      setStatusMessage("This browser does not support notifications.");
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      let currentPermission: NotificationPermission;
      try {
        if ("permission" in Notification) {
          currentPermission = Notification.permission;
        } else {
          currentPermission = "default";
        }
      } catch {
        currentPermission = "default";
      }

      let finalPermission = currentPermission;

      if (currentPermission === "default") {
        try {
          finalPermission = await Notification.requestPermission();
        } catch {
          finalPermission = "denied";
        }
      }

      if (finalPermission !== "granted") {
        setPermission(finalPermission as NotificationPermissionState);
        setEnabled(false);
        setStatusMessage(
          finalPermission === "denied"
            ? "Notification permission was denied in your browser settings."
            : "Notification permission could not be obtained."
        );
        onChange?.(false);
        return;
      }

      setPermission("granted");

      if (onEnableSubscription) {
        const subscribed = await onEnableSubscription();
        if (!subscribed) {
          setEnabled(false);
          setStatusMessage("Could not enable notification subscription.");
          onChange?.(false);
          return;
        }
      }

      setEnabled(true);
      setStatusMessage("Push notifications have been enabled.");
      onChange?.(true);
    } catch {
      setPermission("error");
      setEnabled(false);
      setStatusMessage("An error occurred while enabling notifications.");
      onChange?.(false);
    } finally {
      setIsLoading(false);
      updatePermission();
    }
  }, [onChange, onEnableSubscription, updatePermission]);

  const handleDisable = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      if (onDisableSubscription) {
        const unsubscribed = await onDisableSubscription();
        if (!unsubscribed) {
          setStatusMessage("Could not disable notification subscription.");
          return;
        }
      }
      setEnabled(false);
      setStatusMessage("Push notifications have been disabled.");
      onChange?.(false);
    } catch {
      setStatusMessage("An error occurred while disabling notifications.");
    } finally {
      setIsLoading(false);
      updatePermission();
    }
  }, [onChange, onDisableSubscription, updatePermission]);

  const handleToggle = useCallback(() => {
    if (isLoading) return;
    if (enabled) {
      void handleDisable();
    } else {
      void handleEnable();
    }
  }, [enabled, handleDisable, handleEnable, isLoading]);

  const renderPermissionLabel = (): string => {
    switch (permission) {
      case "granted":
        return "Allowed";
      case "denied":
        return "Blocked in browser";
      case "default":
        return "Not yet requested";
      case "unsupported":
        return "Not supported";
      case "error":
      default:
        return "Error";
    }
  };

  const renderHelperText = (): string => {
    if (permission === "unsupported") {
      return "Your browser does not support push notifications.";
    }
    if (permission === "denied") {
      return "Notifications are blocked in your browser settings. Enable them in your browser to use push notifications.";
    }
    if (permission === "granted") {
      return enabled
        ? "You will receive push notifications from this app."
        : "Notifications are allowed in your browser. Enable them here to receive push notifications from this app.";
    }
    if (permission === "default") {
      return "We will ask your browser for permission the first time you enable push notifications.";
    }
    return "There was a problem reading your notification settings.";
  };

  const isToggleDisabled = isLoading || permission === "unsupported" || permission === "error";

  return (
    <section
      aria-label="Notification settings"
      className="notification-settings flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-900"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <h2 className="text-base font-semibold text-gray-900">Push notifications</h2>
          <p className="text-xs text-gray-500">
            Control whether this app can send you push notifications.
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={isToggleDisabled}
          aria-pressed={enabled}
          className={[
            "inline-flex h-6 w-11 items-center rounded-full border transition-colors",
            enabled ? "bg-blue-600 border-blue-600" : "bg-gray-200 border-gray-300",
            isToggleDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
          ].join(" ")}
        >
          <span
            className={[
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-5" : "translate-x-0",
            ].join(" ")}
          />
        </button>
      </header>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="font-medium">Browser permission:</span>
          <span
            className={[
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
              permission === "granted"
                ? "bg-green-100 text-green-800"
                : permission === "denied"
                ? "bg-red-100 text-red-800"
                : permission === "default"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-gray-100 text-gray-700",
            ].join(" ")}
          >
            {renderPermissionLabel()}
          </span>
        </div>
        <p className="text-xs text-gray-500">{renderHelperText()}</p>
        {statusMessage && (
          <p className="mt-1 text-xs text-gray-700" role="status">
            {statusMessage}
          </p>
        )}
        {isLoading && (
          <p className="mt-1 text-xs text-blue-600" role="status">
            Updating notification settings...
          </p>
        )}
      </div>

      {permission === "denied" && (
        <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
          To enable notifications, open your browser settings, locate site permissions, and allow
          notifications for this site. Then return here and enable notifications again.
        </div>
      )}
    </section>
  );
};

export default NotificationSettings;