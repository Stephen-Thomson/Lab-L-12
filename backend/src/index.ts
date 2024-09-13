import express, { Express, Request, Response } from 'express'
import bodyParser from 'body-parser'
import { Ninja } from 'ninja-base'

interface LogEventRequest {
  eventData: Record<string, any>
}
interface LogEventResponse {
  tx: any
  message: string
}

const app: Express = express()
const port = 3000

// TODO: Define the server private key
// TODO: Create a Ninja Wallet

// Middleware
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// CORS Headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', '*')
  res.header('Access-Control-Allow-Methods', '*')
  res.header('Access-Control-Expose-Headers', '*')
  res.header('Access-Control-Allow-Private-Network', 'true')
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

app.post('/log-event', async (req: Request, res: Response<LogEventResponse>) => {
  const { eventData } = req.body as LogEventRequest

  if (!eventData) {
    return res.status(400).json({ tx: '', message: 'Event data is required' })
  }

  try {
    // TODO: Collect request data

    // TODO: Encrypt data
    // TODO: Generate key derivation info 
    // TODO: Create a pushdrop timestamp token

    // TODO: Create a new Bitcoin transaction
    let tx

    // Respond with the transaction ID
    res.status(200).json({ tx, message: 'Event logged on the blockchain' })
  } catch (error) {
    console.error('Error logging event:', error)
    res.status(500).json({ tx: '', message: 'Failed to log event on the blockchain' })
  }
})

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
