import React, { useCallback, useEffect, useMemo, useState } from "react";

type NotificationChannel = "email" | "push" | "sms";

interface NotificationPreference {
  channel: NotificationChannel;
  label: string;
  description: string;
  enabled: boolean;
  disabledReason?: string;
}

interface NotificationSettingsState {
  marketing: NotificationPreference[];
  security: NotificationPreference[];
  product: NotificationPreference[];
}

type PermissionStatusType = "default" | "granted" | "denied" | "unsupported" | "unknown";

interface BrowserPermissionState {
  notificationPermission: PermissionStatusType;
  permissionLoading: boolean;
  permissionError: string | null;
}

interface NotificationSettingsProps {
  initialSettings?: NotificationSettingsState;
  onSave?: (settings: NotificationSettingsState) => Promise<void> | void;
  isSaving?: boolean;
  canEdit?: boolean;
}

const DEFAULT_SETTINGS: NotificationSettingsState = {
  marketing: [
    {
      channel: "email",
      label: "Marketing emails",
      description: "Product updates, promotions, and relevant offers.",
      enabled: true,
    },
    {
      channel: "push",
      label: "Marketing push notifications",
      description: "Occasional updates and offers via browser notifications.",
      enabled: false,
    },
  ],
  security: [
    {
      channel: "email",
      label: "Security alerts via email",
      description: "Password changes, suspicious activity, and login alerts.",
      enabled: true,
    },
    {
      channel: "push",
      label: "Security alerts via push",
      description: "Immediate alerts for security-related activity.",
      enabled: true,
    },
    {
      channel: "sms",
      label: "SMS for critical security alerts",
      description: "Use SMS for critical account security issues only.",
      enabled: false,
    },
  ],
  product: [
    {
      channel: "email",
      label: "Product tips & onboarding",
      description: "Guides and tips to help you get the most from the product.",
      enabled: true,
    },
    {
      channel: "push",
      label: "Product announcements",
      description: "Announcements for new features and improvements.",
      enabled: false,
    },
  ],
};

const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  initialSettings,
  onSave,
  isSaving: externalSaving = false,
  canEdit = true,
}) => {
  const [settings, setSettings] = useState<NotificationSettingsState>(
    () => initialSettings ?? DEFAULT_SETTINGS
  );
  const [localSaving, setLocalSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const [browserPermission, setBrowserPermission] = useState<BrowserPermissionState>({
    notificationPermission: "unknown",
    permissionLoading: false,
    permissionError: null,
  });

  const isSaving = externalSaving || localSaving;
  const hasUnsavedChanges = useMemo(() => {
    if (!initialSettings) return true;
    return JSON.stringify(initialSettings) !== JSON.stringify(settings);
  }, [initialSettings, settings]);

  const computeNotificationPermission = useCallback((): PermissionStatusType => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return "unsupported";
    }
    try {
      const permission = Notification.permission as PermissionStatusType;
      return permission || "unknown";
    } catch {
      return "unknown";
    }
  }, []);

  const refreshPermissionState = useCallback(() => {
    const permission = computeNotificationPermission();
    setBrowserPermission((prev) => ({
      ...prev,
      notificationPermission: permission,
      permissionLoading: false,
      permissionError: null,
    }));
  }, [computeNotificationPermission]);

  useEffect(() => {
    refreshPermissionState();
  }, [refreshPermissionState]);

  const requestBrowserPermission = useCallback(async () => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      setBrowserPermission((prev) => ({
        ...prev,
        notificationPermission: "unsupported",
        permissionError: "Browser notifications are not supported on this device.",
      }));
      return;
    }

    setBrowserPermission((prev) => ({
      ...prev,
      permissionLoading: true,
      permissionError: null,
    }));

    try {
      const result = await Notification.requestPermission();
      const permission = (result as PermissionStatusType) || "unknown";
      setBrowserPermission({
        notificationPermission: permission,
        permissionLoading: false,
        permissionError: null,
      });
    } catch {
      setBrowserPermission({
        notificationPermission: "unknown",
        permissionLoading: false,
        permissionError: "Unable to update browser notification permission.",
      });
    }
  }, []);

  const handleTogglePreference = useCallback(
    (sectionKey: keyof NotificationSettingsState, channel: NotificationChannel) => {
      if (!canEdit) return;
      setSettings((prev) => {
        const updatedSection = prev[sectionKey].map((pref) =>
          pref.channel === channel ? { ...pref, enabled: !pref.enabled } : pref
        );
        return { ...prev, [sectionKey]: updatedSection };
      });
      setSaveSuccess(false);
      setSaveError(null);
    },
    [canEdit]
  );

  const handleResetToDefaults = useCallback(() => {
    if (!canEdit) return;
    setSettings(DEFAULT_SETTINGS);
    setSaveSuccess(false);
    setSaveError(null);
  }, [canEdit]);

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    setLocalSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await onSave(settings);
      setSaveSuccess(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save notification settings.";
      setSaveError(message);
    } finally {
      setLocalSaving(false);
    }
  }, [onSave, settings]);

  const renderPermissionStatusLabel = (status: PermissionStatusType): string => {
    switch (status) {
      case "granted":
        return "Enabled";
      case "denied":
        return "Blocked in browser";
      case "default":
        return "Not yet requested";
      case "unsupported":
        return "Not supported";
      case "unknown":
      default:
        return "Unknown";
    }
  };

  const renderPermissionBadgeColor = (status: PermissionStatusType): string => {
    switch (status) {
      case "granted":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "denied":
        return "bg-red-100 text-red-800 border-red-200";
      case "unsupported":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "default":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "unknown":
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const isPushAnyEnabled = useMemo(() => {
    return (
      settings.marketing.some((p) => p.channel === "push" && p.enabled) ||
      settings.security.some((p) => p.channel === "push" && p.enabled) ||
      settings.product.some((p) => p.channel === "push" && p.enabled)
    );
  }, [settings]);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Notification settings</h2>
        <p className="mt-1 text-sm text-slate-600">
          Control how you receive updates, alerts, and important information. These preferences are
          specific to this device and browser.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Browser push notification permissions
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Your browser controls whether this site is allowed to send push notifications. You can
              change this permission in your browser settings at any time.
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <div
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium undefined`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              <span>
                {renderPermissionStatusLabel(browserPermission.notificationPermission)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={requestBrowserPermission}
                disabled={
                  browserPermission.permissionLoading ||
                  browserPermission.notification