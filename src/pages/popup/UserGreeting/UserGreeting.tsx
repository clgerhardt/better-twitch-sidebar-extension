import React from "react";
import coverImg from '@assets/img/cover.png';
import '../index.css'
import ToggleList from '../UI/ToggleList';


const UserGreeting = ({userName, userImage}: any) => {
    return (
        <div className="p-2">
            <img className="w-80" src={coverImg} style={{borderRadius: 20}} />
            <div className="flex flex-col border-t-4 border-gray-900 mt-2">
                <div>
                    <img className="rounded-full w-16 h-16 mt-2" src={userImage} alt="User Avatar" />
                </div>
                <div>
                    <h1 className="font-mono pt-1 pl-1 text-white text-sm">{userName} </h1>
                </div>
            </div>

            <ToggleList />
        </div>
    )
};

export default UserGreeting;