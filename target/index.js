/**
 * A Cloudflare Workers that serves a Cloudflare R2 Bucket on HTTP, with basic
 * authentication.
 *
 * Binding requirements:
 *
 *  * `r2` A private Cloudflare R2 Bucket. This bucket is served on HTTP.
 *  * `USERNAME` A secret, username for HTTP basic authentication.
 *  * `PASSWORD` A secret, password for HTTP basic authentication.
 */
export default {
    async fetch(request, env) {
        try {
            assertGetMethod(request);
            authenticateBasic(request, env);
            let object = await downloadR2Object(request, env.r2);
            return createFileResponse(object);
        }
        catch (error) {
            if (error instanceof HttpError) {
                return error.toResponse();
            }
            return new Response(`Oops! It's server side fault`, { status: 500 });
        }
    }
};
function assertGetMethod(request) {
    let { method } = request;
    if (method !== "GET") {
        throw new HttpError(405, "Method Not Allowed");
    }
}
class HttpError extends Error {
    status;
    description;
    headers;
    constructor(status, description, headers) {
        super(description);
        this.name = HttpError.name;
        this.status = status;
        this.description = description;
        this.headers = headers;
    }
    toResponse() {
        return new Response(`${this.status} - ${this.message}`, {
            status: this.status,
            headers: this.headers
        });
    }
}
function authenticateBasic(request, env) {
    let { USERNAME, PASSWORD } = env;
    let credential = extractBasicCredential(request);
    if (!credential ||
        credential.username != USERNAME ||
        credential.password !== PASSWORD) {
        throw new HttpError(401, "Unauthorized", new Headers({ "WWW-Authenticate": "Basic" }));
    }
}
function extractBasicCredential(request) {
    let authHeader = request.headers.get("Authorization");
    if (!authHeader) {
        return undefined;
    }
    let parts = authHeader.split(" ");
    if (parts.length != 2) {
        return undefined;
    }
    let [mode, encoded] = parts;
    if (!mode || !encoded || mode.toLowerCase() !== "basic") {
        return undefined;
    }
    let [username, password] = atob(encoded).split(":");
    if (!username || !password) {
        return undefined;
    }
    return {
        username,
        password
    };
}
async function downloadR2Object(request, r2) {
    let url = new URL(request.url);
    let objectKey = url.pathname.substring(1);
    let object = await r2.get(objectKey);
    if (!object) {
        throw new HttpError(404, "Not found");
    }
    return object;
}
function createFileResponse(object) {
    let { httpEtag } = object;
    let headers = new Headers({
        etag: httpEtag
    });
    object.writeHttpMetadata(headers);
    let { body } = object;
    return new Response(body, { headers });
}
