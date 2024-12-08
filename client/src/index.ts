import { io, Socket } from 'socket.io-client';
import axios from 'axios';

interface TunnelRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: any;
}

interface TunnelResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
}

interface TunnelConfig {
  serverUrl: string;
  authToken: string;
  localPort: number;
  localHost: string;
  heartbeatInterval: number;
  requestTimeout: number;
  reconnectInterval: number;
}


class TunnelClient {
  private socket: Socket | null = null;
  private config: TunnelConfig;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(config: TunnelConfig) {
    this.config = config;

    console.log('Tunnel client initialized with configuration', {
      serverUrl: this.config.serverUrl,
      localPort: this.config.localPort,
      localHost: this.config.localHost
    });
  }

  public async start(): Promise<void> {
    try {
      await this.connect();
      console.log('Tunnel client started successfully');
    } catch (error) {
      console.error('Failed to start tunnel client', { error });
      process.exit(1);
    }
  }

  private async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    console.log('Attempting to connect to tunnel server', {
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
      console.log('Connected to tunnel server', {
        socketId: this.socket?.id
      });
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('Disconnected from tunnel server', {
        reason,
        socketId: this.socket?.id
      });
      this.stopHeartbeat();
      this.scheduleReconnect();
    });

    this.socket.on('error', (error) => {
      console.error('Socket error', { error });
    });

    this.socket.on('tunnel_request', async (request: TunnelRequest, callback: (response: TunnelResponse) => void) => {
      console.log('Received tunnel request', {
        method: request.method,
        path: request.path
      });

      try {
        const response = await this.handleTunnelRequest(request);
        console.log('Tunnel request handled successfully', {
          method: request.method,
          path: request.path,
          statusCode: response.statusCode
        });
        callback(response);
      } catch (error: any) {
        console.error('Failed to handle tunnel request', {
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
      console.log('Heartbeat acknowledged');
    });
  }

  private async handleTunnelRequest(request: TunnelRequest): Promise<TunnelResponse> {
    const localUrl = `http://${this.config.localHost}:${this.config.localPort}${request.path}`;

    console.log('Forwarding request to local service', {
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

      console.log('Received response from local service', {
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
        console.error('Local service is not running', {
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
        console.log('Sending heartbeat');
        this.socket.emit('heartbeat');
      }
    }, this.config.heartbeatInterval);

    console.log('Started heartbeat monitoring', {
      interval: this.config.heartbeatInterval
    });
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('Stopped heartbeat monitoring');
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    console.log('Scheduling reconnection attempt', {
      interval: this.config.reconnectInterval
    });

    this.reconnectTimeout = setTimeout(async () => {
      console.log('Attempting to reconnect...');
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection failed', { error });
        this.scheduleReconnect();
      }
    }, this.config.reconnectInterval);
  }
}

// Start the tunnel client
const client = new TunnelClient({
  serverUrl: 'https://tunnel.example.com:3000',
  authToken: 'your-jwt-token',
  localPort: 3000,
  localHost: 'localhost',
  heartbeatInterval: 30000, // check for disconnection every30 seconds
  requestTimeout: 600000, // 10 minutes
  reconnectInterval: 5000 // 5 seconds
});

client.start().catch((error) => {
  console.error('Failed to start tunnel client', { error });
  process.exit(1);
});
