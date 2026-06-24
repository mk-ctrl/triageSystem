import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

/**
 * Custom React hook to establish socket connection and manage real-time tickets state.
 */
export const useTicketSocket = () => {
    const [tickets, setTickets] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [activeTicketId, setActiveTicketId] = useState(null);
    const [loading, setLoading] = useState(true);

    // Fetch initial list of tickets on load
    useEffect(() => {
        const fetchInitialTickets = async () => {
            try {
                const res = await fetch('/api/tickets?limit=50');
                if (res.ok) {
                    const data = await res.json();
                    setTickets(data.tickets || []);
                    // Auto-select the first ticket if available
                    if (data.tickets && data.tickets.length > 0) {
                        setActiveTicketId(data.tickets[0].id);
                    }
                }
            } catch (err) {
                console.error('Error fetching initial tickets:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchInitialTickets();
    }, []);

    useEffect(() => {
        // Establish WebSocket connection (via Vite proxy / socket.io)
        const socket = io();

        socket.on('connect', () => {
            console.log('🔌 WebSocket connected');
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('🔌 WebSocket disconnected');
            setIsConnected(false);
        });

        // Listen for newly submitted tickets
        socket.on('ticket_new', (newTicket) => {
            console.log('📥 WebSocket event: ticket_new', newTicket);
            setTickets((prev) => {
                // Prevent duplicate addition if already fetched
                if (prev.some(t => t.id === newTicket.id)) return prev;
                return [newTicket, ...prev];
            });
        });

        // Listen for resolved ticket updates (AI classification completed)
        socket.on('ticket_resolved', (updatedTicket) => {
            console.log('⚙️ WebSocket event: ticket_resolved', updatedTicket);
            setTickets((prev) => 
                prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t))
            );
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const activeTicket = tickets.find((t) => t.id === activeTicketId) || null;

    return {
        tickets,
        setTickets,
        isConnected,
        activeTicket,
        setActiveTicketId,
        loading
    };
};
