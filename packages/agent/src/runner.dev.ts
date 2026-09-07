import { createExaProvider } from "./provider/exa.js";

const exa = createExaProvider();
console.log({
  provider: "exa",
  searchResults: await exa.search("system analyst BRD"),
  openAIConfigured: Boolean(process.env.OPENAI_API_KEY),
  lensConfigured: process.env.ANVIA_LENS_ENABLED === "true",
});
