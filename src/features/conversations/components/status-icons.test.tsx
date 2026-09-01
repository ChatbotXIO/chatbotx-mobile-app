import { render, screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';

import { AssigneeBadge, BotStateIcon, StatusIconStrip } from './status-icons';

beforeAll(() => {
  initI18n();
});

describe('BotStateIcon', () => {
  it('labels the "on" state', async () => {
    await render(<BotStateIcon botEnabled botResumeAt={null} />);
    expect(screen.getByLabelText('Bot handling')).toBeTruthy();
  });

  it('labels the "paused" state with the resume time', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    await render(<BotStateIcon botEnabled={false} botResumeAt={future} />);
    expect(screen.getByLabelText(/Bot resumes at/)).toBeTruthy();
  });

  it('labels the "off" state', async () => {
    await render(<BotStateIcon botEnabled={false} botResumeAt={null} />);
    expect(screen.getByLabelText('Off')).toBeTruthy();
  });
});

describe('AssigneeBadge', () => {
  it('renders an avatar for a person assignee', async () => {
    await render(<AssigneeBadge assignedUser={{ name: 'Jane Doe' }} assignedInboxTeam={null} />);
    expect(screen.getByText('JD')).toBeTruthy();
  });

  it('renders nothing when unassigned', async () => {
    const { toJSON } = await render(<AssigneeBadge assignedUser={null} assignedInboxTeam={null} />);
    expect(toJSON()).toBeNull();
  });
});

describe('StatusIconStrip', () => {
  it('renders nothing when no status is true', async () => {
    const { toJSON } = await render(
      <StatusIconStrip followed={false} archivedAt={null} blockedAt={null} unread={false} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('labels the followed, archived, blocked, and unread icons when present', async () => {
    await render(
      <StatusIconStrip
        followed
        archivedAt="2026-01-01T00:00:00.000Z"
        blockedAt="2026-01-01T00:00:00.000Z"
        unread
      />,
    );
    expect(screen.getByLabelText('Follow')).toBeTruthy();
    expect(screen.getByLabelText('Archive')).toBeTruthy();
    expect(screen.getByLabelText('Blocked')).toBeTruthy();
    expect(screen.getByLabelText('Unread')).toBeTruthy();
  });
});
