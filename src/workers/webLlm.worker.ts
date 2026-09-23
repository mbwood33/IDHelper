import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

/**
 * WebLLM's RPC endpoint. Keeping the engine in a module worker prevents model
 * initialization and token generation from blocking the UI thread. The main
 * thread creates the matching proxy through `CreateWebWorkerMLCEngine`.
 */
const handler = new WebWorkerMLCEngineHandler();

/**
 * Forward every protocol message unchanged to WebLLM. This worker deliberately
 * owns no report parsing, storage, or UI state: the library's typed message
 * protocol is the only cross-thread surface, limiting this file to transport.
 */
self.onmessage = (event: MessageEvent) => {
  handler.onmessage(event);
};
