import { AppErrorStore } from '$lib/stores/Store';

export class ErrorLogger extends Error {
    constructor(message) {
        super(message);
        AppErrorStore.update((old) => (old.push(this), old));
    }
}
