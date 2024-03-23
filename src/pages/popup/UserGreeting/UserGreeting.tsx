import React from "react";
import coverImg from '@assets/img/cover.png';
import '../index.css' 


const UserGreeting = ({userName}: any) => {
    return (
        <div className="p-2">
            <img className="w-80" src={coverImg} style={{borderRadius: 20}} />
            <h1 className="font-mono pt-1 pl-1 text-white text-sm">User: {userName} </h1>

            {/* <h1>
                Welcome to better twitch sidebar!
            </h1> */}
            {/* <img src="TwitchExtrudedWordmarkPurple.png"></img> */}
        </div>
    )
};

export default UserGreeting;