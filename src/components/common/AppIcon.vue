<script setup lang="ts">
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  AudioLines,
  Blocks,
  BookOpen,
  Box,
  Boxes,
  Braces,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  CircleX,
  Code2,
  CookingPot,
  Copy,
  Database,
  EllipsisVertical,
  ExternalLink,
  FileText,
  FolderKanban,
  Gem,
  House,
  Info,
  Languages,
  Layers3,
  Menu,
  Monitor,
  Moon,
  Package,
  Palette,
  Pencil,
  Plus,
  Rabbit,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Terminal,
  Trash2,
  Upload,
  WifiOff,
  X,
  type LucideIcon,
} from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number
    strokeWidth?: number
    label?: string
  }>(),
  {
    size: 24,
    strokeWidth: 2,
    label: undefined,
  },
)

const icons: Record<string, LucideIcon> = {
  activity: Activity,
  'alert-triangle': AlertTriangle,
  'arrow-left': ArrowLeft,
  'audio-lines': AudioLines,
  blocks: Blocks,
  'book-open': BookOpen,
  box: Box,
  boxes: Boxes,
  braces: Braces,
  check: Check,
  'check-circle': CheckCircle2,
  'chevron-right': ChevronRight,
  'circle-dot': CircleDot,
  'circle-x': CircleX,
  code: Code2,
  'cooking-pot': CookingPot,
  copy: Copy,
  database: Database,
  'more-vertical': EllipsisVertical,
  'external-link': ExternalLink,
  file: FileText,
  folder: FolderKanban,
  gem: Gem,
  github: Code2,
  home: House,
  info: Info,
  languages: Languages,
  layers: Layers3,
  menu: Menu,
  monitor: Monitor,
  moon: Moon,
  package: Package,
  palette: Palette,
  pencil: Pencil,
  plus: Plus,
  rabbit: Rabbit,
  search: Search,
  settings: Settings,
  shield: ShieldCheck,
  sparkles: Sparkles,
  sun: Sun,
  terminal: Terminal,
  trash: Trash2,
  upload: Upload,
  'wifi-off': WifiOff,
  x: X,
}

const icon = icons[props.name] ?? Box
</script>

<template>
  <component
    :is="icon"
    :size="size"
    :stroke-width="strokeWidth"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    focusable="false"
  />
</template>
