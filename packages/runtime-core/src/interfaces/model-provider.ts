export interface ModelInvocationRequest {
  model: string;
  input: string;
  options?: Record<string, unknown>;
}

export interface ModelInvocationResult {
  model: string;
  output: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface ModelCapabilities {
  supportsStreaming: boolean;
  supportsToolUse: boolean;
  maxInputTokens?: number;
}

export interface ModelProvider {
  readonly name: string;
  invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult>;
  getCapabilities(model: string): ModelCapabilities;
}
