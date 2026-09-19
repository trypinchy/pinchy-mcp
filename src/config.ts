export interface Config {
  port: number;
  apiUrl: string;
  rateLimitPerMinute: number;
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function readConfig(env: NodeJS.ProcessEnv): Config {
  const apiUrl = new URL(env.PINCHY_API_URL ?? 'https://api.trypinchy.com');
  return {
    port: positiveInt(env.PORT, 4020),
    apiUrl: apiUrl.origin + apiUrl.pathname.replace(/\/+$/, ''),
    rateLimitPerMinute: positiveInt(env.RATE_LIMIT_PER_MINUTE, 30),
  };
}
