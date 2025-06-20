import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { JWTService } from '../utils/jwt';
import { IUser, User } from '../models/UserModel';
import { redis } from '../database/redis';

interface IAuthenticatedWebSocket extends WebSocket {
    userId: number;
    sessionId: string;
    user: IUser;
}

export interface IWebSocketMessage {
    type: string;
    payload?: any;
    timestamp: string;
}

export class WebSocketManager {
    private wss: WebSocketServer;
    private clients: Map<number, Set<IAuthenticatedWebSocket>> = new Map();
    private server: any;

    constructor(port: number = 3001) {
        this.server = createServer();
        this.wss = new WebSocketServer({ server: this.server, path: '/ws' });

        this.setupWebSocketHandlers();

        this.server.listen(port, () => {
            console.log(`🔌 WebSocket server running on port ${port}`);
            console.log(`🌐 WebSocket URL: ws://localhost:${port}/ws`);
        });
    }

    private setupWebSocketHandlers() {
        this.wss.on('connection', async(ws: IAuthenticatedWebSocket, request: Request) => {
            console.log('🔌 New WebSocket connection attempt');

            try {
                let token: string | undefined;
        
                if (request.url) {
                    const urlParts = request.url.split('?');
                    if (urlParts.length > 1) {
                        const queryString = urlParts[1];
                        const params = new URLSearchParams(queryString);
                        token = params.get('token') || undefined;
                    }
                }
                
                if (!token && request.headers['authorization']) {
                    token = request.headers['authorization'].replace('Bearer ', '');
                }

                const decoded = JWTService.verifyAccessToken(token);
                const isBlacklisted = await JWTService.isTokenBlacklisted(token);

                if(isBlacklisted) {
                    this.sendError(ws, 'Token has been revoked');
                    ws.close(1008, 'Token revoked');
                    return;
                }

                const sessionData = await redis.getSession(decoded.session_id);
                if(!sessionData) {
                    this.sendError(ws, 'Session is invalid or expired');
                    ws.close(1008, 'Session invalid or expired');
                    return;
                }

                const user = await User.findById(decoded.user_id);
                if(!user) {
                    this.sendError(ws, 'User not found or inactive');
                    ws.close(1008, 'User not found or inactive');
                    return;
                }

                ws.userId = user.id;
                ws.sessionId = decoded.session_id;
                ws.user = user;

                if(!this.clients.has(user.id)) {
                    this.clients.set(user.id, new Set());
                }

                this.clients.get(user.id)!.add(ws);

                await this.updateUserPresence(user.id, 'online');

                this.sendMessage(ws, {
                    type: 'connection_success',
                    payload: {
                        user: ws.user,
                        timestamp: new Date().toISOString(),
                    },
                    timestamp: new Date().toISOString(),
                });
                
                this.broadcastUserPresence(user.id, 'online');
                console.log(`🔌 Client ${user.email} connected via WebSocket`);

                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString()) as IWebSocketMessage;
                        this.handleMessage(ws, message);
                    } catch (error) {
                        console.error('❌ Error parsing WebSocket message:', error);
                        this.sendError(ws, 'Invalid message format');
                    }
                });

                ws.on('close', async () => {
                    await this.handleDisconnect(ws);
                });

                ws.on('error', (error) => {
                    console.error('❌ WebSocket error:', error);
                });
            } catch (error) {
                console.error('❌ WebSocket authentication error:', error);
                this.sendError(ws, 'Authentication failed');
                ws.close(1008, 'Authentication failed');
            }

        });
    }

    private async handleMessage(ws: IAuthenticatedWebSocket, message: IWebSocketMessage) {
        console.log('🔍 Received message from user:', ws.userId, message);
        if(!ws.userId) {
            return;
        }

        console.log('🔍 Received message from user:', ws.userId, message);

        switch(message.type) {
            case 'ping':
                this.sendMessage(ws, {
                    type: 'pong',
                    timestamp: new Date().toISOString(),
                });
                break;
            case 'join_project':
                await this.handleJoinProject(ws, message.payload?.project_id);
                break;
            case 'leave_project':
                await this.handleLeaveProject(ws, message.payload?.project_id);
                break;
            case 'task_update':
                await this.handleTaskUpdate(ws, message.payload);
            default:
                this.sendError(ws, `Invalid message type: ${message.type}`);
                break;
        }
    }

    private async handleJoinProject(ws: IAuthenticatedWebSocket, projectId: string) {
        if(!projectId || !ws.userId) return;

        // TODO: Verify user has access to this project

        await redis.client.sAdd(`project_room:${projectId}`, ws.userId.toString());
        this.sendMessage(ws, {
            type: 'join_project',
            payload: {
                project_id: projectId,
            },
            timestamp: new Date().toISOString(),
        });
        console.log(`👥 User ${ws.userId} joined project ${projectId}`);
    }

    private async handleLeaveProject(ws: IAuthenticatedWebSocket, projectId: string) {
        if(!projectId || !ws.userId) return;

        await redis.client.sRem(`project_room:${projectId}`, ws.userId.toString());
        this.sendMessage(ws, {
            type: 'leave_project',
            payload: {
                project_id: projectId,
            },
            timestamp: new Date().toISOString(),
        });
        console.log(`👥 User ${ws.userId} left project ${projectId}`);
    }

    private async handleTaskUpdate(ws: IAuthenticatedWebSocket, payload: any) {
        if(!payload.project_id || !ws.userId) return;

        await this.broadcastToProject(payload.project_id, {
            type: 'task_update',
            payload: {
              ...payload,
              updated_by: ws.user
            },
            timestamp: new Date().toISOString()
          }, ws.userId);
    }

    private async handleDisconnect(ws: IAuthenticatedWebSocket) {
        if(!ws.userId) return;

        const userConnections = this.clients.get(ws.userId);
        if(userConnections) {
            userConnections.delete(ws);
            if(userConnections.size === 0) {
                this.clients.delete(ws.userId);
                await this.updateUserPresence(ws.userId, 'offline');
                this.broadcastUserPresence(ws.userId, 'offline');
            }
        }
        console.log(`❌ User ${ws.userId} disconnected`);
    }

    private async updateUserPresence(userId: number, status: 'online' | 'offline'): Promise<void> {
        await redis.set(`user_presence:${userId}`, status, 300); // 5 minutes TTL
    }

    private async broadcastUserPresence(userId: number, status: 'online' | 'offline'): Promise<void> {
        const message = {
            type: 'user_presence',
            payload: {
                user_id: userId,
                status: status,
            },
            timestamp: new Date().toISOString(),
        };

        for(const [_, connections] of this.clients) {
            for(const connection of connections) {
                this.sendMessage(connection, message);
            }
        }
    }

    public async broadcastToProject(projectId: number, message: IWebSocketMessage, excludeUserId?: number) {
        try {
            const userIds = await redis.client.sMembers(`project_room:${projectId}`);
            for(const userIdStr of userIds) {
                const userId = parseInt(userIdStr);
                if(userId !== excludeUserId) {
                    const connections = this.clients.get(userId);
                    if(connections) {
                        for(const ws of connections) {
                            this.sendMessage(ws, message);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error broadcasting to project:', error);
        }
    }

    public async broadcastToUser(userId: number, message: IWebSocketMessage): Promise<void> {
        const connections = this.clients.get(userId);
        if (connections) {
            for (const ws of connections) {
                this.sendMessage(ws, message);
            }
        }
    }

    private sendMessage(ws: IAuthenticatedWebSocket, message: IWebSocketMessage): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    private sendError(ws: IAuthenticatedWebSocket, message: string) {
        this.sendMessage(ws, {
            type: 'error',
            payload: {
                message: message,
            },
            timestamp: new Date().toISOString(),
        });
    }

    public getConnectedUsers(): number[] {
        return Array.from(this.clients.keys());
    }

    public getUserConnectionCount(userId: number): number {
        const connections = this.clients.get(userId);
        return connections ? connections.size : 0;
    }

    public async notifyTaskUpdate(projectId: number, task: any, action: 'created' | 'updated' | 'deleted', user: any, changes?: any): Promise<void> {
        const message = {
            type: `task_${action}`,
            payload: {
                task,
                ...(changes && { changes }),
                [`${action}_by`]: user
            },
            timestamp: new Date().toISOString()
        };

        await this.broadcastToProject(projectId, message);
        console.log(`📡 Broadcasted task_${action} to project ${projectId}`);
    }
}

export const webSocketManager = new WebSocketManager();