const API_URL = 'http://localhost:5000/api';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function testEndpoints() {
    console.log('--- STARTING HTTP ENDPOINT TESTS ---');

    // 1. Test GET /tickets (Should be 200)
    try {
        console.log('\n1. Testing GET /tickets...');
        const res = await fetch(`${API_URL}/tickets`);
        console.log(`Status: ${res.status}`);
        const data = await res.json();
        console.log('Pass: List fetch status: OK');
        console.log(`Tickets Count: ${data.tickets.length}`);
        console.log('Pagination:', data.pagination);
    } catch (err) {
        console.error('Error in Test 1:', err.message);
    }

    // 2. Test GET /analytics (Should be 200)
    try {
        console.log('\n2. Testing GET /analytics...');
        const res = await fetch(`${API_URL}/analytics`);
        console.log(`Status: ${res.status}`);
        const data = await res.json();
        console.log('Analytics Response:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error in Test 2:', err.message);
    }

    // 3. Test POST /data to create a ticket (Public)
    let ticketId;
    try {
        console.log('\n3. Testing POST /data to create a ticket...');
        const res = await fetch(`${API_URL}/data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_mail: 'tester@example.com',
                raw_text: 'I cannot log in to my account. It says password incorrect.',
                status: 'pending'
            })
        });
        console.log(`Status: ${res.status}`);
        const data = await res.json();
        ticketId = data.record.id;
        console.log(`Ticket Created Successfully! ID: ${ticketId}`);
    } catch (err) {
        console.error('Error in Test 3:', err.message);
    }

    if (!ticketId) {
        console.error('No ticket ID created. Aborting subsequent tests.');
        return;
    }

    // 3.5 Wait/Poll until background worker finishes processing (status becomes completed or failed)
    console.log('\nWaiting for background worker to process the ticket...');
    let status = 'pending';
    let retries = 10;
    while ((status === 'pending' || status === 'processing') && retries > 0) {
        await sleep(1500);
        try {
            const res = await fetch(`${API_URL}/tickets/${ticketId}`);
            const data = await res.json();
            status = data.status;
            console.log(`Polling status: "${status}"...`);
        } catch (err) {
            console.error('Polling error:', err.message);
        }
        retries--;
    }

    // 4. Test GET /tickets/:id
    try {
        console.log(`\n4. Testing GET /tickets/${ticketId}...`);
        const res = await fetch(`${API_URL}/tickets/${ticketId}`);
        console.log(`Status: ${res.status}`);
        const data = await res.json();
        console.log('Ticket detail:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error in Test 4:', err.message);
    }

    // 5. Test PATCH /tickets/:id (Manual Override)
    try {
        console.log(`\n5. Testing PATCH /tickets/${ticketId} (Manual Override)...`);
        const res = await fetch(`${API_URL}/tickets/${ticketId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'completed',
                drafted_response: 'This is a manually overridden customer support response.',
                classification: {
                    category: 'account_issue',
                    priority: 'high',
                    sentiment: 'frustrated'
                }
            })
        });
        console.log(`Status: ${res.status}`);
        const data = await res.json();
        console.log('Updated Ticket:', JSON.stringify(data.record, null, 2));
    } catch (err) {
        console.error('Error in Test 5:', err.message);
    }

    // 6. Test DELETE /tickets/:id
    try {
        console.log(`\n6. Testing DELETE /tickets/${ticketId}...`);
        const res = await fetch(`${API_URL}/tickets/${ticketId}`, {
            method: 'DELETE'
        });
        console.log(`Status: ${res.status}`);
        const data = await res.json();
        console.log('Response:', JSON.stringify(data));
    } catch (err) {
        console.error('Error in Test 6:', err.message);
    }

    console.log('\n--- TESTS COMPLETED ---');
}

testEndpoints();
