export type Token<T> = symbol | string | { new (...args: never[]): T };

export type ServiceLifetime = "singleton" | "transient";

export interface ServiceRegistration<T> {
  token: Token<T>;
  lifetime: ServiceLifetime;
  dependencies?: Token<unknown>[];
  factory: (...dependencies: unknown[]) => T;
}

export interface DIContainer {
  register<T>(registration: ServiceRegistration<T>): void;
  registerValue<T>(token: Token<T>, value: T): void;
  resolve<T>(token: Token<T>): T;
  has<T>(token: Token<T>): boolean;
}
