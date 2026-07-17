import {
  ConfigLayer,
  ConfigValidator,
  ConfigValue,
  ConfigurationManager
} from "../interfaces/configuration.js";

export class InMemoryConfigurationManager implements ConfigurationManager {
  private readonly layers: ConfigLayer[] = [];
  private readonly overrides = new Map<string, ConfigValue>();
  private readonly validator?: ConfigValidator;

  constructor(options?: { defaults?: Record<string, ConfigValue>; validator?: ConfigValidator }) {
    this.validator = options?.validator;
    if (options?.defaults) {
      this.layers.push({
        name: "defaults",
        precedence: 0,
        values: options.defaults
      });
    }
  }

  addLayer(layer: ConfigLayer): void {
    this.layers.push(layer);
    this.layers.sort((a, b) => a.precedence - b.precedence);
  }

  get<T>(key: string, fallback?: T): T {
    if (this.overrides.has(key)) {
      return this.overrides.get(key) as T;
    }
    const fromLayer = [...this.layers]
      .reverse()
      .find((layer) => key in layer.values);

    if (fromLayer) {
      return fromLayer.values[key] as T;
    }
    return fallback as T;
  }

  getRequired<T>(key: string): T {
    if (!this.has(key)) {
      throw new Error(`Missing required configuration key: ${key}`);
    }
    return this.get<T>(key);
  }

  has(key: string): boolean {
    if (this.overrides.has(key)) {
      return true;
    }
    return this.layers.some((layer) => key in layer.values);
  }

  set(key: string, value: ConfigValue): void {
    this.validator?.(key, value);
    this.overrides.set(key, value);
  }

  unset(key: string): void {
    this.overrides.delete(key);
  }

  keys(): string[] {
    const result = new Set<string>();
    this.layers.forEach((layer) => Object.keys(layer.values).forEach((k) => result.add(k)));
    this.overrides.forEach((_, k) => result.add(k));
    return [...result].sort();
  }
}
