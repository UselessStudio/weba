import type { FC, RefObject } from '../../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiSticker, ApiStickerSet } from '../../../../api/types';

import {
  FOLDER_ICONS,
  MENU_TRANSITION_DURATION,
  RECENT_SYMBOL_SET_ID,
  TOP_SYMBOL_SET_ID,
} from '../../../../config';
import { selectIsContextMenuTranslucent, selectIsCurrentUserPremium } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import {
  type EmojiData, type EmojiModule, type EmojiRawData, uncompressEmoji,
} from '../../../../util/emoji/emoji';
import { pickTruthy, unique } from '../../../../util/iteratees';
import { IS_TOUCH_ENV } from '../../../../util/windowEnvironment';

import useLang from '../../../../hooks/useLang';
import { useStickerPickerObservers } from '../../../common/hooks/useStickerPickerObservers';
import useAsyncRendering from '../../../right/hooks/useAsyncRendering';

import CustomEmojiCover from '../../../common/CustomEmojiCover';
import Icon from '../../../common/icons/Icon';
import StickerSet from '../../../common/StickerSet';
import EmojiCategory from '../../../middle/composer/EmojiCategory';
import Button from '../../../ui/Button';
import Loading from '../../../ui/Loading';
import Menu from '../../../ui/Menu';
import Portal from '../../../ui/Portal';

import styles from './FolderIconPickerMenu.module.scss';

export type OwnProps = {
  isOpen: boolean;
  buttonRef: RefObject<HTMLButtonElement>;
  onIconSelect: (icon: { _: 'sticker'; sticker: ApiSticker }
  | { _: 'icon'; icon: typeof FOLDER_ICONS[number] }
  | { _: 'emoji'; emoji: string }) => void;
  onClose: () => void;
};

interface StateProps {
  areFeaturedStickersLoaded?: boolean;
  isTranslucent?: boolean;
  stickerSetsById: Record<string, ApiStickerSet>;
  addedCustomEmojiIds?: string[];
  customEmojiFeaturedIds?: string[];
  isCurrentUserPremium: boolean;
}

type EmojiCategoryData = { id: string; name: string; emojis: string[] };

const OPEN_ANIMATION_DELAY = 200;
let emojiDataPromise: Promise<EmojiModule>;
let emojiRawData: EmojiRawData;
let emojiData: EmojiData;

async function ensureEmojiData() {
  if (!emojiDataPromise) {
    emojiDataPromise = import('emoji-data-ios/emoji-data.json');
    emojiRawData = (await emojiDataPromise).default;

    emojiData = uncompressEmoji(emojiRawData);
  }

  return emojiDataPromise;
}

const FolderIconPickerMenu: FC<OwnProps & StateProps> = ({
  isOpen,
  buttonRef,
  onIconSelect,
  stickerSetsById,
  addedCustomEmojiIds,
  customEmojiFeaturedIds,
  onClose,
  isCurrentUserPremium,
}) => {
  const lang = useLang();
  const transformOriginX = useRef<number>();
  useEffect(() => {
    transformOriginX.current = buttonRef.current!.getBoundingClientRect().left;
  }, [isOpen, buttonRef]);

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);

  const prefix = 'folder-custom-emoji';
  const {
    activeSetIndex,
    observeIntersectionForSet,
    observeIntersectionForPlayingItems,
    observeIntersectionForShowingItems,
    observeIntersectionForCovers,
    selectStickerSet,
  } = useStickerPickerObservers(containerRef, headerRef, prefix);

  const [categories, setCategories] = useState<EmojiCategoryData[]>();
  const [emojis, setEmojis] = useState<AllEmojis>();

  const customSets = useMemo(() => {
    const userSetIds = [...(addedCustomEmojiIds || [])];

    const setIdsToDisplay = unique(userSetIds.concat(customEmojiFeaturedIds || []));

    return Object.values(pickTruthy(stickerSetsById, setIdsToDisplay));
  }, [addedCustomEmojiIds, customEmojiFeaturedIds, stickerSetsById]);

  // Initialize data on first render.
  useEffect(() => {
    setTimeout(() => {
      const exec = () => {
        setCategories(emojiData.categories);

        setEmojis(emojiData.emojis as AllEmojis);
      };

      if (emojiData) {
        exec();
      } else {
        ensureEmojiData()
          .then(exec);
      }
    }, OPEN_ANIMATION_DELAY);
  }, []);
  const canRenderContents = useAsyncRendering([], MENU_TRANSITION_DURATION);

  const shouldRenderContent = categories && emojis && canRenderContents;
  if (!shouldRenderContent) {
    return (
      <Portal>
        <Menu
          isOpen={isOpen}
          noCompact
          bubbleClassName={styles.menuContent}
          onClose={onClose}
          transformOriginX={transformOriginX.current}
        >
          <div className="EmojiPicker">
            <Loading />
          </div>
        </Menu>
      </Portal>
    );
  }

  return (
    <Portal>
      <Menu
        isOpen={isOpen}
        noCompact
        bubbleClassName={styles.menuContent}
        onClose={onClose}
        transformOriginX={transformOriginX.current}
      >
        <div className="EmojiPicker">
          <div
            ref={headerRef}
            className={buildClassName('EmojiPicker-header', styles.folderPickerHeader, 'custom-scroll')}
            dir={lang.isRtl ? 'rtl' : undefined}
          >
            <Button
              className={buildClassName('symbol-set-button', activeSetIndex === 0 && 'activated')}
              round
              faded
              color="translucent"
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => selectStickerSet(0)}
              // ariaLabel={category.name}
            >
              <Icon name="smile" />
            </Button>
            {customSets.map((stickerSet, i) => {
              return (
                <CustomEmojiCover
                  active={activeSetIndex === i + 1}
                  stickerSet={stickerSet}
                  index={i + 1}
                  selectStickerSet={selectStickerSet}
                  observeIntersection={observeIntersectionForCovers}
                />
              );
            })}
          </div>
          <div
            ref={containerRef}
            className={buildClassName('EmojiPicker-main', IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll')}
          >
            <div id={`${prefix}-0`} className="symbol-set-container symbol-set">
              {FOLDER_ICONS.map((icon) => (
                <div className="EmojiButton" onClick={() => onIconSelect({ _: 'icon', icon })}>
                  <Icon name={`folder-${icon}`} className={styles.folderIcon} />
                </div>
              ))}
            </div>
            {categories.map((category, i) => (
              <EmojiCategory
                category={category}
                index={i + 1}
                allEmojis={emojis}
                // eslint-disable-next-line react/jsx-no-bind
                observeIntersection={() => () => {}}
                shouldRender
                // shouldRender={activeCategoryIndex >= i - 1 && activeCategoryIndex <= i + 1}
                // eslint-disable-next-line react/jsx-no-bind
                onEmojiSelect={(emoji) => onIconSelect({ _: 'emoji', emoji })}
              />
            ))}

            {customSets.map((stickerSet, i) => {
              const shouldHideHeader = stickerSet.id === TOP_SYMBOL_SET_ID
                || stickerSet.id === RECENT_SYMBOL_SET_ID;

              return (
                <StickerSet
                  key={stickerSet.id}
                  stickerSet={stickerSet}
                  loadAndPlay
                  index={i + 1}
                  idPrefix={prefix}
                  observeIntersection={observeIntersectionForSet}
                  observeIntersectionForPlayingItems={observeIntersectionForPlayingItems}
                  observeIntersectionForShowingItems={observeIntersectionForShowingItems}
                  isNearActive={activeSetIndex >= i - 1 && activeSetIndex <= i + 1}
                  isStatusPicker
                  shouldHideHeader={shouldHideHeader}
                  isCurrentUserPremium={isCurrentUserPremium}
                  // eslint-disable-next-line react/jsx-no-bind
                  onStickerSelect={(sticker) => onIconSelect({ _: 'sticker', sticker })}
                  forcePlayback
                />
              );
            })}
          </div>
        </div>
      </Menu>
    </Portal>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const {
    stickers: {
      setsById: stickerSetsById,
    },
    customEmojis: {
      // byId: customEmojisById,
      featuredIds: customEmojiFeaturedIds,
    },
  } = global;
  return {
    areFeaturedStickersLoaded: Boolean(global.customEmojis.featuredIds?.length),
    isTranslucent: selectIsContextMenuTranslucent(global),
    stickerSetsById,
    addedCustomEmojiIds: global.customEmojis.added.setIds,
    isCurrentUserPremium: selectIsCurrentUserPremium(global),
    customEmojiFeaturedIds,
  };
})(FolderIconPickerMenu));
