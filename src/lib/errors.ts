/**
 * カスタムエラークラス
 * エラーの種別を明確に区別するための型定義
 */

/**
 * 基底エラークラス
 */
export abstract class AppError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * 認証エラー
 * - API トークンが未設定
 * - API トークンが無効
 */
export class AuthenticationError extends AppError {
  readonly code = "AUTHENTICATION_ERROR";

  static tokenNotSet(service: "Netlify" | "GitHub"): AuthenticationError {
    return new AuthenticationError(`${service} Token not set in Options.`);
  }

  static invalidToken(service: "Netlify" | "GitHub"): AuthenticationError {
    return new AuthenticationError(
      `Authentication failed. Check your ${service} token.`,
    );
  }
}

/**
 * 権限エラー
 * - API スコープ不足
 */
export class PermissionError extends AppError {
  readonly code = "PERMISSION_ERROR";

  static insufficientScope(scope: string): PermissionError {
    return new PermissionError(`Permission denied. Check ${scope} scope.`);
  }
}

/**
 * バリデーションエラー
 * - リクエストデータが不正
 * - レスポンスデータが不正
 */
export class ValidationError extends AppError {
  readonly code = "VALIDATION_ERROR";

  static invalidRequest(): ValidationError {
    return new ValidationError("Validation error. Check your request.");
  }

  static invalidResponse(detail?: string): ValidationError {
    return new ValidationError(
      detail ? `Invalid response: ${detail}` : "Invalid response from API.",
    );
  }
}

/**
 * ネットワークエラー
 * - 接続失敗
 * - タイムアウト
 */
export class NetworkError extends AppError {
  readonly code = "NETWORK_ERROR";

  static connectionFailed(): NetworkError {
    return new NetworkError("Network connection failed.");
  }

  static timeout(): NetworkError {
    return new NetworkError("Request timed out.");
  }
}

/**
 * API エラー
 * - サーバーエラー
 * - 予期しないエラー
 */
export class ApiError extends AppError {
  readonly code = "API_ERROR";
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.statusCode = statusCode;
  }

  static fromStatus(statusCode: number, message?: string): ApiError {
    return new ApiError(
      message || `API error (status: ${statusCode})`,
      statusCode,
    );
  }

  static deployFailed(): ApiError {
    return new ApiError("Deploy failed on server.");
  }

  static deployTimeout(): ApiError {
    return new ApiError("Deploy timed out.");
  }
}

/**
 * クリップボードエラー
 */
export class ClipboardError extends AppError {
  readonly code = "CLIPBOARD_ERROR";

  static empty(): ClipboardError {
    return new ClipboardError("Clipboard is empty.");
  }

  static readFailed(): ClipboardError {
    return new ClipboardError("Failed to read clipboard.");
  }
}

/**
 * エラー型のユニオン
 */
export type DeployError =
  | AuthenticationError
  | PermissionError
  | ValidationError
  | NetworkError
  | ApiError
  | ClipboardError;

/**
 * エラーがAppErrorかどうかを判定
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
