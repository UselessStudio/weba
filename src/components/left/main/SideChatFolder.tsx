import type { FC, TeactNode } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiFormattedText, ApiMessageEntity } from '../../../api/types';
import type { MenuItemContextAction } from '../../ui/ListItem';

import buildClassName from '../../../util/buildClassName';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';

import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedCounter from '../../common/AnimatedCounter';
import FolderIcon from '../../common/FolderIcon';
import Icon from '../../common/icons/Icon';
import Badge from '../../ui/Badge';
import Button from '../../ui/Button';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';

type OwnProps = {
  index: number;
  active: boolean;
  title: ApiFormattedText;
  emoticon?: string;
  badgeCount?: number;
  badgeActive: boolean;
  contextActions?: MenuItemContextAction[];
};

const SideChatFolder: FC<OwnProps> = ({
  active,
  index,
  title,
  badgeActive,
  badgeCount,
  emoticon,
  contextActions,
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
    if (index === 0) {
      return <Icon name="folder-chats" className="icons-chat-folder" />;
    }
    return <FolderIcon className="icons-chat-folder" title={title} emoticon={emoticon} size={40} isBig />;
  }, [index, emoticon, title]);

  // eslint-disable-next-line no-null/no-null
  const buttonRef = useRef<HTMLButtonElement>(null);
  const {
    contextMenuAnchor, handleContextMenu, handleContextMenuClose,
    handleContextMenuHide, isContextMenuOpen,
  } = useContextMenuHandlers(buttonRef, !contextActions);

  const getTriggerElement = useLastCallback(() => buttonRef.current);
  const getRootElement = useLastCallback(
    () => buttonRef.current!.closest('#LeftColumn'),
  );
  const getMenuElement = useLastCallback(
    () => document.querySelector('#portals')!.querySelector('.Tab-context-menu .bubble'),
  );
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const strippedTitle = useMemo(() => {
    const emojiRegex = /\p{Emoji}/u;
    const text = title.text.split(' ');
    if (text.length > 1) {
      if (emojiRegex.test(text[0])) {
        text.splice(0, 1);
      } else if (emojiRegex.test(text[text.length - 1])) {
        text.splice(text.length - 1, 1);
      }
    }

    return renderTextWithEntities({
      text: text.join(' '),
      entities: title.entities,
    });
  }, [title]);

  return (
    <Button
      className={buildClassName('chat-folder', active && 'chat-folder__active')}
      isRectangular
      color="translucent"
      onClick={handleFolderClick}
      ripple
      noForcedUpperCase
      ref={buttonRef}
      onContextMenu={handleContextMenu}
    >
      {!!badgeCount && (
        <span className={buildClassName('badge', (active || badgeActive) && 'active')}>
          {badgeCount}
        </span>
      )}
      {iconElement}
      <span className="title">{strippedTitle}</span>
      {contextActions && contextMenuAnchor !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getLayout={getLayout}
          className="ChatFolder-context-menu"
          autoClose
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          withPortal
        >
          {contextActions.map((action) => (
            ('isSeparator' in action) ? (
              <MenuSeparator key={action.key || 'separator'} />
            ) : (
              <MenuItem
                key={action.title}
                icon={action.icon}
                destructive={action.destructive}
                disabled={!action.handler}
                onClick={action.handler}
              >
                {action.title}
              </MenuItem>
            )
          ))}
        </Menu>
      )}
    </Button>
  );
};

export default memo(SideChatFolder);
