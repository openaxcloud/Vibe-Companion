import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { getRepository } from "typeorm";
import { PushSubscription } from "../entities/PushSubscription";
import { User } from "../entities/User";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

const router = Router();

const validateBody =
  (schema: z.ZodTypeAny) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: result.error.flatten(),
      });
      return;
    }
    req.body = result.data;
    next();
  };

router.post(
  "/register",
  authMiddleware,
  validateBody(pushSubscriptionSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const user = req.user as User | undefined;
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { endpoint, expirationTime, keys } = req.body as z.infer<
        typeof pushSubscriptionSchema
      >;

      const pushRepo = getRepository(PushSubscription);

      let subscription = await pushRepo.findOne({
        where: { endpoint, user: { id: user.id } },
        relations: ["user"],
      });

      if (!subscription) {
        subscription = pushRepo.create({
          endpoint,
          expirationTime: expirationTime ?? null,
          keys,
          user,
        });
      } else {
        subscription.expirationTime = expirationTime ?? null;
        subscription.keys = keys;
      }

      await pushRepo.save(subscription);

      res.status(201).json({
        success: true,
        subscriptionId: subscription.id,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error registering push subscription:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/unregister",
  authMiddleware,
  validateBody(
    z.object({
      endpoint: z.string().url(),
    })
  ),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const user = req.user as User | undefined;
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { endpoint } = req.body as { endpoint: string };

      const pushRepo = getRepository(PushSubscription);

      const subscription = await pushRepo.findOne({
        where: { endpoint, user: { id: user.id } },
        relations: ["user"],
      });

      if (!subscription) {
        res.status(404).json({ error: "Subscription not found" });
        return;
      }

      await pushRepo.remove(subscription);

      res.status(200).json({ success: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error unregistering push subscription:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.get(
  "/list",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const user = req.user as User | undefined;
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const pushRepo = getRepository(PushSubscription);

      const subscriptions = await pushRepo.find({
        where: { user: { id: user.id } },
      });

      res.status(200).json({
        success: true,
        subscriptions: subscriptions.map((s) => ({
          id: s.id,
          endpoint: s.endpoint,
          expirationTime: s.expirationTime,
          keys: s.keys,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error listing push subscriptions:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;