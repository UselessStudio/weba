import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';

import type { ApiCountry } from '../../api/types';

import { requestMeasure } from '../../lib/fasterdom/fasterdom';
import { isUserId } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import { buildCollectionByKey } from '../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';

import useInfiniteScroll from '../../hooks/useInfiniteScroll';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Checkbox from '../ui/Checkbox';
import InfiniteScroll from '../ui/InfiniteScroll';
import InputText from '../ui/InputText';
import ListItem from '../ui/ListItem';
import Loading from '../ui/Loading';
import GroupChatInfo from './GroupChatInfo';
import PickerSelectedItem from './PickerSelectedItem';
import PrivateChatInfo from './PrivateChatInfo';

import './Picker.scss';

type OwnProps = {
  className?: string;
  itemIds: string[];
  selectedIds: string[];
  filterValue?: string;
  filterPlaceholder?: string;
  notFoundText?: string;
  searchInputId?: string;
  isLoading?: boolean;
  noScrollRestore?: boolean;
  isSearchable?: boolean;
  isRoundCheckbox?: boolean;
  lockedIds?: string[];
  forceShowSelf?: boolean;
  isViewOnly?: boolean;
  onSelectedIdsChange?: (ids: string[]) => void;
  onFilterChange?: (value: string) => void;
  onDisabledClick?: (id: string) => void;
  onLoadMore?: () => void;
  isCountryList?: boolean;
  countryList?: ApiCountry[];
};

// Focus slows down animation, also it breaks transition layout in Chrome
const FOCUS_DELAY_MS = 500;

const MAX_FULL_ITEMS = 10;
const ALWAYS_FULL_ITEMS_COUNT = 5;

const Picker: FC<OwnProps> = ({
  className,
  itemIds,
  selectedIds,
  filterValue,
  filterPlaceholder,
  notFoundText,
  searchInputId,
  isLoading,
  noScrollRestore,
  isSearchable,
  isRoundCheckbox,
  lockedIds,
  forceShowSelf,
  isViewOnly,
  onSelectedIdsChange,
  onFilterChange,
  onDisabledClick,
  onLoadMore,
  isCountryList,
  countryList,
}) => {
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldMinimize = selectedIds.length > MAX_FULL_ITEMS;

  useEffect(() => {
    if (!isSearchable) return;
    setTimeout(() => {
      requestMeasure(() => {
        inputRef.current!.focus();
      });
    }, FOCUS_DELAY_MS);
  }, [isSearchable]);

  const [lockedSelectedIds, unlockedSelectedIds] = useMemo(() => {
    if (!lockedIds?.length) return [MEMO_EMPTY_ARRAY, selectedIds];
    const unlockedIds = selectedIds.filter((id) => !lockedIds.includes(id));
    return [lockedIds, unlockedIds];
  }, [selectedIds, lockedIds]);

  const lockedIdsSet = useMemo(() => new Set(lockedIds), [lockedIds]);

  const sortedItemIds = useMemo(() => {
    const lockedBucket: string[] = [];
    const unlockedBucket: string[] = [];

    itemIds.forEach((id) => {
      if (lockedIdsSet.has(id)) {
        lockedBucket.push(id);
      } else {
        unlockedBucket.push(id);
      }
    });

    return lockedBucket.concat(unlockedBucket);
  }, [itemIds, lockedIdsSet]);

  const handleItemClick = useLastCallback((id: string) => {
    if (lockedIdsSet.has(id)) {
      onDisabledClick?.(id);
      return;
    }

    const newSelectedIds = selectedIds.slice();
    if (newSelectedIds.includes(id)) {
      newSelectedIds.splice(newSelectedIds.indexOf(id), 1);
    } else {
      newSelectedIds.push(id);
    }
    onSelectedIdsChange?.(newSelectedIds);
    onFilterChange?.('');
  });

  const handleFilterChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.currentTarget;
    onFilterChange?.(value);
  });

  const [viewportIds, getMore] = useInfiniteScroll(onLoadMore, sortedItemIds, Boolean(filterValue));

  const lang = useLang();

  const countriesByIso = useMemo(() => {
    if (!countryList) return undefined;
    return buildCollectionByKey(countryList, 'iso2');
  }, [countryList]);

  const renderChatInfo = (id: string) => {
    if (isCountryList && countriesByIso) {
      const country = countriesByIso[id];
      return <div>{country.defaultName}</div>;
    } else if (isUserId(id)) {
      return <PrivateChatInfo forceShowSelf={forceShowSelf} userId={id} />;
    } else {
      return <GroupChatInfo chatId={id} />;
    }
  };

  return (
    <div className={buildClassName('Picker', className)}>
      {isSearchable && (
        <div className="picker-header custom-scroll" dir={lang.isRtl ? 'rtl' : undefined}>
          {lockedSelectedIds.map((id, i) => (
            <PickerSelectedItem
              peerId={id}
              isMinimized={shouldMinimize && i < selectedIds.length - ALWAYS_FULL_ITEMS_COUNT}
              forceShowSelf={forceShowSelf}
              onClick={handleItemClick}
              clickArg={id}
            />
          ))}
          {unlockedSelectedIds.map((id, i) => (
            <PickerSelectedItem
              peerId={id}
              isMinimized={
                shouldMinimize && i + lockedSelectedIds.length < selectedIds.length - ALWAYS_FULL_ITEMS_COUNT
              }
              canClose
              onClick={handleItemClick}
              clickArg={id}
            />
          ))}
          <InputText
            id={searchInputId}
            ref={inputRef}
            value={filterValue}
            onChange={handleFilterChange}
            placeholder={filterPlaceholder || lang('SelectChat')}
          />
        </div>
      )}

      {viewportIds?.length ? (
        <InfiniteScroll
          className={buildClassName('picker-list', 'custom-scroll', isRoundCheckbox && 'withRoundedCheckbox')}
          items={viewportIds}
          onLoadMore={getMore}
          noScrollRestore={noScrollRestore}
        >
          {viewportIds.map((id) => {
            const renderCheckbox = () => {
              return isViewOnly ? undefined : (
                <Checkbox
                  label=""
                  disabled={lockedIdsSet.has(id)}
                  checked={selectedIds.includes(id)}
                  round={isRoundCheckbox}
                />
              );
            };
            return (
              <ListItem
                key={id}
                className={buildClassName('chat-item-clickable picker-list-item', isRoundCheckbox && 'chat-item')}
                disabled={lockedIdsSet.has(id)}
                inactive={isViewOnly}
                allowDisabledClick={Boolean(onDisabledClick)}
                // eslint-disable-next-line react/jsx-no-bind
                onClick={() => handleItemClick(id)}
                ripple
              >
                {!isRoundCheckbox ? renderCheckbox() : undefined}
                {renderChatInfo(id)}
                {isRoundCheckbox ? renderCheckbox() : undefined}
              </ListItem>
            );
          })}
        </InfiniteScroll>
      ) : !isLoading && viewportIds && !viewportIds.length ? (
        <p className="no-results">{notFoundText || 'Sorry, nothing found.'}</p>
      ) : (
        <Loading />
      )}
    </div>
  );
};

export default memo(Picker);
