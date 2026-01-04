const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

async function scrapeLink(url) {
    console.log(`Starting Scrape for: ${url}`);
    let browser = null;

    try {
        // Browser Launch Options (RAM bachane ke liye optimized)
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Memory issue fix
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
        });

        const page = await browser.newPage();

        // 🚀 Cloudflare Bypass Logic
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.setRequestInterception(true);
        
        let m3u8Link = null;
        let referer = "https://hianime.to/";

        page.on('request', (req) => {
            const reqUrl = req.url();
            if (reqUrl.includes('.m3u8') && reqUrl.includes('master')) {
                console.log("✅ MATCH FOUND: " + reqUrl);
                m3u8Link = reqUrl;
                referer = req.headers()['referer'] || referer;
                req.abort(); 
            } else if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                req.abort(); // Images load mat karo (Speed Up)
            } else {
                req.continue();
            }
        });

        // Timeout badha diya (2 min) taaki slow net pe crash na ho
        console.log("Navigating to page...");
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });

        // Agar Cloudflare screen aaye, toh thoda wait karo
        console.log("Page Title: " + await page.title());

        // Play Button Click Attempt
        try {
            const playSelector = '#play-btn, .play-button, .btn-play';
            await page.waitForSelector(playSelector, { timeout: 10000 });
            await page.click(playSelector);
            console.log("Play button clicked");
        } catch (e) {
            console.log("Play button not found or auto-played");
        }

        // 10 second wait karo link capture karne ke liye
        await new Promise(r => setTimeout(r, 10000));

    } catch (error) {
        console.error("❌ Scraping Error:", error.message);
    } finally {
        if (browser) await browser.close();
    }

    if (m3u8Link) {
        return { success: true, url: m3u8Link, referer: referer };
    } else {
        return { success: false, error: "Link capture failed (Check logs)" };
    }
}

app.get('/watch', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: "No URL provided" });

    const data = await scrapeLink(targetUrl);
    res.json(data);
});

app.get('/', (req, res) => res.send('Server is Live! 🟢'));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
