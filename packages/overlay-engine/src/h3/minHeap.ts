export class MinHeap<T> {
  private data: { key: number; value: T }[] = [];

  get size() {
    return this.data.length;
  }

  push(key: number, value: T) {
    this.data.push({ key, value });
    this.bubbleUp(this.data.length - 1);
  }

  pop(): { key: number; value: T } | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  private bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[parent]!.key <= this.data[i]!.key) break;
      const tmp = this.data[parent]!;
      this.data[parent] = this.data[i]!;
      this.data[i] = tmp;
      i = parent;
    }
  }

  private bubbleDown(i: number) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left = i * 2 + 1;
      const right = i * 2 + 2;
      if (left < n && this.data[left]!.key < this.data[smallest]!.key) {
        smallest = left;
      }
      if (right < n && this.data[right]!.key < this.data[smallest]!.key) {
        smallest = right;
      }
      if (smallest === i) break;
      const tmp = this.data[i]!;
      this.data[i] = this.data[smallest]!;
      this.data[smallest] = tmp;
      i = smallest;
    }
  }
}
