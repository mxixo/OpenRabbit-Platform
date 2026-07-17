export type ConfigValue = unknown;

export interface ConfigLayer {
  name: string;
  values: Record<string, ConfigValue>;
  precedence: number;
}

export type ConfigValidator = (key: string, value: ConfigValue) => void;

export interface ConfigurationManager {
  get<T>(key: string, fallback?: T): T;
  getRequired<T>(key: string): T;
  set(key: string, value: ConfigValue): void;
  unset(key: string): void;
  has(key: string): boolean;
  keys(): string[];
  addLayer(layer: ConfigLayer): void;
}
