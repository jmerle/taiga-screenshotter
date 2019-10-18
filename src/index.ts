import * as fs from 'fs';
import * as puppeteer from 'puppeteer';
import * as rimraf from 'rimraf';

// tslint:disable-next-line:no-var-requires
const mergeImg = require('merge-img');

async function takeScreenshot(page: puppeteer.Page, name: string, clip?: puppeteer.BoundingBox): Promise<void> {
  if (!fs.existsSync('out')) {
    await fs.promises.mkdir('out');
  }

  const options: puppeteer.BinaryScreenShotOptions = {
    path: `out/${name}.jpg`,
    type: 'jpeg',
    quality: 100,
  };

  if (clip !== undefined) {
    options.clip = clip;
  } else {
    options.fullPage = true;
  }

  await page.screenshot(options);
  console.log(`Screenshotted page to ${options.path}`);
}

function getRect(page: puppeteer.Page, sel: string): Promise<puppeteer.BoundingBox> {
  return page.evaluate(selector => {
    const element = document.querySelector(selector);
    const paddingBottom = window.getComputedStyle(element, null).getPropertyValue('margin-bottom');
    const { x, y, width, height } = element.getBoundingClientRect();

    return {
      x,
      y,
      width,
      height: height + parseInt(paddingBottom.split('px')[0], 10),
    };
  }, sel);
}

async function getStatsRect(page: puppeteer.Page): Promise<puppeteer.BoundingBox> {
  const summaryRect = await getRect(page, '.summary.large-summary');
  const burndownRect = await getRect(page, '.burndown');

  return {
    x: summaryRect.x,
    y: summaryRect.y,
    width: Math.max(summaryRect.width, burndownRect.width),
    height: summaryRect.height + burndownRect.height,
  };
}

(async () => {
  if (process.argv.length !== 3) {
    console.error('Usage: yarn start <scrumboard url>');
    process.exit(1);
  }

  console.log('Cleaning out...');
  rimraf.sync('out/');

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setViewport({
    width: 1920,
    height: 1080,
  });

  await page.setCookie({
    name: 'cookieConsent',
    value: '1',
    domain: 'tree.taiga.io',
    path: '/',
  });

  await page.goto(process.argv[2]);
  await page.waitForSelector('.loader.active');
  await page.waitForSelector('.loader:not(.active)');

  console.log('Screenshotting burn down chart...');

  await page.click('.toggle-analytics-visibility');
  await page.waitFor(1000);

  const statsRect = await getStatsRect(page);
  await takeScreenshot(page, 'burndownchart', statsRect);

  console.log('Screenshotting scrum board...');

  const columnCount = await page.evaluate(() => {
    document.body.appendChild(document.querySelector('div[tg-taskboard-sortable]'));
    document.querySelector<HTMLDivElement>('.taskboard-table-body').style.marginBottom = '0px';

    document.querySelector('.master').remove();
    document.querySelector('div[tg-navigation-bar]').remove();

    return document.querySelectorAll('.taskboard-table-inner > .task-colum-name').length;
  });

  await page.setViewport({
    width: columnCount * 305 - 5,
    height: 1080,
  });

  await takeScreenshot(page, 'scrumbord');

  if (process.env.SKIP_STORIES) {
    await browser.close();
    return;
  }

  console.log('Screenshotting user stories...');

  const userStoryImages = [];
  const userStoryLinks = await page.evaluate(async () => {
    return [...document.querySelectorAll<HTMLLinkElement>('h3.us-title > a')].map(el => {
      const id = /#(\d+)/.exec(el.title)[1];

      const prefix = el.href.split('/taskboard')[0];
      const suffix = `/us/${id}`;

      return prefix + suffix;
    });
  });

  for (let i = 0; i < userStoryLinks.length; i++) {
    await page.goto(userStoryLinks[i]);
    await page.waitForSelector('.loader.active');
    await page.waitForSelector('.loader:not(.active)');

    await page.evaluate(() => {
      const main = document.querySelector('.main.us-detail');

      main.querySelector('.us-detail-header').remove();
      main.querySelector('tg-custom-attributes-values').remove();
      main.querySelector('.related-tasks').remove();
      main.querySelector('tg-attachments-full').remove();
      main.querySelector('tg-history-section').remove();

      document.body.appendChild(main);

      document.querySelector('.master').remove();
      document.querySelector('div[tg-navigation-bar]').remove();
    });

    const mainRect = await getRect(page, '.main.us-detail');
    await takeScreenshot(page, `user-story-${i}`, mainRect);

    userStoryImages.push(`out/user-story-${i}.jpg`);
  }

  console.log('Merging user stories to out/user-stories.png...');

  const mergedStories = await mergeImg(userStoryImages, { direction: true });
  await mergedStories.write('out/user-stories.png');

  await browser.close();
})();
