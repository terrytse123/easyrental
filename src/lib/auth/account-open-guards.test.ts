import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cookieShouldBeSecure,
  rejectGetWithSecretParams,
  resetModeSendsCodeOnly,
  resetModeUpdatesPassword,
  sessionCookieHeader,
} from "./account-open-guards.ts";

describe("reset OTP gates", () => {
  it("reset request only sends code and never updates password alone", () => {
    assert.equal(resetModeSendsCodeOnly("reset"), true);
    assert.equal(resetModeUpdatesPassword("reset"), false);
  });

  it("reset-code is the only mode that may update password_hash after OTP", () => {
    assert.equal(resetModeSendsCodeOnly("reset-code"), false);
    assert.equal(resetModeUpdatesPassword("reset-code"), true);
    assert.equal(resetModeUpdatesPassword("signin"), false);
  });
});

describe("GET must not carry passwords", () => {
  it("rejects GET when password is in the query string", () => {
    const params = new URLSearchParams({ mode: "signin", password: "secret123" });
    assert.equal(rejectGetWithSecretParams("GET", params), true);
  });

  it("allows GET resend with email only", () => {
    const params = new URLSearchParams({ mode: "resend", email: "a@b.com" });
    assert.equal(rejectGetWithSecretParams("GET", params), false);
  });

  it("allows POST with password", () => {
    const params = new URLSearchParams({ password: "secret123" });
    assert.equal(rejectGetWithSecretParams("POST", params), false);
  });

  it("rejects GET password-change when next is present", () => {
    const params = new URLSearchParams({ mode: "password", next: "newpass123" });
    assert.equal(rejectGetWithSecretParams("GET", params), true);
  });
});

describe("Secure session cookie", () => {
  it("is Secure in production", () => {
    assert.equal(cookieShouldBeSecure({ nodeEnv: "production", requestUrl: "http://localhost/" }), true);
  });

  it("is Secure when request is https or x-forwarded-proto=https", () => {
    assert.equal(cookieShouldBeSecure({ nodeEnv: "development", requestUrl: "https://example.com/" }), true);
    assert.equal(
      cookieShouldBeSecure({
        nodeEnv: "development",
        requestUrl: "http://example.com/",
        forwardedProto: "https",
      }),
      true,
    );
  });

  it("omits Secure on plain http in development", () => {
    assert.equal(cookieShouldBeSecure({ nodeEnv: "development", requestUrl: "http://localhost:8080/" }), false);
    const header = sessionCookieHeader("abc", false);
    assert.match(header, /HttpOnly/);
    assert.doesNotMatch(header, /Secure/);
    assert.match(sessionCookieHeader("abc", true), /Secure/);
  });
});
