import { useT } from "@src/pages/shared/i18n/store";

const SignedOutGreeting = () => {
    const t = useT();
    return (
        <div className="py-3 text-center">
            <p className="m-0 text-sm text-[#efeff1]">{t("popup.signedOut")}</p>
        </div>
    );
};

export default SignedOutGreeting;
