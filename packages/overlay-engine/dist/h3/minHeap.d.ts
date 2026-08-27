export declare class MinHeap<T> {
    private data;
    get size(): number;
    push(key: number, value: T): void;
    pop(): {
        key: number;
        value: T;
    } | undefined;
    private bubbleUp;
    private bubbleDown;
}
//# sourceMappingURL=minHeap.d.ts.map