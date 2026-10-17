// Shown instead of the groups while the browser is signed out of Twitch. The groups are kept and come
// back as soon as the same account signs in again.
const SignedOutContent = ({ isSidebarExpanded }: { isSidebarExpanded: boolean }) => {
  if (!isSidebarExpanded) return null;

  return (
    <div className="flex flex-col items-center justify-center border-solid border-y-4 border-purple-500 my-4">
      <p className="text-center py-2 px-1 text-[1.4rem]">Sign in to Twitch to see your groups</p>
    </div>
  );
};

export default SignedOutContent;
