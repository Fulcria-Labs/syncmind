import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT, jwtVerify, generateKeyPair, exportJWK, importJWK, decodeProtectedHeader, decodeJwt } from 'jose';

describe('Auth - Token Decode Without Verification', () => {
  let privateKey, publicKey;

  beforeAll(async () => {
    const kp = await generateKeyPair('RS256');
    privateKey = kp.privateKey;
    publicKey = kp.publicKey;
  });

  it('should decode JWT payload without verifying signature', async () => {
    const token = await new SignJWT({ custom: 'data' })
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('decode-test')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    const decoded = decodeJwt(token);
    expect(decoded.sub).toBe('decode-test');
    expect(decoded.iss).toBe('powersync-dev');
    expect(decoded.aud).toBe('powersync-dev');
  });

  it('should decode header to extract algorithm and kid', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('header-test')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    const header = decodeProtectedHeader(token);
    expect(header.alg).toBe('RS256');
    expect(header.kid).toBe('syncmind-dev-key');
    expect(header.typ).toBeUndefined(); // Not explicitly set
  });
});

describe('Auth - JWK Round-Trip', () => {
  it('should export and import public key maintaining fidelity', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.alg = 'RS256';
    jwk.kid = 'syncmind-dev-key';

    const importedKey = await importJWK(jwk, 'RS256');

    // Sign with private, verify with re-imported public
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('roundtrip-test')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    const { payload } = await jwtVerify(token, importedKey, {
      issuer: 'powersync-dev',
      audience: 'powersync-dev',
    });
    expect(payload.sub).toBe('roundtrip-test');
  });

  it('should produce JWK with consistent structure across generations', async () => {
    const kp1 = await generateKeyPair('RS256');
    const kp2 = await generateKeyPair('RS256');
    const jwk1 = await exportJWK(kp1.publicKey);
    const jwk2 = await exportJWK(kp2.publicKey);

    // Same structure, different values
    expect(Object.keys(jwk1).sort()).toEqual(Object.keys(jwk2).sort());
    expect(jwk1.kty).toBe(jwk2.kty);
    expect(jwk1.e).toBe(jwk2.e); // RSA exponent is typically the same (65537)
  });
});

describe('Auth - Token Content Validation', () => {
  let privateKey, publicKey;

  beforeAll(async () => {
    const kp = await generateKeyPair('RS256');
    privateKey = kp.privateKey;
    publicKey = kp.publicKey;
  });

  it('should have three dot-separated parts (header.payload.signature)', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('parts-test')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    const parts = token.split('.');
    expect(parts).toHaveLength(3);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('should produce URL-safe base64 encoded parts', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('base64-test')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    // JWT uses base64url encoding - no +, /, or = characters
    expect(token).not.toMatch(/[+/=]/);
  });

  it('should have exp claim in the future (within 55 min window)', async () => {
    const beforeSign = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('exp-test')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    const { payload } = await jwtVerify(token, publicKey, {
      issuer: 'powersync-dev',
      audience: 'powersync-dev',
    });

    // exp should be between now+54min and now+56min
    const minExp = beforeSign + 54 * 60;
    const maxExp = beforeSign + 56 * 60;
    expect(payload.exp).toBeGreaterThanOrEqual(minExp);
    expect(payload.exp).toBeLessThanOrEqual(maxExp);
  });

  it('should have iat close to current time', async () => {
    const beforeSign = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('iat-test')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    const { payload } = await jwtVerify(token, publicKey, {
      issuer: 'powersync-dev',
      audience: 'powersync-dev',
    });

    expect(payload.iat).toBeGreaterThanOrEqual(beforeSign);
    expect(payload.iat).toBeLessThanOrEqual(beforeSign + 2);
  });
});

describe('Auth - User ID Coercion', () => {
  let privateKey, publicKey;

  beforeAll(async () => {
    const kp = await generateKeyPair('RS256');
    privateKey = kp.privateKey;
    publicKey = kp.publicKey;
  });

  it('should coerce numeric user_id to string', async () => {
    const user_id = 12345;
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject(String(user_id))
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    const { payload } = await jwtVerify(token, publicKey, {
      issuer: 'powersync-dev',
      audience: 'powersync-dev',
    });
    expect(payload.sub).toBe('12345');
  });

  it('should handle undefined user_id defaulting to default-user', () => {
    const user_id = undefined;
    const effectiveId = String(user_id || 'default-user');
    expect(effectiveId).toBe('default-user');
  });

  it('should handle null user_id defaulting to default-user', () => {
    const user_id = null;
    const effectiveId = String(user_id || 'default-user');
    expect(effectiveId).toBe('default-user');
  });

  it('should handle empty string user_id defaulting to default-user', () => {
    const user_id = '';
    const effectiveId = String(user_id || 'default-user');
    expect(effectiveId).toBe('default-user');
  });

  it('should handle boolean user_id via String coercion', () => {
    const user_id = true;
    const effectiveId = String(user_id);
    expect(effectiveId).toBe('true');
  });
});

describe('Auth - Keys Endpoint Response Structure', () => {
  it('should wrap JWK in keys array matching JWKS format', async () => {
    const { publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.alg = 'RS256';
    jwk.kid = 'syncmind-dev-key';

    const response = { keys: [jwk] };

    // JWKS format
    expect(response).toHaveProperty('keys');
    expect(Array.isArray(response.keys)).toBe(true);
    expect(response.keys).toHaveLength(1);
    expect(response.keys[0].alg).toBe('RS256');
    expect(response.keys[0].kid).toBe('syncmind-dev-key');
    expect(response.keys[0].kty).toBe('RSA');
  });

  it('should not expose private key fields in JWKS response', async () => {
    const { publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);

    const privateFields = ['d', 'p', 'q', 'dp', 'dq', 'qi'];
    for (const field of privateFields) {
      expect(jwk).not.toHaveProperty(field);
    }
  });
});
