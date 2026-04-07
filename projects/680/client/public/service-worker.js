/* eslint-disable no-restricted-globals */

const APP_ORIGIN = self.location.origin;
const APP_URL = `undefined/`;
const NOTIFICATION_TAG = 'spa-notification';
const DEFAULT_TITLE = 'Notification';
const DEFAULT_BODY = 'You have a new notification.';
const DEFAULT_ICON = `undefined/icons/icon-192x192.png`;
const DEFAULT_BADGE = `undefined/icons/badge-72x72.png`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const activate = async () => {
    if (self.clients && self.clients.claim) {
      await self.clients.claim();
    }
  };
  event.waitUntil(activate());
});

self.addEventListener('push', (event) => {
  if (!event) return;

  let payload: any = {};
  try {
    if (event.data) {
      payload = event.data.json ? event.data.json() : JSON.parse(event.data.text());
    }
  } catch (error) {
    // fallback to empty payload
    payload = {};
  }

  const title: string = payload.title || DEFAULT_TITLE;
  const body: string = payload.body || DEFAULT_BODY;
  const icon: string = payload.icon || DEFAULT_ICON;
  const badge: string = payload.badge || DEFAULT_BADGE;
  const tag: string = payload.tag || NOTIFICATION_TAG;
  const url: string = payload.url || APP_URL;

  const notificationOptions: NotificationOptions = {
    body,
    icon,
    badge,
    tag,
    data: {
      url,
      analytics: payload.analytics || null,
      meta: payload.meta || null,
      receivedAt: Date.now(),
    },
    renotify: payload.renotify ?? false,
    requireInteraction: payload.requireInteraction ?? false,
    silent: payload.silent ?? false,
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const clickedNotification = event.notification;
  const notificationData: any = clickedNotification.data || {};
  const targetUrl: string = notificationData.url || APP_URL;

  const handleClick = async () => {
    let urlToOpen: URL;

    try {
      urlToOpen = new URL(targetUrl, APP_ORIGIN);
    } catch {
      urlToOpen = new URL(APP_URL, APP_ORIGIN);
    }

    const allClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    // Try to focus an existing visible client with matching origin
    let matchingClient: WindowClient | null = null;

    for (const client of allClients) {
      if (client.url.startsWith(APP_ORIGIN)) {
        matchingClient = client as WindowClient;
        break;
      }
    }

    if (matchingClient) {
      await matchingClient.focus();
      try {
        await (matchingClient as any).navigate(urlToOpen.toString());
      } catch {
        // Ignore navigation errors (e.g., some browsers may not support navigate)
      }
      return;
    }

    // No matching client, open a new window
    if (self.clients.openWindow) {
      await self.clients.openWindow(urlToOpen.toString());
    }
  };

  event.waitUntil(handleClick());
});

self.addEventListener('pushsubscriptionchange', (event: any) => {
  // Placeholder: this event should be handled by the main app logic
  // after the SW notifies it. Here we can just ensure SW stays alive.
  event.waitUntil(Promise.resolve());
});