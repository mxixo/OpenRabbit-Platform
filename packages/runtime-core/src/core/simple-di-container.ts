import {
  DIContainer,
  ServiceRegistration,
  Token
} from "../interfaces/di.js";

export class SimpleDIContainer implements DIContainer {
  private readonly registrations = new Map<Token<unknown>, ServiceRegistration<unknown>>();
  private readonly singletons = new Map<Token<unknown>, unknown>();
  private readonly resolutionStack: Token<unknown>[] = [];

  register<T>(registration: ServiceRegistration<T>): void {
    if (this.registrations.has(registration.token)) {
      throw new Error(`Service already registered for token: ${String(registration.token)}`);
    }
    this.registrations.set(registration.token, registration as ServiceRegistration<unknown>);
  }

  registerValue<T>(token: Token<T>, value: T): void {
    this.register({
      token,
      lifetime: "singleton",
      dependencies: [],
      factory: () => value
    });
  }

  has<T>(token: Token<T>): boolean {
    return this.registrations.has(token);
  }

  resolve<T>(token: Token<T>): T {
    if (this.resolutionStack.includes(token)) {
      throw new Error(`Circular dependency detected for token: ${String(token)}`);
    }
    const registration = this.registrations.get(token);
    if (!registration) {
      throw new Error(`No service registered for token: ${String(token)}`);
    }
    if (registration.lifetime === "singleton" && this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }

    this.resolutionStack.push(token);
    try {
      const dependencies = (registration.dependencies ?? []).map((depToken) =>
        this.resolve(depToken)
      );
      const instance = registration.factory(...dependencies) as T;
      if (registration.lifetime === "singleton") {
        this.singletons.set(token, instance);
      }
      return instance;
    } finally {
      this.resolutionStack.pop();
    }
  }
}
