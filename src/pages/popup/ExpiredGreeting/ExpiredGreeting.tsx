import ReconnectButton from "@src/pages/content/components/shared/ReconnectButton";
import { useT } from "@src/pages/shared/i18n/store";

const ExpiredGreeting = () => {
    const t = useT();
    return (
        <div className="flex flex-col items-center py-3 text-center">
            <p className="m-0 text-sm text-[#efeff1]">{t("popup.expired")}</p>
            <div className="mt-3">
                <ReconnectButton />
            </div>
        </div>
    );
};

export default ExpiredGreeting;
