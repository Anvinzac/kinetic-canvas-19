import type { ContentItem } from "../contract.ts";
import type { Logger } from "../logger.ts";

export interface DeliverResult {
  delivered: number;
  failed: number;
}

// Where produced items go. The Supabase queue is the default sink, but it lives
// behind this interface so the Hub never depends on it — point at an HTTP gateway,
// Kafka, or a different backend by swapping the implementation.
export interface Sink {
  readonly name: string;
  deliver(items: ContentItem[], log: Logger): Promise<DeliverResult>;
}
