import express, { Express, Request, Response } from 'express';
import bodyParser from 'body-parser';
import { Ninja, NinjaTxInputsApi, signAction } from 'ninja-base';
import dotenv from 'dotenv';
import crypto from 'crypto';
import pushdrop from 'pushdrop';
import {
    CreateActionInput
} from '@babbage/sdk-ts';
import { PrivateKey, P2PKH } from '@bsv/sdk';

// Initialize dotenv to load variables from .env file
dotenv.config();

interface LogEventRequest {
    eventData: Record<string, any>;
}

interface LogEventResponse {
    tx: string;
    message: string;
}

interface DojoOutputToRedeemApi {
  index: number;
  unlockingScript: string | number;
  unlockingScriptLength: number;
  spendingDescription?: string;
}

interface DojoTxInputsApi {
  outputsToRedeem: DojoOutputToRedeemApi[];
}

const app: Express = express();
const port = process.env.PORT || 3000;
const createActionInputs: Record<string, CreateActionInput> = {};

// Generate or use the provided private key from environment
const wifPrivateKey = process.env.SERVER_PRIVATE_KEY || PrivateKey.fromRandom().toWif();
console.log('Using WIF Private Key:', wifPrivateKey);

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

function customConvertToDojoTxInputs(inputs: Record<string, NinjaTxInputsApi>): Record<string, DojoTxInputsApi> {
  const dojoInputs: Record<string, DojoTxInputsApi> = {};

  Object.keys(inputs).forEach(txid => {
    const ninjaInput = inputs[txid];

    dojoInputs[txid] = {
      outputsToRedeem: ninjaInput.outputsToRedeem.map(output => ({
        index: output.index,
        unlockingScript: output.unlockingScript,
        unlockingScriptLength: typeof output.unlockingScript === 'string' ? output.unlockingScript.length : 0,  // Handle string vs number case
        spendingDescription: output.spendingDescription,
      })),
    };
  });

  return dojoInputs;
}

// Define doubleSHA256 function
function doubleSHA256(buffer: Buffer): string {
  const firstHash = crypto.createHash('sha256').update(buffer).digest();
  const secondHash = crypto.createHash('sha256').update(firstHash).digest();
  return secondHash.reverse().toString('hex');
}


// API endpoint for logging events
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

    // Optionally encrypt or hash data (using SHA-256)
    const eventHash = crypto.createHash('sha256')
      .update(JSON.stringify({ ip, timestamp, endpoint, ...eventData }))
      .digest('hex');

    // Prepare data fields to include in the PushDrop script
    const eventDataFields = {
      ip,
      timestamp,
      endpoint,
      eventHash,
    };

    console.log('Creating PushDrop script...');
    const pushDropScript = await pushdrop.create({
      fields: [JSON.stringify(eventDataFields)],  // Encode the fields as JSON
      protocolID: 'Event Logging',
    });
    console.log('PushDrop script created:', pushDropScript);

    console.log('Creating transaction...');
    // Fetch UTXOs from Ninja wallet
    const utxos = await ninjaWallet.getTransactionOutputs({
      limit: 10, // Fetch up to 10 UTXOs
    });

    if (!utxos.length) {
      throw new Error('No available UTXOs to fund the transaction');
    }

    console.log('UTXOs fetched:', utxos);

    let ninjaInputs: Record<string, NinjaTxInputsApi> = {};

    // Ensure rawTx is included and hashes to txid
    for (const utxo of utxos) {
      const rawTx = utxo.envelope?.rawTx;
      console.log('Processing UTXO:', utxo);
      console.log('rawTx:', rawTx);

      if (!rawTx) {
        console.log('Missing raw transaction for UTXO:', utxo.txid);
        throw new Error(`Missing raw transaction for UTXO: ${utxo.txid}`);
      }

      // Verify that the rawTx hashes to the correct txid (double SHA-256)
      const calculatedTxid = doubleSHA256(Buffer.from(rawTx, 'hex'));

      if (calculatedTxid !== utxo.txid) {
        console.log(`rawTx does not match txid for UTXO: ${utxo.txid}. Expected ${utxo.txid}, but got ${calculatedTxid}`);
        throw new Error(`rawTx does not match txid for UTXO: ${utxo.txid}. Expected ${utxo.txid}, but got ${calculatedTxid}`);
      }

      // Map UTXOs into the correct format for transaction inputs
      ninjaInputs[utxo.txid] = {
        outputsToRedeem: [
          {
            index: utxo.vout,
            unlockingScript: rawTx,
            spendingDescription: `Spending from txid ${utxo.txid}`,
          }
        ]
      };
    }

    // Convert Ninja inputs to Dojo format
    const dojoInputs = customConvertToDojoTxInputs(ninjaInputs);

    // Create the transaction using Ninja Wallet
    const tx = await ninjaWallet.createTransaction({
      inputs: dojoInputs,  // Converted inputs
      outputs: [
        {
          satoshis: 100,
          script: pushDropScript,
        }
      ],
      labels: ["Event Logging"],
    });

    console.log('Transaction created:', tx);

    // Use `signAction` to sign the transaction
    const signedTx = await signAction(ninjaWallet, {
      inputs: ninjaInputs,
      createResult: tx,
    });

    console.log('Transaction signed:', signedTx);

    // Return the signed transaction response
    return res.status(200).json({
      tx: signedTx.txid || 'Transaction ID not available',
      message: 'Event logged on the blockchain',
    });

  } catch (error) {
    console.error('Error logging event:', error);
    res.status(500).json({ tx: '', message: 'Failed to log event on the blockchain' });
  }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
