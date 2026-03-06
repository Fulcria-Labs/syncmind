import express from 'express';
import { SignJWT, importJWK, exportJWK, generateKeyPair } from 'jose';

const router = express.Router();

let keys = { privateKey: null, publicKey: null, publicJWK: null };

async function ensureKeys() {
  if (keys.privateKey) return;

  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const publicJWK = await exportJWK(publicKey);
  publicJWK.alg = 'RS256';
  publicJWK.kid = 'syncmind-dev-key';

  keys = {
    privateKey,
    publicKey,
    publicJWK
  };
}

router.get('/token', async (req, res) => {
  const { user_id = 'default-user' } = req.query;
  await ensureKeys();

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'syncmind-dev-key' })
    .setSubject(String(user_id))
    .setIssuedAt()
    .setIssuer('powersync-dev')
    .setAudience('powersync-dev')
    .setExpirationTime('55m')
    .sign(keys.privateKey);

  res.json({ token, powersync_url: process.env.POWERSYNC_URL || 'http://localhost:8089' });
});

router.get('/keys', async (req, res) => {
  await ensureKeys();
  res.json({ keys: [keys.publicJWK] });
});

export { router as authRouter };
