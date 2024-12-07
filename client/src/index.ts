import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import dotenv from 'dotenv';
import { TunnelRequest, TunnelResponse, TunnelConfig } from './types';
import logger from './utils/logger';

// Load environment variables
dotenv.config();

class TunnelClient {
  private socket: Socket | null = null;
  private config: TunnelConfig;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.config = {
      serverUrl: process.env.TUNNEL_SERVER_URL || 'http://localhost:3000',
      authToken: process.env.AUTH_TOKEN || '',
      localPort: parseInt(process.env.LOCAL_PORT || '3300'),
      localHost: process.env.LOCAL_HOST || 'localhost',
      heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000'),
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
      reconnectInterval: parseInt(process.env.RECONNECT_INTERVAL || '5000')
    };

    logger.info('Tunnel client initialized with configuration', {
      serverUrl: this.config.serverUrl,
      localPort: this.config.localPort,
      localHost: this.config.localHost
    });
  }

  public async start(): Promise<void> {
    try {
      await this.connect();
      logger.info('Tunnel client started successfully');
    } catch (error) {
      logger.error('Failed to start tunnel client', { error });
      process.exit(1);
    }
  }

  private async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    logger.info('Attempting to connect to tunnel server', {
      serverUrl: this.config.serverUrl
    });

    this.socket = io(this.config.serverUrl, {
      auth: {
        token: this.config.authToken
      },
      reconnection: false
    });

    this.setupSocketListeners();
    this.startHeartbeat();
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      logger.info('Connected to tunnel server', {
        socketId: this.socket?.id
      });
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    });

    this.socket.on('disconnect', (reason) => {
      logger.warn('Disconnected from tunnel server', {
        reason,
        socketId: this.socket?.id
      });
      this.stopHeartbeat();
      this.scheduleReconnect();
    });

    this.socket.on('error', (error) => {
      logger.error('Socket error', { error });
    });

    this.socket.on('tunnel_request', async (request: TunnelRequest, callback: (response: TunnelResponse) => void) => {
      logger.info('Received tunnel request', {
        method: request.method,
        path: request.path
      });

      try {
        const response = await this.handleTunnelRequest(request);
        logger.info('Tunnel request handled successfully', {
          method: request.method,
          path: request.path,
          statusCode: response.statusCode
        });
        callback(response);
      } catch (error: any) {
        logger.error('Failed to handle tunnel request', {
          method: request.method,
          path: request.path,
          error: error.message
        });
        callback({
          statusCode: 500,
          headers: {},
          body: { error: error.message }
        });
      }
    });

    this.socket.on('heartbeat_ack', () => {
      logger.debug('Heartbeat acknowledged');
    });
  }

  private async handleTunnelRequest(request: TunnelRequest): Promise<TunnelResponse> {
    const localUrl = `http://${this.config.localHost}:${this.config.localPort}${request.path}`;
    
    logger.debug('Forwarding request to local service', {
      url: localUrl,
      method: request.method
    });

    try {
      const response = await axios({
        method: request.method,
        url: localUrl,
        headers: request.headers,
        data: request.body,
        timeout: this.config.requestTimeout,
        validateStatus: () => true // Don't throw on any status code
      });

      logger.debug('Received response from local service', {
        statusCode: response.status,
        url: localUrl,
        method: request.method
      });

      return {
        statusCode: response.status,
        headers: response.headers as Record<string, string>,
        body: response.data
      };
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        logger.error('Local service is not running', {
          url: localUrl,
          port: this.config.localPort
        });
        throw new Error('Local service is not running');
      }
      throw error;
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        logger.debug('Sending heartbeat');
        this.socket.emit('heartbeat');
      }
    }, this.config.heartbeatInterval);

    logger.info('Started heartbeat monitoring', {
      interval: this.config.heartbeatInterval
    });
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.info('Stopped heartbeat monitoring');
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    logger.info('Scheduling reconnection attempt', {
      interval: this.config.reconnectInterval
    });

    this.reconnectTimeout = setTimeout(async () => {
      logger.info('Attempting to reconnect...');
      try {
        await this.connect();
      } catch (error) {
        logger.error('Reconnection failed', { error });
        this.scheduleReconnect();
      }
    }, this.config.reconnectInterval);
  }
}

// Start the tunnel client
const client = new TunnelClient();
client.start().catch((error) => {
  logger.error('Failed to start tunnel client', { error });
  process.exit(1);
});
