import type { LucideIcon } from 'lucide-react-native';
import Archive from 'lucide-react-native/icons/archive';
import ArchiveX from 'lucide-react-native/icons/archive-x';
import AppWindow from 'lucide-react-native/icons/app-window';
import ArrowDown from 'lucide-react-native/icons/arrow-down';
import Bell from 'lucide-react-native/icons/bell';
import Bot from 'lucide-react-native/icons/bot';
import BotOff from 'lucide-react-native/icons/bot-off';
import Building2 from 'lucide-react-native/icons/building-2';
import CalendarClock from 'lucide-react-native/icons/calendar-clock';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Camera from 'lucide-react-native/icons/camera';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Circle from 'lucide-react-native/icons/circle';
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CirclePlus from 'lucide-react-native/icons/circle-plus';
import CircleX from 'lucide-react-native/icons/circle-x';
import Clock from 'lucide-react-native/icons/clock';
import CloudOff from 'lucide-react-native/icons/cloud-off';
import Compass from 'lucide-react-native/icons/compass';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import EllipsisVertical from 'lucide-react-native/icons/ellipsis-vertical';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import File from 'lucide-react-native/icons/file';
import FileText from 'lucide-react-native/icons/file-text';
import Globe from 'lucide-react-native/icons/globe';
import Hash from 'lucide-react-native/icons/hash';
import Heart from 'lucide-react-native/icons/heart';
import Image from 'lucide-react-native/icons/image';
import Inbox from 'lucide-react-native/icons/inbox';
import Info from 'lucide-react-native/icons/info';
import Layers2 from 'lucide-react-native/icons/layers-2';
import ListFilter from 'lucide-react-native/icons/list-filter';
import Lock from 'lucide-react-native/icons/lock';
import Mail from 'lucide-react-native/icons/mail';
import MailOpen from 'lucide-react-native/icons/mail-open';
import MapPin from 'lucide-react-native/icons/map-pin';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import MessageCircleMore from 'lucide-react-native/icons/message-circle-more';
import MessageSquareMore from 'lucide-react-native/icons/message-square-more';
import MessageSquareText from 'lucide-react-native/icons/message-square-text';
import MessagesSquare from 'lucide-react-native/icons/messages-square';
import Moon from 'lucide-react-native/icons/moon';
import Music from 'lucide-react-native/icons/music';
import Paperclip from 'lucide-react-native/icons/paperclip';
import Pencil from 'lucide-react-native/icons/pencil';
import Phone from 'lucide-react-native/icons/phone';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Reply from 'lucide-react-native/icons/reply';
import Save from 'lucide-react-native/icons/save';
import Search from 'lucide-react-native/icons/search';
import SendHorizontal from 'lucide-react-native/icons/send-horizontal';
import Settings from 'lucide-react-native/icons/settings';
import Square from 'lucide-react-native/icons/square';
import SquareCheck from 'lucide-react-native/icons/square-check';
import SquarePen from 'lucide-react-native/icons/square-pen';
import Star from 'lucide-react-native/icons/star';
import StarOff from 'lucide-react-native/icons/star-off';
import Sun from 'lucide-react-native/icons/sun';
import Tag from 'lucide-react-native/icons/tag';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import Type from 'lucide-react-native/icons/type';
import User from 'lucide-react-native/icons/user';
import UserCheck from 'lucide-react-native/icons/user-check';
import UserLock from 'lucide-react-native/icons/user-lock';
import UserMinus from 'lucide-react-native/icons/user-minus';
import UserPlus from 'lucide-react-native/icons/user-plus';
import UserRoundX from 'lucide-react-native/icons/user-round-x';
import Users from 'lucide-react-native/icons/users';
import UsersRound from 'lucide-react-native/icons/users-round';
import Video from 'lucide-react-native/icons/video';
import Webhook from 'lucide-react-native/icons/webhook';
import Workflow from 'lucide-react-native/icons/workflow';
import X from 'lucide-react-native/icons/x';
import { I18nManager } from 'react-native';

/**
 * Semantic icon registry — one lucide component per key. Keys mirror lucide's own kebab-case
 * names (`bot`, `archive-x`, `user-lock`…) so this file and the web app's `lucide-react` icon
 * usages are 1:1 greppable, with no second alias layer to keep in sync. Each icon is imported from its
 * own `lucide-react-native/icons/<name>` file: Metro doesn't tree-shake, so a named import from the
 * package root would bundle every lucide icon (~1.5 MB of JS).
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
  ellipsis: Ellipsis,
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
