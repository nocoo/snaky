export type CftraceEndpoint = {
  name: string;
  method: "cftrace";
  domain: string;
  fallbackDomain?: string;
  category: string;
  disabled?: boolean;
};

export type HttpHeaderEndpoint = {
  name: string;
  method: "http-header";
  url: string;
  headers: string[];
  category: string;
  disabled?: boolean;
};

export type Endpoint = CftraceEndpoint | HttpHeaderEndpoint;

export type PingTarget = {
  name: string;
  url: string;
  tag: string;
  disabled?: boolean;
};

export type Settings = {
  timeout: number;
  pingTimeout: number;
  concurrency: number;
  retries: number;
  pingRounds: number;
};

export type UserCftraceEndpoint = {
  name: string;
  method?: "cftrace";
  domain?: string;
  fallbackDomain?: string;
  disabled?: boolean;
};

export type UserHttpHeaderEndpoint = {
  name: string;
  method: "http-header";
  url?: string;
  headers?: string[];
  disabled?: boolean;
};

export type UserHttpPingTarget = {
  name: string;
  url?: string;
  tag?: string;
  disabled?: boolean;
};

export type UserEndpoint = UserCftraceEndpoint | UserHttpHeaderEndpoint;

export type RawConfig = {
  endpoints?: UserEndpoint[];
  pingTargets?: UserHttpPingTarget[];
  timeout?: number;
  pingTimeout?: number;
  concurrency?: number;
  retries?: number;
  pingRounds?: number;
  [key: string]: unknown;
};

export type EffectiveConfig = {
  endpoints: Endpoint[];
  pingTargets: PingTarget[];
  settings: Settings;
};

export const DEFAULT_SETTINGS: Settings = {
  timeout: 5000,
  pingTimeout: 3000,
  concurrency: 10,
  retries: 2,
  pingRounds: 12,
};
