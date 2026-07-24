import { NextRequest } from "next/server";
import dbConnect from "@/lib/db";
import ChatSession, { IMemory } from "@/models/ChatSession";
import { dispatchTool, getCategories } from "@/services/gemAI.service";
import { VICTORIA_SYSTEM_PROMPT, GEM_TOOLS } from "@/lib/gemAI.config";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

/* ─────────────────────────────────────────────
   Memory extraction helpers
───────────────────────────────────────────── */
function extractMemoryUpdates(text: string): Partial<IMemory> {
  const updates: Partial<IMemory> = {};

  const budgetBetween = text.match(/between\s+\$?([\d,]+)\s+and\s+\$?([\d,]+)/i);
  const budgetUnder = text.match(/(?:under|below|max|maximum|budget of)\s+\$?([\d,]+)/i);
  const budgetOver = text.match(/(?:over|above|at least|minimum)\s+\$?([\d,]+)/i);

  if (budgetBetween) {
    updates.budget = {
      min: parseFloat(budgetBetween[1].replace(/,/g, "")),
      max: parseFloat(budgetBetween[2].replace(/,/g, "")),
    };
  } else if (budgetUnder) {
    updates.budget = { max: parseFloat(budgetUnder[1].replace(/,/g, "")) };
  } else if (budgetOver) {
    updates.budget = { min: parseFloat(budgetOver[1].replace(/,/g, "")) };
  }

  const shapeMatch = text.match(/\b(round|oval|princess|pear|cushion|emerald|radiant)\b/i);
  if (shapeMatch) updates.preferredShape = shapeMatch[1].toLowerCase();

  const colorMatch = text.match(/\b(color|colour)\s+([D-J])\b/i);
  if (colorMatch) updates.preferredColor = colorMatch[2].toUpperCase();

  const purposeMatch = text.match(/\b(engagement|wedding|anniversary|gift|investment|birthday)\b/i);
  if (purposeMatch) updates.purpose = purposeMatch[1].toLowerCase();

  const certMatch = text.match(/\b(GIA|AGS|IGI|GCAL)\b/i);
  if (certMatch) updates.certification = certMatch[1].toUpperCase();

  return updates;
}

/* ─────────────────────────────────────────────
   SSE helper
───────────────────────────────────────────── */
function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/* ─────────────────────────────────────────────
   Streaming OpenAI turn
   Streams the completion instead of waiting for the full response, so
   the client can start rendering text (or see a tool call fire) as soon
   as the model starts producing it, rather than waiting for up to 5
   sequential blocking round trips before anything appears.
───────────────────────────────────────────── */
interface StreamedToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface StreamTurnResult {
  content: string | null;
  tool_calls?: StreamedToolCall[];
  finish_reason: string;
}

async function streamOpenAITurn(
  openAIMessages: OpenAIMessage[],
  enqueue: (data: Record<string, unknown>) => void
): Promise<StreamTurnResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: openAIMessages,
      tools: GEM_TOOLS,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }
  if (!res.body) throw new Error("OpenAI returned no response body.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  let content = "";
  const toolCallsByIndex: Record<number, { id: string; name: string; arguments: string }> = {};
  let finishReason = "stop";

  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data: ")) return;
    const payload = trimmed.slice(6).trim();
    if (payload === "[DONE]") return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return;
    }

    if (parsed.error) {
      throw new Error(parsed.error.message || "OpenAI streaming error");
    }

    const choice = parsed.choices?.[0];
    if (!choice) return;
    if (choice.finish_reason) finishReason = choice.finish_reason;

    const delta = choice.delta;
    if (!delta) return;

    if (delta.content) {
      content += delta.content;
      enqueue({ type: "delta", text: delta.content });
    }

    if (delta.tool_calls) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const tc of delta.tool_calls as any[]) {
        const idx = tc.index ?? 0;
        if (!toolCallsByIndex[idx]) {
          toolCallsByIndex[idx] = { id: tc.id ?? "", name: tc.function?.name ?? "", arguments: "" };
        }
        if (tc.id) toolCallsByIndex[idx].id = tc.id;
        if (tc.function?.name) toolCallsByIndex[idx].name = tc.function.name;
        if (tc.function?.arguments) toolCallsByIndex[idx].arguments += tc.function.arguments;
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer.trim()) buffer.split("\n").forEach(processLine);
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) part.split("\n").forEach(processLine);
  }

  const toolCalls = Object.values(toolCallsByIndex);
  return {
    content: content || null,
    tool_calls: toolCalls.length
      ? toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        }))
      : undefined,
    finish_reason: finishReason,
  };
}

/* ─────────────────────────────────────────────
   Route handler
───────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  let sessionId: string;
  let message: string;

  try {
    const body = await req.json();
    sessionId = body.sessionId;
    message = body.message;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!sessionId || !message) {
    return new Response(JSON.stringify({ error: "sessionId and message are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // This endpoint is unauthenticated and calls a paid LLM with tool-calling
  // on every message — cap it before we ever touch the model.
  // 1) Per IP: stops a single script/bot from hammering the endpoint.
  const ipLimit = await rateLimit(req, { id: "chat-ip", limit: 20, windowSec: 60 });
  if (!ipLimit.success) {
    return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.max(0, ipLimit.reset - Math.floor(Date.now() / 1000))),
      },
    });
  }
  // 2) Per session: stops one session from being looped/spammed even from
  // rotating IPs, and keeps a single legitimate user's cost bounded.
  const sessionLimit = await rateLimit(req, {
    id: "chat-session",
    limit: 30,
    windowSec: 3600,
    extraKey: String(sessionId),
    scope: "key",
  });
  if (!sessionLimit.success) {
    return new Response(JSON.stringify({ error: "Too many messages in this session. Please try again later." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.max(0, sessionLimit.reset - Math.floor(Date.now() / 1000))),
      },
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(sseEvent(data)));
        } catch {
          // Controller may already be closed
        }
      };

      try {
        await dbConnect();

        /* ── Load or create session ── */
        let session = await ChatSession.findOne({ sessionId });
        if (!session) {
          session = await ChatSession.create({
            sessionId,
            messages: [],
            memory: { budget: {}, preferredSize: {}, viewedProductIds: [] },
          });
        }

        session.messages.push({ role: "user", content: message, timestamp: new Date() });

        const MAX_HISTORY = 30;
        const recentMessages = session.messages.slice(-MAX_HISTORY);

        const memoryStr = JSON.stringify(session.memory, null, 2);

        // Categories are cached server-side (see getCategories in
        // gemAI.service.ts) and rarely change, so we fetch them once here
        // and inline them into the system prompt. This removes an entire
        // model round trip (get_categories) that would otherwise fire on
        // almost every message per the category-first navigation logic.
        let categoriesBlock = "(unavailable — call get_categories if needed)";
        try {
          const categories = await getCategories();
          categoriesBlock = categories.length
            ? categories
                .map((c) => `- ${c.name} (id: ${c._id}, ${c.productCount ?? 0} items)`)
                .join("\n")
            : "(no categories currently active — call get_categories to double-check)";
        } catch (catErr) {
          console.error("[GemAI] Failed to preload categories for system prompt", catErr);
        }

        const systemPrompt = VICTORIA_SYSTEM_PROMPT
          .replace("{MEMORY_PLACEHOLDER}", memoryStr)
          .replace("{CATEGORIES_PLACEHOLDER}", categoriesBlock);

        const openAIMessages: OpenAIMessage[] = [
          { role: "system", content: systemPrompt },
          ...recentMessages.map((m) => ({
            role: m.role as OpenAIMessage["role"],
            content: m.content,
          })),
        ];

        enqueue({ type: "thinking" });

        /* ── Agentic loop ── */
        let iteration = 0;
        let finalText = "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let collectedProducts: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let collectedCategories: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let collectedSubcategories: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let comparisonData: any = null;

        while (iteration < 5) {
          iteration++;
          console.log(`\n[GemAI] ── Iteration ${iteration} ──`);

          let turn: StreamTurnResult;
          try {
            turn = await streamOpenAITurn(openAIMessages, enqueue);
          } catch (streamErr) {
            console.error("[OpenAI Stream Error]", streamErr);
            enqueue({
              type: "error",
              message: "Failed to reach OpenAI. Please try again shortly.",
            });
            controller.close();
            return;
          }

          console.log(`[GemAI] finish_reason: ${turn.finish_reason}`);
          console.log(`[GemAI] tool_calls: ${turn.tool_calls?.length ?? 0}`);
          console.log(`[GemAI] content snippet: ${turn.content?.slice(0, 120) ?? "(none)"}`);

          openAIMessages.push({
            role: "assistant",
            content: turn.content,
            tool_calls: turn.tool_calls,
          });

          /* ── No tool calls → final answer ── */
          if (!turn.tool_calls || turn.tool_calls.length === 0) {
            finalText = turn.content ?? "";
            console.log("[GemAI] No tool calls — using final text.");
            break;
          }

          /* ── Execute tool calls in parallel ──
             Tool calls returned within a single turn are independent of
             each other (the model already has everything it needs to
             issue them together), so there's no reason to await them one
             at a time. Running them concurrently cuts latency whenever
             the model fires off more than one call in a turn. */
          const toolCallOutcomes = await Promise.all(
            turn.tool_calls.map(async (toolCall) => {
              const toolName = toolCall.function.name;

              let toolArgs: Record<string, unknown>;
              try {
                toolArgs = JSON.parse(toolCall.function.arguments || "{}");
              } catch {
                console.error("[Tool Args Parse Error]", toolCall.function.arguments);
                toolArgs = {};
              }

              console.log(`[GemAI] → Tool called: "${toolName}"`, toolArgs);
              enqueue({ type: "tool_call", tool: toolName, args: toolArgs });

              let toolResult: unknown;
              try {
                toolResult = await dispatchTool(toolName, toolArgs);
              } catch (toolErr) {
                console.error(`[Tool Error: ${toolName}]`, toolErr);
                toolResult = { error: `Tool ${toolName} failed.` };
              }

              console.log(
                `[GemAI] ← Tool result for "${toolName}":`,
                JSON.stringify(toolResult)?.slice(0, 300)
              );

              return { toolCall, toolName, toolArgs, toolResult };
            })
          );

          /* ── Collect frontend data by tool name (order preserved) ── */
          for (const { toolCall, toolName, toolArgs, toolResult } of toolCallOutcomes) {
            if (
              toolName === "search_products" ||
              toolName === "recommend_products" ||
              toolName === "find_similar"
            ) {
              collectedProducts = Array.isArray(toolResult) ? toolResult : [];
              console.log(`[GemAI] collectedProducts count: ${collectedProducts.length}`);

            } else if (toolName === "get_product" && toolResult) {
              collectedProducts = [toolResult];
              console.log(`[GemAI] collectedProducts (single): 1`);

            } else if (toolName === "compare_products" && toolResult) {
              comparisonData = toolResult;
              console.log(`[GemAI] comparisonData set`);

            } else if (toolName === "get_categories") {
              collectedCategories = Array.isArray(toolResult) ? toolResult : [];
              console.log(`[GemAI] collectedCategories count: ${collectedCategories.length}`);

            } else if (toolName === "get_subcategories") {
              collectedSubcategories = Array.isArray(toolResult) ? toolResult : [];
              // Attach parentName from args if available so the UI can show breadcrumb
              const parentId = toolArgs?.parentId as string | undefined;
              if (parentId && collectedSubcategories.length > 0) {
                collectedSubcategories = collectedSubcategories.map((sub) => ({
                  ...sub,
                  parentId,
                }));
              }
              console.log(`[GemAI] collectedSubcategories count: ${collectedSubcategories.length}`);
            }

            openAIMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify(toolResult),
            });
          }

          if (turn.finish_reason === "stop") break;
        }

        if (!finalText) {
          const lastAssistant = [...openAIMessages]
            .reverse()
            .find((m) => m.role === "assistant" && m.content);
          finalText = lastAssistant?.content ?? "I wasn't able to complete that request. Please try again.";
        }

        /* ── Save assistant message to session ── */
        session.messages.push({
          role: "assistant",
          content: finalText,
          timestamp: new Date(),
        });

        /* ── Update memory ── */
        const memoryUpdates = extractMemoryUpdates(message);
        if (memoryUpdates.budget) {
          session.memory.budget = { ...session.memory.budget, ...memoryUpdates.budget };
        }
        if (memoryUpdates.preferredShape) session.memory.preferredShape = memoryUpdates.preferredShape;
        if (memoryUpdates.preferredColor) session.memory.preferredColor = memoryUpdates.preferredColor;
        if (memoryUpdates.certification) session.memory.certification = memoryUpdates.certification;
        if (memoryUpdates.purpose) session.memory.purpose = memoryUpdates.purpose;

        if (collectedProducts.length > 0) {
          const newIds = collectedProducts
            .map((p) => p?._id?.toString?.() ?? "")
            .filter(Boolean);
          const existing = new Set(session.memory.viewedProductIds);
          newIds.forEach((id) => existing.add(id));
          session.memory.viewedProductIds = Array.from(existing).slice(-50);
        }

        session.markModified("memory");
        await session.save();

        /* ── Build and stream final SSE response ── */
        const responsePayload: Record<string, unknown> = {
          type: "response",
          message: finalText,
          sessionId,
        };

        if (collectedProducts.length > 0)      responsePayload.products      = collectedProducts;
        if (collectedCategories.length > 0)    responsePayload.categories    = collectedCategories;
        if (collectedSubcategories.length > 0) responsePayload.subcategories = collectedSubcategories;
        if (comparisonData)                    responsePayload.comparison    = comparisonData;

        console.log(
          "[GemAI] Counts — products:", collectedProducts.length,
          "| categories:", collectedCategories.length,
          "| subcategories:", collectedSubcategories.length,
          "| comparison:", !!comparisonData
        );

        enqueue(responsePayload);

      } catch (err) {
        console.error("[GemAI Chat Error]", err);
        enqueue({
          type: "error",
          message: "An unexpected error occurred. Please try again.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}