# r2http

Serve a Cloudflare R2 Bucket on HTTP with basic authentication.

# Quickstart

1. Create a Cloudflare R2 Bucket. Make sure the bucket is private.
2. Deploy a Cloudflare Worker with this script [target/index.js](target/index.js).
3. Bind the bucket to the worker as name `r2`.
4. Set two secrets `USERNAME` and `PASSWORD` to the worker. These secrets are
   using for basic HTTP authentication.
5. Set a variable `INDEX` which is list of file names. If request path does not,
   then one of these files will be served. For example: `index.txt:index.html`.
6. Verify the worker endpoint by `curl https://WORKER.ACCOUNT.workers.dev`.
   `WORKER` and `ACCOUNT` must be replaced properly.

# Development

```bash
# Install depency packages.
npm install

# Run all tests.
npm test

# Compile the worker from TypeScript to `target/index.js`.
npm run build
```
