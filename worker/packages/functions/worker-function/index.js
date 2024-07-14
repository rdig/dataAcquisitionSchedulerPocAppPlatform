// import { createHash } from 'crypto';
// import { isUrl } from 'check-valid-url';
// import { MongoClient } from 'mongodb';

// const { createHash } = require('crypto');

export async function main(event, context) {
  // Poor man auth
  if (event?.http?.['x-auth-bearer'] !== process.env.BEARER) {
    return { statusCode: 401, body: 'Unauthorized' };
  }


  console.log('event', event);
  console.log('context', context);
  // const md5Hash = (string) => {
  //   return createHash('md5').update(string).digest('hex');
  // };

  // try {
  //   const { url } = args;
  //   if (!url || typeof url !== 'string' || !isUrl(url)) {
  //     console.error('Invalid URL');
  //     return null;
  //   }
  //   const client = new MongoClient(process.env.MONGO_CONNECTION_STRING);
  //   const database = client.db('urls');
  //   const collection = database.collection('default');

  //   // see if url already exists
  //   const urlId = md5Hash(url);
  //   const [existingEntry] = await collection.find({ internalId: '123' }).toArray();

  //   console.log('existingEntry', existingEntry);

  // } catch (error) {
  //   console.error(error)
  // }
  return { body: { event, context } };
}

// const returnValue = await main({ "url": "https://google.com" })

// console.log(returnValue)

// process.exit()

