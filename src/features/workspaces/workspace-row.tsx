import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';
import { useTheme } from '@/theme/use-theme';

import type { Workspace } from './api/use-workspaces';

interface WorkspaceRowProps {
  workspace: Workspace;
  onPress: (workspace: Workspace) => void;
  /** Marks this row as the currently active workspace — shows a checkmark instead of the
   * chevron. */
  selected?: boolean;
}

export function WorkspaceRow({ workspace, onPress, selected = false }: WorkspaceRowProps) {
  const { colors } = useTheme();

  return (
    <ListItem
      title={workspace.name}
      leading={<Avatar uri={workspace.logo} name={workspace.name} size={44} />}
      trailing={
        selected ? <Icon name="circle-check" size={22} color={colors.brand} /> : undefined
      }
      onPress={() => onPress(workspace)}
      showChevron={!selected}
      accessibilityState={{ selected }}
    />
  );
}
