import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useCallback, useRef } from '../../../../lib/teact/teact';

import type { ApiFormattedText, ApiSticker } from '../../../../api/types';
import type { FOLDER_ICONS } from '../../../../config';

import { FOLDER_EMOTICONS } from '../../../../config';

import useAppLayout from '../../../../hooks/useAppLayout';
import useFlag from '../../../../hooks/useFlag';

import FolderIcon from '../../../common/FolderIcon';
import Button from '../../../ui/Button';
import FolderIconPickerMenu from './FolderIconPickerMenu';

type OwnProps = {
  setIconFolder: (icon: string) => void;
  setIconEmoji: (emoji: string) => void;
  setIconSticker: (sticker: ApiSticker) => void;
  noTitleAnimations?: boolean;
  emoticon?: string;
  title: ApiFormattedText;
};

const FolderIconButton: FC<OwnProps> = ({
  setIconEmoji, setIconFolder, setIconSticker, title, emoticon, noTitleAnimations,
}) => {
  // eslint-disable-next-line no-null/no-null
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isStatusPickerOpen, openStatusPicker, closeStatusPicker] = useFlag(false);
  const { isMobile } = useAppLayout();

  const handleIconSelect = useCallback((icon: { _: 'sticker'; sticker: ApiSticker }
  | { _: 'icon'; icon: typeof FOLDER_ICONS[number] }
  | { _: 'emoji'; emoji: string }) => {
    closeStatusPicker();
    switch (icon._) {
      case 'sticker':
        setIconSticker(icon.sticker);
        break;
      case 'icon':
        setIconFolder(FOLDER_EMOTICONS[icon.icon]);
        break;
      case 'emoji':
        setIconEmoji(icon.emoji);
        break;
    }
  }, [setIconEmoji, setIconFolder, setIconSticker]);

  const handleEmojiStatusClick = useCallback(() => {
    openStatusPicker();
  }, [openStatusPicker]);

  return (
    <div className="extra-spacing">
      <Button
        round
        ref={buttonRef}
        ripple={!isMobile}
        size="smaller"
        color="translucent"
        className="emoji-status"
        onClick={handleEmojiStatusClick}
      >
        <FolderIcon noTitleAnimations={noTitleAnimations} title={title} emoticon={emoticon} />
      </Button>
      <FolderIconPickerMenu
        buttonRef={buttonRef}
        isOpen={isStatusPickerOpen}
        onIconSelect={handleIconSelect}
        onClose={closeStatusPicker}
      />
    </div>
  );
};

export default memo(FolderIconButton);
