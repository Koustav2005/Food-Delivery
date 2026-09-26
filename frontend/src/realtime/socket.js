import { io } from 'socket.io-client'

const backendUrl = import.meta.env.VITE_BACKEND_URL

// Single shared connection for the whole app. autoConnect is left on since
// the socket is cheap to hold open for the lifetime of a logged-in session;
// components join/leave rooms (order:<id>, driver:<id>) as they mount.
export const socket = io(backendUrl, { autoConnect: true })
