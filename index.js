const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

async function scrapeLink(url) {
    console.log(`Starting Scrape for: ${url}`);
    
    // 🔥 Variable yahan declare kiya taaki "ReferenceError" na aaye
    let m3u8Link = null;
    let referer = "https://hianime.to/";
    let browser = null;

    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ],
            // Dockerfile se path lega, nahi toh automatic dhundega
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
        });

        const page = await browser.newPage();

        // User Agent (Insaan dikhne ke liye)
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.setRequestInterception(true);
        
        page.on('request', (req) => {
            const reqUrl = req.url();
            // Sirf Master playlist ya index m3u8 capture karo
            if (reqUrl.includes('.m3u8') && (reqUrl.includes('master') || reqUrl.includes('index'))) {
                console.log("✅ LINK FOUND: " + reqUrl);
                m3u8Link = reqUrl;
                referer = req.headers()['referer'] || referer;
                req.abort(); 
            } else if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort(); // Faltu cheezein block karo speed ke liye
            } else {
                req.continue();
            }
        });

        // 60 Second Timeout
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        console.log("Page Title: " + await page.title());

        // Agar Homepage par redirect ho gaya toh error do
        if ((await page.title()).includes("Homepage")) {
            throw new Error("Redirected to Homepage (Invalid Link or Blocked)");
        }

        // Play Button Click Logic
        try {
            const playSelector = '#play-btn, .play-button, .btn-play';
            await page.waitForSelector(playSelector, { timeout: 5000 });
            await page.click(playSelector);
            console.log("Play button clicked");
        } catch (e) {
            console.log("Play button not found or auto-played");
        }

        // Thoda wait karo request capture karne ke liye
        await new Promise(r => setTimeout(r, 8000));

    } catch (error) {
        console.error("❌ Scraping Log:", error.message);
    } finally {
        if (browser) await browser.close();
    }

    // Ab ye crash nahi hoga kyunki variable upar defined hai
    if (m3u8Link) {
        return { success: true, url: m3u8Link, referer: referer };
    } else {
        return { success: false, error: "Link capture failed. Try different Episode." };
    }
}

app.get('/watch', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: "No URL provided" });

    const data = await scrapeLink(targetUrl);
    res.json(data);
});

app.get('/', (req, res) => res.send('Server is Live & Fixed! 🟢'));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
