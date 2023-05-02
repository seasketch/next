# `map-screenshotter`

Lambda service which captures images of SeaSketch maps. It relies on the SeaSketch client hosting a page which can render a map (without extra chrome) using a single url. This page should signal to the process that the map is ready to be captured by creating an element on the page with an id of `#loaded`.

## Using in development

In the past there have been workarounds created to run a lambda process in the development environment. These workarounds are difficult to create and the differences between the production and local environment are a common source of problems. This time I'm not going to waste my time creating such a workaround.

During development, simply deploy the lambda directly to AWS and use [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/local/) to tunnel the local dev environment to `*-dev.seasketch.org`. Then, the lambda will be able to access the dev client and data in order to create screenshots. If drastic changes need to be tested that would interrupt the production service just deploy a dev version of the lambda at a different service endpoint and test that.

## Lambda Layers

We're relying on the [Sparticuz/chromium](https://github.com/Sparticuz/chromium) package to have a recent chrome with support for webgl on lambda. This package needs to be in sync with the requirements of puppeteer. For example, @sparticuz/chromium@112 can be used with Puppeteer v19.8.0 according to the [compatibility table](https://pptr.dev/chromium-support).
