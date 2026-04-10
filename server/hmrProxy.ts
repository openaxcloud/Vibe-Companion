import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { WebSocket, WebSocketServer } from 'ws';

const HMR_PATHS = ['/__vite_hmr', '/ws', '/_next/webpack-hmr', '/sockjs-node'];

export function isHmrUpgrade(url: string): boolean {
  return HMR_PATHS.some(p => url.startsWith(p));
}

export function proxyHmrConnection(req: IncomingMessage, socket: Socket, head: Buffer, targetPort: number) {
  const targetUrl = `ws://127.0.0.1:${targetPort}${req.url}`;
  const upstream = new WebSocket(targetUrl, { headers: req.headers });

  upstream.on('open', () => {
    const wss = new WebSocketServer({ noServer: true });
    wss.handleUpgrade(req, socket, head, (client) => {
      // Bidirectional proxy
      client.on('message', (data) => { if (upstream.readyState === WebSocket.OPEN) upstream.send(data); });
      upstream.on('message', (data) => { if (client.readyState === WebSocket.OPEN) client.send(data); });
      client.on('close', () => upstream.close());
      upstream.on('close', () => client.close());
      client.on('error', () => upstream.close());
      upstream.on('error', () => client.close());
    });
  });

  upstream.on('error', () => { socket.destroy(); });
}
