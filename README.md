# EasyTunnel

EasyTunnel is a simple and efficient tunneling system that exposes your localhost services to the internet via a domain name. It consists of two components: a Tunnel Client that runs on your local machine and a Tunnel Server that runs on your domain.

## Features

- Expose localhost services to the internet
- Secure WebSocket communication
- JWT authentication
- Automatic reconnection
- Health monitoring
- TypeScript support
- Environment-based configuration

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A domain name and a nodejs hosting for the tunnel server
- SSL certificate (for HTTPS support)

## Installation

### Server Setup

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Create environment configuration:
```bash
cp .env.example .env
```

4. Edit the `.env` file with your configuration:
- Set your JWT secret
- Set allowed origins

5. Build and start the server:
```bash
npm run build
npm start
```

### Client Setup

1. Navigate to the client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Edit the `index.ts` file with your configuration:
- Set your tunnel server URL
- Configure your JWT token
- Set your local service port

4. Build and start the client:
```bash
npm start
```

## Usage

1. Start your local service (e.g., a web server on port 8080)

2. Start the tunnel server on your domain

3. Start the tunnel client on your local machine

4. Your local service is now accessible through your domain!

## Configuration

### Server Environment Variables

- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: 0.0.0.0)
- `JWT_SECRET`: Secret key for JWT authentication
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS

### Client Environment Variables

- `TUNNEL_SERVER_URL`: URL of your tunnel server
- `AUTH_TOKEN`: JWT authentication token
- `LOCAL_PORT`: Port of your local service
- `LOCAL_HOST`: Host of your local service
- `HEARTBEAT_INTERVAL`: Interval for health checks
- `REQUEST_TIMEOUT`: Timeout for local service requests
- `RECONNECT_INTERVAL`: Interval for reconnection attempts

## Security Considerations

1. Always use HTTPS in production
2. Keep your JWT token secure
3. Configure CORS settings appropriately
4. Regularly update dependencies
5. Monitor server logs for suspicious activity

## License

MIT
