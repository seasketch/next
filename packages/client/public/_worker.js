const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/sprites/")) {
      const filename = /sprites\/(.*)/.exec(url.pathname)[1];
      const spriteUrl = `${env.SPRITES_BASE_URL}${filename}`;
      const response = await fetch(spriteUrl);
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("Cache-Control", "public, max-age=500");
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      newResponse.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      newResponse.headers.set("Access-Control-Allow-Headers", "Content-Type");
      newResponse.headers.set("Access-Control-Max-Age", "600");
      return newResponse;
    } else {
      throw new Error("Unrecognized request: " + request.url);
    }
  },
};

export default worker;
