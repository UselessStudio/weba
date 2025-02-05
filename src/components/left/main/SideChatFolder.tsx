import type { FC, TeactNode } from '../../../lib/teact/teact';
import React, { memo, useEffect, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessageEntity } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedCounter from '../../common/AnimatedCounter';
import Icon from '../../common/icons/Icon';
import Badge from '../../ui/Badge';
import Button from '../../ui/Button';

type OwnProps = {
  index: number;
  active: boolean;
  title: TeactNode[];
  entities?: ApiMessageEntity[];
  emoticon?: string;
  badgeCount?: number;
  badgeActive: boolean;
};

const SideChatFolder: FC<OwnProps> = ({
  active,
  index,
  title,
  badgeActive,
  badgeCount,
  emoticon,
  entities,
}) => {
  const {
    setActiveChatFolder,
  } = getActions();

  // useEffect(() => {
  //   console.log(entities);
  // }, [entities]);

  const handleFolderClick = useLastCallback(() => {
    setActiveChatFolder({ activeChatFolder: index }, { forceOnHeavyAnimation: true });
  });

  const iconElement = useMemo(() => {
    switch (emoticon) {
      case '🤖':
        return <Icon name="folder-bot" className="icons-chat-folder" />;
      case '📢':
        return <Icon name="folder-channel" className="icons-chat-folder" />;
      case '✅':
        return <Icon name="folder-chat" className="icons-chat-folder" />;
      case '💬':
        return <Icon name="folder-chats" className="icons-chat-folder" />;
      case '📁':
        return <Icon name="folder-folder" className="icons-chat-folder" />;
      case '👥':
        return <Icon name="folder-group" className="icons-chat-folder" />;
      case '⭐':
        return <Icon name="folder-star" className="icons-chat-folder" />;
      case '👤':
        return <Icon name="folder-user" className="icons-chat-folder" />;
      default:
        // TODO: handle emojis
        return <Icon name="folder-chat" className="icons-chat-folder" />;
    }
  }, [emoticon]);

  return (
    <Button
      className={buildClassName('chat-folder', active && 'chat-folder__active')}
      isRectangular
      color="translucent"
      onClick={handleFolderClick}
      ripple
      noForcedUpperCase
    >
      {!!badgeCount && <span className={buildClassName('badge', badgeActive && 'active')}>{badgeCount}</span>}
      {iconElement}
      <span className="title">{title}</span>
    </Button>
  );
};

export default memo(SideChatFolder);
