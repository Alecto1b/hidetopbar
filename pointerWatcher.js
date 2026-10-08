import GLib from 'gi://GLib';

// Local replacement for resource:///org/gnome/shell/ui/pointerWatcher.js,
// which GNOME Shell removed in 51. Polls global.get_pointer() while at least
// one watch is registered. Callers only add a watch while the pointer is on
// the panel, so polling is short-lived.

class PointerWatch {
    constructor(watcher, interval, callback) {
        this._watcher = watcher;
        this.interval = interval;
        this.callback = callback;
    }

    // Safe to call from inside the callback.
    remove() {
        this._watcher._removeWatch(this);
    }
}

class PointerWatcher {
    constructor() {
        this._watches = [];
        this._timeoutId = 0;
        this._x = null;
        this._y = null;
    }

    addWatch(interval, callback) {
        [this._x, this._y] = global.get_pointer();
        const watch = new PointerWatch(this, interval, callback);
        this._watches.push(watch);
        this._updateTimeout();
        return watch;
    }

    _removeWatch(watch) {
        const i = this._watches.indexOf(watch);
        if (i < 0) return;
        this._watches.splice(i, 1);
        this._updateTimeout();
    }

    _updateTimeout() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._watches.length === 0) return;

        const interval = Math.min(...this._watches.map(w => w.interval));
        this._timeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT, interval, () => {
                this._poll();
                return GLib.SOURCE_CONTINUE;
            },
        );
    }

    _poll() {
        const [x, y] = global.get_pointer();
        if (x === this._x && y === this._y) return;
        this._x = x;
        this._y = y;
        // Copy: callbacks may remove watches while we iterate.
        for (const watch of [...this._watches]) {
            if (this._watches.includes(watch))
                watch.callback(x, y);
        }
    }

    destroy() {
        this._watches = [];
        this._updateTimeout();
    }
}

export function createPointerWatcher() {
    return new PointerWatcher();
}
