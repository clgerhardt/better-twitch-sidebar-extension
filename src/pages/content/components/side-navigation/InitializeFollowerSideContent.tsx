
const InitializeFollowerSideContent = ({ globalState, isSidebarExpanded }: { globalState: any, isSidebarExpanded: any }) => {

  if(globalState.followersListInitialized) {
    return;
  }

  if (!isSidebarExpanded) return <p className="ml-4 mt-2 text-sm justify-center">Expand to get started</p>;


  const initialize = () => {
    const port = chrome.runtime.connect({ name: "content-script" });
    port.postMessage({
      message: "SYS:Followers:INITIALIZE",
    });
  };


  return (
    <div className="flex flex-col
        items-center justify-center border-solid border-y-4 border-purple-500 my-4">
      <div>
        <h3 className="text-center py-2">Welcome To Better Twitch Sidebar!</h3>
      </div>
      <div>
        <p className="text-center pb-1">
          This extension allows you to group your followed channels into custom groups.
        </p>
      </div>
      <div className="py-4">
        <button onClick={()=>{initialize()}} className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">
          Initialize!
        </button>
      </div>
    </div>
  )
};

export default InitializeFollowerSideContent;