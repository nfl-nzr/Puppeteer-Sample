const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.URL || `https://gentle-bastion-62479.herokuapp.com`

const express = require('express')
const puppeteer = require("puppeteer");
const fs = require('fs');
const { join } = require('path');
const { urlencoded } = require('body-parser');
const screenshotPath = join(__dirname, 'pages/images');
const pdfPath = join(__dirname, 'pages/pdfs');
const normalizeUrl = require('normalize-url');
const publicDir = join(__dirname, 'public');
const { promisify } = require('util');
const exists = promisify(fs.exists);
const stream = promisify(fs.readFile);

let browser;

const serve = require('serve-static')(publicDir);

//Init a chromium browser here rather and open tabs instead of new browsers for each request.
const newBrowser = async () => await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })

const validate = url =>  /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/.test(url);

//Parallely make the screenshot and pdf using a promise array
const parallelActions = async (page, fileName) => {

  return Promise.all([
    page.screenshot({ 
      path: `${screenshotPath}/${fileName}.png`, fullPage: true })
     ,page.pdf({ path: `${pdfPath}/${fileName}.pdf`, fullPage: true })
    ])
    .then(done => {
      page.close().catch(err => console.log('Error closing page =: ', err));
    })
    .catch(async err => {
      page.close();
      throw err;
    })
}

// Generate pdf and image from provided content. If parseHtml flag is true load page with 
// provided content else goto url and make image and pdf.

const generatePdfAndImage = async (content, parseHtml) => {
  const fileName = new Date().getTime();
  const obj = {};
  let pageTemp
  try {
    if (!browser) browser = await newBrowser();
    const page = await browser.newPage();
    pageTemp = page;

    await page.setViewport({ width: 1366, height: 768 });

    if(!parseHtml) {
      await page.goto(content, { "waitUntil": "networkidle0" });
    } else {
      await page.setContent(content);
    }

    await parallelActions(page, fileName);

    obj.pdf = `${BASE_URL}/pdf/${fileName}`;
    obj.img = `${BASE_URL}/img/${fileName}`;

    return obj;

  } catch (error) {
    if (pageTemp) pageTemp.close()
    throw error;
  }
};


const app = express();

app.use(urlencoded());
app.use(serve);

app.post("/capture", async (req, res) => {
  const { url, html } = req.body;
  const pageErr = {};
  if (url) {
    const normalizedUrl = normalizeUrl(url);
    const pageErr = {};
    const valid = validate(normalizedUrl)
    if (!valid) return res.status(400).json({message: 'Invalid url'});

    const links = await generatePdfAndImage(normalizedUrl)
    .catch(err => {
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

    if (Object.entries(pageErr).length > 0 && pageErr.constructor === Object) { return res.status(pageErr.code || 500).json({ message: pageErr.message || 'Server encountered an error.' }) }
    else if(links) { return res.status(200).json({ pdf: links.pdf, img: links.img }) };

  } else if (html) {

    const links = await generatePdfAndImage(html, true)
    .catch(err => {
      console.log(err)
      if (err instanceof puppeteer.errors.TimeoutError) {
        pageErr.message = 'Page timeout. Please try later',
          pageErr.code = 502
      }  else {
        pageErr.message = 'Server error.',
          pageErr.code = 500
      }
    });

    if (Object.entries(pageErr).length > 0 && pageErr.constructor === Object) { return res.status(pageErr.code || 500).json({ message: pageErr.message || 'Server encountered an error.' }) }
    else if(links) { return res.status(200).json({ pdf: links.pdf, img: links.img }) };
  }

});

app.get("/pdf/:id", async (req, res) => {
  const { id } = req.params;
  const pdfLoc = join(pdfPath, `${id}.pdf`);
  try {
    const fileExists = await exists(pdfLoc);
    if (!fileExists) return res.status(404).json({ message: 'Pdf not found!' })
    return res.sendFile(pdfLoc)
  } catch (error) {
    return res.status(500).json({ message: 'Something broke!' })
  }
});

app.get("/img/:id", async (req, res) => {
  const { id } = req.params;
  const imgPath = join(screenshotPath, `${id}.png`);
  try {
    const fileExists = await exists(imgPath);
    if (!fileExists) return res.status(404).json({ message: 'Image not found!' })
    return res.sendFile(imgPath)
  } catch (error) {
    return res.status(500).json({ message: 'Something broke!' })
  }
});

app.get('/', async () => {
  try {
    const html = await stream(join(publicDir, "index.html"));
    return res.sendFile(html)
  } catch (error) {
    return res.status(500).json({ message: 'Something broke!' })
  }
})


app.listen(PORT, () =>
  console.log(`Server listening on port ${PORT}`)
);
