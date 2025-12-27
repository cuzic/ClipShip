/**
 * Cloudflare Pages スキーマのテスト
 */
import { describe, expect, test } from "bun:test";
import {
  CloudflarePagesDeploymentResponseSchema,
  CloudflarePagesProjectListResponseSchema,
  CloudflarePagesProjectResponseSchema,
  CloudflarePagesProjectSchema,
} from "@/schemas/cloudflare";

describe("CloudflarePagesProjectSchema", () => {
  test("有効な Cloudflare Pages プロジェクトをパース", () => {
    const response = {
      id: "proj-123abc",
      name: "pastehost-xyz789",
      subdomain: "pastehost-xyz789",
      domains: ["pastehost-xyz789.pages.dev"],
      created_on: "2024-01-01T00:00:00Z",
      production_branch: "main",
    };

    const result = CloudflarePagesProjectSchema.parse(response);
    expect(result.id).toBe("proj-123abc");
    expect(result.name).toBe("pastehost-xyz789");
    expect(result.subdomain).toBe("pastehost-xyz789");
  });

  test("最小限のフィールドでパース", () => {
    const response = {
      id: "proj-123",
      name: "my-project",
      subdomain: "my-project",
    };

    const result = CloudflarePagesProjectSchema.parse(response);
    expect(result.id).toBe("proj-123");
    expect(result.name).toBe("my-project");
    expect(result.domains).toBeUndefined();
  });

  test("必須フィールドが欠けているとエラー", () => {
    const response = {
      id: "proj-123",
      // name が欠けている
      subdomain: "my-project",
    };

    expect(() => CloudflarePagesProjectSchema.parse(response)).toThrow();
  });
});

describe("CloudflarePagesProjectResponseSchema", () => {
  test("成功レスポンスをパース", () => {
    const response = {
      success: true,
      errors: [],
      messages: [],
      result: {
        id: "proj-123",
        name: "pastehost-xyz",
        subdomain: "pastehost-xyz",
      },
    };

    const result = CloudflarePagesProjectResponseSchema.parse(response);
    expect(result.success).toBe(true);
    expect(result.result.name).toBe("pastehost-xyz");
  });

  test("エラーレスポンスをパース", () => {
    const response = {
      success: false,
      errors: [{ code: 1000, message: "Project not found" }],
      messages: [],
      result: {
        id: "",
        name: "",
        subdomain: "",
      },
    };

    const result = CloudflarePagesProjectResponseSchema.parse(response);
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toBe("Project not found");
  });
});

describe("CloudflarePagesProjectListResponseSchema", () => {
  test("プロジェクト一覧レスポンスをパース", () => {
    const response = {
      success: true,
      errors: [],
      messages: [],
      result: [
        { id: "proj-1", name: "project-1", subdomain: "project-1" },
        { id: "proj-2", name: "project-2", subdomain: "project-2" },
      ],
    };

    const result = CloudflarePagesProjectListResponseSchema.parse(response);
    expect(result.success).toBe(true);
    expect(result.result).toHaveLength(2);
    expect(result.result[0].name).toBe("project-1");
  });

  test("空の一覧をパース", () => {
    const response = {
      success: true,
      errors: [],
      messages: [],
      result: [],
    };

    const result = CloudflarePagesProjectListResponseSchema.parse(response);
    expect(result.result).toHaveLength(0);
  });
});

describe("CloudflarePagesDeploymentResponseSchema", () => {
  test("デプロイメントレスポンスをパース", () => {
    const response = {
      success: true,
      errors: [],
      messages: [],
      result: {
        id: "deploy-123",
        url: "https://abc123.pastehost-xyz.pages.dev",
        environment: "production",
        project_id: "proj-123",
        project_name: "pastehost-xyz",
      },
    };

    const result = CloudflarePagesDeploymentResponseSchema.parse(response);
    expect(result.success).toBe(true);
    expect(result.result.id).toBe("deploy-123");
    expect(result.result.url).toBe("https://abc123.pastehost-xyz.pages.dev");
  });

  test("最小限のデプロイメントレスポンスをパース", () => {
    const response = {
      success: true,
      errors: [],
      messages: [],
      result: {
        id: "deploy-123",
        url: "https://example.pages.dev",
      },
    };

    const result = CloudflarePagesDeploymentResponseSchema.parse(response);
    expect(result.result.id).toBe("deploy-123");
    expect(result.result.environment).toBeUndefined();
  });
});
