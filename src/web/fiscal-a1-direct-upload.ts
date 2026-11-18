/**
 * Direct browser→NFCore A1 Vault transport, without touching IRON's API with
 * private PKCS#12 material. This function is deliberately Web-only.
 *
 * The browser does not persist certificate bytes, password or delegation.
 * The NFCore is the authority for CNPJ, host+tenant+unit and token replay.
 */
export type IronA1Grant = {
  status: 'PENDING_UPLOAD';
  delegationToken: string;
  uploadUrl: string;
  expiresAt: string;
  credentialCustody: 'NFCORE_DIRECT_VAULT';
  officialHomologation: 'NOT_VERIFIED';
};

const TOKEN = /^[A-Za-z0-9_-]{40,128}$/;
const MAX_PFX = 2_000_000;

export function validatedIronA1Grant(value: unknown): IronA1Grant | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (
    v.status !== 'PENDING_UPLOAD' ||
    v.credentialCustody !== 'NFCORE_DIRECT_VAULT' ||
    v.officialHomologation !== 'NOT_VERIFIED' ||
    typeof v.delegationToken !== 'string' || !TOKEN.test(v.delegationToken) ||
    typeof v.expiresAt !== 'string'
  ) return null;
  const expires = Date.parse(v.expiresAt);
  if (!Number.isFinite(expires) || expires <= Date.now() || expires > Date.now() + 330_000) {
    return null;
  }
  if (typeof v.uploadUrl !== 'string') return null;
  let u: URL;
  try { u = new URL(v.uploadUrl); } catch { return null; }
  // Only the official NFCore domain (including its subdomains) may handle PFX.
  if (u.hostname !== 'nfcore.com.br' && !u.hostname.endsWith('.nfcore.com.br')) return null;
  if (u.protocol !== 'https:' || !u.hostname || u.username || u.password ||
      u.pathname !== '/v1/iron/a1/upload' || u.hash || u.search ||
      (u.port && u.port !== '443')) return null;
  return v as IronA1Grant;
}

export async function uploadIronA1Direct(
  grant: IronA1Grant,
  file: { size: number; arrayBuffer: () => Promise<ArrayBuffer> },
  password: string,
  transport: typeof fetch = fetch,
): Promise<'STORED'> {
  const verified = validatedIronA1Grant(grant);
  if (!verified) throw new Error('Delegação A1 inválida ou expirada.');
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_PFX) {
    throw new Error('Selecione um arquivo A1 .pfx/.p12 de até 2 MB.');
  }
  const encodedPassword = new TextEncoder().encode(password);
  if (!encodedPassword.length || encodedPassword.length > 512) {
    throw new Error('Informe uma senha válida para o certificado A1.');
  }
  const raw = new Uint8Array(await file.arrayBuffer());
  if (raw.byteLength !== file.size || raw.length > MAX_PFX) {
    raw.fill(0);
    throw new Error('O arquivo A1 não pôde ser lido integralmente.');
  }
  // Convert in bounded chunks, avoiding spread(...) stack overflow.
  const pieces: string[] = [];
  for (let i = 0; i < raw.length; i += 8192) {
    pieces.push(String.fromCharCode(...raw.subarray(i, i + 8192)));
  }
  const encodedFile = btoa(pieces.join(''));
  pieces.length = 0;
  raw.fill(0);
  encodedPassword.fill(0);

  let response: Response;
  try {
    response = await transport(verified.uploadUrl, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        delegation_token: verified.delegationToken,
        pfx_base64: encodedFile,
        password,
      }),
    });
  } catch {
    throw new Error('Não foi possível acessar o cofre fiscal NFCore. Solicite nova delegação.');
  }
  if (!response.ok) {
    throw new Error('NFCore não confirmou o cadastro A1. Solicite nova delegação.');
  }
  let body: unknown;
  try { body = await response.json(); } catch {
    throw new Error('NFCore retornou uma resposta A1 inválida.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      (body as Record<string, unknown>).status !== 'STORED' ||
      (body as Record<string, unknown>).official_homologation !== 'NOT_VERIFIED') {
    throw new Error('O cofre não confirmou a persistência do A1.');
  }
  return 'STORED';
}
