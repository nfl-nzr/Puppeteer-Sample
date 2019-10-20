const PORT = process.env.PORT || 3000;
const HEADERS = {
  JSON_HEADER: {
    'Content-Type': 'application/json'
  },
  IMG_HEADER: {
    'Content-Type': 'image/png'
  },
  PDF_HEADER: {
    'Content-Type': 'application/pdf'
  }
};


const polka = require("polka");
const puppeteer = require("puppeteer");
const fs = require('fs');
const send = require('@polka/send-type');
const { join } = require('path');
const { urlencoded } = require('body-parser');
const screenshotPath = join(__dirname, 'pages/images');
const pdfPath = join(__dirname, 'pages/pdfs');
const normalizeUrl = require('normalize-url');
const publicDir = join(__dirname, 'public');
const { promisify } = require('util');
const exists = promisify(fs.exists);
const stream = promisify(fs.readFile);

const serve = require('serve-static')(publicDir);

const newBrowser = async () => await puppeteer.launch({ headless: true })

const validate = url => {
  return /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/.test(url)
}

const parallelActions = async (page, fileName) => {

  return Promise.all([page.screenshot({ path: `${screenshotPath}/${fileName}.png`, fullPage: false }), page.pdf({
    path: `${pdfPath}/${fileName}.pdf`,
    fullPage: false
  })])
    .then(done => {
      page.close().catch(err => console.log('Error closing page =: ', err));
    })
    .catch(async err => {
      page.close();
      throw err;
    })
}

const generatePdfAndImage = async url => {
  const fileName = new Date().getTime();
  const obj = {};
  let pageTemp
  try {
    if (!browser) browser = await newBrowser()
    const page = await browser.newPage();
    pageTemp = page;
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto(url, { "waitUntil": "networkidle0" });

    await parallelActions(page, fileName);
    obj.pdf = `http://localhost:3000/pdf/${fileName}`;
    obj.img = `http://localhost:3000/img/${fileName}`;
    return obj;
  } catch (error) {
    if (pageTemp) await pageTemp.close()
    throw error;
  }
};

let browser;

const app = polka();

app.use(urlencoded());
app.use(serve);

app.post("/capture", async (req, res) => {
  const { url } = req.body;
  const normalizedUrl = normalizeUrl(url);
  const pageErr = {};
  const valid = validate(normalizedUrl)
  if (!valid) return send(res, 400, { message: "Invalid url" }, HEADERS.JSON_HEADER);
  const links = await generatePdfAndImage(normalizedUrl).catch(err => {
    console.log(err)
    if (err instanceof puppeteer.errors.TimeoutError) {
      pageErr.message = 'Page timeout. Please try later',
        pageErr.code = 502
    } else if (err.toString().includes('ERR_NAME_NOT_RESOLVED')) {
      pageErr.message = 'URL could not be resolved',
        pageErr.code = 400
    } else if (err.toString().includes('ERR_CONNECTION_REFUSED')) {
      pageErr.message = 'Connection refused',
        pageErr.code = 502
    } else {
      pageErr.message = 'Server error.',
        pageErr.code = 500
    }
  });
  if (Object.entries(pageErr).length > 0 && pageErr.constructor === Object) { return send(res, pageErr.code, { message: pageErr.message }, HEADERS.JSON_HEADER); }
  else { return send(res, 200, links, HEADERS.JSON_HEADER) };
});

app.get("/pdf/:id", async (req, res) => {
  const { id } = req.params;
  const pdfLoc = join(pdfPath, `${id}.pdf`);
  try {
    const fileExists = await exists(pdfLoc);
    if (!fileExists) return send(res, 404, { message: 'File not found' }, HEADERS.JSON_HEADER)
    const file = await stream(pdfLoc).catch(err => console.log(err));
    send(res, 200, file, HEADERS.PDF_HEADER)
  } catch (error) {
    send(res, 200, { message: 'Something broke!' }, HEADERS.JSON_HEADER)
  }
});

app.get("/img/:id", async (req, res) => {
  const { id } = req.params;
  const imgPath = join(screenshotPath, `${id}.png`);
  try {
    const fileExists = await exists(imgPath);
    if (!fileExists) return send(res, 404, { message: 'File not found' }, HEADERS.JSON_HEADER)
    const file = await stream(imgPath).catch(err => console.log(err));
    return send(res, 200, file, HEADERS.IMG_HEADER)
  } catch (error) {
    return send(res, 500, { message: 'Something broke!' }, HEADERS.JSON_HEADER)
  }
});

app.get('/', async () => {
  try {
    const html = await stream(join(publicDir, "index.html"));
    send(res, 200, html, { 'Content-type': 'text/html' })
  } catch (error) {
    return send(res, 500, { message: 'Something broke!' }, HEADERS.JSON_HEADER)
  }
})


app.listen(PORT, () =>
  console.log(`Server listening on port ${PORT}`)
);
