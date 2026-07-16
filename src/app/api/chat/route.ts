import { NextRequest } from "next/server";
import dbConnect from "@/lib/db";
import ChatSession, { IMemory } from "@/models/ChatSession";
import { dispatchTool } from "@/services/gemAI.service";
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

interface OpenAIResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
  error?: { message: string; type: string };
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
        const systemPrompt = VICTORIA_SYSTEM_PROMPT.replace("{MEMORY_PLACEHOLDER}", memoryStr);

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

          let openAIRes: Response;
          try {
            openAIRes = await fetch("https://api.openai.com/v1/chat/completions", {
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
              }),
            });
          } catch (fetchErr) {
            console.error("[OpenAI Fetch Error]", fetchErr);
            enqueue({ type: "error", message: "Failed to reach OpenAI. Please check your connection." });
            controller.close();
            return;
          }

          if (!openAIRes.ok) {
            const errText = await openAIRes.text();
            console.error("[OpenAI HTTP Error]", openAIRes.status, errText);
            enqueue({
              type: "error",
              message: `OpenAI returned an error (${openAIRes.status}). Please try again shortly.`,
            });
            controller.close();
            return;
          }

          let openAIData: OpenAIResponse;
          try {
            openAIData = await openAIRes.json();
          } catch (parseErr) {
            console.error("[OpenAI Parse Error]", parseErr);
            enqueue({ type: "error", message: "Failed to parse OpenAI response." });
            controller.close();
            return;
          }

          if (openAIData.error) {
            console.error("[OpenAI API Error]", openAIData.error);
            enqueue({ type: "error", message: `OpenAI error: ${openAIData.error.message}` });
            controller.close();
            return;
          }

          if (!openAIData.choices || openAIData.choices.length === 0) {
            console.error("[OpenAI] No choices in response", openAIData);
            enqueue({ type: "error", message: "OpenAI returned an empty response." });
            controller.close();
            return;
          }

          const choice = openAIData.choices[0];
          const assistantMsg = choice.message;

          console.log(`[GemAI] finish_reason: ${choice.finish_reason}`);
          console.log(`[GemAI] tool_calls: ${assistantMsg.tool_calls?.length ?? 0}`);
          console.log(`[GemAI] content snippet: ${assistantMsg.content?.slice(0, 120) ?? "(none)"}`);

          openAIMessages.push({
            role: "assistant",
            content: assistantMsg.content,
            tool_calls: assistantMsg.tool_calls,
          });

          /* ── No tool calls → final answer ── */
          if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
            finalText = assistantMsg.content ?? "";
            console.log("[GemAI] No tool calls — using final text.");
            break;
          }

          /* ── Execute tool calls ── */
          for (const toolCall of assistantMsg.tool_calls) {
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

            /* ── Collect frontend data by tool name ── */
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
              if (collectedCategories.length > 0) {
                console.log(`[GemAI] First category sample:`, JSON.stringify(collectedCategories[0]));
              }

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
              if (collectedSubcategories.length > 0) {
                console.log(`[GemAI] First subcategory sample:`, JSON.stringify(collectedSubcategories[0]));
              }
            }

            openAIMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify(toolResult),
            });
          }

          if (choice.finish_reason === "stop") break;
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