import {
  Archive,
  ArchiveX,
  AppWindow,
  ArrowDown,
  Bell,
  Bot,
  BotOff,
  Building2,
  CalendarClock,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  CirclePlus,
  CircleX,
  Clock,
  CloudOff,
  Compass,
  EllipsisVertical,
  Eye,
  EyeOff,
  File,
  FileText,
  Globe,
  Hash,
  Heart,
  Image,
  Inbox,
  Info,
  Layers2,
  ListFilter,
  Lock,
  Mail,
  MailOpen,
  MapPin,
  MessageCircle,
  MessageCircleMore,
  MessageSquareMore,
  MessageSquareText,
  MessagesSquare,
  Moon,
  Music,
  Paperclip,
  Pencil,
  Phone,
  RefreshCw,
  Reply,
  Save,
  SaveOff,
  Search,
  SendHorizontal,
  Settings,
  Square,
  SquareCheck,
  SquarePen,
  Star,
  StarOff,
  Sun,
  Tag,
  Trash2,
  TriangleAlert,
  Type,
  User,
  UserCheck,
  UserLock,
  UserMinus,
  UserPlus,
  UserRoundX,
  Users,
  UsersRound,
  Video,
  Webhook,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { I18nManager } from 'react-native';

/**
 * Semantic icon registry — one lucide component per key. Keys mirror lucide's own kebab-case
 * names (`bot`, `archive-x`, `user-lock`…) so this file and the web app's `lucide-react` icon
 * usages are 1:1 greppable, with no second alias layer to keep in sync. Only registered icons are
 * imported above, so unused lucide icons are tree-shaken.
 */
const ICONS = {
  archive: Archive,
  'archive-x': ArchiveX,
  'app-window': AppWindow,
  'arrow-down': ArrowDown,
  bell: Bell,
  bot: Bot,
  'bot-off': BotOff,
  'building-2': Building2,
  'calendar-clock': CalendarClock,
  'calendar-days': CalendarDays,
  camera: Camera,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  circle: Circle,
  'circle-alert': CircleAlert,
  'circle-check': CircleCheck,
  'circle-plus': CirclePlus,
  'circle-x': CircleX,
  clock: Clock,
  'cloud-off': CloudOff,
  compass: Compass,
  'ellipsis-vertical': EllipsisVertical,
  eye: Eye,
  'eye-off': EyeOff,
  file: File,
  'file-text': FileText,
  globe: Globe,
  hash: Hash,
  heart: Heart,
  image: Image,
  inbox: Inbox,
  info: Info,
  'layers-2': Layers2,
  'list-filter': ListFilter,
  lock: Lock,
  mail: Mail,
  'mail-open': MailOpen,
  'map-pin': MapPin,
  'message-circle': MessageCircle,
  'message-circle-more': MessageCircleMore,
  'message-square-more': MessageSquareMore,
  'message-square-text': MessageSquareText,
  'messages-square': MessagesSquare,
  moon: Moon,
  music: Music,
  paperclip: Paperclip,
  pencil: Pencil,
  phone: Phone,
  'refresh-cw': RefreshCw,
  reply: Reply,
  save: Save,
  'save-off': SaveOff,
  search: Search,
  'send-horizontal': SendHorizontal,
  settings: Settings,
  square: Square,
  'square-check': SquareCheck,
  'square-pen': SquarePen,
  star: Star,
  'star-off': StarOff,
  sun: Sun,
  tag: Tag,
  'trash-2': Trash2,
  'triangle-alert': TriangleAlert,
  type: Type,
  user: User,
  'user-check': UserCheck,
  'user-lock': UserLock,
  'user-minus': UserMinus,
  'user-plus': UserPlus,
  'user-round-x': UserRoundX,
  users: Users,
  'users-round': UsersRound,
  video: Video,
  webhook: Webhook,
  workflow: Workflow,
  x: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
  /** Fills the glyph with `color` for "active" states (followed star, liked heart) — lucide icons
   * are stroke-only by default, so there is no separate filled variant per icon. */
  filled?: boolean;
  /** Mirror this icon horizontally in RTL layouts (chevrons, send arrow, etc). `I18nManager.isRTL`
   * only changes on app reload, so reading it at render time is safe — no live-toggle case exists. */
  flipRTL?: boolean;
}

/** Single wrapper around the icon set in use (lucide-react-native) so swapping icon libraries
 * later touches one file instead of every call site. */
export function Icon({
  name,
  size = 24,
  color,
  strokeWidth = 2,
  filled = false,
  flipRTL = false,
}: IconProps) {
  const Component = ICONS[name];
  if (__DEV__ && !Component) {
    throw new Error(`Icon: unknown icon name "${name}"`);
  }
  const style = flipRTL && I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined;
  return (
    <Component
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      fill={filled ? color : 'none'}
      style={style}
    />
  );
}
