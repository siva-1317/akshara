import crypto from "crypto";

const PREFIX = "enc:v1:";

const getKey = () => {
  const secret = process.env.USER_API_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    return null;
  }
  return crypto.createHash("sha256").update(secret, "utf8").digest();
};

export const encryptSecret = (value) => {
  const plaintext = String(value || "");
  if (!plaintext) {
    return null;
  }

  const key = getKey();
  if (!key) {
    return plaintext;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
};

export const decryptSecret = (stored) => {
  const value = stored == null ? "" : String(stored);
  if (!value) {
    return "";
  }

  if (!value.startsWith(PREFIX)) {
    return value;
  }

  const key = getKey();
  if (!key) {
    return "";
  }

  const payload = value.slice(PREFIX.length);
  const [ivB64, tagB64, cipherB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !cipherB64) {
    return "";
  }

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(cipherB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
};

