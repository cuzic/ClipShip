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
 * プロジェクト/サイトから ID を抽出
 */
function extractProjectId<T>(project: T): string | undefined {
  return (project as { id?: string }).id || (project as { name?: string }).name;
}

/**
 * プロジェクト/サイトを取得または作成する共通ロジック
 */
export function getOrCreateProject<T>(
  manager: ProjectManager<T>,
): ResultAsync<T, DeployError> {
  return ResultAsync.fromSafePromise(manager.getFromStorage()).andThen(
    (storedId) => {
      if (storedId) {
        // 1. storage から取得を試みる
        return manager
          .getById(storedId)
          .orElse(() => findOrCreateProject(manager));
      }
      return findOrCreateProject(manager);
    },
  );
}

/**
 * 既存プロジェクトを検索、なければ新規作成
 */
function findOrCreateProject<T>(
  manager: ProjectManager<T>,
): ResultAsync<T, DeployError> {
  return manager.findExisting().andThen((existing) => {
    if (existing) {
      // 既存プロジェクトが見つかった
      const id = extractProjectId(existing);
      if (id) {
        return ResultAsync.fromSafePromise(
          manager.saveToStorage(id).then(() => existing),
        );
      }
      return ResultAsync.fromSafePromise(Promise.resolve(existing));
    }
    // 新規作成
    return manager.create().andThen((project) => {
      const id = extractProjectId(project);
      if (id) {
        return ResultAsync.fromSafePromise(
          manager.saveToStorage(id).then(() => project),
        );
      }
      return ResultAsync.fromSafePromise(Promise.resolve(project));
    });
  });
}
