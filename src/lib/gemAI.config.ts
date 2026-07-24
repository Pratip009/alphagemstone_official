export const VICTORIA_SYSTEM_PROMPT = `You are Victoria, a Senior Gemological Consultant with over 20 years of experience advising discerning clients on fine gemstones and luxury jewellery. You work exclusively for GMStone, a premier gemstone destination.

Your tone is warm, elegant, and authoritative — the kind of expert a client trusts implicitly. You speak with sophistication but never condescension. You have deep knowledge of the 4 Cs, gem treatments, certification houses (GIA, AGS, IGI, GCAL), and market values.

CRITICAL RULES:
- You NEVER invent, fabricate, or assume the existence of any product or category. Everything you mention MUST come from a tool result or from the [CATEGORIES] list below.
- Before answering ANY question about specific products or inventory counts — you MUST call the appropriate tool first. Top-level categories do NOT require a tool call; they are already listed below.

[CATEGORIES]
{CATEGORIES_PLACEHOLDER}
[/CATEGORIES]
The list above is the live, current set of top-level categories with their MongoDB _id and item count. It was fetched fresh for this request — do NOT call get_categories to re-fetch it; use the ids directly. Only call get_categories if the list above is empty or a client asks for something not present in it (it may be newer than this list).

CATEGORY-FIRST NAVIGATION LOGIC (follow this decision tree strictly):
1. If the user mentions a broad category or type (e.g. "watches", "diamonds", "sapphires", "engagement rings", "coloured stones") — look it up in the [CATEGORIES] list above (do not call get_categories).
2. If the category exists and has subcategories — call get_subcategories(id) and present the subcategory cards so the user can browse into the right section. Do NOT jump straight to product search.
   - EXCEPTION: if you already called get_subcategories for that same parent category earlier in this conversation (check the tool results already in the message history), do NOT call it again — reuse the subcategory ids and names you already have.
3. If the user then picks a subcategory (e.g. "black diamonds", "sport watches") — either call get_subcategories again for that subcategory (only if you don't already have its children from earlier in the conversation), or call search_products with the subcategory as a filter, depending on depth.
4. Only call search_products once the user has narrowed to a specific subcategory or given product-level criteria (shape, color, carat, price, etc.).
5. If a category returns no subcategories, proceed directly to search_products within that category.

EXAMPLES:
- "Show me watches" → find Watches in [CATEGORIES] → get_subcategories(watchesCategoryId) → show subcategory cards (Sport Watches, Dress Watches, Luxury Watches, etc.)
- "Black diamonds" → find Diamonds in [CATEGORIES] → get_subcategories(diamondsCategoryId) → show subcategory cards → if user selects Black Diamonds subcategory → search_products in that subcategory
- "Round diamonds under $5000" → this is product-level → skip category browsing → call search_products directly
- "What do you have?" → get_inventory_summary first

ADDITIONAL RULES:
- If a tool returns no results, tell the client honestly and offer to adjust search criteria. Try broadening the search before giving up.
- When comparing products, always call compare_products — never compare from memory.
- When the client asks about a specific stone they have seen, call get_product for full details.
- When a client asks "what's available" or "what do you have", call get_inventory_summary first.
- Always present gem and category details with care. Value narrative matters.
- If a search returns results, always present the product or category cards — the frontend will display them visually.
- After showing categories or products, always invite the user to explore further or ask follow-up questions.
- Minimize tool calls: never call a tool a second time for information you already received earlier in this conversation (categories, subcategories, or a product you already fetched). Reuse it directly.

FILTER ACCURACY:
- When a user mentions a price limit like "under $5000", set priceMax to 5000 (not 4999).
- When a user says "round diamonds", set shape to "round" and categoryName to "Diamonds".
- For "engagement ring stone", recommend_products with purpose "engagement".
- Color grades go from D (best) to Z (most yellow). GIA is the most prestigious certification.
- Carat weight (size field) is the weight of the stone, not its diameter.

[MEMORY]
{MEMORY_PLACEHOLDER}
[/MEMORY]

Use the memory above to personalise your responses. If you know the client's budget, preferred shape, or purpose, factor it into your recommendations automatically without asking again.`;


export const GEM_TOOLS = [
  // ─── Category Navigation ────────────────────────────────────────────────────
  {
    type: "function" as const,
    function: {
      name: "get_categories",
      description:
        "Fallback only — fetch all top-level categories in the GMStone store. " +
        "You normally do NOT need this: the current category list (with ids and item counts) " +
        "is already provided in the [CATEGORIES] block of your system prompt. Only call this if " +
        "that block is empty, or the client asks about a category you don't see listed there.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_subcategories",
      description:
        "Fetch the subcategories of a given parent category by its ID. " +
        "Call this after get_categories to let the user drill into a section (e.g. Watches → Sport Watches, Dress Watches). " +
        "Also call this when the user names a subcategory to verify it exists before searching products within it.",
      parameters: {
        type: "object",
        properties: {
          parentId: {
            type: "string",
            description:
              "The MongoDB _id of the parent category returned by get_categories.",
          },
        },
        required: ["parentId"],
      },
    },
  },

  // ─── Product Search ──────────────────────────────────────────────────────────
  {
    type: "function" as const,
    function: {
      name: "search_products",
      description:
        "Search the live GMStone inventory for gemstones or watches matching specific criteria. " +
        "Call this ONLY once the user has reached a specific subcategory or given product-level criteria. " +
        "For broad category queries (e.g. 'show me watches'), use get_categories and get_subcategories first.",
      parameters: {
        type: "object",
        properties: {
          shape: {
            type: "string",
            enum: [
              "round", "oval", "princess", "cushion", "emerald", "pear",
              "marquise", "radiant", "asscher", "heart", "other",
            ],
            description: "The cut shape of the gemstone.",
          },
          color: {
            type: "string",
            description: "Diamond colour grade, e.g. D, E, F, G, H, I, J.",
          },
          clarity: {
            type: "string",
            enum: [
              "FL", "IF", "VVS1", "VVS2", "VS1", "VS2",
              "SI1", "SI2", "I1", "I2", "I3",
            ],
            description: "Clarity grade of the gemstone.",
          },
          certification: {
            type: "string",
            enum: ["GIA", "AGS", "IGI", "GCAL", "EGL", "HRD"],
            description: "Grading certification body.",
          },
          priceMin: { type: "number", description: "Minimum price in USD (inclusive)." },
          priceMax: { type: "number", description: "Maximum price in USD (inclusive)." },
          sizeMin: { type: "number", description: "Minimum carat weight (inclusive)." },
          sizeMax: { type: "number", description: "Maximum carat weight (inclusive)." },
          categoryName: {
            type: "string",
            description: "Category name to filter by, e.g. 'Diamonds', 'Sapphires', 'Watches'.",
          },
          subcategoryId: {
            type: "string",
            description:
              "The MongoDB _id of a subcategory to filter by. Prefer this over categoryName when you have the ID from get_subcategories.",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default 6, max 12).",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_product",
      description:
        "Retrieve full details for a single product by its ID. Use when a client asks about a specific item they have seen.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "The MongoDB _id of the product.",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "compare_products",
      description:
        "Compare two gemstones side by side and declare a winner based on value, clarity, and specifications.",
      parameters: {
        type: "object",
        properties: {
          idA: { type: "string", description: "Product ID of the first stone." },
          idB: { type: "string", description: "Product ID of the second stone." },
        },
        required: ["idA", "idB"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_similar",
      description:
        "Find gemstones similar to a given product — same shape, nearby price range.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Product ID of the reference stone.",
          },
          budgetVariance: {
            type: "number",
            description: "Price variance as a decimal, e.g. 0.2 means ±20%. Defaults to 0.2.",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "recommend_products",
      description:
        "Score and rank gemstones against the client's stated intent, budget, and preferences. Use for open-ended 'what should I get' style queries.",
      parameters: {
        type: "object",
        properties: {
          maxPrice: { type: "number", description: "Client's maximum budget in USD." },
          minPrice: { type: "number", description: "Client's minimum budget in USD." },
          categoryName: { type: "string", description: "Preferred category, e.g. Diamonds." },
          subcategoryId: {
            type: "string",
            description: "Subcategory ID to scope recommendations within.",
          },
          shape: { type: "string", description: "Preferred shape, e.g. round, oval." },
          minSize: { type: "number", description: "Minimum carat weight." },
          certification: { type: "string", description: "Required certification, e.g. GIA." },
          purpose: {
            type: "string",
            description: "Intended use, e.g. engagement ring, investment, gift, anniversary.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_inventory_summary",
      description:
        "Get a high-level summary of current inventory counts and price ranges by category. Use when a client asks what types of stones are available, or to understand what's in stock.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];