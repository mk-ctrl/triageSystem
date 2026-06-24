import React, { useState } from 'react';
import { useTicketSocket } from './hooks/useTicketSocket';

function App() {
  const {
    tickets,
    setTickets,
    isConnected,
    activeTicket,
    setActiveTicketId,
    loading
  } = useTicketSocket();

  // Ingestion Form State
  const [customerMail, setCustomerMail] = useState('');
  const [rawText, setRawText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Manual Override Form State (tracks edits on activeTicket)
  const [draftOverride, setDraftOverride] = useState('');
  const [categoryOverride, setCategoryOverride] = useState('');
  const [priorityOverride, setPriorityOverride] = useState('');
  const [sentimentOverride, setSentimentOverride] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  // Sync override state when active ticket changes
  React.useEffect(() => {
    if (activeTicket) {
      setDraftOverride(activeTicket.drafted_response || '');
      setCategoryOverride(activeTicket.classification?.category || 'general');
      setPriorityOverride(activeTicket.classification?.priority || 'low');
      setSentimentOverride(activeTicket.classification?.sentiment || 'neutral');
    } else {
      setDraftOverride('');
    }
  }, [activeTicket]);

  // Handle Mock Customer Ticket Ingestion
  const handleIngestSubmit = async (e) => {
    e.preventDefault();
    if (!customerMail || !rawText) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_mail: customerMail,
          raw_text: rawText,
          status: 'pending'
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Clear input form
        setCustomerMail('');
        setRawText('');
        
        // Optimistically set active ticket if first
        if (tickets.length === 0) {
          setActiveTicketId(data.record.id);
        }
      } else {
        console.error('Failed to submit ticket');
      }
    } catch (err) {
      console.error('Ingestion connection error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Manual Agent Override (PATCH)
  const handleSaveOverride = async () => {
    if (!activeTicket) return;

    setSavingOverride(true);
    try {
      const res = await fetch(`/api/tickets/${activeTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          drafted_response: draftOverride,
          classification: {
            category: categoryOverride,
            priority: priorityOverride,
            sentiment: sentimentOverride
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Update local state list
        setTickets((prev) => 
          prev.map((t) => (t.id === data.record.id ? data.record : t))
        );
        alert('Ticket successfully updated!');
      } else {
        alert('Failed to update ticket');
      }
    } catch (err) {
      console.error('Error updating ticket:', err);
    } finally {
      setSavingOverride(false);
    }
  };

  // Handle Ticket Delete
  const handleDeleteTicket = async () => {
    if (!activeTicket) return;
    if (!window.confirm('Are you sure you want to delete this ticket?')) return;

    try {
      const res = await fetch(`/api/tickets/${activeTicket.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        const remainingTickets = tickets.filter((t) => t.id !== activeTicket.id);
        setTickets(remainingTickets);
        if (remainingTickets.length > 0) {
          setActiveTicketId(remainingTickets[0].id);
        } else {
          setActiveTicketId(null);
        }
      } else {
        alert('Failed to delete ticket');
      }
    } catch (err) {
      console.error('Error deleting ticket:', err);
    }
  };

  return (
    <>
      {/* Navigation Bar */}
      <header className="navbar">
        <div className="logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          TriageSystem AI
        </div>
        <div className="status-indicator">
          <span className={`dot ${isConnected ? 'live' : 'offline'}`} />
          <span>{isConnected ? 'Real-Time Sync Online' : 'Connecting WebSocket...'}</span>
        </div>
      </header>

      {/* Main Body */}
      <main className="dashboard-container">
        
        {/* Sidebar - Tickets List */}
        <section className="sidebar">
          <div className="sidebar-header">
            <h2>Inbox ({tickets.length})</h2>
            {loading && <span className="spinner" />}
          </div>
          
          <div className="ticket-list">
            {tickets.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                No tickets in queue
              </div>
            ) : (
              tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className={`ticket-card ${activeTicket?.id === ticket.id ? 'active' : ''}`}
                  onClick={() => setActiveTicketId(ticket.id)}
                >
                  <div className="ticket-card-header">
                    <span className="ticket-email">{ticket.customer_mail}</span>
                    <span className="ticket-time">
                      {new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="ticket-preview">{ticket.raw_text}</p>
                  <div>
                    <span className={`badge ${ticket.status || 'pending'}`}>
                      {ticket.status === 'processing' && <span className="spinner" style={{ marginRight: '0.25rem' }} />}
                      {ticket.status || 'pending'}
                    </span>
                    {ticket.classification?.priority && (
                      <span className="badge" style={{ marginLeft: '0.5rem', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                        {ticket.classification.priority}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Workspace details & Ingestion Portal */}
        <section className="detail-area">
          <div className="detail-header">
            <div className="detail-header-info">
              {activeTicket ? (
                <>
                  <h1>Triage Ticket</h1>
                  <span className="ticket-email" style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ID: {activeTicket.id}</span>
                </>
              ) : (
                <h1>Select a Ticket</h1>
              )}
            </div>
            {activeTicket && (
              <button className="btn btn-secondary" style={{ borderColor: 'var(--accent-rose)', color: 'var(--accent-rose)' }} onClick={handleDeleteTicket}>
                Delete Ticket
              </button>
            )}
          </div>

          <div className="detail-content">
            {/* Left: Active Ticket & AI Draft Details */}
            {activeTicket ? (
              <div className="card-container">
                {/* 1. Customer Query Text */}
                <div className="section-card">
                  <h3 className="section-title">Customer Message</h3>
                  <p className="ticket-raw-text">{activeTicket.raw_text}</p>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong>Submitted by:</strong> {activeTicket.customer_mail}
                  </div>
                </div>

                {/* 2. AI Draft & Manual Response Override */}
                <div className="section-card">
                  <h3 className="section-title">
                    AI Response Draft & Action
                    {activeTicket.status === 'completed' && <span className="badge completed">Ready</span>}
                    {(activeTicket.status === 'pending' || activeTicket.status === 'processing') && (
                      <span className="badge processing">
                        <span className="spinner" style={{ marginRight: '0.25rem' }} />
                        Analyzing AI classification...
                      </span>
                    )}
                  </h3>
                  
                  <textarea
                    className="draft-textarea"
                    value={draftOverride}
                    onChange={(e) => setDraftOverride(e.target.value)}
                    placeholder="AI drafted response will appear here once processed. You can manually edit this text..."
                    disabled={activeTicket.status !== 'completed'}
                  />
                  
                  <div className="btn-container">
                    <button 
                      className="btn btn-primary" 
                      onClick={handleSaveOverride}
                      disabled={savingOverride || activeTicket.status !== 'completed'}
                    >
                      {savingOverride ? 'Saving...' : 'Approve & Save Response'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Select a ticket from the inbox list or ingest sample data to start triaging.
              </div>
            )}

            {/* Right: Metadata Overrides & Mock Customer Ingestion Form */}
            <div className="card-container">
              
              {/* Active Ticket Metadata Overrides */}
              {activeTicket && (
                <div className="section-card">
                  <h3 className="section-title">Triage Classification</h3>
                  
                  <div className="meta-panel">
                    <div className="form-group">
                      <label>AI Category</label>
                      <select 
                        className="form-control" 
                        value={categoryOverride} 
                        onChange={(e) => setCategoryOverride(e.target.value)}
                        disabled={activeTicket.status !== 'completed'}
                      >
                        <option value="technical_bug">Technical Bug</option>
                        <option value="billing">Billing</option>
                        <option value="account_issue">Account Issue</option>
                        <option value="general">General Inquiry</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Priority</label>
                      <select 
                        className="form-control" 
                        value={priorityOverride} 
                        onChange={(e) => setPriorityOverride(e.target.value)}
                        disabled={activeTicket.status !== 'completed'}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Sentiment</label>
                      <select 
                        className="form-control" 
                        value={sentimentOverride} 
                        onChange={(e) => setSentimentOverride(e.target.value)}
                        disabled={activeTicket.status !== 'completed'}
                      >
                        <option value="happy">Happy</option>
                        <option value="neutral">Neutral</option>
                        <option value="frustrated">Frustrated</option>
                        <option value="angry">Angry</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Portal Ingestion Form */}
              <div className="customer-form-container">
                <h3 className="section-title">Mock Ingestion Portal</h3>
                <form onSubmit={handleIngestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label htmlFor="mail">Customer Email</label>
                    <input
                      id="mail"
                      type="email"
                      className="form-control"
                      placeholder="customer@domain.com"
                      value={customerMail}
                      onChange={(e) => setCustomerMail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="text">Issue Description</label>
                    <textarea
                      id="text"
                      className="form-control"
                      placeholder="Describe the technical issue, billing problem, or general query..."
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit New Ticket'}
                  </button>
                </form>
              </div>

            </div>
          </div>
        </section>

      </main>
    </>
  );
}

export default App;
