import assert from "node:assert";
import test, { after, before } from "node:test";
import { spawnSync } from "node:child_process";
import { Miniflare } from "miniflare";

const USERNAME = "me";
const PASSWORD = "***";
const R2_BUCKET = "r2";
const URL_ROOT = "https://foo.com";
const URL_FOUND = "https://foo.com/bar/baz";
const URL_INDEXED = "https://foo.com/baz";
const URL_NOT_FOUND = "https://foo.com/zzz";
let worker: Miniflare;

before(async () => {
    buildTypescriptWorker();
    worker = new Miniflare({
        modules: [
            {
                type: "ESModule",
                path: "target/index.js"
            }
        ],
        r2Buckets: [R2_BUCKET],
        bindings: {
            USERNAME,
            PASSWORD,
            INDEX: "index.html:index.txt"
        }
    });
    const bucket = await worker.getR2Bucket(R2_BUCKET);
    await bucket.put("bar/baz", "Welcome to the hell", {
        httpMetadata: {
            contentType: 'text/plain'
        }
    });
    await bucket.put("baz/index.txt", "Welcome to the heaven", {
        httpMetadata: {
            contentType: 'text/plain'
        }
    });
    await bucket.put("index.txt", "Welcome to the root", {
        httpMetadata: {
            contentType: 'text/plain'
        }
    });
    await worker.ready;
});

after(async () => {
    await worker.dispose();
});

test("unauthorized request", async () => {
    let response = await worker.dispatchFetch(URL_ROOT);
    assert.strictEqual(response.status, 401);
    let body = await response.text();
    assert.strictEqual(body, "401 - Unauthorized");
});

test("authorized request, file is found", async () => {
    let response = await worker.dispatchFetch(URL_FOUND, {
        headers: {
            Authorization: getAuthorizationHeader()
        }
    });
    assert.strictEqual(response.status, 200);
    let body = await response.text();
    assert.strictEqual(body, "Welcome to the hell");
});

test("authorized request, file not found", async () => {
    let response = await worker.dispatchFetch(URL_NOT_FOUND, {
        headers: {
            Authorization: getAuthorizationHeader()
        }
    });
    assert.strictEqual(response.status, 404);
    let body = await response.text();
    assert.strictEqual(body, "404 - Not found");
});

test("reject method post", async () => {
    let response = await worker.dispatchFetch(URL_ROOT, {
        method: "POST"
    });
    assert.strictEqual(response.status, 405);
    let body = await response.text();
    assert.strictEqual(body, "405 - Method Not Allowed");
});

test("reject method delete", async () => {
    let response = await worker.dispatchFetch(URL_ROOT, {
        method: "DELETE"
    });
    assert.strictEqual(response.status, 405);
    let body = await response.text();
    assert.strictEqual(body, "405 - Method Not Allowed");
});

test("return mime type", async () => {
    let response = await worker.dispatchFetch(URL_FOUND, {
        headers: {
            Authorization: getAuthorizationHeader()
        }
    });
    assert.strictEqual(response.status, 200);
    let body = await response.text();
    let contentType = response.headers.get("content-type");
    assert.strictEqual(contentType, "text/plain");
    assert.strictEqual(body, "Welcome to the hell");
})

test("return index at non root", async () => {
    let response = await worker.dispatchFetch(URL_INDEXED, {
        headers: {
            Authorization: getAuthorizationHeader()
        }
    });
    assert.strictEqual(response.status, 200);
    let body = await response.text();
    assert.strictEqual(body, "Welcome to the heaven");
})

test("return index at root", async () => {
    let response = await worker.dispatchFetch(URL_ROOT, {
        headers: {
            Authorization: getAuthorizationHeader()
        }
    });
    assert.strictEqual(response.status, 200);
    let body = await response.text();
    assert.strictEqual(body, "Welcome to the root");
})

function buildTypescriptWorker() {
    spawnSync("npm run build", {
        shell: true,
        stdio: "pipe"
    });
}

function getAuthorizationHeader(): string {
    let credentials = btoa(`${USERNAME}:${PASSWORD}`);
    return `Basic ${credentials}`;
}
