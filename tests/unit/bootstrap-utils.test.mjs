import test from "node:test";
import assert from "node:assert/strict";

function withEnv(overrides, fn) {
  const originals = {};
  for (const [key, value] of Object.entries(overrides)) {
    originals[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of Object.entries(originals)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

test("deriveBootstrapToken reads current environment each time", async () => {
  const { deriveBootstrapToken } = await import("../../src/shared/utils/bootstrap.ts");

  await withEnv({ API_KEY_SECRET: "alpha-secret", JWT_SECRET: undefined }, async () => {
    const first = deriveBootstrapToken();
    assert.ok(first, "expected token for API_KEY_SECRET");

    process.env.API_KEY_SECRET = "beta-secret";
    const second = deriveBootstrapToken();
    assert.ok(second, "expected token after env change");
    assert.notStrictEqual(first, second, "token should reflect updated environment");
  });
});

test("deriveBootstrapToken falls back to JWT_SECRET and returns null with no secret", async () => {
  const { deriveBootstrapToken } = await import("../../src/shared/utils/bootstrap.ts");

  await withEnv({ API_KEY_SECRET: undefined, JWT_SECRET: "jwt-secret-value" }, async () => {
    assert.ok(deriveBootstrapToken(), "expected token when only JWT_SECRET is set");
  });

  await withEnv({ API_KEY_SECRET: undefined, JWT_SECRET: undefined }, async () => {
    assert.equal(deriveBootstrapToken(), null);
  });
});

test("isPublicBootstrapScriptPath only exposes tokenized bootstrap script routes", async () => {
  const { isPublicBootstrapScriptPath } = await import("../../src/shared/utils/bootstrap.ts");

  assert.equal(isPublicBootstrapScriptPath("/api/bootstrap/abcd1234"), true);
  assert.equal(isPublicBootstrapScriptPath("/api/bootstrap/url"), false);
  assert.equal(isPublicBootstrapScriptPath("/api/bootstrap/"), false);
  assert.equal(isPublicBootstrapScriptPath("/api/bootstrap/abcd1234/extra"), false);
});

test("getBootstrapBaseUrl normalizes forwarded headers", async () => {
  const { getBootstrapBaseUrl } = await import("../../src/shared/utils/bootstrap.ts");

  const request = {
    headers: new Headers({
      "x-forwarded-host": "proxy.example.com, internal.example.com",
      "x-forwarded-proto": "HTTPS, http",
      host: "ignored.example.com",
    }),
  };

  assert.equal(getBootstrapBaseUrl(request), "https://proxy.example.com");
});

test("quoteShellValue prevents command substitution in shell output", async () => {
  const { quoteShellValue } = await import("../../src/shared/utils/bootstrap.ts");

  assert.equal(
    quoteShellValue("https://example.com/$(touch /tmp/pwned)`id`"),
    "'https://example.com/$(touch /tmp/pwned)`id`'"
  );
  assert.equal(quoteShellValue("contains'single-quote"), `'contains'"'"'single-quote'`);
});
