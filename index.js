const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

async function scrapeAnimePahe(url) {
    console.log(`🕵️ Starting Scrape for: ${url}`);
    
    let m3u8Link = null;
    let referer = null;
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
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
        });

        const page = await browser.newPage();

        // User Agent set karo
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Headers mein Referer set karo (bina iske video nahi load hoti)
        // URL se domain nikal lo (jaise https://animepahe.si)
        const urlObj = new URL(url);
        const domain = urlObj.origin; 

        await page.setExtraHTTPHeaders({
            'Referer': domain, 
        });

        await page.setRequestInterception(true);
        
        page.on('request', (req) => {
            const reqUrl = req.url();
            
            // Kwik server se .m3u8 pakdo
            if (reqUrl.includes('.m3u8')) {
                console.log("✅ STREAM FOUND: " + reqUrl);
                m3u8Link = reqUrl;
                // Referer capture karo ya default domain use karo
                referer = req.headers()['referer'] || domain;
                req.abort(); 
            } 
            // Faltu cheezein block karo
            else if (['image', 'font', 'stylesheet'].includes(req.resourceType()) && !reqUrl.includes('kwik')) {
                req.abort();
            } else {
                req.continue();
            }
        });

        console.log("Navigating...");
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        console.log("Page Title: " + await page.title());

        // Wait karo taaki request capture ho jaye
        await new Promise(r => setTimeout(r, 8000));

    } catch (error) {
        console.error("❌ Error:", error.message);
    } finally {
        if (browser) await browser.close();
    }

    if (m3u8Link) {
        return { success: true, url: m3u8Link, referer: referer, source: "AnimePahe" };
    } else {
        return { success: false, error: "Link not found. Maybe try again?" };
    }
}

app.get('/watch', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: "No URL provided" });
    
    // Sirf check karo ki 'animepahe' shabd hai ya nahi URL mein
    if (!targetUrl.includes('animepahe')) {
        return res.status(400).json({ error: "Please provide an AnimePahe URL" });
    }

    const data = await scrapeAnimePahe(targetUrl);
    res.json(data);
});

app.get('/', (req, res) => res.send('AnimePahe Universal Scraper 🟢'));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
