import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { WebSocketEvent } from '../types';

export class WebSocketServer {
  private static instance: WebSocketServer;
  private wss: WSServer | null = null;
  private clients = new Set<WebSocket>();

  private constructor() {}

  static getInstance(): WebSocketServer {
    if (!WebSocketServer.instance) {
      WebSocketServer.instance = new WebSocketServer();
    }
    return WebSocketServer.instance;
  }

  attach(wss: WSServer): void {
    this.wss = wss;

    wss.on('connection', (ws) => {
      this.clients.add(ws);

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });

      // Send initial connection ack
      ws.send(
        JSON.stringify({
          type: 'system.connected',
          payload: { timestamp: new Date().toISOString() },
        })
      );
    });
  }

  broadcast(event: WebSocketEvent): void {
    const message = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch {
          this.clients.delete(client);
        }
      }
    }
  }

  broadcastToRun(runId: string, event: WebSocketEvent): void {
    // For now, broadcast to all; in production could filter by subscription
    this.broadcast(event);
  }

  getClientCount(): number {
    return this.clients.size;
  }
}
