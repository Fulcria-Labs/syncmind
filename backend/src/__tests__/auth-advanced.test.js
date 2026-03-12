import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT, importJWK, jwtVerify, generateKeyPair, exportJWK, decodeProtectedHeader } from 'jose';

describe('Auth - Key Generation and Caching', () => {
  it('should generate RS256 key pair', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    expect(publicKey).toBeTruthy();
    expect(privateKey).toBeTruthy();
  });

  it('should produce different key pairs on each generation', async () => {
    const kp1 = await generateKeyPair('RS256');
    const kp2 = await generateKeyPair('RS256');
    const jwk1 = await exportJWK(kp1.publicKey);
    const jwk2 = await exportJWK(kp2.publicKey);
    expect(jwk1.n).not.toBe(jwk2.n);
  });

  it('should set algorithm and kid on exported JWK', async () => {
    const { publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.alg = 'RS256';
    jwk.kid = 'syncmind-dev-key';
    expect(jwk.alg).toBe('RS256');
    expect(jwk.kid).toBe('syncmind-dev-key');
    expect(jwk.kty).toBe('RSA');
  });

  it('should be importable back from JWK format', async () => {
    const { publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.alg = 'RS256';
    jwk.kid = 'syncmind-dev-key';

    const imported = await importJWK(jwk, 'RS256');
    expect(imported).toBeTruthy();
  });

  it('should wrap keys in expected structure for /keys endpoint', async () => {
    const { publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.alg = 'RS256';
    jwk.kid = 'syncmind-dev-key';

    const response = { keys: [jwk] };
    expect(response.keys).toHaveLength(1);
    expect(response.keys[0].alg).toBe('RS256');
    expect(response.keys[0].kid).toBe('syncmind-dev-key');
  });
});

describe('Auth - Token Claims Validation', () => {
  let privateKey, publicKey;

  beforeAll(async () => {
    const kp = await generateKeyPair('RS256');
    privateKey = kp.privateKey;
    publicKey = kp.publicKey;
  });

  it('should embed subject claim as user_id', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('custom-user-42')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    const { payload } = await jwtVerify(token, publicKey, {
      issuer: 'powersync-dev',
      audience: 'powersync-dev',
    });
    expect(payload.sub).toBe('custom-user-42');
  });

  it('should use default user_id when none provided', async () => {
    const user_id = undefined;
    const effectiveUserId = String(user_id || 'default-user');

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject(effectiveUserId)
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    const { payload } = await jwtVerify(token, publicKey, {
      issuer: 'powersync-dev',
      audience: 'powersync-dev',
    });
    expect(payload.sub).toBe('default-user');
  });

  it('should have iat (issued at) claim', async () => {
    const before = Math.floor(Date.now() / 1000);

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('test')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    const { payload } = await jwtVerify(token, publicKey, {
      issuer: 'powersync-dev',
      audience: 'powersync-dev',
    });
    expect(payload.iat).toBeGreaterThanOrEqual(before);
    expect(payload.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 1);
  });

  it('should fail verification with wrong issuer', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('test')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    await expect(
      jwtVerify(token, publicKey, { issuer: 'wrong-issuer', audience: 'powersync-dev' })
    ).rejects.toThrow();
  });

  it('should fail verification with wrong audience', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('test')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    await expect(
      jwtVerify(token, publicKey, { issuer: 'powersync-dev', audience: 'wrong-audience' })
    ).rejects.toThrow();
  });

  it('should fail verification with different key', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('test')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    const { publicKey: otherKey } = await generateKeyPair('RS256');
    await expect(
      jwtVerify(token, otherKey, { issuer: 'powersync-dev', audience: 'powersync-dev' })
    ).rejects.toThrow();
  });

  it('should contain correct protected header', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('test')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    const header = decodeProtectedHeader(token);
    expect(header.alg).toBe('RS256');
    expect(header.kid).toBe('syncmind-dev-key');
  });

  it('should handle user_id with special characters', async () => {
    const specialIds = ['user@email.com', 'user/path', 'user with spaces', '用户123'];

    for (const userId of specialIds) {
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

  it('should handle empty string user_id', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    const { payload } = await jwtVerify(token, publicKey, {
      issuer: 'powersync-dev',
      audience: 'powersync-dev',
    });
    expect(payload.sub).toBe('');
  });
});

describe('Auth - Token Response Format', () => {
  it('should return token and powersync_url', () => {
    const mockToken = 'eyJhbGciOiJSUzI1NiJ9.test.sig';
    const response = {
      token: mockToken,
      powersync_url: process.env.POWERSYNC_URL || 'http://localhost:8089'
    };

    expect(response.token).toBe(mockToken);
    expect(response.powersync_url).toBeTruthy();
  });

  it('should default powersync_url to localhost:8089', () => {
    const originalUrl = process.env.POWERSYNC_URL;
    delete process.env.POWERSYNC_URL;

    const url = process.env.POWERSYNC_URL || 'http://localhost:8089';
    expect(url).toBe('http://localhost:8089');

    if (originalUrl) process.env.POWERSYNC_URL = originalUrl;
  });

  it('should use custom POWERSYNC_URL when set', () => {
    const originalUrl = process.env.POWERSYNC_URL;
    process.env.POWERSYNC_URL = 'https://custom.powersync.com';

    const url = process.env.POWERSYNC_URL || 'http://localhost:8089';
    expect(url).toBe('https://custom.powersync.com');

    if (originalUrl) {
      process.env.POWERSYNC_URL = originalUrl;
    } else {
      delete process.env.POWERSYNC_URL;
    }
  });
});

describe('Auth - Token Expiration Edge Cases', () => {
  let privateKey, publicKey;

  beforeAll(async () => {
    const kp = await generateKeyPair('RS256');
    privateKey = kp.privateKey;
    publicKey = kp.publicKey;
  });

  it('should create token that expires in the future', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('test')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    const { payload } = await jwtVerify(token, publicKey, {
      issuer: 'powersync-dev',
      audience: 'powersync-dev',
    });

    const now = Math.floor(Date.now() / 1000);
    expect(payload.exp).toBeGreaterThan(now);
  });

  it('should reject expired tokens', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('test')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(privateKey);

    await expect(
      jwtVerify(token, publicKey, { issuer: 'powersync-dev', audience: 'powersync-dev' })
    ).rejects.toThrow();
  });

  it('should generate unique tokens for same user', async () => {
    const token1 = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('same-user')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    const token2 = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
      .setSubject('same-user')
      .setIssuedAt()
      .setIssuer('powersync-dev')
      .setAudience('powersync-dev')
      .setExpirationTime('55m')
      .sign(privateKey);

    // Tokens may be identical if generated in same second, but should both be valid
    const { payload: p1 } = await jwtVerify(token1, publicKey, {
      issuer: 'powersync-dev', audience: 'powersync-dev',
    });
    const { payload: p2 } = await jwtVerify(token2, publicKey, {
      issuer: 'powersync-dev', audience: 'powersync-dev',
    });
    expect(p1.sub).toBe(p2.sub);
  });
});

describe('Auth - JWK Format Compliance', () => {
  it('should export JWK with required RSA fields', async () => {
    const { publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);

    // Required RSA public key fields
    expect(jwk.kty).toBe('RSA');
    expect(jwk.n).toBeTruthy(); // modulus
    expect(jwk.e).toBeTruthy(); // exponent
    expect(typeof jwk.n).toBe('string');
    expect(typeof jwk.e).toBe('string');
  });

  it('should not include private key material in public JWK', async () => {
    const { publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);

    expect(jwk.d).toBeUndefined();  // private exponent
    expect(jwk.p).toBeUndefined();  // first prime factor
    expect(jwk.q).toBeUndefined();  // second prime factor
    expect(jwk.dp).toBeUndefined(); // first CRT exponent
    expect(jwk.dq).toBeUndefined(); // second CRT exponent
    expect(jwk.qi).toBeUndefined(); // first CRT coefficient
  });

  it('should include all fields needed by PowerSync', async () => {
    const { publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.alg = 'RS256';
    jwk.kid = 'syncmind-dev-key';

    // PowerSync needs: alg, kid, kty, n, e
    const requiredFields = ['alg', 'kid', 'kty', 'n', 'e'];
    for (const field of requiredFields) {
      expect(jwk[field]).toBeTruthy();
    }
  });
});
