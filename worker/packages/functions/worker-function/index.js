import { createHash } from 'crypto';
import { isUrl } from 'check-valid-url';
import { MongoClient } from 'mongodb';
import fetch from 'node-fetch';

const md5Hash = (string) => {
  return createHash('md5').update(string).digest('hex');
};

// Stolen from
// https://stackoverflow.com/questions/64051968/retrieving-title-of-a-page-with-url-in-nodejs
const parseTitle = (body) => {
  let match = body.match(/<title.*>([^<]*)<\/title>/, 'i') // regular expression to parse contents of the <title> tag
  if (!match || typeof match[1] !== 'string') {
    throw new Error('Unable to parse the title  tag');
  }
  return match[1];
}

export async function main(event, context) {
  // Poor man auth
  if (event?.http?.headers?.['x-auth-bearer'] !== process.env.BEARER) {
    return { body: 'Unauthorized' };
  }

  // check if correct argument is provided
  const { url } = event;
  if (!url || typeof url !== 'string' || !isUrl(url)) {
    console.error('Invalid URL');
    return { body: 'Invalid URL' };
  }

  // main try catch is just for mongo connection
  try {
    const client = new MongoClient(process.env.MONGO_CONNECTION_STRING);
    const database = client.db('urls');
    const defaultCollection = database.collection('default');
    const workersCollection = database.collection('workers');
    const getWorkerCountQuery = { id: '1' };

    // do actual work in here
    try {
      // subtract worker count since we're starting doing work
      const { count } = await workersCollection.findOne(getWorkerCountQuery);

      if (!count) {
        throw new Error('No workers available, halting. This should not happen. It means the scheduler messed up');
      }

      await workersCollection.updateOne(getWorkerCountQuery, { $set: { count: count - 1 } });

      // see if url already exists
      const urlId = md5Hash(url);
      const entryQuery = { internalId: urlId };
      const existingEntry = await defaultCollection.findOne(entryQuery);

      const response = await fetch(url);
      const stringToScrape = await response.text();

      const title = parseTitle(stringToScrape);

      // only update if we have the title
      if (title) {
        if (existingEntry) {
          await defaultCollection.updateOne(entryQuery, { $set: { title, updatedAt: new Date().getTime() } });
        } else {
          await defaultCollection.insertOne({ internalId: urlId, url, title, updatedAt: new Date().getTime() });
        }
      }

      return { body: { message: 'Parsed URL', data: title }};

    } catch (error) {

      console.error(error);
      return { body: { error }};

    } finally {

      // put back worker count (free up current worker)
      const { count } = await workersCollection.findOne(getWorkerCountQuery);
      await workersCollection.updateOne(getWorkerCountQuery, { $set: { count: count + 1 } });
      // close mongo connection
      await client.close();
    }

  } catch (error) {
    console.error(error)
    return { body: { error: 'Mongo Failed to Connect', connection: error } };
  }
}
