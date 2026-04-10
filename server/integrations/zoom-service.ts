import jwt from 'jsonwebtoken';
import axios from 'axios';

export interface ZoomMeeting {
  id: string;
  topic: string;
  start_time: string;
  duration: number;
  join_url: string;
  start_url: string;
  password?: string;
  timezone?: string;
}

export interface CreateMeetingOptions {
  topic: string;
  start_time: Date;
  duration: number;
  timezone?: string;
  password?: string;
  agenda?: string;
  settings?: {
    host_video?: boolean;
    participant_video?: boolean;
    join_before_host?: boolean;
    mute_upon_entry?: boolean;
    waiting_room?: boolean;
    auto_recording?: 'none' | 'local' | 'cloud';
  };
}

export class ZoomService {
  private apiKey: string | null = null;
  private apiSecret: string | null = null;
  private accountId: string | null = null;
  private clientId: string | null = null;
  private clientSecret: string | null = null;
  private initialized = false;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    this.apiKey = process.env.ZOOM_API_KEY || null;
    this.apiSecret = process.env.ZOOM_API_SECRET || null;
    this.accountId = process.env.ZOOM_ACCOUNT_ID || null;
    this.clientId = process.env.ZOOM_CLIENT_ID || null;
    this.clientSecret = process.env.ZOOM_CLIENT_SECRET || null;

    if (this.clientId && this.clientSecret && this.accountId) {
      this.initialized = true;
    } else if (this.apiKey && this.apiSecret) {
      this.initialized = true;
    } else {
      console.warn('[ZoomService] Not configured. Set ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and ZOOM_ACCOUNT_ID for OAuth.');
      console.warn('[ZoomService] Or set ZOOM_API_KEY and ZOOM_API_SECRET for legacy JWT.');
    }
  }

  private async getAccessToken(): Promise<string | null> {
    if (!this.clientId || !this.clientSecret || !this.accountId) {
      return null;
    }

    const now = Date.now();
    if (this.accessToken && this.tokenExpiry > now) {
      return this.accessToken;
    }

    try {
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      const response = await axios.post(
        `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${this.accountId}`,
        {},
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = now + (response.data.expires_in * 1000) - 60000; // Refresh 1 min early
      
      return this.accessToken;
    } catch (error) {
      console.error('[ZoomService] Failed to get OAuth access token:', error);
      return null;
    }
  }

  private generateJWT(): string | null {
    if (!this.apiKey || !this.apiSecret) {
      return null;
    }

    const payload = {
      iss: this.apiKey,
      exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiry
    };

    return jwt.sign(payload, this.apiSecret);
  }

  async createMeeting(options: CreateMeetingOptions): Promise<ZoomMeeting | null> {
    if (!this.initialized) {
      console.error('[ZoomService] Cannot create meeting - service not configured');
      return null;
    }

    try {
      let token: string | null = null;
      
      if (this.clientId && this.clientSecret && this.accountId) {
        token = await this.getAccessToken();
      } else {
        token = this.generateJWT();
      }

      if (!token) {
        console.error('[ZoomService] Failed to generate authentication token');
        return null;
      }

      const meetingData = {
        topic: options.topic,
        type: 2, // Scheduled meeting
        start_time: options.start_time.toISOString(),
        duration: options.duration,
        timezone: options.timezone || 'UTC',
        password: options.password,
        agenda: options.agenda,
        settings: {
          host_video: options.settings?.host_video ?? true,
          participant_video: options.settings?.participant_video ?? true,
          join_before_host: options.settings?.join_before_host ?? false,
          mute_upon_entry: options.settings?.mute_upon_entry ?? false,
          waiting_room: options.settings?.waiting_room ?? true,
          auto_recording: options.settings?.auto_recording || 'none'
        }
      };

      const response = await axios.post(
        'https://api.zoom.us/v2/users/me/meetings',
        meetingData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const meeting: ZoomMeeting = {
        id: response.data.id.toString(),
        topic: response.data.topic,
        start_time: response.data.start_time,
        duration: response.data.duration,
        join_url: response.data.join_url,
        start_url: response.data.start_url,
        password: response.data.password,
        timezone: response.data.timezone
      };

      return meeting;
    } catch (error: any) {
      console.error('[ZoomService] Error creating meeting:', error.response?.data || error.message);
      return null;
    }
  }

  async getMeeting(meetingId: string): Promise<ZoomMeeting | null> {
    if (!this.initialized) {
      console.error('[ZoomService] Cannot get meeting - service not configured');
      return null;
    }

    try {
      let token: string | null = null;
      
      if (this.clientId && this.clientSecret && this.accountId) {
        token = await this.getAccessToken();
      } else {
        token = this.generateJWT();
      }

      if (!token) {
        console.error('[ZoomService] Failed to generate authentication token');
        return null;
      }

      const response = await axios.get(
        `https://api.zoom.us/v2/meetings/${meetingId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const meeting: ZoomMeeting = {
        id: response.data.id.toString(),
        topic: response.data.topic,
        start_time: response.data.start_time,
        duration: response.data.duration,
        join_url: response.data.join_url,
        start_url: response.data.start_url,
        password: response.data.password,
        timezone: response.data.timezone
      };

      return meeting;
    } catch (error: any) {
      console.error('[ZoomService] Error getting meeting:', error.response?.data || error.message);
      return null;
    }
  }

  async deleteMeeting(meetingId: string): Promise<boolean> {
    if (!this.initialized) {
      console.error('[ZoomService] Cannot delete meeting - service not configured');
      return false;
    }

    try {
      let token: string | null = null;
      
      if (this.clientId && this.clientSecret && this.accountId) {
        token = await this.getAccessToken();
      } else {
        token = this.generateJWT();
      }

      if (!token) {
        console.error('[ZoomService] Failed to generate authentication token');
        return false;
      }

      await axios.delete(
        `https://api.zoom.us/v2/meetings/${meetingId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return true;
    } catch (error: any) {
      console.error('[ZoomService] Error deleting meeting:', error.response?.data || error.message);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const zoomService = new ZoomService();
