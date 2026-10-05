
const NotLoggedInContent = ({ isSidebarExpanded }: { isSidebarExpanded: any }) => {

  if (!isSidebarExpanded) return <p className="ml-4 mt-2 text-sm justify-center">Expand to get started</p>;

  return (
    <div className="flex flex-col
        items-center justify-center border-solid border-y-4 border-purple-500 my-4">
      <div>
        <h3 className="text-center py-2">Welcome To Better Twitch Sidebar!</h3>
      </div>
      <div>
        <p className="text-center pb-1 px-1">
          You are not logged in / accepted extension to Twitch. Please log in / accept extension to use this extension.
        </p>
      </div>
      <div className="py-4">
        <a href="https://www.twitch.tv/login" target="_blank" rel="noopener noreferrer">Login</a>
      </div>
    </div>
  )
};

export default NotLoggedInContent;