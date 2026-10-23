import { useEffect, useState } from 'react';
import { getLocalStorage, setLocalStorage } from '@src/pages/background/storage';
import { GLOBAL_STATE_KEY } from '@src/pages/utils/constants';

type ToggleItem = {
  id: number;
  label: string;
  // A line of explanation under the label
  hint?: string;
  enabled: boolean;
};

export default function ToggleList() {
  const [items, setItems] = useState<ToggleItem[]>([]);

  useEffect(() => {
    getLocalStorage(GLOBAL_STATE_KEY).then((globalState: any) => {
      const initialItems: ToggleItem[] = [
        { id: 1, label: 'Hide original followers list', enabled: globalState?.hideOriginalFollowersList ?? false },
        { id: 2, label: 'Hide stories', enabled: globalState?.hideStories ?? false },
        { id: 3, label: 'Hide live channels', enabled: globalState?.hideLiveChannels ?? false },
        { id: 4, label: 'Hide streaks', enabled: globalState?.hideStreaks ?? false },
        { id: 5, label: 'Hide recommended categories', enabled: globalState?.hideRecommendedCategories ?? false },
        { id: 6, label: 'Hide "viewers also watch"', enabled: globalState?.hideViewersAlsoWatch ?? false },
        { id: 7, label: 'Sync groups across devices', hint: 'Uses Chrome sync: sign in to Chrome with Extensions sync on.', enabled: globalState?.syncGroups ?? true },
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

  // The rows' space is held until the saved settings are read, so the buttons below do not jump
  return (
    <div className="min-h-[19.375rem] space-y-1">
      {items.map(item => (
        <div key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-white/[0.07] px-3 py-2">
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
      ))}
    </div>
  );
}
