import * as z from "zod";
import { TaggingError } from "../errors.ts";
import type {
  DecisionRequest,
  DecisionResponse,
  Question,
  TaggingBackend,
} from "./backend.ts";

export type AmosRetryOptions = {
  /** Total attempts, including the first. */
  attempts: number;
  /** Seconds before the first retry. Doubles each time. */
  initialDelay: number;
  /** Longest wait between attempts, in seconds. */
  maxDelay: number;
};

export type AmosBackendOptions = {
  /** Server to call. Defaults to the hosted API, which needs no key. */
  baseUrl?: string;
  /** Defaults to `defaultAmosModel`. */
  model?: string;
  /**
   * Retries for rate limits (429), timeouts (408), server errors (5xx) and
   * network failures. Pass `false` to turn them off.
   */
  retry?: AmosRetryOptions | false;
  /** Milliseconds to wait for each request. Default 60 seconds; `false` waits indefinitely. */
  timeout?: number | false;
  /**
   * Largest request body to send, in bytes. The hosted API drops the
   * connection on bodies over about 4.2 MB. `false` sends any size.
   */
  maxRequestBytes?: number | false;
  /** Sent as the User-Agent header. */
  userAgent?: string;
  fetch?: typeof fetch;
};

export const defaultAmosBaseUrl = "https://api.amos.scira.ai";
export const defaultAmosModel = "amos-1-large";

const defaultTimeout = 60_000;
const defaultMaxRequestBytes = 4_000_000;

const defaultRetry: AmosRetryOptions = {
  attempts: 4,
  initialDelay: 1,
  maxDelay: 30,
};

const probabilities = z.record(z.string(), z.number());

const answerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("choice"), probabilities }),
  z.object({ type: z.literal("multi"), probabilities }),
  z.object({ type: z.literal("noul"), noul: z.number() }),
]);

const responseSchema = z.object({
  model: z.string().optional(),
  answers: z.record(z.string(), answerSchema),
});

export class AmosBackend implements TaggingBackend {
  public readonly model: string;
  private readonly url: string;
  private readonly retry: AmosRetryOptions | false;
  private readonly timeout: number | false;
  private readonly maxRequestBytes: number | false;
  private readonly userAgent: string | undefined;
  private readonly fetch: typeof fetch;

  constructor({
    baseUrl = defaultAmosBaseUrl,
    model = defaultAmosModel,
    retry = defaultRetry,
    timeout = defaultTimeout,
    maxRequestBytes = defaultMaxRequestBytes,
    userAgent,
    fetch: fetchImplementation = globalThis.fetch,
  }: AmosBackendOptions = {}) {
    if (
      retry !== false &&
      (!Number.isInteger(retry.attempts) || retry.attempts < 1)
    ) {
      throw new TaggingError(
        `retry.attempts must be a whole number of at least 1, not ${retry.attempts}.`,
        "invalid-configuration",
      );
    }
    this.model = model;
    this.url = new URL("/v1/systemone", baseUrl).toString();
    this.retry = retry;
    this.timeout = timeout;
    this.maxRequestBytes = maxRequestBytes;
    this.userAgent = userAgent;
    this.fetch = fetchImplementation;
  }

  async decide({
    context,
    image,
    questions,
  }: DecisionRequest): Promise<DecisionResponse> {
    const issues = questions.flatMap(optionCountIssue);

    if (issues.length > 0) {
      throw new TaggingError(
        [
          "Amos can't answer these questions.",
          ...issues.map((issue) => `- ${issue}`),
        ].join("\n"),
        "invalid-configuration",
        { model: this.model, issues },
      );
    }

    const body = JSON.stringify({
      model: this.model,
      state: context,
      // Plain base64: the hosted amos-1-mini rejects data URLs.
      images: [Buffer.from(image.data).toString("base64")],
      questions: Object.fromEntries(
        questions.map((question) => [question.id, toAmosQuestion(question)]),
      ),
    });
    const bytes = Buffer.byteLength(body);

    if (this.maxRequestBytes !== false && bytes > this.maxRequestBytes) {
      throw new TaggingError(
        `The request is ${bytes} bytes, over the ${this.maxRequestBytes}-byte limit. Send a smaller image.`,
        "request-too-large",
        { model: this.model, bytes, maxRequestBytes: this.maxRequestBytes },
      );
    }

    const json = await this.post(body);
    const parsed = responseSchema.safeParse(json);

    if (!parsed.success) {
      throw new TaggingError(
        `Amos returned an unexpected response:\n${z.prettifyError(parsed.error)}`,
        "invalid-response",
        { model: this.model, issues: parsed.error.issues },
      );
    }

    return {
      answers: Object.fromEntries(
        Object.entries(parsed.data.answers).map(([id, answer]) => [
          id,
          answer.type === "noul" ? { yes: answer.noul } : answer.probabilities,
        ]),
      ),
      modelVersion: parsed.data.model,
    };
  }

  private async post(body: string): Promise<unknown> {
    const attempts = this.retry === false ? 1 : this.retry.attempts;

    for (let attempt = 1; ; attempt++) {
      let response: Response;

      try {
        response = await this.fetch(this.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(this.userAgent === undefined
              ? {}
              : { "user-agent": this.userAgent }),
          },
          body,
          signal:
            this.timeout === false
              ? undefined
              : AbortSignal.timeout(this.timeout),
        });
      } catch (error) {
        if (!isNetworkFailure(error) || attempt >= attempts) {
          throw error;
        }
        await delay(this.retry, attempt);
        continue;
      }

      if (response.ok) {
        return await response.json();
      }
      if (!isRetryableStatus(response.status) || attempt >= attempts) {
        throw new Error(
          `Amos responded ${response.status}: ${(await response.text()).slice(0, 300)}`,
        );
      }
      await delay(this.retry, attempt);
    }
  }
}

const minOptions = 2;
const maxOptions = 255;

function optionCountIssue(question: Question): string[] {
  if (question.type === "yes-no") {
    return [];
  }

  const count = Object.keys(question.options).length;

  if (count >= minOptions && count <= maxOptions) {
    return [];
  }
  return [
    `"${question.id}" has ${count} option${count === 1 ? "" : "s"}, but Amos needs ${minOptions} to ${maxOptions}, counting the none-of-these option that allowUnlisted adds.` +
      (count === 1 && question.type === "multi"
        ? " Use a flag for a single yes/no value."
        : ""),
  ];
}

function toAmosQuestion(question: Question): Record<string, unknown> {
  switch (question.type) {
    case "choice":
    case "multi":
      return {
        type: question.type,
        instructions: question.instructions,
        criteria: question.options,
      };
    default:
      return { type: "noul", instructions: question.instructions };
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

// fetch rejects with a TypeError on network failures and a DOMException on timeouts.
function isNetworkFailure(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof DOMException && error.name === "TimeoutError")
  );
}

function delay(
  retry: AmosRetryOptions | false,
  attempt: number,
): Promise<void> {
  if (retry === false) {
    return Promise.resolve();
  }
  const seconds = Math.min(
    retry.initialDelay * 2 ** (attempt - 1),
    retry.maxDelay,
  );
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
