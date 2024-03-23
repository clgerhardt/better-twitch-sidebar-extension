import React, { useEffect, useState } from "react";
import UserGreeting from "./UserGreeting/UserGreeting";
import GuestGreeting from "./GuestGreeting/GuestGreeting";

const Popup = () => {
  const [userSession, setUserSession] = useState({} as any);
  useEffect(() => {
    const initSession = async () => {
      chrome.cookies.get(
        { url: "https://twitch.tv", name: "login" },
        (cookie) => {
          if (cookie) {
            setUserSession({
              user:
                cookie.value.charAt(0).toUpperCase() + cookie.value.slice(1),
            });
            // chrome.runtime.sendMessage("SYSTEM:User:LoggedIn");
          }
        }
      );
    };
    initSession();
  }, []);
  console.log(userSession);
  return (
    <div id="main-container">
      {userSession?.user ? (
        <UserGreeting userName={userSession.user} />
      ) : (
        <GuestGreeting />
      )}
    </div>
  );
};

export default Popup;
