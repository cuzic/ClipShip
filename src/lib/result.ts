/**
 * Result 型のユーティリティ
 * neverthrow をラップして使いやすくする
 */

import { Result, ok, err, ResultAsync } from "neverthrow";
import type { DeployError } from "./errors";

// Re-export for convenience
export { ok, err, Result, ResultAsync };

/**
 * デプロイ結果の型
 */
export interface DeploySuccess {
  url: string;
  siteId?: string;
  siteName?: string;
}

/**
 * デプロイ結果の Result 型
 */
export type DeployResult = Result<DeploySuccess, DeployError>;

/**
 * 非同期デプロイ結果の Result 型
 */
export type AsyncDeployResult = ResultAsync<DeploySuccess, DeployError>;

/**
 * Promise を ResultAsync に変換するヘルパー
 */
export function fromPromise<T, E extends Error>(
  promise: Promise<T>,
  errorFn: (e: unknown) => E
): ResultAsync<T, E> {
  return ResultAsync.fromPromise(promise, errorFn);
}

/**
 * 複数の Result を結合
 */
export function combine<T, E>(
  results: Result<T, E>[]
): Result<T[], E> {
  return Result.combine(results);
}
