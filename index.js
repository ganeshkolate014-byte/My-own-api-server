const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

async function scrapeLink(url) {
    console.log(`🕵️ Starting Stealth Scrape for: ${url}`);
    
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
                '--disable-gpu',
                '--window-size=1920,1080' // Full HD Screen dikhao
            ],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
        });

        const page = await browser.newPage();

        // 🔥 TRICK 1: Fake User Agent (Latest Chrome)
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

        // 🔥 TRICK 2: Headers set karo taaki lage Insaan hai
        await page.setExtraHTTPHeaders({
            'Referer': 'https://google.com/', // Hum bolenge hum Google se aaye hain
            'Accept-Language': 'en-US,en;q=0.9',
            'Upgrade-Insecure-Requests': '1'
        });

        await page.setRequestInterception(true);
        
        page.on('request', (req) => {
            const reqUrl = req.url();
            // Sirf kaam ki cheez pakdo
            if (reqUrl.includes('.m3u8') && (reqUrl.includes('master') || reqUrl.includes('index'))) {
                console.log("✅ LINK FOUND: " + reqUrl);
                m3u8Link = reqUrl;
                referer = req.headers()['referer'] || referer;
                req.abort(); 
            } else if (['image', 'font', 'stylesheet'].includes(req.resourceType())) {
                req.abort(); // Images mat load karo (Speed + Bot detection save)
            } else {
                req.continue();
            }
        });

        console.log("Navigating...");
        // Timeout 90 sec kar diya
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
        
        const title = await page.title();
        console.log("Page Title: " + title);

        // 🔥 CHECK: Agar wapas Home bhej diya, toh error do
        if (title.includes("Homepage") || title.includes("Watch Anime Online")) {
            console.log("⚠️ Soft Block Detected (Redirected to Home). Trying click trick...");
            // Yahan hum 'Watch' button dhundne ki koshish kar sakte hain agar available ho
        }

        // Play Button Click Logic
        try {
            const playSelector = '#play-btn, .play-button, .btn-play, .server-item';
            await page.waitForSelector(playSelector, { timeout: 6000 });
            await page.click(playSelector);
            console.log("🖱️ Play/Server button clicked");
        } catch (e) {
            console.log("Auto-play active or button not found.");
        }

        // Wait for network requests
        await new Promise(r => setTimeout(r, 10000));

    } catch (error) {
        console.error("❌ Error Log:", error.message);
    } finally {
        if (browser) await browser.close();
    }

    if (m3u8Link) {
        return { success: true, url: m3u8Link, referer: referer };
    } else {
        return { success: false, error: "Cloudflare/Redirect Blocked the request." };
    }
}

app.get('/watch', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: "No URL provided" });
    const data = await scrapeLink(targetUrl);
    res.json(data);
});

app.get('/', (req, res) => res.send('HiAnime Stealth Scraper v2 🥷'));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
