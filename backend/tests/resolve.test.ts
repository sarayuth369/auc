import { describe, expect, it } from 'vitest';
import { resolveConversion, type ResolveEnv } from '../src/resolve';

const env: ResolveEnv = { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-test' };

/** Builds a fake Gemini REST response envelope carrying `payload` as the model's JSON text. */
function geminiOk(payload: unknown): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
    { status: 200 },
  );
}

function geminiRawText(text: string): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
    { status: 200 },
  );
}

function fetchReturning(response: Response): typeof fetch {
  return (async () => response) as typeof fetch;
}

function fetchThrowing(message: string): typeof fetch {
  return (async () => {
    throw new Error(message);
  }) as typeof fetch;
}

describe('resolveConversion', () => {
  it('1. "10 km to miles" resolves as a plain length conversion', async () => {
    const fetchImpl = fetchReturning(
      geminiOk({ intent: 'convert', language: 'en', items: [{ value: 10, unit: 'kilometer' }], target_unit: 'mile' }),
    );
    const result = await resolveConversion({ text: '10 km to miles' }, env, { fetchImpl });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: true, target_unit: 'mile' });
  });

  it('2. "72 F to C" resolves as a temperature conversion', async () => {
    const fetchImpl = fetchReturning(
      geminiOk({ intent: 'convert', language: 'en', items: [{ value: 72, unit: 'fahrenheit' }], target_unit: 'celsius' }),
    );
    const result = await resolveConversion({ text: '72 F to C' }, env, { fetchImpl });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: true });
  });

  it('3. "5 feet 8 inches to cm" resolves a multi-item length conversion', async () => {
    const fetchImpl = fetchReturning(
      geminiOk({
        intent: 'convert',
        language: 'en',
        items: [
          { value: 5, unit: 'foot' },
          { value: 8, unit: 'inch' },
        ],
        target_unit: 'centimeter',
      }),
    );
    const result = await resolveConversion({ text: '5 feet 8 inches to cm' }, env, { fetchImpl });
    expect(result.status).toBe(200);
    expect((result.body as { items: unknown[] }).items).toHaveLength(2);
  });

  it('4. Thai "3 ไร่ 4 งาน เป็นกี่ตารางเมตร" resolves a multi-item area conversion', async () => {
    const fetchImpl = fetchReturning(
      geminiOk({
        intent: 'convert',
        language: 'th',
        items: [
          { value: 3, unit: 'rai' },
          { value: 4, unit: 'ngan' },
        ],
        target_unit: 'square_meter',
      }),
    );
    const result = await resolveConversion({ text: '3 ไร่ 4 งาน เป็นกี่ตารางเมตร' }, env, { fetchImpl });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: true, language: 'th', target_unit: 'square_meter' });
  });

  it('5. "500 nm to micrometers" resolves as a length conversion', async () => {
    const fetchImpl = fetchReturning(
      geminiOk({ intent: 'convert', language: 'en', items: [{ value: 500, unit: 'nanometer' }], target_unit: 'micrometer' }),
    );
    const result = await resolveConversion({ text: '500 nm to micrometers' }, env, { fetchImpl });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: true });
  });

  it('6. "12000 BTU/h to kW" resolves (power to power, not blocked)', async () => {
    const fetchImpl = fetchReturning(
      geminiOk({
        intent: 'convert',
        language: 'en',
        items: [{ value: 12000, unit: 'btu/h' }],
        target_unit: 'kilowatt',
      }),
    );
    const result = await resolveConversion({ text: '12000 BTU/h to kW' }, env, { fetchImpl });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: true });
  });

  it('7. "1 bigha in Bihar to square meters" resolves with a region-qualified canonical unit', async () => {
    const fetchImpl = fetchReturning(
      geminiOk({
        intent: 'convert',
        language: 'en',
        items: [{ value: 1, unit: 'bigha', region: 'Bihar' }],
        target_unit: 'square_meter',
      }),
    );
    const result = await resolveConversion({ text: '1 bigha in Bihar to square meters' }, env, { fetchImpl });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      success: true,
      items: [{ value: 1, unit: 'bigha_bihar' }],
    });
  });

  it('7b. bare "bigha" with no region asks for clarification instead of guessing', async () => {
    const fetchImpl = fetchReturning(
      geminiOk({
        intent: 'convert',
        language: 'en',
        items: [{ value: 1, unit: 'bigha' }],
        target_unit: 'square_meter',
      }),
    );
    const result = await resolveConversion({ text: '1 bigha to square meters' }, env, { fetchImpl });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: false, needs_clarification: true, unit: 'bigha' });
  });

  it('8. multilingual input: Japanese', async () => {
    const fetchImpl = fetchReturning(
      geminiOk({ intent: 'convert', language: 'ja', items: [{ value: 5, unit: 'kilometer' }], target_unit: 'meter' }),
    );
    const result = await resolveConversion({ text: '5キロメートルは何メートルですか' }, env, { fetchImpl });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: true, language: 'ja' });
  });

  it('8. multilingual input: Chinese', async () => {
    const fetchImpl = fetchReturning(
      geminiOk({ intent: 'convert', language: 'zh', items: [{ value: 5, unit: 'kilometer' }], target_unit: 'meter' }),
    );
    const result = await resolveConversion({ text: '5公里等于多少米' }, env, { fetchImpl });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: true, language: 'zh' });
  });

  it('9. empty input is rejected before calling Gemini', async () => {
    const fetchImpl = fetchThrowing('should not be called');
    const result = await resolveConversion({ text: '' }, env, { fetchImpl });
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ success: false, error: { code: 'INVALID_INPUT' } });
  });

  it('10. oversized input is rejected before calling Gemini', async () => {
    const fetchImpl = fetchThrowing('should not be called');
    const result = await resolveConversion({ text: 'x'.repeat(500) }, env, { fetchImpl });
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ success: false, error: { code: 'INPUT_TOO_LONG' } });
  });

  it('11. malformed Gemini JSON returns a controlled AI_INVALID_RESPONSE error', async () => {
    const fetchImpl = fetchReturning(geminiRawText('not valid json {'));
    const result = await resolveConversion({ text: '10 km to miles' }, env, { fetchImpl });
    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({ success: false, error: { code: 'AI_INVALID_RESPONSE' } });
  });

  it('12. Gemini network error/timeout returns a controlled AI_ERROR', async () => {
    const fetchImpl = fetchThrowing('network timeout');
    const result = await resolveConversion({ text: '10 km to miles' }, env, { fetchImpl });
    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({ success: false, error: { code: 'AI_ERROR' } });
  });

  it('12b. Gemini non-200 response returns a controlled AI_ERROR', async () => {
    const fetchImpl = fetchReturning(new Response('server error', { status: 500 }));
    const result = await resolveConversion({ text: '10 km to miles' }, env, { fetchImpl });
    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({ success: false, error: { code: 'AI_ERROR' } });
  });

  it('13. dimension mismatch BTU -> W is rejected as UNSUPPORTED_CONVERSION', async () => {
    const fetchImpl = fetchReturning(
      geminiOk({ intent: 'convert', language: 'en', items: [{ value: 1, unit: 'btu' }], target_unit: 'watt' }),
    );
    const result = await resolveConversion({ text: '1 BTU to W' }, env, { fetchImpl });
    expect(result.status).toBe(422);
    expect(result.body).toMatchObject({ success: false, error: { code: 'UNSUPPORTED_CONVERSION' } });
  });

  it('13b. dimension mismatch J -> W is rejected as UNSUPPORTED_CONVERSION', async () => {
    const fetchImpl = fetchReturning(
      geminiOk({ intent: 'convert', language: 'en', items: [{ value: 1, unit: 'joule' }], target_unit: 'watt' }),
    );
    const result = await resolveConversion({ text: '1 J to W' }, env, { fetchImpl });
    expect(result.status).toBe(422);
    expect(result.body).toMatchObject({ success: false, error: { code: 'UNSUPPORTED_CONVERSION' } });
  });

  it('14. AI_ENABLED=false short-circuits without calling the provider', async () => {
    const fetchImpl = fetchThrowing('should not be called');
    const disabledEnv: ResolveEnv = { ...env, AI_ENABLED: 'false' };
    const result = await resolveConversion({ text: '10 km to miles' }, disabledEnv, { fetchImpl });
    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({ success: false, error: { code: 'AI_ERROR' } });
  });

  it('15. an unsupported AI_PROVIDER returns a controlled AI_ERROR, not a crash', async () => {
    const fetchImpl = fetchThrowing('should not be called');
    const badProviderEnv: ResolveEnv = { ...env, AI_PROVIDER: 'openai' };
    const result = await resolveConversion({ text: '10 km to miles' }, badProviderEnv, { fetchImpl });
    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({ success: false, error: { code: 'AI_ERROR' } });
  });

  it('16. AI_MODEL overrides the legacy GEMINI_MODEL var', async () => {
    let requestedModel: string | null = null;
    const fetchImpl = (async (url: string) => {
      requestedModel = new URL(url).pathname.split('/models/')[1]?.split(':')[0] ?? null;
      return geminiOk({
        intent: 'convert',
        language: 'en',
        items: [{ value: 10, unit: 'kilometer' }],
        target_unit: 'mile',
      });
    }) as typeof fetch;

    const overrideEnv: ResolveEnv = { ...env, AI_MODEL: 'custom-model' };
    await resolveConversion({ text: '10 km to miles' }, overrideEnv, { fetchImpl });
    expect(requestedModel).toBe('custom-model');
  });
});
