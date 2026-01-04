import asyncio
import re
import random
import tempfile
import os
import time
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import tls_client

# -------------------- Utility --------------------
def random_user_agent():
    agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/124.0.0.0 Safari/537.36"
    ]
    return random.choice(agents)

# -------------------- AnimePahe Class --------------------
class AnimePahe:
    def __init__(self):
        self.base = "https://animepahe.si"
        # Browser Identifier Update kiya (Newer version)
        self.session = tls_client.Session(client_identifier="chrome_124", random_tls_extension_order=True)

    async def get(self, url: str, referer: str = "https://animepahe.si/"):
        """Run tls-client GET asynchronously with error handling"""
        headers = {
            "User-Agent": random_user_agent(),
            "Referer": referer,
            "Origin": "https://animepahe.si",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest"
        }
        
        def _req():
            # Thoda random delay taaki bot na lage
            time.sleep(random.uniform(0.5, 1.5))
            r = self.session.get(url, headers=headers)
            return r
        
        resp = await asyncio.to_thread(_req)
        return resp

    async def search(self, query: str):
        url = f"{self.base}/api?m=search&q={query}"
        r = await self.get(url)
        
        try:
            data = r.json()
        except:
            # Agar JSON fail ho jaye, toh print karo ki server ne kya bheja
            print(f"❌ Blocked/Error: Status {r.status_code}")
            print(f"Response: {r.text[:500]}") # Sirf shuruwat ka text dikhao
            raise Exception(f"Server sent non-JSON response. Status: {r.status_code}. Likely Cloudflare blocked Render IP.")

        results = []
        for a in data.get("data", []):
            results.append({
                "id": a["id"],
                "title": a["title"],
                "url": f"{self.base}/anime/{a['session']}",
                "year": a.get("year"),
                "poster": a.get("poster"),
                "type": a.get("type"),
                "session": a.get("session")
            })
        return results

    async def get_episodes(self, anime_session: str):
        # Anime Session Page (HTML) load karo
        r = await self.get(f"{self.base}/anime/{anime_session}")
        if "Just a moment" in r.text:
             raise Exception("Cloudflare Challenge Detected! (IP Blocked)")

        html = r.text
        soup = BeautifulSoup(html, "html.parser")
        meta = soup.find("meta", {"property": "og:url"})
        if not meta:
            raise Exception("Could not find session ID. Page might be blocked.")
        
        temp_id = meta["content"].split("/")[-1]

        # First Page fetch karo
        r_api = await self.get(f"{self.base}/api?m=release&id={temp_id}&sort=episode_asc&page=1")
        try:
            first_page_json = r_api.json()
        except:
             raise Exception(f"API Blocked on Episode List. Status: {r_api.status_code}")

        episodes = first_page_json.get("data", [])
        last_page = first_page_json.get("last_page", 1)

        # Baaki pages fetch karo (Limit lagayi hai taaki IP block na ho)
        # Agar bahut zyada pages hain toh sirf pehle 5 page load karenge safe rehne ke liye
        safe_limit = min(last_page, 5) 
        
        for p in range(2, safe_limit + 1):
            r_page = await self.get(f"{self.base}/api?m=release&id={temp_id}&sort=episode_asc&page={p}")
            try:
                page_data = r_page.json()
                episodes.extend(page_data.get("data", []))
            except:
                continue # Agar ek page fail ho jaye toh skip karo

        return [
            {
                "id": e["id"],
                "number": e["episode"],
                "title": e.get("title") or f"Episode {e['episode']}",
                "snapshot": e.get("snapshot"),
                "session": e["session"],
            }
            for e in episodes
        ]

    async def get_sources(self, anime_session: str, episode_session: str):
        url = f"{self.base}/play/{anime_session}/{episode_session}"
        r = await self.get(url)
        html = r.text

        # Buttons extract karo
        buttons = re.findall(
            r'<button[^>]+data-src="([^"]+)"[^>]+data-fansub="([^"]+)"[^>]+data-resolution="([^"]+)"[^>]+data-audio="([^"]+)"[^>]*>',
            html
        )

        sources = []
        for src, fansub, resolution, audio in buttons:
            if src.startswith("https://kwik."):
                sources.append({
                    "url": src,
                    "quality": f"{resolution}p",
                    "fansub": fansub,
                    "audio": audio
                })

        if not sources:
            # Fallback regex agar button na mile
            kwik_links = re.findall(r"https:\/\/kwik\.(si|cx|link)\/e\/\w+", html)
            sources = [{"url": link, "quality": "Unknown", "fansub": "Unknown", "audio": "jpn"} for link in kwik_links]

        return sources

    async def resolve_kwik_with_node(self, kwik_url: str, node_bin: str = "node") -> str:
        """Kwik Decryptor using Node.js"""
        # Referer Kwik ka hona chahiye
        r = await self.get(kwik_url, referer="https://animepahe.si/")
        html = r.text
        
        if "Just a moment" in html:
            raise Exception("Cloudflare blocked Kwik URL")

        # Extraction logic same as before...
        scripts = re.findall(r"(<script[^>]*>[\s\S]*?</script>)", html, re.IGNORECASE)
        script_block, largest_eval_script, max_len = None, None, 0
        for s in scripts:
            if "eval(" in s:
                if "Plyr" in s or ".m3u8" in s or "source" in s or "uwu" in s:
                    script_block = s
                    break
                if len(s) > max_len:
                    max_len = len(s)
                    largest_eval_script = s
        
        if not script_block:
            script_block = largest_eval_script
        
        if not script_block:
             # Kabhi kabhi Kwik seedha m3u8 de deta hai bina encryption ke
            direct_m3u8 = re.search(r"https?://[^'\"\s<>]+\.m3u8", html)
            if direct_m3u8:
                return direct_m3u8.group(0)
            raise Exception("No encrypted script found in Kwik page")

        inner_js = re.sub(r"^<script[^>]*>", "", script_block, flags=re.IGNORECASE).strip()
        inner_js = re.sub(r"</script>$", "", inner_js, flags=re.IGNORECASE).strip()

        wrapper = r"""
globalThis.window = { location: {} };
globalThis.document = { cookie: '' };
globalThis.navigator = { userAgent: 'mozilla' };
const __captured = [];
const origLog = console.log;
console.log = (...args)=>{__captured.push(args.join(' '));origLog(...args);};
(function(){
  const origEval = eval;
  eval = (x)=>{__captured.push('[EVAL]' + x);return origEval(x);};
})();
"""
        final_js = wrapper + "\n" + inner_js + "\n" + (
            "setTimeout(()=>{for(const c of __captured){console.log('__CAPTURED__START__');"
            "console.log(c);console.log('__CAPTURED__END__');}process.exit(0)},300);"
        )

        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as tf:
            tmp_path = tf.name
            tf.write(final_js)
            tf.flush()

        try:
            proc = await asyncio.create_subprocess_exec(
                node_bin, tmp_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
        finally:
            os.unlink(tmp_path)

        out = (stdout.decode(errors="ignore") + stderr.decode(errors="ignore"))
        m = re.search(r"https?://[^'\"\s]+\.m3u8[^\s'\"\)]*", out)
        if m:
            return m.group(0)

        raise Exception(f"Node execution failed. Output: {out[:200]}")

# -------------------- FastAPI --------------------
app = FastAPI()
pahe = AnimePahe()

@app.get("/")
def home():
    return {"status": "Running", "message": "AnimePahe Scraper v2"}

@app.get("/search")
async def api_search(q: str):
    try:
        return await pahe.search(q)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/episodes")
async def api_episodes(session: str):
    try:
        return await pahe.get_episodes(session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sources")
async def api_sources(anime_session: str, episode_session: str):
    try:
        return await pahe.get_sources(anime_session, episode_session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/m3u8")
async def api_resolve_kwik(url: str):
    try:
        m3u8 = await pahe.resolve_kwik_with_node(url)
        return {"m3u8": m3u8}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
