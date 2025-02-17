import type { FC } from '../../lib/teact/teact';
import React, { memo, useMemo } from '../../lib/teact/teact';

import type { ApiFormattedText } from '../../api/types';
import { ApiMessageEntityTypes } from '../../api/types';

import renderText from './helpers/renderText';

import CustomEmoji from './CustomEmoji';
import Icon from './icons/Icon';

type OwnProps = {
  className?: string;
  title: ApiFormattedText;
  emoticon?: string;
  size?: number;
  isBig?: boolean;
  noTitleAnimations?: boolean;
};

const FolderIcon: FC<OwnProps> = ({
  className, title, emoticon, size, isBig, noTitleAnimations,
}) => {
  const icon = useMemo(() => {
    switch (emoticon) {
      case '🤖':
        return <Icon name="folder-bot" className={className} />;
      case '📢':
        return <Icon name="folder-channel" className={className} />;
      case '✅':
        return <Icon name="folder-chat" className={className} />;
      case '💬':
        return <Icon name="folder-chats" className={className} />;
      case '📁':
        return <Icon name="folder-folder" className={className} />;
      case '👥':
        return <Icon name="folder-group" className={className} />;
      case '⭐':
        return <Icon name="folder-star" className={className} />;
      case '👤':
        return <Icon name="folder-user" className={className} />;
    }
    return undefined;
  }, [className, emoticon]);

  const customEmoji = useMemo(() => {
    if (!title.entities || title.entities.length < 1
      || title.entities[0].type !== ApiMessageEntityTypes.CustomEmoji) return undefined;
    return (
      <CustomEmoji
        className={className}
        key={title.entities[0].documentId}
        documentId={title.entities[0].documentId}
        size={size}
        isBig
        noPlay={noTitleAnimations}
      />
    );
  }, [className, size, title.entities, noTitleAnimations]);

  const emoji = useMemo(() => {
    const emojiRegex = /(?=\p{Emoji})(?!\p{Number})/u;
    const split = title.text.split(' ');

    if (split.length < 1) return undefined;
    if (emojiRegex.test(split[0])) {
      return renderText(split[0], isBig ? ['hq_emoji'] : ['emoji']);
    } else if (emojiRegex.test(split[split.length - 1])) {
      return renderText(split[split.length - 1], isBig ? ['hq_emoji'] : ['emoji']);
    }

    return undefined;
  }, [isBig, title.text]);

  if (customEmoji) return customEmoji;
  if (emoji) return emoji;
  if (icon) return icon;
  return <Icon name="folder-folder" className={className} />;
};

export default memo(FolderIcon);
