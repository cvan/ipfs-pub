const crypto = require('crypto');
const http = require('http');
const path = require('path');
const spawn = require('child_process').spawn;
const os = require('os');
const url = require('url');

const formidable = require('formidable');
const fs = require('fs-extra');

const pkgJson = require('./package.json');

const HOST = process.env.IPFSPUB_HOST || process.env.IPFS_PUB_HOST || process.env.HOST || '0.0.0.0';
const PORT = process.env.IPFSPUB_PORT || process.env.IPFS_PUB_PORT || process.env.PORT || 9000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const DEBUG = NODE_ENV === 'development' || !module.parent;

const server = http.createServer((req, res) => {
  const method = req.method.toLowerCase();
  const pathname = url.parse(req.url).pathname;

  if (DEBUG) {
    console.log('[%s] %s', method, pathname);
  }

  if (method === 'post') {
    if (pathname === '/') {
      let form = new formidable.IncomingForm();
      let formData = {};
      let fields = [];
      let files = [];
      form.encoding = 'utf-8';
      const uploadsDir = path.join(os.tmpdir(), 'uploads');
      form.uploadDir = path.join(uploadsDir, randomDirName());
      if (!fs.existsSync(form.uploadDir)) {
        fs.mkdirsSync(form.uploadDir);
      }
      form.keepExtensions = true;
      form.multiple = true;
      form.on('field', (field, value) => {
        formData[field] = value;
        fields.push([field, value]);
      });
      form.on('file', (field, file) => {
        files.push([field, file]);
      });
      form.on('error', formErr => {
        fs.remove(form.uploadDir);
        if (formErr) {
          sendResponseUploadError(req, res, fields, files, formErr);
        }
      });
      form.on('end', () => {
        sendResponseUploadSuccess(req, res, fields, files, form.uploadDir).then(output => {
          if (DEBUG) {
            console.log('\tpublished to IPFS:', JSON.stringify(output, null, '\t\t'));
          }
          // setTimeout(() => {
          //   fs.remove(form.uploadDir);
          // }, 30000);  // 30 seconds.
        }).catch(err => {
         fs.remove(form.uploadDir);
         if (err) {
            sendResponseUploadError(req, res, fields, files, 'Unknown Error');
          }
        });
      });
      form.parse(req);
      return;
    }
  }

  sendResponseUploadForm(req, res);
});

function randomDirName () {
  return randomString(18);
}

// Replace base-64 characters with filename-safe characters.
const b64Safe = {'/': '_', '+': '-'};

function randomString (size) {
  return random(size).toString('base64').replace(/[\/\+]/g, x => b64Safe[x]);
}

function random (size) {
  try {
    return crypto.randomBytes(size);
  } catch (err) {
    return crypto.pseudoRandomBytes(size);
  }
}

function acceptsJson (req) {
  return !!(
    req &&
    req.headers &&
    req.headers.accept &&
    req.headers.accept.toLowerCase().indexOf('json') > -1
  );
}

function sendResponseUploadForm (req, res) {
  return sendResponse(req, res, {
    json: {
      message: `Sample usage: curl -X POST -d @file.extension ${req.url}`
    },
    html: `
      <form method="post" action="/" enctype="multipart/form-data">
        <fieldset>
          <legend>Upload files</legend>
          <p><input type="text" name="title"></p>
          <p><input type="file" name="upload" multiple></p>
          <p><button type="submit">Upload</button></p>
        </fieldset>
      </form>
    `
  });
}

function sendResponseUploadSuccess (req, res, fields, files, dir) {
  return ipfsPublish(dir).then(output => {
    sendResponse(req, res, {
      title: 'Upload success!',
      json: {
        success: true,
        message: 'Received upload',
        fields: fields,
        files: files
      },
      html: `
          <p class="success">Successfully uploaded ${(files && files.length === 1 ? 'file' : 'files')}!</p>
          ${(output && output.hashLocal ? `<p class="success">Published directory to IPFS hash: <a href="https://ipfs.io/ipfs/${output.hashLocal}">${output.hashLocal}</a></p>` : '')}
          ${(files && files.length ? `<ul>` : ``)}
          ${(files || []).map(file => {
            return `  <li><a href="${file[1].name}">${file[1].name}</a></li>\n`;
          }).join('\n')}
          ${(files && files.length ? `</ul>` : ``)}
          <p class="upload-again"><a href="/">Upload more files.</a></p>
      `
    });

    return output;
  });
}

function sendResponseUploadError (req, res, fields, files, err) {
  if (err) {
    console.warn('\t upload error:', err);
  }

  return sendResponse(req, res, {
    statusCode: 400,
    title: 'Upload error',
    json: {
      error: true,
      success: false,
      message: err
    },
    html: `
        <p class="error">Failed to upload ${(files && files.length === 1 ? 'file' : 'files')}.</p>
        ${(err ? `<div class="msg msg-error error">${err}</div>` : '')}
        <p class="upload-again"><a href="/">Try uploading again.</a></p>
    `
  });
}

function sendResponse (req, res, data) {
  data = data || {};
  const statusCode = parseInt(data.statusCode || '200', 10);
  const siteTitle = data.siteTitle || pkgJson.productName || '';
  const pageTitle = data.pageTitle || data.title || '';
  let json = {};
  let html = '';
  if (typeof data === 'object') {
    json = data.json;
    html = data.html;
  }
  json = json || {};
  html = html || '';
  if (acceptsJson(req)) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json'
    });
    if (typeof json !== 'string') {
      json = JSON.stringify(json, null, 2);
    }
    res.end(json);
  } else {
    res.writeHead(200, {
      'Content-Type': 'text/html'
    });
    res.end(`<!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>${pageTitle ? `${pageTitle} · ${siteTitle}` : siteTitle}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-size: 14px; }
        body { font: 1rem/1.4 monospace; padding: 30px; }
        fieldset { padding: 15px; }
        legend { padding: 0 5px; }
        h1, h2, p, ul { margin-bottom: 15px; }
        p:last-child { margin-bottom: 0; }
        input, button { font-family: inherit; font-size: inherit; }
        input[type="text"] { padding: 3px; }
        button { cursor: pointer; font-weight: bold; padding: 3px 9px; }
        .error { color: maroon; }
        .success { color: green; }
        .upload-again { margin-top: 45px; }
      </style>
    </head>
    <body>
      ${(siteTitle ? `<h1><a href="/">${siteTitle}</a></h1>` : '')}
      ${(pageTitle ? `<h2>${pageTitle}</h2>` : '')}
      ${html}
    </body>
  </html>
  `);
  }
}

// Publish to IPFS using the `ipfs` local daemon.
function ipfsPublish (dir) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ipfs', ['add', '-rq', dir]);
    let procErr = '';
    let procOutput = '';
    let rootHash = '';
 
    if (proc.stderr) {
      proc.stderr.on('data', chunk => {
        procErr += chunk;
      });
    }
 
    if (proc.stdout) {
      proc.stdout.on('data', chunk => {
        procOutput += chunk;
      });
    }
 
    const done = (evtType) => {
      return () => {
        if (DEBUG) {
          console.log('\t[ipfs] daemon process %s', evtType);
        }
 
        if (procErr) {
          reject(procErr);
          return;
        }
 
        const lines = procOutput.trim().split('\n');

        resolve({
          hashRemote: lines[0],
          hashLocal: lines[1]
        });
      };
    };

    proc.stdout.on('close', done('close'));

    proc.stdout.on('exit', done('exit'));

    proc.stdout.on('end', done('end'));
  });
}

if (!module.parent) {
  server.listen(PORT, HOST, () => {
    if (DEBUG) {
      console.log(`Listening on ${HOST}:${PORT}`);
    }
  });
}

module.exports.acceptsJson = acceptsJson;

module.exports.server = server;

module.exports.sendResponse = sendResponse;

module.exports.sendResponseUploadForm = sendResponseUploadForm;

module.exports.sendResponseUploadSuccess = sendResponseUploadSuccess;

module.exports.sendResponseUploadError = sendResponseUploadError;
