// @ts-nocheck
/**
 * Agent Recording Service
 * 
 * Screen recording and session replay for AI Agent sessions.
 * Captures video, creates timeline markers, and manages storage.
 * 
 * Phase 2 - Browser Testing & Quality Infrastructure
 * Fortune 500 Engineering Standards
 */

import type { Browser, Page } from 'playwright';
import { EventEmitter } from 'events';

let playwrightModule: typeof import('playwright') | null = null;
async function getPlaywright() {
  if (!playwrightModule) {
    try {
      playwrightModule = await import('playwright');
    } catch (e) {
      throw new Error('Playwright is not available in production. This feature requires playwright to be installed.');
    }
  }
  return playwrightModule;
}
import { db } from '../db';
import { sessionRecordings, SessionRecording, InsertSessionRecording } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export interface RecordingContext {
  sessionId: string;
  projectId: string;
  userId: string;
}

export interface RecordingOptions {
  recordingType: 'screen' | 'browser' | 'terminal';
  resolution?: { width: number; height: number; };
  fps?: number;
  duration?: number; // Max duration in milliseconds
}

export interface TimelineMarker {
  timestamp: number; // milliseconds from start
  actionType: string;
  description: string;
  screenshotUrl?: string;
}

export class AgentRecordingService extends EventEmitter {
  private activeRecordings: Map<string, {
    browser: Browser;
    page: Page;
    startTime: number;
    timeline: TimelineMarker[];
  }> = new Map();

  constructor() {
    super();
  }

  /**
   * Start recording a session
   */
  async startRecording(
    context: RecordingContext,
    options: RecordingOptions = { recordingType: 'browser' }
  ): Promise<string> {
    const { sessionId, projectId } = context;

    // Create recording record
    const [recording] = await db.insert(sessionRecordings).values({
      sessionId,
      projectId,
      recordingType: options.recordingType,
      videoUrl: '', // Will be updated when recording stops
      duration: 0,
      size: 0,
      resolution: options.resolution || { width: 1920, height: 1080 },
      fps: options.fps || 30,
      timeline: [],
      status: 'processing'
    }).returning();

    // Launch browser with video recording
    const pw = await getPlaywright();
    const browser = await pw.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage({
      viewport: options.resolution || { width: 1920, height: 1080 },
      recordVideo: {
        dir: './recordings',
        size: options.resolution || { width: 1920, height: 1080 }
      }
    });

    // Store active recording
    this.activeRecordings.set(recording.id, {
      browser,
      page,
      startTime: Date.now(),
      timeline: []
    });

    this.emitEvent({
      type: 'recording_started',
      recordingId: recording.id,
      sessionId
    });

    return recording.id;
  }

  /**
   * Add a timeline marker to active recording
   */
  async addTimelineMarker(
    recordingId: string,
    marker: Omit<TimelineMarker, 'timestamp'>
  ): Promise<void> {
    const activeRecording = this.activeRecordings.get(recordingId);
    if (!activeRecording) {
      throw new Error(`No active recording found: ${recordingId}`);
    }

    const timestamp = Date.now() - activeRecording.startTime;
    const timelineMarker: TimelineMarker = {
      timestamp,
      ...marker
    };

    activeRecording.timeline.push(timelineMarker);

    this.emitEvent({
      type: 'timeline_marker_added',
      recordingId,
      marker: timelineMarker
    });
  }

  /**
   * Capture screenshot during recording
   */
  async captureScreenshot(recordingId: string): Promise<string> {
    const activeRecording = this.activeRecordings.get(recordingId);
    if (!activeRecording) {
      throw new Error(`No active recording found: ${recordingId}`);
    }

    const screenshotBuffer = await activeRecording.page.screenshot();
    
    // Upload to object storage for production-grade persistence
    const { realObjectStorageService } = await import('./real-object-storage.service');
    const timestamp = Date.now();
    const storageKey = `recording-screenshots/${recordingId}/${timestamp}.png`;
    
    try {
      await realObjectStorageService.uploadFile(storageKey, screenshotBuffer, {
        contentType: 'image/png',
      });
      return await realObjectStorageService.getSignedUrl(storageKey, 86400);
    } catch (error) {
      console.error('[AgentRecording] Failed to upload screenshot:', error);
      return `/recording-screenshots/${recordingId}/${timestamp}.png`;
    }
  }

  /**
   * Stop recording and save video
   */
  async stopRecording(recordingId: string): Promise<SessionRecording> {
    const activeRecording = this.activeRecordings.get(recordingId);
    if (!activeRecording) {
      throw new Error(`No active recording found: ${recordingId}`);
    }

    const { browser, page, timeline, startTime } = activeRecording;
    const duration = Date.now() - startTime;
    
    // Import object storage service
    const { realObjectStorageService } = await import('./real-object-storage.service');
    const fs = await import('fs/promises');

    // Get video path
    const video = page.video();
    let videoUrl = '';
    let videoSize = 0;

    if (video) {
      const videoPath = await video.path();
      
      try {
        // Read video file and get size
        const videoData = await fs.readFile(videoPath);
        videoSize = videoData.length;
        
        // Upload to object storage
        const videoStorageKey = `session-videos/${recordingId}/video.webm`;
        await realObjectStorageService.uploadFile(videoStorageKey, videoData, {
          contentType: 'video/webm',
        });
        videoUrl = await realObjectStorageService.getSignedUrl(videoStorageKey, 30 * 24 * 60 * 60); // 30 days
      } catch (error) {
        console.error('[AgentRecording] Failed to upload video:', error);
        videoUrl = `/session-videos/${recordingId}/video.webm`;
        videoSize = 0;
      }
    }

    // Generate and upload thumbnail
    const thumbnailBuffer = await page.screenshot();
    let thumbnailUrl = '';
    
    try {
      const thumbnailStorageKey = `session-thumbnails/${recordingId}/thumbnail.png`;
      await realObjectStorageService.uploadFile(thumbnailStorageKey, thumbnailBuffer, {
        contentType: 'image/png',
      });
      thumbnailUrl = await realObjectStorageService.getSignedUrl(thumbnailStorageKey, 30 * 24 * 60 * 60);
    } catch (error) {
      console.error('[AgentRecording] Failed to upload thumbnail:', error);
      thumbnailUrl = `/session-thumbnails/${recordingId}/thumbnail.png`;
    }

    // Close browser
    await browser.close();
    this.activeRecordings.delete(recordingId);

    // Update recording in database
    const [updatedRecording] = await db.update(sessionRecordings)
      .set({
        videoUrl,
        thumbnailUrl,
        duration,
        size: videoSize,
        timeline,
        status: 'ready',
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      })
      .where(eq(sessionRecordings.id, recordingId))
      .returning();

    this.emitEvent({
      type: 'recording_completed',
      recordingId,
      duration,
      size: videoSize
    });

    return updatedRecording;
  }

  /**
   * Get recording by ID
   */
  async getRecording(recordingId: string): Promise<SessionRecording | null> {
    const [recording] = await db.select()
      .from(sessionRecordings)
      .where(eq(sessionRecordings.id, recordingId))
      .limit(1);

    return recording || null;
  }

  /**
   * Get recordings for a session
   */
  async getSessionRecordings(sessionId: string): Promise<SessionRecording[]> {
    return await db.select()
      .from(sessionRecordings)
      .where(eq(sessionRecordings.sessionId, sessionId));
  }

  /**
   * Delete old recordings (cleanup job)
   */
  async cleanupExpiredRecordings(): Promise<number> {
    // In production, implement cleanup logic
    // Delete recordings where expiresAt < now
    return 0;
  }

  private emitEvent(event: any) {
    this.emit('recording_event', event);
  }

  /**
   * Cleanup - stop all active recordings
   */
  async cleanup() {
    for (const [id, recording] of this.activeRecordings) {
      try {
        await recording.browser.close();
        this.activeRecordings.delete(id);
      } catch (error) {
        console.error(`Error closing recording ${id}:`, error);
      }
    }
  }
}

// Export singleton instance
export const agentRecording = new AgentRecordingService();
