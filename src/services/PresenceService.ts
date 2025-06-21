import { redis } from "../database/redis";
import { webSocketManager, WebSocketManager } from "../websocket/server";

export interface IUserPresence {
    user_id: number;
    status: 'online' | 'away' | 'offline';
    last_seen: string;
    current_project?: number;
    device_info: {
        user_agent: string;
        ip: string;
    }
}

export class PresenceService {

    static async updatePresence(user_id: number, status: 'online' | 'away' | 'offline', projectId?: number, device_info?: any): Promise<void> {
        
        const presence: IUserPresence = {
            user_id,
            status,
            last_seen: new Date().toISOString(),
            device_info,
            current_project: projectId
        }

        const ttl = status === 'offline' ? 300 : 3600;
        await redis.set(`presence:${user_id}`, JSON.stringify(presence), ttl);

        if(status === 'online') {
            await redis.client.sAdd(`online_users:${user_id}`, user_id.toString());
        } else {
            await redis.client.sRem(`online_users:${user_id}`, user_id.toString());
        }

        console.log(`🔍 Updated presence for user ${user_id}: ${status}`);
        await webSocketManager.broadcastPresenceUpdate(user_id, status);
    }

    static async getUserPresence(user_id: number): Promise<IUserPresence | null> {
        const presence = await redis.get(`presence:${user_id}`);
        return presence ? JSON.parse(presence) : null;
    }

    static async getOnlineUsers(): Promise<number[]> {
        const userIds = await redis.client.sMembers('online_users');
        return userIds.map(id => parseInt(id));
    }

    static async getProjectOnlineUsers(project_id: number): Promise<number[]> {
        const userIds = await redis.client.sMembers(`project_room:${project_id}`);
        const presences = [];

        for(const userId of userIds) {
            const presence = await this.getUserPresence(parseInt(userId));
            if(presence && presence.status === 'online') {
                presences.push(presence);
            }
        }

        return presences;
    }

    static async cleanupOfflineUsers(): Promise<void> {
        const userIds = await redis.client.sMembers('online_users');
        for(const userId of userIds) {
            const presence = await this.getUserPresence(parseInt(userId));
            if(!presence) {
                await redis.client.sRem(`online_users:${userId}`, userId);
            } else {
                const lastSeen = new Date(presence.last_seen);
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                if(lastSeen < fiveMinutesAgo) {
                    await redis.client.sRem(`online_users:${userId}`, userId);
                }
            }
        }
    }
}