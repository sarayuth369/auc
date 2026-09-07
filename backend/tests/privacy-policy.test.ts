import { describe, expect, it } from 'vitest';
import { PRIVACY_POLICY_HTML } from '../src/privacy-policy-html';

describe('PRIVACY_POLICY_HTML', () => {
  it('is a full, well-formed HTML document', () => {
    expect(PRIVACY_POLICY_HTML.trim().startsWith('<!doctype html>')).toBe(true);
    expect(PRIVACY_POLICY_HTML).toContain('<meta charset="utf-8">');
    expect(PRIVACY_POLICY_HTML).toContain(
      'name="viewport" content="width=device-width, initial-scale=1"',
    );
  });

  it('contains the required branding and content', () => {
    expect(PRIVACY_POLICY_HTML).toContain('SmartConverter');
    expect(PRIVACY_POLICY_HTML).toContain('Privacy Policy');
    expect(PRIVACY_POLICY_HTML).toContain('MLABS');
  });

  it('never references the private Claude artifact host', () => {
    expect(PRIVACY_POLICY_HTML).not.toContain('claude.ai');
  });

  it('never contains an API key, secret, or credential value', () => {
    expect(PRIVACY_POLICY_HTML).not.toMatch(/AIzaSy[A-Za-z0-9_-]{10,}/);
    expect(PRIVACY_POLICY_HTML.toLowerCase()).not.toMatch(/api[_-]?key\s*[:=]\s*['"][^'"]+['"]/);
  });
});
