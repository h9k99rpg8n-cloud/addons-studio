export interface BedrockVersionOption {
  value: string
  label: string
  status: 'current' | 'supported' | 'legacy'
}

export const BEDROCK_VERSIONS: readonly BedrockVersionOption[] = [
  { value: '1.26.40', label: 'Bedrock 26.40', status: 'current' },
  { value: '1.26.30', label: 'Bedrock 26.30', status: 'supported' },
  { value: '1.26.20', label: 'Bedrock 26.20', status: 'supported' },
  { value: '1.26.10', label: 'Bedrock 26.10', status: 'supported' },
  { value: '1.26.0', label: 'Bedrock 26.0', status: 'legacy' },
] as const

export const DEFAULT_BEDROCK_VERSION = BEDROCK_VERSIONS[0]!.value

export function isMaintainedBedrockVersion(version: string): boolean {
  return BEDROCK_VERSIONS.some((option) => option.value === version)
}
