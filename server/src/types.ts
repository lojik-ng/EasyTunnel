export interface TunnelRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: any;
}

export interface TunnelResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
}

export interface ClientConnection {
  socket: any; // Socket.io socket
  authenticated: boolean;
  lastHeartbeat: number;
}

export interface JWTPayload {
  clientId: string;
  type: 'tunnel-client';
  iat?: number;
  exp?: number;
}
