import express from 'express';
import { createHash } from 'crypto';
import { isUrl } from 'check-valid-url';
import { MongoClient } from 'mongodb';
import fetch from 'node-fetch';

const client = new MongoClient(process.env.MONGO_CONNECTION_STRING);

let data = [];
const processor = {};

(async () => {
  // connect to the db
  const database = client.db('urls');
  const defaultCollection = database.collection('default');
  const workersCollection = database.collection('workers');
  const getWorkerCountQuery = { id: '1' };

  // declare methods
  const md5Hash = (string) => {
    return createHash('md5').update(string).digest('hex');
  };

  const handleQueue = (...args) => {
    console.log('Array updated', ...args);

    // get first value in array using shift
    const urlToProcess = data.shift();
    const urlId = md5Hash(urlToProcess);
    console.log('Processing', urlToProcess);

    // create processor entry
    processor[urlId] = {
      id: urlId,
      url: urlToProcess,
      state: 'processing',
    };
    console.log('added entry to processor', urlToProcess);

    // pass it to the worker
    fetch(
      process.env.WORKER_URL,
      {
        method: 'POST',
        body: JSON.stringify({ url: urlToProcess }),
        headers: {
          'Content-Type': 'application/json',
          'x-auth-bearer': process.env.BEARER,
        },
      }
    ).then((response) => response.json().then((responseData) => {
      // this is a really shitty way to check this
      // problem is worker no longer has access to the internal processor state
      // so either move that state to the db or standardize worker responses
      // but I'm too lazy for that right now
      if (responseData.message === 'Parsed URL') {
        // update processor state
        processor[urlId].state = 'done';
        console.log('Tentatively, the worker has finished', urlToProcess);
      }
      // this means the worker failed outside of it's own code and try/catch blocks
      // that means that it can't clean up after itself due to the execution erroring out
      // or it reaching the timeout
      // this means that we have to clean up after it, which is again, kinda shitty
      if (responseData?.error && Object.keys(responseData.error).length) {
        workersCollection.findOne(getWorkerCountQuery).then(({ count }) => {
          if (count < (process.env.WORKER_COUNT || 2)) {
            console.log('Worker failed, cleaning up and adding a new one');
            workersCollection.updateOne(getWorkerCountQuery, { $set: { count: count + 1 } });
          }
        });
        // remove the entry so we don't processs it again
        // if it's still in the processor, set it to done so it won't be processed again
        if (processor[urlId]?.state) {
          processor[urlId].state = 'done';
        }
        // if it's in the data array, remove it
        const indexToRemove = data.indexOf(urlToProcess);
        if (indexToRemove > -1) {
          data.splice(indexToRemove, 1);
        }
        console.log('Worker failed, remoing url so its not processed again', urlToProcess);
      }
    })).catch(error => console.log(error));

    console.log('passed url to worker', urlToProcess);

    // set timeout if the worker doesn't respond in time (by checking processor state)
    setTimeout(() => {
      if (processor[urlId]?.state === 'processing' || !processor[urlId]) {
        // put back in the queue
        data.push(urlToProcess);
        console.log('!!! timeout reached, putting back in queue !!!', urlToProcess);
      }
      // clean processsor entry --- if it's not done (timeout passed), put it back in the queue, if it's done, just remove it
      delete processor[urlId];
      // this is a bit smelly, should not be a "magic number"
    }, 10000);

  };

  // TODO Bearer auth
  // Set up express server
  const server = express();
  const port = process.env.PORT || 3000;

  server.use(express.json());

  // Entry
  server.get('/', (req, res) => {
    res.status(200).json('Data Aquisition Scheduler PoC');
  })

  // List current queue
  server.get('/queue', (req, res) => {
    if (req?.headers?.['x-auth-bearer'] !== process.env.BEARER) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    return res.status(200).json(data);
  })

  // List current processor
  server.get('/processor', (req, res) => {
    if (req?.headers?.['x-auth-bearer'] !== process.env.BEARER) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    return res.status(200).json(processor);
  })

  // List current simulated db
  server.get('/db', async (req, res) => {
    if (req?.headers?.['x-auth-bearer'] !== process.env.BEARER) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const entries = await defaultCollection.find({}).toArray();
    return res.status(200).json(entries);
  })

  // Reset queue
  server.get('/reset', (req, res) => {
    if (req?.headers?.['x-auth-bearer'] !== process.env.BEARER) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    data.splice(0);
    return res.status(200).json({ message: 'Queue reset' });
  })

  // Add more urls to queue
  server.post('/add', (req, res) => {
    if (req?.headers?.['x-auth-bearer'] !== process.env.BEARER) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    // Need to use splice again, as observe doesn't work with concat
    // And push is kinda costly
    let requestData = req.body;
    requestData = Array.isArray(requestData) ? requestData : [];
    requestData = requestData
      .filter((url) => typeof url === 'string')
      .filter(isUrl);
    data.splice(data.length, 0, ...requestData);
    return res.status(200).json({ message: `${requestData.length} URLs added`, data: requestData });
  })

  // Start server
  server.listen(port, () => {
    console.log(`Scheduler listening on port ${port}`)
  })

  // start process tick
  setInterval(() => {
    workersCollection.findOne(getWorkerCountQuery).then(({ count: workerCount }) => {
      // if worker free
      // if data in queue
      if (workerCount && data.length) {
        handleQueue();
      }

      if (!workerCount) {
        // todo proper back off logic
        console.log('All workers busy, backing off ...');
      }

      if (!data.length) {
        // console.log('Queue empty, waiting. ...');
      }
    });
  }, process.env.TICK || 500);

})()
