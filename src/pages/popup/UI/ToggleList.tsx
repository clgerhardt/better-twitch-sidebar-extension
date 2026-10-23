import { useEffect, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { getLocalStorage, setLocalStorage } from '@src/pages/background/storage';
import { GLOBAL_STATE_KEY } from '@src/pages/utils/constants';

type ToggleItem = {
  id: number;
  label: string;
  // The hide switches sit together in a collapsible group; the others stand alone
  group?: 'hide';
  // A line of explanation under the label
  hint?: string;
  enabled: boolean;
};

const HIDE_OPEN_KEY = 'popupHideSectionsOpen';

// Whether the user left the group of hide switches open; the popup is a page of its own, so localStorage is fine
// for this small convenience, and it must work without it
const readHideOpen = (): boolean => {
  try {
    return window.localStorage.getItem(HIDE_OPEN_KEY) === 'true';
  } catch {
    return false;
  }
};

export default function ToggleList() {
  const [items, setItems] = useState<ToggleItem[]>([]);
  const [hideOpen, setHideOpen] = useState(readHideOpen);

  useEffect(() => {
    getLocalStorage(GLOBAL_STATE_KEY).then((globalState: any) => {
      const initialItems: ToggleItem[] = [
        { id: 1, label: 'Hide original followers list', group: 'hide', enabled: globalState?.hideOriginalFollowersList ?? false },
        { id: 2, label: 'Hide stories', group: 'hide', enabled: globalState?.hideStories ?? false },
        { id: 3, label: 'Hide live channels', group: 'hide', enabled: globalState?.hideLiveChannels ?? false },
        { id: 4, label: 'Hide streaks', group: 'hide', enabled: globalState?.hideStreaks ?? false },
        { id: 5, label: 'Hide recommended categories', group: 'hide', enabled: globalState?.hideRecommendedCategories ?? false },
        { id: 6, label: 'Hide "viewers also watch"', group: 'hide', enabled: globalState?.hideViewersAlsoWatch ?? false },
        { id: 7, label: 'Sync groups across devices', enabled: globalState?.syncGroups ?? true },
      ];
      setItems(initialItems);
    });
  }, []);

  const updateInLocalStorageById = async (id: number, value: boolean) => {
    const currentState: any = await getLocalStorage(GLOBAL_STATE_KEY);
    const updated = {
      ...currentState,
      lastUpdated: new Date().toISOString(),
    };

    switch (id) {
      case 1: updated.hideOriginalFollowersList = value; break;
      case 2: updated.hideStories = value; break;
      case 3: updated.hideLiveChannels = value; break;
      case 4: updated.hideStreaks = value; break;
      case 5: updated.hideRecommendedCategories = value; break;
      case 6: updated.hideViewersAlsoWatch = value; break;
      case 7: updated.syncGroups = value; break;
    }

    await setLocalStorage(GLOBAL_STATE_KEY, updated);
  };

  const toggle = (id: number) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          const newEnabled = !item.enabled;
          updateInLocalStorageById(id, newEnabled);

          return { ...item, enabled: newEnabled };
        }
        return item;
      })
    );
  };

  const setOpen = (open: boolean) => {
    setHideOpen(open);
    try {
      window.localStorage.setItem(HIDE_OPEN_KEY, String(open));
    } catch {
      /* not remembered */
    }
  };

  const renderRow = (item: ToggleItem, className: string) => (
    <div key={item.id} className={`flex items-center justify-between gap-3 px-3 py-2 ${className}`}>
      <div className="min-w-0">
        <span className="text-sm text-[#efeff1]">{item.label}</span>
        {item.hint && (
          <p id={`toggle-hint-${item.id}`} className="m-0 mt-0.5 text-xs text-[#adadb8]">
            {item.hint}
          </p>
        )}
      </div>
      <button
        onClick={() => toggle(item.id)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 ${item.enabled ? 'bg-purple-500' : 'bg-[#3a3a3d]'}`}
        aria-pressed={item.enabled}
        role="switch"
        aria-label={item.label}
        aria-describedby={item.hint ? `toggle-hint-${item.id}` : undefined}
      >
        <span className={`pointer-events-none mt-0.5 ml-0.5 inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${item.enabled ? 'translate-x-4' : ''}`} />
      </button>
    </div>
  );

  // Syncing is not something the user enables: it happens through Chrome sync. So it is shown as a status,
  // with a way to opt out, not as a switch to turn a feature on.
  const renderSyncStatus = (item: ToggleItem) => (
    <div key={item.id} data-testid="sync-status" className="flex items-center justify-between gap-3 rounded-md bg-white/[0.07] px-3 py-2">
      <div className="min-w-0">
        <p id="sync-status-text" className="m-0 text-sm text-[#efeff1]">
          {item.enabled ? 'Groups sync across your devices' : 'Group syncing is off'}
        </p>
        <p className="m-0 mt-0.5 text-xs text-[#adadb8]">
          {item.enabled ? 'Through Chrome sync: sign in to Chrome with Extensions sync on.' : 'Changes stay on this device. Turning it on again replaces them with your synced groups.'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => toggle(item.id)}
        aria-describedby="sync-status-text"
        className="flex-shrink-0 cursor-pointer rounded border border-solid border-[#3a3a3d] bg-transparent px-2 py-1 text-xs text-[#efeff1] hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
      >
        {item.enabled ? 'Turn off' : 'Turn on'}
      </button>
    </div>
  );

  const hideItems = items.filter(item => item.group === 'hide');
  const otherItems = items.filter(item => item.group !== 'hide');
  const hiddenCount = hideItems.filter(item => item.enabled).length;

  // The rows' space is held until the saved settings are read, so the buttons below do not jump
  return (
    <div className={`space-y-1 ${hideOpen ? 'min-h-[21.6875rem]' : 'min-h-[8.125rem]'}`}>
      {hideItems.length > 0 && (
        <div className="rounded-md bg-white/[0.07]">
          <button
            type="button"
            onClick={() => setOpen(!hideOpen)}
            aria-expanded={hideOpen}
            aria-controls="hide-sections"
            className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border-0 bg-transparent px-3 py-2 text-left text-sm text-[#efeff1] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
          >
            <span>Hide sections</span>
            <span className="flex items-center gap-2 text-xs text-[#adadb8]">
              {hiddenCount > 0 && <span>{hiddenCount} on</span>}
              <ChevronDownIcon aria-hidden="true" className={`h-4 w-4 transition-transform duration-200 ${hideOpen ? 'rotate-180' : ''}`} />
            </span>
          </button>
          {hideOpen && (
            <div id="hide-sections" role="group" aria-label="Hide sections" className="border-0 border-t border-solid border-white/10">
              {hideItems.map(item => renderRow(item, ''))}
            </div>
          )}
        </div>
      )}
      {otherItems.map(item => (item.id === 7 ? renderSyncStatus(item) : renderRow(item, 'rounded-md bg-white/[0.07]')))}
    </div>
  );
}
