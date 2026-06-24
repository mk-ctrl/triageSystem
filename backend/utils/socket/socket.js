import { Server } from 'socket.io';

let io = null;

/**
 * Initialize Socket.io on the provided HTTP server.
 */
export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: '*', // Allow all origins for development
            methods: ['GET', 'POST', 'PATCH', 'DELETE']
        }
    });

    io.on('connection', (socket) => {
        console.log(`🔌 Client connected to WebSocket: ${socket.id}`);
        
        socket.on('disconnect', () => {
            console.log(`🔌 Client disconnected from WebSocket: ${socket.id}`);
        });
    });

    return io;
};

/**
 * Retrieve the active Socket.io instance.
 */
export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io has not been initialized. Call initSocket first.');
    }
    return io;
};
