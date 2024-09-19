import express, { Express, Request, Response } from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import crypto from 'crypto';
import pushdrop from 'pushdrop';
import { Ninja } from 'ninja-base';

// Initialize dotenv to load variables from .env file
dotenv.config();

interface LogEventRequest {
  eventData: Record<string, any>;
}

interface LogEventResponse {
  tx: string;
  message: string;
}

const app: Express = express();
const port = process.env.PORT || 3000;

// Generate or use the provided private key from environment
const wifPrivateKey = process.env.SERVER_PRIVATE_KEY;

// Initialize the Ninja wallet with private key and Dojo URL
const ninjaWallet = new Ninja({
  privateKey: wifPrivateKey,
  config: { dojoURL: 'https://staging-dojo.babbage.systems' }
});

// Middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// CORS setup
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Access-Control-Expose-Headers', '*');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Step 1: Create a PushDrop Token
app.post('/log-event', async (req: Request, res: Response<LogEventResponse>) => {
  const { eventData } = req.body as LogEventRequest;

  if (!eventData) {
      return res.status(400).json({ tx: '', message: 'Event data is required' });
  }

  try {
      // Collect request data (IP, timestamp, endpoint)
      const ip = req.ip;
      const timestamp = new Date().toISOString();
      const endpoint = req.originalUrl;

      // Generate a unique hash for the event data
      const eventHash = crypto.createHash('sha256')
          .update(JSON.stringify({ ip, timestamp, endpoint, ...eventData }))
          .digest('hex');

      const eventDataFields = {
          ip,
          timestamp,
          endpoint,
          eventHash,
      };

      const pushDropScript = await pushdrop.create({
          fields: [JSON.stringify(eventDataFields)],
          protocolID: 'Event Logging',
      });

      // Step 2: Submit the Token
      const newEventLog = await ninjaWallet.getTransactionWithOutputs({
          outputs: [
              {
                  satoshis: 100,
                  script: pushDropScript,
                  description: 'Event log for tracking',
              }
          ]
      });

      return res.status(200).json({
          tx: newEventLog.txid || 'Transaction ID not available',
          message: 'Event logged on the blockchain',
      });

  } catch (error) {
      console.error('Error logging event:', error);
      res.status(500).json({ tx: '', message: 'Failed to log event on the blockchain' });
  }
});

// Step 3: Retrieve the Logged Data
app.get('/retrieve-logs', async (req: Request, res: Response) => {
  try {
      const loggedOutputs = await ninjaWallet.getTransactionOutputs({
          spendable: true,           // Retrieve only spendable outputs
          includeEnvelope: true      // Include the envelope for decoding
      });

      // Decode the PushDrop token
      const decodedLogs = await Promise.all(loggedOutputs.map(async (output: any) => {
          const decodedEvent = await pushdrop.decode({
              script: output.outputScript,
              fieldFormat: 'utf8'
          });
          return decodedEvent.fields[0]; // Extract and return event data
      }));

      res.status(200).json({ logs: decodedLogs });
  } catch (error) {
      console.error('Error retrieving logs:', error);
      res.status(500).json({ message: 'Failed to retrieve event logs' });
  }
});


// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
