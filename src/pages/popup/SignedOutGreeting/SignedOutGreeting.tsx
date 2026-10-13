import coverImg from '@assets/img/cover.png';

const SignedOutGreeting = () => (
    <div className="p-2 flex flex-col items-center justify-center">
        <img src={coverImg} style={{borderRadius: 20}} />
        <h1 className="font-mono pt-1 pl-1 text-white text-sm text-center">
            You're signed out of Twitch. Sign in to Twitch to use your groups; they are saved and will be here when you do.
        </h1>
    </div>
);

export default SignedOutGreeting;
