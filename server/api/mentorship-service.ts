import { db } from '../db';
import { mentorProfiles, mentorshipSessions, users } from '@shared/schema';
import { eq, and, desc, gte, lte, count, avg } from 'drizzle-orm';
import { zoomService } from '../integrations/zoom-service';

export class MentorshipService {
  // Create mentor profile
  async createMentorProfile(data: {
    userId: number;
    expertise: string[];
    experience: string;
    hourlyRate?: number;
    availability?: Record<string, any>;
  }) {
    const [profile] = await db
      .insert(mentorProfiles)
      .values({
        ...data,
        hourlyRate: data.hourlyRate?.toString(),
        isActive: true,
        createdAt: new Date()
      })
      .returning();

    return profile;
  }

  // Update mentor profile
  async updateMentorProfile(userId: number, data: Partial<{
    expertise: string[];
    experience: string;
    hourlyRate: number;
    availability: Record<string, any>;
    isActive: boolean;
  }>) {
    const updateData: any = { ...data };
    if (data.hourlyRate !== undefined) {
      updateData.hourlyRate = data.hourlyRate.toString();
    }

    const [profile] = await db
      .update(mentorProfiles)
      .set(updateData)
      .where(eq(mentorProfiles.userId, userId))
      .returning();

    return profile;
  }

  // Get mentor profile
  async getMentorProfile(userId: number) {
    const [profile] = await db
      .select({
        id: mentorProfiles.id,
        expertise: mentorProfiles.expertise,
        experience: mentorProfiles.experience,
        hourlyRate: mentorProfiles.hourlyRate,
        availability: mentorProfiles.availability,
        rating: mentorProfiles.rating,
        totalSessions: mentorProfiles.totalSessions,
        isActive: mentorProfiles.isActive,
        createdAt: mentorProfiles.createdAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          bio: users.bio
        }
      })
      .from(mentorProfiles)
      .innerJoin(users, eq(mentorProfiles.userId, users.id))
      .where(eq(mentorProfiles.userId, userId));

    return profile;
  }

  // Search mentors
  async searchMentors(filters: {
    expertise?: string[];
    maxHourlyRate?: number;
    minRating?: number;
    availability?: string; // day of week
    limit?: number;
    offset?: number;
  }) {
    let query = db
      .select({
        id: mentorProfiles.id,
        expertise: mentorProfiles.expertise,
        experience: mentorProfiles.experience,
        hourlyRate: mentorProfiles.hourlyRate,
        rating: mentorProfiles.rating,
        totalSessions: mentorProfiles.totalSessions,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          bio: users.bio
        }
      })
      .from(mentorProfiles)
      .innerJoin(users, eq(mentorProfiles.userId, users.id))
      .where(eq(mentorProfiles.isActive, true));

    // Apply filters would require more complex SQL for JSON operations
    // For now, return all active mentors and filter in application logic

    const mentors = await query
      .orderBy(desc(mentorProfiles.rating))
      .limit(filters.limit || 20)
      .offset(filters.offset || 0);

    return mentors.filter(mentor => {
      if (filters.expertise && filters.expertise.length > 0) {
        const mentorExpertise = mentor.expertise || [];
        if (!filters.expertise.some(skill => mentorExpertise.includes(skill))) {
          return false;
        }
      }

      if (filters.maxHourlyRate && mentor.hourlyRate) {
        const rate = parseFloat(mentor.hourlyRate);
        if (rate > filters.maxHourlyRate) {
          return false;
        }
      }

      if (filters.minRating && mentor.rating) {
        const rating = parseFloat(mentor.rating);
        if (rating < filters.minRating) {
          return false;
        }
      }

      return true;
    });
  }

  // Book mentorship session
  async bookMentorshipSession(data: {
    mentorId: number;
    menteeId: number;
    title: string;
    description?: string;
    scheduledAt: Date;
    duration: number; // in minutes
  }) {
    const [session] = await db
      .insert(mentorshipSessions)
      .values({
        ...data,
        status: 'active',
        createdAt: new Date()
      })
      .returning();

    // Automatically generate meeting URL
    const meetingUrl = await this.generateMeetingUrl(session.id, {
      title: data.title,
      scheduledAt: data.scheduledAt,
      duration: data.duration
    });

    // Update session with meeting URL
    const [updatedSession] = await db
      .update(mentorshipSessions)
      .set({ meetingUrl })
      .where(eq(mentorshipSessions.id, session.id))
      .returning();

    return updatedSession;
  }

  // Get mentorship sessions
  async getMentorshipSessions(userId: number, role: 'mentor' | 'mentee') {
    const whereClause = role === 'mentor' 
      ? eq(mentorshipSessions.mentorId, userId)
      : eq(mentorshipSessions.menteeId, userId);

    return await db
      .select({
        id: mentorshipSessions.id,
        title: mentorshipSessions.title,
        description: mentorshipSessions.description,
        status: mentorshipSessions.status,
        scheduledAt: mentorshipSessions.scheduledAt,
        duration: mentorshipSessions.duration,
        meetingUrl: mentorshipSessions.meetingUrl,
        notes: mentorshipSessions.notes,
        rating: mentorshipSessions.rating,
        feedback: mentorshipSessions.feedback,
        createdAt: mentorshipSessions.createdAt,
        mentor: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl
        }
      })
      .from(mentorshipSessions)
      .innerJoin(users, eq(mentorshipSessions.mentorId, users.id))
      .where(whereClause)
      .orderBy(desc(mentorshipSessions.scheduledAt));
  }

  // Update session status
  async updateSessionStatus(sessionId: number, status: 'active' | 'completed' | 'cancelled') {
    const [session] = await db
      .update(mentorshipSessions)
      .set({ status })
      .where(eq(mentorshipSessions.id, sessionId))
      .returning();

    return session;
  }

  // Add session notes
  async addSessionNotes(sessionId: number, notes: string, meetingUrl?: string) {
    const updateData: any = { notes };
    if (meetingUrl) {
      updateData.meetingUrl = meetingUrl;
    }

    const [session] = await db
      .update(mentorshipSessions)
      .set(updateData)
      .where(eq(mentorshipSessions.id, sessionId))
      .returning();

    return session;
  }

  // Rate mentorship session
  async rateSession(sessionId: number, rating: number, feedback?: string) {
    const [session] = await db
      .update(mentorshipSessions)
      .set({ 
        rating, 
        feedback,
        status: 'completed'
      })
      .where(eq(mentorshipSessions.id, sessionId))
      .returning();

    // Update mentor's overall rating
    await this.updateMentorRating(session.mentorId);

    return session;
  }

  // Update mentor's overall rating
  private async updateMentorRating(mentorId: number) {
    const [avgRating] = await db
      .select({
        avgRating: avg(mentorshipSessions.rating),
        totalSessions: count()
      })
      .from(mentorshipSessions)
      .where(and(
        eq(mentorshipSessions.mentorId, mentorId),
        eq(mentorshipSessions.status, 'completed')
      ));

    if (avgRating.avgRating) {
      await db
        .update(mentorProfiles)
        .set({
          rating: parseFloat(avgRating.avgRating).toFixed(2),
          totalSessions: avgRating.totalSessions
        })
        .where(eq(mentorProfiles.userId, mentorId));
    }
  }

  // Get mentorship statistics
  async getMentorshipStats() {
    const [totalMentors] = await db
      .select({ count: count() })
      .from(mentorProfiles)
      .where(eq(mentorProfiles.isActive, true));

    const [totalSessions] = await db
      .select({ count: count() })
      .from(mentorshipSessions);

    const [completedSessions] = await db
      .select({ count: count() })
      .from(mentorshipSessions)
      .where(eq(mentorshipSessions.status, 'completed'));

    const topMentors = await db
      .select({
        id: mentorProfiles.id,
        rating: mentorProfiles.rating,
        totalSessions: mentorProfiles.totalSessions,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl
        }
      })
      .from(mentorProfiles)
      .innerJoin(users, eq(mentorProfiles.userId, users.id))
      .where(eq(mentorProfiles.isActive, true))
      .orderBy(desc(mentorProfiles.rating))
      .limit(10);

    return {
      totalMentors: totalMentors.count,
      totalSessions: totalSessions.count,
      completedSessions: completedSessions.count,
      topMentors
    };
  }

  // Get upcoming sessions for mentor/mentee
  async getUpcomingSessions(userId: number) {
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    return await db
      .select({
        id: mentorshipSessions.id,
        title: mentorshipSessions.title,
        scheduledAt: mentorshipSessions.scheduledAt,
        duration: mentorshipSessions.duration,
        mentor: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl
        }
      })
      .from(mentorshipSessions)
      .innerJoin(users, eq(mentorshipSessions.mentorId, users.id))
      .where(and(
        eq(mentorshipSessions.status, 'active'),
        gte(mentorshipSessions.scheduledAt, now),
        lte(mentorshipSessions.scheduledAt, nextWeek)
      ))
      .orderBy(mentorshipSessions.scheduledAt);
  }

  // Generate meeting URL for mentorship sessions using Zoom
  async generateMeetingUrl(
    sessionId: number,
    sessionData: {
      title: string;
      scheduledAt: Date;
      duration: number;
    }
  ): Promise<string> {
    if (!zoomService.isInitialized()) {
      console.warn(`[MentorshipService] Zoom service not initialized for session ${sessionId}`);
      console.warn('[MentorshipService] Set ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and ZOOM_ACCOUNT_ID to enable real meeting links');
      return `https://meet.e-code.ai/session/${sessionId}`;
    }

    try {
      const meeting = await zoomService.createMeeting({
        topic: sessionData.title,
        start_time: sessionData.scheduledAt,
        duration: sessionData.duration,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          waiting_room: true,
          auto_recording: 'none'
        }
      });

      if (meeting) {
        
        return meeting.join_url;
      } else {
        console.error(`[MentorshipService] Failed to create Zoom meeting for session ${sessionId}`);
        return `https://meet.e-code.ai/session/${sessionId}`;
      }
    } catch (error) {
      console.error(`[MentorshipService] Error creating Zoom meeting:`, error);
      return `https://meet.e-code.ai/session/${sessionId}`;
    }
  }
}

export const mentorshipService = new MentorshipService();