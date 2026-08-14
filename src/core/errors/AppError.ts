export type AppErrorCode =
  | 'PROJECT_VALIDATION'
  | 'PROJECT_NOT_FOUND'
  | 'PROJECT_SAVE_FAILED'
  | 'PROJECT_DELETE_FAILED'
  | 'FOLDER_VALIDATION'
  | 'FOLDER_NOT_FOUND'
  | 'FOLDER_SAVE_FAILED'
  | 'MODEL_VALIDATION'
  | 'MODEL_NOT_FOUND'
  | 'MODEL_SAVE_FAILED'
  | 'MODEL_DELETE_FAILED'
  | 'PROJECT_EXPORT_FAILED'
  | 'PROJECT_IMPORT_FAILED'
  | 'REFERENCE_IMAGE_FAILED'
  | 'EDITOR_IMAGE_FAILED'
  | 'STORAGE_FAILED'
  | 'UNKNOWN'

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    public readonly userMessage: string,
    options?: ErrorOptions,
  ) {
    super(userMessage, options)
    this.name = 'AppError'
  }
}

export function toAppError(error: unknown, fallbackMessage: string): AppError {
  if (error instanceof AppError) return error
  return new AppError('UNKNOWN', fallbackMessage, {
    cause: error instanceof Error ? error : undefined,
  })
}
