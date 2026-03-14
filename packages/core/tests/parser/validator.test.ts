import { describe, it, expect } from 'vitest';
import { validateComposeDocument } from '../../src/parser/validator.js';

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('validateComposeDocument — valid documents', () => {
  it('accepts a minimal compose with only a services key', () => {
    const result = validateComposeDocument({ services: { web: { image: 'nginx' } } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warnings).toHaveLength(0);
    expect(result.value.document.services?.['web']?.image).toBe('nginx');
  });

  it('accepts an empty services map', () => {
    const result = validateComposeDocument({ services: {} });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warnings).toHaveLength(0);
  });

  it('accepts a document with no keys at all', () => {
    const result = validateComposeDocument({});
    expect(result.ok).toBe(true);
  });

  it('accepts a full valid compose with all known top-level keys', () => {
    const doc = {
      version: '3.9',
      services: {
        api: {
          build: './api',
          ports: ['3000:3000'],
          depends_on: ['db'],
          environment: { NODE_ENV: 'production' },
          networks: ['backend'],
        },
        db: {
          image: 'postgres:15',
          volumes: ['db_data:/var/lib/postgresql/data'],
          networks: ['backend'],
        },
      },
      networks: { backend: null },
      volumes: { db_data: null },
    };
    const result = validateComposeDocument(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warnings).toHaveLength(0);
  });

  it('accepts services with all fields optional — no required fields on service', () => {
    // A service with no fields at all is valid (schema makes everything optional)
    const result = validateComposeDocument({ services: { bare: {} } });
    expect(result.ok).toBe(true);
  });

  it('accepts configs and secrets top-level keys', () => {
    const result = validateComposeDocument({
      services: {},
      configs: { my_config: {} },
      secrets: { my_secret: {} },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warnings).toHaveLength(0);
  });

  it('passes the sourceFile through to the document on success', () => {
    const result = validateComposeDocument(
      { services: {} },
      { sourceFile: 'docker-compose.yml' },
    );
    expect(result.ok).toBe(true);
  });
});

// ─── Invalid documents ────────────────────────────────────────────────────────

describe('validateComposeDocument — invalid documents', () => {
  it('rejects when services is a non-object value (array)', () => {
    // The schema expects services to be a record; passing an array should fail
    const result = validateComposeDocument({ services: ['web', 'db'] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('E003');
    expect(result.error.message).toMatch(/Schema validation failed/);
  });

  it('rejects when services is a string', () => {
    const result = validateComposeDocument({ services: 'web' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('E003');
  });

  it('includes sourceFile in the error diagnostic when provided', () => {
    const result = validateComposeDocument(
      { services: 'invalid' },
      { sourceFile: 'docker-compose.yml' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.file).toBe('docker-compose.yml');
  });

  it('includes a help field in the error diagnostic', () => {
    const result = validateComposeDocument({ services: 42 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.help).toBeDefined();
    expect(typeof result.error.help).toBe('string');
  });
});

// ─── Unknown top-level keys ───────────────────────────────────────────────────

describe('validateComposeDocument — unknown top-level keys', () => {
  it('passes with a W002 warning for an unknown top-level key in default mode', () => {
    const result = validateComposeDocument({ services: {}, x_custom: 'value' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warnings).toHaveLength(1);
    expect(result.value.warnings[0]?.code).toBe('W002');
    expect(result.value.warnings[0]?.message).toMatch(/x_custom/);
  });

  it('emits one warning per unknown key', () => {
    const result = validateComposeDocument({
      services: {},
      x_first: 1,
      x_second: 2,
      x_third: 3,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warnings).toHaveLength(3);
  });

  it('includes sourceFile in W002 warning when provided', () => {
    const result = validateComposeDocument(
      { services: {}, x_extra: true },
      { sourceFile: 'compose.yml' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warnings[0]?.file).toBe('compose.yml');
  });

  it('promotes unknown top-level keys to E003 fatal error in strict mode', () => {
    const result = validateComposeDocument(
      { services: {}, x_custom: 'value' },
      { strict: true },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('E003');
    expect(result.error.message).toMatch(/not allowed in strict mode/);
  });

  it('accepts known keys without warnings: version, services, networks, volumes, configs, secrets', () => {
    const result = validateComposeDocument({
      version: '3.9',
      services: {},
      networks: {},
      volumes: {},
      configs: {},
      secrets: {},
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warnings).toHaveLength(0);
  });
});
