import express from 'express';
import { 
    insertData, 
    getTicketById, 
    getTickets, 
    updateTicket, 
    deleteTicket, 
    getAnalytics 
} from '../controller/dataController.js';

const router = express.Router();

// Route to receive data from frontend and insert into Supabase
router.post('/data', insertData);

// Management routes
router.get('/analytics', getAnalytics);
router.get('/tickets', getTickets);
router.get('/tickets/:id', getTicketById);
router.patch('/tickets/:id', updateTicket);
router.delete('/tickets/:id', deleteTicket);

export default router;
