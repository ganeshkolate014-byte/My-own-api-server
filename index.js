const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

async function scrapeAnimePahe(url) {
    console.log(`🕵️ Starting AnimePahe Scrape for: ${url}`);
    
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

        // AnimePahe ke liye User Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.setRequestInterception(true);
        
        page.on('request', (req) => {
            const reqUrl = req.url();
            
            // 🔥 AnimePahe "kwik" server use karta hai, wahan .m3u8 dhundo
            if (reqUrl.includes('.m3u8')) {
                console.log("✅ STREAM FOUND: " + reqUrl);
                m3u8Link = reqUrl;
                // AnimePahe mein Referer bahut zaroori hai
                referer = req.headers()['referer'] || "https://animepahe.ru/";
                req.abort(); 
            } 
            // Faltu ads aur images block karo (Speed ke liye)
            else if (['image', 'font', 'stylesheet', 'script'].includes(req.resourceType()) && !reqUrl.includes('kwik')) {
                req.abort();
            } else {
                req.continue();
            }
        });

        console.log("Navigating to page...");
        // AnimePahe fast hai, 45 sec timeout kaafi hai
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        
        const title = await page.title();
        console.log("Page Title: " + title);

        // AnimePahe par kabhi kabhi "Click to verify" aata hai, uske liye wait
        try {
            // Agar video player ka iframe ya button dikhe toh click karo
            const playButton = 'button#play, .play-btn, iframe';
            await page.waitForSelector(playButton, { timeout: 5000 });
            // await page.click(playButton); // Zyadatar automatic load ho jata hai
        } catch (e) {
            console.log("Play button not required or autostarted.");
        }

        // 10 Second wait karo link capture hone ka
        await new Promise(r => setTimeout(r, 10000));

    } catch (error) {
        console.error("❌ Error:", error.message);
    } finally {
        if (browser) await browser.close();
    }

    if (m3u8Link) {
        return { success: true, url: m3u8Link, referer: referer, source: "AnimePahe" };
    } else {
        return { success: false, error: "Could not find stream on AnimePahe." };
    }
}

app.get('/watch', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: "No URL provided" });
    
    // Check karo ki AnimePahe ka link hai ya nahi
    if (!targetUrl.includes('animepahe')) {
        return res.status(400).json({ error: "Please provide an AnimePahe URL" });
    }

    const data = await scrapeAnimePahe(targetUrl);
    res.json(data);
});

app.get('/', (req, res) => res.send('AnimePahe Scraper Ready! 🟢'));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
