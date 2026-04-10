/**
 * Mobile Builds Router
 * Provides API endpoints for mobile app builds using EAS Build
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { mobileBuilds, mobileBuildRequestSchema, type MobileBuild } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { RealMobileCompiler } from '../services/real-mobile-compiler';
import { createLogger } from '../utils/logger';

const logger = createLogger('mobile-builds-router');
const mobileCompiler = new RealMobileCompiler();

const router = Router();

function ensureAuthenticated(req: Request, res: Response, next: Function) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized', code: 'AUTH_REQUIRED' });
}

router.post('/builds', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not found' });
    }

    const validation = mobileBuildRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        message: 'Invalid build request',
        errors: validation.error.flatten().fieldErrors
      });
    }

    const { platform, bundleId, version, buildNumber, projectId } = validation.data;

    const easBuildToken = process.env.EAS_BUILD_TOKEN || process.env.EXPO_TOKEN;
    if (!easBuildToken) {
      return res.status(503).json({
        message: 'Mobile compilation service not configured',
        code: 'EAS_BUILD_TOKEN_MISSING',
        details: 'EAS_BUILD_TOKEN or EXPO_TOKEN must be set in environment to enable mobile builds. See https://docs.expo.dev/build/setup/'
      });
    }

    const [newBuild] = await db.insert(mobileBuilds).values({
      userId,
      projectId: projectId || null,
      platform,
      bundleId,
      version,
      buildNumber: buildNumber || '1',
      status: 'queued',
      metadata: { requestedAt: new Date().toISOString() }
    }).returning();

    processBuildAsync(newBuild.id, userId, platform, bundleId, version, buildNumber || '1', projectId);

    logger.info(`Mobile build ${newBuild.id} queued for ${platform}`, { userId, platform, bundleId });

    return res.status(201).json({
      id: newBuild.id,
      status: newBuild.status,
      platform: newBuild.platform,
      bundleId: newBuild.bundleId,
      version: newBuild.version,
      createdAt: newBuild.createdAt
    });
  } catch (error) {
    logger.error('Failed to create mobile build', { error });
    return res.status(500).json({ message: 'Failed to create build request' });
  }
});

async function processBuildAsync(
  buildId: number,
  userId: number,
  platform: 'ios' | 'android',
  bundleId: string,
  version: string,
  buildNumber: string,
  projectId?: number
) {
  try {
    await db.update(mobileBuilds)
      .set({ status: 'building', startedAt: new Date() })
      .where(eq(mobileBuilds.id, buildId));

    const result = await mobileCompiler.buildMobileApp({
      projectId: projectId || 0,
      platform,
      buildType: 'release',
      framework: 'react-native',
      appConfig: {
        bundleId,
        appName: bundleId.split('.').pop() || 'App',
        version,
        buildNumber
      }
    });

    if (result.status === 'success' && result.artifacts.length > 0) {
      const artifact = result.artifacts[0];
      await db.update(mobileBuilds)
        .set({
          status: 'completed',
          externalBuildId: result.buildId,
          artifactPath: artifact.path,
          artifactSize: artifact.size,
          artifactUrl: artifact.downloadUrl,
          artifactExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          logs: result.logs.join('\n'),
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(mobileBuilds.id, buildId));

      logger.info(`Mobile build ${buildId} completed successfully`);
    } else {
      await db.update(mobileBuilds)
        .set({
          status: 'failed',
          errorMessage: result.error || 'Build failed without specific error',
          logs: result.logs.join('\n'),
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(mobileBuilds.id, buildId));

      logger.error(`Mobile build ${buildId} failed`, { error: result.error });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await db.update(mobileBuilds)
      .set({
        status: 'failed',
        errorMessage,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(mobileBuilds.id, buildId));

    logger.error(`Mobile build ${buildId} failed with exception`, { error });
  }
}

router.get('/builds', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not found' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const builds = await db.select()
      .from(mobileBuilds)
      .where(eq(mobileBuilds.userId, userId))
      .orderBy(desc(mobileBuilds.createdAt))
      .limit(limit)
      .offset(offset);

    const sanitizedBuilds = builds.map(build => ({
      id: build.id,
      platform: build.platform,
      status: build.status,
      bundleId: build.bundleId,
      version: build.version,
      buildNumber: build.buildNumber,
      errorMessage: build.errorMessage,
      createdAt: build.createdAt,
      startedAt: build.startedAt,
      completedAt: build.completedAt,
      hasArtifact: !!build.artifactUrl
    }));

    return res.json({
      builds: sanitizedBuilds,
      pagination: { limit, offset, hasMore: builds.length === limit }
    });
  } catch (error) {
    logger.error('Failed to fetch mobile builds', { error });
    return res.status(500).json({ message: 'Failed to fetch builds' });
  }
});

router.get('/builds/:buildId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const buildId = parseInt(req.params.buildId);

    if (!userId || isNaN(buildId)) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const [build] = await db.select()
      .from(mobileBuilds)
      .where(and(eq(mobileBuilds.id, buildId), eq(mobileBuilds.userId, userId)))
      .limit(1);

    if (!build) {
      return res.status(404).json({ message: 'Build not found' });
    }

    return res.json({
      id: build.id,
      platform: build.platform,
      status: build.status,
      bundleId: build.bundleId,
      version: build.version,
      buildNumber: build.buildNumber,
      externalBuildId: build.externalBuildId,
      errorMessage: build.errorMessage,
      logs: build.logs,
      artifactSize: build.artifactSize,
      hasArtifact: !!build.artifactUrl,
      createdAt: build.createdAt,
      startedAt: build.startedAt,
      completedAt: build.completedAt
    });
  } catch (error) {
    logger.error('Failed to fetch build status', { error });
    return res.status(500).json({ message: 'Failed to fetch build status' });
  }
});

router.get('/builds/:buildId/artifact', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const buildId = parseInt(req.params.buildId);

    if (!userId || isNaN(buildId)) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const [build] = await db.select()
      .from(mobileBuilds)
      .where(and(eq(mobileBuilds.id, buildId), eq(mobileBuilds.userId, userId)))
      .limit(1);

    if (!build) {
      return res.status(404).json({ message: 'Build not found' });
    }

    if (build.status !== 'completed') {
      return res.status(400).json({ 
        message: 'Artifact not available',
        code: 'BUILD_NOT_COMPLETE',
        status: build.status
      });
    }

    if (!build.artifactUrl) {
      return res.status(404).json({ 
        message: 'Artifact not found',
        code: 'NO_ARTIFACT'
      });
    }

    const now = new Date();
    if (build.artifactExpiresAt && build.artifactExpiresAt < now) {
      return res.status(410).json({
        message: 'Artifact download link has expired',
        code: 'ARTIFACT_EXPIRED',
        expiredAt: build.artifactExpiresAt
      });
    }

    return res.json({
      downloadUrl: build.artifactUrl,
      filename: `${build.bundleId}-${build.version}.${build.platform === 'ios' ? 'ipa' : 'apk'}`,
      size: build.artifactSize,
      expiresAt: build.artifactExpiresAt,
      platform: build.platform
    });
  } catch (error) {
    logger.error('Failed to get artifact download URL', { error });
    return res.status(500).json({ message: 'Failed to get download URL' });
  }
});

router.delete('/builds/:buildId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const buildId = parseInt(req.params.buildId);

    if (!userId || isNaN(buildId)) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const [build] = await db.select()
      .from(mobileBuilds)
      .where(and(eq(mobileBuilds.id, buildId), eq(mobileBuilds.userId, userId)))
      .limit(1);

    if (!build) {
      return res.status(404).json({ message: 'Build not found' });
    }

    if (build.status === 'building') {
      await mobileCompiler.cancelBuild(build.externalBuildId || '');
    }

    await db.update(mobileBuilds)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(mobileBuilds.id, buildId));

    return res.json({ message: 'Build cancelled', id: buildId });
  } catch (error) {
    logger.error('Failed to cancel build', { error });
    return res.status(500).json({ message: 'Failed to cancel build' });
  }
});

router.get('/config', ensureAuthenticated, async (req: Request, res: Response) => {
  const easBuildToken = process.env.EAS_BUILD_TOKEN || process.env.EXPO_TOKEN;
  
  return res.json({
    configured: !!easBuildToken,
    supportedPlatforms: ['ios', 'android'],
    maxConcurrentBuilds: 2,
    documentationUrl: 'https://docs.expo.dev/build/setup/'
  });
});

export default router;
