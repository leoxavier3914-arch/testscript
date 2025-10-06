export default class RateLimiter {
  private timestamps = new Map<string, number>();
  constructor(private readonly intervalMs: number) {}

  public tryConsume(id: string, now: number): boolean {
    const last = this.timestamps.get(id) ?? 0;
    if (now < last + this.intervalMs) {
      return false;
    }
    this.timestamps.set(id, now);
    return true;
  }
}
