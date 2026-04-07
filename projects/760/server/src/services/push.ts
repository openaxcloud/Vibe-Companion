import webPush, { PushSubscription, WebPushError } from 'web-push';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  // Fail fast on misconfiguration
  // eslint-disable-next-line no-console
  console.error(
    'Missing VAPID keys. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in environment variables.'
  );
} else {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export interface StoredSubscription {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

const subscriptionStore: Map<string, StoredSubscription> = new Map();

export const getVapidPublicKey = (): string | null => {
  return VAPID_PUBLIC_KEY || null;
};

export const subscribe = (subscription: PushSubscription): StoredSubscription => {
  const storedSubscription: StoredSubscription = {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: {
      p256dh: subscription.keys?.p256dh ?? '',
      auth: subscription.keys?.auth ?? '',
    },
  };

  subscriptionStore.set(subscription.endpoint, storedSubscription);
  return storedSubscription;
};

export const unsubscribe = (endpoint: string): boolean => {
  if (!endpoint) return false;
  return subscriptionStore.delete(endpoint);
};

export interface PushPayload {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  data?: unknown;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  tag?: string;
  requireInteraction?: boolean;
}

export interface SendOptions {
  ttl?: number;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
  topic?: string;
}

export interface SendResult {
  endpoint: string;
  success: boolean;
  statusCode?: number;
  error?: string;
}

export const sendToSubscription = async (
  subscription: StoredSubscription | PushSubscription,
  payload: PushPayload,
  options: SendOptions = {}
): Promise<SendResult> => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return {
      endpoint: subscription.endpoint,
      success: false,
      error: 'VAPID keys are not configured on the server.',
    };
  }

  const body = JSON.stringify(payload);

  try {
    const result = await webPush.sendNotification(subscription as PushSubscription, body, {
      TTL: options.ttl,
      urgency: options.urgency,
      topic: options.topic,
    });

    return {
      endpoint: subscription.endpoint,
      success: true,
      statusCode: result.statusCode,
    };
  } catch (err: unknown) {
    const error = err as WebPushError;

    if (error.statusCode === 404 || error.statusCode === 410) {
      subscriptionStore.delete(subscription.endpoint);
    }

    return {
      endpoint: subscription.endpoint,
      success: false,
      statusCode: error.statusCode,
      error: error.body || error.message,
    };
  }
};

export const sendToAll = async (
  payload: PushPayload,
  options: SendOptions = {}
): Promise<SendResult[]> => {
  const results: SendResult[] = [];

  const subscriptions = Array.from(subscriptionStore.values());

  for (const subscription of subscriptions) {
    // eslint-disable-next-line no-await-in-loop
    const result = await sendToSubscription(subscription, payload, options);
    results.push(result);
  }

  return results;
};

export const listSubscriptions = (): StoredSubscription[] => {
  return Array.from(subscriptionStore.values());
};