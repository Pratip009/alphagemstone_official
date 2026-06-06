import { Readable } from 'stream';
import { SHAPES, COLORS, CLARITIES, CERTIFICATIONS } from '@/models/Product';

export interface ParsedProductRow {
  name?: string;
  category?: string;
  subcategory?: string;
  price?: number;
  shape?: string[];
  size?: number;
  color?: string[];
  clarity?: string[];
  certification?: string[];
  images?: string[];
  stock?: number;
  description?: string;
  [key: string]: unknown;
}

export interface ParseResult {
  rows: ParsedProductRow[];
  parseErrors: Array<{ row: number; error: string }>;
}

// ─── Column alias map ─────────────────────────────────────────────────────────
// Maps canonical field names → all accepted CSV header variants (case-insensitive).
const COLUMN_ALIASES: Record<string, string[]> = {
  name:          ['name', 'product name', 'product_name', 'title'],
  category:      ['category'],
  subcategory:   ['subcategory'],
  price:         ['price', 'price (usd)', 'price_usd', 'price(usd)', 'price usd'],
  size:          ['size', 'size (carat)', 'size_carat', 'carat', 'carats', 'size(carat)', 'size carat'],
  stock:         ['stock', 'stock quantity', 'stock_quantity', 'qty', 'quantity', 'stock qty'],
  shape:         ['shape'],
  color:         ['color', 'color grade', 'color_grade', 'colour', 'colour grade'],
  clarity:       ['clarity', 'clarity grade', 'clarity_grade'],
  certification: ['certification', 'cert', 'certificate'],
  images:        ['images', 'image urls', 'image_urls', 'image url', 'image_url', 'photo', 'photos'],
  description:   ['description', 'desc', 'details'],
};

// ─── Build a reverse lookup: canonical name → actual key found in this row ───
function buildAliasLookup(rawKeys: string[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const match = rawKeys.find((k) => k.trim().toLowerCase() === alias.toLowerCase());
      if (match) {
        lookup.set(canonical, match);
        break; // first match wins
      }
    }
  }
  return lookup;
}

// ─── Parse pipe-separated or comma-separated multi-values ────────────────────
function parseMulti(raw: string): string[] {
  return raw.split(/[|,]/).map((s) => s.trim()).filter(Boolean);
}

// ─── Derive a slug from a human-readable string ───────────────────────────────
// Used for display/logging only; the route handler does its own slug derivation
// and also matches by name, so we no longer store the slug in ParsedProductRow.
export function deriveSlug(raw: string): string {
  const segments = raw.split('>').map((s) => s.trim()).filter(Boolean);
  const last = segments[segments.length - 1] ?? raw;
  return last
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// ─── Normalize a raw row from CSV/Excel ──────────────────────────────────────
function normalizeRow(
  raw: Record<string, unknown>,
  rowIndex: number,
): { data: ParsedProductRow; error?: string } {
  try {
    const lookup = buildAliasLookup(Object.keys(raw));

    const get = (key: string): string => {
      const resolvedKey = lookup.get(key);
      const val = resolvedKey
        ? raw[resolvedKey]
        : (raw[key] ?? raw[key.toLowerCase()] ?? raw[key.toUpperCase()] ?? '');
      return String(val ?? '').trim();
    };

    // ── name ──────────────────────────────────────────────────────────────────
    const name = get('name');
    if (!name) return { data: {}, error: 'Missing required field: name' };

    // ── price ─────────────────────────────────────────────────────────────────
    const priceRaw = parseFloat(get('price'));
    if (isNaN(priceRaw) || priceRaw < 0)
      return { data: {}, error: `Invalid price: "${get('price')}"` };

    // ── size ──────────────────────────────────────────────────────────────────
    const sizeRaw = parseFloat(get('size'));
    if (isNaN(sizeRaw) || sizeRaw <= 0)
      return { data: {}, error: `Invalid size (carat weight): "${get('size')}"` };

    // ── stock ─────────────────────────────────────────────────────────────────
    const stockRaw = parseInt(get('stock'), 10);
    const stock = isNaN(stockRaw) ? 0 : Math.max(0, stockRaw);

    // ── shape ─────────────────────────────────────────────────────────────────
    const shapeRaw = parseMulti(get('shape').toLowerCase());
    if (shapeRaw.length === 0)
      return { data: {}, error: 'Missing required field: shape' };
    const invalidShape = shapeRaw.find((s) => !SHAPES.includes(s as never));
    if (invalidShape)
      return { data: {}, error: `Invalid shape: "${invalidShape}". Valid: ${SHAPES.join(', ')}` };

    // ── color ─────────────────────────────────────────────────────────────────
    const colorRaw = parseMulti(get('color').toUpperCase());
    if (colorRaw.length === 0)
      return { data: {}, error: 'Missing required field: color' };
    const invalidColor = colorRaw.find((c) => !COLORS.includes(c as never));
    if (invalidColor)
      return { data: {}, error: `Invalid color: "${invalidColor}". Valid: ${COLORS.join(', ')}` };

    // ── clarity ───────────────────────────────────────────────────────────────
    const clarityRaw = parseMulti(get('clarity').toUpperCase());
    if (clarityRaw.length === 0)
      return { data: {}, error: 'Missing required field: clarity' };
    const invalidClarity = clarityRaw.find((c) => !CLARITIES.includes(c as never));
    if (invalidClarity)
      return { data: {}, error: `Invalid clarity: "${invalidClarity}". Valid: ${CLARITIES.join(', ')}` };

    // ── certification (optional) ──────────────────────────────────────────────
    const certRaw = get('certification');
    let certification: string[] = ['none'];
    if (certRaw && certRaw.toLowerCase() !== 'none') {
      const certs = parseMulti(certRaw.toUpperCase());
      const invalidCert = certs.find((c) => !CERTIFICATIONS.includes(c as never));
      if (invalidCert)
        return { data: {}, error: `Invalid certification: "${invalidCert}". Valid: ${CERTIFICATIONS.join(', ')}` };
      certification = certs.length > 0 ? certs : ['none'];
    }

    // ── images (pipe-separated, 1–4 required) ─────────────────────────────────
    const imagesRaw = get('images');
    const images = imagesRaw
      ? imagesRaw.split('|').map((s) => s.trim()).filter(Boolean)
      : [];
    if (images.length === 0)
      return { data: {}, error: 'At least 1 image URL is required' };
    if (images.length > 4)
      return { data: {}, error: 'Maximum 4 image URLs allowed (pipe-separated)' };

    // ── category / subcategory ────────────────────────────────────────────────
    // IMPORTANT: We store the RAW string as-is (trimmed), NOT a derived slug.
    // The route handler will resolve it to an ObjectId by matching against both
    // the DB slug and the DB name (case-insensitive), so passing the raw value
    // gives the route handler the best chance to find a match regardless of
    // whether the user typed a slug, a display name, or a breadcrumb path like
    // "Diamonds > Natural Diamonds > Loose Diamonds".
    const categoryRaw = get('category');
    if (!categoryRaw) return { data: {}, error: 'Missing required field: category' };

    const subcategoryRaw = get('subcategory') || undefined;

    return {
      data: {
        name,
        // Store raw value — route handler resolves to ObjectId
        category: categoryRaw,
        subcategory: subcategoryRaw,
        price: priceRaw,
        shape: shapeRaw,
        size: sizeRaw,
        color: colorRaw,
        clarity: clarityRaw,
        certification,
        images,
        stock,
        description: get('description') || undefined,
      },
    };
  } catch (err) {
    return {
      data: {},
      error: `Row ${rowIndex} parse error: ${err instanceof Error ? err.message : 'Unknown'}`,
    };
  }
}

// ─── Parse CSV Buffer ─────────────────────────────────────────────────────────
export async function parseCSV(buffer: Buffer): Promise<ParseResult> {
  const csvParser = (await import('csv-parser')).default;

  return new Promise((resolve) => {
    const rows: ParsedProductRow[] = [];
    const parseErrors: Array<{ row: number; error: string }> = [];
    let rowIndex = 1;

    const stream = Readable.from(buffer);
    stream
      .pipe(csvParser())
      .on('data', (raw: Record<string, unknown>) => {
        rowIndex++;
        const { data, error } = normalizeRow(raw, rowIndex);
        if (error) {
          parseErrors.push({ row: rowIndex, error });
        } else {
          rows.push(data);
        }
      })
      .on('end', () => resolve({ rows, parseErrors }))
      .on('error', (err) => {
        parseErrors.push({ row: 0, error: `CSV parse error: ${err.message}` });
        resolve({ rows, parseErrors });
      });
  });
}

// ─── Parse Excel Buffer ───────────────────────────────────────────────────────
export async function parseExcel(buffer: Buffer): Promise<ParseResult> {
  const XLSX = await import('xlsx');
  const rows: ParsedProductRow[] = [];
  const parseErrors: Array<{ row: number; error: string }> = [];

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], parseErrors: [{ row: 0, error: 'No sheets found in Excel file' }] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  rawRows.forEach((raw, i) => {
    const rowIndex = i + 2;
    const { data, error } = normalizeRow(raw, rowIndex);
    if (error) {
      parseErrors.push({ row: rowIndex, error });
    } else {
      rows.push(data);
    }
  });

  return { rows, parseErrors };
}

// ─── Auto-detect and parse ────────────────────────────────────────────────────
export async function parseUploadedFile(
  buffer: Buffer,
  filename: string,
): Promise<ParseResult> {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return parseCSV(buffer);
  if (ext === 'xlsx' || ext === 'xls') return parseExcel(buffer);
  throw new Error(`Unsupported file type: .${ext}. Use .csv or .xlsx`);
}

// ─── Generate CSV template ────────────────────────────────────────────────────
export function generateCSVTemplate(): string {
  const headers = [
    'name',
    'category',
    'subcategory',
    'price',
    'shape',
    'size',
    'color',
    'clarity',
    'certification',
    'stock',
    'images',
    'description',
  ];
  const example = [
    '1ct Round Brilliant Diamond',
    'loose-diamonds',                 // slug OR display name OR "Diamonds > Natural > Loose Diamonds"
    'round-diamonds',                 // slug OR display name
    '4500',
    'round',                          // single shape, or pipe-separated: round|oval
    '1.0',
    'D',                              // single color, or pipe-separated: D|E
    'VS1',                            // single clarity, or pipe-separated: VS1|VS2
    'GIA',                            // single cert, or pipe-separated: GIA|AGS
    '5',
    'https://example.com/img1.jpg|https://example.com/img2.jpg',
    'Excellent cut round diamond with D color and VS1 clarity',
  ];
  return [headers.join(','), example.join(',')].join('\n');
}