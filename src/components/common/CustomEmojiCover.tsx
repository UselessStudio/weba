import type { FC, RefObject } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import type { ApiStickerSet } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { StickerSetOrReactionsSetOrRecent } from '../../types';

import {
  POPULAR_SYMBOL_SET_ID,
  RECENT_SYMBOL_SET_ID,
  STICKER_SIZE_PICKER_HEADER,
  TOP_SYMBOL_SET_ID,
} from '../../config';
import { selectIsAlwaysHighPriorityEmoji } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import StickerSetCover from '../middle/composer/StickerSetCover';
import Button from '../ui/Button';
import Icon from './icons/Icon';
import StickerButton from './StickerButton';

import pickerStyles from '../middle/composer/StickerPicker.module.scss';
import styles from './CustomEmojiPicker.module.scss';

type OwnProps = {
  stickerSet: StickerSetOrReactionsSetOrRecent;
  active?: boolean;
  withSharedCanvas?: boolean;
  index: number;
  selectStickerSet: (index: number) => void;
  hasCover?: boolean;
  isFaded?: boolean;
  noPlay?: boolean;
  isTranslucent?: boolean;
  sharedCanvasRef?: RefObject<HTMLCanvasElement>;
  sharedCanvasHqRef?: RefObject<HTMLCanvasElement>;
  observeIntersection: ObserveFn;
};

const CustomEmojiCover: FC<OwnProps> = ({
  stickerSet,
  active,
  withSharedCanvas,
  selectStickerSet,
  index,
  hasCover,
  noPlay,
  isFaded,
  isTranslucent,
  sharedCanvasRef,
  sharedCanvasHqRef,
  observeIntersection,
}) => {
  const firstSticker = stickerSet.stickers?.[0];
  const buttonClassName = buildClassName(
    pickerStyles.stickerCover,
    active && styles.activated,
  );

  const isHq = selectIsAlwaysHighPriorityEmoji(getGlobal(), stickerSet as ApiStickerSet);

  if (stickerSet.id === TOP_SYMBOL_SET_ID) {
    return undefined;
  }

  if (hasCover || stickerSet.hasThumbnail || !firstSticker) {
    const isRecent = stickerSet.id === RECENT_SYMBOL_SET_ID || stickerSet.id === POPULAR_SYMBOL_SET_ID;
    return (
      <Button
        key={stickerSet.id}
        className={buttonClassName}
        ariaLabel={stickerSet.title}
        round
        faded={isFaded}
        color="translucent"
        // eslint-disable-next-line react/jsx-no-bind
        onClick={() => selectStickerSet(isRecent ? 0 : index)}
      >
        {isRecent ? (
          <Icon name="recent" />
        ) : (
          <StickerSetCover
            stickerSet={stickerSet as ApiStickerSet}
            noPlay={noPlay}
            forcePlayback
            observeIntersection={observeIntersection}
            sharedCanvasRef={withSharedCanvas ? (isHq ? sharedCanvasHqRef : sharedCanvasRef) : undefined}
          />
        )}
      </Button>
    );
  }

  return (
    <StickerButton
      key={stickerSet.id}
      sticker={firstSticker}
      size={STICKER_SIZE_PICKER_HEADER}
      title={stickerSet.title}
      className={buttonClassName}
      noPlay={noPlay}
      observeIntersection={observeIntersection}
      noContextMenu
      isCurrentUserPremium
      sharedCanvasRef={withSharedCanvas ? (isHq ? sharedCanvasHqRef : sharedCanvasRef) : undefined}
      withTranslucentThumb={isTranslucent}
      onClick={selectStickerSet}
      clickArg={index}
      forcePlayback
    />
  );
};

export default memo(CustomEmojiCover);
