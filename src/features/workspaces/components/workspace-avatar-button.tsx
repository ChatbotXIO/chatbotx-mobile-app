import { Pressable } from 'react-native';

import { Avatar } from '@/components/ui/avatar';

interface WorkspaceAvatarButtonProps {
  name: string;
  logo?: string | null;
  onPress: () => void;
}

/** Compact header affordance: the current workspace's avatar; tapping opens the switcher. */
export function WorkspaceAvatarButton({ name, logo, onPress }: WorkspaceAvatarButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Avatar uri={logo} name={name} size={36} />
    </Pressable>
  );
}
