import express, { Express, Request, Response } from 'express'
import bodyParser from 'body-parser'
import { Ninja } from 'ninja-base'  // Import Ninja wallet library
import { PrivateKey } from '@bsv/sdk'
import dotenv from 'dotenv'
import crypto from 'crypto'

// Initialize dotenv to load variables from .env file
dotenv.config()

interface LogEventRequest {
  eventData: Record<string, any>
}
interface LogEventResponse {
  tx: string
  message: string
}

const app: Express = express()
const port = process.env.PORT || 3000

// Get private key from .env or generate one if not available
const privateKey = process.env.SERVER_PRIVATE_KEY || PrivateKey.fromRandom().toHex()
console.log('Server Private Key:', privateKey)

// Create a Ninja wallet using the private key
const ninjaWallet = new Ninja({
  privateKey: process.env.SERVER_PRIVATE_KEY,
});

// Middleware
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// CORS Headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', '*')
  res.header('Access-Control-Allow-Methods', '*')
  res.header('Access-Control-Expose-Headers', '*')
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

// API endpoint for logging events
app.post('/log-event', async (req: Request, res: Response<LogEventResponse>) => {
  const { eventData } = req.body as LogEventRequest

  if (!eventData) {
    return res.status(400).json({ tx: '', message: 'Event data is required' })
  }

  try {
    // Collect request data (IP, timestamp, endpoint)
    const ip = req.ip;
    const timestamp = new Date().toISOString();
    const endpoint = req.originalUrl;

    // Optionally encrypt or hash data (using SHA-256)
    const eventHash = crypto.createHash('sha256')
      .update(JSON.stringify({ ip, timestamp, endpoint, ...eventData }))
      .digest('hex');

    // Use the hash and timestamp to create a PushDrop token
    const pushDropToken = `Hash:${eventHash}|Timestamp:${timestamp}`;

    // Create a transaction on the blockchain with the event data
    const tx = await ninjaWallet.createTransactionWithOutputs({
      outputs: [
        {
          script: pushDropToken,
          satoshis: 546, // Minimum dust limit
        },
      ],
    });
    

    console.log('Transaction created:', tx)

    // Respond with the transaction ID
    res.status(200).json({ 
      tx: tx.txid || 'Transaction ID not available', 
      message: 'Event logged on the blockchain' 
    });
  } catch (error) {
    console.error('Error logging event:', error)
    res.status(500).json({ tx: '', message: 'Failed to log event on the blockchain' })
  }
})

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
