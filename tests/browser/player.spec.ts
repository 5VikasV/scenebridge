import { test, expect } from "@playwright/test";

test.beforeEach(async({page})=>{
  await page.goto("/");
  await expect(page.locator("#mode")).toHaveText("OFFLINE FIXTURE");
  await page.waitForFunction(()=>Number.isFinite((document.querySelector("video") as HTMLVideoElement).duration));
});

test("playback, seeking and native media byte ranges work",async({page,request})=>{
  const response=await request.get("/media/mystery.mp4",{headers:{Range:"bytes=0-31"}});
  expect(response.status()).toBe(206);
  expect(response.headers()["content-range"]).toMatch(/^bytes 0-31\//);
  await page.locator("#play").click();
  await expect.poll(()=>page.locator("video").evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(.5);
  await page.locator("#play").click();
  await expect(page.locator("#play-state")).toHaveText("PAUSED");
});

test("same question before and after reveal, evidence replay returns to anchor",async({page})=>{
  await page.locator("video").evaluate((v:HTMLVideoElement)=>{v.currentTime=95;v.pause();});
  await page.locator("#question").fill("Why did Mira hide the key?");
  await page.locator("#ask").click();
  await expect(page.locator("#response-label")).toHaveText("NOT ESTABLISHED YET");
  await expect(page.locator("#evidence button")).toHaveCount(0);
  await page.locator("#resume").click();
  await page.locator("video").evaluate((v:HTMLVideoElement)=>{v.pause();v.currentTime=156;});
  await page.locator("#ask").click();
  await expect(page.locator("#answer")).toContainText("prevent the damaged projector");
  await page.locator(".evidence-card").click();
  await expect(page.locator("#replay-badge")).toBeVisible();
  await expect.poll(()=>page.locator("video").evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThanOrEqual(147);
  await page.locator("#resume").click();
  const resumed=await page.locator("video").evaluate((v:HTMLVideoElement)=>v.currentTime);
  expect(resumed).toBeGreaterThanOrEqual(156);expect(resumed).toBeLessThan(158);
});

test("rewind clears later answer and context",async({page})=>{
  await page.locator("video").evaluate((v:HTMLVideoElement)=>{v.currentTime=156;});
  await page.locator("#question").fill("Why did Mira hide the key?");
  await page.locator("#ask").click();
  await expect(page.locator("#response-label")).toHaveText("HERE'S THE CONTEXT");
  await page.locator("#seek").fill("95");
  await page.locator("#seek").dispatchEvent("input");
  await expect(page.locator("#response")).toBeHidden();
  await page.locator("#ask").click();
  await expect(page.locator("#response-label")).toHaveText("NOT ESTABLISHED YET");
});

test("opening question entry freezes the moment before typing",async({page})=>{
  await page.locator("video").evaluate((v:HTMLVideoElement)=>{v.currentTime=95;});
  await page.locator("#play").click();
  await expect.poll(()=>page.locator("video").evaluate((v:HTMLVideoElement)=>v.paused)).toBe(false);
  await page.locator("#question").focus();
  expect(await page.locator("video").evaluate((v:HTMLVideoElement)=>v.paused)).toBe(true);
  await page.locator("#question").fill("Why did Mira hide the key?");
  await page.locator("#ask").click();
  await expect(page.locator("#response-label")).toHaveText("NOT ESTABLISHED YET");
  await expect(page.locator("#boundary-title")).toContainText("01:35");
});

test("answer failure offers retry and preserves playhead",async({page})=>{
  await page.locator("video").evaluate((v:HTMLVideoElement)=>{v.currentTime=95;});
  await page.route("/ask",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Service unavailable. Please retry."})}));
  await page.locator("#recap").click();
  await expect(page.locator("#retry")).toBeVisible();
  expect(await page.locator("video").evaluate((v:HTMLVideoElement)=>v.currentTime)).toBe(95);
  await page.unroute("/ask");
  await page.locator("#retry").click();
  await expect(page.locator(".evidence-card").first()).toBeVisible();
});

test("desktop and narrow previews remain readable",async({page})=>{
  await page.screenshot({path:"artifacts/browser-home.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator("#question")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path:"artifacts/browser-mobile.png",fullPage:true});
});
