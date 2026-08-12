export interface FolderValidationIssue {
  field: 'name'
  message: string
}

export function validateProjectFolderName(value: string): FolderValidationIssue[] {
  const name = value.trim()
  if (!name) return [{ field: 'name', message: 'Folder name is required.' }]
  if (name.length > 60) {
    return [{ field: 'name', message: 'Folder name must be 60 characters or fewer.' }]
  }
  return []
}
