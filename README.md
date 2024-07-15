# dataAcquisitionSchedulerPocAppPlatform
Data Acquisition Scheduler Proof of Concept hosted built to be hosted on DO's App Platform

This builds on the initial work done via [dataAcquisitionSchedulerPOC](https://github.com/rdig/dataAcquisitionSchedulerPOC)

Code for the scheduler _(deployed as an [DO App Platform](https://docs.digitalocean.com/products/app-platform/) Node service)_ is in the main `index.js` file, and gets deployed and built via the `Dockerfile` in the root directory.

The serverless function _(deployed as an [DO App Platform Function](https://docs.digitalocean.com/products/functions/))_ is in the `worker` folder

### General Description
- scheduler manages a list of urls to fetch data from _(since it's a PoC, that data is only the page title)_
- once it notices a new url in that list, it assigns it to a worker (serverless function)
- worker will take itself off the "available list", fetch the url, parse it and save it in the database
- then it will make itself available again via that "available list" _(currently a db collection since it's just a PoC)_
- scheduler will then mark the url as "done" and remove it from the list
- scheduler has also a time off, which, if the worker will not fetch the url in time, it will de-assign the worker and put the url back in the list for another worker to pick up
- lastly, the scheduler will listen for responses from the worker, and if the worker encounters and error fetching or parsing the url, it will de-assign the worker, but remove the url from the list fully, as at this point it will consider it a url that cannot be fetched

### Available endpoints:
_(protected by a bearer token, all, except for the main entry)_

- `/` - main entry
- `/add` - add a new urls for the scheduler to process.
  - Accepts JSON formatted as an array of objects with a `url` key _(note that url strings will be validated)_
  - Example: `curl -H "Content-Type: application/json" -H "x-auth-bearer: XXX" -X POST -d '[{"url":"https://www.google.com"}, {"url":"https://www.yahoo.com"}]' https://<scheduler-app-url>/add`
- `/processor` - show the current list of urls that are assigned to workers
- `/db` - list out the current database entries
- `/queue` - show the current queue _(urls that are waiting to be processed, but are not assigned to workers yet)_
- `/reset` - clear out the queue list
- `/worker` - Acces to the worker serverless function directly _(if deployed)_
  - Accepts JSON formatted as an single object with a `url` key _(note that url strings will be validated)_
  - Example: `curl -H "Content-Type: application/json" -H "x-auth-bearer: XXX" -X POST -d '{"url":"https://www.google.com"}' https://<scheduler-app-url>/worker`

### Demo

![demo](./demo.gif)
