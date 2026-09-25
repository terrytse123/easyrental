import { createServerFn } from "@tanstack/react-start";

export const getRentIndex = createServerFn({ method: "GET" }).handler(async () => {
  const { loadRentIndex } = await import("./index-feed.server");
  return loadRentIndex();
});
