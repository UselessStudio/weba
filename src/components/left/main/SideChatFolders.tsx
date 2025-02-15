import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiChatFolder, ApiChatlistExportedInvite } from '../../../api/types';

import { ALL_FOLDER_ID } from '../../../config';
import { selectCanShareFolder, selectTabState } from '../../../global/selectors';
import { selectCurrentLimit } from '../../../global/selectors/limits';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';

import useAppLayout from '../../../hooks/useAppLayout';
import { useFolderManagerForUnreadCounters } from '../../../hooks/useFolderManager';
import useLang from '../../../hooks/useLang';

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
}) => {
  const {
    openShareChatFolderModal,
    openDeleteChatFolderModal,
    openEditChatFolder,
    openLimitReachedModal,
  } = getActions();
  const { isMobile } = useAppLayout();
  const lang = useLang();
  const folderCountersById = useFolderManagerForUnreadCounters();
  const chatFolders = useMemo(() => {
    if (!orderedFolderIds) {
      return undefined;
    }
    return orderedFolderIds?.map((id) => {
      if (id === ALL_FOLDER_ID) {
        return {
          id: ALL_FOLDER_ID,
          title: {
            text: lang('FilterAllChats'),
          },
          includedChatIds: MEMO_EMPTY_ARRAY,
          excludedChatIds: MEMO_EMPTY_ARRAY,
        } satisfies ApiChatFolder;
      }
      return chatFoldersById[id];
    }).filter(Boolean).map((folder, i) => {
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

      return {
        index: i,
        id,
        emoticon,
        title,
        badgeCount: folderCountersById[id]?.chatsCount,
        isBadgeActive: Boolean(folderCountersById[id]?.notificationsCount),
        contextActions: contextActions?.length ? contextActions : undefined,
      };
    });
  }, [chatFoldersById, folderCountersById, folderInvitesById, lang, maxChatLists, maxFolderInvites, orderedFolderIds]);

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
          return (
            <SideChatFolder
              active={folder.index === activeChatFolder}
              index={folder.index}
              title={folder.title}
              emoticon={folder.emoticon}
              badgeCount={folder.badgeCount}
              badgeActive={folder.isBadgeActive}
              contextActions={folder.contextActions}
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
      maxFolders: selectCurrentLimit(global, 'dialogFilters'),
      maxFolderInvites: selectCurrentLimit(global, 'chatlistInvites'),
      maxChatLists: selectCurrentLimit(global, 'chatlistJoined'),
    };
  },
)(SideChatFolders));
