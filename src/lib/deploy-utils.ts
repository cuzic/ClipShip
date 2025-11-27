/**
 * デプロイモジュール共通ユーティリティ
 */

import { HTTPError } from "ky";
import { ResultAsync } from "neverthrow";
import {
  ApiError,
  AuthenticationError,
  type DeployError,
  PermissionError,
  type ServiceName,
} from "./errors";

/**
 * HTTPError を DeployError に変換する共通関数
 */
export function createHttpErrorMapper(service: ServiceName) {
  return function mapHttpError(error: HTTPError): DeployError {
    const status = error.response.status;
    if (status === 401) {
      return AuthenticationError.invalidToken(service);
    }
    if (status === 403) {
      return PermissionError.insufficientScope(`${service} API`);
    }
    return ApiError.fromStatus(status);
  };
}

/**
 * unknown エラーを DeployError に変換する共通関数
 */
export function createUnknownErrorMapper(service: ServiceName) {
  const mapHttpError = createHttpErrorMapper(service);

  return function mapUnknownError(error: unknown): DeployError {
    if (error instanceof HTTPError) {
      return mapHttpError(error);
    }
    if (error instanceof Error) {
      return new ApiError(error.message);
    }
    return new ApiError("Unknown error occurred");
  };
}

/**
 * プロジェクト/サイト管理の共通インターフェース
 */
export interface ProjectManager<T> {
  getFromStorage(): Promise<string | undefined>;
  saveToStorage(id: string): Promise<void>;
  getById(id: string): ResultAsync<T, DeployError>;
  findExisting(): ResultAsync<T | null, DeployError>;
  create(): ResultAsync<T, DeployError>;
}

/**
 * プロジェクト/サイトを取得または作成する共通ロジック
 */
export async function getOrCreateProject<T>(
  manager: ProjectManager<T>,
): Promise<ResultAsync<T, DeployError>> {
  // 1. storage から取得
  const storedId = await manager.getFromStorage();
  if (storedId) {
    const result = await manager.getById(storedId);
    if (result.isOk()) {
      return ResultAsync.fromSafePromise(Promise.resolve(result.value));
    }
    // プロジェクト/サイトが削除されている可能性があるので続行
  }

  // 2. 既存のプロジェクト/サイトを検索
  const existingResult = await manager.findExisting();
  if (existingResult.isOk() && existingResult.value) {
    // ID を保存（サービスによって id か name を使用）
    const project = existingResult.value;
    const id =
      (project as { id?: string }).id || (project as { name?: string }).name;
    if (id) {
      await manager.saveToStorage(id);
    }
    return ResultAsync.fromSafePromise(Promise.resolve(project));
  }

  // 3. 新規作成
  return manager.create().map(async (project) => {
    const id =
      (project as { id?: string }).id || (project as { name?: string }).name;
    if (id) {
      await manager.saveToStorage(id);
    }
    return project;
  });
}

/**
 * ResultAsync のエラーを返す共通ヘルパー
 */
export function rejectWithError<T>(
  error: DeployError,
): ResultAsync<T, DeployError> {
  return ResultAsync.fromPromise(Promise.reject(error), () => error);
}
