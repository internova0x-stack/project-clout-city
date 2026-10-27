const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
await p.goto('http://localhost:3123/preview/home?time=night',{timeout:120000});await p.waitForTimeout(7000);
await p.getByRole('button',{name:/^Map$/}).first().click();await p.waitForTimeout(15000);
await p.screenshot({path:'/tmp/claude-0/-home-user-project-clout-city/0fd143c4-b038-5ad6-92ff-921b528b940a/scratchpad/'+process.argv[2]+'.png'});await b.close();})();
