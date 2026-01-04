const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

// Scraper Function
async function scrapeLink(url) {
    console.log(`Starting Scrape for: ${url}`);
    
    // Render specific browser launch options
    const browser = await puppeteer.launch({
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
        ]
    });

    const page = await browser.newPage();
    
    // Request Interception
    await page.setRequestInterception(true);
    let m3u8Link = null;
    let referer = "https://hianime.to/";

    page.on('request', (req) => {
        const reqUrl = req.url();
        if (reqUrl.includes('.m3u8') && reqUrl.includes('master')) {
            m3u8Link = reqUrl;
            referer = req.headers()['referer'] || referer;
            req.abort(); // Link mil gaya, ab loading roko
        } else {
            req.continue();
        }
    });

    try {
        // Timeout 60s rakha hai kyunki free server slow hote hain
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Play button click logic (Generic selector)
        try {
            const playSelector = '#play-btn, .play-button, .btn-play';
            await page.waitForSelector(playSelector, { timeout: 5000 });
            await page.click(playSelector);
        } catch (e) {
            console.log("Auto-play or Play button not found, continuing...");
        }

        // Wait for network activity
        await new Promise(r => setTimeout(r, 8000));

    } catch (error) {
        console.error("Scraping error:", error.message);
    } finally {
        await browser.close();
    }

    return m3u8Link ? { success: true, url: m3u8Link, referer: referer } : { success: false };
}

// API Endpoint
app.get('/watch', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: "Please provide a ?url= parameter" });
    }

    const data = await scrapeLink(targetUrl);
    res.json(data);
});

app.get('/', (req, res) => {
    res.send('HiAnime Scraper is Running! Use /watch?url=YOUR_EPISODE_LINK');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
