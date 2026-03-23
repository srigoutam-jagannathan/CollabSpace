-- Add connections table to Realtime publication so clients
-- can subscribe to connection status changes (accept/reject)
ALTER PUBLICATION supabase_realtime ADD TABLE connections;
