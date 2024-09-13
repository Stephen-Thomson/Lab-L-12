import React, { useState } from 'react';
import axios from 'axios';
import { Container, Button, Typography, TextField } from '@mui/material';

const App: React.FC = () => {
  const [eventData, setEventData] = useState('');
  const [txId, setTxId] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogEvent = async () => {
    setIsLoading(true);
    try {
      const response = await axios.post('http://localhost:3000/log-event', {
        eventData: { description: eventData },
      });

      // Display the transaction ID and success message
      setTxId(response.data.tx);
      setMessage(response.data.message);
    } catch (error) {
      console.error('Error logging event:', error);
      setMessage('Error logging event on the blockchain.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Typography variant="h4" gutterBottom>
        Log Event and Create Blockchain Transaction
      </Typography>
      <TextField
        label="Event Data"
        value={eventData}
        onChange={(e) => setEventData(e.target.value)}
        fullWidth
        variant="outlined"
        margin="normal"
      />
      <Button
        variant="contained"
        color="primary"
        onClick={handleLogEvent}
        disabled={isLoading}
      >
        {isLoading ? 'Logging Event...' : 'Log Event'}
      </Button>

      {txId && (
        <Typography variant="body1" style={{ marginTop: '20px', color: 'green' }}>
          Transaction ID: {txId}
        </Typography>
      )}

      {message && (
        <Typography variant="body1" style={{ marginTop: '20px', color: 'red' }}>
          {message}
        </Typography>
      )}
    </Container>
  );
};

export default App;
