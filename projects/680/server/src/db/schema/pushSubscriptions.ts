import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id')
    .defaultRandom()
    .primaryKey(),

  userId: uuid('user_id')
    .notNull()
    .references(() => sql`users.id`, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  endpoint: text('endpoint')
    .notNull()
    .$defaultFn(() => ''),
  p256dh: text('p256dh')
    .notNull()
    .$defaultFn(() => ''),
  auth: text('auth')
    .notNull()
    .$defaultFn(() => ''),

  // Optional metadata fields for future extensibility
  userAgent: text('user_agent'),
  deviceInfo: text('device_info'),

  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'date',
  })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp('updated_at', {
    withTimezone: true,
    mode: 'date',
  })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;