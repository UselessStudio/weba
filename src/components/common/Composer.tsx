import type {
  FC,
  RefObject,
  StateHookSetter,
} from '../../lib/teact/teact';
import React, {
  getIsHeavyAnimating,
  memo, useCallback,
  useEffect, useLayoutEffect,
  useMemo, useRef, useSignal, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type {
  ApiAttachment,
  ApiAttachMenuPeerType,
  ApiAvailableEffect,
  ApiAvailableReaction,
  ApiBotCommand,
  ApiBotInlineMediaResult,
  ApiBotInlineResult,
  ApiBotMenuButton,
  ApiChat,
  ApiChatFullInfo,
  ApiDraft,
  ApiFormattedText,
  ApiInputMessageReplyInfo,
  ApiMessage,
  ApiMessageEntity,
  ApiNewPoll,
  ApiQuickReply,
  ApiReaction,
  ApiStealthMode,
  ApiSticker,
  ApiTopic,
  ApiUser,
  ApiVideo,
  ApiWebPage,
} from '../../api/types';
import type {
  GlobalState, TabState,
} from '../../global/types';
import type {
  IAnchorPosition,
  InlineBotSettings,
  ISettings,
  MessageList,
  MessageListType,
  ThreadId,
} from '../../types';
import type { Signal } from '../../util/signals';
import {
  ApiMessageEntityTypes,
  MAIN_THREAD_ID,
} from '../../api/types';

import {
  BASE_EMOJI_KEYWORD_LANG,
  DEFAULT_MAX_MESSAGE_LENGTH,
  EDITABLE_INPUT_ID, EDITABLE_INPUT_MODAL_ID, EDITABLE_STORY_INPUT_ID,
  HEART_REACTION,
  MAX_UPLOAD_FILEPART_SIZE,
  ONE_TIME_MEDIA_TTL_SECONDS,
  SCHEDULED_WHEN_ONLINE,
  SEND_MESSAGE_ACTION_INTERVAL,
  SERVICE_NOTIFICATIONS_USER_ID,
} from '../../config';
import {
  requestForcedReflow, requestMeasure, requestMutation, requestNextMutation,
} from '../../lib/fasterdom/fasterdom';
import {
  canEditMedia, canReplaceMessageMedia, containsCustomEmoji,
  getAllowedAttachmentOptions,
  getReactionKey,
  getStoryKey,
  isChatAdmin,
  isChatChannel,
  isChatSuperGroup,
  isSameReaction,
  isSystemBot, isUploadingFileSticker,
  isUserId, stripCustomEmoji,
} from '../../global/helpers';
import {
  selectBot,
  selectCanPlayAnimatedEmojis,
  selectCanScheduleUntilOnline,
  selectChat,
  selectChatFullInfo,
  selectChatMessage,
  selectChatType,
  selectCurrentMessageList,
  selectDraft,
  selectEditingDraft,
  selectEditingMessage,
  selectEditingScheduledDraft,
  selectIsChatWithSelf,
  selectIsCurrentUserPremium,
  selectIsInSelectMode,
  selectIsPremiumPurchaseBlocked,
  selectIsReactionPickerOpen,
  selectIsRightColumnShown,
  selectNewestMessageWithBotKeyboardButtons,
  selectNoWebPage,
  selectPeerStory,
  selectPerformanceSettingsValue,
  selectRequestedDraft,
  selectRequestedDraftFiles,
  selectTabState,
  selectTheme,
  selectTopicFromMessage,
  selectUser,
  selectUserFullInfo,
} from '../../global/selectors';
import { selectCurrentLimit } from '../../global/selectors/limits';
import buildClassName from '../../util/buildClassName';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { formatMediaDuration, formatVoiceRecordDuration } from '../../util/dates/dateFormat';
import { processDeepLink } from '../../util/deeplink';
import { tryParseDeepLink } from '../../util/deepLinkParser';
import deleteLastCharacterOutsideSelection from '../../util/deleteLastCharacterOutsideSelection';
import { getIsDirectTextInputDisabled } from '../../util/directInputManager';
import { processMessageInputForCustomEmoji } from '../../util/emoji/customEmojiManager';
import parseEmojiOnlyString from '../../util/emoji/parseEmojiOnlyString';
import { ensureProtocol } from '../../util/ensureProtocol';
import focusEditableElement from '../../util/focusEditableElement';
import getKeyFromEvent from '../../util/getKeyFromEvent';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import parseHtmlAsFormattedText from '../../util/parseHtmlAsFormattedText';
import { debounce } from '../../util/schedulers';
import { insertHtmlInSelection } from '../../util/selection';
import { getServerTime } from '../../util/serverTime';
import stopEvent from '../../util/stopEvent';
import {
  IS_ANDROID,
  IS_EMOJI_SUPPORTED,
  IS_IOS,
  IS_TOUCH_ENV,
  IS_VOICE_RECORDING_SUPPORTED,
} from '../../util/windowEnvironment';
import windowSize from '../../util/windowSize';
import applyIosAutoCapitalizationFix from '../middle/composer/helpers/applyIosAutoCapitalizationFix';
import buildAttachment, { prepareAttachmentsToSend } from '../middle/composer/helpers/buildAttachment';
import { preparePastedHtml } from '../middle/composer/helpers/cleanHtml';
import { buildCustomEmojiHtml } from '../middle/composer/helpers/customEmoji';
import getFilesFromDataTransferItems from '../middle/composer/helpers/getFilesFromDataTransferItems';
import { isSelectionInsideInput } from '../middle/composer/helpers/selection';
import { getPeerColorClass } from './helpers/peerColor';
import renderText from './helpers/renderText';
import { getTextWithEntitiesAsHtml } from './helpers/renderTextWithEntities';

import useInterval from '../../hooks/schedulers/useInterval';
import useTimeout from '../../hooks/schedulers/useTimeout';
import useAppLayout from '../../hooks/useAppLayout';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useDerivedState from '../../hooks/useDerivedState';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useFlag from '../../hooks/useFlag';
import useGetSelectionRange from '../../hooks/useGetSelectionRange';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';
import useSchedule from '../../hooks/useSchedule';
import useSendMessageAction from '../../hooks/useSendMessageAction';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';
import { useStateRef } from '../../hooks/useStateRef';
import useSyncEffect from '../../hooks/useSyncEffect';
import useVirtualBackdrop from '../../hooks/useVirtualBackdrop';
import useAttachmentModal from '../middle/composer/hooks/useAttachmentModal';
import useChatCommandTooltip from '../middle/composer/hooks/useChatCommandTooltip';
import useCustomEmojiTooltip from '../middle/composer/hooks/useCustomEmojiTooltip';
import useDraft from '../middle/composer/hooks/useDraft';
import useEditing from '../middle/composer/hooks/useEditing';
import useEmojiTooltip from '../middle/composer/hooks/useEmojiTooltip';
import useInlineBotTooltip from '../middle/composer/hooks/useInlineBotTooltip';
import useInputCustomEmojis from '../middle/composer/hooks/useInputCustomEmojis';
import useMentionTooltip from '../middle/composer/hooks/useMentionTooltip';
import useStickerTooltip from '../middle/composer/hooks/useStickerTooltip';
import useVoiceRecording from '../middle/composer/hooks/useVoiceRecording';

import AttachmentModal from '../middle/composer/AttachmentModal.async';
import AttachMenu from '../middle/composer/AttachMenu';
import BotCommandMenu from '../middle/composer/BotCommandMenu.async';
import BotKeyboardMenu from '../middle/composer/BotKeyboardMenu';
import BotMenuButton from '../middle/composer/BotMenuButton';
import ChatCommandTooltip from '../middle/composer/ChatCommandTooltip.async';
import ComposerEmbeddedMessage from '../middle/composer/ComposerEmbeddedMessage';
import CustomEmojiTooltip from '../middle/composer/CustomEmojiTooltip.async';
import CustomSendMenu from '../middle/composer/CustomSendMenu.async';
import DropArea, { DropAreaState } from '../middle/composer/DropArea.async';
import EmojiTooltip from '../middle/composer/EmojiTooltip.async';
import InlineBotTooltip from '../middle/composer/InlineBotTooltip.async';
import MentionTooltip from '../middle/composer/MentionTooltip.async';
import PollModal from '../middle/composer/PollModal.async';
import SendAsMenu from '../middle/composer/SendAsMenu.async';
import StickerTooltip from '../middle/composer/StickerTooltip.async';
import SymbolMenuButton from '../middle/composer/SymbolMenuButton';
import WebPagePreview from '../middle/composer/WebPagePreview';
import MessageEffect from '../middle/message/MessageEffect';
import ReactionSelector from '../middle/message/reactions/ReactionSelector';
import Button from '../ui/Button';
import ResponsiveHoverButton from '../ui/ResponsiveHoverButton';
import Spinner from '../ui/Spinner';
import TextTimer from '../ui/TextTimer';
import Avatar from './Avatar';
import Icon from './icons/Icon';
import ReactionAnimatedEmoji from './reactions/ReactionAnimatedEmoji';

import './Composer.scss';
import '../middle/composer/TextFormatter.scss';

type ComposerType = 'messageList' | 'story';

type OwnProps = {
  type: ComposerType;
  chatId: string;
  threadId: ThreadId;
  storyId?: number;
  messageListType: MessageListType;
  dropAreaState?: string;
  isReady: boolean;
  isMobile?: boolean;
  inputId: string;
  editableInputCssSelector: string;
  editableInputId: string;
  className?: string;
  inputPlaceholder?: string;
  onDropHide?: NoneToVoidFunction;
  onForward?: NoneToVoidFunction;
  onFocus?: NoneToVoidFunction;
  onBlur?: NoneToVoidFunction;
};

type StateProps =
  {
    isOnActiveTab: boolean;
    editingMessage?: ApiMessage;
    chat?: ApiChat;
    chatFullInfo?: ApiChatFullInfo;
    draft?: ApiDraft;
    replyToTopic?: ApiTopic;
    currentMessageList?: MessageList;
    isChatWithBot?: boolean;
    isChatWithSelf?: boolean;
    isChannel?: boolean;
    isForCurrentMessageList: boolean;
    isRightColumnShown?: boolean;
    isSelectModeActive?: boolean;
    isReactionPickerOpen?: boolean;
    isForwarding?: boolean;
    pollModal: TabState['pollModal'];
    botKeyboardMessageId?: number;
    botKeyboardPlaceholder?: string;
    withScheduledButton?: boolean;
    isInScheduledList?: boolean;
    canScheduleUntilOnline?: boolean;
    stickersForEmoji?: ApiSticker[];
    customEmojiForEmoji?: ApiSticker[];
    currentUserId?: string;
    currentUser?: ApiUser;
    recentEmojis: string[];
    contentToBeScheduled?: TabState['contentToBeScheduled'];
    shouldSuggestStickers?: boolean;
    shouldSuggestCustomEmoji?: boolean;
    baseEmojiKeywords?: Record<string, string[]>;
    emojiKeywords?: Record<string, string[]>;
    topInlineBotIds?: string[];
    isInlineBotLoading: boolean;
    inlineBots?: Record<string, false | InlineBotSettings>;
    botCommands?: ApiBotCommand[] | false;
    botMenuButton?: ApiBotMenuButton;
    sendAsUser?: ApiUser;
    sendAsChat?: ApiChat;
    sendAsId?: string;
    editingDraft?: ApiFormattedText;
    requestedDraft?: ApiFormattedText;
    requestedDraftFiles?: File[];
    attachBots: GlobalState['attachMenu']['bots'];
    attachMenuPeerType?: ApiAttachMenuPeerType;
    theme: ISettings['theme'];
    fileSizeLimit: number;
    captionLimit: number;
    isCurrentUserPremium?: boolean;
    canSendVoiceByPrivacy?: boolean;
    attachmentSettings: GlobalState['attachmentSettings'];
    slowMode?: ApiChatFullInfo['slowMode'];
    shouldUpdateStickerSetOrder?: boolean;
    availableReactions?: ApiAvailableReaction[];
    topReactions?: ApiReaction[];
    canPlayAnimatedEmojis?: boolean;
    canBuyPremium?: boolean;
    shouldCollectDebugLogs?: boolean;
    sentStoryReaction?: ApiReaction;
    stealthMode?: ApiStealthMode;
    canSendOneTimeMedia?: boolean;
    quickReplyMessages?: Record<number, ApiMessage>;
    quickReplies?: Record<number, ApiQuickReply>;
    canSendQuickReplies?: boolean;
    webPagePreview?: ApiWebPage;
    noWebPage?: boolean;
    isContactRequirePremium?: boolean;
    effect?: ApiAvailableEffect;
    effectReactions?: ApiReaction[];
    areEffectsSupported?: boolean;
    canPlayEffect?: boolean;
    shouldPlayEffect?: boolean;
    maxMessageLength: number;
  };

enum MainButtonState {
  Send = 'send',
  Record = 'record',
  Edit = 'edit',
  Schedule = 'schedule',
  Forward = 'forward',
  SendOneTime = 'sendOneTime',
}

type ScheduledMessageArgs = TabState['contentToBeScheduled'] | {
  id: string; queryId: string; isSilent?: boolean;
};

const VOICE_RECORDING_FILENAME = 'wonderful-voice-message.ogg';
// When voice recording is active, composer placeholder will hide to prevent overlapping
const SCREEN_WIDTH_TO_HIDE_PLACEHOLDER = 600; // px

const MOBILE_KEYBOARD_HIDE_DELAY_MS = 100;
const SELECT_MODE_TRANSITION_MS = 200;
const SENDING_ANIMATION_DURATION = 350;
const MOUNT_ANIMATION_DURATION = 430;

interface Token {
  type: ApiMessageEntityTypes | 'text';
  value?: string;
  children?: Token[];
  language?: string;
  url?: string;
  userId?: string;
  documentId?: string;
}

interface ASTNode {
  type: ApiMessageEntityTypes | 'text' | 'root';
  value?: string;
  children?: ASTNode[];
  language?: string;
  url?: string;
  userId?: string;
  documentId?: string;
}

const MARKUP_SYMBOLS = {
  [ApiMessageEntityTypes.Bold]: '**',
  [ApiMessageEntityTypes.Italic]: '*',
  [ApiMessageEntityTypes.Strike]: '~~',
  [ApiMessageEntityTypes.Underline]: '__',
  [ApiMessageEntityTypes.Code]: '`',
  [ApiMessageEntityTypes.Pre]: '```',
  [ApiMessageEntityTypes.Blockquote]: '```',
  [ApiMessageEntityTypes.Spoiler]: '||',
  [ApiMessageEntityTypes.TextUrl]: ['[', ']'],
  [ApiMessageEntityTypes.CustomEmoji]: ['![', ']'],
  [ApiMessageEntityTypes.Mention]: '@',
} as const;

const HTML_TAGS = {
  [ApiMessageEntityTypes.Bold]: 'strong',
  [ApiMessageEntityTypes.Italic]: 'em',
  [ApiMessageEntityTypes.Strike]: 'del',
  [ApiMessageEntityTypes.Underline]: 'u',
  [ApiMessageEntityTypes.Code]: 'code',
  [ApiMessageEntityTypes.Pre]: 'pre',
  [ApiMessageEntityTypes.Blockquote]: 'blockquote',
  [ApiMessageEntityTypes.Spoiler]: 'span',
} as const;

interface TextEditorProps {
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  id?: string;
  className?: string;
  onKeyDown?: React.KeyboardEventHandler
  ariaLabel?: string;
  onFocus?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  textRendererRef?: React.RefObject<HTMLElement>;
  getText: () => string;
  setText: (text: string) => void;
}

interface Selection {
  start: number;
  end: number;
}

interface CaretCoordinates {
  left: number;
  top: number;
}

interface ASTNode {
  type: 'text' | 'root' | ApiMessageEntityTypes;
  value?: string;
  children?: ASTNode[];
  url?: string;
  markers?: Marker[];
}

interface Marker {
  start: number;
  end: number;
  openSymbol: string;
  closeSymbol: string;
}

interface Token {
  type: 'text' | ApiMessageEntityTypes;
  value?: string;
  symbol?: string;
  text?: string;
  url?: string;
  children?: Token[];
}

function parseAstAsFormattedText(ast: ASTNode): ApiFormattedText {
  // Сначала обрабатываем AST, удаляя лишние пробелы
  function trimAst(node: ASTNode): ASTNode {
    if (node.type === 'text') {
      return {
        ...node,
        value: node.value?.trim(),
      };
    }

    if (node.children) {
      // Фильтруем пустые текстовые узлы и применяем trim к остальным
      const trimmedChildren = node.children
        .map(trimAst)
        .filter((child) => child.type !== 'text' || (child.value && child.value.trim()));

      return {
        ...node,
        children: trimmedChildren,
      };
    }

    return node;
  }

  const trimmedAst = trimAst(ast);

  let text = '';
  const entities: ApiMessageEntity[] = [];

  function processNode(node: ASTNode): number {
    const startPosition = text.length;

    switch (node.type) {
      case 'root':
        node.children?.forEach((child) => {
          processNode(child);
        });
        break;

      case 'text':
        text += node.value || '';
        break;

      case ApiMessageEntityTypes.Pre: {
        const value = node.value || '';
        text += value;
        if (value) {
          entities.push({
            type: node.type,
            offset: startPosition,
            length: value.length,
            language: node.language,
          });
        }
        break;
      }

      case ApiMessageEntityTypes.Blockquote: {
        const blockStart = text.length;
        node.children?.forEach((child) => {
          processNode(child);
        });
        const length = text.length - blockStart;
        if (length > 0) {
          entities.push({
            type: node.type,
            offset: blockStart,
            length,
          });
        }
        break;
      }

      case ApiMessageEntityTypes.Code: {
        const value = node.value || '';
        text += value;
        if (value) {
          entities.push({
            type: node.type,
            offset: startPosition,
            length: value.length,
          });
        }
        break;
      }

      case ApiMessageEntityTypes.TextUrl: {
        const value = node.value || '';
        text += value;
        if (value) {
          entities.push({
            type: node.type,
            offset: startPosition,
            length: value.length,
            url: node.url,
          });
        }
        break;
      }

      case ApiMessageEntityTypes.CustomEmoji: {
        const value = node.value || '';
        text += value;
        if (value) {
          entities.push({
            type: node.type,
            offset: startPosition,
            length: value.length,
            documentId: node.documentId!,
          });
        }
        break;
      }

      case ApiMessageEntityTypes.Mention: {
        const value = node.value || '';
        text += value;
        if (value) {
          entities.push({
            type: node.type,
            offset: startPosition,
            length: value.length,
          });
        }
        break;
      }

      case ApiMessageEntityTypes.Bold:
      case ApiMessageEntityTypes.Italic:
      case ApiMessageEntityTypes.Strike:
      case ApiMessageEntityTypes.Underline:
      case ApiMessageEntityTypes.Spoiler: {
        const formatStart = text.length;
        node.children?.forEach((child) => {
          processNode(child);
        });
        const length = text.length - formatStart;
        if (length > 0) {
          entities.push({
            type: node.type,
            offset: formatStart,
            length,
          });
        }
        break;
      }
    }

    return startPosition;
  }

  processNode(trimmedAst);

  // Sort entities by offset and handle nested entities
  entities.sort((a, b) => {
    if (a.offset !== b.offset) {
      return a.offset - b.offset;
    }
    return b.length - a.length;
  });

  return {
    text,
    entities: entities.length > 0 ? entities : undefined,
  };
}

function tokenize(input: string, isNested: boolean = false): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  // eslint-disable-next-line @typescript-eslint/no-shadow
  function isEscaped(pos: number): boolean {
    let backslashCount = 0;
    let i = pos - 1;
    while (i >= 0 && input[i] === '\\') {
      backslashCount++;
      i--;
    }
    return backslashCount % 2 === 1;
  }

  function findClosingSymbol(symbol: string, startPos: number): number {
    let newPos = startPos;
    while (newPos < input.length) {
      if (input.startsWith(symbol, newPos) && !isEscaped(newPos)) {
        return newPos;
      }
      newPos++;
    }
    return -1;
  }

  function handleBlockQuoteOrPre(): { token: Token; newPos: number } | undefined {
    if (!input.startsWith('```', pos) || isEscaped(pos) || isNested) {
      return undefined;
    }

    let currentPos = pos + 3;
    let isQuote = false;

    if (input[currentPos] === 'q' && input[currentPos + 1] === ' ') {
      isQuote = true;
      currentPos += 2;
    }

    if (input[currentPos] === '\n') {
      currentPos++;
    }

    const endPos = findClosingSymbol('```', currentPos);
    if (endPos === -1) {
      return undefined;
    }

    const content = input.slice(currentPos, endPos);
    const type = isQuote ? ApiMessageEntityTypes.Blockquote : ApiMessageEntityTypes.Pre;

    return {
      token: {
        type,
        value: type === ApiMessageEntityTypes.Pre ? content : undefined,
        children: type === ApiMessageEntityTypes.Blockquote ? tokenize(content, true) : undefined,
      },
      newPos: endPos + 3,
    };
  }

  function handleInlineCode(): { token: Token; newPos: number } | undefined {
    if (input[pos] !== '`' || isEscaped(pos)) {
      return undefined;
    }

    const endPos = findClosingSymbol('`', pos + 1);
    if (endPos === -1) {
      return undefined;
    }

    const content = input.slice(pos + 1, endPos);

    // Don't parse if empty or contains newline
    if (content.length === 0 || content.includes('\n')) {
      return undefined;
    }

    return {
      token: {
        type: ApiMessageEntityTypes.Code,
        value: content,
      },
      newPos: endPos + 1,
    };
  }

  function handleTextUrl(): { token: Token; newPos: number } | undefined {
    const isEmoji = input[pos] === '!' && input[pos + 1] === '[';
    if ((!isEmoji && input[pos] !== '[') || isEscaped(pos)) {
      return undefined;
    }
    const textStart = isEmoji ? pos + 2 : pos + 1;
    const textEnd = findClosingSymbol(']', textStart);

    if (textEnd === -1) {
      return undefined;
    }
    if (input[textEnd + 1] !== '(') {
      return undefined;
    }

    const urlStart = textEnd + 2;
    const urlEnd = findClosingSymbol(')', urlStart);

    if (urlEnd === -1) {
      return undefined;
    }

    return {
      token: {
        type: isEmoji ? ApiMessageEntityTypes.CustomEmoji : ApiMessageEntityTypes.TextUrl,
        value: input.slice(textStart, textEnd),
        url: input.slice(urlStart, urlEnd),
      },
      newPos: urlEnd + 1,
    };
  }

  function handleMention(): { token: Token; newPos: number } | undefined {
    if (input[pos] !== '@' || isEscaped(pos)) return undefined;

    let end = pos + 1;
    while (end < input.length && /[a-zA-Z0-9_]/.test(input[end])) {
      end++;
    }

    if (end === pos + 1) {
      return undefined;
    }

    return {
      token: {
        type: ApiMessageEntityTypes.Mention,
        value: input.slice(pos + 1, end),
      },
      newPos: end,
    };
  }

  function handleFormatting(): { token: Token; newPos: number } | undefined {
    const formatters = [
      { symbol: '**', type: ApiMessageEntityTypes.Bold },
      { symbol: '*', type: ApiMessageEntityTypes.Italic },
      { symbol: '~~', type: ApiMessageEntityTypes.Strike },
      { symbol: '__', type: ApiMessageEntityTypes.Underline },
      { symbol: '||', type: ApiMessageEntityTypes.Spoiler },
    ];

    for (const { symbol, type } of formatters) {
      if (!input.startsWith(symbol, pos) || isEscaped(pos)) continue;

      const endPos = findClosingSymbol(symbol, pos + symbol.length);
      if (endPos === -1) continue;

      const innerContent = input.slice(pos + symbol.length, endPos);
      const children = tokenize(innerContent, isNested);

      return {
        token: {
          type,
          children,
        },
        newPos: endPos + symbol.length,
      };
    }

    return undefined;
  }

  while (pos < input.length) {
    if (input[pos] === '\\' && pos + 1 < input.length) {
      tokens.push({ type: 'text', value: input[pos + 1] });
      pos += 2;
      continue;
    }

    const blockResult = handleBlockQuoteOrPre();
    if (blockResult) {
      tokens.push(blockResult.token);
      pos = blockResult.newPos;
      continue;
    }

    const codeResult = handleInlineCode();
    if (codeResult) {
      tokens.push(codeResult.token);
      pos = codeResult.newPos;
      continue;
    }

    const urlResult = handleTextUrl();
    if (urlResult) {
      tokens.push(urlResult.token);
      pos = urlResult.newPos;
      continue;
    }

    const mentionResult = handleMention();
    if (mentionResult) {
      tokens.push(mentionResult.token);
      pos = mentionResult.newPos;
      continue;
    }

    const formattingResult = handleFormatting();
    if (formattingResult) {
      tokens.push(formattingResult.token);
      pos = formattingResult.newPos;
      continue;
    }

    let textEnd = pos + 1;
    while (textEnd < input.length) {
      const nextChar = input[textEnd];
      if ('\\*_~`[|@!'.includes(nextChar) && !isEscaped(textEnd)) {
        break;
      }
      textEnd++;
    }

    tokens.push({
      type: 'text',
      value: input.slice(pos, textEnd),
    });
    pos = textEnd;
  }

  return tokens;
}

function parse(tokens: Token[]): ASTNode {
  function processToken(token: Token): ASTNode {
    const node: ASTNode = {
      type: token.type,
      value: token.value,
      language: token.language,
      url: token.url,
    };

    if (token.children) {
      node.children = token.children.map(processToken);
    }

    return node;
  }

  function mergeTextNodes(nodes: ASTNode[]): ASTNode[] {
    const result: ASTNode[] = [];
    let currentTextNode: ASTNode | undefined;

    for (const node of nodes) {
      if (node.type === 'text') {
        if (currentTextNode) {
          currentTextNode.value = (currentTextNode.value || '') + (node.value || '');
        } else {
          currentTextNode = node;
          result.push(currentTextNode);
        }
      } else {
        currentTextNode = undefined;
        if (node.children) {
          node.children = mergeTextNodes(node.children);
        }
        result.push(node);
      }
    }

    return result;
  }

  const processedNodes = tokens.map(processToken);
  const mergedNodes = mergeTextNodes(processedNodes);

  return {
    type: 'root',
    children: mergedNodes,
  };
}

function renderAst(node: ASTNode, selection: Selection): string {
  const result: string[] = [];
  let currentLine = '';
  let currentPosition = 0;
  let needNewLineStart = false;

  const processTextNode = (text: string, start: number): string => {
    let line = '';
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const currentPos = start + i;
      const isSelected = currentPos >= selection.start && currentPos < selection.end;

      if (char === ' ') {
        line += `<span class="space${isSelected ? ' selected' : ''}" data-offset="${currentPos}"> </span>`;
      } else if (char === '\n') {
        line += `<span class="newline${isSelected ? ' selected' : ''}" data-offset="${currentPos}"></span>`;
        needNewLineStart = true;
      } else {
        const escapedChar = escapeHtml(char);
        line += `<span${isSelected ? ' class="selected"' : ''} data-offset="${currentPos}">${escapedChar}</span>`;
      }
    }
    return line;
  };

  const processMarkupSymbols = (symbols: string, start: number): string => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    let result = '';
    for (let i = 0; i < symbols.length; i++) {
      const currentPos = start + i;
      const isSelected = currentPos >= selection.start && currentPos < selection.end;
      // eslint-disable-next-line max-len
      result += `<span class="markup-symbol${isSelected ? ' selected' : ''}" data-offset="${currentPos}">${symbols[i]}</span>`;
    }
    return result;
  };

  const startNewLine = (virtualOffset: number) => {
    if (needNewLineStart) {
      const isSelected = virtualOffset >= selection.start && virtualOffset < selection.end;
      // eslint-disable-next-line max-len
      currentLine = `<span class="newline-start${isSelected ? ' selected' : ''}" data-virtual-offset="${virtualOffset}"></span>`;
      needNewLineStart = false;
    }
  };

  const flushLine = () => {
    if (currentLine) {
      result.push(`<div class="editor-line">${currentLine}</div>`);
      currentLine = '';
      startNewLine(currentPosition - 1);
    }
  };

  // eslint-disable-next-line max-len
  const renderBlockContent = (content: string | undefined, children: ASTNode[] | undefined, tag: string, type: ApiMessageEntityTypes, language?: string) => {
    const blockAttrs = language
      ? `class="code-block" data-entity-type="${type}" data-language="${language}"`
      : `class="text-entity-blockquote" data-entity-type="${type}"`;

    result.push(`<${tag} ${blockAttrs}>`);

    if (content) {
      // For Pre blocks - render content directly
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        currentLine = processTextNode(line, currentPosition);
        currentPosition += line.length;

        if (index < lines.length - 1) {
          currentLine += processTextNode('\n', currentPosition);
          currentPosition += 1;
        }
        result.push(`<div class="editor-line">${currentLine}</div>`);
        currentLine = '';
      });
    } else if (children) {
      // For Blockquote - render children with markup
      children.forEach((child) => renderNode(child));
      flushLine();
    }

    result.push(`</${tag}>`);
  };

  // eslint-disable-next-line @typescript-eslint/no-shadow
  function renderNode(node: ASTNode): void {
    switch (node.type) {
      case 'root':
        node.children?.forEach((child) => renderNode(child));
        flushLine();
        break;

      case 'text': {
        const text = node.value || '';
        const lines = text.split('\n');

        lines.forEach((line, index) => {
          currentLine += processTextNode(line, currentPosition);
          currentPosition += line.length;

          if (index < lines.length - 1) {
            currentLine += processTextNode('\n', currentPosition);
            currentPosition += 1;
            flushLine();
          }
        });
        break;
      }

      case ApiMessageEntityTypes.Pre: {
        flushLine();
        const language = node.language ? `[${node.language}]` : '';

        currentLine += processMarkupSymbols(`\`\`\`${language}\n`, currentPosition);
        currentPosition += 3 + language.length + 1;
        flushLine();

        renderBlockContent(node.value, undefined, 'pre', node.type, node.language);

        currentLine = processMarkupSymbols('\n```', currentPosition);
        currentPosition += 4;
        flushLine();
        break;
      }

      case ApiMessageEntityTypes.Blockquote: {
        flushLine();

        currentLine += processMarkupSymbols('```\n', currentPosition);
        currentPosition += 4;
        flushLine();

        renderBlockContent(undefined, node.children, 'blockquote', node.type);

        currentLine = processMarkupSymbols('\n```', currentPosition);
        currentPosition += 4;
        flushLine();
        break;
      }

      case ApiMessageEntityTypes.Code: {
        currentLine += processMarkupSymbols('`', currentPosition);
        currentPosition += 1;

        currentLine += `<code class="text-entity-code" data-entity-type="${node.type}">`;
        currentLine += processTextNode(node.value || '', currentPosition);
        currentPosition += (node.value || '').length;
        currentLine += '</code>';

        currentLine += processMarkupSymbols('`', currentPosition);
        currentPosition += 1;
        break;
      }

      case ApiMessageEntityTypes.Bold:
      case ApiMessageEntityTypes.Italic:
      case ApiMessageEntityTypes.Strike:
      case ApiMessageEntityTypes.Underline:
      case ApiMessageEntityTypes.Spoiler: {
        const symbol = MARKUP_SYMBOLS[node.type] as string;
        const tag = HTML_TAGS[node.type];
        const className = node.type === ApiMessageEntityTypes.Spoiler ? ' class="spoiler"' : '';

        currentLine += processMarkupSymbols(symbol, currentPosition);
        currentPosition += symbol.length;

        currentLine += `<${tag}${className} data-entity-type="${node.type}">`;
        node.children?.forEach((child) => renderNode(child));
        currentLine += `</${tag}>`;

        currentLine += processMarkupSymbols(symbol, currentPosition);
        currentPosition += symbol.length;
        break;
      }

      case ApiMessageEntityTypes.TextUrl: {
        currentLine += processMarkupSymbols('[', currentPosition);
        currentPosition += 1;

        // eslint-disable-next-line max-len
        currentLine += `<a href="${escapeHtml(node.url || '')}" target="_blank" rel="noopener noreferrer" data-entity-type="${node.type}">`;
        currentLine += processTextNode(node.value || '', currentPosition);
        currentPosition += (node.value || '').length;
        currentLine += '</a>';

        const urlPart = `](${node.url})`;
        currentLine += processMarkupSymbols(urlPart, currentPosition);
        currentPosition += urlPart.length;
        break;
      }

      case ApiMessageEntityTypes.Mention: {
        currentLine += processMarkupSymbols('@', currentPosition);
        currentPosition += 1;

        currentLine += `<span class="mention" data-entity-type="${node.type}">`;
        currentLine += processTextNode(node.value || '', currentPosition);
        currentPosition += (node.value || '').length;
        currentLine += '</span>';
        break;
      }

      case ApiMessageEntityTypes.CustomEmoji: {
        currentLine += processMarkupSymbols('![', currentPosition);
        currentPosition += 2;

        const alt = escapeHtml(node.value || '');
        currentLine += processTextNode(node.value || '', currentPosition);
        currentPosition += (node.value || '').length;

        const urlPart = `](${node.url})`;
        currentLine += processMarkupSymbols(urlPart, currentPosition);
        currentPosition += urlPart.length;

        currentLine += `<img class="emoji" alt="${alt}" src="${node.url || ''}" data-entity-type="${node.type}" />`;
        break;
      }
    }
  }

  renderNode(node);
  flushLine();

  return result.join('');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseMarkup(text: string): ASTNode {
  return parse(tokenize(text));
}

const TextEditor: React.FC<TextEditorProps> = ({
  inputRef,
  id,
  className,
  textRendererRef,
  onKeyDown,
  ariaLabel,
  onFocus,
  onBlur,
  setText,
  getText,
}) => {
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  let contentRef = useRef<HTMLDivElement>();
  let textareaRef = useRef<HTMLTextAreaElement>();
  const caretRef = useRef<HTMLDivElement>();

  if (textRendererRef) {
    // @ts-ignore
    contentRef = textRendererRef as RefObject<HTMLDivElement | null>;
  }
  if (inputRef) {
    // @ts-ignore
    textareaRef = inputRef;
  }

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleSelectionChange = () => {
      if (document.activeElement === textarea) {
        setSelection({
          start: textarea.selectionStart || 0,
          end: textarea.selectionEnd || 0,
        });
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    textarea.addEventListener('input', handleSelectionChange);
    textarea.addEventListener('keyup', handleSelectionChange);
    textarea.addEventListener('focus', handleSelectionChange);

    // eslint-disable-next-line consistent-return
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      textarea.removeEventListener('input', handleSelectionChange);
      textarea.removeEventListener('keyup', handleSelectionChange);
      textarea.addEventListener('focus', handleSelectionChange);
    };
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const getPositionFromRange = (range: Range): number => {
    const container = range.startContainer;
    const offset = range.startOffset;

    if (container.nodeType === Node.TEXT_NODE) {
      const parentSpan = container.parentElement?.closest('span[data-offset]');
      if (parentSpan) {
        return Number(parentSpan.getAttribute('data-offset')!) + offset;
      }
    } else if (container.nodeType === Node.ELEMENT_NODE) {
      const element = container as Element;
      const span = element.closest('span[data-offset]');
      if (span) {
        return Number(span.getAttribute('data-offset')!) + (offset > 0 ? 1 : 0);
      }
    }

    return 0;
  };

  const handlePointerDown = (e: { clientX: number; clientY: number; target: HTMLElement; detail: number }) => {
    if (!e.target) {
      textareaRef.current!.selectionStart = 0;
      textareaRef.current!.selectionEnd = 0;
      setTimeout(() => {
        textareaRef.current!.focus();
      }, 0);
      return;
    }

    if (e.detail >= 2) {
      const line = e.target.closest('.editor-line');
      if (!line) return;

      const spans = Array.from(line.querySelectorAll('span[data-offset]'))
        .filter((span) => !span.classList.contains('newline-end'));

      if (spans.length === 0) return;

      const firstSpan = spans[0];
      const lastSpan = spans[spans.length - 1];

      const startPosition = Number(firstSpan.getAttribute('data-offset')!);
      const endPosition = Number(lastSpan.getAttribute('data-offset')!) + 1;

      textareaRef.current!.selectionStart = startPosition;
      textareaRef.current!.selectionEnd = endPosition;

      setTimeout(() => {
        textareaRef.current!.focus();
      }, 0);
      return;
    }

    // Если клик точно на пустое место в линии (не на span)
    if (e.target.classList.contains('editor-line')) {
      const clickedLine = e.target as HTMLElement;
      const spans = Array.from(clickedLine.querySelectorAll('span[data-offset]'))
        .filter((span) => !span.classList.contains('newline-end') && !span.classList.contains('newline-start'));

      if (spans.length > 0) {
        // Если есть символы, ставим каретку после последнего
        const lastSpan = spans[spans.length - 1];
        const position = Number(lastSpan.getAttribute('data-offset')!) + 1;
        textareaRef.current!.selectionStart = position;
        textareaRef.current!.selectionEnd = position;
      } else {
        // Если линия пустая, находим её позицию
        const lines = Array.from(contentRef.current!.querySelectorAll('.editor-line'));
        const currentLineIndex = lines.indexOf(clickedLine);
        let position = 0;

        for (let i = 0; i < currentLineIndex; i++) {
          const lineSpans = Array.from(lines[i].querySelectorAll('span[data-offset]'))
            .filter((span) => !span.classList.contains('newline-start'));
          if (lineSpans.length > 0) {
            const lastSpanInLine = lineSpans[lineSpans.length - 1];
            position = Number(lastSpanInLine.getAttribute('data-offset')!) + 1;
          }
        }

        textareaRef.current!.selectionStart = position;
        textareaRef.current!.selectionEnd = position;
      }

      setTimeout(() => {
        textareaRef.current!.focus();
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 50);
      }, 0);
      return;
    }

    // Для всех остальных случаев используем нативное поведение
    const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (range && textareaRef.current) {
      const position = getPositionFromRange(range);
      textareaRef.current.selectionStart = position;
      textareaRef.current.selectionEnd = position;
    }

    setTimeout(() => {
      textareaRef.current!.focus();
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }, 0);
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      if (document.activeElement !== textareaRef.current) {
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 0);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  const getCaretCoordinates = (): CaretCoordinates | null => {
    const position = textareaRef.current!.selectionStart;

    const targetNewlineSpan = contentRef.current!.querySelector(`span[data-virtual-offset="${position - 1}"]`);

    if (targetNewlineSpan) {
      const spanRect = targetNewlineSpan.getBoundingClientRect();
      const containerRect = contentRef.current!.getBoundingClientRect();
      const containerStyle = getComputedStyle(contentRef.current!);

      return {
        // eslint-disable-next-line max-len
        left: Number(containerStyle.marginLeft.replace('px', '')) + Number(containerStyle.paddingLeft.replace('px', '')),
        top: spanRect.top - containerRect.top,
      };
    }

    const previousSpan = contentRef.current!.querySelector(`span[data-offset="${position - 1}"]`);

    if (previousSpan) {
      const spanRect = previousSpan.getBoundingClientRect();
      const containerRect = contentRef.current!.getBoundingClientRect();

      return {
        left: spanRect.right - containerRect.left,
        top: spanRect.top - containerRect.top,
      };
    }

    const newlineSpan = contentRef.current!.querySelector(`span[data-virtual-offset="${position}"]`);

    if (newlineSpan) {
      const spanRect = newlineSpan.getBoundingClientRect();
      const containerRect = contentRef.current!.getBoundingClientRect();
      const containerStyle = getComputedStyle(contentRef.current!);

      return {
        // eslint-disable-next-line max-len
        left: Number(containerStyle.marginLeft.replace('px', '')) + Number(containerStyle.paddingLeft.replace('px', '')),
        top: spanRect.top - containerRect.top,
      };
    }

    const targetSpan = contentRef.current!.querySelector(`span[data-offset="${position}"]`);

    if (targetSpan) {
      const spanRect = targetSpan.getBoundingClientRect();
      const containerRect = contentRef.current!.getBoundingClientRect();

      return {
        left: spanRect.left - containerRect.left,
        top: spanRect.top - containerRect.top,
      };
    }

    const containerRect = getComputedStyle(contentRef.current!);

    return {
      left: Number(containerRect.marginLeft.replace('px', '')) + Number(containerRect.paddingLeft.replace('px', '')),
      top: Number(containerRect.marginTop.replace('px', '')) + Number(containerRect.paddingTop.replace('px', '')),
    };
  };

  const blurHandler = useCallback((event: React.FocusEvent<HTMLTextAreaElement, Element>) => {
    onBlur?.(event);
  }, [onBlur]);

  const focusHandler = useCallback((event: React.FocusEvent<HTMLTextAreaElement, Element>) => {
    onFocus?.(event);
  }, [onFocus]);

  useEffect(() => {
    if (!contentRef.current || !caretRef.current || !textareaRef?.current) return;

    const ast = parseMarkup(getText());
    const html = renderAst(ast, selection);
    contentRef.current.innerHTML = html || '<span></span>';

    if (selection.start === selection.end) {
      const coords = getCaretCoordinates();
      if (coords) {
        Object.assign(caretRef.current.style, {
          left: `${coords.left}px`,
          top: `${coords.top}px`,
          display: 'block',
        });
      }
    } else {
      caretRef.current.style.display = 'none';
    }
  }, [getText, selection]);

  return (
    <>
      <div
        ref={contentRef as React.LegacyRef<HTMLDivElement>}
        id={id}
        className={buildClassName(className, 'editor-content')}
        onMouseDown={handlePointerDown as unknown as React.MouseEventHandler<HTMLDivElement>}
        // onClick={onClick}
        // onContextMenu={onContextMenu}
        // onTouchCancel={onTouchCancel}
        aria-label={ariaLabel}
      />
      <textarea
        ref={textareaRef as React.LegacyRef<HTMLTextAreaElement>}
        className={buildClassName(className, 'editor-textarea')}
        value={getText()}
        onChange={handleInput}
        spellCheck={false}
        onFocus={focusHandler as unknown as React.FocusEventHandler<HTMLTextAreaElement>}
        onKeyDown={onKeyDown}
        onBlur={blurHandler as unknown as React.FocusEventHandler<HTMLTextAreaElement>}
      />
      <div ref={caretRef as React.LegacyRef<HTMLDivElement>} className="caret" />
    </>
  );
};
const INPUT_CUSTOM_EMOJI_SELECTOR = 'img[data-document-id]';

export type TextFormatterProps = {
  isOpen: boolean;
  anchorPosition?: IAnchorPosition;
  selectedRange?: Range;
  setSelectedRange: (range: Range) => void;
  onClose: () => void;
};

interface ISelectedTextFormats {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  monospace?: boolean;
  spoiler?: boolean;
}

const TEXT_FORMAT_BY_TAG_NAME: Record<string, keyof ISelectedTextFormats> = {
  B: 'bold',
  STRONG: 'bold',
  I: 'italic',
  EM: 'italic',
  U: 'underline',
  DEL: 'strikethrough',
  CODE: 'monospace',
  SPAN: 'spoiler',
};
const fragmentEl = document.createElement('div');

const TextFormatter: FC<TextFormatterProps> = ({
  isOpen,
  anchorPosition,
  selectedRange,
  setSelectedRange,
  onClose,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const linkUrlInputRef = useRef<HTMLInputElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransitionDeprecated(isOpen);
  const [isLinkControlOpen, openLinkControl, closeLinkControl] = useFlag();
  const [linkUrl, setLinkUrl] = useState('');
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [inputClassName, setInputClassName] = useState<string | undefined>();
  const [selectedTextFormats, setSelectedTextFormats] = useState<ISelectedTextFormats>({});

  useEffect(() => (isOpen ? captureEscKeyListener(onClose) : undefined), [isOpen, onClose]);
  useVirtualBackdrop(
    isOpen,
    containerRef,
    onClose,
    true,
  );

  useEffect(() => {
    if (isLinkControlOpen) {
      linkUrlInputRef.current!.focus();
    } else {
      setLinkUrl('');
      setIsEditingLink(false);
    }
  }, [isLinkControlOpen]);

  useEffect(() => {
    if (!shouldRender) {
      closeLinkControl();
      setSelectedTextFormats({});
      setInputClassName(undefined);
    }
  }, [closeLinkControl, shouldRender]);

  useEffect(() => {
    if (!isOpen || !selectedRange) {
      return;
    }

    const selectedFormats: ISelectedTextFormats = {};
    let { parentElement } = selectedRange.commonAncestorContainer;
    while (parentElement && parentElement.id !== EDITABLE_INPUT_ID) {
      const textFormat = TEXT_FORMAT_BY_TAG_NAME[parentElement.tagName];
      if (textFormat) {
        selectedFormats[textFormat] = true;
      }

      parentElement = parentElement.parentElement;
    }

    setSelectedTextFormats(selectedFormats);
  }, [isOpen, selectedRange, openLinkControl]);

  const restoreSelection = useLastCallback(() => {
    if (!selectedRange) {
      return;
    }

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(selectedRange);
    }
  });

  const updateSelectedRange = useLastCallback(() => {
    const selection = window.getSelection();
    if (selection) {
      setSelectedRange(selection.getRangeAt(0));
    }
  });

  const getSelectedText = useLastCallback((shouldDropCustomEmoji?: boolean) => {
    if (!selectedRange) {
      return undefined;
    }
    fragmentEl.replaceChildren(selectedRange.cloneContents());
    if (shouldDropCustomEmoji) {
      fragmentEl.querySelectorAll(INPUT_CUSTOM_EMOJI_SELECTOR).forEach((el) => {
        el.replaceWith(el.getAttribute('alt')!);
      });
    }
    return fragmentEl.innerHTML;
  });

  const getSelectedElement = useLastCallback(() => {
    if (!selectedRange) {
      return undefined;
    }

    return selectedRange.commonAncestorContainer.parentElement;
  });

  function updateInputStyles() {
    const input = linkUrlInputRef.current;
    if (!input) {
      return;
    }

    const { offsetWidth, scrollWidth, scrollLeft } = input;
    if (scrollWidth <= offsetWidth) {
      setInputClassName(undefined);
      return;
    }

    let className = '';
    if (scrollLeft < scrollWidth - offsetWidth) {
      className = 'mask-right';
    }
    if (scrollLeft > 0) {
      className += ' mask-left';
    }

    setInputClassName(className);
  }

  function handleLinkUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLinkUrl(e.target.value);
    updateInputStyles();
  }

  function getFormatButtonClassName(key: keyof ISelectedTextFormats) {
    if (selectedTextFormats[key]) {
      return 'active';
    }

    if (key === 'monospace' || key === 'strikethrough') {
      if (Object.keys(selectedTextFormats).some(
        (fKey) => fKey !== key && Boolean(selectedTextFormats[fKey as keyof ISelectedTextFormats]),
      )) {
        return 'disabled';
      }
    } else if (selectedTextFormats.monospace || selectedTextFormats.strikethrough) {
      return 'disabled';
    }

    return undefined;
  }

  const handleSpoilerText = useLastCallback(() => {
    if (selectedTextFormats.spoiler) {
      const element = getSelectedElement();
      if (
        !selectedRange
        || !element
        || element.dataset.entityType !== ApiMessageEntityTypes.Spoiler
        || !element.textContent
      ) {
        return;
      }

      element.replaceWith(element.textContent);
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        spoiler: false,
      }));

      return;
    }

    const text = getSelectedText();
    document.execCommand(
      'insertHTML', false, `<span class="spoiler" data-entity-type="${ApiMessageEntityTypes.Spoiler}">${text}</span>`,
    );
    onClose();
  });

  const handleBoldText = useLastCallback(() => {
    setSelectedTextFormats((selectedFormats) => {
      // Somehow re-applying 'bold' command to already bold text doesn't work
      document.execCommand(selectedFormats.bold ? 'removeFormat' : 'bold');
      Object.keys(selectedFormats).forEach((key) => {
        if ((key === 'italic' || key === 'underline') && Boolean(selectedFormats[key])) {
          document.execCommand(key);
        }
      });

      updateSelectedRange();
      return {
        ...selectedFormats,
        bold: !selectedFormats.bold,
      };
    });
  });

  const handleItalicText = useLastCallback(() => {
    document.execCommand('italic');
    updateSelectedRange();
    setSelectedTextFormats((selectedFormats) => ({
      ...selectedFormats,
      italic: !selectedFormats.italic,
    }));
  });

  const handleUnderlineText = useLastCallback(() => {
    document.execCommand('underline');
    updateSelectedRange();
    setSelectedTextFormats((selectedFormats) => ({
      ...selectedFormats,
      underline: !selectedFormats.underline,
    }));
  });

  const handleStrikethroughText = useLastCallback(() => {
    if (selectedTextFormats.strikethrough) {
      const element = getSelectedElement();
      if (
        !selectedRange
        || !element
        || element.tagName !== 'DEL'
        || !element.textContent
      ) {
        return;
      }

      element.replaceWith(element.textContent);
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        strikethrough: false,
      }));

      return;
    }

    const text = getSelectedText();
    document.execCommand('insertHTML', false, `<del>${text}</del>`);
    onClose();
  });

  const handleMonospaceText = useLastCallback(() => {
    if (selectedTextFormats.monospace) {
      const element = getSelectedElement();
      if (
        !selectedRange
        || !element
        || element.tagName !== 'CODE'
        || !element.textContent
      ) {
        return;
      }

      element.replaceWith(element.textContent);
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        monospace: false,
      }));

      return;
    }

    const text = getSelectedText(true);
    document.execCommand('insertHTML', false, `<code class="text-entity-code" dir="auto">${text}</code>`);
    onClose();
  });

  const handleLinkUrlConfirm = useLastCallback(() => {
    const formattedLinkUrl = (ensureProtocol(linkUrl) || '').split('%').map(encodeURI).join('%');

    if (isEditingLink) {
      const element = getSelectedElement();
      if (!element || element.tagName !== 'A') {
        return;
      }

      (element as HTMLAnchorElement).href = formattedLinkUrl;

      onClose();

      return;
    }

    const text = getSelectedText(true);
    restoreSelection();
    document.execCommand(
      'insertHTML',
      false,
      `<a href=${formattedLinkUrl} class="text-entity-link" dir="auto">${text}</a>`,
    );
    onClose();
  });

  const handleKeyDown = useLastCallback((e: KeyboardEvent) => {
    const HANDLERS_BY_KEY: Record<string, AnyToVoidFunction> = {
      k: openLinkControl,
      b: handleBoldText,
      u: handleUnderlineText,
      i: handleItalicText,
      m: handleMonospaceText,
      s: handleStrikethroughText,
      p: handleSpoilerText,
    };

    const handler = HANDLERS_BY_KEY[getKeyFromEvent(e)];

    if (
      e.altKey
      || !(e.ctrlKey || e.metaKey)
      || !handler
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    handler();
  });

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  const lang = useOldLang();

  function handleContainerKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && isLinkControlOpen) {
      handleLinkUrlConfirm();
      e.preventDefault();
    }
  }

  if (!shouldRender) {
    return undefined;
  }

  const className = buildClassName(
    'TextFormatter',
    transitionClassNames,
    isLinkControlOpen && 'link-control-shown',
  );

  const linkUrlConfirmClassName = buildClassName(
    'TextFormatter-link-url-confirm',
    Boolean(linkUrl.length) && 'shown',
  );

  const style = anchorPosition
    ? `left: ${anchorPosition.x}px; top: ${anchorPosition.y}px;--text-formatter-left: ${anchorPosition.x}px;`
    : '';

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      onKeyDown={handleContainerKeyDown}
      // Prevents focus loss when clicking on the toolbar
      onMouseDown={stopEvent}
    >
      <div className="TextFormatter-buttons">
        <Button
          color="translucent"
          ariaLabel="Spoiler text"
          className={getFormatButtonClassName('spoiler')}
          onClick={handleSpoilerText}
        >
          <Icon name="eye-closed" />
        </Button>
        <div className="TextFormatter-divider" />
        <Button
          color="translucent"
          ariaLabel="Bold text"
          className={getFormatButtonClassName('bold')}
          onClick={handleBoldText}
        >
          <Icon name="bold" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Italic text"
          className={getFormatButtonClassName('italic')}
          onClick={handleItalicText}
        >
          <Icon name="italic" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Underlined text"
          className={getFormatButtonClassName('underline')}
          onClick={handleUnderlineText}
        >
          <Icon name="underlined" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Strikethrough text"
          className={getFormatButtonClassName('strikethrough')}
          onClick={handleStrikethroughText}
        >
          <Icon name="strikethrough" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Monospace text"
          className={getFormatButtonClassName('monospace')}
          onClick={handleMonospaceText}
        >
          <Icon name="monospace" />
        </Button>
        <div className="TextFormatter-divider" />
        <Button color="translucent" ariaLabel={lang('TextFormat.AddLinkTitle')} onClick={openLinkControl}>
          <Icon name="link" />
        </Button>
      </div>

      <div className="TextFormatter-link-control">
        <div className="TextFormatter-buttons">
          <Button color="translucent" ariaLabel={lang('Cancel')} onClick={closeLinkControl}>
            <Icon name="arrow-left" />
          </Button>
          <div className="TextFormatter-divider" />

          <div
            className={buildClassName('TextFormatter-link-url-input-wrapper', inputClassName)}
          >
            <input
              ref={linkUrlInputRef}
              className="TextFormatter-link-url-input"
              type="text"
              value={linkUrl}
              placeholder="Enter URL..."
              autoComplete="off"
              inputMode="url"
              dir="auto"
              onChange={handleLinkUrlChange}
              onScroll={updateInputStyles}
            />
          </div>

          <div className={linkUrlConfirmClassName}>
            <div className="TextFormatter-divider" />
            <Button
              color="translucent"
              ariaLabel={lang('Save')}
              className="color-primary"
              onClick={handleLinkUrlConfirm}
            >
              <Icon name="check" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CONTEXT_MENU_CLOSE_DELAY_MS = 100;
// Focus slows down animation, also it breaks transition layout in Chrome
const FOCUS_DELAY_MS = 350;
const TRANSITION_DURATION_FACTOR = 50;

const SCROLLER_CLASS = 'input-scroller';
const INPUT_WRAPPER_CLASS = 'message-input-wrapper';

type MessageInputOwnProps = {
  ref?: RefObject<HTMLTextAreaElement>;
  id: string;
  chatId: string;
  threadId: ThreadId;
  isAttachmentModalInput?: boolean;
  isStoryInput?: boolean;
  customEmojiPrefix: string;
  editableInputId?: string;
  isReady: boolean;
  isActive: boolean;
  getHtml: Signal<string>;
  placeholder: string;
  timedPlaceholderLangKey?: string;
  timedPlaceholderDate?: number;
  forcedPlaceholder?: string;
  noFocusInterception?: boolean;
  canAutoFocus: boolean;
  shouldSuppressFocus?: boolean;
  shouldSuppressTextFormatter?: boolean;
  canSendPlainText?: boolean;
  onUpdate: (html: string) => void;
  onSuppressedFocus?: () => void;
  onSend: () => void;
  onScroll?: (event: React.UIEvent<HTMLElement>) => void;
  captionLimit?: number;
  onFocus?: NoneToVoidFunction;
  onBlur?: NoneToVoidFunction;
  isNeedPremium?: boolean;
};

type MessageInputStateProps = {
  replyInfo?: ApiInputMessageReplyInfo;
  isSelectModeActive?: boolean;
  messageSendKeyCombo?: ISettings['messageSendKeyCombo'];
  canPlayAnimatedEmojis: boolean;
};

const MAX_ATTACHMENT_MODAL_INPUT_HEIGHT = 160;
const MAX_STORY_MODAL_INPUT_HEIGHT = 128;
const TAB_INDEX_PRIORITY_TIMEOUT = 2000;
// Heuristics allowing the user to make a triple click
const SELECTION_RECALCULATE_DELAY_MS = 260;
const TEXT_FORMATTER_SAFE_AREA_PX = 140;
// For some reason Safari inserts `<br>` after user removes text from input
const SAFARI_BR = '<br>';
const IGNORE_KEYS = [
  'Esc', 'Escape', 'Enter', 'PageUp', 'PageDown', 'Meta', 'Alt', 'Ctrl', 'ArrowDown', 'ArrowUp', 'Control', 'Shift',
];

function clearSelection() {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  if (selection.removeAllRanges) {
    selection.removeAllRanges();
  } else if (selection.empty) {
    selection.empty();
  }
}

const MessageInput: FC<MessageInputOwnProps & MessageInputStateProps> = ({
  ref,
  id,
  chatId,
  captionLimit,
  isAttachmentModalInput,
  isStoryInput,
  customEmojiPrefix,
  editableInputId,
  isReady,
  isActive,
  getHtml,
  placeholder,
  timedPlaceholderLangKey,
  timedPlaceholderDate,
  forcedPlaceholder,
  canSendPlainText,
  canAutoFocus,
  noFocusInterception,
  shouldSuppressFocus,
  shouldSuppressTextFormatter,
  replyInfo,
  isSelectModeActive,
  canPlayAnimatedEmojis,
  messageSendKeyCombo,
  onUpdate,
  onSuppressedFocus,
  onSend,
  onScroll,
  onFocus,
  onBlur,
  isNeedPremium,
}) => {
  const {
    editLastMessage,
    replyToNextMessage,
    showAllowedMessageTypesNotification,
    openPremiumModal,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  let inputRef = useRef<HTMLTextAreaElement>(null);
  if (ref) {
    inputRef = ref;
  }

  // eslint-disable-next-line no-null/no-null
  const selectionTimeoutRef = useRef<number>(null);
  // eslint-disable-next-line no-null/no-null
  const cloneRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const scrollerCloneRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasHqRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const absoluteContainerRef = useRef<HTMLDivElement>(null);

  const lang = useOldLang();
  const isContextMenuOpenRef = useRef(false);
  const [isTextFormatterOpen, openTextFormatter, closeTextFormatter] = useFlag();
  const [textFormatterAnchorPosition, setTextFormatterAnchorPosition] = useState<IAnchorPosition>();
  const [selectedRange, setSelectedRange] = useState<Range>();
  const [isTextFormatterDisabled, setIsTextFormatterDisabled] = useState<boolean>(false);
  const { isMobile } = useAppLayout();
  const isMobileDevice = isMobile && (IS_IOS || IS_ANDROID);

  const [shouldDisplayTimer, setShouldDisplayTimer] = useState(false);

  useEffect(() => {
    setShouldDisplayTimer(Boolean(timedPlaceholderLangKey && timedPlaceholderDate));
  }, [timedPlaceholderDate, timedPlaceholderLangKey]);

  const handleTimerEnd = useLastCallback(() => {
    setShouldDisplayTimer(false);
  });

  useInputCustomEmojis(
    getHtml,
    inputRef,
    sharedCanvasRef,
    sharedCanvasHqRef,
    absoluteContainerRef,
    customEmojiPrefix,
    canPlayAnimatedEmojis,
    isReady,
    isActive,
  );

  const textRendererRef = useRef<HTMLDivElement>();
  const maxInputHeight = isAttachmentModalInput
    ? MAX_ATTACHMENT_MODAL_INPUT_HEIGHT
    : isStoryInput ? MAX_STORY_MODAL_INPUT_HEIGHT : (isMobile ? 256 : 416);
  const updateInputHeight = useCallback((willSend = false) => {
    requestForcedReflow(() => {
      const scroller = inputRef.current!.closest<HTMLDivElement>(`.${SCROLLER_CLASS}`)!;
      const currentHeight = Number(scroller.style.height.replace('px', ''));
      const scrollHeight = inputRef.current!.scrollHeight;
      const newHeight = Math.min(scrollHeight, maxInputHeight);

      if (newHeight === currentHeight) {
        return undefined;
      }

      const isOverflown = scrollHeight > maxInputHeight;

      function exec() {
        const transitionDuration = Math.round(
          TRANSITION_DURATION_FACTOR * Math.log(Math.abs(newHeight - currentHeight)),
        );
        scroller.style.height = `${newHeight}px`;
        scroller.style.transitionDuration = `${transitionDuration}ms`;
        scroller.classList.toggle('overflown', isOverflown);
      }

      if (willSend) {
        // Delay to next frame to sync with sending animation
        requestMutation(exec);
        return undefined;
      } else {
        return exec;
      }
    });
  }, [maxInputHeight]);

  useEffect(() => {
    if (!isAttachmentModalInput) return;
    updateInputHeight(false);
  }, [isAttachmentModalInput, updateInputHeight]);

  const htmlRef = useRef(getHtml());

  useLayoutEffect(() => {
    const html = isActive ? getHtml() : '';

    if (html !== inputRef.current!.innerHTML) {
      inputRef.current!.innerHTML = html;
    }

    if (html !== cloneRef.current!.innerHTML) {
      cloneRef.current!.innerHTML = html;
    }

    if (html !== htmlRef.current) {
      htmlRef.current = html;

      updateInputHeight(!html);
    }
  }, [getHtml, isActive, updateInputHeight]);

  const textareaRef = useRef<HTMLTextAreaElement>();
  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;
  const focusInput = useLastCallback(() => {
    if (!textareaRef?.current || isNeedPremium) {
      return;
    }

    if (getIsHeavyAnimating()) {
      setTimeout(focusInput, FOCUS_DELAY_MS);
      return;
    }

    focusEditableElement(textareaRef.current!);
  });

  const handleCloseTextFormatter = useLastCallback(() => {
    closeTextFormatter();
    clearSelection();
  });

  function checkSelection() {
    // Disable the formatter on iOS devices for now.
    if (IS_IOS) {
      return false;
    }

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || isContextMenuOpenRef.current) {
      closeTextFormatter();
      if (IS_ANDROID) {
        setIsTextFormatterDisabled(false);
      }
      return false;
    }

    const selectionRange = selection.getRangeAt(0);
    const selectedText = selectionRange.toString().trim();
    if (
      shouldSuppressTextFormatter
      || !isSelectionInsideInput(selectionRange, editableInputId || EDITABLE_INPUT_ID)
      || !selectedText
      || parseEmojiOnlyString(selectedText)
      || !selectionRange.START_TO_END
    ) {
      closeTextFormatter();
      return false;
    }

    return true;
  }

  function processSelection() {
    if (!checkSelection()) {
      return;
    }

    if (isTextFormatterDisabled) {
      return;
    }

    const selectionRange = window.getSelection()!.getRangeAt(0);
    const selectionRect = selectionRange.getBoundingClientRect();
    const scrollerRect = inputRef.current!.closest<HTMLDivElement>(`.${SCROLLER_CLASS}`)!.getBoundingClientRect();

    let x = (selectionRect.left + selectionRect.width / 2) - scrollerRect.left;

    if (x < TEXT_FORMATTER_SAFE_AREA_PX) {
      x = TEXT_FORMATTER_SAFE_AREA_PX;
    } else if (x > scrollerRect.width - TEXT_FORMATTER_SAFE_AREA_PX) {
      x = scrollerRect.width - TEXT_FORMATTER_SAFE_AREA_PX;
    }

    setTextFormatterAnchorPosition({
      x,
      y: selectionRect.top - scrollerRect.top,
    });

    setSelectedRange(selectionRange);
    openTextFormatter();
  }

  function processSelectionWithTimeout() {
    if (selectionTimeoutRef.current) {
      window.clearTimeout(selectionTimeoutRef.current);
    }
    // Small delay to allow browser properly recalculate selection
    selectionTimeoutRef.current = window.setTimeout(processSelection, SELECTION_RECALCULATE_DELAY_MS);
  }

  useLayoutEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.position = 'absolute';
      textareaRef.current.style.top = '-80px';
    }
  }, []);

  // function handleMouseDown(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
  //   if (e.button !== 2) {
  //     const listenerEl = e.currentTarget.closest(`.${INPUT_WRAPPER_CLASS}`) || e.target;
  //
  //     listenerEl.addEventListener('mouseup', processSelectionWithTimeout, { once: true });
  //     return;
  //   }
  //
  //   if (isContextMenuOpenRef.current) {
  //     return;
  //   }
  //
  //   isContextMenuOpenRef.current = true;
  //
  //   function handleCloseContextMenu(e2: KeyboardEvent | MouseEvent) {
  //     if (e2 instanceof KeyboardEvent && e2.key !== 'Esc' && e2.key !== 'Escape') {
  //       return;
  //     }
  //
  //     setTimeout(() => {
  //       isContextMenuOpenRef.current = false;
  //     }, CONTEXT_MENU_CLOSE_DELAY_MS);
  //
  //     window.removeEventListener('keydown', handleCloseContextMenu);
  //     window.removeEventListener('mousedown', handleCloseContextMenu);
  //   }
  //
  //   document.addEventListener('mousedown', handleCloseContextMenu);
  //   document.addEventListener('keydown', handleCloseContextMenu);
  // }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // https://levelup.gitconnected.com/javascript-events-handlers-keyboard-and-load-events-1b3e46a6b0c3#1960
    const { isComposing } = e;

    const html = getHtml();
    if (!isComposing && !html && (e.metaKey || e.ctrlKey)) {
      const targetIndexDelta = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : undefined;
      if (targetIndexDelta) {
        e.preventDefault();

        replyToNextMessage({ targetIndexDelta });
        return;
      }
    }

    if (!isComposing && e.key === 'Enter' && !e.shiftKey) {
      if (
        !isMobileDevice
        && (
          (messageSendKeyCombo === 'enter' && !e.shiftKey)
          || (messageSendKeyCombo === 'ctrl-enter' && (e.ctrlKey || e.metaKey))
        )
      ) {
        e.preventDefault();

        closeTextFormatter();
        onSend();
      }
    } else if (!isComposing && e.key === 'ArrowUp' && !html && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      editLastMessage();
    } else {
      e.target.addEventListener('keyup', processSelectionWithTimeout, { once: true });
    }
  }

  // function handleChange(e: React.ChangeEvent<HTMLDivElement>) {
  //   const { innerHTML, textContent } = e.currentTarget;
  //
  //   onUpdate(innerHTML === SAFARI_BR ? '' : innerHTML);
  //
  //   // Reset focus on the input to remove any active styling when input is cleared
  //   if (
  //     !IS_TOUCH_ENV
  //     && (!textContent || !textContent.length)
  //     // When emojis are not supported, innerHTML contains an emoji img tag that doesn't exist in the textContext
  //     && !(!IS_EMOJI_SUPPORTED && innerHTML.includes('emoji-small'))
  //     && !(innerHTML.includes('custom-emoji'))
  //   ) {
  //     const selection = window.getSelection()!;
  //     if (selection) {
  //       inputRef.current!.blur();
  //       selection.removeAllRanges();
  //       focusEditableElement(inputRef.current!, true);
  //     }
  //   }
  // }
  //
  // function handleAndroidContextMenu(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
  //   if (!checkSelection()) {
  //     return;
  //   }
  //
  //   setIsTextFormatterDisabled(!isTextFormatterDisabled);
  //
  //   if (!isTextFormatterDisabled) {
  //     e.preventDefault();
  //     e.stopPropagation();
  //
  //     processSelection();
  //   } else {
  //     closeTextFormatter();
  //   }
  // }

  function handleClick() {
    if (isAttachmentModalInput || canSendPlainText || (isStoryInput && isNeedPremium)) return;
    showAllowedMessageTypesNotification({ chatId });
  }

  const handleOpenPremiumModal = useLastCallback(() => openPremiumModal());

  useEffect(() => {
    if (IS_TOUCH_ENV) {
      return;
    }

    if (canAutoFocus) {
      focusInput();
    }
  }, [chatId, focusInput, replyInfo, canAutoFocus]);

  useEffect(() => {
    if (
      !chatId
      || editableInputId !== EDITABLE_INPUT_ID
      || noFocusInterception
      || isMobileDevice
      || isSelectModeActive
    ) {
      return undefined;
    }

    const handleDocumentKeyDown = (e: KeyboardEvent) => {
      if (getIsDirectTextInputDisabled()) {
        return;
      }

      const { key } = e;
      const target = e.target as HTMLElement | undefined;

      if (!target || IGNORE_KEYS.includes(key)) {
        return;
      }

      const input = inputRef.current!;
      const isSelectionCollapsed = document.getSelection()?.isCollapsed;

      if (
        ((key.startsWith('Arrow') || (e.shiftKey && key === 'Shift')) && !isSelectionCollapsed)
        || (e.code === 'KeyC' && (e.ctrlKey || e.metaKey) && target.tagName !== 'INPUT')
      ) {
        return;
      }

      if (
        input
        && target !== input
        && target.tagName !== 'INPUT'
        && target.tagName !== 'TEXTAREA'
        && !target.isContentEditable
      ) {
        focusEditableElement(input, true, true);

        const newEvent = new KeyboardEvent(e.type, e as any);
        input.dispatchEvent(newEvent);
      }
    };

    document.addEventListener('keydown', handleDocumentKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown, true);
    };
  }, [chatId, editableInputId, isMobileDevice, isSelectModeActive, noFocusInterception]);

  useEffect(() => {
    const captureFirstTab = debounce((e: KeyboardEvent) => {
      if (e.key === 'Tab' && !getIsDirectTextInputDisabled()) {
        e.preventDefault();
        requestMutation(focusInput);
      }
    }, TAB_INDEX_PRIORITY_TIMEOUT, true, false);

    return captureKeyboardListeners({ onTab: captureFirstTab });
  }, [focusInput]);

  useEffect(() => {
    const input = inputRef.current!;

    function suppressFocus() {
      input.blur();
    }

    if (shouldSuppressFocus) {
      input.addEventListener('focus', suppressFocus);
    }

    return () => {
      input.removeEventListener('focus', suppressFocus);
    };
  }, [shouldSuppressFocus]);

  const isTouched = useDerivedState(() => Boolean(isActive && getHtml()), [isActive, getHtml]);

  const className = buildClassName(
    'form-control allow-selection',
    isTouched && 'touched',
    shouldSuppressFocus && 'focus-disabled',
  );

  const inputScrollerContentClass = buildClassName('input-scroller-content', isNeedPremium && 'is-need-premium');

  return (
    <div id={id} onClick={shouldSuppressFocus ? onSuppressedFocus : undefined} dir={lang.isRtl ? 'rtl' : undefined}>
      <div
        className={buildClassName('custom-scroll', SCROLLER_CLASS, isNeedPremium && 'is-need-premium')}
        onScroll={onScroll}
        onClick={!isAttachmentModalInput && !canSendPlainText ? handleClick : undefined}
      >
        <div className={inputScrollerContentClass}>
          {/* eslint-disable react/jsx-no-bind */}
          <TextEditor
            inputRef={inputRef}
            id={editableInputId || EDITABLE_INPUT_ID}
            className={className}
            textRendererRef={textRendererRef as RefObject<HTMLElement>}
            setText={onUpdate}
            getText={getHtml}
            // onClick={focusInput}
            // onChange={handleChange}
            onKeyDown={handleKeyDown}
            // onMouseDown={handleMouseDown}
            // onContextMenu={IS_ANDROID ? handleAndroidContextMenu : undefined}
            // onTouchCancel={IS_ANDROID ? processSelectionWithTimeout : undefined}
            aria-label={placeholder}
            onFocus={!isNeedPremium ? onFocus : undefined}
            onBlur={!isNeedPremium ? onBlur : undefined}
          />
          {!forcedPlaceholder && (
            <span
              className={buildClassName(
                'placeholder-text',
                !isAttachmentModalInput && !canSendPlainText && 'with-icon',
                isNeedPremium && 'is-need-premium',
              )}
              dir="auto"
            >
              {!isAttachmentModalInput && !canSendPlainText
                && <Icon name="lock-badge" className="placeholder-icon" />}
              {shouldDisplayTimer ? (
                <TextTimer langKey={timedPlaceholderLangKey!} endsAt={timedPlaceholderDate!} onEnd={handleTimerEnd} />
              ) : placeholder}
              {isStoryInput && isNeedPremium && (
                <Button className="unlock-button" size="tiny" color="adaptive" onClick={handleOpenPremiumModal}>
                  {lang('StoryRepliesLockedButton')}
                </Button>
              )}
            </span>
          )}
          <canvas ref={sharedCanvasRef} className="shared-canvas" />
          <canvas ref={sharedCanvasHqRef} className="shared-canvas" />
          <div ref={absoluteContainerRef} className="absolute-video-container" />
        </div>
      </div>
      <div
        ref={scrollerCloneRef}
        className={buildClassName('custom-scroll',
          SCROLLER_CLASS,
          'clone',
          isNeedPremium && 'is-need-premium')}
      >
        <div className={inputScrollerContentClass}>
          <div ref={cloneRef} className={buildClassName(className, 'clone')} dir="auto" />
        </div>
      </div>
      {captionLimit !== undefined && (
        <div className="max-length-indicator" dir="auto">
          {captionLimit}
        </div>
      )}
      <TextFormatter
        isOpen={isTextFormatterOpen}
        anchorPosition={textFormatterAnchorPosition}
        selectedRange={selectedRange}
        setSelectedRange={setSelectedRange}
        onClose={handleCloseTextFormatter}
      />
      {forcedPlaceholder && <span className="forced-placeholder">{renderText(forcedPlaceholder!)}</span>}
    </div>
  );
};

const LocalMessageInput = memo(withGlobal<MessageInputOwnProps>(
  (global, { chatId, threadId }: MessageInputOwnProps): MessageInputStateProps => {
    const { messageSendKeyCombo } = global.settings.byKey;

    return {
      messageSendKeyCombo,
      replyInfo: chatId && threadId ? selectDraft(global, chatId, threadId)?.replyInfo : undefined,
      isSelectModeActive: selectIsInSelectMode(global),
      canPlayAnimatedEmojis: selectCanPlayAnimatedEmojis(global),
    };
  },
)(MessageInput));

const TYPE_HTML = 'text/html';
const DOCUMENT_TYPE_WORD = 'urn:schemas-microsoft-com:office:word';
const NAMESPACE_PREFIX_WORD = 'xmlns:w';

const VALID_TARGET_IDS = new Set([EDITABLE_INPUT_ID, EDITABLE_INPUT_MODAL_ID, EDITABLE_STORY_INPUT_ID]);
const CLOSEST_CONTENT_EDITABLE_SELECTOR = 'div[contenteditable]';

const useClipboardPaste = (
  isActive: boolean,
  insertTextAndUpdateCursor: (text: ApiFormattedText, inputId?: string) => void,
  setAttachments: StateHookSetter<ApiAttachment[]>,
  setNextText: StateHookSetter<ApiFormattedText | undefined>,
  editedMessage: ApiMessage | undefined,
  shouldStripCustomEmoji?: boolean,
  onCustomEmojiStripped?: VoidFunction,
) => {
  const { showNotification } = getActions();
  const lang = useOldLang();

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    async function handlePaste(e: ClipboardEvent) {
      if (!e.clipboardData) {
        return;
      }

      const input = (e.target as HTMLElement)?.closest(CLOSEST_CONTENT_EDITABLE_SELECTOR);
      if (!input || !VALID_TARGET_IDS.has(input.id)) {
        return;
      }

      e.preventDefault();

      // Some extensions can trigger paste into their panels without focus
      if (document.activeElement !== input) {
        return;
      }

      const pastedText = e.clipboardData.getData('text');
      const html = e.clipboardData.getData('text/html');

      let pastedFormattedText = html ? parseHtmlAsFormattedText(
        preparePastedHtml(html), undefined, true,
      ) : undefined;

      if (pastedFormattedText && containsCustomEmoji(pastedFormattedText) && shouldStripCustomEmoji) {
        pastedFormattedText = stripCustomEmoji(pastedFormattedText);
        onCustomEmojiStripped?.();
      }

      const { items } = e.clipboardData;
      let files: File[] | undefined = [];

      if (items.length > 0) {
        files = await getFilesFromDataTransferItems(items);
        if (editedMessage) {
          files = files?.slice(0, 1);
        }
      }

      if (!files?.length && !pastedText) {
        return;
      }

      const textToPaste = pastedFormattedText?.entities?.length ? pastedFormattedText : { text: pastedText };

      let isWordDocument = false;
      try {
        const parser = new DOMParser();
        const parsedDocument = parser.parseFromString(html, TYPE_HTML);
        isWordDocument = parsedDocument.documentElement
          .getAttribute(NAMESPACE_PREFIX_WORD) === DOCUMENT_TYPE_WORD;
      } catch (err: any) {
        // Ignore
      }

      const hasText = textToPaste && textToPaste.text;
      let shouldSetAttachments = files?.length && !isWordDocument;

      const newAttachments = files ? await Promise.all(files.map((file) => buildAttachment(file.name, file))) : [];
      const canReplace = (editedMessage && newAttachments?.length
        && canReplaceMessageMedia(editedMessage, newAttachments[0])) || Boolean(hasText);
      const isUploadingDocumentSticker = isUploadingFileSticker(newAttachments[0]);
      const isInAlbum = editedMessage && editedMessage?.groupedId;

      if (editedMessage && isUploadingDocumentSticker) {
        showNotification({ message: lang(isInAlbum ? 'lng_edit_media_album_error' : 'lng_edit_media_invalid_file') });
        return;
      }

      if (isInAlbum) {
        shouldSetAttachments = canReplace;
        if (!shouldSetAttachments) {
          showNotification({ message: lang('lng_edit_media_album_error') });
          return;
        }
      }

      if (shouldSetAttachments) {
        setAttachments(editedMessage ? newAttachments : (attachments) => attachments.concat(newAttachments));
      }

      if (hasText) {
        if (shouldSetAttachments) {
          setNextText(textToPaste);
        } else {
          insertTextAndUpdateCursor(textToPaste, input?.id);
        }
      }
    }

    document.addEventListener('paste', handlePaste, false);

    return () => {
      document.removeEventListener('paste', handlePaste, false);
    };
  }, [
    insertTextAndUpdateCursor, editedMessage, setAttachments, isActive, shouldStripCustomEmoji,
    onCustomEmojiStripped, setNextText, lang,
  ]);
};

const Composer: FC<OwnProps & StateProps> = ({
  type,
  isOnActiveTab,
  dropAreaState,
  isInScheduledList,
  canScheduleUntilOnline,
  isReady,
  isMobile,
  onDropHide,
  onFocus,
  onBlur,
  editingMessage,
  chatId,
  threadId,
  storyId,
  currentMessageList,
  messageListType,
  draft,
  chat,
  chatFullInfo,
  replyToTopic,
  isForCurrentMessageList,
  isCurrentUserPremium,
  canSendVoiceByPrivacy,
  isChatWithBot,
  isChatWithSelf,
  isChannel,
  fileSizeLimit,
  isRightColumnShown,
  isSelectModeActive,
  isReactionPickerOpen,
  isForwarding,
  pollModal,
  botKeyboardMessageId,
  botKeyboardPlaceholder,
  inputPlaceholder,
  withScheduledButton,
  stickersForEmoji,
  customEmojiForEmoji,
  topInlineBotIds,
  currentUserId,
  currentUser,
  captionLimit,
  contentToBeScheduled,
  shouldSuggestStickers,
  shouldSuggestCustomEmoji,
  baseEmojiKeywords,
  emojiKeywords,
  recentEmojis,
  inlineBots,
  isInlineBotLoading,
  botCommands,
  sendAsUser,
  sendAsChat,
  sendAsId,
  editingDraft,
  requestedDraft,
  requestedDraftFiles,
  botMenuButton,
  attachBots,
  attachMenuPeerType,
  attachmentSettings,
  theme,
  slowMode,
  shouldUpdateStickerSetOrder,
  editableInputCssSelector,
  editableInputId,
  inputId,
  className,
  availableReactions,
  topReactions,
  canBuyPremium,
  canPlayAnimatedEmojis,
  shouldCollectDebugLogs,
  sentStoryReaction,
  stealthMode,
  canSendOneTimeMedia,
  quickReplyMessages,
  quickReplies,
  canSendQuickReplies,
  onForward,
  webPagePreview,
  noWebPage,
  isContactRequirePremium,
  effect,
  effectReactions,
  areEffectsSupported,
  canPlayEffect,
  shouldPlayEffect,
  maxMessageLength,
}) => {
  const {
    sendMessage,
    clearDraft,
    showDialog,
    forwardMessages,
    openPollModal,
    closePollModal,
    loadScheduledHistory,
    openThread,
    addRecentEmoji,
    sendInlineBotResult,
    loadSendAs,
    resetOpenChatWithDraft,
    callAttachBot,
    addRecentCustomEmoji,
    showNotification,
    showAllowedMessageTypesNotification,
    openStoryReactionPicker,
    closeReactionPicker,
    sendStoryReaction,
    editMessage,
    updateAttachmentSettings,
    saveEffectInDraft,
    setReactionEffect,
    hideEffectInComposer,
  } = getActions();

  const lang = useOldLang();

  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // eslint-disable-next-line no-null/no-null
  const storyReactionRef = useRef<HTMLButtonElement>(null);

  const [getHtml, setHtml] = useSignal('');
  const [isMounted, setIsMounted] = useState(false);
  const getSelectionRange = useGetSelectionRange(editableInputCssSelector);
  const lastMessageSendTimeSeconds = useRef<number>();
  const prevDropAreaState = usePreviousDeprecated(dropAreaState);
  const { width: windowWidth } = windowSize.get();

  const isInMessageList = type === 'messageList';
  const isInStoryViewer = type === 'story';
  const sendAsPeerIds = isInMessageList ? chat?.sendAsPeerIds : undefined;
  const canShowSendAs = sendAsPeerIds
    && (sendAsPeerIds.length > 1 || !sendAsPeerIds.some((peer) => peer.id === currentUserId!));
  // Prevent Symbol Menu from closing when calendar is open
  const [isSymbolMenuForced, forceShowSymbolMenu, cancelForceShowSymbolMenu] = useFlag();
  const sendMessageAction = useSendMessageAction(chatId, threadId);
  const [isInputHasFocus, markInputHasFocus, unmarkInputHasFocus] = useFlag();
  const [isAttachMenuOpen, onAttachMenuOpen, onAttachMenuClose] = useFlag();

  const canMediaBeReplaced = editingMessage && canEditMedia(editingMessage);

  const { emojiSet, members: groupChatMembers, botCommands: chatBotCommands } = chatFullInfo || {};
  const chatEmojiSetId = emojiSet?.id;

  const isSentStoryReactionHeart = sentStoryReaction && isSameReaction(sentStoryReaction, HEART_REACTION);

  useEffect(processMessageInputForCustomEmoji, [getHtml]);

  const customEmojiNotificationNumber = useRef(0);

  const [requestCalendar, calendar] = useSchedule(
    isInMessageList && canScheduleUntilOnline,
    cancelForceShowSymbolMenu,
  );

  useTimeout(() => {
    setIsMounted(true);
  }, MOUNT_ANIMATION_DURATION);

  useEffect(() => {
    if (isInMessageList) return;

    closeReactionPicker();
  }, [isInMessageList, storyId]);

  useEffect(() => {
    lastMessageSendTimeSeconds.current = undefined;
  }, [chatId]);

  useEffect(() => {
    if (chatId && isReady && !isInStoryViewer) {
      loadScheduledHistory({ chatId });
    }
  }, [isReady, chatId, threadId, isInStoryViewer]);

  useEffect(() => {
    const isChannelWithProfiles = isChannel && chat?.areProfilesShown;
    if (chatId && chat && !sendAsPeerIds && isReady && (isChatSuperGroup(chat) || isChannelWithProfiles)) {
      loadSendAs({ chatId });
    }
  }, [chat, chatId, isChannel, isReady, loadSendAs, sendAsPeerIds]);

  const shouldAnimateSendAsButtonRef = useRef(false);
  useSyncEffect(([prevChatId, prevSendAsPeerIds]) => {
    // We only animate send-as button if `sendAsPeerIds` was missing when opening the chat
    shouldAnimateSendAsButtonRef.current = Boolean(chatId === prevChatId && sendAsPeerIds && !prevSendAsPeerIds);
  }, [chatId, sendAsPeerIds]);

  const [attachments, setAttachments] = useState<ApiAttachment[]>([]);
  const hasAttachments = Boolean(attachments.length);
  const [nextText, setNextText] = useState<ApiFormattedText | undefined>(undefined);

  const {
    canSendStickers, canSendGifs, canAttachMedia, canAttachPolls, canAttachEmbedLinks,
    canSendVoices, canSendPlainText, canSendAudios, canSendVideos, canSendPhotos, canSendDocuments,
  } = useMemo(
    () => getAllowedAttachmentOptions(chat, chatFullInfo, isChatWithBot, isInStoryViewer),
    [chat, chatFullInfo, isChatWithBot, isInStoryViewer],
  );

  const isNeedPremium = isContactRequirePremium && isInStoryViewer;
  const isSendTextBlocked = isNeedPremium || !canSendPlainText;

  const hasWebPagePreview = !hasAttachments && canAttachEmbedLinks && !noWebPage && Boolean(webPagePreview);
  const isComposerBlocked = isSendTextBlocked && !editingMessage;

  useEffect(() => {
    if (!hasWebPagePreview) {
      updateAttachmentSettings({ isInvertedMedia: undefined });
    }
  }, [hasWebPagePreview]);

  const insertHtmlAndUpdateCursor = useLastCallback((newHtml: string, inInputId: string = editableInputId) => {
    if (inInputId === editableInputId && isComposerBlocked) return;
    const selection = window.getSelection()!;
    let messageInput: HTMLDivElement;
    if (inInputId === editableInputId) {
      messageInput = document.querySelector<HTMLDivElement>(editableInputCssSelector)!;
    } else {
      messageInput = document.getElementById(inInputId) as HTMLDivElement;
    }

    if (selection.rangeCount) {
      const selectionRange = selection.getRangeAt(0);
      if (isSelectionInsideInput(selectionRange, inInputId)) {
        insertHtmlInSelection(newHtml);
        messageInput.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
    }

    setHtml(`${getHtml()}${newHtml}`);

    // If selection is outside of input, set cursor at the end of input
    requestNextMutation(() => {
      focusEditableElement(messageInput);
    });
  });

  const insertTextAndUpdateCursor = useLastCallback((
    text: string, inInputId: string = editableInputId,
  ) => {
    const newHtml = renderText(text, ['escape_html', 'emoji_html', 'br_html'])
      .join('')
      .replace(/\u200b+/g, '\u200b');
    insertHtmlAndUpdateCursor(newHtml, inInputId);
  });

  const insertFormattedTextAndUpdateCursor = useLastCallback((
    text: ApiFormattedText, inInputId: string = editableInputId,
  ) => {
    const newHtml = getTextWithEntitiesAsHtml(text);
    insertHtmlAndUpdateCursor(newHtml, inInputId);
  });

  const insertCustomEmojiAndUpdateCursor = useLastCallback((emoji: ApiSticker, inInputId: string = editableInputId) => {
    insertHtmlAndUpdateCursor(buildCustomEmojiHtml(emoji), inInputId);
  });

  const insertNextText = useLastCallback(() => {
    if (!nextText) return;
    insertFormattedTextAndUpdateCursor(nextText, editableInputId);
    setNextText(undefined);
  });

  const {
    shouldSuggestCompression,
    shouldForceCompression,
    shouldForceAsFile,
    handleAppendFiles,
    handleFileSelect,
    onCaptionUpdate,
    handleClearAttachments,
    handleSetAttachments,
  } = useAttachmentModal({
    attachments,
    setHtml,
    setAttachments,
    fileSizeLimit,
    chatId,
    canSendAudios,
    canSendVideos,
    canSendPhotos,
    canSendDocuments,
    insertNextText,
    editedMessage: editingMessage,
  });

  const [isBotKeyboardOpen, openBotKeyboard, closeBotKeyboard] = useFlag();
  const [isBotCommandMenuOpen, openBotCommandMenu, closeBotCommandMenu] = useFlag();
  const [isSymbolMenuOpen, openSymbolMenu, closeSymbolMenu] = useFlag();
  const [isSendAsMenuOpen, openSendAsMenu, closeSendAsMenu] = useFlag();
  const [isHoverDisabled, disableHover, enableHover] = useFlag();

  const {
    startRecordingVoice,
    stopRecordingVoice,
    pauseRecordingVoice,
    activeVoiceRecording,
    currentRecordTime,
    recordButtonRef: mainButtonRef,
    startRecordTimeRef,
    isViewOnceEnabled,
    setIsViewOnceEnabled,
    toogleViewOnceEnabled,
  } = useVoiceRecording();

  const shouldSendRecordingStatus = isForCurrentMessageList && !isInStoryViewer;
  useInterval(() => {
    sendMessageAction({ type: 'recordAudio' });
  }, shouldSendRecordingStatus ? activeVoiceRecording && SEND_MESSAGE_ACTION_INTERVAL : undefined);

  useEffect(() => {
    if (!isForCurrentMessageList || isInStoryViewer) return;
    if (!activeVoiceRecording) {
      sendMessageAction({ type: 'cancel' });
    }
  }, [activeVoiceRecording, isForCurrentMessageList, isInStoryViewer, sendMessageAction]);

  const isEditingRef = useStateRef(Boolean(editingMessage));
  useEffect(() => {
    if (!isForCurrentMessageList || isInStoryViewer) return;
    if (getHtml() && !isEditingRef.current) {
      sendMessageAction({ type: 'typing' });
    }
  }, [getHtml, isEditingRef, isForCurrentMessageList, isInStoryViewer, sendMessageAction]);

  const isAdmin = chat && isChatAdmin(chat);

  const {
    isEmojiTooltipOpen,
    closeEmojiTooltip,
    filteredEmojis,
    filteredCustomEmojis,
    insertEmoji,
  } = useEmojiTooltip(
    Boolean(isReady && isOnActiveTab && (isInStoryViewer || isForCurrentMessageList)
      && shouldSuggestStickers && !hasAttachments),
    getHtml,
    setHtml,
    undefined,
    recentEmojis,
    baseEmojiKeywords,
    emojiKeywords,
  );

  const {
    isCustomEmojiTooltipOpen,
    closeCustomEmojiTooltip,
    insertCustomEmoji,
  } = useCustomEmojiTooltip(
    Boolean(isReady && isOnActiveTab && (isInStoryViewer || isForCurrentMessageList)
      && shouldSuggestCustomEmoji && !hasAttachments),
    getHtml,
    setHtml,
    getSelectionRange,
    inputRef as unknown as RefObject<HTMLDivElement>,
    customEmojiForEmoji,
  );

  const {
    isStickerTooltipOpen,
    closeStickerTooltip,
  } = useStickerTooltip(
    Boolean(isReady
      && isOnActiveTab
      && (isInStoryViewer || isForCurrentMessageList)
      && shouldSuggestStickers
      && canSendStickers
      && !hasAttachments),
    getHtml,
    stickersForEmoji,
  );

  const {
    isMentionTooltipOpen,
    closeMentionTooltip,
    insertMention,
    mentionFilteredUsers,
  } = useMentionTooltip(
    Boolean(isInMessageList && isReady && isForCurrentMessageList && !hasAttachments),
    getHtml,
    setHtml,
    getSelectionRange,
    inputRef as RefObject<HTMLDivElement>,
    groupChatMembers,
    topInlineBotIds,
    currentUserId,
  );

  const {
    isOpen: isInlineBotTooltipOpen,
    botId: inlineBotId,
    isGallery: isInlineBotTooltipGallery,
    switchPm: inlineBotSwitchPm,
    switchWebview: inlineBotSwitchWebview,
    results: inlineBotResults,
    closeTooltip: closeInlineBotTooltip,
    help: inlineBotHelp,
    loadMore: loadMoreForInlineBot,
  } = useInlineBotTooltip(
    Boolean(isInMessageList && isReady && isForCurrentMessageList && !hasAttachments),
    chatId,
    getHtml,
    inlineBots,
  );

  const hasQuickReplies = Boolean(quickReplies && Object.keys(quickReplies).length);

  const {
    isOpen: isChatCommandTooltipOpen,
    close: closeChatCommandTooltip,
    filteredBotCommands: botTooltipCommands,
    filteredQuickReplies: quickReplyCommands,
  } = useChatCommandTooltip(
    Boolean(isInMessageList
      && isReady
      && isForCurrentMessageList
      && ((botCommands && botCommands?.length) || chatBotCommands?.length || (hasQuickReplies && canSendQuickReplies))),
    getHtml,
    botCommands,
    chatBotCommands,
    canSendQuickReplies ? quickReplies : undefined,
  );

  useDraft({
    draft,
    chatId,
    threadId,
    getHtml,
    setHtml,
    editedMessage: editingMessage,
    isDisabled: isInStoryViewer || Boolean(requestedDraft),
  });

  const resetComposer = useLastCallback((shouldPreserveInput = false) => {
    if (!shouldPreserveInput) {
      setHtml('');
    }

    setAttachments(MEMO_EMPTY_ARRAY);
    setNextText(undefined);

    closeEmojiTooltip();
    closeCustomEmojiTooltip();
    closeStickerTooltip();
    closeMentionTooltip();

    if (isMobile) {
      // @optimization
      setTimeout(() => closeSymbolMenu(), SENDING_ANIMATION_DURATION);
    } else {
      closeSymbolMenu();
    }
  });

  const [handleEditComplete, handleEditCancel, shouldForceShowEditing] = useEditing(
    getHtml,
    setHtml,
    editingMessage,
    resetComposer,
    chatId,
    threadId,
    messageListType,
    draft,
    editingDraft,
  );

  // Handle chat change (should be placed after `useDraft` and `useEditing`)
  const resetComposerRef = useStateRef(resetComposer);
  const stopRecordingVoiceRef = useStateRef(stopRecordingVoice);
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
      stopRecordingVoiceRef.current();
      // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
      resetComposerRef.current();
    };
  }, [chatId, threadId, resetComposerRef, stopRecordingVoiceRef]);

  const showCustomEmojiPremiumNotification = useLastCallback(() => {
    const notificationNumber = customEmojiNotificationNumber.current;
    if (!notificationNumber) {
      showNotification({
        message: lang('UnlockPremiumEmojiHint'),
        action: {
          action: 'openPremiumModal',
          payload: { initialSection: 'animated_emoji' },
        },
        actionText: lang('PremiumMore'),
      });
    } else {
      showNotification({
        message: lang('UnlockPremiumEmojiHint2'),
        action: {
          action: 'openChat',
          payload: { id: currentUserId, shouldReplaceHistory: true },
        },
        actionText: lang('Open'),
      });
    }
    customEmojiNotificationNumber.current = Number(!notificationNumber);
  });

  const mainButtonState = useDerivedState(() => {
    if (!isInputHasFocus && onForward && !(getHtml() && !hasAttachments)) {
      return MainButtonState.Forward;
    }

    if (editingMessage && shouldForceShowEditing) {
      return MainButtonState.Edit;
    }

    if (IS_VOICE_RECORDING_SUPPORTED && !activeVoiceRecording && !isForwarding && !(getHtml() && !hasAttachments)) {
      return MainButtonState.Record;
    }

    if (isInScheduledList) {
      return MainButtonState.Schedule;
    }

    return MainButtonState.Send;
  }, [
    activeVoiceRecording, editingMessage, getHtml, hasAttachments, isForwarding, isInputHasFocus, onForward,
    shouldForceShowEditing, isInScheduledList,
  ]);
  const canShowCustomSendMenu = !isInScheduledList;

  const {
    isContextMenuOpen: isCustomSendMenuOpen,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(mainButtonRef, !(mainButtonState === MainButtonState.Send && canShowCustomSendMenu));

  const {
    contextMenuAnchor: storyReactionPickerAnchor,
    handleContextMenu: handleStoryPickerContextMenu,
    handleBeforeContextMenu: handleBeforeStoryPickerContextMenu,
    handleContextMenuHide: handleStoryPickerContextMenuHide,
  } = useContextMenuHandlers(storyReactionRef, !isInStoryViewer);

  useEffect(() => {
    if (isReactionPickerOpen) return;

    if (storyReactionPickerAnchor) {
      openStoryReactionPicker({
        peerId: chatId,
        storyId: storyId!,
        position: storyReactionPickerAnchor,
      });
      handleStoryPickerContextMenuHide();
    }
  }, [chatId, handleStoryPickerContextMenuHide, isReactionPickerOpen, storyId, storyReactionPickerAnchor]);

  useClipboardPaste(
    isForCurrentMessageList || isInStoryViewer,
    insertFormattedTextAndUpdateCursor,
    handleSetAttachments,
    setNextText,
    editingMessage,
    !isCurrentUserPremium && !isChatWithSelf,
    showCustomEmojiPremiumNotification,
  );

  const handleEmbeddedClear = useLastCallback(() => {
    if (editingMessage) {
      handleEditCancel();
    }
  });

  const validateTextLength = useLastCallback((text: string, isAttachmentModal?: boolean) => {
    const maxLength = isAttachmentModal ? captionLimit : maxMessageLength;
    if (text?.length > maxLength) {
      const extraLength = text.length - maxLength;
      showDialog({
        data: {
          message: 'MESSAGE_TOO_LONG_PLEASE_REMOVE_CHARACTERS',
          textParams: {
            '{EXTRA_CHARS_COUNT}': extraLength.toString(),
            '{PLURAL_S}': extraLength > 1 ? 's' : '',
          },
          hasErrorKey: true,
        },
      });

      return false;
    }
    return true;
  });

  const checkSlowMode = useLastCallback(() => {
    if (slowMode && !isAdmin) {
      const messageInput = document.querySelector<HTMLDivElement>(editableInputCssSelector);

      const nowSeconds = getServerTime();
      const secondsSinceLastMessage = lastMessageSendTimeSeconds.current
        && Math.floor(nowSeconds - lastMessageSendTimeSeconds.current);
      const nextSendDateNotReached = slowMode.nextSendDate && slowMode.nextSendDate > nowSeconds;

      if (
        (secondsSinceLastMessage && secondsSinceLastMessage < slowMode.seconds)
        || nextSendDateNotReached
      ) {
        const secondsRemaining = nextSendDateNotReached
          ? slowMode.nextSendDate! - nowSeconds
          : slowMode.seconds - secondsSinceLastMessage!;
        showDialog({
          data: {
            message: lang('SlowModeHint', formatMediaDuration(secondsRemaining)),
            isSlowMode: true,
            hasErrorKey: false,
          },
        });

        messageInput?.blur();

        return false;
      }
    }
    return true;
  });

  const sendAttachments = useLastCallback(({
    attachments: attachmentsToSend,
    sendCompressed = attachmentSettings.shouldCompress,
    sendGrouped = attachmentSettings.shouldSendGrouped,
    isSilent,
    scheduledAt,
    isInvertedMedia,
  }: {
    attachments: ApiAttachment[];
    sendCompressed?: boolean;
    sendGrouped?: boolean;
    isSilent?: boolean;
    scheduledAt?: number;
    isInvertedMedia?: true;
  }) => {
    if (!currentMessageList && !storyId) {
      return;
    }

    const { text, entities } = parseAstAsFormattedText(parseMarkup(getHtml()));
    if (!text && !attachmentsToSend.length) {
      return;
    }
    if (!validateTextLength(text, true)) return;
    if (!checkSlowMode()) return;

    isInvertedMedia = text && sendCompressed && sendGrouped ? isInvertedMedia : undefined;

    if (editingMessage) {
      editMessage({
        messageList: currentMessageList,
        text,
        entities,
        attachments: prepareAttachmentsToSend(attachmentsToSend, sendCompressed),
      });
    } else {
      sendMessage({
        messageList: currentMessageList,
        text,
        entities,
        scheduledAt,
        isSilent,
        shouldUpdateStickerSetOrder,
        attachments: prepareAttachmentsToSend(attachmentsToSend, sendCompressed),
        shouldGroupMessages: sendGrouped,
        isInvertedMedia,
      });
    }

    lastMessageSendTimeSeconds.current = getServerTime();

    clearDraft({ chatId, isLocalOnly: true });

    // Wait until message animation starts
    requestMeasure(() => {
      resetComposer();
    });
  });

  const handleSendAttachmentsFromModal = useLastCallback((
    sendCompressed: boolean,
    sendGrouped: boolean,
    isInvertedMedia?: true,
  ) => {
    sendAttachments({
      attachments,
      sendCompressed,
      sendGrouped,
      isInvertedMedia,
    });
  });

  const handleSendAttachments = useLastCallback((
    sendCompressed: boolean,
    sendGrouped: boolean,
    isSilent?: boolean,
    scheduledAt?: number,
    isInvertedMedia?: true,
  ) => {
    sendAttachments({
      attachments,
      sendCompressed,
      sendGrouped,
      isSilent,
      scheduledAt,
      isInvertedMedia,
    });
  });

  const handleSend = useLastCallback(async (isSilent = false, scheduledAt?: number) => {
    if (!currentMessageList && !storyId) {
      return;
    }

    let currentAttachments = attachments;

    if (activeVoiceRecording) {
      const record = await stopRecordingVoice();
      const ttlSeconds = isViewOnceEnabled ? ONE_TIME_MEDIA_TTL_SECONDS : undefined;
      if (record) {
        const { blob, duration, waveform } = record;
        currentAttachments = [await buildAttachment(
          VOICE_RECORDING_FILENAME,
          blob,
          { voice: { duration, waveform }, ttlSeconds },
        )];
      }
    }

    const { text, entities } = parseAstAsFormattedText(parseMarkup(getHtml()));

    if (currentAttachments.length) {
      sendAttachments({
        attachments: currentAttachments,
        scheduledAt,
        isSilent,
      });
      return;
    }

    if (!text && !isForwarding) {
      return;
    }

    if (!validateTextLength(text)) return;

    const messageInput = document.querySelector<HTMLDivElement>(editableInputCssSelector);

    const effectId = effect?.id;

    if (text) {
      if (!checkSlowMode()) return;

      const isInvertedMedia = hasWebPagePreview ? attachmentSettings.isInvertedMedia : undefined;

      if (areEffectsSupported) saveEffectInDraft({ chatId, threadId, effectId: undefined });

      sendMessage({
        messageList: currentMessageList,
        text,
        entities,
        scheduledAt,
        isSilent,
        shouldUpdateStickerSetOrder,
        isInvertedMedia,
        effectId,
        webPageMediaSize: attachmentSettings.webPageMediaSize,
        webPageUrl: hasWebPagePreview ? webPagePreview!.url : undefined,
      });
    }

    if (isForwarding) {
      forwardMessages({
        scheduledAt,
        isSilent,
      });
    }

    lastMessageSendTimeSeconds.current = getServerTime();
    clearDraft({
      chatId, threadId, isLocalOnly: true, shouldKeepReply: isForwarding,
    });

    if (IS_IOS && messageInput && messageInput === document.activeElement) {
      applyIosAutoCapitalizationFix(messageInput);
    }

    // Wait until message animation starts
    requestMeasure(() => {
      resetComposer();
    });
  });

  const handleClickBotMenu = useLastCallback(() => {
    if (botMenuButton?.type !== 'webApp') {
      return;
    }

    const parsedLink = tryParseDeepLink(botMenuButton.url);

    if (parsedLink?.type === 'publicUsernameOrBotLink' && parsedLink.appName) {
      processDeepLink(botMenuButton.url);
    } else {
      callAttachBot({
        chatId, url: botMenuButton.url, threadId,
      });
    }
  });

  const handleActivateBotCommandMenu = useLastCallback(() => {
    closeSymbolMenu();
    openBotCommandMenu();
  });

  const handleMessageSchedule = useLastCallback((
    args: ScheduledMessageArgs, scheduledAt: number, messageList: MessageList, effectId?: string,
  ) => {
    if (args && 'queryId' in args) {
      const { id, queryId, isSilent } = args;
      sendInlineBotResult({
        id,
        queryId,
        scheduledAt,
        isSilent,
        messageList,
      });
      return;
    }

    const { isSilent, ...restArgs } = args || {};

    if (!args || Object.keys(restArgs).length === 0) {
      void handleSend(Boolean(isSilent), scheduledAt);
    } else if (args.sendCompressed !== undefined || args.sendGrouped !== undefined) {
      const { sendCompressed = false, sendGrouped = false, isInvertedMedia } = args;
      void handleSendAttachments(sendCompressed, sendGrouped, isSilent, scheduledAt, isInvertedMedia);
    } else {
      sendMessage({
        ...args,
        messageList,
        scheduledAt,
        effectId,
      });
    }
  });

  useEffectWithPrevDeps(([prevContentToBeScheduled]) => {
    if (currentMessageList && contentToBeScheduled && contentToBeScheduled !== prevContentToBeScheduled) {
      requestCalendar((scheduledAt) => {
        handleMessageSchedule(contentToBeScheduled, scheduledAt, currentMessageList);
      });
    }
  }, [contentToBeScheduled, currentMessageList, handleMessageSchedule, requestCalendar]);

  useEffect(() => {
    if (requestedDraft) {
      insertFormattedTextAndUpdateCursor(requestedDraft);
      resetOpenChatWithDraft();

      requestNextMutation(() => {
        const messageInput = document.getElementById(editableInputId)!;
        focusEditableElement(messageInput, true);
      });
    }
  }, [editableInputId, requestedDraft, resetOpenChatWithDraft, setHtml]);

  useEffect(() => {
    if (requestedDraftFiles?.length) {
      void handleFileSelect(requestedDraftFiles);
      resetOpenChatWithDraft();
    }
  }, [handleFileSelect, requestedDraftFiles, resetOpenChatWithDraft]);

  const handleCustomEmojiSelect = useLastCallback((emoji: ApiSticker, inInputId?: string) => {
    const emojiSetId = 'id' in emoji.stickerSetInfo && emoji.stickerSetInfo.id;
    if (!emoji.isFree && !isCurrentUserPremium && !isChatWithSelf && emojiSetId !== chatEmojiSetId) {
      showCustomEmojiPremiumNotification();
      return;
    }

    insertCustomEmojiAndUpdateCursor(emoji, inInputId);
  });

  const handleCustomEmojiSelectAttachmentModal = useLastCallback((emoji: ApiSticker) => {
    handleCustomEmojiSelect(emoji, EDITABLE_INPUT_MODAL_ID);
  });

  const handleGifSelect = useLastCallback((gif: ApiVideo, isSilent?: boolean, isScheduleRequested?: boolean) => {
    if (!currentMessageList && !storyId) {
      return;
    }

    if (isInScheduledList || isScheduleRequested) {
      forceShowSymbolMenu();
      requestCalendar((scheduledAt) => {
        cancelForceShowSymbolMenu();
        handleMessageSchedule({ gif, isSilent }, scheduledAt, currentMessageList!);
        requestMeasure(() => {
          resetComposer(true);
        });
      });
    } else {
      sendMessage({ messageList: currentMessageList, gif, isSilent });
      requestMeasure(() => {
        resetComposer(true);
      });
    }
  });

  const handleStickerSelect = useLastCallback((
    sticker: ApiSticker,
    isSilent?: boolean,
    isScheduleRequested?: boolean,
    shouldPreserveInput = false,
    canUpdateStickerSetsOrder?: boolean,
  ) => {
    if (!currentMessageList && !storyId) {
      return;
    }

    sticker = {
      ...sticker,
      isPreloadedGlobally: true,
    };

    if (isInScheduledList || isScheduleRequested) {
      forceShowSymbolMenu();
      requestCalendar((scheduledAt) => {
        cancelForceShowSymbolMenu();
        handleMessageSchedule({ sticker, isSilent }, scheduledAt, currentMessageList!);
        requestMeasure(() => {
          resetComposer(shouldPreserveInput);
        });
      });
    } else {
      sendMessage({
        messageList: currentMessageList,
        sticker,
        isSilent,
        shouldUpdateStickerSetOrder: shouldUpdateStickerSetOrder && canUpdateStickerSetsOrder,
      });
      clearDraft({ chatId, threadId, isLocalOnly: true });

      requestMeasure(() => {
        resetComposer(shouldPreserveInput);
      });
    }
  });

  const handleInlineBotSelect = useLastCallback((
    inlineResult: ApiBotInlineResult | ApiBotInlineMediaResult, isSilent?: boolean, isScheduleRequested?: boolean,
  ) => {
    if (!currentMessageList && !storyId) {
      return;
    }

    if (isInScheduledList || isScheduleRequested) {
      requestCalendar((scheduledAt) => {
        handleMessageSchedule({
          id: inlineResult.id,
          queryId: inlineResult.queryId,
          isSilent,
        }, scheduledAt, currentMessageList!);
      });
    } else {
      sendInlineBotResult({
        id: inlineResult.id,
        queryId: inlineResult.queryId,
        isSilent,
        messageList: currentMessageList!,
      });
    }

    const messageInput = document.querySelector<HTMLDivElement>(editableInputCssSelector);
    if (IS_IOS && messageInput && messageInput === document.activeElement) {
      applyIosAutoCapitalizationFix(messageInput);
    }

    clearDraft({ chatId, isLocalOnly: true });
    requestMeasure(() => {
      resetComposer();
    });
  });

  const handleBotCommandSelect = useLastCallback(() => {
    clearDraft({ chatId, isLocalOnly: true });
    requestMeasure(() => {
      resetComposer();
    });
  });

  const handlePollSend = useLastCallback((poll: ApiNewPoll) => {
    if (!currentMessageList) {
      return;
    }

    if (isInScheduledList) {
      requestCalendar((scheduledAt) => {
        handleMessageSchedule({ poll }, scheduledAt, currentMessageList);
      });
      closePollModal();
    } else {
      sendMessage({ messageList: currentMessageList, poll });
      closePollModal();
    }
  });

  const sendSilent = useLastCallback((additionalArgs?: ScheduledMessageArgs) => {
    if (isInScheduledList) {
      requestCalendar((scheduledAt) => {
        handleMessageSchedule({ ...additionalArgs, isSilent: true }, scheduledAt, currentMessageList!);
      });
    } else if (additionalArgs && ('sendCompressed' in additionalArgs || 'sendGrouped' in additionalArgs)) {
      const { sendCompressed = false, sendGrouped = false, isInvertedMedia } = additionalArgs;
      void handleSendAttachments(sendCompressed, sendGrouped, true, undefined, isInvertedMedia);
    } else {
      void handleSend(true);
    }
  });

  const handleSendAsMenuOpen = useLastCallback(() => {
    const messageInput = document.querySelector<HTMLDivElement>(editableInputCssSelector);

    if (!isMobile || messageInput !== document.activeElement) {
      closeBotCommandMenu();
      closeSymbolMenu();
      openSendAsMenu();
      return;
    }

    messageInput?.blur();
    setTimeout(() => {
      closeBotCommandMenu();
      closeSymbolMenu();
      openSendAsMenu();
    }, MOBILE_KEYBOARD_HIDE_DELAY_MS);
  });

  useEffect(() => {
    if (!isComposerBlocked) return;

    setHtml('');
  }, [isComposerBlocked, setHtml, attachments]);

  const insertTextAndUpdateCursorAttachmentModal = useLastCallback((text: string) => {
    insertTextAndUpdateCursor(text, EDITABLE_INPUT_MODAL_ID);
  });

  const removeSymbol = useLastCallback((inInputId = editableInputId) => {
    const selection = window.getSelection()!;

    if (selection.rangeCount) {
      const selectionRange = selection.getRangeAt(0);
      if (isSelectionInsideInput(selectionRange, inInputId)) {
        document.execCommand('delete', false);
        return;
      }
    }

    setHtml(deleteLastCharacterOutsideSelection(getHtml()));
  });

  const removeSymbolAttachmentModal = useLastCallback(() => {
    removeSymbol(EDITABLE_INPUT_MODAL_ID);
  });

  const handleAllScheduledClick = useLastCallback(() => {
    openThread({
      chatId, threadId, type: 'scheduled', noForumTopicPanel: true,
    });
  });

  useEffect(() => {
    if (isRightColumnShown && isMobile) {
      closeSymbolMenu();
    }
  }, [isRightColumnShown, closeSymbolMenu, isMobile]);

  useEffect(() => {
    if (!isReady) return;

    if (isSelectModeActive) {
      disableHover();
    } else {
      setTimeout(() => {
        enableHover();
      }, SELECT_MODE_TRANSITION_MS);
    }
  }, [isSelectModeActive, enableHover, disableHover, isReady]);

  const withBotMenuButton = isChatWithBot && botMenuButton?.type === 'webApp' && !editingMessage;
  const isBotMenuButtonOpen = useDerivedState(() => {
    return withBotMenuButton && !getHtml() && !activeVoiceRecording;
  }, [withBotMenuButton, getHtml, activeVoiceRecording]);

  const [timedPlaceholderLangKey, timedPlaceholderDate] = useMemo(() => {
    if (slowMode?.nextSendDate) {
      return ['SlowModeWait', slowMode.nextSendDate];
    }

    if (stealthMode?.activeUntil && isInStoryViewer) {
      return ['StealthModeActiveHint', stealthMode.activeUntil];
    }

    return [];
  }, [isInStoryViewer, slowMode?.nextSendDate, stealthMode?.activeUntil]);

  const isComposerHasFocus = isBotKeyboardOpen || isSymbolMenuOpen || isEmojiTooltipOpen || isSendAsMenuOpen
    || isMentionTooltipOpen || isInlineBotTooltipOpen || isBotCommandMenuOpen || isAttachMenuOpen
    || isStickerTooltipOpen || isChatCommandTooltipOpen || isCustomEmojiTooltipOpen || isBotMenuButtonOpen
    || isCustomSendMenuOpen || Boolean(activeVoiceRecording) || attachments.length > 0 || isInputHasFocus;
  const isReactionSelectorOpen = isComposerHasFocus && !isReactionPickerOpen && isInStoryViewer && !isAttachMenuOpen
    && !isSymbolMenuOpen;
  const placeholderForForumAsMessages = chat?.isForum && chat?.isForumAsMessages && threadId === MAIN_THREAD_ID
    ? (replyToTopic
      ? lang('Chat.InputPlaceholderReplyInTopic', replyToTopic.title)
      : lang('Message.Placeholder.MessageInGeneral'))
    : undefined;

  useEffect(() => {
    if (isComposerHasFocus) {
      onFocus?.();
    } else {
      onBlur?.();
    }
  }, [isComposerHasFocus, onBlur, onFocus]);

  const {
    shouldRender: shouldRenderReactionSelector,
    transitionClassNames: reactionSelectorTransitonClassNames,
  } = useShowTransitionDeprecated(isReactionSelectorOpen);
  const areVoiceMessagesNotAllowed = mainButtonState === MainButtonState.Record
    && (!canAttachMedia || !canSendVoiceByPrivacy || !canSendVoices);

  const mainButtonHandler = useLastCallback(() => {
    switch (mainButtonState) {
      case MainButtonState.Forward:
        onForward?.();
        break;
      case MainButtonState.Send:
        void handleSend();
        break;
      case MainButtonState.Record: {
        if (areVoiceMessagesNotAllowed) {
          if (!canSendVoiceByPrivacy) {
            showNotification({
              message: lang('VoiceMessagesRestrictedByPrivacy', chat?.title),
            });
          } else if (!canSendVoices) {
            showAllowedMessageTypesNotification({ chatId });
          }
        } else {
          setIsViewOnceEnabled(false);
          void startRecordingVoice();
        }
        break;
      }
      case MainButtonState.Edit:
        handleEditComplete();
        break;
      case MainButtonState.Schedule:
        if (activeVoiceRecording) {
          pauseRecordingVoice();
        }
        if (!currentMessageList) {
          return;
        }
        requestCalendar((scheduledAt) => {
          handleMessageSchedule({}, scheduledAt, currentMessageList, effect?.id);
        });
        break;
      default:
        break;
    }
  });

  const scheduledDefaultDate = new Date();
  scheduledDefaultDate.setSeconds(0);
  scheduledDefaultDate.setMilliseconds(0);

  const scheduledMaxDate = new Date();
  scheduledMaxDate.setFullYear(scheduledMaxDate.getFullYear() + 1);

  let sendButtonAriaLabel = 'SendMessage';
  switch (mainButtonState) {
    case MainButtonState.Forward:
      sendButtonAriaLabel = 'Forward';
      break;
    case MainButtonState.Edit:
      sendButtonAriaLabel = 'Save edited message';
      break;
    case MainButtonState.Record:
      sendButtonAriaLabel = !canAttachMedia
        ? 'Conversation.DefaultRestrictedMedia'
        : 'AccDescrVoiceMessage';
  }

  const fullClassName = buildClassName(
    'Composer',
    !isSelectModeActive && 'shown',
    isHoverDisabled && 'hover-disabled',
    isMounted && 'mounted',
    className,
  );

  const handleToggleReaction = useLastCallback((reaction: ApiReaction) => {
    let text: string | undefined;
    let entities: ApiMessageEntity[] | undefined;

    if (reaction.type === 'emoji') {
      text = reaction.emoticon;
    }

    if (reaction.type === 'custom') {
      const sticker = getGlobal().customEmojis.byId[reaction.documentId];
      if (!sticker) {
        return;
      }

      if (!sticker.isFree && !isCurrentUserPremium && !isChatWithSelf) {
        showCustomEmojiPremiumNotification();
        return;
      }
      const customEmojiMessage = parseHtmlAsFormattedText(buildCustomEmojiHtml(sticker));
      text = customEmojiMessage.text;
      entities = customEmojiMessage.entities;
    }

    sendMessage({ text, entities, isReaction: true });
    closeReactionPicker();
  });

  const handleToggleEffectReaction = useLastCallback((reaction: ApiReaction) => {
    setReactionEffect({ chatId, threadId, reaction });

    closeReactionPicker();
  });

  const handleReactionPickerOpen = useLastCallback((position: IAnchorPosition) => {
    openStoryReactionPicker({
      peerId: chatId,
      storyId: storyId!,
      position,
      sendAsMessage: true,
    });
  });

  const handleLikeStory = useLastCallback(() => {
    const reaction = sentStoryReaction ? undefined : HEART_REACTION;
    sendStoryReaction({
      peerId: chatId,
      storyId: storyId!,
      containerId: getStoryKey(chatId, storyId!),
      reaction,
    });
  });

  const handleSendScheduled = useLastCallback(() => {
    requestCalendar((scheduledAt) => {
      handleMessageSchedule({}, scheduledAt, currentMessageList!);
    });
  });

  const handleSendSilent = useLastCallback(() => {
    sendSilent();
  });

  const handleSendWhenOnline = useLastCallback(() => {
    handleMessageSchedule({}, SCHEDULED_WHEN_ONLINE, currentMessageList!, effect?.id);
  });

  const handleSendScheduledAttachments = useLastCallback(
    (sendCompressed: boolean, sendGrouped: boolean, isInvertedMedia?: true) => {
      requestCalendar((scheduledAt) => {
        handleMessageSchedule({ sendCompressed, sendGrouped, isInvertedMedia }, scheduledAt, currentMessageList!);
      });
    },
  );

  const handleSendSilentAttachments = useLastCallback(
    (sendCompressed: boolean, sendGrouped: boolean, isInvertedMedia?: true) => {
      sendSilent({ sendCompressed, sendGrouped, isInvertedMedia });
    },
  );

  const handleRemoveEffect = useLastCallback(() => {
    saveEffectInDraft({ chatId, threadId, effectId: undefined });
  });

  const handleStopEffect = useLastCallback(() => {
    hideEffectInComposer({});
  });

  const onSend = useMemo(() => {
    switch (mainButtonState) {
      case MainButtonState.Edit:
        return handleEditComplete;
      case MainButtonState.Schedule:
        return handleSendScheduled;
      default:
        return handleSend;
    }
  }, [mainButtonState, handleEditComplete]);

  const withBotCommands = isChatWithBot && botMenuButton?.type === 'commands' && !editingMessage
    && botCommands !== false && !activeVoiceRecording;

  const effectEmoji = areEffectsSupported && effect?.emoticon;

  return (
    <div className={fullClassName}>
      {isInMessageList && canAttachMedia && isReady && (
        <DropArea
          isOpen={dropAreaState !== DropAreaState.None}
          withQuick={dropAreaState === DropAreaState.QuickFile || prevDropAreaState === DropAreaState.QuickFile}
          onHide={onDropHide!}
          onFileSelect={handleFileSelect}
          editingMessage={editingMessage}
        />
      )}
      {shouldRenderReactionSelector && !isNeedPremium && (
        <ReactionSelector
          topReactions={topReactions}
          allAvailableReactions={availableReactions}
          onToggleReaction={handleToggleReaction}
          isPrivate
          isReady={isReady}
          canBuyPremium={canBuyPremium}
          isCurrentUserPremium={isCurrentUserPremium}
          isInSavedMessages={isChatWithSelf}
          isInStoryViewer={isInStoryViewer}
          canPlayAnimatedEmojis={canPlayAnimatedEmojis}
          onShowMore={handleReactionPickerOpen}
          className={reactionSelectorTransitonClassNames}
        />
      )}
      <AttachmentModal
        chatId={chatId}
        threadId={threadId}
        canShowCustomSendMenu={canShowCustomSendMenu}
        attachments={attachments}
        getHtml={getHtml}
        isReady={isReady}
        shouldSuggestCompression={shouldSuggestCompression}
        shouldForceCompression={shouldForceCompression}
        shouldForceAsFile={shouldForceAsFile}
        isForCurrentMessageList={isForCurrentMessageList}
        isForMessage={isInMessageList}
        shouldSchedule={isInScheduledList}
        forceDarkTheme={isInStoryViewer}
        onCaptionUpdate={onCaptionUpdate}
        onSendSilent={handleSendSilentAttachments}
        onSend={handleSendAttachmentsFromModal}
        onSendScheduled={handleSendScheduledAttachments}
        onFileAppend={handleAppendFiles}
        onClear={handleClearAttachments}
        onAttachmentsUpdate={handleSetAttachments}
        onCustomEmojiSelect={handleCustomEmojiSelectAttachmentModal}
        onRemoveSymbol={removeSymbolAttachmentModal}
        onEmojiSelect={insertTextAndUpdateCursorAttachmentModal}
        editingMessage={editingMessage}
        onSendWhenOnline={handleSendWhenOnline}
        canScheduleUntilOnline={canScheduleUntilOnline && !isViewOnceEnabled}
      />
      <PollModal
        isOpen={pollModal.isOpen}
        isQuiz={pollModal.isQuiz}
        shouldBeAnonymous={isChannel}
        onClear={closePollModal}
        onSend={handlePollSend}
      />
      <SendAsMenu
        isOpen={isSendAsMenuOpen}
        onClose={closeSendAsMenu}
        chatId={chatId}
        selectedSendAsId={sendAsId}
        sendAsPeerIds={sendAsPeerIds}
        isCurrentUserPremium={isCurrentUserPremium}
      />
      <MentionTooltip
        isOpen={isMentionTooltipOpen}
        filteredUsers={mentionFilteredUsers}
        onInsertUserName={insertMention}
        onClose={closeMentionTooltip}
      />
      <ChatCommandTooltip
        isOpen={isChatCommandTooltipOpen}
        chatId={chatId}
        withUsername={Boolean(chatBotCommands)}
        botCommands={botTooltipCommands}
        quickReplies={quickReplyCommands}
        getHtml={getHtml}
        self={currentUser!}
        quickReplyMessages={quickReplyMessages}
        onClick={handleBotCommandSelect}
        onClose={closeChatCommandTooltip}
      />
      <div className={
        buildClassName('composer-wrapper', isInStoryViewer && 'with-story-tweaks', isNeedPremium && 'is-need-premium')
      }
      >
        {!isNeedPremium && (
          <svg className="svg-appendix" width="9" height="20">
            <defs>
              <filter
                x="-50%"
                y="-14.7%"
                width="200%"
                height="141.2%"
                filterUnits="objectBoundingBox"
                id="composerAppendix"
              >
                <feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1" />
                <feGaussianBlur stdDeviation="1" in="shadowOffsetOuter1" result="shadowBlurOuter1" />
                <feColorMatrix
                  values="0 0 0 0 0.0621962482 0 0 0 0 0.138574144 0 0 0 0 0.185037364 0 0 0 0.15 0"
                  in="shadowBlurOuter1"
                />
              </filter>
            </defs>
            <g fill="none" fill-rule="evenodd">
              <path
                d="M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z"
                fill="#000"
                filter="url(#composerAppendix)"
              />
              <path
                d="M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z"
                fill="#FFF"
                className="corner"
              />
            </g>
          </svg>
        )}
        {isInMessageList && (
          <>
            <InlineBotTooltip
              isOpen={isInlineBotTooltipOpen}
              botId={inlineBotId}
              isGallery={isInlineBotTooltipGallery}
              inlineBotResults={inlineBotResults}
              switchPm={inlineBotSwitchPm}
              switchWebview={inlineBotSwitchWebview}
              loadMore={loadMoreForInlineBot}
              isSavedMessages={isChatWithSelf}
              canSendGifs={canSendGifs}
              isCurrentUserPremium={isCurrentUserPremium}
              onSelectResult={handleInlineBotSelect}
              onClose={closeInlineBotTooltip}
            />
            <ComposerEmbeddedMessage
              onClear={handleEmbeddedClear}
              shouldForceShowEditing={Boolean(shouldForceShowEditing && editingMessage)}
              chatId={chatId}
              threadId={threadId}
              messageListType={messageListType}
            />
            <WebPagePreview
              chatId={chatId}
              threadId={threadId}
              getHtml={getHtml}
              isDisabled={!canAttachEmbedLinks || hasAttachments}
              isEditing={Boolean(editingMessage)}
            />
          </>
        )}
        <div className={buildClassName('message-input-wrapper', getPeerColorClass(currentUser))}>
          {isInMessageList && (
            <>
              {withBotMenuButton && (
                <BotMenuButton
                  isOpen={isBotMenuButtonOpen}
                  text={botMenuButton.text}
                  isDisabled={Boolean(activeVoiceRecording)}
                  onClick={handleClickBotMenu}
                />
              )}
              {withBotCommands && (
                <ResponsiveHoverButton
                  className={buildClassName('bot-commands', isBotCommandMenuOpen && 'activated')}
                  round
                  disabled={botCommands === undefined}
                  color="translucent"
                  onActivate={handleActivateBotCommandMenu}
                  ariaLabel="Open bot command keyboard"
                >
                  <Icon name="bot-commands-filled" />
                </ResponsiveHoverButton>
              )}
              {canShowSendAs && (sendAsUser || sendAsChat) && (
                <Button
                  round
                  color="translucent"
                  onClick={isSendAsMenuOpen ? closeSendAsMenu : handleSendAsMenuOpen}
                  ariaLabel={lang('SendMessageAsTitle')}
                  className={buildClassName(
                    'send-as-button',
                    shouldAnimateSendAsButtonRef.current && 'appear-animation',
                  )}
                >
                  <Avatar
                    peer={sendAsUser || sendAsChat}
                    size="tiny"
                  />
                </Button>
              )}
            </>
          )}
          {((!isComposerBlocked || canSendGifs || canSendStickers) && !isNeedPremium) && (
            <SymbolMenuButton
              chatId={chatId}
              threadId={threadId}
              isMobile={isMobile}
              isReady={isReady}
              isSymbolMenuOpen={isSymbolMenuOpen}
              openSymbolMenu={openSymbolMenu}
              closeSymbolMenu={closeSymbolMenu}
              canSendStickers={canSendStickers}
              canSendGifs={canSendGifs}
              isMessageComposer={isInMessageList}
              onGifSelect={handleGifSelect}
              onStickerSelect={handleStickerSelect}
              onCustomEmojiSelect={handleCustomEmojiSelect}
              onRemoveSymbol={removeSymbol}
              onEmojiSelect={insertTextAndUpdateCursor}
              closeBotCommandMenu={closeBotCommandMenu}
              closeSendAsMenu={closeSendAsMenu}
              isSymbolMenuForced={isSymbolMenuForced}
              canSendPlainText={!isComposerBlocked}
              inputCssSelector={editableInputCssSelector}
              idPrefix={type}
              forceDarkTheme={isInStoryViewer}
            />
          )}
          <LocalMessageInput
            ref={inputRef}
            id={inputId}
            editableInputId={editableInputId}
            customEmojiPrefix={type}
            isStoryInput={isInStoryViewer}
            chatId={chatId}
            canSendPlainText={!isComposerBlocked}
            threadId={threadId}
            isReady={isReady}
            isActive={!hasAttachments}
            getHtml={getHtml}
            placeholder={
              activeVoiceRecording && windowWidth <= SCREEN_WIDTH_TO_HIDE_PLACEHOLDER
                ? ''
                : (!isComposerBlocked
                  ? (botKeyboardPlaceholder || inputPlaceholder || lang(placeholderForForumAsMessages || 'Message'))
                  : isInStoryViewer ? lang('StoryRepliesLocked') : lang('Chat.PlaceholderTextNotAllowed'))
            }
            timedPlaceholderDate={timedPlaceholderDate}
            timedPlaceholderLangKey={timedPlaceholderLangKey}
            forcedPlaceholder={inlineBotHelp}
            canAutoFocus={isReady && isForCurrentMessageList && !hasAttachments && isInMessageList}
            noFocusInterception={hasAttachments}
            shouldSuppressFocus={isMobile && isSymbolMenuOpen}
            shouldSuppressTextFormatter={isEmojiTooltipOpen || isMentionTooltipOpen || isInlineBotTooltipOpen}
            onUpdate={setHtml}
            onSend={onSend}
            onSuppressedFocus={closeSymbolMenu}
            onFocus={markInputHasFocus}
            onBlur={unmarkInputHasFocus}
            isNeedPremium={isNeedPremium}
          />
          {isInMessageList && (
            <>
              {isInlineBotLoading && Boolean(inlineBotId) && (
                <Spinner color="gray" />
              )}
              {withScheduledButton && (
                <Button
                  round
                  faded
                  className="scheduled-button"
                  color="translucent"
                  onClick={handleAllScheduledClick}
                  ariaLabel="Open scheduled messages"
                >
                  <Icon name="schedule" />
                </Button>
              )}
              {Boolean(botKeyboardMessageId) && !activeVoiceRecording && !editingMessage && (
                <ResponsiveHoverButton
                  className={isBotKeyboardOpen ? 'activated' : ''}
                  round
                  color="translucent"
                  onActivate={openBotKeyboard}
                  ariaLabel="Open bot command keyboard"
                >
                  <Icon name="bot-command" />
                </ResponsiveHoverButton>
              )}
            </>
          )}
          {activeVoiceRecording && Boolean(currentRecordTime) && (
            <span className="recording-state">
              {formatVoiceRecordDuration(currentRecordTime - startRecordTimeRef.current!)}
            </span>
          )}
          {!isNeedPremium && (
            <AttachMenu
              chatId={chatId}
              threadId={threadId}
              editingMessage={editingMessage}
              canEditMedia={canMediaBeReplaced}
              isButtonVisible={!activeVoiceRecording}
              canAttachMedia={canAttachMedia}
              canAttachPolls={canAttachPolls}
              canSendPhotos={canSendPhotos}
              canSendVideos={canSendVideos}
              canSendDocuments={canSendDocuments}
              canSendAudios={canSendAudios}
              onFileSelect={handleFileSelect}
              onPollCreate={openPollModal}
              isScheduled={isInScheduledList}
              attachBots={isInMessageList ? attachBots : undefined}
              peerType={attachMenuPeerType}
              shouldCollectDebugLogs={shouldCollectDebugLogs}
              theme={theme}
              onMenuOpen={onAttachMenuOpen}
              onMenuClose={onAttachMenuClose}
            />
          )}
          {isInMessageList && Boolean(botKeyboardMessageId) && (
            <BotKeyboardMenu
              messageId={botKeyboardMessageId}
              isOpen={isBotKeyboardOpen}
              onClose={closeBotKeyboard}
            />
          )}
          {isInMessageList && botCommands && (
            <BotCommandMenu
              isOpen={isBotCommandMenuOpen}
              botCommands={botCommands}
              onClose={closeBotCommandMenu}
            />
          )}
          <CustomEmojiTooltip
            key={`custom-emoji-tooltip-${editableInputId}`}
            chatId={chatId}
            isOpen={isCustomEmojiTooltipOpen}
            onCustomEmojiSelect={insertCustomEmoji}
            addRecentCustomEmoji={addRecentCustomEmoji}
            onClose={closeCustomEmojiTooltip}
          />
          <StickerTooltip
            key={`sticker-tooltip-${editableInputId}`}
            chatId={chatId}
            threadId={threadId}
            isOpen={isStickerTooltipOpen}
            onStickerSelect={handleStickerSelect}
            onClose={closeStickerTooltip}
          />
          <EmojiTooltip
            key={`emoji-tooltip-${editableInputId}`}
            isOpen={isEmojiTooltipOpen}
            emojis={filteredEmojis}
            customEmojis={filteredCustomEmojis}
            addRecentEmoji={addRecentEmoji}
            addRecentCustomEmoji={addRecentCustomEmoji}
            onEmojiSelect={insertEmoji}
            onCustomEmojiSelect={insertEmoji}
            onClose={closeEmojiTooltip}
          />
        </div>
      </div>
      {canSendOneTimeMedia && activeVoiceRecording && (
        <Button
          className={buildClassName('view-once', isViewOnceEnabled && 'active')}
          round
          color="secondary"
          ariaLabel={lang('Chat.PlayOnceVoiceMessageTooltip')}
          onClick={toogleViewOnceEnabled}
        >
          <Icon name="view-once" />
          <Icon name="one-filled" />
        </Button>
      )}
      {activeVoiceRecording && (
        <Button
          round
          color="danger"
          className="cancel"
          onClick={stopRecordingVoice}
          ariaLabel="Cancel voice recording"
        >
          <Icon name="delete" />
        </Button>
      )}
      {isInStoryViewer && !activeVoiceRecording && (
        <Button
          round
          className="story-reaction-button"
          color="secondary"
          onClick={handleLikeStory}
          onContextMenu={handleStoryPickerContextMenu}
          onMouseDown={handleBeforeStoryPickerContextMenu}
          ariaLabel={lang('AccDescrLike')}
          ref={storyReactionRef}
        >
          {sentStoryReaction && (
            <ReactionAnimatedEmoji
              key={getReactionKey(sentStoryReaction)}
              containerId={getStoryKey(chatId, storyId!)}
              reaction={sentStoryReaction}
              withEffectOnly={isSentStoryReactionHeart}
            />
          )}
          {(!sentStoryReaction || isSentStoryReactionHeart) && (
            <Icon name="heart" className={buildClassName(isSentStoryReactionHeart && 'story-reaction-heart')} />
          )}
        </Button>
      )}
      <Button
        ref={mainButtonRef}
        round
        color="secondary"
        className={buildClassName(
          mainButtonState,
          'main-button',
          !isReady && 'not-ready',
          activeVoiceRecording && 'recording',
        )}
        disabled={areVoiceMessagesNotAllowed}
        allowDisabledClick
        noFastClick
        ariaLabel={lang(sendButtonAriaLabel)}
        onClick={mainButtonHandler}
        onContextMenu={
          mainButtonState === MainButtonState.Send && canShowCustomSendMenu ? handleContextMenu : undefined
        }
      >
        <Icon name="send" />
        <Icon name="microphone-alt" />
        {onForward && <Icon name="forward" />}
        {isInMessageList && <Icon name="schedule" />}
        {isInMessageList && <Icon name="check" />}
      </Button>
      {effectEmoji && (
        <span className="effect-icon" onClick={handleRemoveEffect}>
          {renderText(effectEmoji)}
        </span>
      )}
      {effect && canPlayEffect && (
        <MessageEffect
          shouldPlay={shouldPlayEffect}
          effect={effect}
          onStop={handleStopEffect}
        />
      )}
      {canShowCustomSendMenu && (
        <CustomSendMenu
          isOpen={isCustomSendMenuOpen}
          canSchedule={isInMessageList && !isViewOnceEnabled}
          canScheduleUntilOnline={canScheduleUntilOnline && !isViewOnceEnabled}
          onSendSilent={!isChatWithSelf ? handleSendSilent : undefined}
          onSendSchedule={!isInScheduledList ? handleSendScheduled : undefined}
          onSendWhenOnline={handleSendWhenOnline}
          onRemoveEffect={handleRemoveEffect}
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          isSavedMessages={isChatWithSelf}
          chatId={chatId}
          withEffects={areEffectsSupported}
          hasCurrentEffect={Boolean(effect)}
          effectReactions={effectReactions}
          allAvailableReactions={availableReactions}
          onToggleReaction={handleToggleEffectReaction}
          isCurrentUserPremium={isCurrentUserPremium}
          isInSavedMessages={isChatWithSelf}
          isInStoryViewer={isInStoryViewer}
          canPlayAnimatedEmojis={canPlayAnimatedEmojis}
        />
      )}
      {calendar}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, {
    chatId, threadId, storyId, messageListType, isMobile, type,
  }): StateProps => {
    const chat = selectChat(global, chatId);
    const chatBot = !isSystemBot(chatId) ? selectBot(global, chatId) : undefined;
    const isChatWithBot = Boolean(chatBot);
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const isChatWithUser = isUserId(chatId);
    const userFullInfo = isChatWithUser ? selectUserFullInfo(global, chatId) : undefined;
    const chatFullInfo = !isChatWithUser ? selectChatFullInfo(global, chatId) : undefined;
    const messageWithActualBotKeyboard = (isChatWithBot || !isChatWithUser)
      && selectNewestMessageWithBotKeyboardButtons(global, chatId, threadId);
    const {
      language, shouldSuggestStickers, shouldSuggestCustomEmoji, shouldUpdateStickerSetOrder,
    } = global.settings.byKey;
    const baseEmojiKeywords = global.emojiKeywords[BASE_EMOJI_KEYWORD_LANG];
    const emojiKeywords = language !== BASE_EMOJI_KEYWORD_LANG ? global.emojiKeywords[language] : undefined;
    const botKeyboardMessageId = messageWithActualBotKeyboard ? messageWithActualBotKeyboard.id : undefined;
    const keyboardMessage = botKeyboardMessageId ? selectChatMessage(global, chatId, botKeyboardMessageId) : undefined;
    const { currentUserId } = global;
    const currentUser = selectUser(global, currentUserId!)!;
    const defaultSendAsId = chatFullInfo ? chatFullInfo?.sendAsId || currentUserId : undefined;
    const sendAsId = chat?.sendAsPeerIds && defaultSendAsId && (
      chat.sendAsPeerIds.some((peer) => peer.id === defaultSendAsId)
        ? defaultSendAsId
        : (chat?.adminRights?.anonymous ? chat?.id : undefined)
    );
    const sendAsUser = sendAsId ? selectUser(global, sendAsId) : undefined;
    const sendAsChat = !sendAsUser && sendAsId ? selectChat(global, sendAsId) : undefined;
    const requestedDraft = selectRequestedDraft(global, chatId);
    const requestedDraftFiles = selectRequestedDraftFiles(global, chatId);

    const tabState = selectTabState(global);
    const isStoryViewerOpen = Boolean(tabState.storyViewer.storyId);

    const currentMessageList = selectCurrentMessageList(global);
    const isForCurrentMessageList = chatId === currentMessageList?.chatId
      && threadId === currentMessageList?.threadId
      && messageListType === currentMessageList?.type
      && !isStoryViewerOpen;
    const user = selectUser(global, chatId);
    const canSendVoiceByPrivacy = (user && !userFullInfo?.noVoiceMessages) ?? true;
    const slowMode = chatFullInfo?.slowMode;
    const isCurrentUserPremium = selectIsCurrentUserPremium(global);

    const editingDraft = messageListType === 'scheduled'
      ? selectEditingScheduledDraft(global, chatId)
      : selectEditingDraft(global, chatId, threadId);

    const story = storyId && selectPeerStory(global, chatId, storyId);
    const sentStoryReaction = story && 'sentReaction' in story ? story.sentReaction : undefined;
    const draft = selectDraft(global, chatId, threadId);
    const replyToMessage = draft?.replyInfo
      ? selectChatMessage(global, chatId, draft.replyInfo.replyToMsgId)
      : undefined;
    const replyToTopic = chat?.isForum && chat.isForumAsMessages && threadId === MAIN_THREAD_ID && replyToMessage
      ? selectTopicFromMessage(global, replyToMessage)
      : undefined;
    const isInScheduledList = messageListType === 'scheduled';

    const canSendQuickReplies = isChatWithUser && !isChatWithBot && !isInScheduledList && !isChatWithSelf;

    const noWebPage = selectNoWebPage(global, chatId, threadId);

    const areEffectsSupported = isChatWithUser && !isChatWithBot
      && !isInScheduledList && !isChatWithSelf && type !== 'story' && chatId !== SERVICE_NOTIFICATIONS_USER_ID;
    const canPlayEffect = selectPerformanceSettingsValue(global, 'stickerEffects');
    const shouldPlayEffect = tabState.shouldPlayEffectInComposer;
    const effectId = areEffectsSupported && draft?.effectId;
    const effect = effectId ? global.availableEffectById[effectId] : undefined;
    const effectReactions = global.reactions.effectReactions;

    const maxMessageLength = global.config?.maxMessageLength || DEFAULT_MAX_MESSAGE_LENGTH;

    return {
      availableReactions: global.reactions.availableReactions,
      topReactions: type === 'story' ? global.reactions.topReactions : undefined,
      isOnActiveTab: !tabState.isBlurred,
      editingMessage: selectEditingMessage(global, chatId, threadId, messageListType),
      draft,
      chat,
      isChatWithBot,
      isChatWithSelf,
      isForCurrentMessageList,
      canScheduleUntilOnline: selectCanScheduleUntilOnline(global, chatId),
      isChannel: chat ? isChatChannel(chat) : undefined,
      isRightColumnShown: selectIsRightColumnShown(global, isMobile),
      isSelectModeActive: selectIsInSelectMode(global),
      withScheduledButton: (
        messageListType === 'thread'
        && (userFullInfo || chatFullInfo)?.hasScheduledMessages
      ),
      isInScheduledList,
      botKeyboardMessageId,
      botKeyboardPlaceholder: keyboardMessage?.keyboardPlaceholder,
      isForwarding: chatId === tabState.forwardMessages.toChatId,
      pollModal: tabState.pollModal,
      stickersForEmoji: global.stickers.forEmoji.stickers,
      customEmojiForEmoji: global.customEmojis.forEmoji.stickers,
      chatFullInfo,
      topInlineBotIds: global.topInlineBots?.userIds,
      currentUserId,
      currentUser,
      contentToBeScheduled: tabState.contentToBeScheduled,
      shouldSuggestStickers,
      shouldSuggestCustomEmoji,
      shouldUpdateStickerSetOrder,
      recentEmojis: global.recentEmojis,
      baseEmojiKeywords: baseEmojiKeywords?.keywords,
      emojiKeywords: emojiKeywords?.keywords,
      inlineBots: tabState.inlineBots.byUsername,
      isInlineBotLoading: tabState.inlineBots.isLoading,
      botCommands: userFullInfo ? (userFullInfo.botInfo?.commands || false) : undefined,
      botMenuButton: userFullInfo?.botInfo?.menuButton,
      sendAsUser,
      sendAsChat,
      sendAsId,
      editingDraft,
      requestedDraft,
      requestedDraftFiles,
      attachBots: global.attachMenu.bots,
      attachMenuPeerType: selectChatType(global, chatId),
      theme: selectTheme(global),
      fileSizeLimit: selectCurrentLimit(global, 'uploadMaxFileparts') * MAX_UPLOAD_FILEPART_SIZE,
      captionLimit: selectCurrentLimit(global, 'captionLength'),
      isCurrentUserPremium,
      canSendVoiceByPrivacy,
      attachmentSettings: global.attachmentSettings,
      slowMode,
      currentMessageList,
      isReactionPickerOpen: selectIsReactionPickerOpen(global),
      canBuyPremium: !isCurrentUserPremium && !selectIsPremiumPurchaseBlocked(global),
      canPlayAnimatedEmojis: selectCanPlayAnimatedEmojis(global),
      canSendOneTimeMedia: !isChatWithSelf && isChatWithUser && !isChatWithBot && !isInScheduledList,
      shouldCollectDebugLogs: global.settings.byKey.shouldCollectDebugLogs,
      sentStoryReaction,
      stealthMode: global.stories.stealthMode,
      replyToTopic,
      quickReplyMessages: global.quickReplies.messagesById,
      quickReplies: global.quickReplies.byId,
      canSendQuickReplies,
      noWebPage,
      webPagePreview: selectTabState(global).webPagePreview,
      isContactRequirePremium: userFullInfo?.isContactRequirePremium,
      effect,
      effectReactions,
      areEffectsSupported,
      canPlayEffect,
      shouldPlayEffect,
      maxMessageLength,
    };
  },
)(Composer));
