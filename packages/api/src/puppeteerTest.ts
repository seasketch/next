import puppeteer from "puppeteer";

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: {
      deviceScaleFactor: 2,
      width: 1280,
      height: 1024,
    },
  });
  const page = await browser.newPage();

  await page.goto(
    "http://localhost:3000/screenshot.html?mt=pk.eyJ1Ijoic2Vhc2tldGNoIiwiYSI6ImNrbjZicDVlczBjbnYzMXA3MHoxbXduNHQifQ.YaQRyflC6yWt6BrSVKO83g&bookmark=17f70e65-c46e-4068-8c78-f9f834ba990e&host=http://localhost:3857&auth=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjhkOGJjN2FlLWEzNjMtNDQ4OC04MjNjLWU4MDNjNmI5M2VmNSIsImprdSI6Imh0dHBzOi8vc2Vhc2tldGNoLm9yZy8ud2VsbC1rbm93bi9qd2tzLmpzb24ifQ.eyJ0eXBlIjoic2tldGNoLWdlb21ldHJ5LWFjY2VzcyIsInVzZXJJZCI6MiwicHJvamVjdElkIjoyLCJjYW5vbmljYWxFbWFpbCI6InVuZGVyYmx1ZXdhdGVyc0BnbWFpbC5jb20iLCJpYXQiOjE2Nzc4ODc1MDYsImV4cCI6MTY3Nzk3MzkwNiwiaXNzIjoiaHR0cHM6Ly9zZWFza2V0Y2gub3JnIn0.kvrVUCyvKKHutujKfvzqlEnIF7GYAnTPc1WEXcId6y_Cf7K2RF-XOPgStxtdE6Na_VJOEeqN0Wb6iKCWqQPquwh5RkKQOTZ1xHoCjmc_S2oXofIZf_W6rkB1i7jLPw3dGtw8DoTzBn9LaXTmSHh8FXxcINyNMLKMIjF3p0x2zX21Fcs4PmndRBjdCnadfHV5c8RNg_4VVAg4Gc2Q5SYtWYx6SKVajYU8IMCa3bo4_GjVxNXRjJcXeXjQgZEsnKgvZ5rEx9bQCsVqEsVM6PBfhTBycMMxylfNYGqn9C5Tbd_bJR3Q4VX2VOFaO_hMHyiRDW4ybX3H1cL7uc7DKUecoLyS2QBu3AeTsj8aTmRoaZksirJUiu9M0uePmEmw-wEUZ9a86OYKFMXs4lE4YGZoyj4Wpyt2E5-vAvvIv9l369L1yO-8c5SBYR6siVB8i6y_jXNwcywHu14y57WbhxxB5YMIPCUORwXZzosLUBQy_FccwSWG89MnAhS9khCcjUa7rnDCifYc-_JajrDqy0iXXUPu821ucNSsBuJ-GFU4_V3-TofNWsWwKajAgmM4-90K_8SeXupAhEr1mOsLPqTdgclYbUHUwbQnyK7Wz1PKD4T5wo9iBZOv0dkvYaLDZ8nAKezb74ulig49jq0p-zdIlNCnWlHbUDbcucCtgKtBGfc"
  );

  // Set screen size
  await page.setViewport({ width: 1821, height: 1304, deviceScaleFactor: 2 });

  await page.waitForTimeout(500);
  await page.waitForNetworkIdle({ timeout: 10000 });
  await page.waitForTimeout(500);
  await page.waitForNetworkIdle({ timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({
    captureBeyondViewport: false,
    path: "/Users/cburt/Downloads/puppeteer.png",
  });
  await browser.close();
  process.exit();
})();
