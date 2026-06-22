import { repo } from './repository';

export const isAgentDev = process.env.npm_lifecycle_event === 'dev:agent' || process.env.npm_lifecycle_event === 'dev:agent:seed';
export { repo };

export const isDev = process.env.NODE_ENV !== 'production';
