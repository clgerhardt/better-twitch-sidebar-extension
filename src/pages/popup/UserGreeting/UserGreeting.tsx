import React, { useState } from "react";
import ToggleList from '../UI/ToggleList';
import { useT } from '@src/pages/shared/i18n/store';

// The picture's space is reserved from the first paint, so nothing below it moves when it loads. Until
// then (or when there is no picture) a circle with the account's initial stands in.
const Avatar = ({ name, image }: { name?: string; image?: string }) => {
    const [loaded, setLoaded] = useState(false);
    return (
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-purple-500">
            <span data-testid="avatar-initial" aria-hidden="true" className="flex h-full w-full items-center justify-center text-lg font-bold text-white">
                {name ? Array.from(name)[0]?.toUpperCase() : ""}
            </span>
            {image && (
                <img
                    src={image}
                    alt={name ?? ""}
                    onLoad={() => setLoaded(true)}
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
                />
            )}
        </div>
    );
};

const UserGreeting = ({userName, userImage}: {userName?: string; userImage?: string}) => {
    const t = useT();
    return (
        <div>
            <div className="flex items-center gap-3 px-1 py-3">
                <Avatar name={userName} image={userImage} />
                <div className="min-w-0">
                    <div className="h-5 truncate text-[15px] font-medium text-[#efeff1]">{userName}</div>
                    <div className="text-xs text-[#adadb8]">{t("popup.connected")}</div>
                </div>
            </div>
            <ToggleList />
        </div>
    )
};

export default UserGreeting;
