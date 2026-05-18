// Required fallback for the @modal parallel slot. Returning null means "no
// modal currently rendered". Without this file, Next.js would 404 any hard
// navigation under (main).
export default function Default() {
  return null;
}
