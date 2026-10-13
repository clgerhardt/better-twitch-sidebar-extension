import { useEffect, useState } from 'react';
import { getLocalStorage, setLocalStorage } from '@src/pages/background/storage';
import { GLOBAL_STATE_KEY } from '@src/pages/utils/constants';

type ToggleItem = {
  id: number;
  label: string;
  enabled: boolean;
};

export default function ToggleList() {
  const [items, setItems] = useState<ToggleItem[]>([]);

  useEffect(() => {
    getLocalStorage(GLOBAL_STATE_KEY).then((globalState: any) => {
      const initialItems: ToggleItem[] = [
        { id: 1, label: 'Hide Original Followers List', enabled: globalState?.hideOriginalFollowersList ?? false },
        { id: 2, label: 'Hide Stories', enabled: globalState?.hideStories ?? false },
        { id: 3, label: 'Hide Live Channels', enabled: globalState?.hideLiveChannels ?? false },
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

  return (
    <div className="max-w-md mx-auto mt-8 space-y-4">
      {items.map(item => (
        <div key={item.id} className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
          <span className="text-gray-700 font-medium">{item.label}</span>
          <button
            onClick={() => toggle(item.id)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none ${item.enabled ? 'bg-purple-500' : 'bg-gray-300'}`}
            aria-pressed={item.enabled}
            role="switch"
            aria-label={item.label}
          >
            <span className={`pointer-events-none inline-block mt-[.1rem] h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${item.enabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      ))}
    </div>
  );
}
