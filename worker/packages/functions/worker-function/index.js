import { createHash } from 'crypto';
import { isUrl } from 'check-valid-url';
import { MongoClient } from 'mongodb';

const md5Hash = (string) => {
  return createHash('md5').update(string).digest('hex');
};

export async function main(event, context) {
  // Poor man auth
  if (event?.http?.headers?.['x-auth-bearer'] !== process.env.BEARER) {
    return { body: 'Unauthorized' };
  }

  try {
    const { url } = event;
    if (!url || typeof url !== 'string' || !isUrl(url)) {
      console.error('Invalid URL');
      return { body: 'Invalid URL' };
    }
    const client = new MongoClient(process.env.MONGO_CONNECTION_STRING);
    const database = client.db('urls');
    const collection = database.collection('default');

    // see if url already exists
    const urlId = md5Hash(url);
    const [existingEntry] = await collection.find({ internalId: '123' }).toArray();

    console.log('existingEntry', existingEntry);
    return { body: { existingEntry, urlId }}

  } catch (error) {
    console.error(error)
    return { body: { error } };
  }
  // return { body: { event, context, md5: md5Hash('worker') } };
}

// const returnValue = await main({ "url": "https://google.com" })

// console.log(returnValue)

// process.exit()

// console.log(main());
