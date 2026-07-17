export interface ServiceOperationError {
  code: string;
  message: string;
  retryable?: boolean;
}

export interface ServiceOperationResult<T> {
  ok: boolean;
  data?: T;
  error?: ServiceOperationError;
}

export interface ServiceDependency {
  name: string;
  status: "up" | "down";
}

export interface ServiceHealthReport {
  status: "ok" | "degraded";
  timestamp: string;
  dependencies: ServiceDependency[];
}

export interface ServiceReliabilitySnapshot {
  operationsSucceeded: number;
  operationsFailed: number;
  lastErrorCode?: string;
}

export interface RetryPolicy {
  maxAttempts: number;
}
