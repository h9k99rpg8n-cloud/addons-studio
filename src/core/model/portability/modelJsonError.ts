export type ModelJsonErrorCode =
  | 'malformed-json'
  | 'unrecognized-format'
  | 'invalid-model'
  | 'unsupported-version'

export class ModelJsonError extends Error {
  constructor(
    readonly code: ModelJsonErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ModelJsonError'
  }
}
