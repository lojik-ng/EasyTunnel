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

export interface TunnelConfig {
  serverUrl: string;
  authToken: string;
  localPort: number;
  localHost: string;
  heartbeatInterval: number;
  requestTimeout: number;
  reconnectInterval: number;
}
