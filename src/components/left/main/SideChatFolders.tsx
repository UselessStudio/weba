import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChatFolder, ApiChatlistExportedInvite, ApiSession } from '../../../api/types';
import type { GlobalState } from '../../../global/types';

import { ALL_FOLDER_ID } from '../../../config';
import { selectTabState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';

import useAppLayout from '../../../hooks/useAppLayout';
import { useFolderManagerForUnreadCounters } from '../../../hooks/useFolderManager';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import ListItem from '../../ui/ListItem';
import MainMenuDropdown from './MainMenuDropdown';
import SideChatFolder from './SideChatFolder';

import './SideChatFolders.scss';

type OwnProps = {
  onReset: NoneToVoidFunction;
  onSelectSettings: NoneToVoidFunction;
  onSelectContacts: NoneToVoidFunction;
  onSelectArchived: NoneToVoidFunction;
};

type StateProps = {
  chatFoldersById: Record<number, ApiChatFolder>;
  folderInvitesById: Record<number, ApiChatlistExportedInvite[]>;
  orderedFolderIds?: number[];
  activeChatFolder: number;
};

const SideChatFolders: FC<OwnProps & StateProps> = ({
  onReset,
  onSelectSettings,
  onSelectContacts,
  onSelectArchived,
  chatFoldersById,
  orderedFolderIds,
  activeChatFolder,
}) => {
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
            text: orderedFolderIds?.[0] === ALL_FOLDER_ID ? lang('FilterAllChatsShort') : lang('FilterAllChats'),
          },
          includedChatIds: MEMO_EMPTY_ARRAY,
          excludedChatIds: MEMO_EMPTY_ARRAY,
        } satisfies ApiChatFolder;
      }
      return chatFoldersById[id];
    }).filter(Boolean).map((folder, i) => {
      const { id, title, emoticon } = folder;
      console.log(title.text, title.entities);
      return {
        index: i,
        id,
        emoticon,
        entities: title.entities,
        title: renderTextWithEntities({
          text: title.text,
          entities: title.entities,
          noCustomEmojiPlayback: folder.noTitleAnimations,
        }),
        badgeCount: folderCountersById[id]?.chatsCount,
        isBadgeActive: Boolean(folderCountersById[id]?.notificationsCount),
      };
    });
  }, [chatFoldersById, folderCountersById, lang, orderedFolderIds]);

  return (
    <div id="LeftColumn-folders">
      <MainMenuDropdown
        hasMenu
        shouldSkipTransition={false}
        isMobile={isMobile}
        onSelectSettings={onSelectSettings}
        onSelectContacts={onSelectContacts}
        onSelectArchived={onSelectArchived}
        onReset={onReset}
      />
      <div className="folder-list">
        {chatFolders?.map((folder) => {
          return (
            <SideChatFolder
              active={folder.index === activeChatFolder}
              index={folder.index}
              title={folder.title}
              emoticon={folder.emoticon}
              entities={folder.entities}
              badgeCount={folder.badgeCount}
              badgeActive={folder.isBadgeActive}
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
    };
  },
)(SideChatFolders));
