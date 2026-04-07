/* eslint-disable no-console */

export type NotificationPermissionState = 'default' | 'denied' | 'granted';

export interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime: number | null;
  keys?: {
    p256dh: string;
    auth: string;
    [key: string]: string;
  };
  [key: string]: unknown;
}

export interface PushRegistrationPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime: number | null;
  browser: string;
  platform: string;
  language: string;
  timeZone: string;
}

export interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: unknown;
  actions?: NotificationAction[];
  silent?: boolean;
}

export interface NotificationServiceConfig {
  serviceWorkerPath?: string;
  serviceWorkerScope?: string;
  applicationServerKey?: string; // VAPID public key (URL-safe base64)
  pushRegistrationEndpoint?: string; // API endpoint to register subscriptions
  fetchOptions?: RequestInit;
}

export interface NotificationServiceStatus {
  supported: boolean;
  permission: NotificationPermissionState;
  pushSupported: boolean;
  serviceWorkerSupported: boolean;
  pushSubscribed: boolean;
}

const DEFAULT_CONFIG: Required<Omit<NotificationServiceConfig, 'applicationServerKey' | 'pushRegistrationEndpoint' | 'fetchOptions'>> = {
  serviceWorkerPath: '/service-worker.js',
  serviceWorkerScope: '/',
};

let config: NotificationServiceConfig = { ...DEFAULT_CONFIG };

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;
let permissionListeners: Array<(permission: NotificationPermissionState) => void> = [];

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function toUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function getBrowserInfo(): string {
  if (!isClient()) return 'unknown';
  const ua = navigator.userAgent;
  if (/chrome|crios|crmo/i.test(ua) && !/edge|edgios|edga|opr|opera/i.test(ua)) return 'chrome';
  if (/firefox|fxios/i.test(ua)) return 'firefox';
  if (/safari/i.test(ua) && !/chrome|crios|crmo|android/i.test(ua)) return 'safari';
  if (/edg/i.test(ua)) return 'edge';
  if (/opr|opera/i.test(ua)) return 'opera';
  if (/android/i.test(ua)) return 'android';
  return 'other';
}

function getPlatformInfo(): string {
  if (!isClient()) return 'unknown';
  const p = navigator.platform.toLowerCase();
  if (p.startsWith('mac')) return 'mac';
  if (p.startsWith('win')) return 'windows';
  if (/iphone|ipad|ipod/.test(p)) return 'ios';
  if (/android/.test(p)) return 'android';
  if (/linux/.test(p)) return 'linux';
  return 'other';
}

function buildPushRegistrationPayload(subscription: PushSubscription): PushRegistrationPayload {
  const json = subscription.toJSON() as PushSubscriptionJSON;
  const { endpoint, expirationTime, keys } = json;

  return {
    endpoint,
    p256dh: keys?.p256dh ?? '',
    auth: keys?.auth ?? '',
    expirationTime: expirationTime ?? null,
    browser: getBrowserInfo(),
    platform: getPlatformInfo(),
    language: isClient() ? navigator.language : 'en',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

async function internalRegisterServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!isClient()) {
    throw new Error('Service workers are not available in this environment');
  }
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported by this browser');
  }
  if (!config.serviceWorkerPath) {
    throw new Error('Service worker path is not configured');
  }
  const scope = config.serviceWorkerScope ?? '/';
  const registration = await navigator.serviceWorker.register(config.serviceWorkerPath, {
    scope,
  });
  await navigator.serviceWorker.ready;
  return registration;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  if (!registrationPromise) {
    registrationPromise = internalRegisterServiceWorker().catch((err) => {
      registrationPromise = null;
      throw err;
    });
  }
  return registrationPromise;
}

function notifyPermissionListeners(permission: NotificationPermissionState): void {
  permissionListeners.forEach((listener) => {
    try {
      listener(permission);
    } catch (error) {
      console.error('Error in notification permission listener', error);
    }
  });
}

export function configureNotificationService(customConfig: NotificationServiceConfig): void {
  config = {
    ...DEFAULT_CONFIG,
    ...config,
    ...customConfig,
  };
}

export function isNotificationSupported(): boolean {
  return isClient() && 'Notification' in window;
}

export function isServiceWorkerSupported(): boolean {
  return isClient() && 'serviceWorker' in navigator;
}

export function isPushSupported(): boolean {
  return isServiceWorkerSupported() && 'PushManager' in window;
}

export function getNotificationPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission as NotificationPermissionState;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) {
    console.warn('Notifications are not supported by this browser');
    return 'denied';
  }

  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch (err) {
    console.error('Error requesting notification permission', err);
    return 'denied';
  }

  const state = permission as NotificationPermissionState;
  notifyPermissionListeners(state);
  return state;
}

export function onNotificationPermissionChange(listener: (permission: NotificationPermissionState) => void): () => void {
  permissionListeners.push(listener);
  return () => {
    permissionListeners = permissionListeners.filter((l) => l !== listener);
  };
}

export async function showLocalNotification(options: NotificationOptions): Promise<Notification | null> {
  if (!isNotificationSupported()) {
    console.warn('Notifications are not supported by this browser');
    return null;
  }

  const permission = getNotificationPermission();
  if (permission !== 'granted') {
    console.warn('Notification permission not granted');
    return null;
  }

  const { title, ...rest } = options;

  try {
    if (isServiceWorkerSupported()) {
      const registration = await getRegistration();
      await registration.showNotification(title, rest);
      return null;
    }

    // Fallback to direct Notification
    return new Notification(title, rest);
  } catch (error) {
    console.error('Error showing notification', error);
    return null;
  }
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    console.warn('Push notifications are not supported by this browser');
    return null;
  }

  const permission = getNotificationPermission();
  if (permission === 'default') {
    const requested = await requestNotificationPermission();
    if (requested !== 'granted') {
      console.warn('Notification permission was not granted');
      return null;
    }
  } else if (permission === 'denied') {
    console.warn('Notification permission is denied');
    return null;
  }

  const registration = await getRegistration();

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    if (!config.applicationServerKey) {
      console.error('VAPID public key (applicationServerKey) is not configured');
      return null;
    }

    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toUint8Array(config.applicationServerKey),
      });
    } catch (error) {
      console.error('Failed to subscribe to push notifications', error);
      return null;
    }
  }

  if (config.pushRegistrationEndpoint) {
    try {
      const payload = buildPushRegistrationPayload(subscription);
      await fetch(config.pushRegistrationEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.fetchOptions?.headers ?? {}),
        },
        body: JSON.stringify(payload),
        ...config.fetchOptions,
      });
    } catch (error) {
      console.error('Failed to register push subscription on server', error);
    }
  }

  return subscription;
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) {
    return false;
  }

  try {
    const registration = await getRegistration();
    const subscription = await registration.pushManager.getSubscription();

    if (!