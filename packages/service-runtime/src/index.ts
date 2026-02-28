import cors from "@fastify/cors";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import Fastify from "fastify";
import { trace, SpanStatusCode, type Span } from "@opentelemetry/api";
import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics
} from "prom-client";
import * as Sentry from "@sentry/node";

interface RuntimeOptions {
  serviceName: string;
}

interface RuntimeResult {
  app: FastifyInstance;
  metricsRegistry: Registry;
}

interface InstrumentedRequest extends FastifyRequest {
  __receivedAtNs?: bigint;
  __span?: Span;
}

function getHistogramBuckets(): number[] {
  return [0.001, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5];
}

export async function createServiceRuntime(options: RuntimeOptions): Promise<RuntimeResult> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      base: { service: options.serviceName }
    }
  });

  await app.register(cors, {
    origin: true
  });

  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: `${options.serviceName.replace(/-/g, "_")}_` });

  const requestCounter = new Counter({
    name: "http_requests_total",
    help: "Total HTTP requests",
    labelNames: ["service", "method", "route", "status"] as const,
    registers: [registry]
  });

  const durationHistogram = new Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request latency in seconds",
    labelNames: ["service", "method", "route", "status"] as const,
    buckets: getHistogramBuckets(),
    registers: [registry]
  });

  const tracer = trace.getTracer(`warprotocol.${options.serviceName}`);

  app.addHook("onRequest", async (request) => {
    const req = request as InstrumentedRequest;
    req.__receivedAtNs = process.hrtime.bigint();
    req.__span = tracer.startSpan(`${request.method} ${request.url}`, {
      attributes: {
        "http.method": request.method,
        "http.route": request.routeOptions.url ?? request.url,
        "service.name": options.serviceName
      }
    });
  });

  app.addHook("onResponse", async (request, reply) => {
    const req = request as InstrumentedRequest;
    const route = request.routeOptions.url ?? request.url;
    const status = String(reply.statusCode);

    if (req.__receivedAtNs) {
      const durationSeconds = Number(process.hrtime.bigint() - req.__receivedAtNs) / 1_000_000_000;
      durationHistogram
        .labels(options.serviceName, request.method, route, status)
        .observe(durationSeconds);
    }

    requestCounter.labels(options.serviceName, request.method, route, status).inc(1);

    if (req.__span) {
      req.__span.setAttribute("http.status_code", reply.statusCode);
      req.__span.setStatus({
        code: reply.statusCode >= 500 ? SpanStatusCode.ERROR : SpanStatusCode.OK
      });
      req.__span.end();
    }
  });

  app.setErrorHandler((error, request, reply) => {
    const safeError = error instanceof Error ? error : new Error(String(error));
    const req = request as InstrumentedRequest;
    req.__span?.recordException(safeError);
    req.__span?.setStatus({ code: SpanStatusCode.ERROR, message: safeError.message });

    if (process.env.SENTRY_DSN) {
      Sentry.captureException(safeError, {
        tags: {
          service: options.serviceName
        }
      });
    }

    reply.status(500).send({
      code: "internal_error",
      message: safeError.message
    });
  });

  app.get("/health", async () => {
    return {
      service: options.serviceName,
      status: "ok",
      now: new Date().toISOString()
    };
  });

  app.get("/metrics", async (_request, reply) => {
    reply.header("content-type", registry.contentType);
    return registry.metrics();
  });

  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? "development",
      sendDefaultPii: false
    });
  }
  return {
    app,
    metricsRegistry: registry
  };
}

export function parsePort(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  const parsed = raw ? Number(raw) : fallback;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

export async function startRuntime(
  app: FastifyInstance,
  port: number,
  host = "0.0.0.0"
): Promise<void> {
  await app.listen({ port, host });
}

export function safeJson<T>(payload: string, fallback: T): T {
  try {
    return JSON.parse(payload) as T;
  } catch {
    return fallback;
  }
}

export function sendApiError(reply: FastifyReply, statusCode: number, code: string, message: string): void {
  reply.status(statusCode).send({ code, message });
}
