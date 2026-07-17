import {
  ModelCapabilities,
  ModelInvocationRequest,
  ModelInvocationResult,
  ModelProvider
} from "../interfaces/model-provider.js";

type ModelResponder = (
  request: ModelInvocationRequest
) => ModelInvocationResult | Promise<ModelInvocationResult>;

export class MockModelProvider implements ModelProvider {
  readonly name: string;
  private readonly responders = new Map<string, ModelResponder>();
  private readonly capabilities = new Map<string, ModelCapabilities>();

  constructor(name = "mock-model-provider") {
    this.name = name;
  }

  registerModel(
    model: string,
    responder: ModelResponder,
    capabilities: ModelCapabilities = {
      supportsStreaming: false,
      supportsToolUse: false
    }
  ): void {
    this.responders.set(model, responder);
    this.capabilities.set(model, capabilities);
  }

  async invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult> {
    const responder = this.responders.get(request.model);
    if (!responder) {
      throw new Error(`No mock responder configured for model: ${request.model}`);
    }
    return responder(request);
  }

  getCapabilities(model: string): ModelCapabilities {
    return (
      this.capabilities.get(model) ?? {
        supportsStreaming: false,
        supportsToolUse: false
      }
    );
  }
}
