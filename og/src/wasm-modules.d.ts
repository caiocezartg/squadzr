// A `.wasm?module` import is a precompiled module on Workers (the Cloudflare Vite plugin's convention).
declare module '*.wasm?module' {
  const wasmModule: WebAssembly.Module
  export default wasmModule
}
