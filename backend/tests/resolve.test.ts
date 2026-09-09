import { describe, expect, it } from 'vitest';
import type { WorkersAiBinding } from '../src/cloudflare-ai';
import { resolveConversion, type ResolveEnv } from '../src/resolve';

const env: ResolveEnv = { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-test' };

/** Stubs env.AI (Workers AI binding) with a fixed .run() result or rejection. */
function aiReturning(response: unknown): WorkersAiBinding {
  return { run: async () => response };
}

function aiRejecting(message: string): WorkersAiBinding {
  return {
    run: async () => {
      throw new Error(message);
    },
  };
}

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

  it('17. "1 kg to oz" resolves (RESOLVED)', async () => {
    const fetchImpl = fetchReturning(
      geminiOk({ intent: 'convert', language: 'en', items: [{ value: 1, unit: 'kilogram' }], target_unit: 'ounce' }),
    );
    const result = await resolveConversion({ text: '1 kg to oz' }, env, { fetchImpl });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: true, target_unit: 'ounce' });
  });

  it('18. "100 kg to °C" is rejected as INVALID_CONVERSION (weight vs temperature)', async () => {
    const fetchImpl = fetchReturning(
      geminiOk({ intent: 'convert', language: 'en', items: [{ value: 100, unit: 'kilogram' }], target_unit: 'celsius' }),
    );
    const result = await resolveConversion({ text: '100 kg to °C' }, env, { fetchImpl });
    expect(result.status).toBe(422);
    expect(result.body).toMatchObject({ success: false, error: { code: 'UNSUPPORTED_CONVERSION' } });
  });

  it('19. an unresolvable/unknown unit is not blocked by the dimension guard - Flutter has final say (UNSUPPORTED)', async () => {
    const fetchImpl = fetchReturning(
      geminiOk({ intent: 'convert', language: 'en', items: [{ value: 1, unit: 'zorkflarp' }], target_unit: 'zorkflarp_v2' }),
    );
    const result = await resolveConversion({ text: '1 zorkflarp to zorkflarp_v2' }, env, { fetchImpl });
    // No dimension is known for either unit, so the guard can't flag a
    // mismatch here; the Worker passes it through and the Flutter
    // UnitRepository is the one that ultimately rejects an unknown unit.
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: true, items: [{ unit: 'zorkflarp' }] });
  });

  describe('Cloudflare Workers AI provider', () => {
    const cfEnv: ResolveEnv = { ...env, AI_PROVIDER: 'cloudflare', AI_MODEL: '@cf/google/gemma-4-26b-a4b-it' };
    const unusedFetch = fetchThrowing('gemini fetch should not be called for the cloudflare provider');

    it('20. "5 lb to kg" resolves via Workers AI (RESOLVED)', async () => {
      const ai = aiReturning({
        response: JSON.stringify({
          intent: 'convert',
          language: 'en',
          items: [{ value: 5, unit: 'pound' }],
          target_unit: 'kilogram',
        }),
      });
      const result = await resolveConversion(
        { text: '5 lb to kg' },
        { ...cfEnv, AI: ai },
        { fetchImpl: unusedFetch },
      );
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ success: true, target_unit: 'kilogram' });
    });

    it('20b. an OpenAI-chat-shaped response (choices[0].message.content) is also parsed', async () => {
      // The Gemma model this project targets replies in the OpenAI chat
      // completion shape, not the classic Workers AI `{ response }` shape.
      const ai = aiReturning({
        choices: [
          {
            message: {
              content: JSON.stringify({
                intent: 'convert',
                language: 'en',
                items: [{ value: 10, unit: 'kilometer' }],
                target_unit: 'mile',
              }),
            },
          },
        ],
      });
      const result = await resolveConversion(
        { text: 'Convert 10 kilometers to miles.' },
        { ...cfEnv, AI: ai },
        { fetchImpl: unusedFetch },
      );
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ success: true, target_unit: 'mile' });
    });

    it('21. a ```json-fenced response from Workers AI is still parsed', async () => {
      const ai = aiReturning({
        response:
          '```json\n' +
          JSON.stringify({
            intent: 'convert',
            language: 'en',
            items: [{ value: 12000, unit: 'btu/h' }],
            target_unit: 'kilowatt',
          }) +
          '\n```',
      });
      const result = await resolveConversion(
        { text: '12000 BTU/h to kW' },
        { ...cfEnv, AI: ai },
        { fetchImpl: unusedFetch },
      );
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ success: true });
    });

    it('22. malformed Workers AI JSON returns a controlled AI_INVALID_RESPONSE (safe failure, never crashes)', async () => {
      const ai = aiReturning({ response: 'not valid json {' });
      const result = await resolveConversion(
        { text: '10 km to miles' },
        { ...cfEnv, AI: ai },
        { fetchImpl: unusedFetch },
      );
      expect(result.status).toBe(502);
      expect(result.body).toMatchObject({ success: false, error: { code: 'AI_INVALID_RESPONSE' } });
    });

    it('23. Workers AI unavailable (ai.run rejects) returns a controlled AI_ERROR', async () => {
      const ai = aiRejecting('binding unavailable');
      const result = await resolveConversion(
        { text: '10 km to miles' },
        { ...cfEnv, AI: ai },
        { fetchImpl: unusedFetch },
      );
      expect(result.status).toBe(502);
      expect(result.body).toMatchObject({ success: false, error: { code: 'AI_ERROR' } });
    });

    it('24. AI_PROVIDER=cloudflare with no env.AI binding fails cleanly, never crashes', async () => {
      const result = await resolveConversion({ text: '10 km to miles' }, cfEnv, { fetchImpl: unusedFetch });
      expect(result.status).toBe(502);
      expect(result.body).toMatchObject({ success: false, error: { code: 'AI_ERROR' } });
    });

    it('25. Thai local unit "3 ไร่ 4 งาน เป็นกี่ตารางเมตร" resolves via Workers AI too', async () => {
      const ai = aiReturning({
        response: JSON.stringify({
          intent: 'convert',
          language: 'th',
          items: [
            { value: 3, unit: 'rai' },
            { value: 4, unit: 'ngan' },
          ],
          target_unit: 'square_meter',
        }),
      });
      const result = await resolveConversion(
        { text: '3 ไร่ 4 งาน เป็นกี่ตารางเมตร' },
        { ...cfEnv, AI: ai },
        { fetchImpl: unusedFetch },
      );
      expect(result.status).toBe(200);
      // Backend passes rai/ngan straight through unmodified - the Flutter
      // Unit Registry/ConversionEngine remains the sole source of truth for
      // 1 rai = 1600 m^2 / 1 ngan = 400 m^2, never re-derived here.
      expect(result.body).toMatchObject({
        success: true,
        language: 'th',
        target_unit: 'square_meter',
        items: [
          { value: 3, unit: 'rai' },
          { value: 4, unit: 'ngan' },
        ],
      });
    });

    it('26. bare "bigha" with no region still asks for clarification via Workers AI (CLARIFICATION_REQUIRED)', async () => {
      const ai = aiReturning({
        response: JSON.stringify({
          intent: 'convert',
          language: 'en',
          items: [{ value: 1, unit: 'bigha' }],
          target_unit: 'square_meter',
        }),
      });
      const result = await resolveConversion(
        { text: '1 bigha to square meters' },
        { ...cfEnv, AI: ai },
        { fetchImpl: unusedFetch },
      );
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ success: false, needs_clarification: true, unit: 'bigha' });
    });
  });

  it('28. a domain-swapped hallucination on Thai local units is rejected even though it is internally dimension-consistent', async () => {
    // Mirrors a real observed failure: "3 rai 4 ngan" (area) misidentified
    // as "3 hour to minute" (time->time, so findDimensionMismatch alone
    // would wave it through) - local-unit-tokens.ts must catch this.
    const fetchImpl = fetchReturning(
      geminiOk({
        intent: 'convert',
        language: 'th',
        items: [{ value: 3, unit: 'hour' }],
        target_unit: 'minute',
      }),
    );
    const result = await resolveConversion({ text: '3 ไร่ 4 งาน เป็นกี่ตารางเมตร' }, env, { fetchImpl });
    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({ success: false, error: { code: 'AI_INVALID_RESPONSE' } });
  });

  it('29. a correct Thai local-unit response is not affected by the mismatch guard', async () => {
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
    expect(result.body).toMatchObject({ success: true, target_unit: 'square_meter' });
  });

  it('30. text with no Thai local-unit tokens is never affected by the mismatch guard', async () => {
    const fetchImpl = fetchReturning(
      geminiOk({ intent: 'convert', language: 'en', items: [{ value: 10, unit: 'kilometer' }], target_unit: 'mile' }),
    );
    const result = await resolveConversion({ text: '10 km to miles' }, env, { fetchImpl });
    expect(result.status).toBe(200);
  });

  it('31. an AI-computed (fabricated) value is rejected even when units/dimensions are correct', async () => {
    // Real observed failure: "3 rai 4 ngan" (literal 3, 4) came back as a
    // pre-blended "1.333 rai, 0.667 ngan" - the AI did math it must never do.
    const fetchImpl = fetchReturning(
      geminiOk({
        intent: 'convert',
        language: 'th',
        items: [
          { value: 1.3333333333333333, unit: 'rai' },
          { value: 0.6666666666666666, unit: 'ngan' },
        ],
        target_unit: 'square_meter',
      }),
    );
    const result = await resolveConversion({ text: '3 ไร่ 4 งาน เป็นกี่ตารางเมตร' }, env, { fetchImpl });
    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({ success: false, error: { code: 'AI_INVALID_RESPONSE' } });
  });

  it('32. a duplicated item reusing the input\'s single stated number is rejected', async () => {
    // Real observed failure: Chinese "1公斤等于多少盎司？" (one literal "1")
    // came back as two items both claiming value 1.
    const fetchImpl = fetchReturning(
      geminiOk({
        intent: 'convert',
        language: 'zh',
        items: [
          { value: 1, unit: 'kilogram' },
          { value: 1, unit: 'ounce' },
        ],
        target_unit: 'ounce',
      }),
    );
    const result = await resolveConversion({ text: '1公斤等于多少盎司？' }, env, { fetchImpl });
    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({ success: false, error: { code: 'AI_INVALID_RESPONSE' } });
  });

  it('33. the AI incorrectly claiming "rai" needs region clarification is overridden - Unit Registry decides, not the model', async () => {
    // Real observed behavior: the model occasionally sets
    // needs_clarification=true for "rai", which regional.ts does NOT treat
    // as region-dependent (only "bigha" is) - our own registry must win.
    const fetchImpl = fetchReturning(
      geminiOk({
        intent: 'convert',
        language: 'th',
        items: [
          { value: 3, unit: 'rai' },
          { value: 4, unit: 'ngan' },
        ],
        target_unit: 'square_meter',
        needs_clarification: true,
        ambiguous_unit: 'rai',
        clarification_question: 'Which definition of rai?',
      }),
    );
    const result = await resolveConversion({ text: '3 ไร่ 4 งาน เป็นกี่ตารางเมตร' }, env, { fetchImpl });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: true, target_unit: 'square_meter' });
  });

  describe('global unit intelligence (Tier 2: AI-identified units the Worker has no curated definition for)', () => {
    // These prove the architecture stays generic: the Worker never needs a
    // hard-coded list of every country's units - it validates whatever
    // canonical unit AI identifies (dimension, numeric fidelity, region
    // safety) and passes it through unresolved. Actual unit *definitions*
    // are Flutter's Unit Registry's job, not this Worker's.

    it('Korea: "3 pyeong to square meters" - an AI-identified unit with no local dimension entry passes through untouched', async () => {
      const fetchImpl = fetchReturning(
        geminiOk({ intent: 'convert', language: 'en', items: [{ value: 3, unit: 'pyeong' }], target_unit: 'square_meter' }),
      );
      const result = await resolveConversion({ text: '3 pyeong to square meters' }, env, { fetchImpl });
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ success: true, items: [{ value: 3, unit: 'pyeong' }], target_unit: 'square_meter' });
    });

    it('Japan: "2 tsubo to square meters" resolves the same way', async () => {
      const fetchImpl = fetchReturning(
        geminiOk({ intent: 'convert', language: 'en', items: [{ value: 2, unit: 'tsubo' }], target_unit: 'square_meter' }),
      );
      const result = await resolveConversion({ text: '2 tsubo to square meters' }, env, { fetchImpl });
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ success: true, items: [{ value: 2, unit: 'tsubo' }] });
    });

    it('China: "10 jin to kg" resolves the same way', async () => {
      const fetchImpl = fetchReturning(
        geminiOk({ intent: 'convert', language: 'en', items: [{ value: 10, unit: 'jin' }], target_unit: 'kilogram' }),
      );
      const result = await resolveConversion({ text: '10 jin to kg' }, env, { fetchImpl });
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ success: true, items: [{ value: 10, unit: 'jin' }] });
    });

    it('India: "5 bigha in Bihar to square meters" - region-qualified regional unit is tagged, not fabricated', async () => {
      const fetchImpl = fetchReturning(
        geminiOk({
          intent: 'convert',
          language: 'en',
          items: [{ value: 5, unit: 'bigha', region: 'Bihar' }],
          target_unit: 'square_meter',
        }),
      );
      const result = await resolveConversion({ text: '5 bigha in Bihar to square meters' }, env, { fetchImpl });
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ success: true, items: [{ value: 5, unit: 'bigha_bihar' }] });
    });

    it('an AI-fabricated value for an unknown global unit is still rejected (numeric guard applies regardless of unit familiarity)', async () => {
      const fetchImpl = fetchReturning(
        geminiOk({ intent: 'convert', language: 'en', items: [{ value: 999, unit: 'pyeong' }], target_unit: 'square_meter' }),
      );
      const result = await resolveConversion({ text: '3 pyeong to square meters' }, env, { fetchImpl });
      expect(result.status).toBe(502);
      expect(result.body).toMatchObject({ success: false, error: { code: 'AI_INVALID_RESPONSE' } });
    });
  });

  describe('deterministic pre-AI dimension guard (extractSimplePair)', () => {
    it('34. "100 kg to °C" is rejected without ever calling the AI resolver', async () => {
      const fetchImpl = fetchThrowing('AI must not be called for a deterministic dimension mismatch');
      const result = await resolveConversion({ text: '100 kg to °C' }, env, { fetchImpl });
      expect(result.status).toBe(422);
      expect(result.body).toMatchObject({ success: false, error: { code: 'UNSUPPORTED_CONVERSION' } });
    });

    it('35. "10 meter to kilogram" is rejected deterministically (length vs weight)', async () => {
      const fetchImpl = fetchThrowing('should not be called');
      const result = await resolveConversion({ text: '10 meter to kilogram' }, env, { fetchImpl });
      expect(result.status).toBe(422);
      expect(result.body).toMatchObject({ success: false, error: { code: 'UNSUPPORTED_CONVERSION' } });
    });

    it('36. "1 liter to celsius" is rejected deterministically (volume vs temperature)', async () => {
      const fetchImpl = fetchThrowing('should not be called');
      const result = await resolveConversion({ text: '1 liter to celsius' }, env, { fetchImpl });
      expect(result.status).toBe(422);
      expect(result.body).toMatchObject({ success: false, error: { code: 'UNSUPPORTED_CONVERSION' } });
    });

    it('37. "1 kg to square meters" is rejected deterministically (weight vs area)', async () => {
      const fetchImpl = fetchThrowing('should not be called');
      const result = await resolveConversion({ text: '1 kg to square meters' }, env, { fetchImpl });
      expect(result.status).toBe(422);
      expect(result.body).toMatchObject({ success: false, error: { code: 'UNSUPPORTED_CONVERSION' } });
    });

    it('38. "10 seconds to kilograms" is rejected deterministically (time vs weight)', async () => {
      const fetchImpl = fetchThrowing('should not be called');
      const result = await resolveConversion({ text: '10 seconds to kilograms' }, env, { fetchImpl });
      expect(result.status).toBe(422);
      expect(result.body).toMatchObject({ success: false, error: { code: 'UNSUPPORTED_CONVERSION' } });
    });

    it('39. "1 bigha to square meters" is NOT short-circuited (same dimension) - still goes to AI for clarification', async () => {
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

    it('40. same-dimension simple pairs ("10 km to miles") still resolve normally via AI', async () => {
      const fetchImpl = fetchReturning(
        geminiOk({ intent: 'convert', language: 'en', items: [{ value: 10, unit: 'kilometer' }], target_unit: 'mile' }),
      );
      const result = await resolveConversion({ text: '10 km to miles' }, env, { fetchImpl });
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ success: true, target_unit: 'mile' });
    });

    it('41. multi-item input ("5 feet 8 inches to cm") is never short-circuited', async () => {
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
  });

  it('27. Gemini provider still works when AI_PROVIDER is explicitly "gemini"', async () => {
    const fetchImpl = fetchReturning(
      geminiOk({ intent: 'convert', language: 'en', items: [{ value: 10, unit: 'kilometer' }], target_unit: 'mile' }),
    );
    const explicitEnv: ResolveEnv = { ...env, AI_PROVIDER: 'gemini' };
    const result = await resolveConversion({ text: '10 km to miles' }, explicitEnv, { fetchImpl });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: true });
  });

  describe('currency (deterministic, never sent to AI)', () => {
    const fakeRateProvider = { getRate: async (from: string, to: string) => (from === 'THB' && to === 'USD' ? 0.0287 : 1) };

    it('42. "100 THB = USD" resolves using the injected rate, without ever calling AI', async () => {
      const fetchImpl = fetchThrowing('AI must not be called for a currency request');
      const result = await resolveConversion(
        { text: '100 THB = USD' },
        env,
        { fetchImpl, currencyRateProvider: fakeRateProvider },
      );
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({
        success: true,
        intent: 'currency_convert',
        from: 'THB',
        to: 'USD',
        amount: 100,
        rate: 0.0287,
        result: 2.87,
      });
    });

    it('43. "10 CNY to THB" also short-circuits before AI', async () => {
      const fetchImpl = fetchThrowing('should not be called');
      const cnyProvider = { getRate: async () => 4.5 };
      const result = await resolveConversion(
        { text: '10 CNY to THB' },
        env,
        { fetchImpl, currencyRateProvider: cnyProvider },
      );
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ success: true, intent: 'currency_convert', from: 'CNY', to: 'THB', result: 45 });
    });

    it('44. the numeric result always equals amount * the provider-supplied rate - AI never supplies it', async () => {
      const fetchImpl = fetchThrowing('should not be called');
      const preciseProvider = { getRate: async () => 0.029123456 };
      const result = await resolveConversion(
        { text: '250 THB = USD' },
        env,
        { fetchImpl, currencyRateProvider: preciseProvider },
      );
      expect((result.body as { result: number }).result).toBeCloseTo(250 * 0.029123456, 10);
    });

    it('45. an unavailable FX provider returns a controlled CURRENCY_UNAVAILABLE error, never a fabricated result', async () => {
      const fetchImpl = fetchThrowing('should not be called');
      const failingProvider = {
        getRate: async () => {
          throw new (await import('../src/currency')).CurrencyRateUnavailableError('down');
        },
      };
      const result = await resolveConversion(
        { text: '100 THB = USD' },
        env,
        { fetchImpl, currencyRateProvider: failingProvider },
      );
      expect(result.status).toBe(502);
      expect(result.body).toMatchObject({ success: false, error: { code: 'CURRENCY_UNAVAILABLE' } });
    });

    it('46. an unrecognized currency-like request still falls through to AI unaffected', async () => {
      const fetchImpl = fetchReturning(
        geminiOk({ intent: 'convert', language: 'en', items: [{ value: 10, unit: 'kilometer' }], target_unit: 'mile' }),
      );
      const result = await resolveConversion(
        { text: '10 km to miles' },
        env,
        { fetchImpl, currencyRateProvider: fakeRateProvider },
      );
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ success: true, intent: 'convert' });
    });

    it('47. same-currency request resolves to a 1:1 rate, still via the pipeline, never AI', async () => {
      const fetchImpl = fetchThrowing('should not be called');
      const identityProvider = { getRate: async (from: string, to: string) => (from === to ? 1 : 0) };
      const result = await resolveConversion(
        { text: '100 USD = USD' },
        env,
        { fetchImpl, currencyRateProvider: identityProvider },
      );
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ result: 100, rate: 1 });
    });
  });

  describe('crypto / mixed money (never sent to AI)', () => {
    const usdPrices: Record<string, number> = { BTC: 65000, ETH: 3250 };
    const cryptoProvider = {
      getUsdPrice: async (symbol: string) => ({ price: usdPrices[symbol] ?? 1, stale: false }),
      getUsdPrices: async (symbols: string[]) => {
        const result: Record<string, { price: number; stale: boolean }> = {};
        for (const symbol of symbols) result[symbol] = { price: usdPrices[symbol] ?? 1, stale: false };
        return result;
      },
    };
    const fiatProvider = {
      getRate: async (from: string, to: string) => {
        if (from === to) return 1;
        if (from === 'USD' && to === 'THB') return 33;
        if (from === 'THB' && to === 'USD') return 1 / 33;
        throw new Error(`unexpected fiat pair ${from}->${to}`);
      },
    };

    it('48. "1 btc = thb" (the exact reported failure) resolves crypto -> fiat, never AI', async () => {
      const fetchImpl = fetchThrowing('AI must not be called for a crypto request');
      const result = await resolveConversion(
        { text: '1 btc = thb' },
        env,
        { fetchImpl, currencyRateProvider: fiatProvider, cryptoPriceProvider: cryptoProvider },
      );
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({
        success: true,
        intent: 'currency_convert',
        assetType: 'mixed',
        from: 'BTC',
        to: 'THB',
        amount: 1,
        result: 65000 * 33,
      });
    });

    it('49. "1 ETH = BTC" resolves crypto -> crypto via a USD cross-rate, never AI', async () => {
      const fetchImpl = fetchThrowing('should not be called');
      const result = await resolveConversion(
        { text: '1 ETH = BTC' },
        env,
        { fetchImpl, currencyRateProvider: fiatProvider, cryptoPriceProvider: cryptoProvider },
      );
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({
        success: true,
        assetType: 'crypto',
        from: 'ETH',
        to: 'BTC',
      });
      expect((result.body as { result: number }).result).toBeCloseTo(3250 / 65000, 10);
    });

    it('50. "1000 THB = BTC" resolves fiat -> crypto, never AI', async () => {
      const fetchImpl = fetchThrowing('should not be called');
      const result = await resolveConversion(
        { text: '1000 THB = BTC' },
        env,
        { fetchImpl, currencyRateProvider: fiatProvider, cryptoPriceProvider: cryptoProvider },
      );
      expect(result.status).toBe(200);
      const body = result.body as { assetType: string; result: number };
      expect(body.assetType).toBe('mixed');
      expect(body.result).toBeCloseTo(1000 / 33 / 65000, 12);
    });

    it('51. natural-language crypto: "1 Bitcoin = THB" and "1 บิทคอยน์ = บาท"', async () => {
      const fetchImpl = fetchThrowing('should not be called');
      for (const text of ['1 Bitcoin = THB', '1 บิทคอยน์ = บาท']) {
        const result = await resolveConversion(
          { text },
          env,
          { fetchImpl, currencyRateProvider: fiatProvider, cryptoPriceProvider: cryptoProvider },
        );
        expect(result.status).toBe(200);
        expect(result.body).toMatchObject({ from: 'BTC', to: 'THB' });
      }
    });

    it('52. natural-language Thai fiat: "100 บาทเป็นดอลลาร์" (the other reported failure), never AI', async () => {
      const fetchImpl = fetchThrowing('AI must not be called for a natural-language Thai fiat request');
      const usdThbProvider = {
        getRate: async (from: string, to: string) => {
          if (from === 'THB' && to === 'USD') return 1 / 33;
          throw new Error('unexpected pair');
        },
      };
      const result = await resolveConversion(
        { text: '100 บาทเป็นดอลลาร์' },
        env,
        { fetchImpl, currencyRateProvider: usdThbProvider, cryptoPriceProvider: cryptoProvider },
      );
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ success: true, assetType: 'fiat', from: 'THB', to: 'USD' });
    });

    it('53. an unavailable crypto price provider returns a controlled CURRENCY_UNAVAILABLE error, never a fabricated price', async () => {
      const fetchImpl = fetchThrowing('should not be called');
      const failingCryptoProvider = {
        getUsdPrice: async () => {
          throw new Error('price feed down');
        },
        getUsdPrices: async () => {
          throw new Error('price feed down');
        },
      };
      const result = await resolveConversion(
        { text: '1 BTC = THB' },
        env,
        { fetchImpl, currencyRateProvider: fiatProvider, cryptoPriceProvider: failingCryptoProvider },
      );
      expect(result.status).toBe(502);
      expect(result.body).toMatchObject({ success: false, error: { code: 'CURRENCY_UNAVAILABLE' } });
    });

    it('54. an unrecognized asset returns a friendly UNKNOWN_MONEY_ASSET error, not "Unknown unit"', async () => {
      const fetchImpl = fetchThrowing('should not be called');
      const result = await resolveConversion({ text: '1 abc = thb' }, env, { fetchImpl });
      expect(result.status).toBe(422);
      expect(result.body).toMatchObject({
        success: false,
        error: { code: 'UNKNOWN_MONEY_ASSET', message: 'Unknown currency or asset: "abc".' },
      });
    });

    it('55. "100 kg = USD" is NOT misreported as an unknown asset - it still reaches the normal pipeline', async () => {
      const fetchImpl = fetchReturning(
        geminiOk({ intent: 'convert', language: 'en', items: [{ value: 100, unit: 'kilogram' }], target_unit: 'us_dollar' }),
      );
      const result = await resolveConversion({ text: '100 kg = USD' }, env, { fetchImpl });
      // Whatever AI does with this nonsensical request, it must not be
      // reported as an "unknown money asset" for the perfectly valid "kg".
      expect(result.body).not.toMatchObject({ error: { code: 'UNKNOWN_MONEY_ASSET' } });
    });
  });
});
