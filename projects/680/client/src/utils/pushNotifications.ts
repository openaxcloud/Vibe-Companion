import axios, { AxiosInstance } from 'axios';

export type NotificationPermissionStatus = 'default' | 'denied' | 'granted';

export interface PushSubscriptionPayload {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushNotificationsConfig {
  serviceWorkerPath?: string;
  vapidPublicKey: string;
  apiBaseUrl: string;
  subscriptionEndpoint?: string;
  axiosInstance?: AxiosInstance;
}

export interface PushNotificationsStatus {
  supported: boolean;
  permission: NotificationPermissionStatus;
  subscribed: boolean;
  subscription?: PushSubscriptionPayload | null;
}

const DEFAULT_SW_PATH = '/sw.js';
const DEFAULT_SUBSCRIPTION_ENDPOINT = '/api/push/subscription';

let initialized = false;
let currentConfig: PushNotificationsConfig | null = null;

const textToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
};

const isPushSupported = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
};

export const getNotificationPermission = (): NotificationPermissionStatus => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission as NotificationPermissionStatus;
};

export const requestNotificationPermission = async (): Promise<NotificationPermissionStatus> => {
  if (!isPushSupported()) {
    return 'denied';
  }

  const currentPermission = Notification.permission as NotificationPermissionStatus;
  if (currentPermission !== 'default') {
    return currentPermission;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission as NotificationPermissionStatus;
  } catch {
    return 'denied';
  }
};

export const registerServiceWorker = async (
  serviceWorkerPath: string = DEFAULT_SW_PATH
): Promise<ServiceWorkerRegistration | null> => {
  if (!isPushSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(serviceWorkerPath);
    return registration;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to register service worker', error);
    return null;
  }
};

const extractSubscriptionPayload = (subscription: PushSubscription): PushSubscriptionPayload => {
  const rawKey = subscription.getKey('p256dh');
  const rawAuth = subscription.getKey('auth');

  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime,
    keys: {
      p256dh: rawKey ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawKey)))) : '',
      auth: rawAuth ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth)))) : '',
    },
  };
};

const getAxiosInstance = (config: PushNotificationsConfig): AxiosInstance => {
  if (config.axiosInstance) {
    return config.axiosInstance;
  }
  return axios.create({
    baseURL: config.apiBaseUrl,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true,
  });
};

const sendSubscriptionToServer = async (
  config: PushNotificationsConfig,
  subscription: PushSubscriptionPayload | null
): Promise<void> => {
  const client = getAxiosInstance(config);
  const endpoint = config.subscriptionEndpoint || DEFAULT_SUBSCRIPTION_ENDPOINT;

  try {
    if (subscription) {
      await client.post(endpoint, subscription);
    } else {
      await client.delete(endpoint);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to sync push subscription with server', error);
  }
};

export const initPushNotifications = (config: PushNotificationsConfig): void => {
  currentConfig = {
    serviceWorkerPath: config.serviceWorkerPath || DEFAULT_SW_PATH,
    vapidPublicKey: config.vapidPublicKey,
    apiBaseUrl: config.apiBaseUrl,
    subscriptionEndpoint: config.subscriptionEndpoint || DEFAULT_SUBSCRIPTION_ENDPOINT,
    axiosInstance: config.axiosInstance,
  };
  initialized = true;
};

export const getPushNotificationsStatus = async (): Promise<PushNotificationsStatus> => {
  if (!isPushSupported()) {
    return {
      supported: false,
      permission: 'denied',
      subscribed: false,
      subscription: null,
    };
  }

  const permission = getNotificationPermission();
  let subscribed = false;
  let subscription: PushSubscriptionPayload | null = null;

  try {
    const registration = await navigator.serviceWorker.getRegistration(
      currentConfig?.serviceWorkerPath || DEFAULT_SW_PATH
    );

    if (registration) {
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        subscribed = true;
        subscription = extractSubscriptionPayload(existingSubscription);
      }
    }
  } catch {
    // ignore errors, we'll just report unsubscribed
  }

  return {
    supported: true,
    permission,
    subscribed,
    subscription,
  };
};

export const subscribeToPushNotifications = async (): Promise<PushNotificationsStatus> => {
  if (!initialized || !currentConfig) {
    throw new Error('Push notifications not initialized. Call initPushNotifications() first.');
  }

  if (!isPushSupported()) {
    return {
      supported: false,
      permission: 'denied',
      subscribed: false,
      subscription: null,
    };
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    return {
      supported: true,
      permission,
      subscribed: false,
      subscription: null,
    };
  }

  const registration =
    (await navigator.serviceWorker.getRegistration(currentConfig.serviceWorkerPath)) ||
    (await registerServiceWorker(currentConfig.serviceWorkerPath));

  if (!registration) {
    return {
      supported: true,
      permission,
      subscribed: false,
      subscription: null,
    };
  }

  try {
    const existingSubscription = await registration.pushManager.getSubscription();
    let subscription = existingSubscription;

    if (!subscription) {
      const applicationServerKey = textToUint8Array(currentConfig.vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    const payload = extractSubscriptionPayload(subscription);
    await sendSubscriptionToServer(currentConfig, payload);

    return {
      supported: true,
      permission,
      subscribed: true,
      subscription: payload,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to subscribe to push notifications', error);
    return {
      supported: true,
      permission,
      subscribed: false,
      subscription: null,
    };
  }
};

export const unsubscribeFromPushNotifications = async (): Promise<PushNotificationsStatus> => {
  if (!initialized || !currentConfig) {
    throw new Error('Push notifications not initialized. Call initPushNotifications() first.');
  }

  if (!isPushSupported()) {
    return {
      supported: false,
      permission: 'denied',
      subscribed: false,
      subscription: null,
    };
  }

  const permission = getNotificationPermission();

  const registration = await navigator.serviceWorker.getRegistration(
    currentConfig.serviceWorkerPath
  );

  if (!registration) {
    await sendSubscriptionToServer(currentConfig, null);
    return {
      supported: true,
      permission,
      subscribed: false,
      subscription: null,
    };
  }

  try {
    const existingSubscription = await registration.pushManager.getSubscription();

    if (existingSubscription) {
      const payload = extractSubscriptionPayload(existingSubscription);
      await existingSubscription.unsubscribe();
      await sendSubscriptionToServer(currentConfig, null);

      return {
        supported: true,
        permission,
        subscribed: false,
        subscription: payload,
      };
    }

    await sendSubscriptionToServer(currentConfig, null);

    return {
      supported: true,
      permission,
      subscribed: false,
      subscription: null,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to unsubscribe from push notifications', error);
    return {
      supported: true,
      permission,
      subscribed: true,
      subscription: null,
    };
  }
};

export const ensurePushSubscriptionSynced = async (): Promise<void> => {
  if (!initialized || !currentConfig) {
    throw new Error('Push notifications not initialized. Call initPushNotifications() first.');
  }

  if (!isPushSupported()) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration(
      currentConfig.serviceWorkerPath
    );

    if (!registration) {
      await sendSubscriptionToServer(currentConfig, null);
      return;
    }

    const existingSubscription = await registration.pushManager.getSubscription();

    if (existingSubscription) {
      const payload = extractSubscriptionPayload(existingSubscription);