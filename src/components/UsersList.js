import React from "react";
import { getFlagEmoji } from "../utils/getFlagEmoji";

export default function UsersList({ users }) {
  return (
    <div className="p-6">

      {/* TITLE */}
      <h2 className="text-3xl font-extrabold text-center text-white mb-6">
        🌍 GLOBAL LIVE USERS
      </h2>

      <div className="space-y-4">
        {users.map((user, index) => (
          <div
            key={index}
            className="
            bg-gradient-to-r from-gray-900 to-black
            text-white
            p-6
            rounded-2xl
            shadow-xl
            border border-gray-700
            hover:scale-[1.02]
            transition-all duration-300"
          >
            {/* Grid Layout for Perfect Alignment */}
            <div className="grid grid-cols-[max-content_max-content_1fr] gap-x-4 gap-y-5 items-center">

              {/* ROW 1: Name */}
              <div className="text-3xl font-black flex items-center gap-2">
                <span>👤</span> Name
              </div>
              <div className="text-3xl font-black text-gray-400">:</div>
              <div className="text-3xl font-black">{user.name}</div>

              {/* ROW 2: User ID */}
              <div className="text-xl font-extrabold text-indigo-400 flex items-center gap-2">
                <span>🆔</span> User ID
              </div>
              <div className="text-xl font-extrabold text-indigo-400">:</div>
              <div className="text-xl font-extrabold text-indigo-400">{user.id}</div>

              {/* ROW 3: Country */}
              <div className="text-lg font-bold flex items-center gap-2">
                <span>🌍</span> Country
              </div>
              <div className="text-lg font-bold text-gray-400">:</div>
              <div className="text-lg font-bold flex items-center gap-2">
                <span>{getFlagEmoji(user.country)}</span> {user.country}
              </div>

            </div>
          </div>
        ))}
      </div>

    </div>
  );
}