import { PROJECT_SCHEMA_VERSION } from '@/core/project/constants'
import type { StudioProject } from '@/types/project'

export class UnsupportedProjectSchemaError extends Error {
  constructor(public readonly schemaVersion: number) {
    super(`Project schema ${schemaVersion} is not supported by this Addons Studio version.`)
    this.name = 'UnsupportedProjectSchemaError'
  }
}

export function assertSupportedProjectSchema(project: StudioProject): void {
  if (project.schemaVersion > PROJECT_SCHEMA_VERSION) {
    throw new UnsupportedProjectSchemaError(project.schemaVersion)
  }
}
