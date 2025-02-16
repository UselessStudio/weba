import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback,
  useEffect,
  useMemo, useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiFormattedText } from '../../../api/types';
import type { MenuItemContextAction } from '../../ui/ListItem';

import { ALL_FOLDER_ID } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';

import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useLastCallback from '../../../hooks/useLastCallback';

import FolderIcon from '../../common/FolderIcon';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';

type OwnProps = {
  active: boolean;
  title: ApiFormattedText;
  emoticon?: string;
  badgeCount?: number;
  badgeActive: boolean;
  noTitleAnimations?: boolean;
  style?: string;
  contextActions?: MenuItemContextAction[];
  onDrag?: (i: number, y: number) => void;
  onDragEnd?: () => void;
  disableDrag?: boolean;
  id: number;
};

const SideChatFolder: FC<OwnProps> = ({
  active,
  title,
  badgeActive,
  badgeCount,
  emoticon,
  contextActions,
  noTitleAnimations,
  style,
  onDrag,
  onDragEnd,
  disableDrag,
  id,
}) => {
  const {
    setActiveChatFolder,
  } = getActions();

  // useEffect(() => {
  //   console.log(entities);
  // }, [entities]);

  const iconElement = useMemo(() => {
    if (id === ALL_FOLDER_ID) {
      return <Icon name="folder-chats" className="icons-chat-folder" />;
    }
    return (
      <FolderIcon
        className="icons-chat-folder"
        title={title}
        emoticon={emoticon}
        size={40}
        isBig
        noTitleAnimations={noTitleAnimations}
      />
    );
  }, [id, title, emoticon, noTitleAnimations]);

  // eslint-disable-next-line no-null/no-null
  const buttonRef = useRef<HTMLButtonElement>(null);
  const {
    contextMenuAnchor, handleContextMenu, handleContextMenuClose,
    handleContextMenuHide, isContextMenuOpen,
  } = useContextMenuHandlers(buttonRef, !contextActions);

  const getTriggerElement = useLastCallback(() => buttonRef.current);
  const getRootElement = useLastCallback(
    () => buttonRef.current!.closest('#Main'),
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
      noCustomEmojiPlayback: noTitleAnimations,
    });
  }, [noTitleAnimations, title]);

  const [state, setState] = useState({
    isDragging: false,
    origin: 0,
    translate: 0,
  });

  const handleFolderClick = useCallback(() => {
    if (state.isDragging && Math.abs(state.translate) > 5) return;
    setActiveChatFolder({ activeChatFolder: id }, { forceOnHeavyAnimation: true });
  }, [id, state.isDragging, state.translate]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (disableDrag) return;
    setState({
      isDragging: true,
      origin: e.clientY,
      translate: 0,
    });
  }, [disableDrag]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (disableDrag) return;
    setState((s) => {
      const translate = e.clientY - s.origin;

      if (s.isDragging) onDrag?.(id, translate);
      return {
        ...s,
        translate,
      };
    });
  }, [id, onDrag, disableDrag]);

  const onMouseUp = useCallback(() => {
    setState((s) => {
      if (s.isDragging) onDragEnd?.();
      return {
        ...s,
        isDragging: false,
      };
    });
  }, [onDragEnd]);

  useEffect(() => {
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [onMouseMove, onMouseUp]);

  return (
    <Button
      className={buildClassName('chat-folder', active && 'chat-folder__active')}
      isRectangular
      color="translucent"
      noFastClick={!disableDrag}
      onClick={handleFolderClick}
      onMouseDown={onMouseDown}
      ripple
      noForcedUpperCase
      ref={buttonRef}
      onContextMenu={handleContextMenu}
      style={style}
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
