# Multipart — Usage Guide

@oneunit/core v1.0.0

## Overview

The Multipart feature parses `multipart/form-data` requests in Node.js applications. It is built on the busboy library and provides streaming parsing with configurable size limits, MIME type filtering, file filtering, timeout safety nets, and request abort handling.

Use Multipart when you need to receive file uploads and form fields from clients. Common scenarios include:

- File upload endpoints (images, documents, videos)
- HTML form submissions with mixed fields and files
- API endpoints that accept `multipart/form-data` payloads

The feature exposes a `parse()` method for direct use, a `middleware()` factory for request pipelines, and framework-specific integrations for Express, Fastify, Koa, and node:http.

## Quick Start

Install the package if you have not already:

```bash
npm install @oneunit/core
```

Create a multipart instance and parse an incoming request:

```js
import { createApp } from '@oneunit/core';

const app = createApp();
const multipart = app.multipart();

// Parse a raw Node.js request
const result = await multipart.parse(req);

console.log('Fields:', result.fields);
console.log('Files:', result.files);
```

A typical result looks like this:

```json
{
  "fields": [
    { "fieldname": "title", "value": "My document" }
  ],
  "files": [
    {
      "fieldname": "upload",
      "originalname": "report.pdf",
      "encoding": "7bit",
      "mimetype": "application/pdf",
      "size": 1024,
      "buffer": <Buffer ...>,
      "destination": "/tmp",
      "filename": "abc123.pdf",
      "path": "/tmp/abc123.pdf"
    }
  ]
}
```

## Multipart API

The `app.multipart().multipart(options?)` call returns a multipart instance with the following methods:

| Method | Signature | Parameters | Returns | Description |
|--------|-----------|------------|---------|-------------|
| `parse` | `parse(req)` | `req: IncomingMessage` | `Promise<MultipartResult>` | Parses a multipart/form-data request into fields and files. |
| `middleware` | `middleware()` | none | `(req, res, next) => Promise<void>` | Returns a middleware function that parses the request and attaches results to `req.multipart`. |
| `enable` | `enable()` | none | `void` | Enables the multipart middleware. |
| `disable` | `disable()` | none | `void` | Disables the multipart middleware. |
| `toggle` | `toggle()` | none | `void` | Toggles the enabled state of the multipart middleware. |

Property `name` is always `"multipart"`.

Example:

```js
const multipart = app.multipart().multipart();

multipart.enable();
// ...
multipart.disable();
```

## Options

`MultipartOptions` configures parsing behavior. Pass options to `multipart(options)` or to framework middleware factories.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxFileSize` | `number` | `10 * 1024 * 1024` (10 MB) | Maximum size in bytes for a single uploaded file. |
| `maxFieldsSize` | `number` | `10 * 1024 * 1024` (10 MB) | Maximum size in bytes for all non-file fields combined. |
| `maxFiles` | `number` | `10` | Maximum number of files allowed in a single request. |
| `maxFields` | `number` | `20` | Maximum number of non-file fields allowed in a single request. |
| `allowedMimeTypes` | `string[]` | `[]` (all allowed) | Array of MIME types permitted for uploads. Empty means all types are allowed. |
| `uploadDir` | `string` | `os.tmpdir()` | Directory where uploaded files are written. |
| `fileFilter` | `(file) => boolean \| Promise<boolean>` | none | Optional predicate to accept or reject individual files. |
| `tmpdir` | `string` | `os.tmpdir()` | Temporary directory used during streaming before final placement. |
| `headersLimit` | `number` | none | Maximum headers size in bytes passed through to the underlying parser. |
| `timeoutMs` | `number` | `10000` (10 s) | Maximum time in milliseconds a parse operation may take before timing out. |

Example:

```js
const multipart = app.multipart().multipart({
  maxFileSize: 5 * 1024 * 1024,      // 5 MB per file
  maxFiles: 5,                       // at most 5 files
  maxFields: 10,                     // at most 10 text fields
  allowedMimeTypes: ['image/jpeg', 'image/png'],
  uploadDir: './uploads',
  timeoutMs: 30000,                  // 30 second timeout
});
```

## MultipartResult

`parse()` resolves to a `MultipartResult` object.

### MultipartFile

| Property | Type | Description |
|----------|------|-------------|
| `fieldname` | `string` | The form field name associated with the file. |
| `originalname` | `string` | The original filename provided by the client. |
| `encoding` | `string` | The transfer encoding of the file part. |
| `mimetype` | `string` | The MIME type of the file. |
| `size` | `number` | File size in bytes. |
| `buffer` | `Buffer` | The file contents as a Buffer. |
| `destination` | `string \| undefined` | Directory where the file was written, if applicable. |
| `filename` | `string \| undefined` | The stored filename on disk, if applicable. |
| `path` | `string \| undefined` | Full path to the stored file, if applicable. |

### MultipartField

| Property | Type | Description |
|----------|------|-------------|
| `fieldname` | `string` | The name of the form field. |
| `value` | `string` | The text value of the field. |

Example result:

```js
{
  fields: [
    { fieldname: 'username', value: 'alice' }
  ],
  files: [
    {
      fieldname: 'avatar',
      originalname: 'profile.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 24576,
      buffer: <Buffer ...>,
      destination: '/tmp',
      filename: 'f4a7b2.jpg',
      path: '/tmp/f4a7b2.jpg'
    }
  ]
}
```

## Middleware

The middleware returned by `multipart(options).middleware()` parses incoming requests and attaches the result to `req.multipart` before calling `next()`.

```js
app.use(multipart.middleware());

app.post('/upload', async (req, res) => {
  const { fields, files } = req.multipart;
  res.json({ fields, fileCount: files.length });
});
```

State methods:

- `enable()` — allows middleware to process requests.
- `disable()` — middleware skips parsing and calls `next()` immediately.
- `toggle()` — switches between enabled and disabled states.

The middleware instance exposes `name`, `enabled`, and `options`:

```js
console.log(multipart.name);      // "multipart"
console.log(multipart.enabled);   // true or false
console.log(multipart.options);   // the resolved MultipartOptions
```

## Framework Integration

### Express

```js
import express from 'express';
import { expressMultipartMiddleware } from '@oneunit/core';

const app = express();

app.use(expressMultipartMiddleware({
  maxFileSize: 10 * 1024 * 1024,
  uploadDir: './uploads',
}));

app.post('/upload', async (req, res) => {
  const { fields, files } = req.multipart;
  res.json({ fields, files });
});
```

### Fastify

```js
import Fastify from 'fastify';
import { fastifyMultipartMiddleware } from '@oneunit/core';

const fastify = Fastify();

fastify.addHook('onRequest', fastifyMultipartMiddleware({
  maxFiles: 5,
  allowedMimeTypes: ['image/png', 'image/jpeg'],
}));

fastify.post('/upload', async (req, reply) => {
  const { fields, files } = req.multipart;
  reply.send({ fields, files });
});
```

Fastify uses `req.raw` to access the underlying Node.js request.

### Koa

```js
import Koa from 'koa';
import { koaMultipartMiddleware } from '@oneunit/core';

const app = new Koa();

app.use(koaMultipartMiddleware({
  maxFileSize: 20 * 1024 * 1024,
}));

app.use(async (ctx) => {
  if (ctx.method === 'POST' && ctx.path === '/upload') {
    const { fields, files } = ctx.multipart;
    ctx.body = { fields, files };
  }
});
```

Koa uses `ctx.req` to access the underlying Node.js request.

### node:http

```js
import { createServer } from 'node:http';
import { httpMultipartMiddleware } from '@oneunit/core';

const server = createServer();

server.on('request', httpMultipartMiddleware({
  maxFields: 20,
  timeoutMs: 15000,
}, async (req, res) => {
  const { fields, files } = req.multipart;
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ fields, files }));
}));

server.listen(3000);
```

The `httpMultipartMiddleware` factory handles parse errors automatically and responds with a 400 status and a JSON error body.

## Size Limits

Enforce limits through `maxFileSize`, `maxFiles`, and `maxFields`. Violations throw typed errors.

### maxFileSize

Rejects any single file larger than the limit:

```js
const multipart = app.multipart().multipart({
  maxFileSize: 2 * 1024 * 1024, // 2 MB
});

try {
  await multipart.parse(req);
} catch (err) {
  if (err.name === 'MultipartFileTooLargeError') {
    res.status(400).json({ error: 'File too large' });
  }
}
```

### maxFiles

Rejects requests containing more files than allowed:

```js
const multipart = app.multipart().multipart({
  maxFiles: 3,
});

// A request with 4 files throws MultipartTooManyFilesError
```

### maxFields

Rejects requests containing more non-file fields than allowed:

```js
const multipart = app.multipart().multipart({
  maxFields: 5,
});

// A request with 6 text fields throws MultipartTooManyFieldsError
```

`maxFieldsSize` limits the combined size of all text fields:

```js
const multipart = app.multipart().multipart({
  maxFieldsSize: 100 * 1024, // 100 KB total for fields
});
```

## MIME Type Filtering

Use `allowedMimeTypes` to restrict uploads to specific file types. An empty array (the default) permits all MIME types.

```js
const multipart = app.multipart().multipart({
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
});

try {
  await multipart.parse(req);
} catch (err) {
  if (err.name === 'MultipartInvalidMimeTypeError') {
    res.status(400).json({ error: 'Unsupported file type' });
  }
}
```

## File Filter

`fileFilter` lets you apply custom logic to each file. Return `true` to accept, `false` to reject. The function may be async.

```js
const multipart = app.multipart().multipart({
  fileFilter: (file) => {
    // Reject executables by original name
    return !file.originalname.match(/\.(exe|sh|bat)$/i);
  },
});

// Async filter example
const multipartAsync = app.multipart().multipart({
  fileFilter: async (file) => {
    const allowed = await checkVirusScan(file.buffer);
    return allowed;
  },
});
```

A rejected file causes `parse()` to throw `MultipartInvalidMimeTypeError`.

## Timeout & Abort Handling

`timeoutMs` bounds how long a parse operation may run. The default is 10000 ms (10 seconds).

```js
const multipart = app.multipart().multipart({
  timeoutMs: 30000, // 30 seconds
});

try {
  await multipart.parse(req);
} catch (err) {
  if (err.name === 'MultipartParseTimeoutError') {
    res.status(408).json({ error: 'Request parsing timed out' });
  }
}
```

Request abort detection: if the client closes the connection before parsing completes, the underlying stream emits an abort event and parsing stops. Handle this in your route or middleware:

```js
req.on('aborted', () => {
  // Clean up partially written files if needed
});
```

## Best Practices

Do:

- Validate MIME types with `allowedMimeTypes` for public upload endpoints.
- Use `maxFileSize` and `maxFiles` to prevent denial-of-service through large uploads.
- Stream large files to disk via `uploadDir` rather than holding them in memory.
- Set `timeoutMs` appropriate to expected client upload speeds.
- Check `req.multipart` in middleware-based flows instead of calling `parse()` twice.
- Handle `MultipartDisabledError` if middleware may be disabled at runtime.

Don't:

- Call `parse()` on a request already consumed by middleware; the stream is exhausted.
- Rely on `buffer` for very large files; prefer `destination`/`path` when streaming to disk.
- Omit `fileFilter` when accepting uploads from untrusted users.
- Set `timeoutMs` so low that legitimate slow connections fail.
- Assume `allowedMimeTypes` blocks malicious file contents; it only inspects the declared MIME type.

## Error Handling

| Error | When thrown |
|-------|-------------|
| `MultipartDisabledError` | The multipart instance or middleware is disabled and `parse()` or `middleware()` is invoked. |
| `MultipartFileTooLargeError` | A single file exceeds `maxFileSize`. |
| `MultipartTooManyFilesError` | The request contains more files than `maxFiles`. |
| `MultipartTooManyFieldsError` | The request contains more fields than `maxFields`. |
| `MultipartInvalidMimeTypeError` | A file's MIME type is not in `allowedMimeTypes`, or `fileFilter` returned false. |
| `MultipartParseTimeoutError` | Parsing did not complete within `timeoutMs`. |

Example error handling wrapper:

```js
async function handleUpload(req, res) {
  try {
    const result = await multipart.parse(req);
    res.json(result);
  } catch (err) {
    let status = 400;
    let code = 'multipart_error';

    switch (err.name) {
      case 'MultipartDisabledError':
        status = 403;
        code = 'multipart_disabled';
        break;
      case 'MultipartFileTooLargeError':
        status = 413;
        code = 'file_too_large';
        break;
      case 'MultipartTooManyFilesError':
        status = 413;
        code = 'too_many_files';
        break;
      case 'MultipartTooManyFieldsError':
        status = 413;
        code = 'too_many_fields';
        break;
      case 'MultipartInvalidMimeTypeError':
        status = 415;
        code = 'unsupported_media_type';
        break;
      case 'MultipartParseTimeoutError':
        status = 408;
        code = 'request_timeout';
        break;
    }

    res.status(status).json({ error: code, message: err.message });
  }
}
```
