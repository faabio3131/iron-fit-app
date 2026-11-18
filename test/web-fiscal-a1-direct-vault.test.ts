import { readFile } from 'node:fs/promises';
import {
  uploadIronA1Direct, validatedIronA1Grant,
} from '../src/web/fiscal-a1-direct-upload';

const grant = {
  status: 'PENDING_UPLOAD' as const,
  delegationToken: 'a'.repeat(64),
  uploadUrl: 'https://nfcore.com.br/v1/iron/a1/upload',
  expiresAt: new Date(Date.now() + 4 * 60_000).toISOString(),
  credentialCustody: 'NFCORE_DIRECT_VAULT' as const,
  officialHomologation: 'NOT_VERIFIED' as const,
};
const file = { size: 8, arrayBuffer: async () => new TextEncoder().encode('fake-pfx').buffer };

test('P6 A1 upload goes directly to NFCore with no credentials/cookies, redirects or reference leak', async () => {
  const transport = jest.fn(async () => ({
    ok: true,
    json: async () => ({ status: 'STORED', expires_at: new Date().toISOString(),
      official_homologation: 'NOT_VERIFIED' }),
  })) as unknown as typeof fetch;
  expect(await uploadIronA1Direct(grant, file, 'synthetic-pfx-password', transport))
    .toBe('STORED');
  expect(transport).toHaveBeenCalledTimes(1);
  const [url, options] = (transport as jest.Mock).mock.calls[0];
  expect(url).toBe('https://nfcore.com.br/v1/iron/a1/upload');
  expect(options.method).toBe('POST');
  expect(options.credentials).toBe('omit');
  expect(options.redirect).toBe('error');
  expect(options.cache).toBe('no-store');
  expect(options.referrerPolicy).toBe('no-referrer');
  expect(options.headers).toEqual({ 'content-type': 'application/json' });
  const body = JSON.parse(options.body);
  expect(body.delegation_token).toBe(grant.delegationToken);
  expect(body.password).toBe('synthetic-pfx-password');
  expect(body.pfx_base64).toBe('ZmFrZS1wZng=');
  expect(JSON.stringify(options)).not.toMatch(/authorization|cookie|tenantId|gymId/i);
});

test('P6 forged URL, forged Cakto-like hostname, wrong status, stale grant and userinfo fail closed', async () => {
  const invalid = [
    { ...grant, uploadUrl: 'http://nfcore.com.br/v1/iron/a1/upload' },
    { ...grant, uploadUrl: 'https://nfcore.com.br.evil.example/upload' },
    { ...grant, uploadUrl: 'https://nfcore.com.br/v1/iron/a1/upload?token=a' },
    { ...grant, uploadUrl: 'https://user:pwd@nfcore.com.br/v1/iron/a1/upload' },
    { ...grant, uploadUrl: 'https://nfcore.com.br/v1/iron/a1/upload#secret' },
    { ...grant, expiresAt: new Date(Date.now() - 30_000).toISOString() },
    { ...grant, status: 'PAID' },
    { ...grant, credentialCustody: 'IRON_BACKEND' },
    { ...grant, officialHomologation: 'PRODUCTION_HOMOLOGATED' },
  ];
  for (const value of invalid) expect(validatedIronA1Grant(value)).toBeNull();
  const transport = jest.fn() as unknown as typeof fetch;
  for (const value of invalid) {
    await expect(uploadIronA1Direct(value as typeof grant, file, 'password', transport))
      .rejects.toThrow();
  }
  expect(transport).not.toHaveBeenCalled();
});

test('P6 oversized A1 never reaches network, NFCore conflict/failed response never claims success', async () => {
  const transport = jest.fn(async () => ({
    ok: false, status: 409, json: async () => ({ code: 'IRON_A1_DELEGATION_INVALID' }),
  })) as unknown as typeof fetch;
  await expect(uploadIronA1Direct(grant, { ...file, size: 2_000_001 }, 'pwd', transport))
    .rejects.toThrow();
  expect(transport).not.toHaveBeenCalled();
  await expect(uploadIronA1Direct(grant, file, 'pwd', transport)).rejects.toThrow();
  expect(transport).toHaveBeenCalledTimes(1);
  const forged = jest.fn(async () => ({ ok: true, json: async () => ({
    status: 'STORED', official_homologation: 'PRODUCTION_HOMOLOGATED',
  }) })) as unknown as typeof fetch;
  await expect(uploadIronA1Direct(grant, file, 'pwd', forged)).rejects.toThrow();
});

test('P6 direct uploader does not require DOM or expose certificate via IRON API', async () => {
  const source = await readFile(
    'src/web/FiscalCenter.tsx', 'utf8',
  );
  const boundary = await readFile(
    'src/web/CommercialWebApp.tsx', 'utf8',
  );
  expect(boundary).toContain("<FiscalCenter canManageA1={can('OWNER')} />");
  expect(source).toContain("if (!canManageA1 || Platform.OS !== 'web'");
  expect(source).toContain("api('/financial/fiscal/a1/delegation'");
  expect(source).toContain("uploadIronA1Direct(grant, a1File, a1Password)");
  expect(source).toContain("api('/financial/fiscal/a1/status')");
  expect(source).toContain('secureTextEntry');
  expect(source).not.toMatch(/api\('\/financial\/fiscal\/a1\/upload/);
  expect(source).not.toMatch(/localStorage.*a1|sessionStorage.*a1/i);
});
