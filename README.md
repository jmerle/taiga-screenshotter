# Taiga Screenshotter

A little Node.js script to take screenshots of a Taiga scrumboard and burndown chart.

## Usage

Clone the repository, `cd` into it and install the dependencies with `yarn` ([Node.js](https://nodejs.org/en/) and [Yarn](https://yarnpkg.com/en/) need to be installed). After that's done, run `yarn start <url to scrumboard>` to take a screenshot of the burndown chart and the statistics above it to `out/burndownchart.jpg` and to take a screenshot of the full scrum board to `out/scrumbord.jpg`. `<url to scrumboard>` should be a url like `https://tree.taiga.io/project/<project>/taskboard/<sprint>`.
