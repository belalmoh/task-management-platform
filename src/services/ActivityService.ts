import { redis } from "../database/redis";
import { webSocketManager } from "../websocket/server";

export interface IActivity {
    id: string;
    type: 'task_created' | 'task_updated' | 'task_completed' | 'task_assigned' | 'user_joined' | 'user_left';
    user_id: number;
    user_name: string;
    project_id: number;
    entity_id?: number;
    entity_name?: string;
    description: string;
    metadata?: any;
    timestamp: string;
}

export class ActivityService {

    static async logActivity(activity: Omit<IActivity, 'id' | 'timestamp'>): Promise<IActivity> {
        const fullActivity: IActivity = {
            ...activity,
            id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
        }

        const projectKey = `activities:project:${activity.project_id}`;
        await redis.client.lPush(projectKey, JSON.stringify(fullActivity));
        await redis.client.lTrim(projectKey, 0, 99);

        await redis.client.lPush('activities:global', JSON.stringify(fullActivity));
        await redis.client.lTrim('activities:global', 0, 499);

        await redis.client.expire(projectKey, 7 * 24 * 60 * 60); // 7 days
        await redis.client.expire('activities:global', 7 * 24 * 60 * 60); // 7 days

        await webSocketManager.broadcastToProject(activity.project_id, {
            type: 'activity_created',
            payload: fullActivity,
            timestamp: fullActivity.timestamp,
        });

        return fullActivity;
    }

    static async getProjectActivities(project_id: number, limit: number = 20): Promise<IActivity[]> {
        const projectKey = `activities:project:${project_id}`;
        const activities = await redis.client.lRange(projectKey, 0, limit - 1);
        return activities.map(activity => JSON.parse(activity));
    }

    static async getGlobalActivities(limit: number = 20): Promise<IActivity[]> {
        const activities = await redis.client.lRange('activities:global', 0, limit - 1);
        return activities.map(activity => JSON.parse(activity));
    }

    static async logTaskCreated(userId: number, userName: string, projectId: number, taskId: number, taskName: string): Promise<void> {
        await this.logActivity({
            type: 'task_created',
            user_id: userId,
            user_name: userName,
            project_id: projectId,
            entity_id: taskId,
            entity_name: taskName,
            description: `${userName} created task "${taskName}"`
        });
    }

    static async logTaskUpdated(userId: number, userName: string, projectId: number, taskId: number, taskName: string, changes: any): Promise<void> {
        const changeKeys = Object.keys(changes);
        const description = `${userName} updated ${changeKeys.join(', ')} in task "${taskName}"`;

        await this.logActivity({
            type: 'task_updated',
            user_id: userId,
            user_name: userName,
            project_id: projectId,
            entity_id: taskId,
            entity_name: taskName,
            description,
            metadata: { changes }
        });
    }

    static async logTaskCompleted(userId: number, userName: string, projectId: number, taskId: number, taskName: string): Promise<void> {
        await this.logActivity({
            type: 'task_completed',
            user_id: userId,
            user_name: userName,
            project_id: projectId,
            entity_id: taskId,
            entity_name: taskName,
            description: `${userName} completed task "${taskName}"`
        });
    }

    static async logUserJoined(userId: number, userName: string, projectId: number): Promise<void> {
        await this.logActivity({
            type: 'user_joined',
            user_id: userId,
            user_name: userName,
            project_id: projectId,
            description: `${userName} joined the project`
        });
    }

}
