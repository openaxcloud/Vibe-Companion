/**
 * HTTP Upgrade Responder
 * Production-grade HTTP response framing for WebSocket upgrade failures
 * Fixes code 1006 caused by improper raw socket.write() that doesn't flush on resumed streams
 * 
 * Problem:
 * - Raw socket.write() bypasses HTTP response framing
 * - Resumed sockets require proper ServerResponse handling across Node versions
 * - Direct writes cause opaque 1006 closures without readable error messages
 * 
 * Solution:
 * - Creates ServerResponse facade for proper HTTP framing
 * - Ensures headers/body flush correctly after socket.resume()
 * - Provides standard HTTP error codes with descriptive messages
 * 
 * @module HttpUpgradeResponder
 * @since Nov 21, 2025 - Fortune 500 WebSocket code 1006 fix
 */

import { ServerResponse, IncomingMessage } from 'http';
import { Socket } from 'net';
import { createLogger } from '../utils/logger';

const logger = createLogger('http-upgrade-responder');

export interface UpgradeErrorResponse {
  statusCode: number;
  statusMessage: string;
  body?: string;
  headers?: Record<string, string>;
}

export class HttpUpgradeResponder {
  /**
   * Send HTTP error response during WebSocket upgrade
   * Properly frames response using ServerResponse for reliable delivery
   * 
   * CRITICAL: Socket must be resumed before calling this method
   */
  static sendError(
    request: IncomingMessage,
    socket: Socket,
    params: UpgradeErrorResponse
  ): void {
    const {
      statusCode,
      statusMessage,
      body = statusMessage,
      headers = {}
    } = params;

    try {
      // Verify socket is in correct state
      if (socket.destroyed || !socket.writable) {
        logger.warn('Cannot send error - socket already destroyed');
        return;
      }

      // Create ServerResponse for proper HTTP framing
      // This ensures headers/body flush correctly across all Node versions
      const response = new ServerResponse(request);
      response.assignSocket(socket);

      // Set status
      response.statusCode = statusCode;
      response.statusMessage = statusMessage;

      // Set default headers
      response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      response.setHeader('Connection', 'close');
      response.setHeader('Content-Length', Buffer.byteLength(body));

      // Set custom headers
      for (const [key, value] of Object.entries(headers)) {
        response.setHeader(key, value);
      }

      // Write response and close socket
      response.end(body, () => {
        // Socket closed automatically by ServerResponse.end()
        logger.debug('HTTP upgrade error sent:', {
          statusCode,
          statusMessage,
          bodyLength: body.length,
        });
      });

    } catch (error: any) {
      // Fallback: Try raw write if ServerResponse fails
      logger.error('ServerResponse failed, falling back to raw write:', error.message);
      this.sendErrorFallback(socket, statusCode, statusMessage, body);
    }
  }

  /**
   * Fallback error sender using raw socket write
   * Only used if ServerResponse approach fails
   */
  private static sendErrorFallback(
    socket: Socket,
    statusCode: number,
    statusMessage: string,
    body: string
  ): void {
    if (socket.destroyed || !socket.writable) {
      return;
    }

    try {
      const response = 
        `HTTP/1.1 ${statusCode} ${statusMessage}\r\n` +
        `Content-Type: text/plain; charset=utf-8\r\n` +
        `Content-Length: ${Buffer.byteLength(body)}\r\n` +
        `Connection: close\r\n` +
        `\r\n` +
        body;

      socket.write(response, () => {
        socket.destroy();
      });
    } catch (error: any) {
      logger.error('Fallback error send failed:', error.message);
      socket.destroy();
    }
  }

  /**
   * Standard error responses for common upgrade failures
   */
  static readonly ErrorResponses = {
    BAD_REQUEST: (reason: string): UpgradeErrorResponse => ({
      statusCode: 400,
      statusMessage: 'Bad Request',
      body: `Bad Request: ${reason}`,
    }),

    UNAUTHORIZED: (reason: string): UpgradeErrorResponse => ({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      body: `Unauthorized: ${reason}`,
      headers: {
        'WWW-Authenticate': 'Bearer realm="WebSocket"',
      },
    }),

    FORBIDDEN: (reason: string): UpgradeErrorResponse => ({
      statusCode: 403,
      statusMessage: 'Forbidden',
      body: `Forbidden: ${reason}`,
    }),

    NOT_FOUND: (resource: string): UpgradeErrorResponse => ({
      statusCode: 404,
      statusMessage: 'Not Found',
      body: `Not Found: ${resource}`,
    }),

    RATE_LIMITED: (retryAfter?: number): UpgradeErrorResponse => ({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      body: 'Too Many Requests: Rate limit exceeded',
      headers: retryAfter ? { 'Retry-After': String(retryAfter) } : {},
    }),

    INTERNAL_ERROR: (message: string): UpgradeErrorResponse => ({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      body: `Internal Server Error: ${message}`,
    }),

    SERVICE_UNAVAILABLE: (service: string): UpgradeErrorResponse => ({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
      body: `Service Unavailable: ${service}`,
      headers: {
        'Retry-After': '60', // Retry after 1 minute
      },
    }),

    GATEWAY_TIMEOUT: (operation: string): UpgradeErrorResponse => ({
      statusCode: 504,
      statusMessage: 'Gateway Timeout',
      body: `Gateway Timeout: ${operation} took too long`,
    }),
  };

  /**
   * Send success upgrade acceptance (for testing/debugging)
   * Normally WebSocket libraries handle this, but useful for custom protocols
   */
  static sendUpgradeAccept(
    request: IncomingMessage,
    socket: Socket,
    acceptKey: string
  ): void {
    try {
      if (socket.destroyed || !socket.writable) {
        logger.warn('Cannot send upgrade accept - socket already destroyed');
        return;
      }

      const headers = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        '\r\n'
      ].join('\r\n');

      socket.write(headers);
      logger.debug('WebSocket upgrade accepted');

    } catch (error: any) {
      logger.error('Upgrade accept send failed:', error.message);
      socket.destroy();
    }
  }
}
