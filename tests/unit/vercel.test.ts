/**
 * Vercel スキーマのテスト
 */
import { describe, expect, test } from "bun:test";
import { VercelDeploymentSchema, VercelProjectSchema } from "@/schemas/vercel";

describe("VercelProjectSchema", () => {
  test("有効な Vercel プロジェクトレスポンスをパース", () => {
    const response = {
      id: "prj_123abc",
      name: "pastehost-xyz789",
      accountId: "acc_456def",
      link: {
        type: "github",
      },
    };

    const result = VercelProjectSchema.parse(response);
    expect(result.id).toBe("prj_123abc");
    expect(result.name).toBe("pastehost-xyz789");
    expect(result.accountId).toBe("acc_456def");
  });

  test("最小限のフィールドでパース", () => {
    const response = {
      id: "prj_123",
      name: "my-project",
      accountId: "acc_456",
    };

    const result = VercelProjectSchema.parse(response);
    expect(result.id).toBe("prj_123");
    expect(result.name).toBe("my-project");
    expect(result.link).toBeUndefined();
  });

  test("必須フィールドが欠けているとエラー", () => {
    const response = {
      id: "prj_123",
      // name が欠けている
      accountId: "acc_456",
    };

    expect(() => VercelProjectSchema.parse(response)).toThrow();
  });
});

describe("VercelDeploymentSchema", () => {
  test("有効な Vercel デプロイメントレスポンスをパース", () => {
    const response = {
      id: "dpl_abc123",
      url: "pastehost-xyz789-abc123.vercel.app",
      name: "pastehost-xyz789",
      state: "READY",
      readyState: "READY",
      createdAt: 1699999999999,
    };

    const result = VercelDeploymentSchema.parse(response);
    expect(result.id).toBe("dpl_abc123");
    expect(result.url).toBe("pastehost-xyz789-abc123.vercel.app");
    expect(result.name).toBe("pastehost-xyz789");
    expect(result.state).toBe("READY");
  });

  test("最小限のフィールドでパース", () => {
    const response = {
      id: "dpl_123",
      url: "example.vercel.app",
      name: "my-deploy",
    };

    const result = VercelDeploymentSchema.parse(response);
    expect(result.id).toBe("dpl_123");
    expect(result.url).toBe("example.vercel.app");
    expect(result.state).toBeUndefined();
  });

  test("id が欠けているとエラー", () => {
    const response = {
      url: "example.vercel.app",
      name: "my-deploy",
    };

    expect(() => VercelDeploymentSchema.parse(response)).toThrow();
  });
});
