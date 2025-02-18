/**
 * A Cloudflare Workers that serves a Cloudflare R2 Bucket on HTTP, with basic
 * authentication.
 *
 * Binding requirements:
 *
 *  * `r2` A private Cloudflare R2 Bucket. This bucket is served on HTTP.
 *  * `USERNAME` A secret, username for HTTP basic authentication.
 *  * `PASSWORD` A secret, password for HTTP basic authentication.
 *  * `INDEX` List of index file in a directory such as "index.html:index.txt".
 */
export default {
    async fetch(request, env) {
        try {
            assertGetMethod(request);
            authenticateBasic(request, env);
            let path = getRequestPath(request);
            let object = await downloadR2Object(path, env.r2);
            if (object) {
                return createFileResponse(object);
            }
            let index = await downloadIndexFile(path, env.r2, env.INDEX);
            if (index) {
                return createFileResponse(index);
            }
            throw new HttpError(404, "Not found");
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
function getRequestPath(request) {
    let url = new URL(request.url);
    return url.pathname.substring(1);
}
async function downloadR2Object(path, r2) {
    let object = await r2.get(path);
    return object;
}
async function downloadIndexFile(requestPath, r2, indexFiles) {
    let indexes = indexFiles.split(":").map((name) => name.trim());
    for (let index of indexes) {
        let indexFile = joinPath(requestPath, index);
        let object = await downloadR2Object(indexFile, r2);
        if (object) {
            return object;
        }
    }
    return undefined;
}
function joinPath(parent, child) {
    let first = parent.endsWith("/") ? parent : parent + "/";
    let second = child.startsWith("/")
        ? child.substring(0, child.length - 1)
        : child;
    let out = first + second;
    return out.startsWith("/") ? out.substring(1) : out;
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
