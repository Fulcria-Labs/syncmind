import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT, importJWK, jwtVerify, generateKeyPair, exportJWK } from 'jose';

describe('Auth Token Generation', () => {
  let privateKey, publicKey, publicJWK;

  beforeAll(async () => {
    const keypair = await generateKeyPair('RS256');
    privateKey = keypair.privateKey;
    publicKey = keypair.publicKey;
    publicJWK = await exportJWK(publicKey);
    publicJWK.alg = 'RS256';
    publicJWK.kid = 'syncmind-dev-key';
  });

  it('should generate a valid JWT token', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('test-user')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    expect(token).toBeTruthy();
    expect(token.split('.')).toHaveLength(3);
  });

  it('should verify token with matching public key', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('user-123')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    const { payload } = await jwtVerify(token, publicKey, {
      issuer: 'powersync-dev',
      audience: 'powersync-dev',
    });

    expect(payload.sub).toBe('user-123');
    expect(payload.iss).toBe('powersync-dev');
    expect(payload.aud).toBe('powersync-dev');
  });

  it('should set correct expiration (55 minutes)', async () => {
    const beforeSign = Math.floor(Date.now() / 1000);

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('test-user')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    const { payload } = await jwtVerify(token, publicKey, {
      issuer: 'powersync-dev',
      audience: 'powersync-dev',
    });

    const expectedExp = beforeSign + 55 * 60;
    expect(payload.exp).toBeGreaterThanOrEqual(expectedExp - 2);
    expect(payload.exp).toBeLessThanOrEqual(expectedExp + 2);
  });

  it('should export valid JWK format', async () => {
    expect(publicJWK.alg).toBe('RS256');
    expect(publicJWK.kid).toBe('syncmind-dev-key');
    expect(publicJWK.kty).toBe('RSA');
    expect(publicJWK.n).toBeTruthy();
    expect(publicJWK.e).toBeTruthy();
  });

  it('should handle different user IDs', async () => {
    const users = ['user-1', 'user-2', 'admin', 'default-user'];

    for (const userId of users) {
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
        .setSubject(userId)
        .setIssuedAt()
        .setIssuer('powersync-dev')
        .setAudience('powersync-dev')
        .setExpirationTime('55m')
        .sign(privateKey);

      const { payload } = await jwtVerify(token, publicKey, {
        issuer: 'powersync-dev',
        audience: 'powersync-dev',
      });

      expect(payload.sub).toBe(userId);
    }
  });
});
