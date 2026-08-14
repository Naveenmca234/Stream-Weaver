import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

// Generate realistic demo CSV data as a stream
function* generateCustomerRows(count: number) {
  const firstNames = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Hank', 'Iris', 'Jack'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Taylor'];
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'example.com', 'company.org'];
  const statuses = ['active', 'inactive', 'pending', 'suspended'];
  const countries = ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'IN', 'BR', 'MX'];

  yield 'id,first_name,last_name,email,phone,age,country,status,score,created_at\n';

  for (let i = 1; i <= count; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[(i * 3) % lastNames.length];
    const domain = domains[i % domains.length];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${domain}`;
    const phone = `+1${String(Math.floor(Math.random() * 9000000000) + 1000000000)}`;
    const age = 18 + (i % 65);
    const country = countries[i % countries.length];
    const status = statuses[i % statuses.length];
    const score = (Math.random() * 100).toFixed(2);
    const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];

    yield `${i},${firstName},${lastName},${email},${phone},${age},${country},${status},${score},${date}\n`;
  }
}

function* generateTransactionRows(count: number) {
  const types = ['purchase', 'refund', 'transfer', 'withdrawal', 'deposit'];
  const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
  const statuses = ['completed', 'pending', 'failed', 'cancelled'];

  yield 'transaction_id,user_id,type,amount,currency,status,merchant,created_at\n';

  for (let i = 1; i <= count; i++) {
    const type = types[i % types.length];
    const currency = currencies[i % currencies.length];
    const status = statuses[i % statuses.length];
    const amount = (Math.random() * 10000).toFixed(2);
    const merchant = `Merchant_${(i * 7) % 100}`;
    const date = new Date(Date.now() - i * 3600000).toISOString();

    yield `txn_${i},user_${(i % 1000) + 1},${type},${amount},${currency},${status},${merchant},${date}\n`;
  }
}

function* generateEventRows(count: number) {
  const events = ['page_view', 'click', 'purchase', 'signup', 'logout', 'search', 'add_to_cart'];
  const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera'];
  const platforms = ['web', 'ios', 'android', 'desktop'];

  // NDJSON format
  for (let i = 1; i <= count; i++) {
    const event = {
      id: `evt_${i}`,
      user_id: `user_${(i % 500) + 1}`,
      event_type: events[i % events.length],
      browser: browsers[i % browsers.length],
      platform: platforms[i % platforms.length],
      session_id: `session_${Math.floor(i / 10)}`,
      duration_ms: Math.floor(Math.random() * 5000),
      timestamp: new Date(Date.now() - i * 1000).toISOString(),
    };
    yield JSON.stringify(event) + '\n';
  }
}

export async function generateDemo(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { type = 'customers', count = 10000 } = req.query;
    const rowCount = Math.min(parseInt(String(count), 10), 1000000);

    let generator: Generator<string>;
    let filename: string;
    let contentType: string;

    switch (type) {
      case 'transactions':
        generator = generateTransactionRows(rowCount);
        filename = `transactions_${rowCount}.csv`;
        contentType = 'text/csv';
        break;
      case 'events':
        generator = generateEventRows(rowCount);
        filename = `events_${rowCount}.ndjson`;
        contentType = 'application/x-ndjson';
        break;
      default:
        generator = generateCustomerRows(rowCount);
        filename = `customers_${rowCount}.csv`;
        contentType = 'text/csv';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Transfer-Encoding', 'chunked');

    // Stream the generated data
    for (const chunk of generator) {
      if (!res.write(chunk)) {
        // Respect backpressure
        await new Promise<void>((resolve) => res.once('drain', resolve));
      }
    }

    res.end();
  } catch (err: unknown) {
    const error = err as Error;
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}
