import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiChatFolder, ApiChatlistExportedInvite } from '../../../api/types';

import { ALL_FOLDER_ID } from '../../../config';
import { selectCanShareFolder, selectIsCurrentUserPremium, selectTabState } from '../../../global/selectors';
import { selectCurrentLimit } from '../../../global/selectors/limits';
import buildStyle from '../../../util/buildStyle';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';

import useAppLayout from '../../../hooks/useAppLayout';
import { useFolderManagerForUnreadCounters } from '../../../hooks/useFolderManager';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import { type MenuItemContextAction } from '../../ui/ListItem';
import MainMenuDropdown from './MainMenuDropdown';
import SideChatFolder from './SideChatFolder';

import './SideChatFolders.scss';

type OwnProps = {
  onReset: NoneToVoidFunction;
  onSelectSettings: NoneToVoidFunction;
  onSelectContacts: NoneToVoidFunction;
  onSelectArchived: NoneToVoidFunction;
  hasMenu: boolean;
};

type StateProps = {
  chatFoldersById: Record<number, ApiChatFolder>;
  folderInvitesById: Record<number, ApiChatlistExportedInvite[]>;
  orderedFolderIds?: number[];
  activeChatFolder: number;
  maxFolders: number;
  maxChatLists: number;
  maxFolderInvites: number;
  isPremium: boolean;
};

const SideChatFolders: FC<OwnProps & StateProps> = ({
  onReset,
  onSelectSettings,
  onSelectContacts,
  onSelectArchived,
  chatFoldersById,
  orderedFolderIds,
  activeChatFolder,
  hasMenu,
  maxChatLists,
  maxFolderInvites,
  folderInvitesById,
  isPremium,
}) => {
  const {
    openShareChatFolderModal,
    openDeleteChatFolderModal,
    openEditChatFolder,
    openLimitReachedModal,
    sortChatFolders,
  } = getActions();
  const { isMobile } = useAppLayout();
  const lang = useLang();
  const folderCountersById = useFolderManagerForUnreadCounters();
  const chatFolders = useMemo(() => {
    return [{
      id: ALL_FOLDER_ID,
      title: {
        text: lang('FilterAllChats'),
      },
      includedChatIds: MEMO_EMPTY_ARRAY,
      excludedChatIds: MEMO_EMPTY_ARRAY,
    } satisfies ApiChatFolder, ...Object.values(chatFoldersById)].filter(Boolean).map((folder) => {
      const { id, title } = folder;
      const canShareFolder = selectCanShareFolder(getGlobal(), id);
      const contextActions: MenuItemContextAction[] = [];
      if (canShareFolder) {
        contextActions.push({
          title: lang('FilterShare'),
          icon: 'link',
          handler: () => {
            const chatListCount = Object.values(chatFoldersById).reduce((acc, el) => acc + (el.isChatList ? 1 : 0), 0);
            if (chatListCount >= maxChatLists && !folder.isChatList) {
              openLimitReachedModal({
                limit: 'chatlistJoined',
              });
              return;
            }

            // Greater amount can be after premium downgrade
            if (folderInvitesById[id]?.length >= maxFolderInvites) {
              openLimitReachedModal({
                limit: 'chatlistInvites',
              });
              return;
            }

            openShareChatFolderModal({
              folderId: id,
            });
          },
        });
      }

      if (id !== ALL_FOLDER_ID) {
        contextActions.push({
          title: lang('FilterEdit'),
          icon: 'edit',
          handler: () => {
            openEditChatFolder({ folderId: id });
          },
        });

        contextActions.push({
          title: lang('FilterDelete'),
          icon: 'delete',
          destructive: true,
          handler: () => {
            openDeleteChatFolderModal({ folderId: id });
          },
        });
      }
      let emoticon = folder.emoticon;
      if (!emoticon) {
        if (folder.bots) emoticon = '🤖';
        if (folder.groups) emoticon = '👥';
        if (folder.channels) emoticon = '📢';
        if (folder.contacts || folder.nonContacts) emoticon = '👤';
      }
      const i = orderedFolderIds?.indexOf(folder.id);

      return {
        index: i,
        id,
        emoticon,
        title,
        badgeCount: folderCountersById[id]?.chatsCount,
        isBadgeActive: Boolean(folderCountersById[id]?.notificationsCount),
        contextActions: contextActions?.length ? contextActions : undefined,
        noTitleAnimations: folder.noTitleAnimations,
      };
    });
  }, [chatFoldersById, folderCountersById, folderInvitesById, lang, maxChatLists, maxFolderInvites, orderedFolderIds]);

  const [state, setState] = useState<{ draggedId?: number; translation: number; dragOrderIds?: number[] }>({
    draggedId: undefined,
    translation: 0,
    dragOrderIds: orderedFolderIds,
  });

  const folderHeight = useLastCallback(() => {
    return 4.5 * parseFloat(getComputedStyle(document.documentElement).fontSize);
  });

  const onDrag = useCallback((id: number, y: number) => {
    const delta = Math.round(y / folderHeight());
    const index = orderedFolderIds?.indexOf(id) || 0;
    const dragOrderIds = orderedFolderIds?.filter((folderId) => folderId !== id);

    if (!dragOrderIds) {
      return;
    }
    let pos = index + delta;
    if (pos < (isPremium ? 0 : 1)) {
      pos = (isPremium ? 0 : 1);
    } else if (pos >= (orderedFolderIds?.length || 0)) {
      pos = orderedFolderIds?.length || 0;
    }

    dragOrderIds.splice(pos, 0, id as number);
    setState((s) => ({
      ...s,
      draggedId: id,
      translation: y,
      dragOrderIds,
    }));
  }, [folderHeight, isPremium, orderedFolderIds]);

  const onDragEnd = useCallback(() => {
    setState((s) => ({
      ...s,
      draggedId: undefined,
      translation: 0,
    }));
    sortChatFolders({ folderIds: state.dragOrderIds! });
  }, [state.dragOrderIds]);

  return (
    <div id="LeftColumn-folders">
      <MainMenuDropdown
        hasMenu={hasMenu}
        shouldSkipTransition={false}
        isMobile={isMobile}
        onSelectSettings={onSelectSettings}
        onSelectContacts={onSelectContacts}
        onSelectArchived={onSelectArchived}
        onReset={onReset}
      />
      <div className="folder-list custom-scroll">
        {chatFolders?.map((folder) => {
          const isDragging = state.draggedId === folder.id;
          const offset = isDragging ? state.translation : 0;
          const index = state.dragOrderIds?.indexOf(folder.id) ?? 0;
          return (
            <SideChatFolder
              active={folder.id === activeChatFolder}
              id={folder.id}
              title={folder.title}
              emoticon={folder.emoticon}
              badgeCount={folder.badgeCount}
              badgeActive={folder.isBadgeActive}
              contextActions={folder.contextActions}
              noTitleAnimations={folder.noTitleAnimations}
              disableDrag={!isPremium && folder.id === ALL_FOLDER_ID}
              onDrag={onDrag}
              onDragEnd={onDragEnd}
              style={buildStyle(
                `top: calc(var(--left-column-folders-height) * ${isDragging ? folder.index : index} + ${offset}px)`,
                isDragging && 'z-index: 2',
              )}
            />
          );
        })}
      </div>

    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { activeChatFolder } = selectTabState(global);

    const {
      chatFolders: {
        byId: chatFoldersById,
        orderedIds: orderedFolderIds,
        invites: folderInvitesById,
      },
    } = global;
    return {
      chatFoldersById,
      orderedFolderIds,
      folderInvitesById,
      activeChatFolder,
      isPremium: selectIsCurrentUserPremium(global),
      maxFolders: selectCurrentLimit(global, 'dialogFilters'),
      maxFolderInvites: selectCurrentLimit(global, 'chatlistInvites'),
      maxChatLists: selectCurrentLimit(global, 'chatlistJoined'),
    };
  },
)(SideChatFolders));
