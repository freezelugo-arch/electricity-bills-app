
import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractionSchema } from '@/lib/extraction-schema';

export const runtime = 'nodejs';

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_ATTEMPTS = 3;

// Convierte los tipos ["string", "null"] del esquema original.
function normalizeSchema(schema: any): any {
  if (Array.isArray(schema)) {
    return schema.map(normalizeSchema);
  }

  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  const result = { ...schema };

  if (Array.isArray(result.type)) {
    const types = result.type;
    delete result.type;

    result.anyOf = [
      ...types
        .filter((type: string) => type !== 'null')
        .map((type: string) => ({ type })),
      { type: 'null' },
    ];
  }

  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, value]) => [
        key,
        normalizeSchema(value),
      ])
    );
  }

  if (result.items) {
    result.items = normalizeSchema(result.items);
  }

  return result;
}

// Obtiene el código HTTP del error de Google.
function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;

    if (typeof status === 'number') {
      return status;
    }
  }

  return undefined;
}

// Espera progresiva antes de volver a intentarlo.
function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  try {
    // 1. Comprobar autenticación.
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Debes iniciar sesión.' },
        { status: 401 }
      );
    }

    // 2. Comprobar API Key.
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Falta configurar GEMINI_API_KEY en el servidor.' },
        { status: 503 }
      );
    }

    // 3. Comprobar PDF.
    const form = await request.formData();
    const file = form.get('file');

    if (
      !(file instanceof File) ||
      file.type !== 'application/pdf' ||
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      return NextResponse.json(
        { error: 'Selecciona un archivo PDF válido.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'El PDF supera el límite de 20 MB.' },
        { status: 413 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    // 4. Preparar Gemini.
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

    const contents = [
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: bytes.toString('base64'),
        },
      },
      {
        
text: `Eres un experto en lectura y extracción de datos de facturas eléctricas españolas.

Analiza TODAS las páginas del PDF y extrae TODOS los campos del esquema JSON.

REGLAS GENERALES:
- No dejes campos vacíos si el dato aparece en el documento.
- No confundas los datos del resumen con los del desglose.
- Utiliza null únicamente cuando el dato realmente no aparezca.
- No inventes información.
- Las fechas deben expresarse como YYYY-MM-DD.
- Los importes deben ser números decimales en euros.
- Los consumos deben expresarse en kWh.
- Las potencias deben expresarse en kW.

IDENTIFICACIÓN DE FACTURA:
- company: nombre de la comercializadora.
- invoice_number: número de factura.
- issue_date: fecha de emisión.
- period_start y period_end: inicio y fin del periodo facturado.
- billing_days: días facturados.
- cups: código CUPS.
- supply_address: dirección del suministro.
- contract_number: número de contrato.
- distributor: nombre de la distribuidora.

RESUMEN ECONÓMICO:
- total_eur: importe TOTAL A PAGAR, no la base imponible.
- consumption_kwh: consumo total facturado.
- average_energy_price_eur_kwh: precio medio de energía si aparece expresamente.
- contracted_power_p1_kw y contracted_power_p2_kw: potencias contratadas.
- power_amount_eur: suma de los importes de potencia P1 y P2.
- energy_amount_eur: suma del importe de todos los periodos de energía.
- electricity_tax_eur: impuesto sobre la electricidad.
- meter_rental_eur: alquiler del contador.
- vat_rate_percent: porcentaje de IVA.
- vat_amount_eur: importe del IVA.
- other_charges_eur: suma de otros conceptos, como financiación del bono social.

POTENCIAS:
- max_demand_p1_kw: potencia máxima demandada P1.
- max_demand_p2_kw: potencia máxima demandada P2.

PERIODOS HORARIOS:
- Extrae cada periodo por separado: punta, llano y valle.
- periods.consumption_kwh: consumo del periodo.
- periods.price_eur_kwh: precio por kWh.
- periods.amount_eur: importe del periodo.
- No confundas las lecturas del contador con el consumo facturado.
- Si aparecen lecturas, identifica correctamente reading_type y meter_reading.

OTROS CONCEPTOS:
- Incluye en other_concepts los conceptos adicionales que aparezcan desglosados.
- No dupliques importes que ya estén incluidos en otros campos.

COMPROBACIONES:
- La suma de los consumos horarios debe coincidir con el consumo total.
- La suma de los importes horarios debe coincidir con energy_amount_eur.
- La suma de potencia P1 y P2 debe coincidir con power_amount_eur.
- No confundas la base imponible con el total a pagar.
- Comprueba que el total a pagar incluye impuestos.
- Si faltan datos importantes o existen discrepancias, utiliza confidence "medium" o "low" y explica los motivos en review_notes.
- Utiliza confidence "high" solamente cuando los datos principales estén identificados y sean coherentes.

Devuelve todos los campos del esquema JSON.`
,
      },
    ];

    // 5. Intentar extraer los datos.
    let response;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        console.log(
          `Gemini: intento ${attempt}/${MAX_ATTEMPTS}, modelo ${model}`
        );

        response = await ai.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: normalizeSchema(extractionSchema),
          },
        });

        break;
      } catch (error) {
        const status = getErrorStatus(error);

        const retryable =
          status === 429 ||
          (status !== undefined && status >= 500 && status <= 599);

        console.error(
          `Gemini: error en intento ${attempt}. HTTP ${status ?? 'desconocido'}`,
          error
        );

        if (!retryable || attempt === MAX_ATTEMPTS) {
          throw error;
        }

        const delay = attempt * 2000;

        console.log(
          `Gemini: esperando ${delay / 1000} segundos antes de reintentar...`
        );

        await wait(delay);
      }
    }

    if (!response) {
      throw new Error('Gemini no ha devuelto respuesta.');
    }

    // 6. Procesar respuesta.
    const outputText = response.text;

    if (!outputText) {
      throw new Error('Gemini no ha devuelto contenido.');
    }

    let parsed;

    try {
      parsed = JSON.parse(outputText);
    } catch {
      console.error('Gemini ha devuelto una respuesta JSON inválida.');

      return NextResponse.json(
        { error: 'Gemini ha devuelto datos que no se pueden interpretar.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      data: parsed,
      model,
    });

  } catch (error) {
    const status = getErrorStatus(error);

    console.error('PDF extraction failed:', error);

    if (status === 503) {
      return NextResponse.json(
        {
          error:
            'Gemini no está disponible temporalmente. Inténtalo de nuevo más tarde.',
        },
        { status: 503 }
      );
    }

    if (status === 429) {
      return NextResponse.json(
        {
          error:
            'Se ha alcanzado el límite de peticiones de Gemini. Inténtalo más tarde.',
        },
        { status: 429 }
      );
    }

    if (status !== undefined && status >= 500) {
      return NextResponse.json(
        {
          error:
            'El servicio de inteligencia artificial está experimentando problemas.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        error:
          'No se pudo analizar el PDF. Comprueba que sea legible e inténtalo de nuevo.',
      },
      { status: 500 }
    );
  }
}
