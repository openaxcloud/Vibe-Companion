import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// In-memory storage for demo purposes.
// Replace with real database/service integrations in production.
interface DeviceRegistration {
  id: string;
  userId: string;
  deviceToken: string;
  platform: "ios" | "android" | "web";
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  preferences: NotificationPreferences;
}

interface NotificationPreferences {
  marketing: boolean;
  transactional: boolean;
  alerts: boolean;
  newsletter: boolean;
}

const deviceRegistrations: Map<string, DeviceRegistration> = new Map();

// Basic auth middleware placeholder.
// Replace with real authentication/authorization logic.
interface AuthedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

const mockAuthMiddleware = (
  req: AuthedRequest,
  _res: Response,
  next: NextFunction
): void => {
  // In a real implementation, you would extract user information from
  // a token/session/etc. Here we mock an authenticated user.
  if (!req.user) {
    req.user = {
      id: "demo-user-id",
      email: "demo@example.com",
    };
  }
  next();
};

// Validation schemas
const registerDeviceSchema = z.object({
  deviceToken: z.string().min(1, "deviceToken is required"),
  platform: z.enum(["ios", "android", "web"]),
  enabled: z.boolean().optional().default(true),
  preferences: z
    .object({
      marketing: z.boolean().optional().default(true),
      transactional: z.boolean().optional().default(true),
      alerts: z.boolean().optional().default(true),
      newsletter: z.boolean().optional().default(false),
    })
    .optional(),
});

const updatePreferencesSchema = z.object({
  marketing: z.boolean().optional(),
  transactional: z.boolean().optional(),
  alerts: z.boolean().optional(),
  newsletter: z.boolean().optional(),
});

const updateDeviceStatusSchema = z.object({
  enabled: z.boolean(),
});

// Middleware to validate request bodies using Zod
const validateBody =
  <T>(schema: z.ZodSchema<T>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "ValidationError",
        details: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }
    (req as any).validatedBody = result.data;
    next();
  };

// Utility functions
const getUserDevices = (userId: string): DeviceRegistration[] => {
  return Array.from(deviceRegistrations.values()).filter(
    (device) => device.userId === userId
  );
};

const findUserDeviceById = (
  userId: string,
  deviceId: string
): DeviceRegistration | undefined => {
  const device = deviceRegistrations.get(deviceId);
  if (!device || device.userId !== userId) {
    return undefined;
  }
  return device;
};

// Routes

// Register a device for push notifications
router.post(
  "/devices",
  mockAuthMiddleware,
  validateBody(registerDeviceSchema),
  (req: AuthedRequest, res: Response): void => {
    const { deviceToken, platform, enabled, preferences } = (req as any)
      .validatedBody as z.infer<typeof registerDeviceSchema>;

    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Check for existing registration with same token and user/platform
    const existing = getUserDevices(req.user.id).find(
      (d) => d.deviceToken === deviceToken && d.platform === platform
    );

    const nowIso = new Date().toISOString();

    if (existing) {
      const updated: DeviceRegistration = {
        ...existing,
        enabled: enabled ?? existing.enabled,
        preferences: {
          ...existing.preferences,
          ...(preferences ?? {}),
        },
        updatedAt: nowIso,
      };
      deviceRegistrations.set(existing.id, updated);
      res.status(200).json(updated);
      return;
    }

    const id = uuidv4();
    const registration: DeviceRegistration = {
      id,
      userId: req.user.id,
      deviceToken,
      platform,
      enabled: enabled ?? true,
      createdAt: nowIso,
      updatedAt: nowIso,
      preferences: {
        marketing: preferences?.marketing ?? true,
        transactional: preferences?.transactional ?? true,
        alerts: preferences?.alerts ?? true,
        newsletter: preferences?.newsletter ?? false,
      },
    };

    deviceRegistrations.set(id, registration);
    res.status(201).json(registration);
  }
);

// List current user's registered devices
router.get(
  "/devices",
  mockAuthMiddleware,
  (req: AuthedRequest, res: Response): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const devices = getUserDevices(req.user.id);
    res.json(devices);
  }
);

// Get a specific device registration
router.get(
  "/devices/:id",
  mockAuthMiddleware,
  (req: AuthedRequest, res: Response): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const device = findUserDeviceById(req.user.id, req.params.id);
    if (!device) {
      res.status(404).json({ error: "DeviceNotFound" });
      return;
    }
    res.json(device);
  }
);

// Update notification preferences for a specific device
router.patch(
  "/devices/:id/preferences",
  mockAuthMiddleware,
  validateBody(updatePreferencesSchema),
  (req: AuthedRequest, res: Response): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const device = findUserDeviceById(req.user.id, req.params.id);
    if (!device) {
      res.status(404).json({ error: "DeviceNotFound" });
      return;
    }

    const updates = (req as any)
      .validatedBody as z.infer<typeof updatePreferencesSchema>;

    const updated: DeviceRegistration = {
      ...device,
      preferences: {
        ...device.preferences,
        ...updates,
      },
      updatedAt: new Date().toISOString(),
    };

    deviceRegistrations.set(device.id, updated);
    res.json(updated);
  }
);

// Enable/disable a specific device
router.patch(
  "/devices/:id/status",
  mockAuthMiddleware,
  validateBody(updateDeviceStatusSchema),
  (req: AuthedRequest, res: Response): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const device = findUserDeviceById(req.user.id, req.params.id);
    if (!device) {
      res.status(404).json({ error: "DeviceNotFound" });
      return;
    }

    const { enabled } = (req as any)
      .validatedBody as z.infer<typeof updateDeviceStatusSchema>;

    const updated: DeviceRegistration = {
      ...device,
      enabled,
      updatedAt: new Date().toISOString(),
    };

    deviceRegistrations.set(device.id, updated);
    res.json(updated);
  }
);

// Delete/unregister a device
router.delete(
  "/devices/:id",
  mockAuthMiddleware,
  (req: AuthedRequest, res: Response): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const device = findUserDeviceById(req.user.id, req.params.id);
    if (!device) {
      res.status(404).json({ error: "DeviceNotFound" });
      return;
    }

    deviceRegistrations.delete(device.id);
    res.status(204).send();
  }
);

// Get aggregated notification preferences for the current user
router.get(
  "/preferences",
  mockAuthMiddleware,
  (req: AuthedRequest, res: Response): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const devices = getUserDevices(req.user.id);

    if (devices.length === 0) {
      res.json({
        marketing: false,
        transactional: false,
        alerts: false,
        newsletter: false,
      });
      return;
    }

    const aggregate = devices.reduce(
      (acc, device) => {
        acc.marketing = acc.marketing || device.preferences.marketing;
        acc.transactional = acc.transactional || device.preferences.transactional;
        acc.alerts = acc.alerts || device.preferences.alerts;
        acc.newsletter = acc.newsletter || device.preferences.newsletter;
        return acc;
      },
      {
        marketing: false,
        transactional: false,
        alerts: false,
        newsletter: false,
      }
    );

    res.json(aggregate);
  }
);

// Update notification preferences for all devices of current user
router.patch(
  "/preferences",
  mockAuthMiddleware,