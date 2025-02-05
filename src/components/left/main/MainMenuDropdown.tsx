import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';

import { APP_NAME, DEBUG, IS_BETA } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import { IS_ELECTRON, IS_MAC_OS } from '../../../util/windowEnvironment';

import useFlag from '../../../hooks/useFlag';
import useOldLang from '../../../hooks/useOldLang';
import { useFullscreenStatus } from '../../../hooks/window/useFullscreen';
import useLeftHeaderButtonRtlForumTransition from './hooks/useLeftHeaderButtonRtlForumTransition';

import Button from '../../ui/Button';
import DropdownMenu from '../../ui/DropdownMenu';
import LeftSideMenuItems from './LeftSideMenuItems';

import './MainMenuDropdown.scss';

type OwnProps = {
  shouldHideSearch?: boolean;
  hasMenu: boolean;
  isMobile?: boolean;
  shouldSkipTransition?: boolean;

  onReset: NoneToVoidFunction;
  onSelectSettings: NoneToVoidFunction;
  onSelectContacts: NoneToVoidFunction;
  onSelectArchived: NoneToVoidFunction;
};

const MainMenuDropdown: FC<OwnProps> = ({
  shouldHideSearch,
  hasMenu,
  isMobile,
  onReset,
  shouldSkipTransition,
  onSelectArchived,
  onSelectContacts,
  onSelectSettings,
}) => {
  const versionString = IS_BETA ? `${APP_VERSION} Beta (${APP_REVISION})` : (DEBUG ? APP_REVISION : APP_VERSION);

  const isFullscreen = useFullscreenStatus();

  // Disable dropdown menu RTL animation for resize
  const {
    shouldDisableDropdownMenuTransitionRef,
    handleDropdownMenuTransitionEnd,
  } = useLeftHeaderButtonRtlForumTransition(shouldHideSearch);

  const [isBotMenuOpen, markBotMenuOpen, unmarkBotMenuOpen] = useFlag();
  const oldLang = useOldLang();

  const MainButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        round
        ripple={hasMenu && !isMobile}
        size="smaller"
        color="translucent"
        className={isOpen ? 'active' : ''}
        // eslint-disable-next-line react/jsx-no-bind
        onClick={hasMenu ? onTrigger : () => onReset()}
        ariaLabel={hasMenu ? oldLang('AccDescrOpenMenu2') : 'Return to chat list'}
      >
        <div className={buildClassName(
          'animated-menu-icon',
          !hasMenu && 'state-back',
          shouldSkipTransition && 'no-animation',
        )}
        />
      </Button>
    );
  }, [hasMenu, isMobile, oldLang, onReset, shouldSkipTransition]);

  return (
    <>
      {oldLang.isRtl && <div className="DropdownMenuFiller" />}
      <DropdownMenu
        trigger={MainButton}
        footer={`${APP_NAME} ${versionString}`}
        className={buildClassName(
          'main-menu',
          oldLang.isRtl && 'rtl',
          shouldHideSearch && oldLang.isRtl && 'right-aligned',
          shouldDisableDropdownMenuTransitionRef.current && oldLang.isRtl && 'disable-transition',
        )}
        forceOpen={isBotMenuOpen}
        positionX={shouldHideSearch && oldLang.isRtl ? 'right' : 'left'}
        transformOriginX={IS_ELECTRON && IS_MAC_OS && !isFullscreen ? 90 : undefined}
        onTransitionEnd={oldLang.isRtl ? handleDropdownMenuTransitionEnd : undefined}
      >
        <LeftSideMenuItems
          onSelectArchived={onSelectArchived}
          onSelectContacts={onSelectContacts}
          onSelectSettings={onSelectSettings}
          onBotMenuOpened={markBotMenuOpen}
          onBotMenuClosed={unmarkBotMenuOpen}
        />
      </DropdownMenu>
    </>
  );
};

export default memo(MainMenuDropdown);
