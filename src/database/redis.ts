import { createClient, RedisClientType } from 'redis';

const redisConfig = {
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        reconnectStrategy: (retries: number) => {
            const delay = Math.min(retries * 50, 1000);
            console.log(`Redis connection attempt ${retries + 1} failed. Retrying in ${delay}ms...`);
            return delay;
        },
    },
    password: process.env.REDIS_PASSWORD || '',
    database: parseInt(process.env.REDIS_DB || '0', 10),
};

let redisClient: RedisClientType = createClient(redisConfig);

redisClient.on('connect', () => {
    console.log('🔗 Redis client connected');
});

redisClient.on('ready', () => {
    console.log('✅ Redis client ready');
});

redisClient.on('error', (error) => {
    console.error('❌ Redis client error:', error);
});

redisClient.on('end', () => {
    console.warn('⚠️ Redis client connection ended');
});

redisClient.on('reconnecting', () => {
    console.log('🔄 Redis client reconnecting...');
});

const connectRedis = async () => {
    try {
        await redisClient.connect();
        console.log('✅ Redis connected successfully');
    } catch (error) {
        console.error('❌ Redis connection error:', error);
    }
};

connectRedis();


export class RedisService {
    public client: RedisClientType;

    constructor() {
        this.client = redisClient;
    }

    async get(key: string): Promise<string | null> {
        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value as string) : null;
        } catch (error) {
            console.error('❌ Redis get error:', error);
            throw error;
        }
    }

    async set(key: string, value: string, ttlSeconds: number): Promise<boolean> {
        try {
            if (ttlSeconds > 0) {
                await this.client.setEx(key, ttlSeconds, value);
            } else {
                await this.client.set(key, value);
            }
            return true;
        } catch (error) {
            console.error('❌ Redis set error:', error);
            throw error;
        }
    }

    async del(key: string): Promise<boolean> {
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            console.error('❌ Redis del error:', error);
            throw error;
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            const exists = await this.client.exists(key);
            return exists > 0;
        } catch (error) {
            console.error('❌ Redis exists error:', error);
            throw error;
        }
    }

    // session management
    async setSession(sessionId: string, data: any, ttlSeconds: number): Promise<boolean> {
        try {
            const serializedData = JSON.stringify(data);
            return await this.set(`session:${sessionId}`, serializedData, ttlSeconds);
        } catch (error) {
            console.error('❌ Redis setSession error:', error);
            throw error;
        }
    }

    async getSession(sessionId: string): Promise<any | null> {
        try {
            const value = await this.get(`session:${sessionId}`);
            if(typeof value === 'string') {
                return JSON.parse(value as string);
            }
            return value as any;
        } catch (error) {
            console.error('❌ Redis getSession error:', error);
            throw error;
        }
    }

    async deleteSession(sessionId: string): Promise<boolean> {
        try {
            return await this.del(`session:${sessionId}`);
        } catch (error) {
            console.error('❌ Redis deleteSession error:', error);
            throw error;
        }
    }

    // token backlisting
    async blacklistToken(token: string, ttlSeconds: number): Promise<boolean> {
        try {
            return await this.set(`blacklist:${token}`, 'true', ttlSeconds);
        } catch (error) {
            console.error('❌ Redis blacklistToken error:', error);
            throw error;
        }
    }

    async isTokenBlacklisted(token: string): Promise<boolean> {
        try {
            return await this.exists(`blacklist:${token}`);
        } catch (error) {
            console.error('❌ Redis isTokenBlacklisted error:', error);
            throw error;
        }
    }

    // User sessions management
    async addUserSession(userId: string, sessionId: string, ttlSeconds: number): Promise<boolean> {
        try {
            await this.client.sAdd(`user_sessions:${userId}`, sessionId);
            await this.client.expire(`user_sessions:${userId}`, ttlSeconds);
            return true;
        } catch (error) {
            console.error('❌ Redis addUserSession error:', error);
            throw error;
        }
    }

    async getUserSessions(userId: string): Promise<string[]> {
        try {
            return await this.client.sMembers(`user_sessions:${userId}`);
        } catch (error) {
            console.error('❌ Redis getUserSessions error:', error);
            throw error;
        }
    }

    async removeUserSession(userId: string, sessionId: string): Promise<boolean> {
        try {
            await this.client.sRem(`user_sessions:${userId}`, sessionId);
            return true;
        } catch (error) {
            console.error('❌ Redis removeUserSession error:', error);
            throw error;
        }
    }

    async clearAllUserSessions(userId: string): Promise<boolean> {
        try {
            await this.client.del(`user_sessions:${userId}`);
            return true;
        } catch (error) {
            console.error('❌ Redis clearAllUserSessions error:', error);
            throw error;
        }
    }

    // rate limiting
    async incrementRateLimit(key: string, ttlSeconds: number): Promise<{ count: number; ttl: number }> {
        try {
            const multi = this.client.multi();
            multi.incr(key);
            multi.expire(key, ttlSeconds);
            multi.ttl(key);
            
            const results = await multi.exec();
            const count = (results[0] as unknown as number) || 0;
            const ttl = (results[2] as unknown as number) || 0;

            return {
                count,
                ttl,
            };
        } catch (error) {
            console.error('❌ Redis incrementRateLimit error:', error);
            return { count: 0, ttl: 0 };
        }
    }

    // Utility methods
    async ping(): Promise<boolean> {
        try {
            const result = await this.client.ping();
            return result === 'PONG';
        } catch (error) {
            console.error('❌ Redis ping error:', error);
            throw error;
        }
    }
}

export const redis = new RedisService();

export default redisClient;