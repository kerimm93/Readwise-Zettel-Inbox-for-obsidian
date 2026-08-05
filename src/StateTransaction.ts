export async function writeThenSwapState<T>(previous: T, candidate: T, write: (candidate: T) => Promise<void>): Promise<T> {
  try {
    await write(candidate);
    return candidate;
  } catch (error) {
    void previous;
    throw error;
  }
}
