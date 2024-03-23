import React from "react";

const GuestGreeting = () => {
    return (

        <div className="p-2 flex flex-col  
        items-center justify-center">
            <img src="/assets/img/cover.png" style={{borderRadius: 20}} />
            <h1 className="font-mono pt-1 pl-1 text-white text-sm text-center">
                You need to login to twitch before you can use this extensions functionality.
            </h1>
            <a href="https://www.twitch.tv/login" target="_" className="relative p-0.5 mt-1 inline-flex items-center justify-center font-bold overflow-hidden group rounded-md">
                <span className="w-full h-full bg-gradient-to-br from-[#ff8a05] via-[#ff5478] to-[#ff00c6] group-hover:from-[#ff00c6] group-hover:via-[#ff5478] group-hover:to-[#ff8a05] absolute"></span>
                <span className="relative px-6 py-3 transition-all ease-out bg-gray-900 rounded-md group-hover:bg-opacity-0 duration-400">
                <span className="relative text-white">Login</span>
                </span>
            </a>   
        </div>
    )
};

export default GuestGreeting;