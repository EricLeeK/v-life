/** Explicit, resumable provider smoke test. No generation occurs without --submit=<provider>. */
import { submitImage, pollImage, decodeImage, fetchImageBytes, inspectImage, ImageProviderError, type ImageResult } from '../supabase/functions/_shared/newspaperImageProviders.ts';
import { normalizeNewspaperImageOptions } from '../supabase/functions/_shared/newspaperImageModels.ts';
import { resizeNewspaperImage } from '../supabase/functions/_shared/newspaperImageResize.ts';
import type { ImageProvider } from '../supabase/functions/_shared/newspaperTypes.ts';

const caseName = Deno.args.find(arg => arg.startsWith('--case='))?.slice(7);
if (caseName && !/^[a-z0-9-]{1,40}$/.test(caseName)) throw new Error('Invalid case name');
const directory = `temp/newspaper-live.local${caseName ? `/${caseName}` : ''}`;
await Deno.mkdir(directory, { recursive: true });
const names: ImageProvider[] = ['grsai', 'openai', 'gemini'];
for (const provider of names) {
  const path = `${directory}/${provider}.json`;
  let state: any;
  try { state = JSON.parse(await Deno.readTextFile(path)); } catch { /* first run */ }
  const save = async () => { await Deno.writeTextFile(path, JSON.stringify(state, null, 2)); };
  const env = { grsai: 'GRSAI_API_KEY', openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY' }[provider];
  const key = Deno.env.get(env);
  if (state && /请求失败（400）/.test(state.error || '') && Deno.args.includes(`--retry-rejected=${provider}`)) {
    await Deno.writeTextFile(`${directory}/${provider}-rejected-${Date.now()}.json`, JSON.stringify(state, null, 2));
    state = undefined;
  }
  if (!state && !Deno.args.includes(`--submit=${provider}`)) { console.log(JSON.stringify({ provider, status: key ? 'not_submitted' : 'missing_key' })); continue; }
  if (!key) { console.log(JSON.stringify({ provider, status: 'missing_key' })); continue; }
  if (state && !['running', 'saving'].includes(state.status)) { console.log(JSON.stringify({ provider, ...state, image: undefined })); continue; }
  const diagnosticFetch: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    if (!response.ok) {
      const diagnostic = (await response.clone().text()).replaceAll(key, '[redacted]').replace(/(?:sk-|AIza)[A-Za-z0-9_\-]{12,}/g, '[redacted]').slice(0, 2000);
      state.diagnostic = { status: response.status, body: diagnostic }; await save();
    }
    return response;
  };
  try {
    let response: ImageResult | undefined;
    if (!state) {
      const model = Deno.args.find(arg => arg.startsWith(`--model=${provider}:`))?.split(':')[1];
      const options = normalizeNewspaperImageOptions({ provider, ...(model ? {model} : {}), ...(provider === 'gemini' ? { size: '1K' } : {}) });
      state = { provider, options, started_at: new Date().toISOString(), status: 'submitting', request_id: crypto.randomUUID() };
      await save(); // A crash or timeout cannot silently create a second paid request.
      response = await submitImage(options, 'A small editorial illustration of a folded cream newspaper, a cup of tea and a pencil on a quiet desk. Warm ink linework, restrained colors, no text, no people. This is a software integration test.', key, [], state.request_id, { grsai: 'https://grsai.dakka.com.cn', openai: 'https://api.openai.com', gemini: 'https://generativelanguage.googleapis.com' }[provider], diagnosticFetch);
    } else if (state.status === 'running') {
      response = await pollImage(state.options, state.provider_id, key, { grsai: 'https://grsai.dakka.com.cn', openai: 'https://api.openai.com', gemini: 'https://generativelanguage.googleapis.com' }[provider]);
    }
    if (response?.state === 'running') { state.status = 'running'; state.provider_id = response.id; await save(); }
    if (response?.state === 'failed') { state.status = 'failed'; state.error = response.error; await save(); }
    if (response?.state === 'succeeded') { state.status = 'saving'; state.image = response.image; await save(); }
    if (state.status === 'saving') {
      const bytes = state.image.data ? decodeImage(state.image.data, state.image.mime) : await fetchImageBytes(state.image.url);
      const info = inspectImage(bytes);
      const thumbnail = await resizeNewspaperImage(bytes);
      const originalPath = `${directory}/${provider}-original.${info.extension}`;
      const thumbnailPath = `${directory}/${provider}-thumbnail.webp`;
      await Deno.writeFile(originalPath, bytes); await Deno.writeFile(thumbnailPath, thumbnail);
      const reloaded = await Deno.readFile(originalPath);
      if (reloaded.length !== bytes.length || reloaded.some((v, i) => v !== bytes[i])) throw new Error('Saved original mismatch');
      const thumbInfo = inspectImage(await Deno.readFile(thumbnailPath));
      state.status = 'succeeded'; state.completed_at = new Date().toISOString();
      state.original = { ...info, bytes: bytes.length }; state.thumbnail = { ...thumbInfo, bytes: thumbnail.length };
      state.persistence = 'local_file_roundtrip'; delete state.image; await save();
    }
  } catch (error) {
    if (state.status === 'submitting') state.status = error instanceof ImageProviderError && error.definitive ? 'failed' : 'unknown';
    state.error = error instanceof Error ? error.message : 'Verification failed'; await save();
  }
  console.log(JSON.stringify({ ...state, image: undefined }));
}
